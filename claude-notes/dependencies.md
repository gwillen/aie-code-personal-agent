# Dependencies and supply-chain settings

## Policy (pnpm-workspace.yaml)

- `minimumReleaseAge: 20160` (14 days), `blockExoticSubdeps: true`, `trustPolicy: no-downgrade`, `allowBuilds: { better-sqlite3: true }`.
- `package.json` has `engines.pnpm: ">=11"`. Confirmed (2026-11-10, pnpm 11.18.0) that pnpm fails hard with ERR_PNPM_UNSUPPORTED_ENGINE when engines.pnpm isn't satisfied. engines.node only warns.
- pnpm 11 re-verifies all existing pnpm-lock.yaml entries against the policy on install (`Verifying lockfile against supply-chain policies`), so a too-new entry in the lockfile fails even with `--frozen-lockfile`.
- To add or update a dependency, choose a version that's at least 14 days old. Don't lower the release age or override it per command. (Claude Code's auto-mode classifier blocks `--config.minimum-release-age=0` as security-weakening, which is correct.)

## Migration from npm (2026-11-10)

- Upstream shipped `package-lock.json` and npm instructions (`npm ci`), with an npm `allowScripts` field for better-sqlite3. We replaced them with pnpm. package-lock.json is now gitignored.
- `pnpm import` from package-lock.json failed the age check on exactly one package: `@onkernel/sdk@0.141.0` (published 2026-11-06). That SDK publishes almost daily. We pinned **0.132.0** (2026-10-27), the newest version that passed the cutoff. Typecheck and all 51 tests pass with it. The repo only uses `browsers.create`, `browsers.playwright.execute`, and `browsers.deleteByID`. It's safe to move back up to the upstream version once it's 14+ days old.
- The lockfile was then resolved fresh under the full policy. Compared with npm's lock, the only other differences were axios 1.20.0→1.21.0 and follow-redirects 1.16.1→1.16.2. No git or tarball sources.
- The only package with an install script is better-sqlite3 (prebuild-install, falling back to node-gyp). Its native module is built against the active Node ABI, so run `pnpm install` again (or `pnpm rebuild better-sqlite3`) after switching Node versions.

## Not changed

- `slides/` (index.html, demo.js, SPEAKER-NOTES.md, DECK.pdf) and `scripts/sync-slide-notes.mjs` still say `npm`. That's the instructor's stage deck, so we left it as upstream has it.
