# Firebase Agent Skills (vendored)

These skills come unchanged from Firebase's official
[firebase/agent-skills](https://github.com/firebase/agent-skills) repository at
commit `99954a30898bb5ddc8152ee10e124dc3b4106bf7` (2026-11-09), under the
Apache License 2.0 (`LICENSE-firebase-agent-skills`). They help coding agents
(Claude Code here) use Firebase correctly. They are agent instructions, not app
code: nothing in them ships in the Babala app.

Included, because Babala uses these products:

| Skill | Used for |
| --- | --- |
| `firebase-ai-logic-basics` | AI Logic setup, hybrid inference, App Check for AI Logic, model names |
| `firebase-basics` | Firebase CLI, project selection, web app config |
| `firebase-auth-basics` | Google and anonymous sign-in |
| `firebase-firestore` | Firestore (Standard edition) data model and web SDK |
| `firestore-rules-creation` | Writing `firestore.rules` |
| `firebase-security-rules-auditor` | Reviewing `firestore.rules` |
| `firebase-remote-config-basics` | Remote Config defaults and fetching |
| `firebase-hosting-basics` | Firebase Hosting for the judges' URL |

Left out, because Babala doesn't use them: Analytics, Crashlytics, Data Connect,
App Hosting, Xcode setup, Extensions migration, and the plugin's MCP server.

`CLAUDE.md` wins wherever a skill and the project rules differ (see "Firebase
agent skills" there). To update, copy the same folders from a newer upstream
commit and change the commit above.
