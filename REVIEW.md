# REVIEW.md: instructions for the AI reviewer

Babala turns a storm bulletin into checked typhoon alerts, drafted on the device or in the cloud
through Firebase AI Logic. Read `CLAUDE.md` (non-negotiables and architecture rules) and
`docs/data-schema.md` (checker rules) and `docs/architecture.md` (routing) first. Review the diff
against them. Be short and specific.

## Report as Important

These are the failures that matter here. Any instance is **Important**, never a nit.

1. **Secrets.** Firebase config values, a reCAPTCHA key, an App Check debug token, a service
   account or any `AIza...` key in code, config, tests, docs, screenshots or workflow files
   instead of `.env.local` or GitHub secrets; `.gitignore` loosened for `.env*`; a secret printed
   to the console or a workflow log.
2. **Unchecked alert reaches residents.** Any path that publishes, saves to Firestore for
   residents, or shows a resident an alert or translation that has not passed the checker and
   been approved by an officer; a checker rule (`docs/data-schema.md`, "Checker rules") removed, weakened or
   skipped; a checker test deleted or its expected result loosened.
3. **A model vouches for itself.** A model call, or an import from `src/ai/` or `firebase/*`,
   inside `src/checker/`; a pass/fail decided by model output; a translation published without
   the figure and place check against the approved English alert.
4. **AI outside the rules.** Any model SDK or API other than Firebase AI Logic (`@google/genai`,
   OpenAI, Anthropic, direct REST calls); `LanguageModel.prompt()` or `create()` called
   directly; `firebase/ai` imported outside `src/ai/`; a model name or tunable hard-coded instead
   of read from Remote Config with its default in the one config file.
5. **Access control.** `firestore.rules` letting anonymous residents write alerts, fact sheets
   or the ledger, or anyone read another user's data; an officer-only action reachable without
   Google sign-in or the judges' email test officer account, or by an account not on the officer list; App Check turned off or bypassed for AI Logic.
6. **Cost or quota.** Anything that needs the Blaze plan or a billing account; an AI call in a
   loop, on every keystroke or without a limit; a retry without a cap (the plan allows one
   on-device retry, then the cloud or a manual edit).
7. **Fake alert passes for real.** A real agency name, logo or branding; a storm name from
   PAGASA's naming lists; a real barangay; the "demo, not official guidance" banner removed or
   hidden.
8. **Offline and English break.** A change that stops the saved alert pack opening with no
   signal, removes the no-AI text search fallback, or makes a screen work only in a language
   other than English.
9. **Hosting breaks.** A deploy workflow or `firebase.json` change that could take the hosted
   app down before judging ends (Dec 16, 2026), or a deploy step that runs on pull requests.
10. **Docs that lie.** `CLAUDE.md`, `README.md` or a doc in `docs/` stating commands, files,
    routing, checker rules, data fields or submission checklist items that the diff makes untrue.
11. **Dependencies.** Changes to `package.json` or the lockfile not asked for in the PR, or a new
    framework, paid service or non-Firebase backend not flagged.
12. **Swallowed errors.** A `catch` or `.catch()` that drops an error without showing it to the
    officer or resident, or recording it in the attempt or test log. For a warning app, a silent
    failure is an alert that never goes out. A deliberate ignore needs a comment saying why.
13. **Slow regexes on outside text.** A regex run on model output, a pasted bulletin or the
    officer's textarea (the checker runs on every keystroke) with nested or overlapping
    quantifiers that can backtrack badly, such as `(a+)+` or `(\w+\s?)*`. A hung tab shows no
    alert.
14. **Unsafe text sinks.** `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML` used
    with model output, bulletin text or anything a user typed.

## How to report

- Every finding gives `file:line` evidence and one sentence on the concrete failure.
- At most **3 nits** per review. Skip style the code already does consistently.
- Never repeat a finding. A mistake made in several places is **one** finding listing every
  location.
- A bug that exists on the base branch and is not made worse by the diff is labelled
  **Pre-existing**. Report it, but it does not block the PR.
- Gemini Nano behaviour can't be tested in CI or a cloud session. If the diff changes on-device
  drafting or routing, check the PR says Pim tested it on the laptop; if not, that is Important.
- Don't restate what the diff does; the author knows.

## Skip

Lock and generated files (`package-lock.json`, `dist/`, `coverage/`), and test fixtures such as
sample bulletins, except to check them for secrets (rule 1) and real names (rule 7).

## Risk tiers

The tier is set by what the change touches, not by who wrote it. The **highest tier touched
wins**. When unsure, go **one tier up**. Every PR states its tier and the file that set it.

| Tier | Paths in this repo | Pim before merging |
|---|---|---|
| **High** | `src/checker/` and its tests, `src/ai/` (prompts, routing, hybrid modes), `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc`, App Check, auth and Remote Config setup (and the config file with their defaults), the service worker and offline cache, `.github/workflows/`, `package.json`, `package-lock.json`, `.gitignore`, `.env.example`, anything that publishes alerts or deletes Firestore data | Read the whole diff and the pasted evidence, and run `/security-review`. A change to on-device drafting or routing also needs your laptop test (Gemini Nano). |
| **Medium** | `CLAUDE.md`, `REVIEW.md`, `docs/`, `README.md`, `.github/` (non-workflow), other `src/` (UI, screens, officer console, resident view, ledger display) and `tests/` changes | Read the summary, the evidence and the review findings. UI changes need the screenshot from `CLAUDE.md`. |
| **Low** | Wording-only doc fixes (typos, links), comments, new tests that touch no code under test | Merge on green CI. |

`CLAUDE.md` and `REVIEW.md` are never below Medium. Deleting a checker test or loosening its
expected result is High.

## Summary

Start the summary with the risk tier from the table above and the count, e.g.
`Medium · 2 Important, 1 nit`, then the findings. If there are none, write exactly
`No issues found.` after the tier.
If the PR states a lower tier than the table gives, say so first, with the file that sets it.
