# Firebase setup — provisioning log and lessons

How the Firebase side of Babala was set up, how to check it, and what went wrong on the way. Keep this current whenever a product, setting or rule changes.

No secrets go in this file: no web app config values, reCAPTCHA keys, App Check debug tokens, user IDs or emails. Use placeholders like `<site-key>`. Agents never deploy or change console settings (`CLAUDE.md`): Pim applies every step here.

## Current state (Nov 12, 2026)

| Item | Value | Notes |
| --- | --- | --- |
| Firebase project | `babala-hybrid` | Spark plan, no billing account (`CLAUDE.md` non-negotiable 4) |
| Web app | "Babala web" | Its config lives in `.env.local` and, for hosting, GitHub secrets |
| AI Logic | Gemini Developer API backend | The app calls it with limited-use App Check tokens (`src/ai/index.ts`) |
| App Check | reCAPTCHA Enterprise (Fraud Defense) provider, registered for "Babala web" | **Enforced on AI Logic.** Not yet enforced on Firestore (turn on near the end). A debug token is registered for local work and kept in `.env.local` |
| Firestore | `(default)`, Standard edition, asia-southeast1, production mode | Rules from `firestore.rules` published by Pim (PR #15). The `officers` documents are added by hand |
| Authentication | Google and Anonymous sign-in enabled | The app uses Google for officers. Anonymous is for residents, not used yet |
| Remote Config | `ondevice_budget_seconds` = 30, published | `cloud_model_name` and `checker_claim_words`: to confirm. Without them the app uses the defaults in `src/config/defaults.ts`, and *Setup status* shows each value's source |
| Hosting | Not set up | Planned for Phase 4, deployed by GitHub Actions |
| GitHub | `pimcabanlit/babala`, public, Apache-2.0 | CI on pull requests and `main` (`.github/workflows/ci.yml`). No deploy workflow and no secrets used yet |
| Agent skills | Firebase's official skills in `.claude/skills/`, commit `99954a3` (Nov 9) | See `.claude/skills/README.md`. `CLAUDE.md` wins where they differ |

Not used: the Blaze plan, Google Account Quota sprint accounts, the Vertex AI (Agent Platform) backend, Cloud Functions, and classic reCAPTCHA (deprecated).

## Setup steps

These match what is in place now. Console menu names drift: when the console disagrees, trust the console, and fix this file.

### 1. Plan guard rails

1. Keep the project on the **Spark** plan, with no billing account. On Spark, heavy use ends in quota errors rather than a bill.
2. Don't upgrade to Blaze, and don't use features that need it (Vertex AI backend, image generation and so on). Flag anything that could add cost before adding it.

### 2. Web app and local settings

1. Firebase console → Project settings → Your apps → **Babala web** shows the web app config.
2. Copy `.env.example` to `.env.local` (gitignored, never committed) and fill in:

   ```
   VITE_FIREBASE_API_KEY=<from the web app config>
   VITE_FIREBASE_AUTH_DOMAIN=<…>
   VITE_FIREBASE_PROJECT_ID=<…>
   VITE_FIREBASE_STORAGE_BUCKET=<…>
   VITE_FIREBASE_MESSAGING_SENDER_ID=<…>
   VITE_FIREBASE_APP_ID=<…>
   VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<site-key>
   VITE_APPCHECK_DEBUG_TOKEN=<debug token, local work only>
   VITE_FIREBASE_EMULATORS=
   ```

3. `npm run dev` and open http://localhost:5173. If a value is missing, *Setup status* lists it.

### 3. AI Logic

1. AI Logic is set up with the **Gemini Developer API** backend (no billing needed). Agents don't run `firebase init ailogic`: it is already done.
2. The app needs nothing more in the console. `src/ai/index.ts` creates the client with `getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })`, and reads the cloud model name from Remote Config.
3. Gemini Nano runs only in Chrome on a device that supports it. Chrome downloads it on the first "Prepare on-device model" click in the console. `chrome://on-device-internals` shows the device's performance class.

### 4. App Check

1. App Check → Apps → **Babala web** → register with the **reCAPTCHA Enterprise** provider. Put its site key in `.env.local` as `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`.
2. Enforce App Check for **Firebase AI Logic** (done). Firebase AI Logic requires App Check, and the contest accepts debug tokens.
3. **Debug token for local runs** (also in `README.md`):
   1. Leave `VITE_APPCHECK_DEBUG_TOKEN` empty and run `npm run dev`. The browser console prints `Firebase App Check debug token: ...`.
   2. App Check → Apps → Babala web → **Manage debug tokens** → add that token.
   3. Put the same token in `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN` and restart `npm run dev`. It then stays the same when you clear site data.

   The app uses the debug token only in development builds (`appCheckDebugSetting` in `src/firebase/env.ts`). Treat it like a password.
4. **Firestore enforcement** comes near the end (Phase 4). The app already starts App Check before Firestore (`src/firebase/index.ts`), because Firestore attaches App Check tokens only if App Check started first.

### 5. Authentication

1. Authentication → Sign-in method: **Google** and **Anonymous** are enabled.
2. Authentication → Settings → Authorized domains: the hosted domain must be added when hosting is set up. Without it, sign-in fails with `auth/unauthorized-domain`, and the app says where to fix it.

### 6. Firestore

1. Database `(default)`, **Standard** edition, location **asia-southeast1**, started in production mode.
2. **Publish the rules** (Pim, whenever `firestore.rules` changes): Firestore → Rules → replace the text with the contents of `firestore.rules` → **Publish**. Published for PR #15.
3. **Add an officer:**
   1. Run the app and click **Sign in with Google**.
   2. A signed-in user who isn't an officer sees their user ID. Copy it.
   3. In Firestore → Data, open the `officers` collection (or start it).
   4. Add a document whose ID is that user ID, with one string field `name`.

   The console opens as soon as the document exists. The rules let nobody write `officers` from the app.
4. Rules tests: `npm run test:rules` runs `tests/rules/` against `firestore.rules` on the emulator (Java 21). CI runs it on every pull request.

### 7. Remote Config

Parameters, with their in-app defaults in `src/config/defaults.ts`:

| Parameter | Type | Value |
| --- | --- | --- |
| `ondevice_budget_seconds` | Number | `30` (published) |
| `cloud_model_name` | String | `gemini-3.5-flash-lite`. Gemini 3 or later only, never 1.x or 2.x |
| `checker_claim_words` | String, a JSON array of strings | The list in `CHECKER_CLAIM_WORDS` |

Publish after each change. The app fetches at most once an hour, so a change can take up to an hour to show.

### 8. Hosting (not set up yet)

Planned for Phase 4: Firebase Hosting, deployed by a GitHub Actions workflow from `main`, never on pull requests. The web app config and reCAPTCHA site key come from GitHub secrets, never the repo. Add the hosted domain to Authentication's authorized domains. The app must stay up, free and open to judges until Dec 16.

### 9. Verify

1. `npm run dev`, open the page. *Setup status* should show:
   - ✓ Firebase (the project ID);
   - ✓ App Check (a token and its expiry time; the token itself is never shown);
   - ✓ Remote Config (the cloud model and the budget, each marked `remote` or `default`).
2. Sign in as an officer, then use **Use the demo bulletin** → tick the facts → **Draft all four**. Each card shows whether the laptop or the cloud wrote it.
3. `npm run check` and `npm run test:rules` pass.

To work without the real project, `npm run emulators` starts local Auth and Firestore emulators. With `VITE_FIREBASE_EMULATORS=true` in `.env.local`, sign-in and saved alerts use them, and *Setup status* says so. AI calls still use the real project.

## Measured on the laptop

Acer Aspire 14 AI (Snapdragon X, 16 GB, Windows 11, Chrome). Gemini Nano: `LanguageModel.availability()` returned "downloadable", and the model downloaded and ran. Performance class **Low**. On-device output supports de, en, es, fr and ja only (no Filipino).

| Run (Nov 12) | Result |
| --- | --- |
| DevTools test, before the app: a 3-sentence alert | Model load 0.4 s, answer 15.4 s |
| Prefer on-device, first call after opening the page | First text 26.1 s, total 32.0 s: almost all of it loading Nano |
| Prefer on-device, warm (also with Wi-Fi off) | 6.5 to 7.2 s, first text under 1 s |
| Only in cloud (`gemini-3.5-flash-lite`), on the laptop right after Wi-Fi came back | First text 10.6 s, total 19.5 s. From a cloud session: about 1 s |
| Console drafts with JSON fields | Nano passed on its first draft for 3 of 4 households, about 15 s each |
| Console, round 5 | All four alerts written on the device: three on the first draft, Families after one retry |

Every draft in the first runs, on-device and cloud, added claims or placeholders ("severe", "imminent", "[Village Name]", "[School Name]", "this evening", emojis, Markdown bold). The checker is not optional.

## Lessons learned (Nov 12)

| # | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| 1 | Classic reCAPTCHA is offered for App Check | It is deprecated | Use the reCAPTCHA Enterprise (Fraud Defense) provider |
| 2 | `gemini-3.8-flash` returned 500 "high demand" or timed out | Load on that model | Default to `gemini-3.5-flash-lite` (1 to 5 s), switchable in Remote Config |
| 3 | "Prefer on-device" answered from the cloud | Nano wasn't fully downloaded, and the SDK then uses the cloud without saying so in advance | Read `LanguageModel.availability()` for the UI, and add a "Prepare on-device model" button: Chrome starts the download only from a click |
| 4 | A failed on-device call didn't fall back to the cloud | The SDK falls back only when Nano is unavailable at the start | Babala's own routing (`src/drafting/route.ts`) makes a separate cloud-only call |
| 5 | A slow on-device call couldn't be stopped | The SDK can't cancel an on-device call | After the budget, the app stops waiting and offers a cloud-only call |
| 6 | The first on-device draft took 32 s | Loading Nano into memory | Warm up with a one-word prompt when the console opens, on the same model object |
| 7 | (Caught before it happened.) Firestore would send requests without App Check tokens | Firestore attaches tokens only if App Check started before it | `getFirebase()` starts App Check first |
| 8 | (Caught before it happened.) Emulator test users and data could mix with the real project's in the browser | The emulators use the real project's ID, and the persistent cache is keyed by it | With the emulators, Auth and Firestore keep everything in memory |
| 9 | Firestore refuses a document with an `undefined` field | A fact sheet with no landfall date | `approvedAlert()` leaves the field out |
| 10 | An alert with the Hindi word "कृपया" passed and was saved (Purok 1, General) | No rule checked the script | Rule 6 now flags letters and digits from other scripts (PR #16). Re-approving that saved alert: to confirm |

## Cost and usage

On Spark there is no bill. Heavy use ends in quota errors, which the app must show as a clear "try again shortly" (Phase 4). Drafting is limited to signed-in officers, with at most one cloud call per alert, and App Check stops other clients using the quota. No usage numbers have been recorded yet.

## Follow-ups

- [x] Project, web app, AI Logic (Gemini Developer API), App Check enforced on AI Logic, Firestore, Google and Anonymous sign-in, Remote Config budget (Nov 12).
- [x] Firestore rules from PR #15 published; officer sign-in and saving tested on the laptop.
- [ ] Confirm `cloud_model_name` and `checker_claim_words` are published (*Setup status* shows `remote`).
- [ ] Re-approve the Purok 1 General alert saved before PR #16, if it still contains "कृपया".
- [ ] Resident read access in `firestore.rules`, with anonymous sign-in (Phase 3).
- [ ] Hosting, GitHub secrets, and the hosted domain in Authentication's authorized domains (Phase 4).
- [ ] App Check enforced on Firestore (Phase 4).
- [ ] A test officer login for judges (Phase 4).
