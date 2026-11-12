/**
 * The fact sheet as the officer edits it: one text box per fact, lists one
 * item per line. Converting back reports anything the drafts can't use.
 */
import { normalizeDate, normalizeTime } from '../checker'
import type { FactSheet } from '../checker'

export type FactSheetForm = {
  stormName: string
  /** One "Area: signal" per line, e.g. "Purok Ilaya: 3". */
  signals: string
  /** Any time spelling: "6:00 PM", "18:00". */
  landfallTime: string
  landfallDate: string
  evacuationCentres: string
  puroks: string
  barangays: string
  hotline: string
  /** Comma-separated, e.g. "185, 2". */
  otherFigures: string
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function toForm(sheet: FactSheet): FactSheetForm {
  return {
    stormName: sheet.stormName,
    signals: sheet.signals.map((s) => `${s.area}: ${s.signal}`).join('\n'),
    landfallTime: sheet.landfallTime ? to12h(sheet.landfallTime) : '',
    landfallDate: sheet.landfallDate ?? '',
    evacuationCentres: sheet.evacuationCentres.join('\n'),
    puroks: sheet.puroks.join('\n'),
    barangays: sheet.barangays.join('\n'),
    hotline: sheet.hotline,
    otherFigures: (sheet.otherFigures ?? []).join(', '),
  }
}

export type FormResult = { ok: true; sheet: FactSheet } | { ok: false; problems: string[] }

/** The fact sheet from the form, or what must be fixed before drafting. */
export function fromForm(form: FactSheetForm, bulletinText: string): FormResult {
  const problems: string[] = []

  const signals: FactSheet['signals'] = []
  for (const line of lines(form.signals)) {
    const m = line.match(/^(.+?)\s*:\s*(\d{1,2})$/)
    if (m) signals.push({ area: m[1].trim(), signal: Number(m[2]) })
    else problems.push(`Signal line “${line}” should look like “Purok 1: 3”.`)
  }
  if (lines(form.signals).length === 0) problems.push('Add at least one signal, like “Purok 1: 3”.')

  const landfallTime = normalizeTime(form.landfallTime.trim()) ?? ''
  if (!landfallTime) problems.push('Landfall time should look like “6:00 PM” or “18:00”.')

  const landfallDate = form.landfallDate.trim()
  if (landfallDate && !normalizeDate(landfallDate)) problems.push('Landfall date should look like “Nov 14”, or be left empty.')

  const evacuationCentres = lines(form.evacuationCentres)
  if (evacuationCentres.length === 0) problems.push('Add at least one evacuation centre.')

  const otherFigures: number[] = []
  for (const part of form.otherFigures.split(',').map((p) => p.trim()).filter(Boolean)) {
    const n = Number(part)
    if (Number.isFinite(n)) otherFigures.push(n)
    else problems.push(`“${part}” in other figures is not a number.`)
  }

  if (problems.length > 0) return { ok: false, problems }
  return {
    ok: true,
    sheet: {
      stormName: form.stormName.trim(),
      signals,
      landfallTime,
      ...(landfallDate ? { landfallDate } : {}),
      evacuationCentres,
      puroks: lines(form.puroks),
      barangays: lines(form.barangays),
      hotline: form.hotline.trim(),
      otherFigures,
      bulletinText,
    },
  }
}

/** "18:00" → "6:00 PM". */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
