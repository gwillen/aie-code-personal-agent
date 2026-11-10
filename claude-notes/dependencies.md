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
- The only package with an install script is better-sqlite3 (prebuild-install, falling back to node-gyp). Its native module is built against the active Node ABI.

## Node runtime (managed by pnpm, not nvm)

- `package.json` `devEngines.runtime` pins `node` 26.12.1 (`onFail: download`). It was set with `pnpm runtime set node 26.12.1`, which also writes a `node@runtime:` entry to pnpm-lock.yaml with per-platform nodejs.org tarball URLs and sha256 hashes. pnpm links it at `node_modules/.bin/node`, and `pnpm run`/`pnpm exec` use it. Bare `node` in a shell does not, unless the user runs `pnpm shim add node`. `.nvmrc` was removed so the version lives in one place. `engines.node: ">=26.12.1"` is the separate compatibility floor.
- **minimumReleaseAge does NOT apply to runtimes.** Observed 2026-11-10 with pnpm 12.18.0: it installed Node 26.13.0, released 2026-10-28 (13 days old), without complaint. Check the date by hand (https://nodejs.org/dist/index.json) before bumping.
- **ABI gotcha:** better-sqlite3 was first built while the shell's global Node 24 was in use (NODE_MODULE_VERSION 137). Under Node 26 (147) it failed with ERR_DLOPEN_FAILED. The Mem0 worker hides errors, so it showed up only as "Memory is unavailable" in the `real Mem0 persists across workers` integration test. The fix is `pnpm rebuild better-sqlite3` after any Node version change.
- pnpm 12.18.0 writes the same `lockfileVersion: '9.0'` as pnpm 11, and `devEngines.runtime` has existed since pnpm 10.14, so `engines.pnpm: ">=11"` still holds.

## Not changed

- `slides/` (index.html, demo.js, SPEAKER-NOTES.md, DECK.pdf) and `scripts/sync-slide-notes.mjs` still say `npm`. That's the instructor's stage deck, so we left it as upstream has it.
