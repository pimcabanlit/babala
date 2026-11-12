# Babala: build plan

Copy of the plan doc (https://claude.ai/artifact/KqYTL4BvU6PcF7wix61CE2) as of 2026-11-12. The doc is the living version; this copy is a backup for new sessions.

## Status (2026-11-12)

Firebase setup is done:

- Project `babala-hybrid` on the Spark plan, no billing account
- AI Logic with the Gemini Developer API
- Web app "Babala web" registered
- App Check registered and enforced on AI Logic, with reCAPTCHA Enterprise (Fraud Defense). Classic reCAPTCHA is deprecated, so it wasn't used
- Firestore: Standard edition, `(default)`, asia-southeast1, production mode. App Check not yet enforced on Firestore (turn on near the end)
- Authentication: Google and Anonymous enabled
- Remote Config: `ondevice_budget_seconds` = 30, published
- This repo: public, Apache-2.0

Laptop test (Acer Aspire 14 AI, Snapdragon X, 16 GB, Windows 11, Chrome):

- `LanguageModel.availability()` returned "downloadable", and the model downloaded and ran
- `chrome://on-device-internals`: device performance class **Low**
- Model load 0.4 s; a 3-sentence alert took **15.4 s**
- On-device output languages supported: de, en, es, fr, ja (no Filipino)
- Prompt: "Write a 3-sentence typhoon alert for residents of a coastal village: Signal No. 3, landfall expected 6 PM, evacuate to the school gym." Output kept Signal No. 3, 6 PM and the school gym, but invented "severe" and "this evening", left the placeholder "[School Name/Address]", and added emojis. This is the checker's first test case.

Still needed before day 1: Firebase web config and reCAPTCHA site key (kept out of the repo), Node.js LTS on the laptop, app name confirmed, local languages chosen, a storm name not on PAGASA's naming lists.

## Summary

**Babala** (working name, Filipino for "warning") is a web app that turns an official storm bulletin into checked, plain-language alerts for each household, and keeps working when the signal drops. It's a solo entry in the Web (Chrome) category of #BuildHybridAI. The target is to submit on Sat Nov 29, ahead of the cutoff (Mon Nov 30, 2:00 PM PT, which is Tue Dec 1, 6:00 AM Manila).

The pitch: in a typhoon, the signal goes first. A barangay officer's laptop drafts alerts with Gemini Nano on the device, code checks every figure against the bulletin, and the officer approves. While the connection is up, the cloud translates the alerts into Filipino and local languages, and residents' phones save them for offline use.

| Judging criterion | How Babala scores |
| --- | --- |
| Technical implementation | On-device and cloud are the reason the app exists: on-device drafting offline, the cloud for languages Nano lacks, no-AI search when neither is available, and a code checker deciding what gets through |
| Design | A complete flow for two users, an officer console and a resident view, with every alert traced from bulletin to household |
| Potential impact | A specific audience (barangay disaster officers and coastal households) that loses signal exactly when alerts matter |
| Quality of the idea | The SDK falls back only when the model is missing. Babala also catches a bad answer, which is the gap most entries will miss |

Other name options: Hudyat ("signal"), Bantay ("watch").

## Users and screens

Two users share one web app: a barangay disaster officer on a laptop running Chrome, and residents on any phone browser. The demo uses a fictional barangay and a fictional storm, so it can never pass for a real alert.

**Officer console (laptop)**

1. **Bulletin in.** The officer pastes the storm bulletin. Code turns it into a fact sheet: storm name, signal number per area, landfall time, evacuation centres and hotline. The officer confirms each fact.
2. **Draft.** Nano writes a short English alert for each household type (general, seniors, families with kids, fishers). The text streams in, and a badge shows whether it came from the laptop or the cloud.
3. **Check.** The checker marks each draft pass or fail with reasons, and highlights invented words and placeholders. A failed draft is retried on the device, or sent to the cloud when online.
4. **Approve and publish.** The officer approves. The cloud then translates each alert into Filipino and the chosen local languages, the checker re-checks the figures, and the alerts are published.
5. **Ledger.** Every draft, check, approval and translation is logged with the model that made it and when.

Console built so far (Nov 12, `src/console/`, replacing the hello-hybrid test page):
- Bulletin in: "Read bulletin" turns the demo bulletin format into a fact sheet with plain code (`src/factsheet/`), lists any fact it couldn't find, and the officer edits and ticks "I checked every fact" before any draft. Editing a fact or changing the area voids every approval.
- Draft: the officer picks an area (its signal number is the one required) and drafts the four household alerts one after another. Prompts are in `src/drafting/prompt.ts`; each states every fact once, in the spelling the checker accepts.
- Check: problems are highlighted in the text and listed in reading order. The officer can edit any draft; it is re-checked on every keystroke (code only, no AI). Approve stays off until the alert passes.
- Not yet: sign-in, saving to Firestore, publishing, translations and the ledger. Approvals live only in the page for now.

**Resident view (phone)**

1. **My alert.** The resident picks their purok and household type once; the choice is saved on the phone. They see their alert in their language, with a "last updated" time.
2. **Ask.** A question like "Where do we go?" is answered on the device if a model is available, in the cloud if online, and otherwise by a plain text search that quotes the saved alert word for word.
3. **Offline.** The whole alert pack is saved on the phone, so it opens with no signal.

## Routing: on-device, cloud or no AI

Short English jobs run on the device, languages and long documents go to the cloud, and checking is always code. The laptop took 15.4 s for a 3-sentence alert, so on-device jobs stay at 3 sentences or fewer, stream as they're written, and get a 30 s budget before the app offers the cloud.

| Job | Where it runs | Why |
| --- | --- | --- |
| Turn the bulletin into a fact sheet | No AI for the demo bulletin format. Cloud for free-form bulletins when online, with every fact confirmed by the officer | Facts must be exact, and the officer stays in charge |
| Draft an English alert per household type | On-device first. Cloud if Nano is missing, after 2 failed checks, or after the 30 s budget | Private, free and works offline |
| Check every draft and translation | No AI (code) | A model never vouches for itself |
| Translate to Filipino and local languages | Cloud only. Saved on the device when done | Nano writes only English, German, Spanish, French and Japanese |
| Summarise a long bulletin | Cloud | Too long for the laptop's model in time |
| Answer a resident's question | On-device if available, cloud if online, otherwise no-AI search of the saved alert | Always some answer, even with no signal |

All AI calls go through Firebase AI Logic, as the rules require. Drafts use "prefer on-device" mode and translations use "only in cloud". The app reads Chrome's model availability to show its offline state, but never prompts Nano directly.

Confirmed on day 1 from the SDK (`firebase` 13.3.0) and the hello-hybrid test:
- Every response says which model answered (`inferenceSource`: `on_device` or `in_cloud`). The badge reads it.
- "Prefer on-device" uses Nano only when Chrome reports it fully downloaded; otherwise it silently uses the cloud. The download starts only from a click (`initializeDeviceModel()`), so the console has a "Prepare on-device model" button.
- The SDK falls back to the cloud only when Nano is unavailable at the start, not when an on-device call fails, so Babala catches that itself.
- The SDK can't cancel an on-device call. When the 30 s budget passes, the app stops waiting and makes a separate cloud-only call.
- Laptop timings (Nov 12, prefer on-device, same prompt): the first draft after opening the page took 32.0 s (first text at 26.1 s), almost all of it loading Nano. Warm drafts took 6.5 to 7.2 s with first text under 1 s, including with Wi-Fi off. So the console warms Nano up when the officer opens it, before the first real draft. A cloud-only draft on the laptop took 19.5 s right after Wi-Fi came back (about 1 s from the cloud session).
- Every draft, on-device or cloud, added claims or placeholders ("severe", "imminent", "[Village Name]", "[School Name]", "this evening", emojis, Markdown bold). The checker is not optional.
- Cloud model: `gemini-3.5-flash-lite` by default (Remote Config `cloud_model_name`). On Nov 12, `gemini-3.8-flash` returned "high demand" errors while flash-lite answered in 1 to 5 s.

## The checker

No alert reaches a resident unless it passes every rule below and an officer approves it. The checker is plain TypeScript with unit tests, and the laptop test above is its first test case.

1. **Figures match.** Every number, time, date and signal number in the draft appears in the fact sheet. Times are compared in a standard form, so "6 PM", "6:00 PM" and "18:00" all count as the same time. The landfall time may only appear in a sentence about landfall ("landfall", "hit", "strike"), so "declared at 6:00 PM" or "bring food by 6:00 PM" fails: right figure, wrong fact. Added Nov 12 after three such answers passed on the laptop. Rule 4 also rejects prompt wording copied into an alert ("Tell them to…", "Say that…").
2. **Places match.** Every evacuation centre, purok and barangay name matches the fact sheet's list.
3. **Nothing missing.** Each household type's alert includes its required facts: signal number, time, where to go and hotline.
4. **No placeholders.** Rejects brackets, "TBD", "XXX" and similar.
5. **No added claims.** Flags severity and safety words that aren't in the bulletin, such as "severe", "super typhoon", "safe" or "no threat".
6. **Plain and short.** At most 3 sentences or 60 words, with no emojis.
7. **Translations keep the facts.** Every figure and place name in a translation is identical to the approved English alert.

Built on Nov 12 in `src/checker/` (`checkDraft` for rules 1 to 6, `checkTranslation` for rule 7). Each problem comes back with the rule, a plain message and where it is in the draft, so the console can highlight it and the retry prompt can quote it. The tests start from the six real day-1 drafts, which all fail for the right reasons, and a fictional bulletin (Typhoon Sample, Barangay Halimbawa) with passing and failing cases.
- Figures it reads: "6 PM", "6 p.m.", "six PM", "18:00", "1800H", noon, midnight, "alas-6 ng gabi" and "alas-sais ng gabi" (Filipino and Cebuano), dates such as "Nov 14" and "14 November", "Signal No. 3" in several spellings, phone numbers by digits ("+63" equals "0"), and any other number, including "185km/h" and "1,000".
- Where to go: a venue word ("gym", "school", "church", "hall" and so on) outside a known centre name is flagged, and so is a known name with a word in front that changes it ("municipal school gym").
- Added claims: the word list is the Remote Config parameter `checker_claim_words` (a JSON array of strings), with defaults in `src/config/defaults.ts` built from the day-1 drafts. A word is allowed when the bulletin itself uses it. Plurals match.
- The household's area sets which signal number is required. A bulletin with no hotline doesn't require one.
- Known limits: the claim words are English, so translations are held to exact figures and place names instead; spelled-out numbers are read only for hours and signal numbers; the only allowed time is the landfall time, so a bulletin with other times needs them added to the fact sheet first.

If a draft fails, the app retries once on the device with the failure reasons added to the prompt. If it fails again, the job goes to the cloud when online; otherwise the officer edits it by hand. Every attempt goes in the ledger. As built (`src/drafting/route.ts`): at most three AI calls per alert (on-device, one on-device retry, one cloud call), and never a second cloud call. Drafts are asked for as three sentences in the resident's voice (signal and landfall time; what to do and where to go; hotline), because on the laptop Nano ignored "at most 3 sentences" and wrote 4 to 6. The sentences are themselves a passing alert, so a model that copies them word for word is still safe; the cloud does copy them, Nano rewords them. With this, Nano passed on the laptop for 2 to 3 of 4 households (Nov 12), still splitting the first sentence or running past 60 words, and once answering with a numbered list. So both models now answer in JSON with one field per sentence (`signal_and_landfall`, `what_to_do_and_where_to_go`, optional `hotline`; `src/drafting/structured.ts`), using the SDK's structured output with the same schema on both paths: Chrome's response constraint for Nano (`onDeviceParams.promptOptions.responseConstraint`) and `responseJsonSchema` for the cloud. Code joins the fields and the checker checks the joined text; the schema shapes the answer, it never vouches for it. A list number at the start of a line is reported once, as formatting, and a stray number's edit quotes the words around it ("Remove “25” from “About 25 families must”"), after a bare "Remove “1”" made the cloud take the 1 out of "Purok 1" and the hotline. With JSON fields, Nano passed on its first draft for 3 of 4 households (Nov 12, about 15 s each). When the landfall time sits on the wrong event and the storm is named just before it, the retry is one word-level edit, "Change “Typhoon Sample is predicted to reach the area at 6:00 PM” to “Typhoon Sample makes landfall at 6:00 PM”", because given the whole outline again Nano sent back the same draft word for word. A retry gives the model its failed draft back with one concrete edit per problem; when the shape is wrong (too long, a fact missing, the time on the wrong event) it gets the outline instead, built from the fact sheet (`src/drafting/fixes.ts`): "Remove “today”", "Change “7 PM” to “6:00 PM”", "Replace “[School Name]” with “Halimbawa Elementary School gym”". A small model follows short edits better than the whole prompt again, and the shorter prompt runs faster on the laptop. After an error or an abandoned call it starts from the plain prompt. Each failed attempt shows its text and problems in the console, and "Copy test log" copies every prompt, answer and problem, so real on-device drafts can become test cases. If an on-device draft passes the 30 s budget, the officer can press "Use the cloud instead" (online only); offline it keeps waiting. Nano is warmed up with a one-word prompt when the console opens and Chrome reports it downloaded, and drafts wait for the warm-up to finish.

## Architecture

Babala is a static web app on Firebase with no server of its own, on the free Spark plan with no billing account. On that plan, heavy use ends in quota errors rather than a bill.

| Part | Choice | Role |
| --- | --- | --- |
| Front end | Vite, React, TypeScript, Tailwind, installable as an offline web app | Simpler offline support and static hosting than Next.js |
| AI | Firebase AI Logic, Gemini Developer API backend, hybrid modes | Every AI call, on-device and cloud |
| App Check | reCAPTCHA Enterprise provider, enforced on AI Logic. Debug token for local work | Required by the rules. Blocks others from using our quota |
| Firestore | Alerts, fact sheets, ledger. Built-in offline cache | Officer publishes, residents read, works offline |
| Authentication | Google sign-in for officers, anonymous sign-in for residents | Only officers can publish |
| Remote Config | Cloud model name, 30 s budget, checker word lists | One place to tune without redeploying |
| Hosting | Firebase Hosting, deployed by GitHub Actions | Public URL for judges until Dec 16 |

Firebase settings stay out of the repo, in a local env file and GitHub secrets. The rules ban production keys in the repo, the submission form and the testing instructions.

## Timeline (Manila time)

| Dates | Work |
| --- | --- |
| Nov 12–13 | Plan and setup. First hybrid call on the laptop (Nov 13) |
| Nov 14–19 | Core build: fact sheet, checker, on-device drafting, routing, ledger |
| Nov 20 | Gate: core loop works end to end. If not, the resident view shrinks to a saved alert with text search |
| Nov 21–23 | Resident view, offline pack, cloud translations |
| Nov 24 | Feature freeze, hosted |
| Nov 25–26 | Record the video |
| Nov 27 | README and Devpost text |
| Nov 28 | Buffer and device tests |
| Nov 29 | Submit |
| Dec 1, 6:00 AM | Cutoff |

## Video storyboard (2:45)

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

## Submission checklist

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

## Risks

| Risk | Fallback |
| --- | --- |
| Nano is slow on the laptop (15.4 s for 3 sentences) | Stream the text, keep jobs to 3 sentences, offer the cloud after 30 s |
| Nano adds placeholders and invented claims | The checker plus one retry. The failure becomes a demo moment |
| Most judges' machines lack Nano | The cloud route is complete on its own, and the app explains which route ran |
| Free-tier limits on the Gemini API | App Check, a per-user rate limit, and a clear "try again shortly" message |
| A fake alert mistaken for a real one | Fictional storm and barangay, a demo banner, no agency branding |
| Firebase's web hybrid API details differ from what we expect | Verify on day 1 with a "hello hybrid" call on the laptop |
