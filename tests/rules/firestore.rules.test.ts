/**
 * firestore.rules against the Firestore emulator. Run with `npm run test:rules`.
 * Valid alerts and ledger entries come from approvedAlert() in
 * src/alerts/record.ts and approvalWrites() in src/ledger/record.ts, the same
 * code the console uses, so the app and the rules can't drift apart unseen.
 */
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { ALERTS, LIMITS, approvedAlert, readSavedAlert } from '../../src/alerts/record'
import { LEDGER, LEDGER_LIMITS, approvalWrites, withdrawalWrites, type Trail } from '../../src/ledger/record'
import { LEDGER_PAGE } from '../../src/ledger/store'
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
type TestDb = ReturnType<typeof officerDb>

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

const ALERT_ID = 'general__purok-ilaya'
const LEDGER_ID = 'AbCdEfGhIjKlMnOpQrSt'
const OLD_LEDGER_ID = 'OldEntryOldEntry0001'

/** One passing Nano draft, as the console records it. */
const TRAIL: Trail = {
  drafts: [
    {
      round: 1,
      route: 'prefer_on_device',
      retry: false,
      area: 'Purok Ilaya',
      source: 'on_device',
      prompt: 'Write a typhoon alert for all residents in Purok Ilaya…',
      text: GOOD_DRAFT,
      outcome: 'passed',
      issues: [],
      error: '',
      startedAtMs: 1_794_700_000_000,
      firstTextMs: 900,
      totalMs: 15_200,
    },
  ],
  cloudModel: 'gemini-3.5-flash-lite',
  claimWords: [...CHECKER_CLAIM_WORDS],
}

type Doc = Record<string, unknown>

/**
 * The alert and ledger entry saveApprovedAlert() writes, with `both` changed
 * in each: use it for the fields the two share.
 */
function pair(uid = OFFICER, both: Doc = {}, ledgerId = LEDGER_ID): { alert: Doc; entry: Doc } {
  const writes = approvalWrites(approval(), ledgerId, TRAIL)
  return {
    alert: { ...writes.alert, approvedBy: uid, approvedAt: serverTimestamp(), ...both },
    entry: { ...writes.entry, by: uid, at: serverTimestamp(), ...both },
  }
}

/** Commits the alert and the entry in one batch, as the app does. Leave one out to write the other alone. */
function save(db: TestDb, docs: { alert?: Doc; entry?: Doc }, ids: { alertId?: string; ledgerId?: string } = {}) {
  const batch = writeBatch(db)
  if (docs.alert) batch.set(doc(db, ALERTS, ids.alertId ?? ALERT_ID), docs.alert)
  if (docs.entry) batch.set(doc(db, LEDGER, ids.ledgerId ?? LEDGER_ID), docs.entry)
  return batch.commit()
}

/** Saves a valid alert and its entry with the rules off, as an earlier approval. */
async function seedApproval(ledgerId = OLD_LEDGER_ID) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const { alert, entry } = pair(OFFICER, {}, ledgerId)
    const at = Timestamp.fromMillis(Date.now() - 60_000)
    await setDoc(doc(db, ALERTS, ALERT_ID), { ...alert, approvedAt: at })
    await setDoc(doc(db, LEDGER, ledgerId), { ...entry, at })
  })
}

/** Saves an alert from before the ledger, with no ledgerId, with the rules off. */
async function seedAlertBeforeLedger() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const { ledgerId: _ledgerId, ...alert } = pair().alert
    await setDoc(doc(ctx.firestore(), ALERTS, ALERT_ID), { ...alert, approvedAt: Timestamp.now() })
  })
}

describe('saving an alert with its ledger entry', () => {
  it('lets an officer save an approved alert and its entry, built by approvedAlert() and approvalWrites()', async () => {
    await assertSucceeds(save(officerDb(), pair()))
  })

  it('lets another officer replace a saved alert with a new approval, keeping the old entry', async () => {
    await seedApproval()
    await assertSucceeds(save(officerDb(OTHER_OFFICER), pair(OTHER_OFFICER)))
    await assertSucceeds(getDoc(doc(officerDb(), LEDGER, OLD_LEDGER_ID)))
  })

  it('lets an officer replace an alert saved before the ledger', async () => {
    await seedAlertBeforeLedger()
    await assertSucceeds(save(officerDb(), pair()))
  })

  it('stops a Google user who is not on the officer list', async () => {
    await assertFails(save(strangerDb(), pair(STRANGER)))
  })

  it('stops an anonymous user even if their ID is on the officer list', async () => {
    await assertFails(save(residentDb(), pair(RESIDENT)))
  })

  it('stops a visitor who is not signed in', async () => {
    await assertFails(save(visitorDb(), pair()))
  })

  it('stops an officer naming someone else as the approver', async () => {
    await assertFails(save(officerDb(), pair(OTHER_OFFICER)))
  })

  it('stops an officer setting the approval time from the laptop clock', async () => {
    const now = Timestamp.now()
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert: { ...alert, approvedAt: now }, entry: { ...entry, at: now } }))
  })

  it('stops an alert with a field the app never writes', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert: { ...alert, checkedByModel: true }, entry }))
  })

  it('stops an alert missing a field', async () => {
    const { alert, entry } = pair()
    const { edited: _edited, ...missing } = alert
    await assertFails(save(officerDb(), { alert: missing, entry }))
  })

  it('stops an alert saved under another household’s or area’s ID', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, alertId: 'fishers__purok-ilaya' } }, { alertId: 'fishers__purok-ilaya' }))
  })

  it('stops an unknown household', async () => {
    const { alert, entry } = pair(OFFICER, { household: 'tourists' })
    await assertFails(save(officerDb(), { alert, entry: { ...entry, alertId: 'tourists__purok-ilaya' } }, { alertId: 'tourists__purok-ilaya' }))
  })

  it('stops a signal number that is not the area’s signal in the fact sheet', async () => {
    await assertFails(save(officerDb(), pair(OFFICER, { signal: 2 })))
  })

  it('stops an area that is not in the fact sheet', async () => {
    const { alert, entry } = pair(OFFICER, { area: 'Purok 9', areaKey: 'purok-9' })
    await assertFails(save(officerDb(), { alert, entry: { ...entry, alertId: 'general__purok-9' } }, { alertId: 'general__purok-9' }))
  })

  it('stops an area key that is not lower-case words joined by dashes', async () => {
    const { alert, entry } = pair(OFFICER, { areaKey: 'Purok Ilaya' })
    await assertFails(save(officerDb(), { alert, entry: { ...entry, alertId: 'general__Purok Ilaya' } }, { alertId: 'general__Purok Ilaya' }))
  })

  it('stops alert text longer than the limit', async () => {
    await assertFails(save(officerDb(), pair(OFFICER, { text: 'a'.repeat(LIMITS.text + 1) })))
  })

  it('allows alert text right at the limit', async () => {
    await assertSucceeds(save(officerDb(), pair(OFFICER, { text: 'a'.repeat(LIMITS.text) })))
  })

  it('stops empty alert text', async () => {
    await assertFails(save(officerDb(), pair(OFFICER, { text: '' })))
  })

  it('stops alert text that is not a string', async () => {
    await assertFails(save(officerDb(), pair(OFFICER, { text: 42 })))
  })

  it('stops an unknown source', async () => {
    await assertFails(save(officerDb(), pair(OFFICER, { source: 'officer' })))
  })

  it('stops a bulletin longer than the limit', async () => {
    const factSheet = { ...approval().record.factSheet, bulletinText: 'a'.repeat(LIMITS.bulletinText + 1) }
    await assertFails(save(officerDb(), pair(OFFICER, { factSheet })))
  })

  it('stops a fact sheet with a field the app never writes', async () => {
    const factSheet = { ...approval().record.factSheet, verifiedByModel: true }
    await assertFails(save(officerDb(), pair(OFFICER, { factSheet })))
  })

  it('stops a landfall time that is not 24-hour HH:MM', async () => {
    const factSheet = { ...approval().record.factSheet, landfallTime: '6:00 PM' }
    await assertFails(save(officerDb(), pair(OFFICER, { factSheet })))
  })

  it('stops a fact sheet with no evacuation centre', async () => {
    const factSheet = { ...approval().record.factSheet, evacuationCentres: [] }
    await assertFails(save(officerDb(), pair(OFFICER, { factSheet })))
  })

  it('allows a fact sheet with no landfall date', async () => {
    const { landfallDate: _date, ...factSheet } = approval().record.factSheet
    await assertSucceeds(save(officerDb(), pair(OFFICER, { factSheet })))
  })
})

describe('the ledger entry that goes with each alert', () => {
  it('stops an alert saved the old way, with no ledger entry', async () => {
    const { ledgerId: _ledgerId, ...alert } = pair().alert
    await assertFails(save(officerDb(), { alert }))
  })

  it('stops an alert pointing at an entry that is not written with it', async () => {
    await assertFails(save(officerDb(), { alert: pair().alert }))
  })

  it('stops an entry written without its alert', async () => {
    await seedApproval()
    await assertFails(save(officerDb(), { entry: pair().entry }))
  })

  it('stops an entry written alone for an alert that already points at its ID', async () => {
    await seedApproval(LEDGER_ID)
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), LEDGER, LEDGER_ID)))
    await assertFails(save(officerDb(), { entry: pair().entry }))
  })

  it('stops an alert pointing back at an earlier entry instead of a new one', async () => {
    await seedApproval()
    await assertFails(save(officerDb(), { alert: pair(OFFICER, {}, OLD_LEDGER_ID).alert }))
  })

  it('stops an entry whose text differs from the alert', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, text: GOOD_DRAFT.replace('6 PM', '6:00 PM') } }))
  })

  it('stops an entry whose fact sheet differs from the alert', async () => {
    const { alert, entry } = pair()
    const factSheet = { ...approval().record.factSheet, hotline: '0917 555 0199' }
    await assertFails(save(officerDb(), { alert, entry: { ...entry, factSheet } }))
  })

  it('stops an entry naming a different model from the alert', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, source: 'in_cloud' } }))
  })

  it('stops an entry that hides the officer’s edit', async () => {
    const { alert, entry } = pair(OFFICER, { edited: true })
    await assertFails(save(officerDb(), { alert, entry: { ...entry, edited: false } }))
  })

  it('stops an entry recording a different alert', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, alertId: 'seniors__purok-ilaya' } }))
  })

  it('stops an entry stamped with the laptop clock', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, at: Timestamp.now() } }))
  })

  it('stops an entry naming someone else as the officer', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, by: OTHER_OFFICER } }))
  })

  it('stops an entry with a field the app never writes', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, verifiedByModel: true } }))
  })

  it('stops an entry missing its drafts', async () => {
    const { alert, entry } = pair()
    const { drafts: _drafts, ...missing } = entry
    await assertFails(save(officerDb(), { alert, entry: missing }))
  })

  it('stops a kind of entry the rules don’t allow yet', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, kind: 'translated' } }))
  })

  it('stops more drafts than the limit', async () => {
    const { alert, entry } = pair()
    const drafts = Array.from({ length: LEDGER_LIMITS.drafts + 1 }, () => TRAIL.drafts[0])
    await assertFails(save(officerDb(), { alert, entry: { ...entry, drafts } }))
  })

  it('allows drafts right at the limit', async () => {
    const { alert, entry } = pair()
    const drafts = Array.from({ length: LEDGER_LIMITS.drafts }, () => TRAIL.drafts[0])
    await assertSucceeds(save(officerDb(), { alert, entry: { ...entry, drafts } }))
  })

  it('stops an entry with no claim words', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, claimWords: [] } }))
  })

  it('stops a negative count of drafts left out', async () => {
    const { alert, entry } = pair()
    await assertFails(save(officerDb(), { alert, entry: { ...entry, draftsOmitted: -1 } }))
  })

  it('stops a ledger ID the app would never make', async () => {
    const { alert, entry } = pair(OFFICER, {}, 'not-an-auto-id')
    await assertFails(save(officerDb(), { alert, entry }, { ledgerId: 'not-an-auto-id' }))
  })
})

describe('reading and changing the ledger', () => {
  it('lets an officer read the latest entries, newest first', async () => {
    await seedApproval()
    await assertSucceeds(getDocs(query(collection(officerDb(), LEDGER), orderBy('at', 'desc'), limit(LEDGER_PAGE))))
  })

  it('does not let a Google user who is not on the list read the ledger', async () => {
    await seedApproval()
    await assertFails(getDocs(collection(strangerDb(), LEDGER)))
  })

  it('does not let an anonymous resident read the ledger', async () => {
    await seedApproval()
    await assertFails(getDoc(doc(residentDb(), LEDGER, OLD_LEDGER_ID)))
  })

  it('does not let a visitor read the ledger', async () => {
    await seedApproval()
    await assertFails(getDocs(collection(visitorDb(), LEDGER)))
  })

  it('does not let an officer change an entry', async () => {
    await seedApproval()
    await assertFails(updateDoc(doc(officerDb(), LEDGER, OLD_LEDGER_ID), { text: 'Changed.' }))
  })

  it('does not let an officer overwrite an entry, even with its alert', async () => {
    await seedApproval()
    await assertFails(save(officerDb(), pair(OFFICER, {}, OLD_LEDGER_ID), { ledgerId: OLD_LEDGER_ID }))
  })

  it('does not let an officer delete an entry', async () => {
    await seedApproval()
    await assertFails(deleteDoc(doc(officerDb(), LEDGER, OLD_LEDGER_ID)))
  })
})

const WITHDRAWAL_ID = 'WithdrawWithdraw0001'

/**
 * The alert's withdrawal field and the ledger entry withdrawAlert() writes
 * for the alert seedApproval() saves, with `withdrawal` and `entry` changed.
 */
function withdrawalPair(
  uid = OFFICER,
  changes: { withdrawal?: Doc; entry?: Doc } = {},
  /** The approval the alert points at; null for an alert saved before the ledger. */
  approvalId: string | null = OLD_LEDGER_ID,
  reason = 'Sent for the wrong area.',
): { withdrawal: Doc; entry: Doc } {
  const saved = readSavedAlert(ALERT_ID, { ...approval().record, ledgerId: approvalId ?? undefined }, undefined, false)
  if (!saved) throw new Error('The seeded alert is not one the app can read.')
  const writes = withdrawalWrites(saved, WITHDRAWAL_ID, reason)
  if (!writes.ok) throw new Error(writes.reason)
  return {
    withdrawal: { ...writes.withdrawal, by: uid, at: serverTimestamp(), ...changes.withdrawal },
    entry: { ...writes.entry, by: uid, at: serverTimestamp(), ...changes.entry },
  }
}

/** Commits the withdrawal and its entry in one batch, as withdrawAlert() does. Leave one out to write the other alone. */
function withdraw(db: TestDb, docs: { withdrawal?: Doc; entry?: Doc; alsoChange?: Doc }, ledgerId = WITHDRAWAL_ID) {
  const batch = writeBatch(db)
  if (docs.withdrawal) batch.update(doc(db, ALERTS, ALERT_ID), { withdrawal: docs.withdrawal, ...docs.alsoChange })
  if (docs.entry) batch.set(doc(db, LEDGER, ledgerId), docs.entry)
  return batch.commit()
}

/** Withdraws the seeded alert with the rules off, as an earlier withdrawal. */
async function seedWithdrawal(ledgerId = 'OldWithdrawal0000001') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const at = Timestamp.fromMillis(Date.now() - 30_000)
    const { withdrawal, entry } = withdrawalPair()
    await updateDoc(doc(db, ALERTS, ALERT_ID), { withdrawal: { ...withdrawal, ledgerId, at } })
    await setDoc(doc(db, LEDGER, ledgerId), { ...entry, at })
  })
}

describe('withdrawing a saved alert with its ledger entry', () => {
  it('lets an officer withdraw an alert, with the entry built by withdrawalWrites()', async () => {
    await seedApproval()
    await assertSucceeds(withdraw(officerDb(), withdrawalPair()))
  })

  it('lets another officer withdraw an alert they didn’t approve', async () => {
    await seedApproval()
    await assertSucceeds(withdraw(officerDb(OTHER_OFFICER), withdrawalPair(OTHER_OFFICER)))
  })

  it('lets an officer withdraw an alert saved before the ledger, with no approval to point at', async () => {
    await seedAlertBeforeLedger()
    await assertSucceeds(withdraw(officerDb(), withdrawalPair(OFFICER, {}, null)))
  })

  it('allows a reason right at the limit', async () => {
    await seedApproval()
    await assertSucceeds(withdraw(officerDb(), withdrawalPair(OFFICER, {}, OLD_LEDGER_ID, 'x'.repeat(LEDGER_LIMITS.reason))))
  })

  it('stops a Google user who is not on the officer list', async () => {
    await seedApproval()
    await assertFails(withdraw(strangerDb(), withdrawalPair(STRANGER)))
  })

  it('stops an anonymous user even if their ID is on the officer list', async () => {
    await seedApproval()
    await assertFails(withdraw(residentDb(), withdrawalPair(RESIDENT)))
  })

  it('stops a visitor who is not signed in', async () => {
    await seedApproval()
    await assertFails(withdraw(visitorDb(), withdrawalPair()))
  })

  it('stops withdrawing an alert that is already withdrawn', async () => {
    await seedApproval()
    await seedWithdrawal()
    await assertFails(withdraw(officerDb(), withdrawalPair()))
  })

  it('stops a withdrawal that makes an alert where none is saved', async () => {
    const { withdrawal, entry } = withdrawalPair()
    const db = officerDb()
    const batch = writeBatch(db)
    batch.set(doc(db, ALERTS, ALERT_ID), { withdrawal }, { merge: true })
    batch.set(doc(db, LEDGER, WITHDRAWAL_ID), entry)
    await assertFails(batch.commit())
  })

  it('stops a withdrawal that also changes the alert’s text', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), { ...withdrawalPair(), alsoChange: { text: 'Signal No. 1 only. Stay home.' } }))
  })

  it('stops a withdrawal that also changes another field of the alert', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), { ...withdrawalPair(), alsoChange: { edited: true } }))
  })

  it('stops a withdrawal with no ledger entry', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), { withdrawal: withdrawalPair().withdrawal }))
  })

  it('stops a withdrawal entry written without the withdrawal', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), { entry: withdrawalPair().entry }))
  })

  it('stops a withdrawal pointing at an entry that is not written with it', async () => {
    await seedApproval()
    const { withdrawal, entry } = withdrawalPair(OFFICER, { withdrawal: { ledgerId: 'SomeOtherEntry000001' } })
    await assertFails(withdraw(officerDb(), { withdrawal, entry }))
  })

  it('stops a second entry written in the same batch as a withdrawal', async () => {
    await seedApproval()
    const { withdrawal, entry } = withdrawalPair()
    const db = officerDb()
    const batch = writeBatch(db)
    batch.update(doc(db, ALERTS, ALERT_ID), { withdrawal })
    batch.set(doc(db, LEDGER, WITHDRAWAL_ID), entry)
    batch.set(doc(db, LEDGER, 'SecondEntrySecond001'), entry)
    await assertFails(batch.commit())
  })

  it('stops a withdrawal entry written alone for an alert that already points at its ID', async () => {
    await seedApproval()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const withdrawal = { ledgerId: WITHDRAWAL_ID, by: OFFICER, at: Timestamp.now() }
      await updateDoc(doc(ctx.firestore(), ALERTS, ALERT_ID), { withdrawal })
    })
    await assertFails(withdraw(officerDb(), { entry: withdrawalPair().entry }))
  })

  it('stops one entry recording the withdrawal of two alerts', async () => {
    await seedApproval()
    // A second alert that matches the entry in all but its ID, as a hand edit could make.
    const twinId = 'general__purok-ilaya-2'
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { alert } = pair(OFFICER, {}, OLD_LEDGER_ID)
      await setDoc(doc(ctx.firestore(), ALERTS, twinId), { ...alert, areaKey: 'purok-ilaya-2', approvedAt: Timestamp.now() })
    })
    const { withdrawal, entry } = withdrawalPair()
    const db = officerDb()
    const batch = writeBatch(db)
    batch.update(doc(db, ALERTS, ALERT_ID), { withdrawal })
    batch.update(doc(db, ALERTS, twinId), { withdrawal })
    batch.set(doc(db, LEDGER, WITHDRAWAL_ID), entry)
    await assertFails(batch.commit())
  })

  it('stops a withdrawal pointing back at an earlier entry', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), { withdrawal: withdrawalPair(OFFICER, { withdrawal: { ledgerId: OLD_LEDGER_ID } }).withdrawal }))
  })

  it('stops a withdrawal pointing at an entry ID the app would never make', async () => {
    await seedApproval()
    const { withdrawal, entry } = withdrawalPair(OFFICER, { withdrawal: { ledgerId: 'not-an-auto-id' } })
    await assertFails(withdraw(officerDb(), { withdrawal, entry }, 'not-an-auto-id'))
  })

  it('stops an officer naming someone else as the one who withdrew it', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OTHER_OFFICER)))
  })

  it('stops an officer setting the withdrawal time from the laptop clock', async () => {
    await seedApproval()
    const now = Timestamp.now()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { withdrawal: { at: now }, entry: { at: now } })))
  })

  it('stops a withdrawal with a field the app never writes', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { withdrawal: { reason: 'On the alert.' } })))
  })

  it('stops an entry with an empty reason', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { reason: '' } })))
  })

  it('stops an entry with a reason longer than the limit', async () => {
    await seedApproval()
    const reason = 'x'.repeat(LEDGER_LIMITS.reason + 1)
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { reason } })))
  })

  it('stops an entry whose text differs from the alert’s', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { text: 'Another alert.' } })))
  })

  it('stops an entry naming a different household or area from the alert’s', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { household: 'fishers' } })))
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { area: 'Purok 2' } })))
  })

  it('stops an entry recording a different alert', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { alertId: 'fishers__purok-ilaya' } })))
  })

  it('stops an entry naming an approval other than the alert’s', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { approvalId: LEDGER_ID } })))
  })

  it('stops a withdrawal made before another officer’s new approval reached the server', async () => {
    await seedApproval()
    await save(officerDb(OTHER_OFFICER), pair(OTHER_OFFICER))
    await assertFails(withdraw(officerDb(), withdrawalPair()))
  })

  it('stops an entry claiming no approval for an alert that has one', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { approvalId: '' } })))
  })

  it('stops an entry with a field the app never writes', async () => {
    await seedApproval()
    await assertFails(withdraw(officerDb(), withdrawalPair(OFFICER, { entry: { notifyResidents: true } })))
  })

  it('stops an entry missing its reason', async () => {
    await seedApproval()
    const { withdrawal, entry } = withdrawalPair()
    const { reason: _reason, ...noReason } = entry
    await assertFails(withdraw(officerDb(), { withdrawal, entry: noReason }))
  })

  it('stops an approval entry written with a withdrawal', async () => {
    await seedApproval()
    const { withdrawal } = withdrawalPair()
    await assertFails(withdraw(officerDb(), { withdrawal, entry: pair(OFFICER, {}, WITHDRAWAL_ID).entry }))
  })
})

describe('after a withdrawal', () => {
  it('lets an officer approve a new alert, which clears the withdrawal', async () => {
    await seedApproval()
    await seedWithdrawal()
    await assertSucceeds(save(officerDb(), pair()))
    const after = await getDoc(doc(officerDb(), ALERTS, ALERT_ID))
    if (after.get('withdrawal') !== undefined) throw new Error('The new approval kept the withdrawal.')
  })

  it('stops an approval that keeps the withdrawal', async () => {
    await seedApproval()
    await seedWithdrawal()
    const { alert, entry } = pair()
    const withdrawal = { ledgerId: 'OldWithdrawal0000001', by: OFFICER, at: Timestamp.now() }
    await assertFails(save(officerDb(), { alert: { ...alert, withdrawal }, entry }))
  })

  it('stops an officer removing the withdrawal without a new approval', async () => {
    await seedApproval()
    await seedWithdrawal()
    await assertFails(updateDoc(doc(officerDb(), ALERTS, ALERT_ID), { withdrawal: deleteField() }))
  })

  it('does not let an officer change a withdrawal entry', async () => {
    await seedApproval()
    await seedWithdrawal()
    await assertFails(updateDoc(doc(officerDb(), LEDGER, 'OldWithdrawal0000001'), { reason: 'A better reason.' }))
  })

  it('does not let an officer delete a withdrawal entry', async () => {
    await seedApproval()
    await seedWithdrawal()
    await assertFails(deleteDoc(doc(officerDb(), LEDGER, 'OldWithdrawal0000001')))
  })
})

describe('reading and deleting alerts', () => {
  it('lets an officer read the saved alerts', async () => {
    await seedApproval()
    await assertSucceeds(getDocs(collection(officerDb(), ALERTS)))
  })

  it('does not let a Google user who is not on the list read alerts yet', async () => {
    await seedApproval()
    await assertFails(getDoc(doc(strangerDb(), ALERTS, ALERT_ID)))
  })

  it('does not let an anonymous resident read alerts yet', async () => {
    await seedApproval()
    await assertFails(getDocs(collection(residentDb(), ALERTS)))
  })

  it('does not let a visitor read alerts', async () => {
    await seedApproval()
    await assertFails(getDocs(collection(visitorDb(), ALERTS)))
  })

  it('does not let an officer delete a saved alert', async () => {
    await seedApproval()
    await assertFails(deleteDoc(doc(officerDb(), ALERTS, ALERT_ID)))
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
    await assertFails(setDoc(doc(officerDb(), 'translations', 'entry-1'), { note: 'not allowed yet' }))
  })
})
