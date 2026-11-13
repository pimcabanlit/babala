import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { askOnce, createAskModels, warmUpAsk, type AskModels } from '../ai'
import { readDeviceStatus, type DeviceStatus } from '../ai/deviceStatus'
import { ASK_SCHEMA } from '../ask/prompt'
import { cloudAllowance, cloudCallsFromJson, looksLocal, planAsk, recentCloudCalls, type AiRoute, type AskPlan } from '../ask/route'
import { answerQuestion, type AskDeps, type AskInput, type AskOutcome, type CheckWords } from '../ask/run'
import { searchAlert } from '../ask/search'
import type { FirebaseServices } from '../firebase'
import { DEFAULT_TUNABLES, loadTunables, type Tunables } from '../firebase/remoteConfig'
import type { Language } from './pack'
import { readStorage, writeStorage } from './useResidentPack'

const CLOUD_CALLS_KEY = 'babala.ask.v1'
/** A cloud answer takes 1 to 5 s; past this the phone stops waiting and uses the text search. */
const CLOUD_TIMEOUT_MS = 20_000

/**
 * What the resident view needs to answer questions, set up once for the page:
 * the tunables (cloud model, budget, claim words, the hourly limit), the two
 * ask models, and Chrome's on-device status. Until Remote Config answers, the
 * defaults apply; offline it keeps the last fetched values.
 */
export function useAskSetup(fb: FirebaseServices) {
  const [tunables, setTunables] = useState<Tunables>(DEFAULT_TUNABLES)
  const [device, setDevice] = useState<DeviceStatus>('unknown')
  const warmed = useRef(false)

  useEffect(() => {
    if (!fb.ok) return
    let current = true
    loadTunables(fb.app).then(
      (t) => {
        if (current) setTunables(t)
      },
      (err: unknown) => {
        // loadTunables already falls back on a failed fetch; this is Remote Config itself failing to start.
        console.warn('Remote Config unavailable on this phone; using the defaults.', err)
      },
    )
    void readDeviceStatus().then((status) => {
      if (current) setDevice(status)
    })
    return () => {
      current = false
    }
  }, [fb])

  const models = useMemo<AskModels | undefined>(
    () => (fb.ok ? createAskModels(fb.app, tunables.cloudModelName, ASK_SCHEMA) : undefined),
    [fb, tunables.cloudModelName],
  )

  /** Loads Nano when the resident starts typing, so the first answer doesn't wait 30 s. Never downloads it. */
  const warmUp = useCallback(() => {
    if (!models || device !== 'available' || warmed.current) return
    warmed.current = true
    warmUpAsk(models).catch((err: unknown) => {
      // The question's own on-device call reports any real problem, and falls back to the cloud or the search.
      console.warn('On-device warm-up failed.', err)
    })
  }, [models, device])

  return { configured: fb.ok, tunables, models, deviceReady: device === 'available', warmUp }
}

export type AskSetup = ReturnType<typeof useAskSetup>

export type AskState =
  | { kind: 'idle' }
  | { kind: 'running'; question: string; route: AiRoute | 'search'; startedAt: number }
  | { kind: 'done'; question: string; outcome: AskOutcome }

/** This phone's cloud calls in the last hour, as saved on the phone. */
function savedCloudCalls(now: number): number[] {
  return recentCloudCalls(cloudCallsFromJson(readStorage(CLOUD_CALLS_KEY)), now)
}

/**
 * One alert's question box: plans the routes for each question, runs them,
 * and keeps the outcome. The resident view keys it by alert and language, so
 * a new alert or language starts with an empty box.
 */
export function useAsk(setup: AskSetup, online: boolean) {
  const [state, setState] = useState<AskState>({ kind: 'idle' })
  /** One question at a time, even for two taps before the button turns off. */
  const busy = useRef(false)

  /** When the hourly allowance was last read: after each answer, and when a used-up hour frees a call. */
  const [now, setNow] = useState(() => Date.now())
  const allowance = cloudAllowance(savedCloudCalls(now), now, setup.tunables.askCloudPerHour)
  const backAt = allowance.nextAtMs
  useEffect(() => {
    if (backAt === undefined) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, backAt - Date.now()) + 1000)
    return () => clearTimeout(timer)
  }, [backAt])

  const planFor = useCallback(
    (question: string, language: Language): AskPlan =>
      planAsk({
        language,
        localQuestion: looksLocal(question),
        deviceReady: setup.deviceReady,
        configured: setup.configured,
        online,
        cloudLeft: cloudAllowance(savedCloudCalls(Date.now()), Date.now(), setup.tunables.askCloudPerHour).left,
      }),
    [setup.deviceReady, setup.configured, setup.tunables.askCloudPerHour, online],
  )

  const ask = useCallback(
    async (input: AskInput) => {
      if (busy.current) return
      busy.current = true
      const { models, tunables } = setup
      const plan = planFor(input.question, input.language)
      setState({ kind: 'running', question: input.question, route: plan.tries[0] ?? 'search', startedAt: Date.now() })
      const words: CheckWords = {
        claimWords: tunables.checkerClaimWords,
        answerClaims: tunables.answerClaims,
        translatedClaims: [...tunables.translationClaims.fil, ...tunables.translationClaims.ceb],
      }
      const deps: AskDeps = {
        call: (route, prompt) => {
          if (!models) return Promise.reject(new Error('This copy of the app has no AI settings.'))
          return askOnce(models, route, prompt, route === 'cloud' ? AbortSignal.timeout(CLOUD_TIMEOUT_MS) : undefined)
        },
        onDeviceBudgetMs: tunables.ondeviceBudgetSeconds * 1000,
        onRoute: (route) => setState((s) => (s.kind === 'running' ? { ...s, route, startedAt: Date.now() } : s)),
        onCloudCall: () => {
          const at = Date.now()
          // A failed save only means this phone's limit forgets the call; the answer still comes.
          writeStorage(CLOUD_CALLS_KEY, JSON.stringify([...savedCloudCalls(at), at]))
        },
      }
      let outcome: AskOutcome
      try {
        outcome = await answerQuestion(input, plan, words, deps)
      } catch (err) {
        // A bug, not a model failure: the resident still gets the search, and the reason.
        outcome = {
          kind: 'search',
          result: searchAlert(input.alert.shown, input.question),
          tries: [],
          reason: `Something went wrong while answering: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
      busy.current = false
      setNow(Date.now())
      setState({ kind: 'done', question: input.question, outcome })
    },
    [setup, planFor],
  )

  return { state, ask, planFor, cloudLeft: allowance.left, cloudBackAtMs: allowance.nextAtMs }
}
