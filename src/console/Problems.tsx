import type { Issue, Rule } from '../checker'
import { inReadingOrder, segments } from './segments'
import { StatusChip } from '../ui/Chip'

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

/** The checked text with each problem highlighted, then every problem in reading order, each with a chip for its check. */
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
        <ul className="mt-3 space-y-2 text-body-md">
          {inReadingOrder(issues).map((issue, i) => (
            <li key={i} className="flex items-start gap-2">
              <StatusChip tone="error">
                <span className="sr-only">Check: </span>
                {RULE_LABEL[issue.rule]}
              </StatusChip>
              <span className="min-w-0 flex-1 pt-0.5">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
