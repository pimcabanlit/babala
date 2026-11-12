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

/**
 * The second laptop run, Nov 12, after drafts became a numbered outline. Nano
 * passed for 3 of 4 households; the cloud copied the outline's "Tell them to…"
 * for seniors, which the checker now catches as a prompt leftover.
 */
export const CONSOLE_RUN2: ConsoleCase[] = [
  {
    name: 'general 1: Nano draft',
    household: 'general',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, Barangay Halimbawa, because Typhoon Sample will make landfall. Residents are advised to evacuate immediately and go to Halimbawa Elementary School gym or Barangay Hall. Please call 0917 555 0100 if you need assistance.',
  },
  {
    name: 'general 2: Nano retry',
    household: 'general',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, Barangay Halimbawa due to Typhoon Sample making landfall at 6:00 PM on November 14. Residents are advised to evacuate immediately and seek shelter at Halimbawa Elementary School gym or Barangay Hall.  Call 0917 555 0100 if you require assistance during the evacuation.',
  },
  {
    name: 'seniors 1: Nano draft',
    household: 'seniors',
    source: 'on_device',
    text: 'A Signal No. 3 is raised in Purok 1, Barangay Halimbawa, and Typhoon Sample is expected to make landfall on November 14th. Older residents and people with disabilities should leave their homes early, bringing their medicines and asking a neighbor for help, then go to Halimbawa Elementary School gym or Barangay Hall. Please call the hotline at 0917 555 0100 for assistance.',
  },
  {
    name: 'seniors 2: Nano retry',
    household: 'seniors',
    source: 'on_device',
    text: 'A Signal No. 3 is raised in Purok 1, Barangay Halimbawa, with Typhoon Sample expected to make landfall on November 14th. Older residents and those with disabilities are urged to evacuate early, bringing medication and seeking assistance from neighbors, then heading to the Halimbawa Elementary School gym or Barangay Hall.  For assistance, please call the hotline at 0917 555 0100.',
  },
  {
    name: 'seniors 3: cloud retry',
    household: 'seniors',
    source: 'in_cloud',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. \nTell them to leave early, bring their medicines and ask a neighbour for help, and to go to Halimbawa Elementary School gym or Barangay Hall. \nTell them to call the hotline, 0917 555 0100, for help.',
  },
  {
    name: 'families 1: Nano draft',
    household: 'families',
    source: 'on_device',
    text: 'A Typhoon Sample alert has been raised for Purok 1, Barangay Halimbawa, where Signal No. 3 is in effect landing at 6:00 PM on Nov 14. Please keep your children close by and gather essential supplies like water and food, then head to the Halimbawa Elementary School gym or Barangay Hall.  For assistance, please call the hotline at 0917 555 0100.',
  },
  {
    name: 'families 2: Nano retry',
    household: 'families',
    source: 'on_device',
    text: 'Signal No. 3 is raised for Purok 1, Barangay Halimbawa, and Typhoon Sample will make landfall at 6:00 PM on November 14th. Please keep your children close and gather essential supplies such as water and food, then move to the Halimbawa Elementary School gym or Barangay Hall. For assistance, call the hotline at 0917 555 0100.',
  },
  {
    name: 'fishers 1: Nano draft',
    household: 'fishers',
    source: 'on_device',
    text: 'A Signal No. 3 has been raised in Purok 1, Barangay Halimbawa. Typhoon Sample will make landfall in our area at 6:00 PM on November 14th. Please do not go out to sea, tie up your boats, and go to the Halimbawa Elementary School gym or Barangay Hall; call 0917 555 0100 for assistance.',
  },
]

/**
 * Pim's laptop, Nov 12, round 3 (the outline as the alert itself, the retry
 * with the outline when the shape is wrong). Nano kept to the facts but split
 * the first sentence in two, ran long, wrote "gymnasium", and once answered
 * with the outline as a numbered list. The cloud's retry then took "Remove “1”"
 * literally, out of "Purok 1" and the hotline.
 */
export const CONSOLE_RUN3: ConsoleCase[] = [
  {
    name: 'general 1: Nano draft',
    household: 'general',
    source: 'on_device',
    text: 'Typhoon Sample is expected to make landfall in Barangay Halimbawa at 6:00 PM on November 14. A Signal No. 3 is raised in Purok 1, Barangay Halimbawa. Immediately evacuate to Halimbawa Elementary School gym or Barangay Hall. Please call the hotline at 0917 555 0100 for assistance.',
  },
  {
    name: 'general 2: Nano retry',
    household: 'general',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample is expected to make landfall in Barangay Halimbawa at 6:00 PM on November 14. Immediately evacuate to Halimbawa Elementary School gym or Barangay Hall. Please call the hotline at 0917 555 0100 for assistance.',
  },
  {
    name: 'seniors 1: Nano draft',
    household: 'seniors',
    source: 'on_device',
    text: 'Typhoon Sample will make landfall in Purok 1, Barangay Halimbawa at 6:00 PM on November 14. A Signal No. 3 is in effect for this area. Please evacuate promptly, take your necessary medicines, and ask a neighbor for assistance. Seek shelter at Halimbawa Elementary School gymnasium or Barangay Hall. You can reach the hotline at 0917 555 0100 for further assistance.',
  },
  {
    name: 'seniors 2: Nano retry',
    household: 'seniors',
    source: 'on_device',
    text: '1. Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14.\n2. Leave early, bring your medicines and ask a neighbour for help, and go to Halimbawa Elementary School gym or Barangay Hall.\n3. Call the hotline, 0917 555 0100, for help.',
  },
  {
    name: 'seniors 3: cloud retry',
    household: 'seniors',
    source: 'in_cloud',
    text: 'Signal No. 3 is raised in Purok , and Typhoon Sample makes landfall at 6:00 PM on Nov 14.\nLeave early, bring your medicines and ask a neighbour for help, and go to Halimbawa Elementary School gym or Barangay Hall.\nCall the hotline, 0917 555 000, for help.',
  },
  {
    name: 'families 1: Nano draft',
    household: 'families',
    source: 'on_device',
    text: 'Typhoon Sample is expected to make landfall in Purok 1, Barangay Halimbawa at 6:00 PM on November 14. Signal No. 3 has been raised for this area. With young children, it is important to keep them close and ensure you have water and food readily available. Please proceed to the Halimbawa Elementary School gym or Barangay Hall for safety. For assistance, please call the hotline 0917 555 0100.',
  },
  {
    name: 'families 2: Nano retry',
    household: 'families',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. With young children, it is important to keep them close and ensure you have water and food readily available. Please proceed to the Halimbawa Elementary School gym or Barangay Hall for safety. For assistance, please call the hotline 0917 555 0100.',
  },
  {
    name: 'families 3: cloud retry',
    household: 'families',
    source: 'in_cloud',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. Keep your children close and bring water and food, and go to Halimbawa Elementary School gym or Barangay Hall. Call the hotline, 0917 555 0100, for help.',
  },
  {
    name: 'fishers 1: Nano draft',
    household: 'fishers',
    source: 'on_device',
    text: 'Typhoon Sample is expected to make landfall at 6:00 PM on November 14th. Signal No. 3 is raised for Purok 1, Barangay Halimbawa. Fishermen and boat owners are advised not to venture out at sea; please secure your vessels and seek refuge at Halimbawa Elementary School gym or Barangay Hall. Contact the hotline at 0917 555 0100 for assistance.',
  },
  {
    name: 'fishers 2: Nano retry',
    household: 'fishers',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample is expected to make landfall at 6:00 PM on November 14th. Fishermen and boat owners are advised not to venture out at sea; please secure your vessels and seek refuge at Halimbawa Elementary School gym or Barangay Hall. Contact the hotline at 0917 555 0100 for assistance.',
  },
]

/**
 * Pim's laptop, Nov 12, round 4: both models answer in JSON, one field per
 * sentence, and code joins the fields (these are the joined texts). Nano
 * passed for 3 of 4 households on its first draft. For seniors it wrote that
 * the storm will "reach the area" at the landfall time, and given the whole
 * outline again it sent back the same draft word for word.
 */
export const CONSOLE_RUN4: ConsoleCase[] = [
  {
    name: 'general 1: Nano draft',
    household: 'general',
    source: 'on_device',
    text: 'Signal No. 3 is in operation for Purok 1, Barangay Halimbawa, and Typhoon Sample is expected to make landfall at 6:00 PM on Nov 14. Residents are advised to evacuate immediately and seek shelter at the Halimbawa Elementary School gym or Barangay Hall. For assistance, please contact the hotline at 0917 555 0100.',
  },
  {
    name: 'seniors 1: Nano draft',
    household: 'seniors',
    source: 'on_device',
    text: 'Signal No. 3 is in effect in Purok 1, and Typhoon Sample is predicted to reach the area at 6:00 PM on Nov 14. Residents are advised to evacuate early, gather necessary medications, and seek refuge at Halimbawa Elementary School gym or Barangay Hall. For assistance, please call the hotline at 0917 555 0100.',
  },
  {
    name: 'seniors 3: cloud retry',
    household: 'seniors',
    source: 'in_cloud',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. Leave early, bring your medicines and ask a neighbour for help, and go to Halimbawa Elementary School gym or Barangay Hall. Call the hotline, 0917 555 0100, for help.',
  },
  {
    name: 'families 1: Nano draft',
    household: 'families',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. Keep children close, gather water and food, and evacuate to Halimbawa Elementary School gym or Barangay Hall. Call the hotline, 0917 555 0100, for help.',
  },
  {
    name: 'fishers 1: Nano draft',
    household: 'fishers',
    source: 'on_device',
    text: 'Signal No. 3 is raised in Purok 1, Barangay Halimbawa, and Typhoon Sample will make landfall at 6:00 PM on Nov 14. Remain ashore, secure your vessels, and seek refuge at the Halimbawa Elementary School gym or Barangay Hall. For assistance, contact the hotline at 0917 555 0100.',
  },
]
