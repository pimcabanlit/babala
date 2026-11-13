import type { Issue, Rule } from '../checker'
import { inReadingOrder, segments } from './segments'

const RULE_LABEL: Record<Rule, string> = {
  figures: 'Figure',
  places: 'Place',
  missing: 'Missing',
  placeholders: 'Placeholder',
  'added-claims': 'Added claim',
  plain: 'Style',
  translation: 'Translation',
  answer: 'Answer',
}

/** The checked text with each problem highlighted, then every problem in reading order. */
export default function Problems({ text, issues }: { text: string; issues: Issue[] }) {
  return (
    <div className="mt-2">
      <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm leading-6">
        {segments(text, issues).map((s, i) =>
          s.issue ? (
            <mark key={i} title={s.issue.message} className="rounded bg-red-200 px-0.5 text-red-950">
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-red-800">
          {inReadingOrder(issues).map((issue, i) => (
            <li key={i}>
              <span className="font-semibold">{RULE_LABEL[issue.rule]}:</span> {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
