/**
 * Real drafts from day 1 (Nov 12), word for word. All used the same prompt;
 * none of them should pass. Source: Pim's laptop (Gemini Nano through Firebase
 * AI Logic) and the cloud session (gemini-3.5-flash-lite).
 */
import type { FactSheet } from '../types'

export const DAY1_PROMPT =
  'Write a 3-sentence typhoon alert for residents of a coastal village: Signal No. 3, landfall expected 6 PM, evacuate to the school gym.'

/** The prompt is the whole "bulletin": these are its only facts. */
export const DAY1_SHEET: FactSheet = {
  stormName: 'unnamed',
  signals: [{ area: 'coastal village', signal: 3 }],
  landfallTime: '18:00',
  evacuationCentres: ['school gym'],
  puroks: [],
  barangays: [],
  hotline: '',
  bulletinText: DAY1_PROMPT,
}

export type Day1Case = { name: string; source: 'on_device' | 'in_cloud'; text: string }

export const DAY1_CASES: Day1Case[] = [
  {
    name: 'case 2: Nano, cold first draft',
    source: 'on_device',
    text: 'Residents of [Village Name], please take immediate precautionary measures as a Signal No. 3 typhoon is imminent.  Expect landfall around 6 PM today, and be prepared for heavy rainfall, strong winds, and potential storm surge. Your safety is paramount – immediately evacuate to the school gym as instructed by authorities.',
  },
  {
    name: 'case 3: cloud, flash-lite',
    source: 'in_cloud',
    text: 'Typhoon Signal No. 3 has been raised as a destructive storm approaches our coastline, with landfall expected at 6 PM today. All residents must immediately evacuate to the designated shelter at the school gym for your safety. Please secure your homes now and bring your emergency kits before conditions worsen.',
  },
  {
    name: 'case 4: Nano, warm',
    source: 'on_device',
    text: 'Residents of [Village Name], please heed this urgent evacuation advisory: a Signal No. 3 typhoon is imminent. We anticipate landfall around 6 PM [Philippine Time].  Immediate evacuation to the school gym is strongly advised for your safety – please follow designated evacuation routes and remain informed of updates.',
  },
  {
    name: 'case 5: Nano, Wi-Fi off',
    source: 'on_device',
    text: '⚠️ **TYPHOON ALERT ISSUED** ⚠️ Signal No. 3 is now in effect for coastal areas of our village. A typhoon is expected to make landfall around 6 PM this evening. Please evacuate immediately to the school gym for safety until further notice.',
  },
  {
    name: 'case 6: Nano, Wi-Fi off',
    source: 'on_device',
    text: 'Residents of [Village Name], a Signal No. 3 typhoon alert has been issued. Expect landfall around 6 PM and be prepared for potentially severe conditions like strong winds and heavy rain.  Your safest course of action is to evacuate immediately to the [School Name] gymnasium; please follow instructions from emergency personnel.',
  },
  {
    name: 'case 7: cloud, flash-lite, on the laptop',
    source: 'in_cloud',
    text: 'Typhoon Signal No. 3 has been raised for our coastal village, with landfall expected this evening at 6 PM. Life-threatening storm surges and destructive winds are imminent in our area. All residents must immediately evacuate to the municipal school gym for safety.',
  },
]
