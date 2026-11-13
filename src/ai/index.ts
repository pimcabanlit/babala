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
 * Firebase AI Logic with the Gemini Developer API. Limited-use App Check
 * tokens: required by newer models for replay protection (Firebase AI Logic
 * agent skill, web usage patterns).
 */
function aiFor(app: FirebaseApp) {
  return getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })
}

/**
 * Two models for drafting: "prefer on-device" (Nano when Chrome has it ready,
 * otherwise the cloud) and "only in cloud". The cloud model name comes from
 * Remote Config.
 *
 * With `jsonSchema`, both models answer in JSON that fits it: Nano through
 * Chrome's response constraint (onDeviceParams.promptOptions.responseConstraint)
 * and the cloud through responseJsonSchema, the same schema on both paths
 * (https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output).
 */
export function createDraftModels(
  app: FirebaseApp,
  cloudModelName: string,
  jsonSchema?: Record<string, unknown>,
): DraftModels {
  const ai = aiFor(app)
  const generationConfig = {
    temperature: 0.2,
    ...(jsonSchema ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema } : {}),
  }
  return {
    prefer_on_device: getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: cloudModelName, generationConfig },
      onDeviceParams: {
        createOptions: { ...ON_DEVICE_IO },
        ...(jsonSchema ? { promptOptions: { responseConstraint: jsonSchema } } : {}),
      },
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

/**
 * Loads Gemini Nano into memory before the first real draft: on the laptop the
 * first on-device call took 32 s, later ones about 7 s. Call it only when
 * Chrome reports the model "available", so "prefer on-device" answers on the
 * device and the warm-up never uses the cloud. It uses the same model object
 * as the drafts, because the SDK keeps that object's session (and so the model)
 * in memory.
 */
export async function warmUpOnDevice(models: DraftModels): Promise<Source | undefined> {
  // The model may have a JSON schema; a one-word answer fits any string field.
  const result = await models.prefer_on_device.generateContent('Fill every field with the word "ready".')
  return result.response.inferenceSource
}

export type TranslationModel = GenerativeModel

/**
 * The translation model: "only in cloud", because Gemini Nano writes only
 * German, English, Spanish, French and Japanese, not Filipino or Cebuano. It
 * answers in JSON that fits `jsonSchema`. The cloud model name comes from
 * Remote Config.
 */
export function createTranslationModel(
  app: FirebaseApp,
  cloudModelName: string,
  jsonSchema: Record<string, unknown>,
): TranslationModel {
  return getGenerativeModel(aiFor(app), {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: cloudModelName,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseJsonSchema: jsonSchema },
    },
  })
}

/**
 * One translation call, not streamed: the cloud answers a short alert in a
 * few seconds, and the officer reviews the whole text. One call per click;
 * nothing here retries.
 */
export async function translateOnce(model: TranslationModel, prompt: string, signal?: AbortSignal): Promise<StreamResult> {
  const result = await model.generateContent(prompt, { signal })
  return { text: result.response.text(), source: result.response.inferenceSource }
}

/** The two models that answer residents' questions (src/ask/). */
export type AskModels = { on_device: GenerativeModel; cloud: GenerativeModel }

/**
 * Models for residents' questions, both answering in JSON that fits
 * `jsonSchema`. The on-device one is "only on device", not "prefer on-device",
 * so a question routed to the device never reaches the cloud unseen: the
 * cloud has its own route, with its own limit per phone. It is used only
 * when Chrome reports Nano downloaded; the resident view never starts a
 * download. Temperature 0: the answer should be the alert's own words.
 */
export function createAskModels(app: FirebaseApp, cloudModelName: string, jsonSchema: Record<string, unknown>): AskModels {
  const ai = aiFor(app)
  return {
    on_device: getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: {
        createOptions: { ...ON_DEVICE_IO },
        promptOptions: { responseConstraint: jsonSchema },
      },
    }),
    cloud: getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: cloudModelName,
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: jsonSchema },
      },
    }),
  }
}

/**
 * One answer, not streamed: residents see an answer only after the checker
 * passes it, so there is nothing to show while it is written. The signal
 * stops a cloud call; the SDK can't stop an on-device one.
 */
export async function askOnce(models: AskModels, route: keyof AskModels, prompt: string, signal?: AbortSignal): Promise<StreamResult> {
  const result = await models[route].generateContent(prompt, { signal })
  return { text: result.response.text(), source: result.response.inferenceSource }
}

/**
 * Loads Gemini Nano before the resident's first question, when they start
 * typing one: the first on-device call on the laptop took 32 s, later ones
 * about 7 s. On-device only, so it never uses the cloud.
 */
export async function warmUpAsk(models: AskModels): Promise<void> {
  await models.on_device.generateContent('Fill every field: in_alert false, sentences empty, answer empty.')
}
