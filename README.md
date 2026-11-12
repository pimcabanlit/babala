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

Then open http://localhost:5173 in Chrome. `npm run check` runs the typecheck, lint, tests and production build.

### Firebase settings

1. Copy `.env.example` to `.env.local` (gitignored: never commit it) and fill in the Firebase web
   app config and the reCAPTCHA Enterprise site key from the Firebase console.
2. Run `npm run dev` and open the page. The **Setup status** panel shows whether Firebase, App
   Check and Remote Config are working.

### App Check debug token (running locally)

App Check is enforced, so a local run needs a registered debug token:

1. Leave `VITE_APPCHECK_DEBUG_TOKEN` empty and run `npm run dev`. The browser console prints
   `Firebase App Check debug token: ...`.
2. In the Firebase console, open App Check > Apps > your web app > Manage debug tokens, and add
   that token.
3. Put the same token in `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN`, so it stays the same when
   you clear site data, and restart `npm run dev`.

Debug tokens are only used in development builds. Treat them like passwords: never commit or share
them.
