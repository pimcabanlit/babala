/**
 * Real answers from Pim's laptop, Nov 12, the officer console with the demo
 * bulletin (fact sheet: SAMPLE_SHEET), area Purok 1, after the retry became an
 * edit list. Nano wrote 4 to 6 short sentences and dropped the landfall time;
 * three "passing" answers moved 6:00 PM onto the wrong event. Word for word,
 * except trailing blank lines.
 */
export type ConsoleCase = {
  name: string
  household: 'general' | 'seniors' | 'families' | 'fishers'
  source: 'on_device' | 'in_cloud'
  text: string
}

export const CONSOLE_RUN1: ConsoleCase[] = [
  {
    name: 'general 1: Nano draft',
    household: 'general',
    source: 'on_device',
    text: 'Typhoon Sample has been declared. Signal No. 3 is in effect for Purok 1, Barangay Halimbawa. Please evacuate now to either Halimbawa Elementary School gym or Barangay Hall. Call 0917 555 0100 for updates.',
  },
  {
    name: 'general 2: Nano retry',
    household: 'general',
    source: 'on_device',
    text: 'Typhoon Sample has been declared at 6:00 PM on Nov 14. Signal No. 3 is in effect for Purok 1, Barangay Halimbawa. Please evacuate now to either Halimbawa Elementary School gym or Barangay Hall. Call 0917 555 0100 for updates.',
  },
  {
    name: 'general 3: cloud retry',
    household: 'general',
    source: 'in_cloud',
    text: 'Typhoon Sample has been declared at 6:00 PM on Nov 14, with Signal No. 3 in effect for Purok 1, Barangay Halimbawa. Please evacuate now to either the Halimbawa Elementary School gym or the Barangay Hall. Call 0917 555 0100 for updates.',
  },
  {
    name: 'seniors 1: Nano draft',
    household: 'seniors',
    source: 'on_device',
    text: 'Dear residents of Purok 1, Barangay Halimbawa,\n\nA Typhoon Sample is approaching. Signal No. 3 is in effect, and landfall is expected 6:00 PM on Nov 14. Please evacuate early and take your medicines. Contact 0917 555 0100 or ask a neighbor for help. You can go to the Halimbawa Elementary School gym or Barangay Hall for assistance.',
  },
  {
    name: 'seniors 2: Nano retry',
    household: 'seniors',
    source: 'on_device',
    text: 'Dear residents of Purok 1, Barangay Halimbawa,\n\nA Typhoon Sample is approaching with Signal No. 3 in effect, expected to make landfall at 6:00 PM on Nov 14. Please evacuate early, take your medicines, and contact 0917 555 0100 or a neighbor for assistance. You can seek help at the Halimbawa Elementary School gym or Barangay Hall.',
  },
  {
    name: 'families 1: Nano draft',
    household: 'families',
    source: 'on_device',
    text: 'Typhoon Sample is approaching. Signal No. 3 is in Purok 1, Barangay Halimbawa. Please keep your children close and bring water and food.',
  },
  {
    name: 'families 2: Nano retry',
    household: 'families',
    source: 'on_device',
    text: 'Typhoon Sample is approaching. Signal No. 3 is in Purok 1, Barangay Halimbawa. Keep your children close and bring water and food. When: 6:00 PM on Nov 14. Where to go: Halimbawa Elementary School gym or Barangay Hall. Hotline: 0917 555 0100.',
  },
  {
    name: 'families 3: cloud retry',
    household: 'families',
    source: 'in_cloud',
    text: 'Typhoon Sample is approaching, and Signal No. 3 is now raised in Purok 1, Barangay Halimbawa, requiring you to keep children close and bring water and food by 6:00 PM on Nov 14. Evacuate to the Halimbawa Elementary School gym or Barangay Hall. For assistance, call the hotline at 0917 555 0100.',
  },
  {
    name: 'fishers 1: Nano draft',
    household: 'fishers',
    source: 'on_device',
    text: 'Typhoon Sample has a Signal No. 3 in Purok 1, Barangay Halimbawa. Please do not go out to sea and secure your boats. You can find evacuation centers at Halimbawa Elementary School gym or Barangay Hall. You can reach the hotline at 0917 555 0100.',
  },
  {
    name: 'fishers 2: Nano retry',
    household: 'fishers',
    source: 'on_device',
    text: 'Typhoon Sample has a Signal No. 3 in Purok 1, Barangay Halimbawa, effective 6:00 PM on Nov 14. Please do not go out to sea and secure your boats. Evacuation centers are located at Halimbawa Elementary School gym or Barangay Hall; call 0917 555 0100 for inquiries.',
  },
]
