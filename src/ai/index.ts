/**
 * The only module that imports firebase/ai (CLAUDE.md, architecture rules).
 * Every AI call in Babala goes through here, and so through Firebase AI Logic.
 */
import type { FirebaseApp } from 'firebase/app'
import {
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  getAI,
  getGenerativeModel,
  type GenerativeModel,
} from 'firebase/ai'
import { ON_DEVICE_IO } from './deviceStatus'

export { InferenceSource }
export type Source = (typeof InferenceSource)[keyof typeof InferenceSource]

export type Route = 'prefer_on_device' | 'only_in_cloud'

export type DraftModels = Record<Route, GenerativeModel>

/**
 * Two models for drafting: "prefer on-device" (Nano when Chrome has it ready,
 * otherwise the cloud) and "only in cloud". The cloud model name comes from
 * Remote Config.
 */
export function createDraftModels(app: FirebaseApp, cloudModelName: string): DraftModels {
  // Limited-use App Check tokens: required by newer models for replay protection
  // (Firebase AI Logic agent skill, web usage patterns).
  const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })
  const generationConfig = { temperature: 0.2 }
  return {
    prefer_on_device: getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: cloudModelName, generationConfig },
      onDeviceParams: { createOptions: { ...ON_DEVICE_IO } },
    }),
    only_in_cloud: getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: { model: cloudModelName, generationConfig },
    }),
  }
}

/**
 * Starts the on-device model download. Chrome only allows this after a user
 * action such as a click. Uses the SDK, never LanguageModel.create() directly.
 */
export function prepareOnDeviceModel(models: DraftModels, onProgress: (fraction: number) => void): Promise<void> {
  return models.prefer_on_device.initializeDeviceModel(onProgress)
}

export type StreamEvents = {
  /** Called with the full text so far, each time a chunk arrives. */
  onText: (text: string, source: Source | undefined) => void
}

export type StreamResult = { text: string; source: Source | undefined }

/**
 * Streams one draft. The response says which model answered (inferenceSource),
 * which drives the on-device or cloud badge. Note: the SDK can't cancel an
 * on-device call, so callers enforce the time budget by moving on, not aborting.
 */
export async function streamDraft(
  models: DraftModels,
  route: Route,
  prompt: string,
  events: StreamEvents,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const result = await models[route].generateContentStream(prompt, { signal })
  let text = ''
  let source: Source | undefined
  for await (const chunk of result.stream) {
    source = chunk.inferenceSource ?? source
    text += chunk.text()
    events.onText(text, source)
  }
  return { text, source }
}
