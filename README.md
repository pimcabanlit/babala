# babala
Typhoon alerts that still work when the signal drops. Built with Firebase AI Logic hybrid inference

> Work in progress for #BuildHybridAI 2026. Demo only, not official guidance: the storm and barangay are fictional.

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
2. Run `npm run dev` and open http://localhost:5173/officer. The **Setup status** panel shows
   whether Firebase, App Check and Remote Config are working.

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

## Credits

- **Google Sans**, by Google, under the SIL Open Font License 1.1. The font files are served from
  this site, in `src/assets/fonts/`, with the licence in `src/assets/fonts/OFL.txt`.
- **Material Symbols Rounded** icons, by Google, under the Apache License 2.0, copied in as inline
  SVG paths in `src/ui/Icon.tsx`.
