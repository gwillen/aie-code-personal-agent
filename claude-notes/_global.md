# Global notes

- This checkout is the user's fork of a public conference workshop repo. `origin` = the user's fork (push here); `upstream` = github.com/JakubHojsan/aie-code-personal-agent (never push there). Local `main` tracks `origin/main`.
- Node is pinned and downloaded by pnpm (`devEngines.runtime` in package.json), not nvm. Run things via `pnpm run`/`pnpm exec`; bare `node` may be a different global version.
- Package manager is pnpm 11+, not npm. Use `pnpm run <script>` (not `pnpm <script>`): `pnpm doctor` is a pnpm built-in and shadows this repo's `doctor` script.
- Supply-chain policy lives in `pnpm-workspace.yaml`. See `dependencies.md` before adding or updating any package.
