import type { Unconfirmed } from '../factsheet/cloud'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Notice from '../ui/Notice'
import Progress from '../ui/Progress'
import { readingLine, type CloudReadStatus, type ReadBy } from './create'

/**
 * Above the fact sheet: who read the facts (plain code, or the cloud with code
 * confirming each one), "Read in the cloud" for a free-form bulletin, and
 * what the officer must fill in: facts not found, and facts the cloud gave
 * that code couldn't find in the bulletin's own words.
 */
export default function BulletinReading(props: {
  by: ReadBy
  status: CloudReadStatus
  now: number
  /** Why "Read in the cloud" is off, if it is. */
  block: string | undefined
  notFound: string[]
  unconfirmed: Unconfirmed[]
  onRead: () => void
}) {
  const { by, status, now, block, notFound, unconfirmed, onRead } = props
  const reading = status.state === 'reading'
  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="rounded-md bg-surface-container-low px-4 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* The line takes the row and the button wraps under it on a phone, instead of squeezing the line. */}
          <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
            <Icon
              name={reading ? 'progress_activity' : by === 'cloud' ? 'cloud' : 'computer'}
              className={`size-5 shrink-0 text-on-surface-variant ${reading ? 'animate-spin' : ''}`}
            />
            <p className="min-w-0 text-body-md">{readingLine(by, status, now)}</p>
          </div>
          <Button variant="tonal" size="sm" onClick={onRead} disabled={block !== undefined || reading}>
            <Icon name="cloud" className="size-[18px]" />
            {by === 'cloud' ? 'Read in the cloud again' : 'Read in the cloud'}
          </Button>
        </div>
        {reading && <Progress label="Reading the bulletin in the cloud" className="mt-2" />}
        {block && !reading && <p className="mt-1 text-body-sm text-on-surface-variant">{block}</p>}
      </div>

      {status.state === 'failed' && (
        <Notice tone="error" role="alert">
          {status.error}
        </Notice>
      )}

      {unconfirmed.length > 0 && (
        <Notice tone="warning">
          <p>Left out, because code couldn’t find them in the bulletin’s own words. Fill them in from the bulletin:</p>
          <ul className="mt-1 list-disc pl-4">
            {unconfirmed.map((u, i) => (
              <li key={i}>{u.message}</li>
            ))}
          </ul>
        </Notice>
      )}

      {notFound.length > 0 && (
        <Notice tone="warning">
          {by === 'cloud'
            ? `The cloud found no ${notFound.join(', ')} in the bulletin. Fill these in if the bulletin has them.`
            : `Not found in the bulletin: ${notFound.join(', ')}. Fill these in if the bulletin has them, or read it in the cloud.`}
        </Notice>
      )}
    </div>
  )
}
