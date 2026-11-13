/**
 * A hand-written, fictional bulletin and its fact sheet. "Halimbawa" means
 * "example"; the storm is "Typhoon Sample". Not a real place or storm.
 */
import type { FactSheet } from '../types'

export const SAMPLE_BULLETIN = `DEMO BULLETIN (fictional). Typhoon Sample.
Tropical Cyclone Wind Signal No. 3 is raised over Purok 1 and Purok Ilaya of Barangay Halimbawa.
Signal No. 2 is raised over Purok 2.
Typhoon Sample is expected to make landfall at 6:00 PM on Nov 14 with maximum winds of 185 km/h.
Strong winds and storm surge of up to 2 meters are possible in coastal puroks.
Residents must evacuate to Halimbawa Elementary School gym or the Barangay Hall.
Hotline: 0917 555 0100.`

export const SAMPLE_SHEET: FactSheet = {
  stormName: 'Typhoon Sample',
  signals: [
    { area: 'Purok 1', signal: 3 },
    { area: 'Purok Ilaya', signal: 3 },
    { area: 'Purok 2', signal: 2 },
  ],
  landfallTime: '18:00',
  landfallDate: 'Nov 14',
  evacuationCentres: ['Halimbawa Elementary School gym', 'Barangay Hall'],
  puroks: ['Purok 1', 'Purok Ilaya', 'Purok 2'],
  barangays: ['Barangay Halimbawa'],
  hotline: '0917 555 0100',
  otherFigures: [185, 2],
  bulletinText: SAMPLE_BULLETIN,
}

/** A draft that passes every rule for Purok Ilaya. */
export const GOOD_DRAFT =
  'Signal No. 3 is raised over Purok Ilaya. Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym. For help, call 0917 555 0100.'

/** A Filipino translation of GOOD_DRAFT that keeps every figure and name. */
export const GOOD_FILIPINO =
  'Nakataas ang Signal No. 3 sa Purok Ilaya. Inaasahang tatama ang bagyo sa alas-6 ng gabi sa Nov 14, kaya lumikas na sa Halimbawa Elementary School gym. Para sa tulong, tumawag sa 0917 555 0100.'

/**
 * Gemini Nano on the laptop, Nov 12, Purok 1, General household. It passed
 * the checker and was approved with the Hindi word “कृपया” ("please") in it.
 */
export const NANO_HINDI_DRAFT =
  'Signal No. 3 is raised in Purok 1, Barangay Halimbawa, and Typhoon Sample will make landfall at 6:00 PM on Nov 14. Residents are advised to evacuate immediately to the Halimbawa Elementary School gym or Barangay Hall. For assistance, कृपया call the hotline, 0917 555 0100.'

/** A Cebuano translation of GOOD_DRAFT that keeps every figure and name. */
export const GOOD_CEBUANO =
  'Gipataas ang Signal No. 3 sa Purok Ilaya. Gidahom nga motugpa ang bagyo sa alas-6 sa gabii sa Nov 14, busa bakwit na karon sa Halimbawa Elementary School gym. Para sa tabang, tawag sa 0917 555 0100.'
