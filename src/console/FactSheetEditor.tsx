import type { FactSheetForm } from '../factsheet/form'

const FIELDS: { key: keyof FactSheetForm; label: string; hint?: string; rows?: number }[] = [
  { key: 'stormName', label: 'Storm name' },
  { key: 'signals', label: 'Signals', hint: 'One per line: “Purok 1: 3”', rows: 3 },
  { key: 'landfallTime', label: 'Landfall time' },
  { key: 'landfallDate', label: 'Landfall date', hint: 'Optional' },
  { key: 'evacuationCentres', label: 'Evacuation centres', hint: 'One per line', rows: 2 },
  { key: 'puroks', label: 'Puroks', hint: 'One per line', rows: 3 },
  { key: 'barangays', label: 'Barangays', hint: 'One per line', rows: 1 },
  { key: 'hotline', label: 'Hotline', hint: 'Optional' },
  { key: 'otherFigures', label: 'Other figures', hint: 'Numbers drafts may use, e.g. “185, 2”' },
]

/** Every fact the parser found, editable, so the officer stays in charge. */
export default function FactSheetEditor(props: { form: FactSheetForm; onChange: (form: FactSheetForm) => void; disabled: boolean }) {
  const { form, onChange, disabled } = props
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {FIELDS.map(({ key, label, hint, rows }) => (
        <label key={key} className={`block text-sm font-medium ${rows ? 'sm:col-span-2' : ''}`}>
          {label}
          {hint && <span className="ml-1 font-normal text-slate-500">({hint})</span>}
          {rows ? (
            <textarea
              value={form[key]}
              onChange={(e) => onChange({ ...form, [key]: e.target.value })}
              rows={rows}
              disabled={disabled}
              className="mt-1 w-full rounded border border-slate-300 p-2 font-normal"
            />
          ) : (
            <input
              value={form[key]}
              onChange={(e) => onChange({ ...form, [key]: e.target.value })}
              disabled={disabled}
              className="mt-1 w-full rounded border border-slate-300 p-2 font-normal"
            />
          )}
        </label>
      ))}
    </div>
  )
}
