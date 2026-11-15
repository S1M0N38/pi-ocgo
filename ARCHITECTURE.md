# Architecture

`pi-ocgo` is one Pi extension. `index.ts` re-exports `src/index.ts`, which registers two commands: `/ocgo-usage` always, `/ocgo-account` only when `ocgo.json` exists.

## Module layout

| Path | Responsibility |
|---|---|
| `index.ts` → `src/index.ts` | Entry point; conditionally registers the account command. |
| `src/usage.ts` | Provider constant, usage endpoint, tolerant response parser. |
| `src/account.ts` | `ocgo.json` load, `auth.json` key copy, atomic writes, status/drift. |
| `src/usage-command.ts` | `/ocgo-usage` rendering with the TUI `Text` component. |
| `src/format.ts` | Percent and reset-time formatting. |

## Usage fetch (`src/usage.ts`)

- `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>`. The key comes
  from Pi's model registry, resolved (`ctx.modelRegistry.getProviderAuth`), so `!command`
  and `$ENV_VAR` sources work without the extension knowing about them. The extension never
  stores or prints it; a missing key reports `No opencode-go API key. Run /login opencode-go.`
- Non-OK responses surface the endpoint's `error.message` when present, otherwise
  `HTTP <status>`.
- The endpoint is undocumented upstream ([anomalyco/opencode#16513](https://github.com/anomalyco/opencode/pull/16513)),
  so the parser tolerates every shape seen so far:
  - windows under `usage.rolling` or `body.rollingUsage` (same for `weekly`, `monthly`);
  - `percent` or `usagePercent`;
  - `resetsAt` as epoch milliseconds or an ISO string;
  - `resetInSec` relative to now when `resetsAt` is missing or unparsable.
- Percent is clamped to 0–100 and rounded; a missing percent reads as 0. Fields the
  parser cannot find are omitted rather than invented.

## Account switching (`src/account.ts`)

`ocgo.json` lives in the agent dir (`PI_CODING_AGENT_DIR`, default `~/.pi/agent`) next to
`auth.json`. `active` is recorded in `ocgo.json`, never in `auth.json`.

Invariants:

- **The credential value is copied verbatim.** A `!command` stays a reference, so no
  secret ever passes through the extension.
- **Unknown keys are preserved.** `ocgo.json` and `auth.json` are read as raw objects and
  rewritten with the rest of the object spread back in.
- **Non-`api_key` credentials are never overwritten.** If `auth.json` holds a different
  credential type for `opencode-go`, activation refuses with an error.
- **Writes are atomic and mode-preserving.** Writes go to a sibling temp file, `chmod`
  0600 for new files, then `rename` over the realpath target — so a symlinked config
  (dotfiles repo, password store) keeps pointing at its target and a crash cannot leave
  half-written JSON.
- **Ordering is `auth.json` first, then `ocgo.json`.** If the second write fails, the error
  says the key was switched but `active` was not updated, which is exactly the drift the
  status command detects.
- **No-op switches are free.** If `active` already names the identity and the stored key
  already matches, nothing is written.

## Status and drift

`/ocgo-account` with no argument reports `active`, the identity list, and two derived flags:

- `known` — `active` names an identity still present in `accounts`;
- `drift` — `auth.json` no longer holds the active identity's key value (for example after
  `pi auth login opencode-go`).

Argument completion lists identities and marks the active one.

## Rendering (`src/usage-command.ts`, `src/format.ts`)

`/ocgo-usage` appends an entry of type `ocgo-usage` instead of printing a notification, and
the registered entry renderer draws it with a single `Text` component: bold title, then
aligned label / percent columns and a dim connective with an italic countdown. Because the
usage data is in the entry, a reloaded session renders the same numbers without refetching.

In a multi-account setup — `ocgo.json` with more than one identity — the entry also carries
`account: { active, identities }` and the renderer adds a dim `Account:` line above the
windows, `none` until the first `/ocgo-account` switch. One identity or no `ocgo.json` omits
the line, and the entry shape is otherwise unchanged, so entries written before the field
existed render as before. Reading `ocgo.json` never fails the command: errors drop the line.

`formatReset` renders `2h 5m` for the rolling window and `1d 05h` for weekly and monthly;
a missing or unparsable `resetsAt` degrades to `0h 0m` rather than throwing.
