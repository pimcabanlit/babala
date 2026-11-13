# Firebase setup — provisioning log and lessons

How the Firebase side of Babala was set up, how to check it, and what went wrong on the way. Keep this current whenever a product, setting or rule changes.

No secrets go in this file: no web app config values, reCAPTCHA keys, App Check debug tokens, user IDs or emails. Use placeholders like `<site-key>`. Agents never deploy or change console settings (`CLAUDE.md`): Pim applies every step here.

## Current state (Nov 12, 2026)

| Item | Value | Notes |
| --- | --- | --- |
| Firebase project | `babala-hybrid` | Spark plan, no billing account (`CLAUDE.md` non-negotiable 4) |
| Web app | "Babala web" | Its config lives in `.env.local` on the laptop, which also builds the hosted site |
| AI Logic | Gemini Developer API backend | The app calls it with limited-use App Check tokens (`src/ai/index.ts`) |
| App Check | reCAPTCHA Enterprise (Fraud Defense) provider, registered for "Babala web" | **Enforced on AI Logic.** Not yet enforced on Firestore (turn on near the end). A debug token is registered for local work and kept in `.env.local` |
| Firestore | `(default)`, Standard edition, asia-southeast1, production mode | Rules from `firestore.rules` published by Pim (PR #15, then PR #19 with the ledger, Nov 12, then PRs #21 to #24 together, Nov 13). The `officers` documents are added by hand |
| Authentication | Google, Anonymous and Email/Password sign-in enabled | Google for officers. Anonymous for residents: the resident view signs in anonymously in the background. Email/Password for the judges' test officer only (*Test officer for judges* below), set up Nov 13 |
| Remote Config | `ondevice_budget_seconds` = 30, published | `cloud_model_name`, `checker_claim_words` and `checker_translation_claims` are not published, so the app uses their defaults in `src/config/defaults.ts`. *Setup status* shows each value's source (`remote` or `default`) |
| Hosting | Config in `firebase.json`; not deployed yet | Pim deploys from the laptop with `npm run deploy:hosting` (section 8) |
| GitHub | `pimcabanlit/babala`, public, Apache-2.0 | CI on pull requests and `main` (`.github/workflows/ci.yml`). No deploy workflow and no secrets |
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
2. Authentication → Settings → Authorized domains: `localhost`, `babala-hybrid.web.app` and `babala-hybrid.firebaseapp.com` (section 8). Without the hosted domain, sign-in fails with `auth/unauthorized-domain`, and the app says where to fix it.

#### Test officer for judges

Judges share one email and password account, on the officer list like any officer. Its password goes only in the private testing instructions: never in the repo, a PR, an issue, a screenshot or a chat. The email isn't secret, but it goes in the testing instructions too.

1. **Publish the rules** (section 6) once the PR that added the test officer has merged. Older rules refuse every email and password sign-in, so the console would open but saving and reading alerts would fail with "permissions". These rules include the withdrawal rules too, and change nothing for Google officers.
2. Authentication → Sign-in method → **Add new provider** → **Email/Password**. Turn on **Email/Password**, leave **Email link (passwordless sign-in)** off, and **Save**.
3. Authentication → Settings → **User actions**:
   - Leave **Email enumeration protection** on (the default for new projects), so a wrong email and a wrong password get the same answer.
   - Untick **Enable deletion**, so nobody can delete the account from a browser. The app never deletes accounts.
   - Leave **Enable create (sign-up)** on: turning it off also blocks new Google officers and the residents' anonymous sign-in.
4. Authentication → Users → **Add user**:
   - Email: an address that is nobody's inbox, such as `test-officer@example.com`. Firebase never sends it mail.
   - Password: a new random password of at least 16 characters, used nowhere else. Keep it in a password manager.
5. In the Users table, copy the new user's **User UID**.
6. Firestore → Data → `officers` → **Add document**: the document ID is that UID, with one string field `name` = `Test officer for judges`.
7. **Check it:** open the app in a private window, unfold **Judges: sign in with the test officer account**, and sign in. The panel shows **Officer** and a note that the account is shared. Approve one alert and check the ledger shows it.

**What the test officer can do.** Exactly what any officer can, as the rules allow: draft (which uses the AI quota), approve, withdraw any alert, and read alerts and the ledger. It can't delete an alert, change or delete a ledger entry, edit the officer list or name anyone else as the approver. The ledger records each action under its user ID, and other judges see the alerts it leaves. Before judging starts (Dec 10), re-approve the demo alerts if a test run changed them.

**Known limits.** Firebase lets a signed-in user change their own password or email from a browser, and that can't be turned off on Spark. A judge who did that would lock the others out. Someone with the password and the SDK could also save an alert the console's checker never saw, as any officer could, because only the app runs the checker. App Check enforced on Firestore (Phase 4) narrows that to the hosted app.

**If judges can't sign in** (password or email changed, or the account deleted): Authentication → Users → delete the test user if it is still there, and add it again with the same email and password. Then in `officers`, delete the old UID's document and add one for the new UID. Past ledger entries keep the old UID.

### 6. Firestore

1. Database `(default)`, **Standard** edition, location **asia-southeast1**, started in production mode.
2. **Publish the rules** (Pim, whenever `firestore.rules` changes): Firestore → Rules → replace the text with the contents of `firestore.rules` → **Publish**. Published for PR #15, PR #19, and once for PRs #21 to #24 (withdrawals, test officer, resident view and translations) on Nov 13. Since the resident view, an app that writes resident copies needs these rules: older rules refuse every approval and withdrawal.

   Publish right after the PR that changes them merges, not before. The app and the rules change together: for PR #19, the app on `main` before the merge saves alerts without a ledger entry, which the new rules refuse, and the new app saves a ledger entry, which the old rules refuse. To try a rules change before merging, use the emulators (`npm run emulators`), which load `firestore.rules` from the branch.
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
| `cloud_model_name` | String | Not published; the default is `gemini-3.5-flash-lite`. Optional: publishing it lets the cloud model be switched without a redeploy. Gemini 3 or later only, never 1.x or 2.x |
| `checker_claim_words` | String, a JSON array of strings | Not published; the default is the list in `CHECKER_CLAIM_WORDS`. Changes to the list are better made in a reviewed PR |
| `checker_translation_claims` | String, a JSON object: `{"fil": [{"words": [...], "english": [...]}], "ceb": [...]}` | Not published; the default is `TRANSLATION_CLAIMS`. Nothing to do. Publishing it lets a fluent speaker fix a Filipino or Cebuano claim word without a redeploy; a value the app can't read falls back to the whole default |

Publish after each change. The app fetches at most once an hour, so a change can take up to an hour to show.

### 8. Hosting

Firebase Hosting serves the production build from `dist/` at `https://babala-hybrid.web.app` (and the same site at `babala-hybrid.firebaseapp.com`). Hosting is free on Spark: 10 GB stored and 360 MB a day of downloads. The app's first visit downloads about 350 KB compressed, so that is roughly a thousand fresh visits a day.

**How it deploys.** Pim deploys from the laptop with `npm run deploy:hosting`, in PowerShell. It runs Firebase's CLI (version pinned) for this project and Hosting only, so it never touches the Firestore rules, Auth or Remote Config. Before uploading, two checks run (`predeploy` in `firebase.json`), and either one failing stops the deploy:

1. `scripts/check-deploy-source.mjs`: the laptop is on `main`, at the same commit as `main` on GitHub, with no changed or new files (ignored ones, such as `.env.local`, are fine). A stray file in `public/` would otherwise be published. So the hosted site is always what was reviewed and merged.
2. `npm run check`: typecheck, lint, tests, and a fresh production build.

**Settings at build time.** The build reads the Firebase web app config and the reCAPTCHA site key from `.env.local`, as the dev server does. They end up in the public JavaScript, which is expected for a web app: they identify the project, and App Check and the rules protect it. The App Check debug token in the same file must never be in the build: the app reads it only in development (`src/firebase/index.ts`), and the build stops with an error if its value appears in any output file (`vite.secrets.ts`).

**What `firebase.json` sets, and why:**

| Setting | Why |
| --- | --- |
| `/resident` and `/resident/...` rewrite to `/index.html` | The resident view and the installed app's start page open on a direct visit. Other unknown paths get Hosting's 404 page |
| `no-cache` on `index.html`, the resident page, `sw.js`, the manifest and icons | The phone checks for a new copy on every load, so a deploy reaches phones on their next visit with a signal. The service worker installs each new version from fresh files |
| `max-age` of a year, `immutable` on `/assets/...` | Vite puts a content hash in each file name, so a changed file has a new name |
| `X-Frame-Options: DENY` and `frame-ancestors 'none'` on the pages | Another site can't frame the officer console and trick a click on "Approve" |
| `nosniff` and a referrer policy | Standard hardening. Hosting's reserved `/__/` paths (Google sign-in) get none of these headers |

`npm run preview:hosting` builds and serves `dist/` with these rules on the Hosting emulator, at http://127.0.0.1:5002.

#### First deploy (Pim, once)

1. **Turn Hosting on.** Firebase console → Build → **Hosting** → **Get started**. Click through the CLI steps without running them (the repo has them). The site `babala-hybrid` appears. (Done Nov 13.)
2. **Allow the hosted domains for reCAPTCHA.** Google Cloud console for `babala-hybrid` → Security → **reCAPTCHA** → the key App Check uses (the site key in `.env.local`) → **Edit key** → the domain list must be exactly `babala-hybrid.web.app` and `babala-hybrid.firebaseapp.com` → **Save changes**. Leave out `localhost`: local runs use the debug token, and with `localhost` on the list anyone could get App Check tokens for this project from a page on their own computer. Without the hosted domains, App Check gets no token on the hosted site, and every AI call is refused. (Done Nov 13: both hosted domains were already listed; `localhost` was removed.)
3. **Check Auth's authorized domains.** Firebase console → Authentication → Settings → **Authorized domains**: `babala-hybrid.web.app` and `babala-hybrid.firebaseapp.com` should already be listed (Firebase adds them for new projects). Add any that is missing. Without them, sign-in fails with `auth/unauthorized-domain`. Keep `localhost` here: Google sign-in on the dev server needs it. (Checked Nov 13: all three listed.)
4. **Sign the CLI in** (once per laptop), in PowerShell in the repo folder: `npx -y firebase-tools@15.36.0 login`, and sign in with the Google account that owns the project.
5. **Deploy:**

   ```
   git switch main
   git pull
   npm ci
   npm run deploy:hosting
   ```

   The CLI ends with `Hosting URL: https://babala-hybrid.web.app`.
6. **Check it** (*Check the hosted site* below).

#### Later deploys

After a PR merges: `git switch main`, `git pull`, `npm ci`, `npm run deploy:hosting`. Phones get the new version on their next visit with a signal, and keep the old one offline until then.

**Rolling back:** Firebase console → Hosting → *Release history* → the previous release → **Rollback**. It takes seconds and needs no build. Or revert the PR and deploy again.

During judging (Dec 10–16), deploy only fixes, and check the hosted site after each one.

#### Check the hosted site

On the laptop, in Chrome, at `https://babala-hybrid.web.app`:

1. *Setup status* shows ✓ Firebase, ✓ App Check (a real reCAPTCHA token this time, not the debug token) and ✓ Remote Config.
2. **Sign in with Google** opens the popup and the console opens. Sign out, then sign in as the test officer in a private window.
3. *Prepare on-device model*, then draft one alert: the card says the laptop wrote it. The Prompt API is on for web pages from Chrome 148, so the hosted origin needs no trial token; `chrome://version` shows the version.
4. Translate one alert (a cloud call through App Check).
5. Open `/resident` directly: it shows the alert.

On a phone (Chrome on Android, or Safari on iPhone):

1. Open `https://babala-hybrid.web.app/resident` with a signal. Pick a purok and household, and wait until the alert shows.
2. Optional: install it (Chrome's *Install app*, or Safari's *Share* → *Add to Home Screen*).
3. Turn on airplane mode (and Wi-Fi off). Close the tab or app completely, then open the page or app again. It opens and shows the saved alert, with the offline status line.
4. Turn airplane mode off and reload: the status line says *Live*.

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
| 10 | An alert with the Hindi word "कृपया" passed and was saved (Purok 1, General) | No rule checked the script | Rule 6 now flags letters and digits from other scripts (PR #16). The alert was redrafted, passed and re-approved on Nov 12, 8:31 PM |

## Cost and usage

On Spark there is no bill. Heavy use ends in quota errors, which the app must show as a clear "try again shortly" (Phase 4). Drafting is limited to signed-in officers, with at most one cloud call per alert, and App Check stops other clients using the quota. No usage numbers have been recorded yet.

## Follow-ups

- [x] Project, web app, AI Logic (Gemini Developer API), App Check enforced on AI Logic, Firestore, Google and Anonymous sign-in, Remote Config budget (Nov 12).
- [x] Firestore rules from PR #15 published; officer sign-in and saving tested on the laptop.
- [x] Purok 1 General alert, saved before PR #16 with "कृपया" in it, redrafted and re-approved (Nov 12).
- [x] Ledger rules from PR #19 published right after it merged, and checked on the laptop with a real Nano approval (Nov 12, 9:09 PM). Alerts saved before then stay readable and show "Saved before the ledger" until their next approval.
- [x] Rules from PRs #21 to #24 (withdrawals, test officer, resident view, translations) published once after all four merged (Nov 13, 11:47 AM). Checked on the laptop as the test officer: a Nano approval saved online, then withdrawn with a reason the ledger shows, then re-approved (the ledger marks the withdrawal "Replaced").
- [ ] Optional: publish `cloud_model_name` in Remote Config, so the cloud model can be switched during judging without a redeploy.
- [x] Resident view checked on the laptop (Nov 13): `/resident` showed the General alert for Purok Ilaya live, with the language choice.
- [ ] Resident view offline on a phone: open `/resident` on the hosted site (Phase 4), pick a purok and household, turn on airplane mode and reopen it. The dev server doesn't save the page for offline use. Alerts saved before Nov 13 reach residents at their next approval.
- [x] Translations checked on the laptop (Nov 13): "Translate into both" on General · Purok Ilaya, both passed the checker and were published, and `/resident` shows Filipino and Cebuano. The cloud's Filipino said "tumama na ang Bagyong Sample sa lupa" (has already made landfall) for an English "makes landfall at 6:00 PM": the figures matched, so the checker passed it. Pim edited it to "tatama sa lupa" and published again. The checker can't see tense, so the officer's reading is the guard.
- [ ] Have a fluent Filipino and Cebuano speaker review `TRANSLATION_CLAIMS` in `src/config/defaults.ts`, the claim words a translation may only use when the English backs them.
- [ ] Hosting: turn it on, add the hosted domains to the reCAPTCHA key and check Auth's authorized domains, deploy, and check the hosted site (section 8, Phase 4).
- [ ] App Check enforced on Firestore (Phase 4).
- [x] Test officer for judges set up (Nov 13): Email/Password on, user actions set, `test-officer@example.com` added with its `officers` document, and signed in on the laptop. Its password is in Pim's password manager.
- [ ] Put the test officer's email and password in the private testing instructions (Phase 5).
