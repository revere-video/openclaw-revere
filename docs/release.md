# Releasing

1. Update `CHANGELOG.md`, then set the same version in `openclaw.plugin.json`, `package.json` and each `skills/*/SKILL.md` (`npm run check` fails when they differ).
2. Tag the commit (`git tag -s vX.Y.Z`) and run `scripts/release.sh`. It refuses a dirty tree or an untagged commit, runs the checks and tests, packs, and prints SHA-256 checksums. Put the checksums in the release notes.
3. Publish, from a machine with two-factor on both accounts:
   - ClawHub: `clawhub package publish revere-video/revere --dry-run`, read the audit result and fix anything it flags, then publish without `--dry-run`. The skills are published with the package (MIT-0).
   - npm, with provenance: `npm publish --provenance --access public`.
4. Install the published version in a clean OpenClaw and run the first recipe before announcing it.
5. A change to the tools the plugin calls, or to its settings, is a minor version at least; a removal is a major.
