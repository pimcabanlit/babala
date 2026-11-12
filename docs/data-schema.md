# Data Schema v1

The data contract for Babala: bulletin, fact sheet, draft, check result, saved alert. Every alert is checked against one fact sheet, which the officer confirms from the bulletin. All data is fictional: the storm, barangay, puroks, evacuation centres and hotline in the demo don't exist.

## Design principles

- **Facts come from the bulletin, never from a model.** Plain code reads the bulletin into a fact sheet, and the officer confirms every fact. A fact the parser misses is typed in by the officer, never guessed by a model.
- **The checker compares, it doesn't judge.** Every figure and place in a draft must be in the fact sheet. Words that add severity, safety, timing or authority are allowed only when the bulletin itself uses them.
- **One normalized form per figure.** "6 PM", "6:00 p.m.", "18:00" and "alas-6 ng gabi" are the same time. "+63 917…" is the same phone number as "0917…".
- **The saved alert carries its own evidence.** It is saved with the confirmed fact sheet, the bulletin text included, so it can be re-checked later. It also records which model wrote it, whether the officer edited it, and who approved it when.
- **Same document from the app and the rules tests.** `approvedAlert()` builds the Firestore document, and `tests/rules/` saves exactly that document against `firestore.rules`.

## Conventions

| Convention | Rule |
| --- | --- |
| Time | 24-hour `HH:MM` in the fact sheet (`18:00`). Drafts and prompts write it as `6:00 PM` |
| Date | As the bulletin writes it (`Nov 14`, `14 November`); compared as month and day (`11-14`) |
| Phone | Compared by digits only. A 12-digit number starting `63` equals the same number with a leading `0` |
| Area key | The area in lower case with accents dropped, and every other run of characters turned into one dash: `Purok Niño 2` becomes `purok-nino-2` |
| Alert ID | `{household}__{areaKey}`, two underscores: `general__purok-ilaya` |
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

`checkDraft(text, sheet, options)` checks an English draft against rules 1 to 6. `checkTranslation(approvedEnglish, translation, sheet)` checks a translation against rule 7. Both return `{pass, issues}`, where `pass` is true only when there are no issues.

**Options:**

| Option | Default | Meaning |
| --- | --- | --- |
| `claimWords` | — (required) | The rule 5 word list, from Remote Config |
| `area` | none | The alert's area. Its signal number is the required one |
| `required` | signal, time, place, hotline | Facts this household's alert must include |
| `maxSentences` | 3 | Rule 6 |
| `maxWords` | 60 | Rule 6 |

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
6. **Plain and short.** At most 3 sentences or 60 words, with no emojis, no Markdown, and only Latin letters and the digits 0 to 9. The script rule was added Nov 12 (PR #16) after Nano wrote the Hindi word "कृपया" into an English alert on the laptop and it passed. Filipino and Cebuano use Latin letters too, so translations are held to the same rule.
7. **Translations keep the facts.** Every figure and place name in a translation is identical to the approved English alert.

More detail on each rule:

- **Figures it reads:**
  - times: "6 PM", "6 p.m.", "six PM", "18:00", "1800H", noon and midnight;
  - Filipino and Cebuano times: "alas-6 ng gabi", "alas-sais ng gabi";
  - dates such as "Nov 14" and "14 November";
  - "Signal No. 3" in several spellings ("Signal #3", "TCWS No. 3", "Signal No. Three");
  - phone numbers by their digits;
  - any other number, including "185km/h" and "1,000".

  A short hotline such as "911" may also appear as a plain number. Numbers inside known place names ("Purok 2") and list markers at the start of a line ("1.") are not figures. A list marker is reported once, by rule 6, as formatting.
- **Where to go:** a venue word ("gym", "school", "church", "hall" and so on) outside a known centre name is flagged. So is a known name with a word in front that changes it ("municipal school gym"). "Purok …" and "Barangay …" must be ones the fact sheet covers. "Barangay Captain" and other titles are people, not places; the claim-word list covers them.
- **Added claims:** the word list is the Remote Config parameter `checker_claim_words`, a JSON array of strings. Its defaults are in `src/config/defaults.ts`, built from the Nov 12 drafts and grouped as severity, hazards, safety and reassurance, timing not stated as a time, and authority. A word is allowed when the bulletin itself uses it, and plurals match.
- **Signal and hotline:** the household's area sets which signal number is required. A bulletin with no hotline doesn't require one.
- **Placeholders are reported once.** They aren't reported again as unknown places.
- **Known limits:**
  - The claim words are English, so translations are held to exact figures and place names instead.
  - Spelled-out numbers are read only for hours and signal numbers.
  - The only allowed time is the landfall time, so a bulletin with other times needs them added to the fact sheet first.

## Firestore

Database `(default)`, Standard edition, asia-southeast1. The rules are in `firestore.rules`, which also describes this model in a comment block. Everything not listed here is denied.

**`officers/{uid}`.** Who may use the officer console.

| Field | Type | Notes |
| --- | --- | --- |
| (document ID) | string | The officer's Firebase Auth user ID |
| name | string | Set by hand in the Firebase console. Only the document's existence matters |

Each signed-in user may read only their own entry. Nobody writes the list from the app.

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

**Access:**

- Officers may read alerts, and create or update them with exactly these fields.
- Nobody may delete an alert from the app.
- Residents have no access yet. They get read access with the resident view (Phase 3).

**In the console** a saved alert is read back as `SavedAlert`: id, household, area, text, source, edited, approval time (the laptop's estimate while the save waits to upload) and `pending` (saved on the laptop, not yet uploaded). A document the app can't read is listed by ID as unreadable.

## Remote Config

| Parameter | Type | Default (`src/config/defaults.ts`) | Read as |
| --- | --- | --- | --- |
| `cloud_model_name` | string | `gemini-3.5-flash-lite` | An empty value uses the default |
| `ondevice_budget_seconds` | number | 30 | Zero or less uses the default |
| `checker_claim_words` | string (JSON array of strings) | `CHECKER_CLAIM_WORDS` | Anything other than an array of non-empty strings uses the default |

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

Attempts are not saved to Firestore. "Copy test log" turns them into plain text. The ledger (Phase 2) will keep them.

## Not defined yet

These get a schema when they are built. Nothing is stored for them today.

| Data | Phase |
| --- | --- |
| Ledger entries: each draft, check, approval and translation, with the model and time | 2 |
| Translations of an approved alert, per language | 3 |
| The resident's saved choice of purok and household, and the offline alert pack | 3 |

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
  "approvedAt": "<server time>"
}
```

Its Filipino translation (`GOOD_FILIPINO`) passes rule 7, because it keeps every figure and place name:

> Nakataas ang Signal No. 3 sa Purok Ilaya. Inaasahang tatama ang bagyo sa alas-6 ng gabi sa Nov 14, kaya lumikas na sa Halimbawa Elementary School gym. Para sa tulong, tumawag sa 0917 555 0100.
