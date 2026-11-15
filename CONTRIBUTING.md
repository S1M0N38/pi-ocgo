# Contributing

## Development

Iterate on a local checkout instead of pushing to GitHub for every edit.

1. Point Pi at the checkout:

   ```sh
   pi remove git:github.com/S1M0N38/pi-ocgo
   pi install ~/Code/github.com/S1M0N38/pi-ocgo
   ```

   A local package loads from the resolved path without copying, so edits are live.
   Pi identifies a git package by repository URL and a local package by resolved
   absolute path, so the two entries are different packages: leaving both installed
   loads the extension twice and collides. Remove the git entry first.

2. Install dependencies:

   ```sh
   npm install
   ```

   The only dependencies are `typescript` and `@types/node`. Pi installs dependencies
   for npm and git packages but never touches a local checkout, so this tree is yours.

3. Iterate:

   ```sh
   npm run typecheck   # tsc --noEmit
   ```

   There is no test suite. `/reload` in a session picks up edits; `/ocgo-usage` exercises
   the live endpoint, `/ocgo-account` exercises the config path.

4. Commit and push once it works — conventional commit messages:

   ```sh
   git add -A && git commit -m "feat: <what changed>" && git push
   ```

5. Switch back to the published clone:

   ```sh
   pi remove ~/Code/github.com/S1M0N38/pi-ocgo
   pi install git:github.com/S1M0N38/pi-ocgo
   pi update git:github.com/S1M0N38/pi-ocgo   # later, to pull changes
   ```

Notes:

- In a Pi session in this repo, `/source local` and `/source github` do steps 1 and 5
  for you (`.pi/extensions/source.ts`), then reload.
- The local entry is written to `settings.json` relative to the agent dir, so it is
  machine-local by design — never commit or copy it between machines.
- Testing account rotation writes to your real `auth.json`: point `PI_CODING_AGENT_DIR`
  at a throwaway directory with a copy of `ocgo.json` and `auth.json` instead.
- `pi -e ./pi-ocgo` tries the checkout for one invocation without touching settings,
  but the git package must still be removed for the run — same identity rule.

## Architecture

Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing internals: command registration,
the undocumented usage endpoint and its tolerant parser, and the invariants around
rewriting `auth.json`.
