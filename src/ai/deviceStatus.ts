/**
 * Chrome's on-device model status, for the UI only. Reading availability is
 * allowed by CLAUDE.md; prompting Nano directly is not (all prompts go through
 * Firebase AI Logic). No Firebase imports here, so this stays unit-testable.
 */
export type DeviceStatus =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unsupported'
  | 'unknown'

/** The on-device job shape: English text in, English text out. */
export const ON_DEVICE_IO = {
  expectedInputs: [{ type: 'text' as const, languages: ['en'] }],
  expectedOutputs: [{ type: 'text' as const, languages: ['en'] }],
}

type LanguageModelGlobal = {
  availability: (options: typeof ON_DEVICE_IO) => Promise<string>
}

export async function readDeviceStatus(
  scope: { LanguageModel?: LanguageModelGlobal } = globalThis as { LanguageModel?: LanguageModelGlobal },
): Promise<DeviceStatus> {
  if (!scope.LanguageModel) return 'unsupported'
  try {
    return toDeviceStatus(await scope.LanguageModel.availability(ON_DEVICE_IO))
  } catch {
    return 'unknown'
  }
}

export function toDeviceStatus(value: string): DeviceStatus {
  switch (value) {
    case 'available':
    case 'downloadable':
    case 'downloading':
    case 'unavailable':
      return value
    default:
      return 'unknown'
  }
}

/** What the officer sees for each status. */
export function describeDeviceStatus(status: DeviceStatus): string {
  switch (status) {
    case 'available':
      return 'Ready on this laptop'
    case 'downloadable':
      return 'Not downloaded yet: press "Prepare on-device model"'
    case 'downloading':
      return 'Downloading'
    case 'unavailable':
      return 'This device can’t run the on-device model; drafts use the cloud'
    case 'unsupported':
      return 'This browser has no on-device model; drafts use the cloud'
    case 'unknown':
      return 'Couldn’t read the on-device model status; drafts may use the cloud'
  }
}

/** Whether the prepare (download) button makes sense. */
export function canPrepare(status: DeviceStatus): boolean {
  return status === 'downloadable' || status === 'downloading'
}
