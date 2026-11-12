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

Firebase settings go in `.env.local`, copied from `.env.example`. That file is gitignored: never commit it.
