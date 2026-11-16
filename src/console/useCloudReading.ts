import { useCallback, useRef, useState } from 'react'
import { readBulletinOnce, type ReadingModel } from '../ai'
import { confirmReading, readingPrompt, readReadingAnswer, type CloudReading } from '../factsheet/cloud'
import { CLOUD_READ_TIMEOUT_MS, cloudReadError, type CloudReadStatus } from './create'
import type { ReadingLog } from './log'

/**
 * Reads a bulletin in the cloud: one call per click, then code keeps only the
 * facts it finds in the bulletin's own words (src/factsheet/cloud.ts). The
 * console puts the result in the fact sheet, where the officer confirms
 * every fact. Nothing here retries a call by itself.
 */
export function useCloudReading({ model, cloudModel }: { model: ReadingModel | undefined; cloudModel: string }) {
  const [status, setStatus] = useState<CloudReadStatus>({ state: 'idle' })
  const [log, setLog] = useState<ReadingLog>()
  const running = useRef(false)

  const read = useCallback(
    async (bulletin: string): Promise<CloudReading | undefined> => {
      if (!model || running.current) return undefined
      running.current = true
      const prompt = readingPrompt(bulletin)
      const startedAt = Date.now()
      const seconds = () => (Date.now() - startedAt) / 1000
      setStatus({ state: 'reading', startedAt })
      try {
        const answer = await readBulletinOnce(model, prompt, AbortSignal.timeout(CLOUD_READ_TIMEOUT_MS))
        const fields = readReadingAnswer(answer.text)
        const base = { cloudModel, source: answer.source, seconds: seconds(), prompt, raw: answer.text }
        if (!fields) {
          setStatus({
            state: 'failed',
            error: 'The cloud’s answer wasn’t in the expected form, so no fact was taken from it. Try again, or fill the facts in by hand.',
          })
          setLog({ ...base, outcome: 'unreadable answer' })
          return undefined
        }
        const reading = confirmReading(fields, bulletin)
        setStatus({ state: 'read', seconds: base.seconds, cloudModel })
        setLog({
          ...base,
          outcome: `${reading.unconfirmed.length} left out by code, not found: ${reading.notFound.join(', ') || 'none'}${reading.unconfirmed.map((u) => `\n- ${u.message}`).join('')}`,
        })
        return reading
      } catch (err) {
        const error = cloudReadError(err)
        setStatus({ state: 'failed', error })
        setLog({ cloudModel, source: undefined, seconds: seconds(), prompt, raw: '', outcome: `error: ${err instanceof Error ? err.message : String(err)}` })
        return undefined
      } finally {
        running.current = false
      }
    },
    [model, cloudModel],
  )

  /** Forgets the last reading's state, when the bulletin is read again by code. The test log keeps it. */
  const reset = useCallback(() => setStatus({ state: 'idle' }), [])

  return { status, log, read, reset }
}
