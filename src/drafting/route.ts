/**
 * What to do after each draft attempt (docs/architecture.md, "Routing"): on-device
 * first, one retry on the device with the checker's reasons, then the cloud
 * when online, otherwise the officer edits by hand. At most three AI calls
 * per alert, so a failing model can't loop.
 */
import type { Route } from '../ai'

export type AttemptOutcome = {
  route: Route
  passed: boolean
  /** The officer moved on to the cloud after the on-device budget. */
  abandoned?: boolean
}

export type NextStep =
  | { kind: 'draft'; route: Route; retry: boolean }
  | { kind: 'manual'; reason: string }
  | { kind: 'done' }

export const MAX_AI_CALLS = 3

export function nextStep(attempts: AttemptOutcome[], ctx: { online: boolean; onDeviceReady: boolean }): NextStep {
  const last = attempts.at(-1)
  if (last?.passed) return { kind: 'done' }
  const canDraft = ctx.onDeviceReady || ctx.online

  if (!last)
    return canDraft
      ? { kind: 'draft', route: 'prefer_on_device', retry: false }
      : { kind: 'manual', reason: 'No on-device model and no connection: write the alert by hand.' }

  if (attempts.length >= MAX_AI_CALLS)
    return { kind: 'manual', reason: 'The models could not write a passing alert: fix the highlighted words by hand.' }

  const triedCloud = attempts.some((a) => a.route === 'only_in_cloud')

  // One retry on the device, unless the officer already moved on to the cloud.
  if (attempts.length === 1 && last.route === 'prefer_on_device' && !last.abandoned && canDraft)
    return { kind: 'draft', route: 'prefer_on_device', retry: true }

  if (!triedCloud && ctx.online) return { kind: 'draft', route: 'only_in_cloud', retry: true }

  return {
    kind: 'manual',
    reason: ctx.online
      ? 'The models could not write a passing alert: fix the highlighted words by hand.'
      : 'Offline, so the cloud can’t help: fix the highlighted words by hand.',
  }
}
