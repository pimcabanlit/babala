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
      <p className="whitespace-pre-wrap rounded-sm bg-surface-container-low p-3 text-body-md leading-6">
        {segments(text, issues).map((s, i) =>
          s.issue ? (
            <mark key={i} title={s.issue.message} className="rounded-xs bg-error-highlight px-0.5 text-on-error-container underline decoration-error decoration-wavy underline-offset-4">
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-body-md text-on-error-container">
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
