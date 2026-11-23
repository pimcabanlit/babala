/** The demo bulletin for the console's "Use the demo bulletin" button. Fictional. */
export { SAMPLE_BULLETIN } from '../checker/fixtures/hillcrest'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * A demo bulletin dated from the officer's today: issued today, landfall
 * tomorrow. With the fixed Nov 14 date, every alert approved after that day
 * said "Last updated" after the storm had already made landfall, in the video
 * and for judges. The fixtures keep Nov 14 so tests don't depend on the clock.
 */
export function datedDemoBulletin(bulletin: string, today: Date = new Date()): string {
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const landfall = `${MONTHS[tomorrow.getMonth()].slice(0, 3)} ${tomorrow.getDate()}`
  const issued = `${today.getDate()} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`
  return bulletin.replaceAll('Nov 14', landfall).replaceAll('14 November 2026', issued)
}

/**
 * A longer, free-form bulletin for "Use the long demo bulletin": the same
 * fictional storm and village as the demo bulletin, laid out in sections
 * and lists the way real bulletins are, so plain code reads only part of it
 * and the cloud reading has something to do. It names a lifted signal, which
 * neither reader may take as raised. Every claim word in it ("storm surge")
 * is one the demo bulletin uses too, so drafts are held to the same words.
 */
export const LONG_BULLETIN = `DEMO TYPHOON BULLETIN NO. 7 (fictional, for testing only)
Typhoon Katy
Issued at 11:00 AM, 14 November 2026

TYPHOON KATY MOVES WEST-NORTHWEST TOWARD HILLCREST VILLAGE

Location of center (10:00 AM): 210 km east of Hillcrest Village
Intensity: maximum sustained winds of 185 km/h near the center, and gusts of up to 230 km/h
Present movement: west-northwestward at 20 km/h

WIND SIGNALS IN EFFECT
Wind Signal No. 3
- Zone 1
- Zone 2
Wind Signal No. 2
- Zone 3
Wind Signal No. 1 has been lifted over Zone 4.

TRACK OUTLOOK
Typhoon Katy is forecast to make landfall over the coast of Hillcrest Village at around 6:00 PM on Nov 14.
Storm surge of up to 2 meters is possible along the coast.

WHAT RESIDENTS SHOULD DO
Residents of low-lying and coastal zones should go now to the designated evacuation centers: Hillcrest Elementary School gym and the Village Hall.
For assistance, call the Hillcrest Village Disaster Desk at 0917 555 0100.

The next bulletin will be issued at 5:00 PM.`
