/**
 * firestore.rules against the Firestore emulator. Run with `npm run test:rules`.
 * Valid alerts come from approvedAlert() in src/alerts/record.ts, the same
 * code the console uses, so the app and the rules can't drift apart unseen.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { ALERTS, LIMITS, approvedAlert } from '../../src/alerts/record'
import { GOOD_DRAFT, SAMPLE_SHEET } from '../../src/checker/fixtures/halimbawa'
import { CHECKER_CLAIM_WORDS } from '../../src/config/defaults'
import { HOUSEHOLDS } from '../../src/drafting/households'

const OFFICER = 'officer-1'
const OTHER_OFFICER = 'officer-2'
const STRANGER = 'google-user-not-on-list'
const RESIDENT = 'anonymous-resident'

const google = { firebase: { sign_in_provider: 'google.com' as const } }
const anonymous = { firebase: { sign_in_provider: 'anonymous' as const } }

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-babala',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'officers', OFFICER), { name: 'Test officer' })
    await setDoc(doc(db, 'officers', OTHER_OFFICER), { name: 'Second test officer' })
    // Someone on the list who signed in anonymously: still not an officer.
    await setDoc(doc(db, 'officers', RESIDENT), { name: 'Listed but anonymous' })
  })
})

const officerDb = (uid = OFFICER) => env.authenticatedContext(uid, google).firestore()
const strangerDb = () => env.authenticatedContext(STRANGER, google).firestore()
const residentDb = () => env.authenticatedContext(RESIDENT, anonymous).firestore()
const visitorDb = () => env.unauthenticatedContext().firestore()

/** The general household's alert for Purok Ilaya, as the console builds it. */
function approval() {
  const result = approvedAlert({
    text: GOOD_DRAFT,
    sheet: SAMPLE_SHEET,
    area: 'Purok Ilaya',
    household: HOUSEHOLDS.find((h) => h.id === 'general')!,
    claimWords: [...CHECKER_CLAIM_WORDS],
    source: 'on_device',
    edited: false,
  })
  if (!result.ok) throw new Error(result.reason)
  return result
}

/** The document saveApprovedAlert() writes, with any fields changed. */
function alertDoc(uid = OFFICER, change: Record<string, unknown> = {}) {
  return { ...approval().record, approvedBy: uid, approvedAt: serverTimestamp(), ...change }
}

const alertRef = (db: ReturnType<typeof officerDb>, id = approval().id) => doc(db, ALERTS, id)

/** Saves a valid alert with the rules off, for the read, update and delete tests. */
async function seedAlert() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), ALERTS, approval().id), { ...alertDoc(), approvedAt: Timestamp.now() })
  })
}

describe('saving an alert', () => {
  it('lets an officer save an approved alert built by approvedAlert()', async () => {
    await assertSucceeds(setDoc(alertRef(officerDb()), alertDoc()))
  })

  it('lets another officer replace a saved alert with a new approval', async () => {
    await seedAlert()
    await assertSucceeds(setDoc(alertRef(officerDb(OTHER_OFFICER)), alertDoc(OTHER_OFFICER)))
  })

  it('stops a Google user who is not on the officer list', async () => {
    await assertFails(setDoc(alertRef(strangerDb()), alertDoc(STRANGER)))
  })

  it('stops an anonymous user even if their ID is on the officer list', async () => {
    await assertFails(setDoc(alertRef(residentDb()), alertDoc(RESIDENT)))
  })

  it('stops a visitor who is not signed in', async () => {
    await assertFails(setDoc(alertRef(visitorDb()), alertDoc()))
  })

  it('stops an officer naming someone else as the approver', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { approvedBy: OTHER_OFFICER })))
  })

  it('stops an officer setting the approval time from the laptop clock', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { approvedAt: Timestamp.now() })))
  })

  it('stops a document with a field the app never writes', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { checkedByModel: true })))
  })

  it('stops a document missing a field', async () => {
    const { edited: _edited, ...missing } = alertDoc()
    await assertFails(setDoc(alertRef(officerDb()), missing))
  })

  it('stops an alert saved under another household’s or area’s ID', async () => {
    await assertFails(setDoc(alertRef(officerDb(), 'fishers__purok-ilaya'), alertDoc()))
  })

  it('stops an unknown household', async () => {
    const data = alertDoc(OFFICER, { household: 'tourists' })
    await assertFails(setDoc(alertRef(officerDb(), 'tourists__purok-ilaya'), data))
  })

  it('stops a signal number that is not the area’s signal in the fact sheet', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { signal: 2 })))
  })

  it('stops an area that is not in the fact sheet', async () => {
    const data = alertDoc(OFFICER, { area: 'Purok 9', areaKey: 'purok-9' })
    await assertFails(setDoc(alertRef(officerDb(), 'general__purok-9'), data))
  })

  it('stops an area key that is not lower-case words joined by dashes', async () => {
    const data = alertDoc(OFFICER, { areaKey: 'Purok Ilaya' })
    await assertFails(setDoc(alertRef(officerDb(), 'general__Purok Ilaya'), data))
  })

  it('stops alert text longer than the limit', async () => {
    const data = alertDoc(OFFICER, { text: 'a'.repeat(LIMITS.text + 1) })
    await assertFails(setDoc(alertRef(officerDb()), data))
  })

  it('allows alert text right at the limit', async () => {
    const data = alertDoc(OFFICER, { text: 'a'.repeat(LIMITS.text) })
    await assertSucceeds(setDoc(alertRef(officerDb()), data))
  })

  it('stops empty alert text', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { text: '' })))
  })

  it('stops alert text that is not a string', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { text: 42 })))
  })

  it('stops an unknown source', async () => {
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { source: 'officer' })))
  })

  it('stops a bulletin longer than the limit', async () => {
    const factSheet = { ...approval().record.factSheet, bulletinText: 'a'.repeat(LIMITS.bulletinText + 1) }
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { factSheet })))
  })

  it('stops a fact sheet with a field the app never writes', async () => {
    const factSheet = { ...approval().record.factSheet, verifiedByModel: true }
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { factSheet })))
  })

  it('stops a landfall time that is not 24-hour HH:MM', async () => {
    const factSheet = { ...approval().record.factSheet, landfallTime: '6:00 PM' }
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { factSheet })))
  })

  it('stops a fact sheet with no evacuation centre', async () => {
    const factSheet = { ...approval().record.factSheet, evacuationCentres: [] }
    await assertFails(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { factSheet })))
  })

  it('allows a fact sheet with no landfall date', async () => {
    const { landfallDate: _date, ...factSheet } = approval().record.factSheet
    await assertSucceeds(setDoc(alertRef(officerDb()), alertDoc(OFFICER, { factSheet })))
  })
})

describe('reading and deleting alerts', () => {
  it('lets an officer read the saved alerts', async () => {
    await seedAlert()
    await assertSucceeds(getDocs(collection(officerDb(), ALERTS)))
  })

  it('does not let a Google user who is not on the list read alerts yet', async () => {
    await seedAlert()
    await assertFails(getDoc(alertRef(strangerDb())))
  })

  it('does not let an anonymous resident read alerts yet', async () => {
    await seedAlert()
    await assertFails(getDocs(collection(residentDb(), ALERTS)))
  })

  it('does not let a visitor read alerts', async () => {
    await seedAlert()
    await assertFails(getDocs(collection(visitorDb(), ALERTS)))
  })

  it('does not let an officer delete a saved alert', async () => {
    await seedAlert()
    await assertFails(deleteDoc(alertRef(officerDb())))
  })
})

describe('the officer list', () => {
  it('lets a signed-in user read their own entry', async () => {
    await assertSucceeds(getDoc(doc(officerDb(), 'officers', OFFICER)))
  })

  it('lets a user who is not on the list learn that, by reading their missing entry', async () => {
    await assertSucceeds(getDoc(doc(strangerDb(), 'officers', STRANGER)))
  })

  it('does not let a user read someone else’s entry', async () => {
    await assertFails(getDoc(doc(strangerDb(), 'officers', OFFICER)))
  })

  it('does not let anyone list the officers', async () => {
    await assertFails(getDocs(collection(officerDb(), 'officers')))
  })

  it('does not let a user add themselves to the list', async () => {
    await assertFails(setDoc(doc(strangerDb(), 'officers', STRANGER), { name: 'Me' }))
  })

  it('does not let an officer add someone else to the list', async () => {
    await assertFails(setDoc(doc(officerDb(), 'officers', STRANGER), { name: 'Friend' }))
  })

  it('does not let an officer remove themselves from the list', async () => {
    await assertFails(deleteDoc(doc(officerDb(), 'officers', OFFICER)))
  })
})

describe('everything else', () => {
  it('denies any other collection, even to an officer', async () => {
    await assertFails(setDoc(doc(officerDb(), 'ledger', 'entry-1'), { note: 'not allowed yet' }))
  })
})
