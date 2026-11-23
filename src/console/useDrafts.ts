import { useCallback, useEffect, useRef, useState } from 'react'
import { streamDraft, type DraftModels, type Route, type Source } from '../ai'
import type { FactSheet, Issue } from '../checker'
import type { DeviceStatus } from '../ai/deviceStatus'
import { checkFor } from '../drafting/check'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import { buildDraftPrompt, buildRetryPrompt } from '../drafting/prompt'
import { previewFromPartialJson, readAnswer } from '../drafting/structured'
import { nextStep } from '../drafting/route'
import { runRound, whenAborted } from '../drafting/round'

export type Attempt = {
  /** Unique in the console, and increasing: a later attempt has a higher id. */
  id: number
  route: Route
  /** The area it was drafted for. */
  area: string
  /** The prompt was the last draft with an edit per problem. */
  retry: boolean
  /** The exact prompt, for the test log. */
  prompt: string
  startedAt: number
  firstTextMs?: number
  endedMs?: number
  /** The alert: the answer's fields joined into sentences. */
  text: string
  /** The model's answer as it came, JSON included, for the test log. */
  raw?: string
  source?: Source
  passed?: boolean
  /** The checker's problems with this attempt's text. */
  issues?: Issue[]
  error?: string
  /** The officer moved on to the cloud after the on-device budget. */
  abandoned?: boolean
  /** The officer cancelled the round while this attempt ran. */
  cancelled?: boolean
}

export type Draft = {
  /** The alert text: streamed by a model, then editable by the officer. */
  text: string
  attempts: Attempt[]
  running: boolean
  /** Why drafting stopped without a passing alert. */
  note?: string
  /** The officer cancelled this round. */
  cancelled?: boolean
  approved: boolean
  /** The officer changed the model's text. */
  edited?: boolean
  /** The attempts of earlier rounds on this card ("Draft again"), oldest first. */
  history: Attempt[][]
  /** The highest attempt id already in a ledger entry; 0 before the first approval. */
  recordedThrough: number
}

export type DraftMap = Record<HouseholdId, Draft>

const emptyDraft: Draft = { text: '', attempts: [], running: false, approved: false, history: [], recordedThrough: 0 }
const emptyDrafts = () => Object.fromEntries(HOUSEHOLDS.map((h) => [h.id, emptyDraft])) as DraftMap

type Context = {
  sheet: FactSheet | undefined
  area: string
  claimWords: string[]
  models: DraftModels | undefined
  deviceRef: { current: DeviceStatus }
  warmPromise: { current: Promise<unknown> }
}

/**
 * Drafting for each household: runs the routing in src/drafting/route.ts,
 * streams each attempt, checks it, and keeps the officer's edits and approvals.
 */
export function useDrafts(ctx: Context) {
  const [drafts, setDrafts] = useState<DraftMap>(emptyDrafts)
  const nextId = useRef(1)
  const abandoners = useRef<Partial<Record<HouseholdId, () => void>>>({})
  /** Cancels the round in progress for each household: aborts its signal. */
  const cancellers = useRef<Partial<Record<HouseholdId, AbortController>>>({})
  /** "Draft all four" is running, so a cancel also stops the households after this one. */
  const [batch, setBatch] = useState(false)
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

  /**
   * One model call, streamed into the card. Resolves early if the officer
   * abandons it for the cloud or cancels the round. A cancel aborts a cloud
   * call; the SDK can't stop an on-device one, so its answer is ignored.
   */
  const runAttempt = useCallback(
    async (h: Household, models: DraftModels, route: Route, prompt: string, retry: boolean, area: string, signal: AbortSignal) => {
      const attemptId = nextId.current++
      const startedAt = Date.now()
      let live = true
      update(h.id, (d) => ({ ...d, text: '', attempts: [...d.attempts, { id: attemptId, route, area, retry, prompt, startedAt, text: '' }] }))

      const abandoned = new Promise<{ text: string; abandoned: true }>((resolve) => {
        abandoners.current[h.id] = () => {
          live = false
          resolve({ text: '', abandoned: true })
        }
      })
      const cancelled = whenAborted(signal).then(() => ({ text: '', cancelled: true as const }))
      const streamed = streamDraft(
        models,
        route,
        prompt,
        {
          onText: (raw, source) => {
            if (!live) return
            // The answer streams in as JSON; the officer watches the sentences.
            const text = raw.trimStart().startsWith('{') ? previewFromPartialJson(raw) : raw
            patchAttempt(h.id, attemptId, (a) => ({ text, source, firstTextMs: a.firstTextMs ?? Date.now() - startedAt }), text)
          },
        },
        signal,
      ).then(
        // readAnswer also trims: Nano leaves blank lines at the end.
        (r) => ({ text: readAnswer(r.text), raw: r.text, source: r.source }),
        // The SDK rejects an aborted cloud call; that is the officer's cancel, not an error.
        (err: unknown) =>
          signal.aborted ? { text: '', cancelled: true as const } : { text: '', error: err instanceof Error ? err.message : String(err) },
      )
      const outcome: { text: string; raw?: string; source?: Source; error?: string; abandoned?: true; cancelled?: true } = await Promise.race([
        streamed,
        abandoned,
        cancelled,
      ])
      live = false
      delete abandoners.current[h.id]
      const endedMs = Date.now() - startedAt
      const stopped = outcome.abandoned || outcome.cancelled
      patchAttempt(
        h.id,
        attemptId,
        () => ({
          endedMs,
          ...(outcome.source ? { source: outcome.source } : {}),
          ...(outcome.error ? { error: outcome.error } : {}),
          ...(outcome.abandoned ? { abandoned: true } : {}),
          ...(outcome.cancelled ? { cancelled: true } : {}),
          // A stopped attempt keeps the words it had streamed, for the history and the ledger.
          ...(stopped || outcome.error ? {} : { text: outcome.text, raw: outcome.raw }),
        }),
        stopped || outcome.error ? undefined : outcome.text,
      )
      return { attemptId, ...outcome }
    },
    [update, patchAttempt],
  )

  /** Drafts one household's alert, following the routing rules. Says whether the officer cancelled it. */
  const draft = useCallback(
    async (h: Household): Promise<{ cancelled: boolean }> => {
      const { sheet, area, claimWords, models, deviceRef, warmPromise } = ctxRef.current
      if (!sheet || !models) return { cancelled: false }
      const controller = new AbortController()
      cancellers.current[h.id] = controller
      // A new round: the last one moves to the history, which the ledger entry keeps.
      update(h.id, (d) => ({
        ...emptyDraft,
        running: true,
        history: d.attempts.length > 0 ? [...d.history, d.attempts] : d.history,
        recordedThrough: d.recordedThrough,
      }))
      const end = await runRound({
        warmUp: () => warmPromise.current,
        next: (outcomes) => nextStep(outcomes, { online: navigator.onLine, onDeviceReady: deviceRef.current === 'available' }),
        prompt: () => buildDraftPrompt(sheet, area, h),
        retryPrompt: (text, issues) => buildRetryPrompt(text, issues, sheet, area, h),
        attempt: (route, prompt, retry) => runAttempt(h, models, route, prompt, retry, area, controller.signal),
        check: (text) => checkFor(text, sheet, area, h, claimWords),
        onChecked: (attemptId, passed, issues) => patchAttempt(h.id, attemptId, () => ({ passed, ...(issues ? { issues } : {}) })),
        onManual: (reason) => update(h.id, (d) => ({ ...d, note: reason })),
        signal: controller.signal,
      })
      if (cancellers.current[h.id] === controller) delete cancellers.current[h.id]
      // Show the last real draft for hand editing, not the empty text of an abandoned, failed or cancelled call.
      update(h.id, (d) =>
        end.cancelled
          ? { ...d, running: false, cancelled: true, text: end.lastDrafted }
          : { ...d, running: false, text: d.text || end.lastDrafted },
      )
      return end
    },
    [update, runAttempt, patchAttempt],
  )

  const draftAll = useCallback(async () => {
    setBatch(true)
    try {
      for (const h of HOUSEHOLDS) if ((await draft(h)).cancelled) break
    } finally {
      setBatch(false)
    }
  }, [draft])

  return {
    drafts,
    draft,
    draftAll,
    /** "Draft all four" is running. */
    batch,
    /** Stops this household's round, and with it the rest of "Draft all four". */
    cancel: (id: HouseholdId) => cancellers.current[id]?.abort(),
    /** Stops waiting for a slow on-device draft; the routing then tries the cloud. */
    abandon: (id: HouseholdId) => abandoners.current[id]?.(),
    edit: (id: HouseholdId, text: string) => update(id, (d) => ({ ...d, text, approved: false, edited: true, cancelled: false })),
    setApproved: (id: HouseholdId, approved: boolean) => update(id, (d) => ({ ...d, approved })),
    /** Marks the attempts up to this id as kept in a ledger entry, or undoes that when a save fails. */
    setRecordedThrough: (id: HouseholdId, through: number) => update(id, (d) => ({ ...d, recordedThrough: through })),
    /** The fact sheet or area changed: every approval is void. */
    unapproveAll: () => setDrafts((all) => Object.fromEntries(Object.entries(all).map(([k, d]) => [k, { ...d, approved: false }])) as DraftMap),
    reset: () => setDrafts(emptyDrafts),
  }
}
