import { useEffect, useRef, useState } from 'react'
import {
  InferenceSource,
  createDraftModels,
  prepareOnDeviceModel,
  streamDraft,
  type DraftModels,
  type Route,
  type Source,
} from '../ai'
import { canPrepare, describeDeviceStatus, readDeviceStatus, type DeviceStatus } from '../ai/deviceStatus'
import { getFirebase } from '../firebase'
import { loadTunables, type Tunables } from '../firebase/remoteConfig'

/** The prompt from Pim's first laptop test (build plan, setup status). */
const DEFAULT_PROMPT =
  'Write a 3-sentence typhoon alert for residents of a coastal village: Signal No. 3, landfall expected 6 PM, evacuate to the school gym.'

type Run = {
  id: number
  route: Route
  startedAt: number
  firstTextMs?: number
  endedMs?: number
  text: string
  source?: Source
  error?: string
  /** The officer moved on to the cloud after the budget; this run is ignored. */
  abandoned?: boolean
}

const firebase = getFirebase()

/** Day-1 "hello hybrid" check: one draft on the device or in the cloud, timed. */
export default function HybridTest() {
  const [tunables, setTunables] = useState<Tunables>()
  const [models, setModels] = useState<DraftModels>()
  const [device, setDevice] = useState<DeviceStatus>('unknown')
  const [download, setDownload] = useState<number>()
  const [online, setOnline] = useState(navigator.onLine)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [runs, setRuns] = useState<Run[]>([])
  const [now, setNow] = useState(() => Date.now())
  const nextId = useRef(1)

  useEffect(() => {
    if (!firebase.ok) return
    loadTunables(firebase.app).then((t) => {
      setTunables(t)
      setModels(createDraftModels(firebase.app, t.cloudModelName))
    })
    readDeviceStatus().then(setDevice)
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const running = runs.some((r) => r.endedMs === undefined && !r.abandoned)
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [running])

  if (!firebase.ok) return null
  if (!tunables || !models) return <Card><p className="text-sm text-slate-500">Loading models…</p></Card>

  const patch = (id: number, change: Partial<Run>) =>
    setRuns((all) => all.map((r) => (r.id === id ? { ...r, ...change } : r)))

  async function start(route: Route) {
    if (!models) return
    const id = nextId.current++
    const startedAt = Date.now()
    setNow(startedAt)
    setRuns((all) => [{ id, route, startedAt, text: '' }, ...all])
    try {
      const result = await streamDraft(models, route, prompt, {
        onText: (text, source) =>
          setRuns((all) =>
            all.map((r) =>
              r.id === id
                ? { ...r, text, source, firstTextMs: r.firstTextMs ?? Date.now() - startedAt }
                : r,
            ),
          ),
      })
      patch(id, { text: result.text, source: result.source, endedMs: Date.now() - startedAt })
    } catch (err) {
      patch(id, { error: err instanceof Error ? err.message : String(err), endedMs: Date.now() - startedAt })
    }
    readDeviceStatus().then(setDevice)
  }

  function moveToCloud(run: Run) {
    patch(run.id, { abandoned: true })
    void start('only_in_cloud')
  }

  async function prepare() {
    if (!models) return
    setDownload(0)
    try {
      await prepareOnDeviceModel(models, setDownload)
    } finally {
      setDownload(undefined)
      readDeviceStatus().then(setDevice)
    }
  }

  const latest = runs[0]
  const budgetMs = tunables.ondeviceBudgetSeconds * 1000

  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Hello hybrid</h2>

      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-medium">On-device model</dt>
        <dd className="text-slate-700">
          {describeDeviceStatus(device)}
          {canPrepare(device) && (
            <button
              type="button"
              onClick={prepare}
              disabled={download !== undefined}
              className="ml-3 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
            >
              {download === undefined ? 'Prepare on-device model' : `Downloading ${Math.round(download * 100)}%`}
            </button>
          )}
        </dd>
        <dt className="font-medium">Network</dt>
        <dd className="text-slate-700">{online ? 'Online' : 'Offline: only the on-device model can answer'}</dd>
        <dt className="font-medium">Cloud model</dt>
        <dd className="text-slate-700">{tunables.cloudModelName}</dd>
        <dt className="font-medium">On-device budget</dt>
        <dd className="text-slate-700">{tunables.ondeviceBudgetSeconds} s</dd>
      </dl>

      <label className="mt-4 block text-sm font-medium" htmlFor="prompt">
        Prompt
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void start('prefer_on_device')}
          disabled={running || prompt.trim() === ''}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Draft (prefer on-device)
        </button>
        <button
          type="button"
          onClick={() => void start('only_in_cloud')}
          disabled={running || prompt.trim() === ''}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          Draft (cloud only)
        </button>
      </div>

      {latest && <RunView run={latest} now={now} budgetMs={budgetMs} cloudModel={tunables.cloudModelName} onMoveToCloud={moveToCloud} />}

      {runs.length > 0 && <RunLog runs={runs} />}
    </Card>
  )
}

function RunView(props: { run: Run; now: number; budgetMs: number; cloudModel: string; onMoveToCloud: (run: Run) => void }) {
  const { run, now, budgetMs, cloudModel, onMoveToCloud } = props
  const elapsed = run.endedMs ?? now - run.startedAt
  const overBudget =
    run.route === 'prefer_on_device' && run.endedMs === undefined && !run.abandoned && elapsed > budgetMs
  return (
    <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SourceBadge source={run.source} cloudModel={cloudModel} />
        <span className="text-slate-600">
          {run.endedMs === undefined ? 'Running' : run.error ? 'Failed' : 'Done'} · {(elapsed / 1000).toFixed(1)} s
          {run.firstTextMs !== undefined && ` · first text at ${(run.firstTextMs / 1000).toFixed(1)} s`}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{run.text || (run.error ? '' : '…')}</p>
      {run.error && <p className="mt-2 text-sm text-red-700">{run.error}</p>}
      {overBudget && (
        <div className="mt-2 rounded bg-amber-100 p-2 text-sm">
          The {budgetMs / 1000} s on-device budget has passed.{' '}
          <button type="button" onClick={() => onMoveToCloud(run)} className="font-semibold underline">
            Draft in the cloud instead
          </button>
        </div>
      )}
    </div>
  )
}

function SourceBadge({ source, cloudModel }: { source?: Source; cloudModel: string }) {
  if (source === InferenceSource.ON_DEVICE)
    return <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-900">On this laptop · Gemini Nano</span>
  if (source === InferenceSource.IN_CLOUD)
    return <span className="rounded bg-sky-100 px-2 py-0.5 font-semibold text-sky-900">Cloud · {cloudModel}</span>
  return <span className="rounded bg-slate-200 px-2 py-0.5 font-semibold text-slate-700">Waiting for first text</span>
}

function RunLog({ runs }: { runs: Run[] }) {
  return (
    <table className="mt-4 w-full text-left text-xs">
      <caption className="mb-1 text-left font-semibold text-slate-500">Runs (copy these into the PR)</caption>
      <thead className="text-slate-500">
        <tr>
          <th className="py-1 pr-2">#</th>
          <th className="pr-2">Asked for</th>
          <th className="pr-2">Answered by</th>
          <th className="pr-2">First text</th>
          <th className="pr-2">Total</th>
          <th>Words</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id} className="border-t border-slate-200">
            <td className="py-1 pr-2">{r.id}</td>
            <td className="pr-2">{r.route === 'prefer_on_device' ? 'prefer on-device' : 'cloud only'}</td>
            <td className="pr-2">
              {r.source === InferenceSource.ON_DEVICE ? 'on-device' : r.source === InferenceSource.IN_CLOUD ? 'cloud' : '–'}
              {r.abandoned && ' (moved to cloud)'}
              {r.error && ' (error)'}
            </td>
            <td className="pr-2">{r.firstTextMs !== undefined ? `${(r.firstTextMs / 1000).toFixed(1)} s` : '–'}</td>
            <td className="pr-2">{r.endedMs !== undefined ? `${(r.endedMs / 1000).toFixed(1)} s` : '–'}</td>
            <td>{r.text.trim() ? r.text.trim().split(/\s+/).length : 0}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section aria-label="Hello hybrid" className="mt-6 rounded-lg border border-slate-200 bg-white p-4">{children}</section>
}
