## Summary
<!-- What changed and why, in two or three sentences. Link the build-plan section if one applies. -->

## Testing
<!-- Paste what you ran and what it returned. Real output, not "tests pass". -->
- [ ] `npm ci` then `npm run check` (typecheck, lint, Vitest, build): all pass
- [ ] Checker or routing logic changed: new or updated Vitest cases, hand-written from a bulletin and fact sheet
- [ ] Secrets: `git status` shows no env file; `git grep -nE "AIza[0-9A-Za-z_-]{35}"` finds nothing
- [ ] Rules: only Firebase AI Logic; `firebase/ai` only in `src/ai/`; no Firebase or UI imports in `src/checker/`; no real agency, storm or barangay names
- [ ] UI change: checked in Chrome (offline too, if it touches the resident view or cache), screenshot with fictional data only
- [ ] On-device (Gemini Nano) change: Pim tested it on the laptop (say what ran and how long it took)

```
paste output here
```

## Risk tier
<!-- High / Medium / Low from "Risk tiers" in REVIEW.md. Highest tier touched wins; when unsure, go one up. -->
Tier: 
Set by: <!-- the file that set it, e.g. src/checker/figures.ts -->
- [ ] High only: Pim ran `/security-review`

## How to revert
<!-- Usually `git revert -m 1 <merge commit>`. Say if anything else is needed (Firestore rules or data, Remote Config, a redeploy). -->

## Before merge
- [ ] Every review finding answered (fixed, or replied with why not)
- [ ] CI checks green
