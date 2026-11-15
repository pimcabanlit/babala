import type { FactSheetForm } from '../factsheet/form'

const FIELDS: { key: keyof FactSheetForm; label: string; hint?: string; rows?: number }[] = [
  { key: 'stormName', label: 'Storm name' },
  { key: 'landfallTime', label: 'Landfall time' },
  { key: 'signals', label: 'Signals', hint: 'One per line: “Purok 1: 3”', rows: 3 },
  { key: 'landfallDate', label: 'Landfall date', hint: 'Optional' },
  { key: 'evacuationCentres', label: 'Evacuation centres', hint: 'One per line', rows: 2 },
  { key: 'hotline', label: 'Hotline', hint: 'Optional' },
  { key: 'puroks', label: 'Puroks', hint: 'One per line', rows: 3 },
  { key: 'barangays', label: 'Barangays', hint: 'One per line', rows: 1 },
  { key: 'otherFigures', label: 'Other figures', hint: 'Numbers drafts may use, e.g. “185, 2”' },
]

/**
 * Every fact the parser found, as a two-column list, so the officer can check
 * them against the bulletin at a glance. The open fields are text boxes in
 * the same places: the facts the bulletin didn't give, or every fact once the
 * officer chooses "Edit facts", so the officer stays in charge.
 */
export default function FactSheetEditor(props: {
  form: FactSheetForm
  onChange: (form: FactSheetForm) => void
  /** The fields shown as text boxes; the rest read as plain text. */
  open: 'all' | readonly (keyof FactSheetForm)[]
  disabled: boolean
}) {
  const { form, onChange, open, disabled } = props
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {FIELDS.map(({ key, label, hint, rows }) => {
        const editing = open === 'all' || open.includes(key)
        const id = `fact-${key}`
        const value = form[key]
        return (
          <div key={key} className="min-w-0">
            <dt className="text-body-md text-on-surface-variant">
              {editing ? (
                <label htmlFor={id} className="font-medium text-on-surface">
                  {label}
                  {hint && <span className="ml-1 font-normal text-on-surface-variant">({hint})</span>}
                </label>
              ) : (
                label
              )}
            </dt>
            <dd className="mt-0.5">
              {!editing ? (
                <ReadValue value={value} oneLine={key !== 'signals'} />
              ) : rows ? (
                <textarea
                  id={id}
                  value={value}
                  onChange={(e) => onChange({ ...form, [key]: e.target.value })}
                  rows={rows}
                  disabled={disabled}
                  className="field mt-0.5"
                />
              ) : (
                <input
                  id={id}
                  value={value}
                  onChange={(e) => onChange({ ...form, [key]: e.target.value })}
                  disabled={disabled}
                  className="field mt-0.5"
                />
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/**
 * A fact as plain text, or a note that the bulletin left it out. Lists run on
 * one line, so the whole sheet fits a laptop screen; signals keep a line each.
 */
function ReadValue({ value, oneLine }: { value: string; oneLine: boolean }) {
  const lines = value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return <span className="text-body-lg text-on-surface-variant">None</span>
  if (oneLine) return <span className="block text-body-lg break-words">{lines.join(' · ')}</span>
  return (
    <span className="block text-body-lg break-words">
      {lines.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </span>
  )
}
