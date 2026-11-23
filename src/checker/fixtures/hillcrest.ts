/**
 * A hand-written, fictional bulletin and its fact sheet: Typhoon Katy and
 * Hillcrest Village, with its zones. Not a real place or storm (Katy is on no
 * PAGASA naming list). Until Nov 23 the demo said "Typhoon Sample", "Barangay
 * Halimbawa" and "Purok"; they were renamed in plain English for judges.
 */
import type { FactSheet } from '../types'

export const SAMPLE_BULLETIN = `DEMO BULLETIN (fictional). Typhoon Katy.
Tropical Cyclone Wind Signal No. 3 is raised over Zone 1 and Zone 2 of Hillcrest Village.
Signal No. 2 is raised over Zone 3.
Typhoon Katy is expected to make landfall at 6:00 PM on Nov 14 with maximum winds of 185 km/h.
Strong winds and storm surge of up to 2 meters are possible in coastal zones.
Residents must evacuate to Hillcrest Elementary School gym or the Village Hall.
Hotline: 0917 555 0100.`

export const SAMPLE_SHEET: FactSheet = {
  stormName: 'Typhoon Katy',
  signals: [
    { area: 'Zone 1', signal: 3 },
    { area: 'Zone 2', signal: 3 },
    { area: 'Zone 3', signal: 2 },
  ],
  landfallTime: '18:00',
  landfallDate: 'Nov 14',
  evacuationCentres: ['Hillcrest Elementary School gym', 'Village Hall'],
  puroks: ['Zone 1', 'Zone 2', 'Zone 3'],
  barangays: ['Hillcrest Village'],
  hotline: '0917 555 0100',
  otherFigures: [185, 2],
  bulletinText: SAMPLE_BULLETIN,
}

/** A draft that passes every rule for Zone 2. */
export const GOOD_DRAFT =
  'Signal No. 3 is raised over Zone 2. Landfall is expected at 6 PM on Nov 14, so evacuate now to Hillcrest Elementary School gym. For help, call 0917 555 0100.'

/** A Filipino translation of GOOD_DRAFT that keeps every figure and name. */
export const GOOD_FILIPINO =
  'Nakataas ang Signal No. 3 sa Zone 2. Inaasahang tatama ang bagyo sa alas-6 ng gabi sa Nov 14, kaya lumikas na sa Hillcrest Elementary School gym. Para sa tulong, tumawag sa 0917 555 0100.'

/**
 * Gemini Nano on the laptop, Nov 12, Zone 1, General household. It passed
 * the checker and was approved with the Hindi word “कृपया” ("please") in it.
 */
export const NANO_HINDI_DRAFT =
  'Signal No. 3 is raised in Zone 1, Hillcrest Village, and Typhoon Katy will make landfall at 6:00 PM on Nov 14. Residents are advised to evacuate immediately to the Hillcrest Elementary School gym or Village Hall. For assistance, कृपया call the hotline, 0917 555 0100.'

/** A Cebuano translation of GOOD_DRAFT that keeps every figure and name. */
export const GOOD_CEBUANO =
  'Gipataas ang Signal No. 3 sa Zone 2. Gidahom nga motugpa ang bagyo sa alas-6 sa gabii sa Nov 14, busa bakwit na karon sa Hillcrest Elementary School gym. Para sa tabang, tawag sa 0917 555 0100.'
