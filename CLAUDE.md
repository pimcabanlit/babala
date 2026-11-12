# CLAUDE.md — Babala

Read this first in every session. It is the source of truth for how to work in this repo.

## What this project is

**Babala** (Filipino for "warning") is a solo entry to Google's **#BuildHybridAI 2026** hackathon, Web (Chrome) category. It turns an official storm bulletin into checked, plain-language typhoon alerts for each household, and keeps working when the signal drops.

- A barangay officer's laptop drafts alerts with Gemini Nano on the device, through Firebase AI Logic.
- Code checks every figure against the bulletin, and the officer approves.
- The cloud model translates approved alerts into Filipino and local languages while the connection is up.
- Residents' phones save the alerts and answer questions on-device, through the cloud, or with plain text search when neither is available.

Core idea: the SDK falls back to the cloud only when the local model is missing. Babala also catches a **bad** answer, with a code checker that no model can talk its way past.

## Deadlines

- Submissions close **Mon Nov 30, 2026, 2:00 PM PT** (Tue Dec 1, 6:00 AM Manila). Target: submit **Sat Nov 29**.
- Commits pushed after the cutoff are not judged.
- Judging runs Dec 10–16, 2026. The hosted app must stay up, free and open to judges until then.

## Key documents

- `docs/build-plan.md`: screens, routing, checker rules, architecture, timeline, video storyboard, submission checklist, risks. The living version is the plan doc at https://claude.ai/artifact/KqYTL4BvU6PcF7wix61CE2. If code and plan disagree, raise it, and update the plan in the same change once agreed.

## Non-negotiables

1. **All AI inference goes through Firebase AI Logic.** No other model APIs or SDKs (no `@google/genai`, OpenAI, Anthropic and so on). Never call Chrome's `LanguageModel.prompt()` directly. Reading `LanguageModel.availability()` for UI state is fine.
2. **Every alert passes the code checker before an officer can approve it.** The checker is deterministic TypeScript, never a model. A model never vouches for its own output.
3. **No secrets in the repo.** Firebase config, reCAPTCHA site key and App Check debug tokens live in `.env.local` (gitignored) and GitHub secrets. Commit `.env.example` only. The rules ban production keys in the repo, submission form and testing instructions.
4. **Free tier only.** Firebase Spark plan, no billing account, no Blaze upgrade, no quota-sprint accounts. Flag anything that could add cost before adding it.
5. **Fictional data only.** Fictional storm (not on PAGASA's naming lists) and fictional barangay. No real agency names, logos or branding. Show a "demo, not official guidance" banner.
6. **Original work.** No code from Pitch Ledger or any other existing project. Libraries and frameworks are fine; list AI coding tools used in the README.
7. **English first.** The app must work fully in English; Filipino and local languages are added on top.

## Stack

| Layer | Choice |
| --- | --- |
| Front end | Vite, React, TypeScript (strict), Tailwind, installable offline web app |
| AI | Firebase AI Logic (Gemini Developer API backend), hybrid inference modes |
| App Check | reCAPTCHA Enterprise (Fraud Defense) provider, enforced on AI Logic; debug token locally |
| Data | Firestore (`(default)`, asia-southeast1) with offline cache |
| Auth | Google sign-in for officers, anonymous sign-in for residents |
| Config | Remote Config (`ondevice_budget_seconds` = 30, cloud model name, checker word lists) |
| Hosting | Firebase Hosting, deployed by GitHub Actions |
| Tests | Vitest for the checker and routing logic |

Firebase project: `babala-hybrid` (Spark). Web app: "Babala web".

Architecture rules:
- **One AI module** (`src/ai/`) is the only place that imports `firebase/ai`. Everything else calls it.
- **The checker** (`src/checker/`) has no Firebase or UI imports, so it is easy to unit test.
- Model names and tunables live in Remote Config, with defaults in one config file.

## Known facts about the target laptop

Acer Aspire 14 AI, Snapdragon X, 16 GB RAM, Windows 11, Chrome. Gemini Nano runs, performance class **Low**: about 15 s for a 3-sentence alert. On-device output supports only de, en, es, fr and ja. Keep on-device jobs to 3 sentences or fewer, stream output, and offer the cloud after the 30 s budget. The cloud session can't run Nano, so on-device behaviour is tested by Pim on the laptop.

## Commands

Added as they're created. Keep this list current.

```
(none yet: day 1 adds install, dev server, tests, lint, build, deploy)
```

## Definition of done for any change

- Tests added or updated, and passing; lint and type check pass.
- No secrets, real agency branding or other model APIs introduced.
- README and this file updated when behaviour or commands change.
- The submission checklist in `docs/build-plan.md` still holds.
- Small, focused commits with clear messages.

## Working principles

- Keep the demo story in mind: bulletin in, Nano drafts on the laptop, the checker catches an invented claim or placeholder, retry passes, officer approves, the cloud translates, Wi-Fi off and it still works.
- Simplest working version first. The core loop (bulletin, draft, check, approve) must work end to end by Nov 20.
- Ask before adding new paid services, new frameworks, or anything that changes the plan.
