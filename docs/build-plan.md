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
| Checker | Seven rules in deterministic TypeScript, never a model ([data-schema.md](data-schema.md), *Checker rules*). The claim-word list is in Remote Config (`checker_claim_words`) |
| Saved alerts | One current alert per household and area at `alerts/{household}__{areaKey}`, replaced by the next approval. The app can't delete them |
| Ledger | One locked entry per approval at `ledger/{autoId}`, written in the same batch as the alert, with the drafts and checks behind it. The rules refuse one without the other, and nothing can change or delete an entry. Officers only (`src/ledger/`) |
| Officers | Google sign-in, plus a document in `officers` that Pim adds by hand in the Firebase console |
| Translations | Cloud only ("only in cloud" mode), because Nano writes only de, en, es, fr and ja. The video storyboard uses Filipino and Cebuano. The local languages are not confirmed yet |
| App Check | reCAPTCHA Enterprise (Fraud Defense), enforced on AI Logic, with limited-use tokens. Firestore enforcement comes near the end. Classic reCAPTCHA is deprecated, so it isn't used |

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

### Phase 2 — Core loop (Nov 14–19, gate Nov 20)

1. **Checker** (PR #11). Seven plain-code rules, tested against the six real day-1 drafts and a fictional bulletin with passing and failing cases. After Nano wrote the Hindi word "कृपया" into an English alert and it passed, rule 6 also rejects letters and digits from other scripts (PR #16).
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
6. **Still to build:**
   - withdrawing a saved alert, which adds a `withdrawn` entry to the ledger in the same batch as the alert's update;
   - a test officer login for judges.

Translations add a `translated` ledger entry in Phase 3.

**Done when:** the core loop (bulletin, draft, check, approve) works end to end on the laptop. On Nov 12 it does, with saving and the ledger. Withdrawing is next. If the gate slips, the resident view shrinks to a saved alert with text search.

### Phase 3 — Resident view, offline pack and translations (Nov 21–23)

1. **Resident view.** The resident picks their purok and household type once, and the phone remembers it. They see their alert in their language, with a "last updated" time.
2. **Resident access.** Anonymous sign-in for residents, and read access for them in `firestore.rules`. Today only officers can read alerts.
3. **Offline pack.** An installable offline web app. The whole alert pack is saved on the phone, so it opens with no signal.
4. **Translations.** Approved alerts are translated in the cloud ("only in cloud" mode) into Filipino and the chosen local languages. A translation is published only after it passes rule 7 against the approved English alert. `checkTranslation` is already built and tested.
5. **Ask.** A resident's question, such as "Where do we go?", is answered on the device if a model is available, in the cloud if online, and otherwise by a plain text search that quotes the saved alert word for word.
6. **Cloud reading of bulletins.** Free-form bulletins are turned into a fact sheet in the cloud when online, with every fact confirmed by the officer. A long bulletin is summarised in the cloud.

**Done when:** a phone with no signal opens its saved alert in the resident's language, and a question gets an answer by one of the three routes (video, 1:25–2:00).

### Phase 4 — Hosting and feature freeze (Nov 24)

1. Firebase Hosting, deployed by GitHub Actions from `main`, never from a pull request. The Firebase settings come from GitHub secrets.
2. App Check enforced on Firestore.
3. A test officer login for judges, without putting personal data or production keys in the repo, the form or the testing instructions.
4. Against free-tier limits on the Gemini API: a per-user rate limit and a clear "try again shortly" message (*Risks*).
5. Feature freeze.

**Done when:** the hosted URL is free, needs no login for residents, gives judges a way into the officer console, and stays up until judging ends (Dec 16).

### Phase 5 — Video and submission (Nov 25–29)

1. **Video** (Nov 25–26), 2:45, English:

   | Time | Shot | What it proves |
   | --- | --- | --- |
   | 0:00–0:15 | Storm signal raised, phone shows no signal. "In a typhoon, the signal goes first." | The problem and the audience |
   | 0:15–0:35 | Officer pastes the bulletin, and the fact sheet appears | Facts come from the source, not the model |
   | 0:35–1:05 | Nano drafts on the laptop (on-device badge). The checker catches a placeholder and an invented "severe", the retry passes | On-device AI, and why checking matters |
   | 1:05–1:25 | Officer approves, the cloud translates to Filipino and Cebuano, the checker confirms the figures | Cloud for what Nano can't do |
   | 1:25–2:00 | Wi-Fi off: the laptop still drafts and checks. iPhone shows the saved alert, and a question falls back to text search. Back online, the cloud answers | Three routes: on-device, cloud and no AI |
   | 2:00–2:20 | Ledger: one alert traced from bulletin to household | Trust and accountability |
   | 2:20–2:40 | How it's built: hybrid modes, App Check, Firestore offline cache, Remote Config | Technical depth |
   | 2:40–2:45 | Name, URL, repo | Where to try it |

2. **README and Devpost text** (Nov 27). Cover the value proposition, setup, testing instructions, how Firebase AI Logic is used (with links to the calls), the AI coding tools used, and what was built during the contest (all of it).
3. **Requirements map.** Bring every row of [requirements-map.md](requirements-map.md) to its final status.
4. **Buffer and device tests** (Nov 28).
5. **Submit** (Nov 29), against this checklist:
   - [ ] Public GitHub repo, with the Apache-2.0 license showing in the About section
   - [ ] Firebase AI Logic imported and called at runtime, and the README links to those calls
   - [ ] README covers the value proposition, setup, testing instructions, and the AI coding tools used. It also states that no pre-existing code was reused
   - [ ] App Check enforced, with debug-token steps for running locally
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
| Free-tier limits on the Gemini API | App Check, a per-user rate limit, and a clear "try again shortly" message |
| A fake alert mistaken for a real one | Fictional storm and barangay, a demo banner, no agency branding |
| Firebase's web hybrid API details differ from what we expect | Checked on day 1 with the hello-hybrid test on the laptop (PR #10) |

## Stretch goals (not built)

None are chosen yet. Ideas noted so far:

- A checker rule for softened orders, such as "evacuation is strongly advised" where the bulletin says residents must evacuate (laptop run, Nov 12).
- An Android or iOS version. The contest gives multi-platform apps strong consideration for the Grand Prize, but Babala is Web (Chrome) only.
