# pi-ocgo

Minimal [pi](https://pi.dev) extension that shows your OpenCode Go subscription usage.

```bash
pi install git:github.com/S1M0N38/pi-ocgo
```

## Usage

```
/ocgo-usage
```

```
5-hour window:   3% used Resets in 2h 5m
Weekly:         47% used Resets in 2d 09h
Monthly:       100% used Resets in 26d 05h
```

Labels are dim, reset countdowns are italic, values are column aligned. The block is written to the transcript as a custom entry, so it never enters the LLM context.

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
