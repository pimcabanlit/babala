import { useCallback, useEffect, useRef, useState } from 'react'
import { ALERT_SCHEMA } from '../drafting/structured'
import { createDraftModels, prepareOnDeviceModel, warmUpOnDevice, type DraftModels, type Source } from '../ai'
import { readDeviceStatus, type DeviceStatus } from '../ai/deviceStatus'
import { CHECKER_CLAIM_WORDS, REMOTE_CONFIG_DEFAULTS } from '../config/defaults'
import { getFirebase } from '../firebase'
import { loadTunables, type Tunables } from '../firebase/remoteConfig'

export type WarmUp =
  | { state: 'idle' }
  | { state: 'warming'; startedAt: number }
  | { state: 'warm'; seconds: number; source: Source | undefined }
  | { state: 'failed'; error: string }

const firebase = getFirebase()

/** Defaults when Firebase isn't configured: the checker still works by hand. */
const OFFLINE_TUNABLES: Tunables = {
  cloudModelName: REMOTE_CONFIG_DEFAULTS.cloud_model_name,
  ondeviceBudgetSeconds: REMOTE_CONFIG_DEFAULTS.ondevice_budget_seconds,
  checkerClaimWords: [...CHECKER_CLAIM_WORDS],
  sources: { cloud_model_name: 'default', ondevice_budget_seconds: 'default', checker_claim_words: 'default' },
}

/**
 * The console's AI setup: tunables, the two draft models, Chrome's on-device
 * status, the network, the download button and the warm-up on open.
 */
export function useHybrid() {
  const [tunables, setTunables] = useState<Tunables | undefined>(firebase.ok ? undefined : OFFLINE_TUNABLES)
  const [models, setModels] = useState<DraftModels>()
  const [device, setDevice] = useState<DeviceStatus>('unknown')
  const [online, setOnline] = useState(navigator.onLine)
  const [download, setDownload] = useState<number>()
  const [warmUp, setWarmUp] = useState<WarmUp>({ state: 'idle' })
  /** Drafts wait for this, so they don't start a second on-device session mid warm-up. */
  const warmPromise = useRef<Promise<unknown>>(Promise.resolve())
  const warmStarted = useRef(false)
  const deviceRef = useRef<DeviceStatus>('unknown')

  /** Reads Chrome's status, and warms the model up the first time it is on the laptop. */
  const refreshDevice = useCallback(async (m: DraftModels | undefined) => {
    const status = await readDeviceStatus()
    deviceRef.current = status
    setDevice(status)
    if (!m || status !== 'available' || warmStarted.current) return
    warmStarted.current = true
    const startedAt = Date.now()
    setWarmUp({ state: 'warming', startedAt })
    warmPromise.current = warmUpOnDevice(m).then(
      (source) => setWarmUp({ state: 'warm', seconds: (Date.now() - startedAt) / 1000, source }),
      (err: unknown) => setWarmUp({ state: 'failed', error: err instanceof Error ? err.message : String(err) }),
    )
  }, [])

  useEffect(() => {
    if (firebase.ok)
      void loadTunables(firebase.app).then((t) => {
        const m = createDraftModels(firebase.app, t.cloudModelName, ALERT_SCHEMA)
        setTunables(t)
        setModels(m)
        return refreshDevice(m)
      })
    else void readDeviceStatus().then(setDevice)
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [refreshDevice])

  const prepare = useCallback(async () => {
    if (!models) return
    setDownload(0)
    try {
      await prepareOnDeviceModel(models, setDownload)
    } finally {
      setDownload(undefined)
      void refreshDevice(models)
    }
  }, [models, refreshDevice])

  return {
    configured: firebase.ok,
    tunables,
    models,
    device,
    deviceRef,
    online,
    download,
    prepare,
    warmUp,
    warmPromise,
    /** Re-reads Chrome's status, e.g. after a draft. */
    refreshDevice: () => refreshDevice(models),
  }
}
