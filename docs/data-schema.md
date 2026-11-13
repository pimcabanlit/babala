# Data Schema v1

The data contract for Babala: bulletin, fact sheet, draft, check result, saved alert and ledger. Every alert is checked against one fact sheet, which the officer confirms from the bulletin. All data is fictional: the storm, barangay, puroks, evacuation centres and hotline in the demo don't exist.

## Design principles

- **Facts come from the bulletin, never from a model.** Plain code reads the bulletin into a fact sheet, and the officer confirms every fact. A fact the parser misses is typed in by the officer, never guessed by a model.
- **The checker compares, it doesn't judge.** Every figure and place in a draft must be in the fact sheet. Words that add severity, safety, timing or authority are allowed only when the bulletin itself uses them.
- **One normalized form per figure.** "6 PM", "6:00 p.m.", "18:00" and "alas-6 ng gabi" are the same time. "+63 917…" is the same phone number as "0917…".
- **The saved alert carries its own evidence.** It is saved with the confirmed fact sheet, the bulletin text included, so it can be re-checked later. It also records which model wrote it, whether the officer edited it, and who approved it when.
- **No alert without its record.** Each approval also writes a locked ledger entry with the drafts behind it, in the same batch, and so does each withdrawal, with its reason, and each published translation, with the English it was checked against. The rules refuse one without the other, and nobody can change or delete an entry.
- **Same documents from the app and the rules tests.** `approvedAlert()` and `approvalWrites()` build the Firestore documents, and `tests/rules/` saves exactly those documents against `firestore.rules`.

## Conventions

| Convention | Rule |
| --- | --- |
| Time | 24-hour `HH:MM` in the fact sheet (`18:00`). Drafts and prompts write it as `6:00 PM` |
| Date | As the bulletin writes it (`Nov 14`, `14 November`); compared as month and day (`11-14`) |
| Phone | Compared by digits only. A 12-digit number starting `63` equals the same number with a leading `0` |
| Area key | The area in lower case with accents dropped, and every other run of characters turned into one dash: `Purok Niño 2` becomes `purok-nino-2` |
| Alert ID | `{household}__{areaKey}`, two underscores: `general__purok-ilaya` |
| Ledger ID | A 20-character Firestore auto ID made on the laptop, so it works offline: `AbCdEfGhIjKlMnOpQrSt` |
| Household IDs | `general`, `seniors`, `families`, `fishers` |
| Source | Which model wrote the approved text: `on_device`, `in_cloud`, `none` (the officer typed it) or `unknown` (the SDK didn't say) |
| Decimals | A decimal uses a point, as in the Philippines; thousands may use commas (`1,000`) |

## Bulletin (demo format)

The officer pastes the bulletin as text. `parseBulletin()` (`src/factsheet/parse.ts`) reads the demo format with plain code:

| Fact | What the parser looks for |
| --- | --- |
| Storm name | "Typhoon", "Super Typhoon", "Tropical Storm", "Severe Tropical Storm" or "Tropical Depression", then a capitalised name |
| Signal per area | A sentence with a signal number ("Signal No. 3", "TCWS No. 2") and "over", "for" or "in", then a list of areas. A trailing "of Barangay …" is dropped |
| Landfall time and date | The first sentence that says "landfall" |
| Evacuation centres | The first sentence with "evacuate to" (or "evacuation to"), split on commas, "and" and "or" |
| Puroks | Every "Purok" plus a number or a capitalised name |
| Barangays | Every "Barangay" or "Brgy." plus a capitalised name, except when it starts an evacuation centre's name ("Barangay Hall") |
| Hotline | "hotline", then a phone number |
| Other figures | Every other number outside those names, such as wind speed and surge height |

The parser also returns `notFound`, which can list: storm name, signal numbers, landfall time, evacuation centres and hotline.

The demo bulletin (`src/checker/fixtures/halimbawa.ts`):

```text
DEMO BULLETIN (fictional). Typhoon Sample.
Tropical Cyclone Wind Signal No. 3 is raised over Purok 1 and Purok Ilaya of Barangay Halimbawa.
Signal No. 2 is raised over Purok 2.
Typhoon Sample is expected to make landfall at 6:00 PM on Nov 14 with maximum winds of 185 km/h.
Strong winds and storm surge of up to 2 meters are possible in coastal puroks.
Residents must evacuate to Halimbawa Elementary School gym or the Barangay Hall.
Hotline: 0917 555 0100.
```

## Fact sheet

The confirmed facts, as the officer approved them (`FactSheet` in `src/checker/types.ts`).

| Field | Type | Example | Notes |
| --- | --- | --- | --- |
| stormName | string | Typhoon Sample | |
| signals | list of {area: string, signal: number} | [{area: Purok Ilaya, signal: 3}, …] | Signal number per area. The alert's area sets which signal is required |
| landfallTime | string | 18:00 | 24-hour `HH:MM` |
| landfallDate | string, optional | Nov 14 | As written |
| evacuationCentres | list of string | [Halimbawa Elementary School gym, Barangay Hall] | Written as residents would read them |
| puroks | list of string | [Purok 1, Purok Ilaya, Purok 2] | |
| barangays | list of string | [Barangay Halimbawa] | |
| hotline | string | 0917 555 0100 | As written; may be empty |
| otherFigures | list of number, optional | [185, 2] | Any other figure the bulletin states |
| bulletinText | string | the bulletin | Claim words are allowed only if they appear here |

**The officer's form** (`FactSheetForm` in `src/factsheet/form.ts`) has one text box per fact:

- Signals are one `Area: number` per line (`Purok Ilaya: 3`).
- Lists (centres, puroks, barangays) are one item per line.
- The landfall time can be in any spelling the checker reads (`6:00 PM`, `18:00`).
- Other figures are separated by commas.

Converting the form back refuses:

- a malformed signal line, or no signals at all;
- a time it can't read;
- a date it can't read (an empty date is fine);
- no evacuation centre;
- an "other figure" that isn't a number.

## Household types

Defined in `src/drafting/households.ts`. Each type gets its own alert per area.

| id | Label | Speaks to | Advice in the prompt | Required facts |
| --- | --- | --- | --- | --- |
| general | General | all residents | Leave now | signal, time, place, hotline |
| seniors | Seniors | older residents and people with disabilities | Leave early, bring your medicines and ask a neighbour for help | signal, time, place, hotline |
| families | Families with kids | families with young children | Keep your children close and bring water and food | signal, time, place, hotline |
| fishers | Fishers | fishers and boat owners | Do not go out to sea, tie up your boats | signal, time, hotline |

## Draft answer

Both models answer in JSON that fits one schema (`ALERT_SCHEMA` in `src/drafting/structured.ts`). Code joins the fields into the alert, adding a full stop where a field has none, and the checker checks the joined text. If an answer isn't valid JSON, the raw text goes to the checker as it is.

| Field | Required | Description given to the model |
| --- | --- | --- |
| signal_and_landfall | yes | One sentence: the signal number, the area, and when the storm makes landfall |
| what_to_do_and_where_to_go | yes | One sentence: what to do, and which evacuation centre to go to |
| hotline | no | One sentence with the hotline number. Left out when the bulletin has no hotline |

## Check result

`checkDraft(text, sheet, options)` checks an English draft against rules 1 to 6. `checkTranslation(approvedEnglish, translation, sheet, options)` checks one translation against the approved English alert and its fact sheet: rule 7, with rules 2, 4 and 6. Both return `{pass, issues}`, where `pass` is true only when there are no issues.

**Options of `checkDraft`:**

| Option | Default | Meaning |
| --- | --- | --- |
| `claimWords` | — (required) | The rule 5 word list, from Remote Config |
| `area` | none | The alert's area. Its signal number is the required one |
| `required` | signal, time, place, hotline | Facts this household's alert must include |
| `maxSentences` | 3 | Rule 6 |
| `maxWords` | 60 | Rule 6 |

**Options of `checkTranslation`:**

| Option | Default | Meaning |
| --- | --- | --- |
| `claimWords` | — (required) | The rule 5 word list. An English claim word in a translation must be in the English alert too |
| `translatedClaims` | — (required) | This language's claim words, each with the English words that back it (rule 7), from Remote Config |
| `maxSentences` | 3 | Rule 6 |
| `maxWords` | 90 | Rule 6. Filipino and Cebuano run about a third longer than English |

`keptFacts(approvedEnglish, sheet)` lists the figures and place names in the English alert as written there: what a translation must keep. The translation prompt names them.

**Issue** (one per problem):

| Field | Type | Example |
| --- | --- | --- |
| rule | enum | `figures`, `places`, `missing`, `placeholders`, `added-claims`, `plain`, `translation` |
| subject | enum, optional | `time`, `landfall`, `date`, `signal`, `phone`, `number`, `place`, `hotline`, `venue`, `area`, `modifier`, `sentences`, `words`, `emoji`, `format`, `script` |
| message | string | “severe” is not in the bulletin. |
| span | {start, end, text}, optional | Where it is in the text, so the console can highlight it and the retry can quote it |

## Checker rules

No alert reaches a resident unless it passes every rule below and an officer approves it. The checker is plain TypeScript in `src/checker/`, with no Firebase, AI or UI imports. A model never decides a pass or a fail.

1. **Figures match.** Every number, time, date and signal number in the draft appears in the fact sheet. Times are compared in a standard form, so "6 PM", "6:00 PM" and "18:00" all count as the same time. The landfall time may only appear in a sentence about landfall ("landfall", "makes land", "hit", "strike"). So "declared at 6:00 PM" or "bring food by 6:00 PM" fails: right figure, wrong fact. Added Nov 12 after three such answers passed on the laptop.
2. **Places match.** Every evacuation centre, purok and barangay name matches the fact sheet's list.
3. **Nothing missing.** Each household type's alert includes its required facts: signal number, time, where to go and hotline.
4. **No placeholders.** Rejects brackets, "TBD", "XXX" and similar. It also rejects prompt wording copied into an alert ("Tell them to…", "Say that…").
5. **No added claims.** Flags severity and safety words that aren't in the bulletin, such as "severe", "super typhoon", "safe" or "no threat".
6. **Plain and short.** At most 3 sentences or 60 words, with no emojis, no Markdown, and only Latin letters and the digits 0 to 9. The script rule was added Nov 12 (PR #16) after Nano wrote the Hindi word "कृपया" into an English alert on the laptop and it passed. Filipino and Cebuano use Latin letters too, so translations are held to the same rule, with up to 90 words.
7. **Translations say what the English says.** Each translation is checked on its own against the approved English alert and its fact sheet, never against another translation. It has exactly the English alert's figures, none lost and none added; exactly its known place names, written as the fact sheet writes them; and no claim the English doesn't make. Rules 2, 4 and 6 apply to it too.

More detail on each rule:

- **Figures it reads:**
  - times: "6 PM", "6 p.m.", "six PM", "18:00", "1800H", noon and midnight;
  - Filipino and Cebuano times: "alas-6 ng gabi", "alas-sais ng gabi";
  - dates such as "Nov 14" and "14 November", and in translations "Nobyembre 14" and "ika-14 ng Nobyembre";
  - "Signal No. 3" in several spellings ("Signal #3", "TCWS No. 3", "Signal No. Three");
  - phone numbers by their digits;
  - any other number, including "185km/h" and "1,000".

  A short hotline such as "911" may also appear as a plain number. Numbers inside known place names ("Purok 2") and list markers at the start of a line ("1.") are not figures. A list marker is reported once, by rule 6, as formatting.
- **Where to go:** a venue word ("gym", "school", "church", "hall" and so on, and in translations "paaralan", "eskwelahan", "simbahan", "bulwagan" and others) outside a known centre name is flagged. So is a known name with a word in front that changes it ("municipal school gym"). "Purok …" and "Barangay …" must be ones the fact sheet covers. "Barangay Captain" and other titles are people, not places; the claim-word list covers them.
- **Added claims:** the word list is the Remote Config parameter `checker_claim_words`, a JSON array of strings. Its defaults are in `src/config/defaults.ts`, built from the Nov 12 drafts and grouped as severity, hazards, safety and reassurance, timing not stated as a time, and authority. A word is allowed when the bulletin itself uses it, and plurals match.
- **Claims in translations (rule 7):** an English claim word from rule 5's list is allowed in a translation only when the English alert has it. Each Filipino or Cebuano claim word comes with the English words that back it: "mapanganib" (dangerous) needs "danger", "dangerous" or a word like them in the English alert; "ngayong gabi" and "karong gabii" (tonight) need "tonight"; "ligtas" and "luwas" (safe) need "safe". Each language has its own list, in the Remote Config parameter `checker_translation_claims` (defaults in `TRANSLATION_CLAIMS`, `src/config/defaults.ts`), grouped like rule 5's: severity, hazards, safety, timing and authority. A longer phrase is judged before a word inside it, so "walang panganib" (no danger) is a safety claim, not "panganib" (danger). The lists were written by hand for the demo and need a fluent speaker's review.
- **Signal and hotline:** the household's area sets which signal number is required. A bulletin with no hotline doesn't require one.
- **Placeholders are reported once.** They aren't reported again as unknown places.
- **Known limits:**
  - A translation's claims are judged by word lists, so the checker can't read meaning: a negation ("huwag lumikas", do not evacuate) or a changed instruction with no claim word in it passes. That is why the officer reads and approves every translation before it is published.
  - The landfall time's meaning (rule 1) is checked in English only. A translation must have the same time, but the checker doesn't read whether its sentence is about landfall.
  - Spelled-out numbers are read only for hours and signal numbers.
  - The only allowed time is the landfall time, so a bulletin with other times needs them added to the fact sheet first.

## Firestore

Database `(default)`, Standard edition, asia-southeast1. The rules are in `firestore.rules`, which also describes this model in a comment block. Everything not listed here is denied.

**`officers/{uid}`.** Who may use the officer console.

| Field | Type | Notes |
| --- | --- | --- |
| (document ID) | string | The officer's Firebase Auth user ID: a Google account, or the judges' test officer (email and password) |
| name | string | Set by hand in the Firebase console. Only the document's existence matters |

Each signed-in user may read only their own entry. Nobody writes the list from the app. The rules count a listed user as an officer only when signed in with Google or with an email and password, never anonymously.

**`alerts/{household}__{areaKey}`.** One current approved alert per household type and area, replaced by the next approval. Written by `src/alerts/record.ts` and `src/alerts/store.ts`. The limits are the same in `LIMITS` in `record.ts` and in the rules.

| Field | Type | Limit or rule |
| --- | --- | --- |
| household | string | `general`, `seniors`, `families` or `fishers` |
| area | string | 1 to 80 characters, e.g. `Purok Ilaya` |
| areaKey | string | 1 to 80 characters of a-z, 0-9 and single dashes. The document ID must equal `household + "__" + areaKey` |
| signal | int | 1 to 5. `{area, signal}` must be in `factSheet.signals` |
| text | string | 1 to 1,000 characters: the alert exactly as the checker passed it, trimmed |
| factSheet | map | The confirmed fact sheet (below) |
| source | string | `on_device`, `in_cloud`, `none` or `unknown` |
| edited | bool | The officer changed the model's text, or typed it |
| approvedBy | string | Must equal the signed-in officer's user ID. No name or email |
| approvedAt | timestamp | Must equal the server's time of the write (`serverTimestamp()`) |
| ledgerId | string | The ID of the ledger entry written in the same batch, which must record this alert exactly (below) |
| withdrawal | map, optional | Added when an officer withdraws the alert (below). A new approval replaces the whole document, which clears it |

`factSheet` limits:

| Field | Limit |
| --- | --- |
| stormName | string, up to 100 |
| signals | list of {area, signal}, 1 to 30 |
| landfallTime | string `HH:MM`, 24-hour |
| landfallDate | optional string, 1 to 30 |
| evacuationCentres | list, 1 to 20 |
| puroks | list, up to 50 |
| barangays | list, up to 20 |
| hotline | string, up to 40 |
| otherFigures | list of numbers, up to 30 |
| bulletinText | string, up to 20,000 |

Rules can't loop over list items, so lists are limited in number only. Firestore's 1 MiB document limit bounds the rest. `approvedAlert()` refuses anything over these limits before saving, with a message the officer can act on.

**Withdrawing an alert** adds only the `withdrawal` map, and nothing else on the alert may change in that write. The alert keeps its text and approval fields, so the record of what was withdrawn stays on the alert too. An alert that is already withdrawn can't be withdrawn again; approving a new alert for the same household and area replaces it, withdrawn or not.

| `withdrawal` field | Type | Rule |
| --- | --- | --- |
| ledgerId | string | The ID of the `withdrawn` ledger entry written in the same batch |
| by | string | Must equal the signed-in officer's user ID |
| at | timestamp | Must equal the server's time of the write |

The reason is never on the alert or its resident copy. The reason never passes the checker, so it lives only in the ledger entry.

**Access:**

- Officers may read alerts, and create or update them with exactly these fields, together with a new ledger entry.
- Officers may withdraw an alert as above, together with a new `withdrawn` entry. Any officer may withdraw any alert, not only the one who approved it.
- Every approval and withdrawal also writes the alert's resident copy (below), in the same batch.
- Nobody may delete an alert from the app.
- Residents can't read alerts: they hold officers' user IDs and the bulletin. Residents read the resident copy instead.

**In the console** a saved alert is read back as `SavedAlert`: id, household, area, text, source, edited, approval time (the laptop's estimate while the save waits to upload), `pending` (saved on the laptop, not yet uploaded) `ledgerId`, `withdrawn` (the withdrawal's entry, who and when) once it is withdrawn, and `factSheet`, which translations are checked against (undefined if it can't be read). Alerts saved before the ledger have no `ledgerId`; they stay readable, they can be withdrawn, and the next approval adds one. A document the app can't read is listed by ID as unreadable.

**`residentAlerts/{household}__{areaKey}`.** What residents read: a copy of the alert with the same ID, with only what residents need. Written by `src/alerts/residentCopy.ts` (`activeCopy()`, `withdrawnCopy()`, through `approvalWrites()` and `withdrawalWrites()`) and `src/alerts/store.ts`, in the same batch as each approval and withdrawal. Firestore rules can't hide single fields from a reader, which is why residents get a separate document.

While the alert is current:

| Field | Type | Rule |
| --- | --- | --- |
| household, area, areaKey, signal, text | as in `alerts` | Equal to the alert's |
| stormName | string | The alert's `factSheet.stormName` |
| status | string | `active` |
| updatedAt | timestamp | The alert's `approvedAt` |

Once the alert is withdrawn, with no text:

| Field | Type | Rule |
| --- | --- | --- |
| household, area, areaKey | as in `alerts` | Equal to the alert's |
| status | string | `withdrawn` |
| updatedAt | timestamp | The alert's `withdrawal.at` |

**Translations.** An officer publishes a checked translation by adding it to a current copy, one language per write, with a `translated` ledger entry in the same batch (*`ledger`*, below). Nothing else on the copy may change in that write.

| Field | Type | Rule |
| --- | --- | --- |
| translations | map, optional | Keys `fil` (Filipino) and `ceb` (Cebuano) only, each optional |
| translations.{lang}.text | string | 1 to 1,500 characters: the translation exactly as the checker passed it and the officer approved it |
| translations.{lang}.ledgerId | string | The `translated` ledger entry written in the same batch, which must record this text. A random ID; residents can't read the ledger |

A new approval or a withdrawal replaces the whole copy, which clears them, so residents never get a translation of an English text that was replaced or withdrawn. A copy written on its own (the path for alerts saved before copies existed) may not drop published translations. The resident view reads only each translation's `text`, and shows English when there is none in the chosen language.

The rules hold a copy equal to `residentCopy()` of its alert as it is after the batch: an exact map comparison, so a copy has no other field, and never an officer's user ID, the ledger ID or the bulletin. An approval or withdrawal without its copy is refused. An officer may also write a copy on its own, which is how an alert saved before copies existed gets one; it must still equal the alert. Nobody may delete a copy.

**Access:** anyone signed in, anonymous residents included, may read a copy or list at most 200 of them (4 households for each of up to 30 areas, fetched in one read). Only officers write, as above.

**On the phone** the copies are read as `PackAlert` (`src/resident/pack.ts`) and the whole set is saved in local storage as the offline pack (`babala.pack.v1`), with the time it came from the server. The resident's purok, household and language are saved as `babala.choice.v1`. A copy the app can't read is left out and counted.

**`ledger/{entryId}`.** A locked record of every change to a saved alert: an `approved` entry for each approval, a `withdrawn` entry for each withdrawal and a `translated` entry for each published translation. Written by `src/ledger/record.ts` (`approvalWrites()`, `withdrawalWrites()`) and `src/alerts/store.ts` (`saveApprovedAlert()`, `withdrawAlert()`). The limits are the same in `LEDGER_LIMITS` in `src/ledger/record.ts` and in the rules.

An approval writes the alert and its entry in one batch:

- the alert's rules read the entry as it will be after the batch (`getAfter`), and require it to record this alert: same household, area, area key, signal, text, fact sheet, source and edited flag, with the approver as `by` and this request's time as `at`. An entry stamped with this request's time can only be a new one, so an alert can't point at an old entry;
- the entry's rules require the alert to be saved in the same batch (its `approvedAt` is this request's time) and to point at this entry;
- an entry can't be updated or deleted, so a later approval replaces the alert but keeps every earlier entry.

Fields of an `approved` entry:

| Field | Type | Limit or rule |
| --- | --- | --- |
| kind | string | `approved` |
| alertId | string | The alert this approval saved, `{household}__{areaKey}` |
| household, area, areaKey, signal, text, factSheet, source, edited | as in `alerts` | Equal to the alert's |
| cloudModel | string | Up to 100. The cloud model the console used (Remote Config `cloud_model_name`) |
| claimWords | list of strings | 1 to 500. The checker's rule 5 word list at approval, so the check can be repeated |
| drafts | list of maps | Up to 20. The model calls on the card since its last approval, oldest first (below) |
| draftsOmitted | int | 0 or more. Older drafts left out to stay within 20 |
| by | string | Must equal the signed-in officer's user ID. No name or email |
| at | timestamp | Must equal the server's time of the write |

Each item of `drafts` is one model call (`LedgerDraft`). Rules can't look inside list items, so the app clips the long text fields itself:

| Field | Type | Notes |
| --- | --- | --- |
| round | int | 1 for the card's first "Draft", 2 after "Draft again", and so on |
| route | string | `prefer_on_device` or `only_in_cloud` |
| retry | bool | The prompt quoted the last draft with an edit per problem |
| area | string | The area it was drafted for, usually the alert's own |
| source | string | `on_device`, `in_cloud` or `unknown`, as the SDK reported it |
| prompt | string | The exact prompt, cut at 6,000 characters |
| text | string | The answer's fields joined into the alert, as the checker saw it, cut at 2,000 |
| outcome | string | `passed` or `failed` (the checker's verdict), `error`, or `stopped` (the officer moved to the cloud after the budget) |
| issues | list of {rule, message} | The checker's problems in reading order, at most 30 |
| error | string | The error when the call threw, otherwise empty. Cut at 500 |
| startedAtMs | number | When the call started, by the laptop's clock |
| firstTextMs | number or null | Time to the first streamed text |
| totalMs | number | Time to the end of the call |

Which drafts an entry keeps: every model call on that household's card since the card's last approval, including earlier rounds the officer replaced with "Draft again". An approval after only a hand edit has no new drafts; the earlier entry has them. Drafts that never lead to an approval aren't saved, and stay in "Copy test log". Reading a new bulletin starts every card afresh.

A withdrawal writes the alert's `withdrawal` and its entry in one batch, checked the same way in both directions:

- the alert's rules require the entry, as it will be after the batch, to record this alert as it was: same alert ID, household, area and text, the approval it withdraws equal to the alert's `ledgerId` (or empty for an alert saved before the ledger), and the same officer and time as the withdrawal;
- the entry's rules require the alert's `withdrawal` to point at this entry, with this request's time.

So a withdrawal made offline against an alert that another officer has since replaced is refused when it uploads: its entry names the old approval. The console shows "Not withdrawn" with the error.

Fields of a `withdrawn` entry:

| Field | Type | Limit or rule |
| --- | --- | --- |
| kind | string | `withdrawn` |
| alertId | string | The alert withdrawn, `{household}__{areaKey}` |
| household, area, text | as in `alerts` | Equal to the alert's: the text that residents stop getting |
| approvalId | string | The alert's `ledgerId` before the withdrawal: the approval it withdraws. Empty for an alert saved before the ledger |
| reason | string | 1 to 300 characters, trimmed. The officer's reason, for the record only |
| by | string | Must equal the signed-in officer's user ID |
| at | timestamp | Must equal the server's time of the write |

A published translation writes its text on the resident copy and its `translated` entry in one batch (`translationWrites()` in `src/translation/record.ts`, `publishTranslation()` in `src/translation/store.ts`), checked the same way in both directions:

- the copy's rules read the entry as it will be after the batch, and require it to record this text in this language, against the alert's current text and approval (`approvalId` equal to the alert's `ledgerId`, `english` equal to its text), by this officer at this request's time, so it is a new entry. The alert must not be withdrawn;
- the entry's rules require the copy's translation in its language to point at this entry.

So a translation made while another officer replaced or withdrew the alert is refused when it uploads, and the console says "Not published" with the error.

Fields of a `translated` entry:

| Field | Type | Limit or rule |
| --- | --- | --- |
| kind | string | `translated` |
| alertId | string | The alert translated, `{household}__{areaKey}` |
| household, area | as in `alerts` | Equal to the alert's |
| lang | string | `fil` (Filipino) or `ceb` (Cebuano) |
| approvalId | string | The alert's `ledgerId`: the approval it translates |
| english | string | 1 to 1,000. The alert's text, which the checker compared it with |
| text | string | 1 to 1,500. The translation residents get, equal to the copy's |
| source | string | `in_cloud`, `none` (the officer typed it) or `unknown` |
| edited | bool | The officer changed the cloud's text, or typed it |
| cloudModel | string | Up to 100. The cloud model the console used |
| claimWords | list of strings | 1 to 500. Rule 5's English list at publication |
| translatedClaims | list of {words, english} | 1 to 100. This language's claim list at publication, so the check can be repeated |
| drafts | list of maps | Up to 20. The cloud calls for this alert and language since its last publication, oldest first, in the same shape as an approval's drafts (route `only_in_cloud`) |
| draftsOmitted | int | 0 or more |
| by | string | Must equal the signed-in officer's user ID |
| at | timestamp | Must equal the server's time of the write |

**Access:** officers may read the ledger, and create an `approved`, `withdrawn` or `translated` entry only as above. Nobody may update or delete an entry. Residents never read it: it holds prompts, reasons and officers' user IDs.

**Known limit:** the rules prove that an entry was written with its alert, by that officer, at that time, and that nobody changed it since. They can't prove what a model wrote: the drafts are what the officer's app reported, the same trust as the alert's `source`.

## Remote Config

| Parameter | Type | Default (`src/config/defaults.ts`) | Read as |
| --- | --- | --- | --- |
| `cloud_model_name` | string | `gemini-3.5-flash-lite` | An empty value uses the default |
| `ondevice_budget_seconds` | number | 30 | Zero or less uses the default |
| `checker_claim_words` | string (JSON array of strings) | `CHECKER_CLAIM_WORDS` | Anything other than an array of non-empty strings uses the default |
| `checker_translation_claims` | string (JSON object) | `TRANSLATION_CLAIMS` | `{"fil": [{"words": [...], "english": [...]}], "ceb": [...]}`. A missing language, an empty list or a claim without words or English words uses the whole default |

Fetched at most once an hour. Offline or on error, the app keeps the last fetched values, or the defaults.

## Draft attempts (in the console only)

Each model call in the console is an attempt (`Attempt` in `src/console/useDrafts.ts`). It records:

- the route (`prefer_on_device` or `only_in_cloud`) and whether it was a retry;
- the exact prompt, and when it started;
- time to first text and total time;
- the joined text and the raw answer;
- the source the SDK reported;
- pass or fail, with the checker's issues;
- an error, or whether the officer abandoned it for the cloud.

Each attempt also records the area it was drafted for. "Copy test log" turns them into plain text. When the officer approves, the attempts on that card since its last approval are saved in the ledger entry (`drafts`, above), without the raw JSON.

## Translation work (in the console only)

Each active saved alert has a box per language under *Saved alerts and translations* (`src/console/Translations.tsx`, `src/console/useTranslations.ts`). "Translate" makes one "only in cloud" call; nothing retries by itself. The answer is JSON with one field (`TRANSLATION_SCHEMA` in `src/translation/prompt.ts`); if it isn't, the raw text goes to the checker. The officer can edit the text or type one, and the checker runs on every change. Each call is recorded like a draft attempt (`LedgerDraft`) and saved in the `translated` entry on publication. Calls for an earlier approval of the alert are dropped once a new approval replaces it.

## Worked example

From the demo bulletin above, `parseBulletin()` gives this fact sheet, with nothing in `notFound` (it is the same as `SAMPLE_SHEET`, and a test checks that):

```json
{
  "stormName": "Typhoon Sample",
  "signals": [
    { "area": "Purok 1", "signal": 3 },
    { "area": "Purok Ilaya", "signal": 3 },
    { "area": "Purok 2", "signal": 2 }
  ],
  "landfallTime": "18:00",
  "landfallDate": "Nov 14",
  "evacuationCentres": ["Halimbawa Elementary School gym", "Barangay Hall"],
  "puroks": ["Purok 1", "Purok Ilaya", "Purok 2"],
  "barangays": ["Barangay Halimbawa"],
  "hotline": "0917 555 0100",
  "otherFigures": [185, 2],
  "bulletinText": "DEMO BULLETIN (fictional). Typhoon Sample. …"
}
```

The draft prompt for the General household in Purok Ilaya:

```text
Write a typhoon alert for all residents in Purok Ilaya, Barangay Halimbawa. Fill in each field with one sentence. You may reword these sentences a little, but keep every name, number and time exactly as written:
signal_and_landfall: Signal No. 3 is raised in Purok Ilaya, and Typhoon Sample makes landfall at 6:00 PM on Nov 14.
what_to_do_and_where_to_go: Leave now, and go to Halimbawa Elementary School gym or Barangay Hall.
hotline: Call the hotline, 0917 555 0100, for help.
Do not add other numbers, places, times or dates, and do not describe how strong the storm is. No emojis, no Markdown, no brackets.
```

A failing draft and what the checker says:

> Signal No. 3 is raised over Purok Ilaya, and a severe typhoon makes landfall at 6 PM tonight. Evacuate to the [School Name] gym. Call 0917 555 0100.

| Rule | Subject | Message |
| --- | --- | --- |
| placeholders | — | Placeholder “[School Name]” must be replaced with a real fact. |
| places | venue | “to the gym” is not an evacuation centre in the fact sheet. |
| missing | place | Missing where to go: name an evacuation centre from the fact sheet. |
| added-claims | — | “severe” is not in the bulletin. |
| added-claims | — | “tonight” is not in the bulletin. |

A missing fact makes the problem structural, so the retry gives the outline again with the remaining edits: "Remove “severe”; the bulletin doesn’t say it.", "Remove “tonight”; the bulletin doesn’t say it." and "Replace “[School Name]” with “Halimbawa Elementary School gym”."

A draft that passes (`GOOD_DRAFT`):

> Signal No. 3 is raised over Purok Ilaya. Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym. For help, call 0917 555 0100.

Approved as written from an on-device draft, it is saved as `alerts/general__purok-ilaya`:

```json
{
  "household": "general",
  "area": "Purok Ilaya",
  "areaKey": "purok-ilaya",
  "signal": 3,
  "text": "Signal No. 3 is raised over Purok Ilaya. Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym. For help, call 0917 555 0100.",
  "factSheet": { "…": "the fact sheet above" },
  "source": "on_device",
  "edited": false,
  "approvedBy": "<the officer's user ID>",
  "approvedAt": "<server time>",
  "ledgerId": "<the entry's ID>"
}
```

In the same batch, its entry `ledger/<the entry's ID>` records the same fields, plus the draft behind it:

```json
{
  "kind": "approved",
  "alertId": "general__purok-ilaya",
  "…": "household, area, areaKey, signal, text, factSheet, source and edited, as in the alert",
  "cloudModel": "gemini-3.5-flash-lite",
  "claimWords": ["…the checker's word list…"],
  "drafts": [
    {
      "round": 1,
      "route": "prefer_on_device",
      "retry": false,
      "area": "Purok Ilaya",
      "source": "on_device",
      "prompt": "Write a typhoon alert for all residents in Purok Ilaya, Barangay Halimbawa. …",
      "text": "Signal No. 3 is raised over Purok Ilaya. …",
      "outcome": "passed",
      "issues": [],
      "error": "",
      "startedAtMs": 1794700000000,
      "firstTextMs": 900,
      "totalMs": 15200
    }
  ],
  "draftsOmitted": 0,
  "by": "<the officer's user ID>",
  "at": "<server time>"
}
```

Its Filipino translation (`GOOD_FILIPINO`) passes rule 7, because it keeps every figure and place name and adds no claim:

> Nakataas ang Signal No. 3 sa Purok Ilaya. Inaasahang tatama ang bagyo sa alas-6 ng gabi sa Nov 14, kaya lumikas na sa Halimbawa Elementary School gym. Para sa tulong, tumawag sa 0917 555 0100.

So does its Cebuano translation (`GOOD_CEBUANO`), checked on its own against the same English:

> Gipataas ang Signal No. 3 sa Purok Ilaya. Gidahom nga motugpa ang bagyo sa alas-6 sa gabii sa Nov 14, busa bakwit na karon sa Halimbawa Elementary School gym. Para sa tabang, tawag sa 0917 555 0100.

A Filipino translation that says "ang mapanganib na bagyo" at "alas-7 ng gabi" fails with three problems: “mapanganib” (“danger”) is not in the English alert; “alas-7 ng gabi” is in the translation but not in the English alert; the translation lost “6 PM” from the English alert.

Once published, both are on the resident copy, `residentAlerts/general__purok-ilaya`:

```json
{
  "…": "household, area, areaKey, signal, stormName, text, status and updatedAt, as above",
  "translations": {
    "fil": { "text": "Nakataas ang Signal No. 3 sa Purok Ilaya. …", "ledgerId": "<the Filipino entry's ID>" },
    "ceb": { "text": "Gipataas ang Signal No. 3 sa Purok Ilaya. …", "ledgerId": "<the Cebuano entry's ID>" }
  }
}
```
