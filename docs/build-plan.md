# Build Plan

Solo build, Nov 12 to Nov 29, 2026 (Manila time). Submissions close Mon Nov 30, 2:00 PM PT, which is Tue Dec 1, 6:00 AM in Manila. The target is to submit on Sat Nov 29. Build what the video shows first; stretch goals come last.

How it works is in [architecture.md](architecture.md), the data and checker rules in [data-schema.md](data-schema.md), the Firebase setup in [firebase-setup.md](firebase-setup.md), and each contest rule against what is built in [requirements-map.md](requirements-map.md).

## Decisions already made

| Decision | Value |
| --- | --- |
| Project name | Babala (Filipino for "warning"). Other options considered: Hudyat ("signal"), Bantay ("watch") |
| Category | Web (Chrome): Gemini Nano through Firebase AI Logic. One platform |
| Users | A barangay disaster officer on a laptop in Chrome, and residents on any phone browser |
| Household types | General, Seniors, Families with kids, Fishers. Each gets its own alert. The Fishers alert doesn't need an evacuation centre (`src/drafting/households.ts`) |
| Demo data | Fictional only: Typhoon Sample over Barangay Halimbawa ("example"), with Purok 1, Purok Ilaya and Purok 2 (`src/checker/fixtures/halimbawa.ts`). Every page shows "Demo, not official guidance" |
| Firebase plan | Spark, with no billing account, so heavy use ends in quota errors rather than a bill. No Google Account Quota sprint accounts |
| Repo | Public, Apache-2.0, on Pim's own GitHub account |
| Target laptop | Acer Aspire 14 AI (Snapdragon X, 16 GB, Windows 11, Chrome). Gemini Nano runs at performance class **Low** |
| On-device job size | At most 3 sentences, streamed. After 30 s the console offers the cloud (Remote Config `ondevice_budget_seconds`) |
| Cloud model | `gemini-3.5-flash-lite` (Remote Config `cloud_model_name`). On Nov 12, `gemini-3.8-flash` returned "high demand" errors while flash-lite answered in 1 to 5 s |
| Draft shape | Both models answer in JSON with one field per sentence, using the same schema on both paths. Code joins the fields, and the checker checks the joined text |
| Routing limit | At most 3 AI calls per alert: one on-device draft, one on-device retry and one cloud call. There is never a second cloud call. After that, the officer edits by hand (`src/drafting/route.ts`) |
| Fact sheet | Plain code reads the demo bulletin format, and the officer confirms every fact. Reading free-form bulletins in the cloud is planned, not built |
| Checker | Eight rules in deterministic TypeScript, never a model ([data-schema.md](data-schema.md), *Checker rules*): rules 1 to 6 for drafts, rule 7 for translations, rule 8 for answers to residents' questions. The claim-word lists are in Remote Config (`checker_claim_words`, `checker_translation_claims`, `checker_answer_claims`) |
| Saved alerts | One current alert per household and area at `alerts/{household}__{areaKey}`, replaced by the next approval. The app can't delete them. An officer can withdraw one with a reason: the alert is marked withdrawn and keeps its text, and the reason is kept in the ledger only |
| Resident copy | Residents read `residentAlerts/{household}__{areaKey}`, never `alerts`: the alert's text, place, signal, storm and time, without officers' user IDs or the bulletin. It is written with every approval and withdrawal, the rules hold it equal to the alert, and a withdrawn alert's copy has no text |
| Ledger | One locked entry per approval or withdrawal at `ledger/{autoId}`, written in the same batch as the alert, with the drafts and checks behind an approval and the reason for a withdrawal. The rules refuse one without the other, and nothing can change or delete an entry. Officers only (`src/ledger/`) |
| Officers | Google sign-in, plus a document in `officers` that Pim adds by hand in the Firebase console. Judges share one test officer account, with an email and password, on the same list |
| Translations | Filipino and Cebuano, cloud only ("only in cloud" mode), because Nano writes only de, en, es, fr and ja. Each is checked on its own against the approved English (rule 7, with Filipino and Cebuano claim words in Remote Config), approved by an officer, and published on the resident copy with a `translated` ledger entry |
| Ask | A resident's question is answered on the device (Nano, English only, only when already downloaded), in the cloud (online, at most 6 cloud answers per phone per hour, Remote Config `ask_cloud_per_hour`), or by a no-AI text search of the saved alert. At most one call per route. An AI answer is shown only after rule 8 passes it, with the alert sentences it rests on quoted word for word. Questions aren't saved (`src/ask/`) |
| App Check | reCAPTCHA Enterprise (Fraud Defense), enforced on AI Logic, with limited-use tokens, and on Firestore (Nov 13). Classic reCAPTCHA is deprecated, so it isn't used |

## Phases

### Phase 1 — Setup and first hybrid call (Nov 12–13) · done

1. Firebase project `babala-hybrid` on Spark: AI Logic, App Check, Firestore, Authentication and Remote Config (done Nov 12; [firebase-setup.md](firebase-setup.md)).
2. Repo rules: build plan, `CLAUDE.md`, `REVIEW.md` with risk tiers and review rules, and the PR template (PRs #1–#6 and #14).
3. App skeleton: Vite, React, TypeScript (strict), Tailwind, oxlint, Vitest and the CI workflow (PR #7).
4. Firebase's official agent skills, vendored in `.claude/skills/` (PR #8).
5. Firebase, App Check and Remote Config connected, with a *Setup status* panel on the page (PR #9).
6. The hello-hybrid test on the laptop (PR #10). Its findings shaped the routing ([architecture.md](architecture.md), *Routing*):
   - every response says which model answered;
   - "prefer on-device" uses Nano only when it is fully downloaded;
   - the download starts only from a click;
   - the SDK falls back to the cloud only at the start, not when an on-device call fails;
   - an on-device call can't be cancelled.

**Done when:** a hybrid call runs on the laptop, on the device with Wi-Fi off and in the cloud. Done Nov 12 (PR #10), a day early.

### Phase 2 — Core loop (Nov 14–19, gate Nov 20) · done

1. **Checker** (PR #11). Seven plain-code rules (rule 8, for answers, came with Ask), tested against the six real day-1 drafts and a fictional bulletin with passing and failing cases. After Nano wrote the Hindi word "कृपया" into an English alert and it passed, rule 6 also rejects letters and digits from other scripts (PR #16).
2. **Fact sheet** (PR #12). "Read bulletin" turns the demo bulletin into a fact sheet with plain code (`src/factsheet/`) and lists any fact it couldn't find. The officer edits the facts and ticks "I checked every fact" before any draft. Editing a fact, or changing the area, cancels every approval.
3. **Drafting and routing** (PRs #12 and #13). For each area, the officer drafts the four household alerts one after another. The work so far:
   - Outline prompts that state every fact once.
   - JSON answers with one field per sentence, the same on both paths.
   - Retries that give the model one concrete edit per problem.
   - A word-level edit when the landfall time is on the wrong event.
   - A warm-up when the console opens, the 30 s budget with "Use the cloud instead", and "Copy test log".

   Round 5 on the laptop (Nov 12): Nano wrote all four alerts. Three passed on the first draft, and Families passed after its retry removed "safe".
4. **Officer sign-in and saving** (PR #15). The console opens only for an officer. "Approve and save" runs the checker again on the exact text and saves the alert to Firestore. Offline, the save waits on the laptop and uploads when the connection is back. The Firestore rules are tested on the emulator in CI and published.
5. **Ledger** (PR #19). Each approval writes a locked entry in the same batch as the alert: the fact sheet and bulletin, every draft on that card since its last approval with its model, time, verdict and problems, any hand edit, the claim words, and who approved it when. The rules refuse an alert without its entry, and nobody can change or delete an entry. The console's *Ledger* section traces each alert from the bulletin to the saved text. Drafts that never lead to an approval stay in the test log only. Rules published Nov 12. The first real trace on the laptop: Nano wrote the General alert for Purok Ilaya in 14.9 s, it passed on the first draft, and the entry shows it (9:09 PM).
6. **Withdrawing an alert** (PR #21). The console's *Saved alerts* section lists every saved alert, and "Withdraw" asks for a reason. The alert is marked withdrawn and keeps its text, and a `withdrawn` ledger entry records the text, the approval it withdraws, the reason, and who withdrew it when, in the same batch. The reason stays in the ledger, never on the alert, because residents will read alerts. A new approval for the same household and area replaces a withdrawn alert. Offline, the withdrawal waits on the laptop; if another officer replaced the alert meanwhile, the rules refuse it on upload. Rules published Nov 13.
7. **Test officer login for judges** (PR #22). One email and password account, made by Pim in the Firebase console and added to `officers` like any officer. The sign-in panel has a folded "Judges: sign in with the test officer account" form, and the rules accept an email and password sign-in for officers. The test officer can do what any officer can and nothing more, and the ledger records what it does. Email/Password sign-in, the account and the rules were set up by Pim on Nov 13 (PR #25; docs/firebase-setup.md, *Test officer for judges*).

**Done when:** the core loop (bulletin, draft, check, approve) works end to end on the laptop. Done Nov 12, with saving, the ledger and withdrawing, eight days before the gate.

### Phase 3 — Resident view, offline pack, translations and Ask (Nov 21–23) · built, except item 6

1. **Resident view** (PR #23). At `/resident`, the resident picks their purok and household type once, and the phone remembers it. They see their alert with a "last updated" time, or a notice that it was withdrawn. A language choice appears once an alert has a checked translation.
2. **Resident access** (PR #23). Anonymous sign-in in the background, and read access to `residentAlerts` only. Each approval and withdrawal writes the copy in the same batch. Rules published Nov 13; alerts saved before then reach residents at their next approval.
3. **Offline pack** (PR #23). The whole pack is saved on the phone each time the server sends it, and a service worker and manifest make the app installable and open it with no signal. Tested offline in Chrome with a production build.
4. **Translations** (PR #24). Under *Saved alerts and translations*, the officer translates an active alert into Filipino, Cebuano or both, one cloud call per language and click. Each translation is checked on its own against the approved English: the same figures and place names, no new places, and no Filipino or Cebuano claim word the English doesn't back. The officer can edit or type it, and approves it. Publishing adds it to the resident copy with a `translated` ledger entry in one batch, and a new approval or a withdrawal clears it. Rules published and the cloud call checked on the laptop on Nov 13 (PR #25). The claim lists need a fluent speaker's review.
5. **Ask** (PR #28). Under the alert, "Ask about your alert" takes a question (up to 200 characters) or one of three example questions in the resident's language. Code picks the routes (`src/ask/route.ts`):
   - **On the device** when Chrome reports Gemini Nano downloaded, the alert is read in English and the question doesn't look Filipino or Cebuano. The resident view never starts a download; typing warms Nano up. After the 30 s budget it stops waiting.
   - **In the cloud** when online and this phone has cloud answers left (6 an hour by default).
   - **Text search, no AI**, always last, and the only route offline without Nano. It quotes the alert's best one or two sentences word for word, in English, Filipino or Cebuano.

   The model answers in JSON: whether the alert answers the question, which numbered sentences do, and a short answer in the resident's language. Rule 8 checks that answer against the approved alert, and only a passing answer is shown, with the sentences it cites quoted under it. A failed check, an error or a slow device moves on to the next route, and the resident sees why. The question is fenced off in the prompt and never saved. Tested with Vitest and in Chrome offline and with simulated cloud answers; Nano and the real cloud need Pim's test on the laptop and phone.
6. **Cloud reading of bulletins.** Free-form bulletins are turned into a fact sheet in the cloud when online, with every fact confirmed by the officer. A long bulletin is summarised in the cloud.

**Done when:** a phone with no signal opens its saved alert in the resident's language, and a question gets an answer by one of the three routes (video, 1:15–1:50). Done: deployed and checked on the laptop and an iPhone, Nov 13 (docs/firebase-setup.md, *Follow-ups*).

### Phase 4 — UI and UX redesign (Nov 14–23) · planned, waiting for Pim's go-ahead

Every feature works, but the app still looks like a test bench: one long page of stacked panels, with the setup checks at the top. Judges score **Design** as "a complete, coherent product experience, not a proof of concept" ([requirements-map.md](requirements-map.md), *Judging criteria*). This phase makes Babala look and feel like a real product: easy to follow, calm, and never overwhelming, without losing a single feature or state.

Pim's three mockups (Nov 13: a home page with a resident entry and an officer entry, an officer workspace with numbered steps in a sidebar, and a resident alert card) set the **structure**. They are a guide, not a pixel spec. The look follows Google's own: the Google Sans typeface, Material Design 3 (M3) colour roles, components and shapes, and Google's accessibility guidance.

#### Ground rules

- **UI only.** No change to the checker, `src/ai/`, routing, the Firestore rules, data shapes, the ledger or Remote Config. The hooks keep their contracts (`useDrafts`, `useHybrid`, `useSavedAlerts`, `useLedger`, `useTranslations`, `useResidentPack`, `useAsk`, `useOfficer`), and the screens are laid out again around them.
- **Nothing is lost.** Every feature and state has a place in the map below, including the ones the mockups don't show. Those use the same few patterns as everything else (banner, chip, empty state, dialog), so nothing looks bolted on.
- **No new runtime dependencies.** No component library, router or icon font. Tailwind v4 theme tokens, a small set of our own components, and inline SVG icons.
- **The demo banner stays on every page,** above the app bar, and can't be dismissed (non-negotiable 5). The mockups leave it out.
- **No new words in safety text.** Anything a resident reads as an instruction is the approved, checked alert, word for word.
- **One slice, one PR.** The app works after each slice, so the phase can stop at any slice.

#### Where the redesign differs from the mockups, and why

1. **No "Evacuate now." headline or "Act now" chip** on the resident alert. Neither is in any approved alert, so the page would be making a safety claim that no checker or officer saw (non-negotiable 2), and "Evacuate now" is wrong for Fishers, whose alert is about staying off the sea. The highlighted box shows the approved alert itself, large, in the resident's language. The red header shows only what the approved copy holds: storm, signal number, area and household. "Do not wait for the connection to return" goes for the same reason.
2. **Red means danger.** The mockups use red for "Open workspace" and "Approve & save alert". Failed checks and "Withdraw" are red too, and a red approve button beside red problems reads as a warning. As in M3, where red is the error colour, main actions use the navy primary, and red is kept for the signal header, failed checks and withdrawing.
3. **The hotline isn't a call link in the demo.** The number comes word for word from the approved text, not a new field. The demo number, 0917 555 0100, is fictional, but 0917 is a real mobile prefix, so a tap could ring a real person. The card shows the number with "Demo number". A real deployment would make it a `tel:` button.
4. **The home page's alert card shows no signal number.** A made-up "Signal No. 3" on the front page is the kind of thing that could pass for a real alert. It becomes an illustration labelled "Demo: Typhoon Sample over Barangay Halimbawa".
5. **No "official".** "Official storm information" becomes "storm bulletin", next to the demo banner.
6. **Sentence case, not ALL CAPS,** as in Google's products and M3. Step labels read "Step 1 of 3", not "01 / OFFICIAL BULLETIN".
7. **The check result says what was checked.** "Code check passed: all numeric facts match" undersells the checker. It becomes "Passed all 6 checks", with the six listed (figures, places, nothing missing, no placeholders, no added claims, plain and short).
8. **The logo stays the red warning triangle** already on residents' home screens (`public/icon.svg`), not the mockups' "B".

#### Pages and routes

| Path | Page | For |
| --- | --- | --- |
| `/` | **Home** (mockup 1): what Babala is in one line, and two ways in: "I'm a resident" and "I'm a barangay officer" | Everyone, judges first |
| `/resident` | **Resident alert** (mockup 3) | Residents. The installed app still opens here (`start_url` unchanged) |
| `/officer` | **Officer workspace** (mockup 2), behind sign-in | Officers and the judges' test officer |

Today `/` is the console. `firebase.json` gets `/officer` rewrites like the ones for `/resident` (High tier), and `officer(/.*)?` joins the regex for the page headers (`^/(index\.html|resident(/.*)?)?$`). Without it `/officer` would get Hosting's default one-hour cache, so it would go stale after a deploy, and no protection against being framed by another site (`X-Frame-Options`, `frame-ancestors`). The headers stay off `/__/`, which Google sign-in uses. The README and testing instructions change with it. The service worker already serves the saved page for any path, so `/officer` opens offline once the officer has signed in there once. The officer workspace is loaded with `React.lazy`, so phones opening `/` or `/resident` don't parse the console and ledger code. The service worker's list is built from the bundle, so it still saves every chunk for offline use.

**Home.** App bar with the logo, "Community warning system" and an "Offline ready" pill (from the service worker's state). The headline "When the signal drops, warnings shouldn't.", a one-line subtitle, and the illustration card. "Choose your view" with the two cards: "View alerts" (tonal) and "Open workspace" (filled). A short "How it works" row (Gemini Nano drafts on the laptop, code checks every figure, phones keep the alert offline), which doubles as the judges' 20-second explanation. A footer with the demo line and the GitHub link.

**Officer workspace.**

- **App bar:** logo, "Officer workspace", a model pill ("On-device model ready", "Downloading 42%", "Warming up · 8 s", "Cloud only", "Offline"), and an account menu (name, email, an "Officer" or "Shared test officer" chip, "Sign out").
- **Navigation drawer** (240 px; a menu button under 1024 px). "Create an alert": **1 Bulletin**, **2 Fact sheet**, **3 Draft and approve**, each marked done, current or locked (with the reason). "Manage": **Saved alerts** (the number active, and a dot while any isn't uploaded) and **Ledger**. At the bottom, a *System status* card with a dot and a word each for the on-device model, the cloud and Firebase. It opens the *System status* panel.
- **Create an alert** (steps 1 to 3 on one view, two columns from 1200 px, one column below):
  - A greeting ("Good afternoon, Pim", from the Google profile's first name; the test officer gets "Good afternoon" and a banner saying the account is shared and the ledger records what it does) and one line: "Create an alert from a storm bulletin. Every fact is checked before you approve it."
  - A storm summary once the facts are confirmed: "Demo storm · Typhoon Sample · Landfall Nov 14, 6:00 PM", and a chip per area ("Purok Ilaya · Signal 3"). Built only from the confirmed fact sheet.
  - Left column. **Step 1, Bulletin:** paste box, "Read bulletin" (filled) and "Use the demo bulletin" (text button). Once read, it folds to one line with "Edit". **Step 2, Fact sheet:** the facts as a two-column list, with "Edit facts" to turn them into fields. Facts not found are listed in a warning with their fields open, problems in red, then "I checked every fact against the bulletin". Changing a fact or the area clears the approvals on the cards, and a snackbar says so.
  - Right column. **Step 3, Alert builder:** locked, with "Confirm the fact sheet to start drafting", until step 2 is done. Then the area picker and "Draft all four" (tonal), and **household tabs** (General, Seniors, Families with kids, Fishers), each with a status icon, so all four states show at a glance while the officer works on one. The tab's draft panel: a source chip ("On this laptop · Gemini Nano" or "Cloud · gemini-3.5-flash-lite"), the text streaming in with a progress bar and seconds, the budget banner with "Use the cloud instead" (or "Offline, so it keeps waiting"), any note from drafting, the editable text ("re-checked as you type"), and the check result: a green "Passed all 6 checks", or the text with each problem highlighted and the list of problems with a rule chip each. Then "Draft again" (outlined) and "Approve and save" (filled). After saving, the saved state ("Saved online at 2:14 PM", "Saved on this laptop, uploads when online" or "Withdrawn") with "See its ledger entry", and "Next: translate into Filipino and Cebuano", which opens that alert under *Saved alerts*. A folded *History* lists each attempt with its model, time and verdict, and "Why it failed". A disabled draft button says why (offline with no on-device model, or the cloud not configured).
- **Saved alerts:** filter chips (All, Active, Withdrawn, and one per area) and a list grouped by area. Each row has the household, a status chip ("Active", "Withdrawn", "Not uploaded yet"), the approval time, and Filipino and Cebuano chips ("Published" or not). Selecting a row opens its detail beside the list (below it on narrow screens): the text, the two translation boxes side by side with every state they have today, "See its ledger entry", and "Withdraw" (outlined, red). Withdrawing opens a dialog: the reason (300 characters, with a counter and "Residents don't see this"), then "Withdraw this alert" (filled, red) or "Cancel".
- **Ledger:** newest first, each entry with an icon for its kind (approved, withdrawn, translated), the time, household and area, a status chip ("Current alert", "Replaced", "Still withdrawn", "Current translation") and "Not uploaded yet" when it applies. Selecting one opens its trace beside the list as a vertical timeline: bulletin and facts, each draft, any hand edit, the approval, withdrawal or translation. Links such as "See its ledger entry" open `/officer#ledger/<id>`, so the browser's back button works.
- **System status panel** (a side sheet): setup (Firebase project, App Check token expiry, Remote Config values and where they came from, emulators), the on-device model (status, "Prepare on-device model" with download progress, warm-up), the cloud (online or not, model name), and the account. A *Developer* part holds "Copy test log", so it stays available for laptop runs without crowding the drafts. Development builds keep the App Check debug-token help. The panel reads each setting by name and never passes `import.meta.env` whole: Vite would then put every `VITE_` setting in the bundle, the debug token included, and `vite.secrets.ts` would stop Pim's deploy build. If Firebase isn't configured, `/officer` shows a full-page setup state with the steps instead.
- **Sign-in page:** one centred card: logo, "Sign in to the officer workspace", and a "Sign in with Google" button drawn to [Google's sign-in branding guidelines](https://developers.google.com/identity/branding-guidelines) (white fill, #747775 border, the full-colour "G", Google Sans Medium 14/20). Below it, the text button "Judges: use the test officer account" opens the email and password fields. Every other state shows in the same card: checking who is signed in, a sign-in error, checking the officer list, "offline and hasn't seen the officer list yet", "not on the officer list" with the user ID and "Copy user ID", and "couldn't read the officer list" with the rules hint. Links to the home page and the resident view.
- **Offline:** a banner under the app bar, "You're offline. Drafts use the on-device model, and saves wait on this laptop until you're back online.", next to the existing "Not uploaded yet" chips. A quota error shows "Busy right now, try again shortly" in the card it came from (*Phase 5*, item 4).

**Resident alert** (phone first, 360 to 430 px wide; at most 640 px wide on bigger screens):

- **App bar:** logo, "Your alert", and a status pill: "Live" (green dot), "Offline · saved 2:14 PM" (grey) or "Problem" (red). The full status line sits under the header card, as today (`role="status"`).
- **Header card** in alert red: "Typhoon warning · Barangay Halimbawa", "Signal No. 3", "Purok Ilaya · General households". A withdrawn alert gets a grey card, "Alert withdrawn", with "Don't follow it. Wait for a new alert, and listen to your barangay officials." No alert gets a neutral card: "No alert for General households in Purok Ilaya right now."
- **Your purok and household:** one bar with both choices and "Change", which opens a sheet with the two lists. On the first visit the sheet is open as the first card: "Choose your purok and household. This phone remembers them."
- **Language:** segmented buttons for the languages the alert has (English, Filipino, Cebuano). Hidden when there is only English.
- **Your alert:** the approved text in a highlighted box, large (22/32), with its `lang` attribute.
- **Need help?** The navy hotline card, with the number from the alert (see change 3).
- **Footer lines:** "Last updated 2:14 PM · Approved by a barangay officer after a code check against the storm bulletin", and whether the page and alerts open with no signal.
- **Ask about your alert:** as today, restyled. A 48 px field and "Ask" button, example questions as chips, and the route line, cloud answers left and the privacy line in small text. While answering: a progress bar and seconds, with the on-device note. The answer card has a route chip, the answer, the quoted sentences with a left rule, the "written by AI and checked by code" note, and a line for each route that didn't answer.
- **Install:** a card with the offline state and "Install on this phone" (tonal) where Chrome offers it. Safari on iPhone never offers it, so on iOS the card says "Share, then Add to Home Screen", and that the Home Screen app keeps its own storage: open it once with a signal and pick the purok and household again before it works offline (found in the iPhone check, [firebase-setup.md](firebase-setup.md), *Hosting*).
- Loading: a skeleton in the shape of the header and alert, so nothing jumps. The unreadable-alerts warning stays as a banner.

#### Every feature and state, and where it goes

| Area | Feature or state today | In the redesign |
| --- | --- | --- |
| All pages | "Demo, not official guidance" banner | Slim amber bar above the app bar, every page, not dismissible |
| Setup | Firebase, App Check, Remote Config and emulator checks; "not configured" steps; debug-token help (dev) | System status panel, with a summary card in the drawer; the full-page setup state when not configured |
| Sign-in | Starting; signed out; Google sign-in; judges' test officer form; sign-in error; checking the list; offline before the list was seen; not on the list (user ID, copy); can't read the list; officer; test officer note | Sign-in card (all states in one place); account menu with the officer or test officer chip; the shared-account banner in the workspace |
| Models | Six on-device statuses; "Prepare on-device model" with download %; warm-up (warming, warm and where it answered, failed); cloud not configured, online or offline | Model pill in the app bar, detail and the prepare button in the System status panel, disabled-button reasons in the builder |
| Bulletin | Paste; "Read bulletin"; "Use the demo bulletin"; off while drafting | Step 1 card, folding to one line once read |
| Fact sheet | Nine fields; facts not found; parse problems; "I checked every fact"; editing clears approvals | Step 2 card: read view with "Edit facts", warning for facts not found, snackbar when approvals clear; storm summary from the confirmed facts |
| Drafting | Area; "Draft all four"; per household: Draft or Draft again, status (empty, drafting, passes, fails, approved), attempts with model, time, retry, stopped waiting, errors, "Why it failed", edited by hand; budget banner with "Use the cloud instead" or keep waiting offline; drafting note; editable text; problems highlighted; save error; saved, waiting to upload or withdrawn, with the ledger link and the saved text when it differs | Step 3 builder: household tabs with status icons and one draft panel; *History* fold for the attempts; banners for the budget, the note and errors; "Next: translate" after saving |
| Test log | "Copy test log" and the log itself | System status panel, *Developer* |
| Saved alerts | Intro; can't read saved alerts or translations; loading; none yet; unreadable documents; each alert with its state, text, times, who withdrew it and the ledger link, or "saved before the ledger"; withdraw error | List with filter chips and a detail panel; banners for errors; skeleton while loading; empty state |
| Withdrawing | Reason (300 characters, ledger only); "Withdraw this alert"; Cancel; why it can't start | Dialog with a counter, red confirm button and the reason's error in the dialog |
| Translations | Why it can't be translated (before the ledger, not uploaded, no fact sheet); offline note; "Translate into both"; per language: published or not, not uploaded, Translate or Translate again, "Write it yourself" or Edit, what residents get now and its ledger link, translating, who wrote it, editable text, problems, passes, "Approve and publish" and publishing, error | Two language boxes side by side in the alert's detail panel, same states, new components |
| Ledger | Intro; error; loading; empty; unreadable entries; latest 50; entries with kind, language, household, area, status and upload state; opening from a link and scrolling to it; approval, withdrawal and translation traces | List and a detail panel with a vertical timeline; `#ledger/<id>` links |
| Resident status | Live; offline with the time saved; getting the latest; problem; live but not saved on the phone; unreadable alerts | Status pill in the app bar, full line under the header, banner for unreadable alerts |
| Resident choice | Purok and household, remembered; "No alerts yet"; "Choose your purok" | Choice bar with "Change" and a sheet, open on the first visit |
| Resident alert | No alert; withdrawn; active with storm, signal, area and household; language choice when translated; last updated; "approved after a code check" | Header card (red, grey or neutral), language buttons, highlighted alert text, hotline card, footer lines |
| Ask | Question (200 characters); examples in the language; which route answers now; cloud answers left and when more come; privacy line; warm-up on focus; answering with seconds; answer with quotes and the AI note; "doesn't answer that" or "nothing matches" with the hotline sentence; each route that didn't answer and why, including "busy right now" | The Ask card, same content, M3 field, chips, progress bar and answer card |
| Install and offline | Saved for offline, saving, or not available and why; "Install on this phone"; install error | Install card on the resident page; "Offline ready" pill on the home page |

#### Visual language: close to Google

**Typeface: Google Sans.** Google Sans is the typeface of Google's own products, and Google released it under the SIL Open Font License 1.1 on Google Fonts in December 2025 ([Wikipedia](https://en.wikipedia.org/wiki/Product_Sans), [Google Fonts metadata](https://github.com/google/fonts/blob/main/ofl/googlesans/METADATA.pb), [OFL.txt](https://github.com/google/fonts/blob/main/ofl/googlesans/OFL.txt), [Creative Bloq, Jan 2026](https://www.creativebloq.com/design/fonts-typography/googles-iconic-brand-font-is-now-free-for-anyone-to-use)). Google's *Sign in with Google* guidelines name it for the button too ([branding guidelines](https://developers.google.com/identity/branding-guidelines)). So the app can use Google's real typeface, not a lookalike.

- **Why not Google Sans Flex.** Its sibling, also OFL since November 2025 ([Google Fonts metadata](https://github.com/google/fonts/blob/main/ofl/googlesansflex/METADATA.pb), [9to5Google](https://9to5google.com/2025/11/18/google-sans-flex-font-available/)), adds width, roundness and slant axes for expressive display type. Babala needs none of them, and Flex is bigger (51 KB against 36 KB for the same Latin subset). It stays the alternative if Pim wants a more expressive home page.
- **Licence.** The OFL lets an app bundle and serve the font. Keep `OFL.txt` beside the files and credit the font in the README. The OFL file names no Reserved Font Name, so a subset can keep its name. Google Sans Text isn't in the open collection, so it isn't used.
- **Subset.** Latin and Latin Extended only. Filipino and Cebuano use Latin letters, and checker rule 6 holds alerts to Latin anyway. Weight axis only, 400 to 700, with the optical-size and grade axes at their defaults. Measured from the Google Fonts API on Nov 13 (Google Sans v76, woff2): **36 KB** for Latin and **22 KB** for Latin Extended. A browser downloads Latin Extended only when a page uses one of its letters, but the service worker saves both, 58 KB in all. Keeping the optical-size axis makes Latin 55 KB, for a difference too small to see at these sizes, so it isn't planned.
- **Serving.** Self-hosted woff2 files in `src/assets/fonts/`, with `OFL.txt` and a note of the source URL and version, and `@font-face` rules in `src/index.css` with `font-display: swap` and `unicode-range`. Vite fingerprints them into `/assets/`, which Hosting caches for a year, and the service worker saves every built file, so the fonts open offline with no change to `sw.js`. Not from `fonts.googleapis.com`: the service worker skips other sites, so a phone that opened the app offline would lose them, and every visitor's IP address would go to another server.
- **Fallbacks:** `Roboto, "Segoe UI", system-ui, sans-serif`. Monospace (bulletin, user ID, test log): the system's `ui-monospace`, nothing to download. Google Sans Code (OFL) would match, but the bulletin box doesn't need it.
- **If Pim prefers M3's default typeface:** Roboto (OFL, 43 KB Latin). Same plan, different files.

**Type scale.** M3's roles ([type scale tokens](https://m3.material.io/styles/typography/type-scale-tokens)) as Tailwind tokens (`text-headline-md` and so on), in `rem`, using weights 400 and 500, and 700 for the home headline only.

| Role | Size / line (px) | Used for |
| --- | --- | --- |
| Display small | 36/44 | Home headline (Headline large, 32/40, on phones); "Signal No. 3" |
| Headline medium | 28/36 | Page titles: the greeting, "Saved alerts", "Ledger" |
| Headline small | 24/32 | Card titles: "Source information", "Draft by area and household", "Your household alert" |
| Title large | 22/28 | The resident's alert text (at 22/32 for reading) |
| Title medium | 16/24, 500 | List items, tabs, the step names in the drawer |
| Body large | 16/24 | Body text and every input (16 px also stops iPhones zooming into fields) |
| Body medium | 14/20 | Officer secondary text |
| Body small | 12/16 | Meta lines and helper text on the laptop; 14 px is the floor on the resident page |
| Label large | 14/20, 500 | Buttons and chips |
| Label medium | 12/16, 500 | Status chips, step numbers |

**Colour.** M3 colour roles ([colour roles](https://m3.material.io/styles/color/roles)) as CSS variables in `src/index.css`. They were generated once from a navy seed (#1B3A5B, M3's "tonal spot" scheme) with Material's own colour library, `@material/material-color-utilities` 0.3.0, run outside the repo, so nothing is added to `package.json`. Alert red, success green and warning amber are custom colours with their own tonal palettes. They aren't harmonised, because harmonising pushed the red towards pink. Contrast ratios were measured on Nov 13; WCAG AA needs 4.5:1 for text, and 3:1 for large text and parts of controls.

| Role | Colours | Used for | Contrast |
| --- | --- | --- | --- |
| Brand navy (tone 10) | #001C37 with #FFFFFF, and #A2C9FD for secondary text | App bar, home hero, hotline card | 17.2:1 and 10.1:1 |
| Primary | #37618E with #FFFFFF | Main buttons, links, current step | 6.4:1 |
| Primary container | #D2E4FF with #1C4975 | Tonal buttons, selected drawer item and tab | 7.2:1 |
| Surface | #F8F9FF with #191C20, and #43474E for secondary text | Page background and text | 16.3:1 and 8.9:1 |
| Surface containers | #FFFFFF, #F2F3FA, #ECEEF4, #E7E8EE, #E1E2E8 | Cards, panels, wells, from lowest to highest | — |
| Outline | #73777F | Field borders and chip edges | 4.3:1 on surface (needs 3:1) |
| Outline variant | #C3C6CF | Dividers only, never a control's edge | decorative |
| Alert red | #B91D20 with #FFFFFF; container #FFEDEA with #93000E | Resident header, failed checks and highlights, Withdraw | 6.4:1 and 8.3:1 |
| Success | #006D38 on white; container #CCF2D1 with #173721 | "Passed all 6 checks", "Saved", "Live" | 6.5:1 and 10.7:1 |
| Warning amber | #FFDCBD with #2C1600; text #8A5100 | Demo banner, budget banner, facts not found, "Not uploaded yet" | 13.3:1, and 6.4:1 for the text on white |
| Highlight amber (tone 80) | #FFB86E on brand navy | The home headline's last word | 10.1:1 |

Every state shows an icon and a word, never colour alone. The mockups' grey secondary text (#6B7785 on #F2F5F7) measures 4.2:1 and fails AA, so secondary text uses #43474E. One red for every active signal: no colour per signal number, which would copy a real agency's warning scheme. A dark theme isn't planned before the freeze; the tokens make it a later addition. With the navy palette, `theme-color` in `index.html` and `theme_color` and `background_color` in `public/manifest.webmanifest` change too (today red #b91c1c and #f8fafc); both files are served `no-cache`, so phones pick them up on their next visit.

**Shape and elevation.** M3's shape scale ([shape](https://m3.material.io/styles/shape/corner-radius-scale)): 8 px for chips and small parts, 12 px for cards, 16 px for large cards and side sheets, 28 px for dialogs and the resident header, and fully round buttons and pills. Surfaces are told apart by tone, not shadow; only menus, dialogs and sheets get a light shadow.

**Components.** Our own small React components, built to the M3 specs ([components](https://m3.material.io/components)) with Tailwind:

- **Buttons:** filled for the one main action of a view; tonal for secondary actions ("Draft all four", "Translate into both", "Install on this phone"); outlined for "Draft again", "Cancel" and "Withdraw"; text buttons for links such as "See its ledger entry" and "Use the demo bulletin"; red filled only for confirming a withdrawal. 40 px tall on the laptop and 48 to 56 px on phones, always with at least a 48 × 48 px target, label large, sentence case.
- **Chips:** assist chips for the example questions, filter chips for saved alerts, and small status chips with an icon.
- **Segmented buttons** for the language, **tabs** for households, **outlined text fields** with the label above, helper text and a character counter, **checkbox** with a 48 px target, native `<select>` restyled (it keeps phones' own pickers and screen readers), **dialog** (native `<dialog>`), **side sheet**, **snackbar**, **banner**, **linear progress**, **navigation drawer**.
- **Not `@material/web`.** Google's M3 web components have been in maintenance mode since June 2024, with no new components planned ([announcement](https://github.com/material-components/material-web/discussions/5642)). Adding them would mean a new dependency and web components inside React for what Tailwind tokens already give: the look and the rules.

**Icons.** Material Symbols Rounded, under Apache 2.0 ([Material Symbols guide](https://developers.google.com/fonts/docs/material_symbols)), copied in as about 20 inline SVG components (warning, check circle, error, laptop, cloud, wifi off, translate, history, receipt, description, fact check, edit, call, language, install, expand, menu, account, logout, copy). No icon font: the full font is 295 KB, and the small subsets come from Google's servers, which the service worker doesn't save.

**Motion.** M3's standard easing, `cubic-bezier(0.2, 0, 0, 1)`, 150 to 300 ms, for sheets, tabs and progress only. Turned off under `prefers-reduced-motion`. Streaming text isn't animated.

**Words.** Sentence case and plain words, with buttons named for what they do ("Approve and save", "Withdraw this alert"). Lines about safety, privacy, the shared test account and the ledger keep today's wording, which was written with care.

**Google's marks.** No Google logo anywhere, except the "G" in the sign-in button, as Google's guidelines allow. Font names never appear in the UI, and nothing suggests Google made or endorses Babala (contest rules, *third-party marks*).

#### Accessibility (WCAG 2.2 AA)

- Contrast as in the colour table, for every pair of text and background used.
- Touch targets at least 48 × 48 px, 8 px apart ([Google's accessibility guidance](https://support.google.com/accessibility/android/answer/7101858)). WCAG 2.2 asks only for 24 px.
- A visible focus ring (2 px primary, 2 px offset) on everything that takes focus, a logical tab order, and "Skip to content".
- One `h1` per page, landmarks (`header`, `nav`, `main`), and the drawer as a `nav`. The existing live regions stay: the resident status line, Ask's progress and answer, and the draft status. Streaming text isn't a live region, so screen readers aren't flooded.
- `lang` on the alert, translations and example questions, as today.
- Sizes in `rem`, so the pages work at 200% zoom and at 320 px wide with no sideways scrolling.
- The dialog traps focus, returns it, and closes on Esc. Form errors are linked to their fields with `aria-describedby`.

#### Performance and offline

- **Before** (`vite build`, Nov 13): JavaScript 1,087 KB (330 KB gzipped) in one chunk, CSS 18.5 KB (4.5 KB gzipped).
- **Tailwind reads only `src/`.** Tailwind v4 scans every file in the repo for class names, docs included: this plan alone adds 1.6 KB of unused CSS to the build. Slice 1 limits it with `@import 'tailwindcss' source('../src')` (or the equivalent setting).
- **Budget:** fonts at most 80 KB, CSS at most 30 KB, icons a few KB inline, no new JavaScript dependencies, and JavaScript at most 5% bigger, from layout code only. Splitting out the officer workspace should make the resident page's first load smaller than today.
- **Offline:** everything new is a built file, so the service worker saves it with no change. Checked after each slice that touches the resident page or the cache: a production build in Chrome with the network off, and an iPhone in airplane mode once Pim has deployed.
- **No jumping:** skeletons and fixed space for the header card and the status line.
- **Checks:** Lighthouse (with the Chromium in the cloud session) on `/`, `/resident` and the `/officer` sign-in page, phone and desktop: accessibility at least 95, and the performance score recorded. Lighthouse runs on a local production build (`npm run preview:hosting`, which also serves the real rewrites and headers; check each path with `curl -sI`), because the cloud session gets a 403 from the hosted site. A local production build has no App Check token (the reCAPTCHA key allows only the two hosted domains, and Firestore is enforced), so its data shows errors: use it for layout, routes, headers, offline and Lighthouse, and the dev server for screenshots with data.
- **Size:** Spark Hosting allows 360 MB of downloads a day, and a first visit is about 330 KB gzipped today, so the lazy-loaded workspace and the small font subset matter for residents on a weak signal too.

#### Slices and schedule

| Slice | Day | What | Risk tier |
| --- | --- | --- | --- |
| 1. Foundation | Nov 14 | Colour, type and shape tokens; Google Sans with `OFL.txt`; icons; buttons, chips, fields, banner, dialog, sheet, snackbar, progress; the page frame (demo banner and app bar). Every screen picks up the new font and colours with its layout unchanged | High: changes what the service worker saves, and `index.html` |
| 2. Home and routes | Nov 15 | `/` home, `/officer`, the `firebase.json` rewrite, the lazy-loaded workspace, README links | High: `firebase.json` |
| 3. Resident page | Nov 16–17 | Header card, choice bar and sheet, language buttons, alert box, hotline card, Ask card, install card, every state | Medium |
| 4. Officer frame | Nov 18 | Sign-in page, app bar with the model pill and account menu, drawer, System status panel, offline banner | Medium |
| 5. Create an alert | Nov 19–20 | Steps 1 to 3: bulletin, fact sheet, storm summary, builder with household tabs and the draft panel | Medium. Pim runs the Nano flow on the laptop before merging, because the video depends on it |
| 6. Saved alerts | Nov 21 | List, filters, detail panel, translation boxes, withdraw dialog | Medium |
| 7. Ledger | Nov 22 | List and the timeline trace, `#ledger/<id>` links | Medium |
| 8. Polish | Nov 23 | Accessibility pass, Lighthouse, screenshots, and the docs: architecture *Screens*, README, the stack table in `CLAUDE.md` (fonts), the *Design* row of the requirements map | Medium |

- **Cut line.** Slices 1 to 5 are what the video shows, and they must land. If slice 6 or 7 isn't merged by the evening of Nov 23, those views keep today's layout with slice 1's tokens and components, and the freeze holds on Nov 24.
- **Same week:** Phase 3 item 6 (reading bulletins in the cloud) and Phase 5 item 4 ("try again shortly" in the console). The console message touches the same files as slice 5, so it lands first or inside slice 5.
- **Each PR:** `npm run check` passes with the existing Vitest and rules tests unchanged, because this is UI only. New pure helpers get their own Vitest cases (the greeting for the time of day, the hotline number taken from the approved text, the storm summary from the fact sheet, the drawer's step states). Screenshots use fictional data, at 1280 × 720 for the laptop (about what Chrome shows on the Acer's 14-inch screen at Windows' usual 150% scaling) and 390 × 844 for a phone.
- **Deploys:** merging doesn't change the live site. Pim deploys from the laptop (`git switch main`, `git pull`, `npm ci`, `npm run deploy:hosting`; [firebase-setup.md](firebase-setup.md), *Hosting*), and phones get it on their next visit with a signal. Each slice's PR says whether it needs a deploy to be seen, and any slice touching `/resident` gets Pim's iPhone check (Safari and the Home Screen app, online and in airplane mode) after deploying.
- **How to revert:** each slice is one PR, reverted with `git revert -m 1 <merge commit>` and a redeploy by Pim. Reverting slice 1 takes the app back to system fonts and today's colours.

**Done when:** a judge opening `https://babala-hybrid.web.app` understands what Babala is within 20 seconds, finds both views from the home page, and every feature and state in the map above works in the new layout on the laptop and a phone, online and offline, with a Lighthouse accessibility score of at least 95 on each page.

### Phase 5 — Hosting and feature freeze (Nov 24)

1. Firebase Hosting (PR #26), **live at https://babala-hybrid.web.app since Nov 13** and checked on the laptop and an iPhone in airplane mode. Pim deploys from the laptop with `npm run deploy:hosting`, only from `main` as it is on GitHub and after `npm run check` passes; never from a pull request or CI. The settings come from the laptop's `.env.local`, and the build stops if the App Check debug token would be in it. Deploying from GitHub Actions would need a service account key in the repo's secrets, so it was left out.
2. App Check enforced on Firestore, **done Nov 13**. PR #30 made a page opened offline reach Firestore again when the signal returns; Pim enforced it after deploying that, and it was checked on the laptop, local dev and the iPhone, with a refusal test (docs/firebase-setup.md, section 4, *Enforcing on Firestore*).
3. A test officer login for judges, without putting personal data or production keys in the repo, the form or the testing instructions. Built in Phase 2 (item 7); the email and password go only in the private testing instructions.
4. Against free-tier limits on the Gemini API: a per-user rate limit and a clear "try again shortly" message (*Risks*). Done for residents' questions in PR #28 (6 cloud answers per phone per hour, and "busy right now, try again shortly" on a quota error). Still open: the same message in the console, and optionally a lower AI Logic per-user quota (docs/firebase-setup.md, *Cost and usage*).
5. Feature freeze.

**Done when:** the hosted URL is free, needs no login for residents, gives judges a way into the officer console, and stays up until judging ends (Dec 16).

### Phase 6 — Video and submission (Nov 25–29)

1. **Video** (Nov 25–26), 2:45, English, with Pim's voice-over (about 2.5 words a second, so about 400 words in all):

   | Time | Shot | What it proves |
   | --- | --- | --- |
   | 0:00–0:20 | Opens in the dark. Over a map of the Philippines in the western Pacific typhoon belt, one sourced stat on typhoon frequency and "When a typhoon hits, the signal goes first." A phone lights up in a dark room in airplane mode, like a candle, showing a saved Babala alert. Title | The problem and the audience, and the app working with no signal |
   | 0:20–1:00 | Officer pastes the bulletin and the fact sheet appears. Nano drafts on the laptop (on-device badge). The checker catches a placeholder and an invented "severe", the retry passes. Voice-over: "Firebase AI Logic falls back to the cloud when the local model is missing. Babala also falls back when the local answer is wrong" | On-device AI, facts from the source, and why checking matters |
   | 1:00–1:15 | Officer approves, the cloud translates to Filipino and Cebuano, the checker confirms the figures | Cloud for what Nano can't do |
   | 1:15–1:50 | Wi-Fi off: the laptop still drafts and checks. iPhone shows the saved alert, and a question falls back to text search. Back online, the cloud answers | Three routes: on-device, cloud and no AI |
   | 1:50–2:05 | Ledger: one alert traced from bulletin to household | Trust and accountability |
   | 2:05–2:30 | How it's built: hybrid modes, App Check, Firestore offline cache, Remote Config. The hybrid benefit as a real count from the ledger: how many drafts ran on the laptop with nothing sent to the cloud | Technical depth, and what hybrid saves |
   | 2:30–2:45 | "Babala!" turns its "!" upside down into "¡", which becomes a candle flame: "a guide light in times of uncertainty". Name, URL, repo | Where to try it |

   Rules for the video:
   - **Stats need a cited source**, checked before recording, with the source in the YouTube description. No casualty figures, and no dollar comparison of cloud-only against hybrid: on the Spark plan both cost $0, so the ledger count is the honest version.
   - **Sound:** no copyrighted music. Use recorded rain or wind, or a royalty-free track whose licence allows it, after checking the contest rules.
   - **The dark opening is a real shot**, not a mock-up: the iPhone in airplane mode opening the hosted app.
   - **Shoot on the hosted site** (https://babala-hybrid.web.app), not localhost. Nano, the cloud through App Check and the iPhone offline were all checked there on Nov 13, and it's the URL on the end card.
   - **Deploy last, then prime the phone.** After the final deploy, open the app on the iPhone with a signal and wait for "Live" before airplane mode; phones only get a deploy on their next online visit. The Home Screen app keeps its own storage, separate from Safari: open it from its icon with a signal and pick the purok and household again, or it opens offline with no alerts saved.
   - **Show the offline proof**: record with iPhone screen recording, which works in airplane mode, so the airplane icon and "Offline. Showing the alerts saved on this phone at …" are both on screen. With the laptop's Wi-Fi off, the console's offline banners and waiting saves are expected and worth showing.
   - **Demo data:** the Purok 1 alerts predate the ledger and can't be translated or traced. Re-approve them, or use Purok Ilaya for the translation and ledger shots, and re-approve the demo alerts again before judging starts (Dec 10).
   - **Nothing private on screen:** no reCAPTCHA key ID, App Check debug token, `.env.local`, test officer password, email or real user IDs. Crop user IDs in the ledger or sign in as the test officer, and use the code or a diagram, not console pages, for "How it's built".

2. **README and Devpost text** (Nov 27). Cover the value proposition, setup, testing instructions, how Firebase AI Logic is used (with links to the calls), the AI coding tools used, and what was built during the contest (all of it).
3. **Requirements map.** Bring every row of [requirements-map.md](requirements-map.md) to its final status.
4. **Buffer and device tests** (Nov 28).
5. **Submit** (Nov 29), against this checklist:
   - [ ] Public GitHub repo, with the Apache-2.0 license showing in the About section
   - [ ] Firebase AI Logic imported and called at runtime, and the README links to those calls
   - [ ] README covers the value proposition, setup, testing instructions, and the AI coding tools used. It also states that no pre-existing code was reused
   - [x] App Check enforced (AI Logic and Firestore), with debug-token steps for running locally
   - [ ] Hosted URL that is free, needs no login for residents, gives judges a test officer login, and stays up until Dec 16
   - [ ] Video under 3 minutes, public on YouTube, in English
   - [ ] Text description: features, how Firebase AI Logic is used, value proposition, and what was built during the contest (all of it)
   - [ ] Platform selected: Web (Chrome)
   - [ ] No keys, secrets or personal data in the repo, form or testing instructions
   - [ ] No real agency logos or trademarks. Fictional storm and barangay, with a "demo, not official guidance" banner
   - [ ] Eligibility self-check: not employed by a government agency, and employer consent if your employer's policies apply
   - [ ] Submitted by Sat Nov 29 (cutoff Tue Dec 1, 6:00 AM Manila). Commits pushed after the cutoff aren't judged

**Done when:** the entry is submitted on Nov 29 with every checklist item ticked.

## Risks

| Risk | Fallback |
| --- | --- |
| Nano is slow on the laptop (15.4 s for 3 sentences) | Stream the text, keep jobs to 3 sentences, offer the cloud after 30 s |
| Nano adds placeholders and invented claims | The checker plus one retry. The failure becomes a demo moment |
| Most judges' machines lack Nano | The cloud route is complete on its own, and the app explains which route ran |
| Free-tier limits on the Gemini API | App Check, a per-phone limit on residents' cloud answers, and a clear "try again shortly" message |
| A fake alert mistaken for a real one | Fictional storm and barangay, a demo banner, no agency branding |
| The redesign (Phase 4) runs late and squeezes the freeze | One PR per slice, each leaving the app working. Slices 1 to 5 (what the video shows) first; anything not merged by the evening of Nov 23 keeps today's layout |
| Firebase's web hybrid API details differ from what we expect | Checked on day 1 with the hello-hybrid test on the laptop (PR #10) |

## Stretch goals (not built)

None are chosen yet. Ideas noted so far:

- A checker rule for softened orders, such as "evacuation is strongly advised" where the bulletin says residents must evacuate (laptop run, Nov 12).
- An Android or iOS version. The contest gives multi-platform apps strong consideration for the Grand Prize, but Babala is Web (Chrome) only.
