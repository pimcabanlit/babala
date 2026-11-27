# babala
Typhoon alerts that still work when the signal drops. Built with Firebase AI Logic hybrid inference
for #BuildHybridAI 2026 (Web, Chrome).

> Demo only, not official guidance: Typhoon Katy, Hillcrest Village and its zones, and the hotline
> are fictional.

## Why Babala

When a typhoon hits, the cell signal is often one of the first things to go, and the warning people
need most is the one they can no longer load. Village officers turn an official storm bulletin into
words their neighbours act on, often late at night and sometimes with no connection at all.

A language model is a good fit for that rewrite, and a risky one: in testing, every raw output from
Gemini Nano and a cloud Gemini model (7 of 7) added a claim the bulletin never made or left a
placeholder. So Babala is built on one idea: **the model writes, code checks, a person approves.**

1. **Bulletin in.** The officer pastes a bulletin. Code reads the signal, landfall time, evacuation
   place and hotline, and the officer confirms each fact.
2. **Draft on the laptop.** Gemini Nano drafts a 3-sentence alert for each household type, through
   the Firebase AI Logic hybrid SDK, streamed as it writes.
3. **Code checks every figure.** A deterministic TypeScript checker compares each draft with the
   confirmed facts. Only a draft that passes can be approved.
4. **Hybrid routing.** The SDK falls back to the cloud when Nano is missing. Babala also falls back
   when Nano's answer fails the check twice or runs past a 30 s budget.
5. **A ledger** records which model wrote each draft, what the checker found, and who approved it.
6. **Translated while online** into Filipino and Cebuano in the cloud, then checked again.
7. **Residents, even offline.** The alert is saved on residents' phones, so it opens with no signal,
   and their questions are answered on the device, in the cloud, or by text search of the saved
   alert.

## Try it

- Demo video (2:59): https://youtu.be/bqo5J4z8dFM
- Home page: https://babala-hybrid.web.app (links to both views)
- Resident view, no sign-in: https://babala-hybrid.web.app/resident
- Officer workspace: https://babala-hybrid.web.app/officer. Judges sign in with the shared test
  officer account; its email and password are in the private testing instructions on the
  submission form, never in this repo.

On the officer page: *Use the demo bulletin*, confirm the fact sheet, then *Draft all four* for a
zone. Gemini Nano runs where Chrome supports it (open *System status* in the sidebar and click
*Prepare on-device model* once); everywhere else the drafts run in the cloud and say so. On the
resident page, pick a zone and household, wait for "Live", then go offline and reload: the alert
still opens.

## Run locally

You need Node.js 24 LTS and Git.

```
git clone https://github.com/pimcabanlit/babala
cd babala
npm ci
npm run dev
```

Then open http://localhost:5173 in Chrome. The home page links to the two views: the officer workspace at
`/officer` and the resident view at `/resident`. `npm run check` runs the typecheck, lint, tests and production build.

### Firebase settings

1. Copy `.env.example` to `.env.local` (gitignored: never commit it) and fill in the Firebase web
   app config and the reCAPTCHA Enterprise site key from the Firebase console.
2. Run `npm run dev` and open http://localhost:5173/officer. **System status** (a link under the
   sign-in card, and the card at the bottom of the workspace's menu) shows whether Firebase, App
   Check and Remote Config are working.

### App Check debug token (running locally)

App Check is enforced on AI Logic and Firestore, so a local run against the real project needs a
registered debug token (the emulators don't check App Check):

1. Leave `VITE_APPCHECK_DEBUG_TOKEN` empty and run `npm run dev`. The browser console prints
   `Firebase App Check debug token: ...`.
2. In the Firebase console, open App Check > Apps > your web app > Manage debug tokens, and add
   that token.
3. Put the same token in `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN`, so it stays the same when
   you clear site data, and restart `npm run dev`.

Debug tokens are only used in development builds. Treat them like passwords: never commit or share
them.

### Officer sign-in

The officer console opens only for an officer: someone signed in with Google whose Firebase user ID
is in the Firestore `officers` collection. Judges share one test officer account, signed in with an
email and password from the testing instructions (set up in
[docs/firebase-setup.md](docs/firebase-setup.md), *Test officer for judges*). To become an officer:

1. Publish the rules: in the Firebase console, open Firestore > Rules, replace the text with the
   contents of `firestore.rules`, and click **Publish**.
2. Run the app, open `/officer`, click **Sign in with Google**, and copy the user ID it shows.
3. In the Firebase console, open Firestore > Data, start a collection called `officers` (or open
   it), and add a document whose ID is that user ID, with one field `name` (string).

The console opens as soon as the document exists.

### Resident view

Residents open `/resident` (for example http://localhost:5173/resident) on any phone browser. There
is no sign-in screen: the page signs in anonymously and reads only the resident copies of approved
alerts. It saves them on the phone, so the page opens with no signal. Offline opening of the page
itself works only in a production build (`npm run build` then `npm run preview`), which adds the
service worker.

### Hosted app

The demo runs at https://babala-hybrid.web.app, with the officer workspace at
[`/officer`](https://babala-hybrid.web.app/officer) and the resident view at
[`/resident`](https://babala-hybrid.web.app/resident). `npm run preview:hosting`
serves a production build locally with the same rewrites and headers as the hosted site. Deploying
is for the project owner only: `npm run deploy:hosting` from an up-to-date `main`, as set out in
[docs/firebase-setup.md](docs/firebase-setup.md), *Hosting*. A production build never contains the
App Check debug token: the build stops with an error if it would.

### Tests for the Firestore rules

`npm run test:rules` starts the Firestore emulator and runs `tests/rules/` against
`firestore.rules`. It needs Java 21. CI runs it on every pull request.

### Emulators (optional)

`npm run emulators` starts local Auth and Firestore emulators (Java 21). With
`VITE_FIREBASE_EMULATORS=true` in `.env.local`, `npm run dev` signs in and saves alerts there
instead of the real project, and the page says so. AI calls still use the real project.

## Design and accessibility

The look follows Google's own: the Google Sans typeface, Material Design 3 colour roles,
components and shapes (tokens in `src/index.css`, components in `src/ui/`), and no component
library. Every page starts with "Skip to content", every state has an icon and a word as well as a
colour, and the pages reflow at 320 px wide and at 200% zoom. On a local production build,
Lighthouse scores accessibility 100 on the home page, the resident view and the officer sign-in,
on a phone and a desktop, and axe finds no WCAG 2.2 AA problems on any view of the officer
workspace ([docs/build-plan.md](docs/build-plan.md), *Phase 4*).

## How it was built

Babala was built from scratch during #BuildHybridAI 2026. The first commit is from Nov 12, 2026
(Manila time), after the contest opened, and no code from earlier projects is reused. Libraries
come from npm (`package.json`), and the fonts and icons are listed under *Credits*.

**Firebase AI Logic** is imported and called in one file, [`src/ai/index.ts`](src/ai/index.ts):
`getAI` with limited-use App Check tokens, `getGenerativeModel` with the hybrid inference modes,
and `generateContentStream` and `generateContent`. The routing on top of it, which also moves a
draft to the cloud when Nano's draft fails the checker twice or runs past the time budget, is in [`src/drafting/route.ts`](src/drafting/route.ts),
and the checker is in [`src/checker/`](src/checker/).

**AI coding tools.** Babala was written with [Claude Code](https://claude.com/claude-code) as the
coding assistant, using Firebase's official agent skills, vendored in
[`.claude/skills/`](.claude/skills/README.md). Claude Code's cloud sessions can't run Gemini Nano,
so every on-device change was tested by hand on Pim's laptop.

## Credits

- **Google Sans**, by Google, under the SIL Open Font License 1.1. The font files are served from
  this site, in `src/assets/fonts/`, with the licence in `src/assets/fonts/OFL.txt`.
- **Material Symbols Rounded** icons, by Google, under the Apache License 2.0, copied in as inline
  SVG paths in `src/ui/Icon.tsx`.
