# Project Rules

Rules from the owner for working on this repository. They apply to every session.

## Approvals

- **Merging to `main`: no approval needed.** When a task is done and its pull request's CI is
  green, merge it yourself (squash) and save progress. Don't wait for the owner.
  Every merge to `main` updates the web version, and the phone app picks it up as an in-app update.
- **Stable release: always ask first.** Only the owner's "GO STABLE" starts a Stable release.
- **Beta release:** only on the owner's "GO BETA" (that covers Beta, not Stable). A Beta is a
  version ending in `-beta.N` in `package.json`; the release workflow names it "Beta" and uses
  `BETA_NOTES.md` as its notes.
- **Development APKs** (GitHub pre-releases, made automatically when `package.json`'s version is
  bumped) are for testing on the owner's phone. Only bump the version when the phone app itself
  must change (for example the updater); everything else reaches the phone as an in-app update.
- Never change another repository without the owner's say-so.

## How the owner works

- Talk in Taglish (mostly Tagalog), simply, no technical terms (explain briefly when unavoidable).
- The owner tests on a phone (APK with in-app updates) and in the browser test link.
- After each task, report: what changed, what was checked, what was not checked, what's next.
- Never say something was tested or works without real evidence.
- Art comes from the owner's AI-generated sheets, sent in the chat (not uploaded to the repo).
  Save them under `art/raw/` and cut them with the scripts in `tools/art/`.
- Don't use pink or magenta in game art.
