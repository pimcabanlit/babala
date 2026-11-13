# Requirements map: the #BuildHybridAI rules against Babala

## (i) What to build

| # | Requirement | Status | What Babala does | Where to see it |
| --- | --- | --- | --- | --- |
| a | A generative AI or full-stack app built with **Firebase AI Logic** that combines **on-device and cloud** inference | **Implemented** | Alerts are drafted with "prefer on-device" (Gemini Nano on the laptop, otherwise the cloud), and retried with "only in cloud" when Nano's draft fails or runs past the 30 s budget. Each draft shows which model wrote it. Residents' questions are answered "only on device" when Nano is ready, "only in cloud" when online, or by text search with no AI, and each answer shows its route | `src/ai/index.ts`; officer console, draft cards (source badge) |
| b | **All AI inference through Firebase AI Logic**; no other model APIs called directly | **Implemented** | `firebase/ai` is the only AI import, and only in `src/ai/`. Nano is never prompted directly; `LanguageModel.availability()` is read for the UI only. Fact sheets and checks are plain code, with no AI | `src/ai/`; `src/ai/deviceStatus.ts`; `CLAUDE.md` non-negotiable 1 |
| c | At least one platform: **Web (Chrome)** with Gemini Nano via Firebase AI Logic, as a web app or Chrome extension | **Implemented** | A web app in Chrome. Nano runs on the target laptop (performance class Low) | docs/firebase-setup.md, *Measured on the laptop* |
| d | Firebase AI Logic **requires App Check**; debug tokens are accepted | **Implemented** | App Check with the reCAPTCHA Enterprise provider, enforced on AI Logic, with limited-use tokens. Enforced on Firestore too (Nov 13), checked with a refusal test (docs/firebase-setup.md, section 4). A debug token for local runs (development builds only) | `src/firebase/index.ts`; README, *App Check debug token*; *Setup status* panel |
| e | Use other Firebase products, such as **Remote Config, Firestore and Authentication** (encouraged) | **Partial** | The app reads the cloud model, the on-device budget and the checker's word list from Remote Config. Firestore stores officers and approved alerts with an offline cache. Authentication signs officers in with Google, judges with a shared test officer email and password, and residents anonymously. Firebase Hosting serves the app at `https://babala-hybrid.web.app` | `src/firebase/remoteConfig.ts`, `src/alerts/`, `src/officer/`, `firestore.rules` |
| f | Multi-platform apps get strong consideration for the Grand Prize; an outstanding single-platform app can still win | **Not planned** | Web (Chrome) only. Residents' phones use the same web app in any browser, but that isn't a second AI Logic platform | docs/build-plan.md, *Stretch goals* |

## (ii) The app works and can be tested

| Requirement | Status | What Babala does | Where to see it |
| --- | --- | --- | --- |
| Installs and **runs consistently** on its platform, and works as the video and description show | **Partial** | The officer loop works on the laptop: bulletin, fact sheet, drafts on the device or in the cloud, checks, approve and save, offline saves, withdrawing an alert with a reason, and the ledger of every approval and withdrawal. The resident view at `/resident` shows each household its alert, and with no signal opens from the pack and app saved on the phone (checked on an iPhone on the hosted site, Nov 13). Officers translate approved alerts into Filipino and Cebuano in the cloud, checked against the English, and residents pick the language. Residents ask questions about their alert and get an answer on the device, in the cloud or by text search offline (PR #28; checked Nov 13 on the laptop: Nano online and offline, the real cloud in Filipino, and a prompt injection refused; and on an iPhone on the hosted site: the cloud online and the text search in airplane mode) | README, *Run locally*; docs/build-plan.md, *Phase 5* (storyboard) |
| **Access for judges**: a website, demo or test build, free and without restriction until judging ends; login credentials in the testing instructions if private | **Partial** | The test officer login is built: one email and password account on the officer list, for the testing instructions (Email/Password sign-in and the account are set up by Pim). The app is live at `https://babala-hybrid.web.app` (Nov 13), with no login for residents, and was checked on the laptop and offline on an iPhone. Missing: staying up until Dec 16, and the credentials in the testing instructions (Phase 5) | `src/officer/`; docs/firebase-setup.md, *Test officer for judges*; docs/build-plan.md, *Phase 4* |
| Supports **English** at a minimum | **Implemented** | The app is English first. Drafts and the alert of record are English; Filipino and Cebuano translations are added on top, each checked against the English, and a resident without one in their language sees English | Officer console, `/resident` |
| No **production API keys**, live project secrets, confidential data or **PII** in the repo, form or testing instructions | **Implemented** in the repo | The Firebase config, reCAPTCHA key and debug token live in `.env.local` (gitignored); `.env.example` has empty values. Saved alerts record the approver's user ID only, with no name or email. Every PR description includes a secrets check. The form and testing instructions are still to write (Pim) | `.gitignore`, `.env.example`; PR template, *Testing* |
| **Fictional data**: nothing that could pass for a real alert (Babala's own rule, from the rules on third-party marks and the spirit of the contest) | **Implemented** | Typhoon Sample over Barangay Halimbawa; "Demo, not official guidance" on every page; no agency names or logos | `src/App.tsx`; `src/checker/fixtures/halimbawa.ts` |

## (iii) Code repository

| Requirement | Status | What Babala does | Where to see it |
| --- | --- | --- | --- |
| A **GitHub or GitLab** URL for judging and testing | **Implemented** | github.com/pimcabanlit/babala | — |
| **Public and open source**, with a license file detectable in the About section (Apache preferred) | **Partial** | Public, with an Apache-2.0 `LICENSE`. To confirm: the license shows in the About section (Pim) | `LICENSE` |
| All source code, assets and **instructions** needed to run it | **Partial** | The README covers running locally, Firebase settings, the debug token, officer sign-in, rules tests and emulators. Missing: testing instructions for judges (Phase 5) | `README.md`; docs/firebase-setup.md |
| The README details the **value proposition** | **Partial** | One line today ("Typhoon alerts that still work when the signal drops"). The full case is in docs/architecture.md; the README text comes in Phase 5 | `README.md` |
| Firebase AI Logic **imported and actually called at runtime**, not just named in the README | **Implemented** | `getAI`, `getGenerativeModel`, `generateContentStream`, `generateContent` and `initializeDeviceModel` are called from the console. Missing: README links to those calls (Phase 5 checklist) | `src/ai/index.ts`; `src/console/useHybrid.ts`, `src/console/useDrafts.ts` |

## (iv) Submission form

| Requirement | Status | What Babala does | Where to see it |
| --- | --- | --- | --- |
| Select at least one **platform** | **Planned** (Pim, Phase 5) | Web (Chrome) | docs/build-plan.md, submission checklist |
| **Text description**: how Firebase AI Logic is used, features and functionality, value proposition | **Planned** (Phase 5) | Drafted from docs/architecture.md and this map on Nov 27 | — |
| New or existing project: a **summary of what was built** during the submission period | **Planned** (Phase 5) | A new project: all of it was built during the contest, starting Nov 12 (PR #1 onwards) | Git history |
| **Disclose** pre-existing code or work and the tools used (frameworks, libraries, starter templates and AI coding assistants are allowed) | **Partial** | No code from Pitch Ledger or any other project (`CLAUDE.md` non-negotiable 6). Libraries are in `package.json`; Firebase's agent skills are vendored with their source and license. Missing: the README's list of AI coding tools (Phase 5) | `package.json`; `.claude/skills/README.md` |
| **Video**: shows the project on its platform, 3 minutes or less, public on YouTube, in English or with English subtitles | **Planned** (Pim, Phase 5) | A 2:45 storyboard in English | docs/build-plan.md, *Phase 5* |
| All submission materials in **English**, and the project **free of charge** | **Planned** (Phase 5) | English throughout; the Spark plan and a free hosted URL | — |
| Submit during the submission period; commits after it are not judged | **Planned** (Pim) | Target Sat Nov 29; cutoff Mon Nov 30, 2:00 PM PT (Tue Dec 1, 6:00 AM Manila) | `CLAUDE.md`, *Deadlines* |

## (v) Encouraged, not required

| Requirement | Status | What Babala does | Where to see it |
| --- | --- | --- | --- |
| A **hosted URL** for judging and testing | **Built** | Firebase Hosting at `https://babala-hybrid.web.app`, live since Nov 13; keep it up until Dec 16 | `firebase.json`; docs/firebase-setup.md, *Hosting* |
| Google IDEs (Antigravity, Android Studio and so on); any tool is fine if the AI runs on Firebase AI Logic | **Not used** | Built with Claude Code. Every AI call in the app is Firebase AI Logic | `CLAUDE.md` |
| **Coding agents with Firebase agent skills** | **Implemented** | Firebase's official agent skills are vendored for Claude Code, and `CLAUDE.md` says to read the matching skill before working on each Firebase product | `.claude/skills/`; `CLAUDE.md`, *Firebase agent skills* |
| Google Account Quota for billing-required models | **Not used, by choice** | Spark plan and free-tier text inference only (`CLAUDE.md` non-negotiable 4) | — |

## (vi) Content, ownership and eligibility

| Requirement | Status | What Babala does | Where to see it |
| --- | --- | --- | --- |
| Original work, solely owned, not violating others' IP | **Implemented** | Written for this contest. Open-source libraries under their licenses; the vendored skills keep their Apache-2.0 license file | `.claude/skills/LICENSE-firebase-agent-skills` |
| Third-party SDKs, APIs and data used under their terms | **Implemented** | Firebase SDKs and npm libraries only. No third-party data: the bulletin and places are fictional | `package.json` |
| No third-party advertising, slogans, logos or trademarks, and nothing implying sponsorship | **Implemented** | No agency names, logos or branding; a fictional storm and barangay | `src/App.tsx` (banner) |
| Nothing offensive, unlawful or against the spirit of the contest | **Implemented** | A public-safety tool with fictional data and a demo banner | — |
| No financial or preferential support from the Sponsor or Administrator | **Implemented** (Pim to confirm) | A solo personal project on the free Spark plan | — |
| Eligibility self-check (Babala's checklist) | **Planned** (Pim) | Not employed by a government agency, and employer consent if your employer's policies apply | docs/build-plan.md, submission checklist |

## (vii) Judging criteria

Stage One is pass or fail on the requirements above. Stage Two scores four equally weighted criteria from 1 to 5.

| Criterion | Status | How Babala answers it | Where to see it |
| --- | --- | --- | --- |
| **Technological implementation**: how well it's built, and how well it uses hybrid inference | **Partial** | On-device and cloud are the reason the app exists: Nano drafts offline, the cloud covers what Nano can't do, and a code checker decides what gets through. Built: hybrid drafting with routing, retries, the budget, structured output on both paths, App Check, Remote Config, Firestore offline, the ledger with every draft's model and verdict, cloud-only translations checked against the English, residents' questions answered on the device, in the cloud or by text search with every AI answer checked against the alert, and rules tests in CI | docs/architecture.md |
| **Design**: a complete, coherent product experience, not a proof of concept | **Partial** | Two users in one flow: the officer console and the resident view are built. An approval reaches residents' phones in the same write, and a withdrawal takes it off them. Residents can ask about their alert, online or not. The ledger traces each alert from the bulletin to the approved text | docs/architecture.md, *Screens* |
| **Potential impact**: a credible, specific case for a real problem and audience | **Partial** | Barangay disaster officers and coastal households, who lose signal exactly when alerts matter. The case is in the docs; the README and video make it in Phase 5 | docs/architecture.md (intro); video storyboard |
| **Quality of the idea**: a creative, non-obvious use of Firebase AI Logic | **Implemented** | The SDK falls back to the cloud only when the local model is missing. Babala also catches a bad answer: every draft is checked by code against the bulletin before an officer can approve it, and a failed on-device draft is retried, then sent to the cloud | docs/data-schema.md, *Checker rules* |

## Beyond the brief

Not asked for, but they make the alerts trustworthy, which is the point of the app.

| Capability | Status | Where to see it |
| --- | --- | --- |
| Code checker: eight deterministic rules on every draft, on every keystroke, and again before saving, on every translation, and on every AI answer to a resident before it is shown; a model never vouches for itself | **Beyond the brief** | `src/checker/`; docs/data-schema.md, *Checker rules* |
| Officer approval, with officers listed only by Pim in the Firebase console | **Beyond the brief** | `src/officer/`; `firestore.rules` |
| Saved alerts carry their evidence: the confirmed fact sheet, which model wrote the text, whether it was edited, and the approver and server time | **Beyond the brief** | `src/alerts/record.ts`; docs/data-schema.md, *Firestore* |
| Bounded AI use: at most three AI calls per alert, never two cloud calls, drafting only for signed-in officers, and at most one cloud call per resident question within a per-phone hourly limit | **Beyond the brief** | `src/drafting/route.ts`, `src/ask/route.ts` |
| Retries that give the model one concrete edit per problem, built from the fact sheet | **Beyond the brief** | `src/drafting/fixes.ts` |
| Test log of every prompt, answer and problem, so real on-device drafts become test cases | **Beyond the brief** | Officer console, *Copy test log*; `src/checker/fixtures/` |
| A locked ledger: each approval is saved with the drafts and checks behind it, and each withdrawal with its reason, in the same batch, and the rules refuse an alert change without its entry; entries can't be changed or deleted | **Beyond the brief** | `src/ledger/`; `firestore.rules`; officer console, *Saved alerts* and *Ledger* |
| Firestore rules tested on the emulator in CI (176 cases), and 465 Vitest tests | **Beyond the brief** | `tests/rules/`; `.github/workflows/ci.yml` |
| Review process: risk tiers, a reviewer checklist, and Pim merges every PR | **Beyond the brief** | `REVIEW.md`; `CLAUDE.md`, *How changes land* |
