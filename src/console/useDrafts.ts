import { useCallback, useEffect, useRef, useState } from 'react'
import { streamDraft, type DraftModels, type Route, type Source } from '../ai'
import { checkDraft, type CheckResult, type FactSheet, type Issue } from '../checker'
import type { DeviceStatus } from '../ai/deviceStatus'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import { buildDraftPrompt, buildRetryPrompt } from '../drafting/prompt'
import { nextStep, type AttemptOutcome } from '../drafting/route'

export type Attempt = {
  id: number
  route: Route
  /** The prompt quoted the last draft and the checker's reasons. */
  retry: boolean
  startedAt: number
  firstTextMs?: number
  endedMs?: number
  text: string
  source?: Source
  passed?: boolean
  issueCount?: number
  error?: string
  /** The officer moved on to the cloud after the on-device budget. */
  abandoned?: boolean
}

export type Draft = {
  /** The alert text: streamed by a model, then editable by the officer. */
  text: string
  attempts: Attempt[]
  running: boolean
  /** Why drafting stopped without a passing alert. */
  note?: string
  approved: boolean
  /** The officer changed the model's text. */
  edited?: boolean
}

export type DraftMap = Record<HouseholdId, Draft>

const emptyDraft: Draft = { text: '', attempts: [], running: false, approved: false }
const emptyDrafts = () => Object.fromEntries(HOUSEHOLDS.map((h) => [h.id, emptyDraft])) as DraftMap

type Context = {
  sheet: FactSheet | undefined
  area: string
  claimWords: string[]
  models: DraftModels | undefined
  deviceRef: { current: DeviceStatus }
  warmPromise: { current: Promise<unknown> }
}

/** The check for one household's alert. Code only, so it runs on every keystroke. */
export function checkFor(text: string, sheet: FactSheet, area: string, household: Household, claimWords: string[]): CheckResult {
  return checkDraft(text, sheet, { claimWords, area, required: household.required })
}

/**
 * Drafting for each household: runs the routing in src/drafting/route.ts,
 * streams each attempt, checks it, and keeps the officer's edits and approvals.
 */
export function useDrafts(ctx: Context) {
  const [drafts, setDrafts] = useState<DraftMap>(emptyDrafts)
  const nextId = useRef(1)
  const abandoners = useRef<Partial<Record<HouseholdId, () => void>>>({})
  const ctxRef = useRef(ctx)
  useEffect(() => {
    ctxRef.current = ctx
  })

  const update = useCallback((id: HouseholdId, change: (d: Draft) => Draft) => {
    setDrafts((all) => ({ ...all, [id]: change(all[id]) }))
  }, [])

  const patchAttempt = useCallback(
    (id: HouseholdId, attemptId: number, change: (a: Attempt) => Partial<Attempt>, text?: string) =>
      update(id, (d) => ({
        ...d,
        ...(text !== undefined ? { text } : {}),
        attempts: d.attempts.map((a) => (a.id === attemptId ? { ...a, ...change(a) } : a)),
      })),
    [update],
  )

  /** One model call, streamed into the card. Resolves early if the officer abandons it. */
  const runAttempt = useCallback(
    async (h: Household, models: DraftModels, route: Route, prompt: string, retry: boolean) => {
      const attemptId = nextId.current++
      const startedAt = Date.now()
      let live = true
      update(h.id, (d) => ({ ...d, text: '', attempts: [...d.attempts, { id: attemptId, route, retry, startedAt, text: '' }] }))

      const abandoned = new Promise<{ text: string; abandoned: true }>((resolve) => {
        abandoners.current[h.id] = () => {
          live = false
          resolve({ text: '', abandoned: true })
        }
      })
      const streamed = streamDraft(models, route, prompt, {
        onText: (text, source) => {
          if (!live) return
          patchAttempt(h.id, attemptId, (a) => ({ text, source, firstTextMs: a.firstTextMs ?? Date.now() - startedAt }), text)
        },
      }).then(
        (r) => ({ text: r.text, source: r.source }),
        (err: unknown) => ({ text: '', error: err instanceof Error ? err.message : String(err) }),
      )
      const outcome: { text: string; source?: Source; error?: string; abandoned?: true } = await Promise.race([streamed, abandoned])
      live = false
      delete abandoners.current[h.id]
      const endedMs = Date.now() - startedAt
      patchAttempt(
        h.id,
        attemptId,
        () => ({
          endedMs,
          ...(outcome.source ? { source: outcome.source } : {}),
          ...(outcome.error ? { error: outcome.error } : {}),
          ...(outcome.abandoned ? { abandoned: true } : {}),
        }),
        outcome.abandoned || outcome.error ? undefined : outcome.text,
      )
      return { attemptId, ...outcome }
    },
    [update, patchAttempt],
  )

  /** Drafts one household's alert, following the routing rules. */
  const draft = useCallback(
    async (h: Household) => {
      const { sheet, area, claimWords, models, deviceRef, warmPromise } = ctxRef.current
      if (!sheet || !models) return
      update(h.id, () => ({ ...emptyDraft, running: true }))
      await warmPromise.current.catch(() => undefined)

      const base = buildDraftPrompt(sheet, area, h)
      const outcomes: AttemptOutcome[] = []
      let last: { text: string; issues: Issue[] } | undefined
      for (;;) {
        const step = nextStep(outcomes, { online: navigator.onLine, onDeviceReady: deviceRef.current === 'available' })
        if (step.kind === 'done') break
        if (step.kind === 'manual') {
          update(h.id, (d) => ({ ...d, note: step.reason }))
          break
        }
        // After an error or an abandoned attempt there is no draft to quote, so start fresh.
        const quoted = step.retry && last && last.text.trim() !== '' ? last : undefined
        const withReasons = quoted !== undefined
        const prompt = quoted ? buildRetryPrompt(base, quoted.text, quoted.issues) : base
        const attempt = await runAttempt(h, models, step.route, prompt, withReasons)
        const ok = !attempt.error && !attempt.abandoned
        const result = ok ? checkFor(attempt.text, sheet, area, h, claimWords) : undefined
        last = ok ? { text: attempt.text, issues: result!.issues } : undefined
        const passed = result?.pass ?? false
        patchAttempt(h.id, attempt.attemptId, () => ({ passed, issueCount: result?.issues.length }))
        outcomes.push({ route: step.route, passed, ...(attempt.abandoned ? { abandoned: true } : {}) })
      }
      // Show the last real draft for hand editing, not an empty abandoned one.
      update(h.id, (d) => ({ ...d, running: false, text: d.text || last?.text || '' }))
    },
    [update, runAttempt, patchAttempt],
  )

  const draftAll = useCallback(async () => {
    for (const h of HOUSEHOLDS) await draft(h)
  }, [draft])

  return {
    drafts,
    draft,
    draftAll,
    /** Stops waiting for a slow on-device draft; the routing then tries the cloud. */
    abandon: (id: HouseholdId) => abandoners.current[id]?.(),
    edit: (id: HouseholdId, text: string) => update(id, (d) => ({ ...d, text, approved: false, edited: true })),
    setApproved: (id: HouseholdId, approved: boolean) => update(id, (d) => ({ ...d, approved })),
    /** The fact sheet or area changed: every approval is void. */
    unapproveAll: () => setDrafts((all) => Object.fromEntries(Object.entries(all).map(([k, d]) => [k, { ...d, approved: false }])) as DraftMap),
    reset: () => setDrafts(emptyDrafts),
  }
}
