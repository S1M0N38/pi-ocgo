# pi-ocgo

Minimal [pi](https://pi.dev) extension that shows your OpenCode Go subscription usage and rotates between several subscriptions.

```bash
pi install git:github.com/S1M0N38/pi-ocgo
```

## Usage

```
/ocgo-usage
```

```
OpenCode Go Usage
Rolling:   3% used · resets in 2h 5m
Weekly:   47% used · resets in 2d 09h
Monthly: 100% used · resets in 26d 05h
```

A bold title sits above the rows, like `/session`. Labels and the `used · resets in` connective are dim, the countdown is italic, percentages stay plain. The block is written to the transcript as a custom entry, so it never enters the LLM context.

## Accounts

Optional. With more than one Go subscription, keep the keys in the keychain and let the extension pick which one pi uses. `ocgo.json` lives next to `auth.json`, at `$PI_CODING_AGENT_DIR/ocgo.json` (`~/.pi/agent/ocgo.json` by default):

```json
{
  "accounts": {
    "university": "!security find-generic-password -a simo -s opencode-university -w",
    "personal": "!security find-generic-password -a simo -s opencode-personal -w"
  },
  "active": "personal"
}
```

```
/ocgo-account             # active: personal · accounts: university, personal
/ocgo-account university  # switch
```

Tab completes the identities. The value is copied verbatim into `opencode-go.key` in `auth.json`, so a `!command` (or `$ENV_VAR`, or a literal key) stays a reference and no secret passes through the extension. Everything else in `auth.json` is preserved, and pi re-reads it on the next request, so the switch needs no restart.

`active` is rewritten on every switch. When `auth.json` no longer holds the active identity's value — after a `/login`, say — `/ocgo-account` reports the drift and re-running it repairs the file. Identities are added and removed by hand: the command only exists while `ocgo.json` does.

## Requirements

A Go subscription with the `opencode-go` provider configured in pi:

```bash
pi auth login opencode-go
```

The extension reads that same API key through pi's model registry (`ctx.modelRegistry.getProviderAuth("opencode-go")`), including `!command` and `$ENV_VAR` key sources. It never stores or prints the key.

## Notes

- Calls `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>`.
- That endpoint is undocumented upstream ([anomalyco/opencode#16513](https://github.com/anomalyco/opencode/pull/16513)), so the response parser tolerates the shapes seen so far and omits fields it cannot find.
- Limits are per model: the 5-hour window is 20% of your monthly allowance, weekly 50%, monthly 100%. See [Go docs](https://opencode.ai/docs/console/go).

## Remove

```bash
pi remove git:github.com/S1M0N38/pi-ocgo
```

## Development

Iterate on the local checkout instead of pushing to GitHub for every edit:

```bash
pi remove git:github.com/S1M0N38/pi-ocgo
pi install ~/Code/github.com/S1M0N38/pi-ocgo   # loads from the path, edits are live
/ocgo-usage                                    # /reload after editing

pi remove ~/Code/github.com/S1M0N38/pi-ocgo    # back to the published clone
pi install git:github.com/S1M0N38/pi-ocgo
```

Pi identifies a local package by absolute path, so remove the git entry first or both load. `npm install && npm run typecheck` type-checks against installed peer dependencies; dev dependencies are not fetched for git packages.

`index.ts` is the package entry point; the implementation lives in `src/`.
