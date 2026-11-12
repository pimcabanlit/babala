/**
 * A plain-text log of every draft attempt, for the officer to copy into a bug
 * report or the PR: prompts, answers, timings and the checker's problems.
 * The real on-device outputs in it become checker and prompt test cases.
 * Holds no secrets: only the fact sheet, prompts and model answers.
 */
import type { Household } from '../drafting/households'
import { inReadingOrder } from './segments'
import type { Draft } from './useDrafts'

export type LogContext = {
  area: string
  cloudModel: string
  device: string
  warmUp: string
}

export function attemptLog(households: Household[], drafts: Record<string, Draft>, ctx: LogContext, at = new Date()): string {
  const lines = [
    `Babala test log · ${at.toISOString()}`,
    `Area: ${ctx.area} · cloud model: ${ctx.cloudModel} · on-device: ${ctx.device} · ${ctx.warmUp}`,
  ]
  for (const h of households) {
    const draft = drafts[h.id]
    if (!draft || draft.attempts.length === 0) continue
    lines.push('', `== ${h.label} ==`)
    draft.attempts.forEach((a, i) => {
      const source = a.source ?? 'unknown source'
      const time = a.endedMs === undefined ? 'running' : `${(a.endedMs / 1000).toFixed(1)} s`
      const outcome = a.abandoned ? 'stopped waiting' : a.error ? `error: ${a.error}` : a.passed ? 'passed' : 'failed'
      lines.push(
        '',
        `${i + 1}. ${a.route} → ${source} · ${a.retry ? 'retry' : 'draft'} · ${time} · ${outcome}`,
        'Prompt:',
        a.prompt,
        'Answer:',
        a.text || '(none)',
      )
      // The model's JSON, when it differs from the joined alert.
      if (a.raw !== undefined && a.raw.trim() !== a.text) lines.push('Raw answer:', a.raw.trim())
      if (a.issues?.length) lines.push('Problems:', ...inReadingOrder(a.issues).map((issue) => `- ${issue.message}`))
    })
    if (draft.edited) lines.push('', 'Then edited by hand.')
  }
  return lines.join('\n')
}
