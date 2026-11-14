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

## Accounts

Optional, for more than one Go subscription. Keep the keys in the keychain and let the extension pick which one pi uses. `ocgo.json` sits next to `auth.json` — `~/.pi/agent/ocgo.json`, or `$PI_CODING_AGENT_DIR/ocgo.json` when that is set:

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
/ocgo-account             # active: personal · accounts: ...
/ocgo-account university  # switch
```

A switch copies the identity's value into `opencode-go.key` in `auth.json` and nothing else: a `!command` stays a reference, so no secret passes through the extension. It takes effect on the next request, no restart or reload.

## Requirements

A Go subscription with the `opencode-go` provider configured in pi:

```bash
pi auth login opencode-go
```

The extension reads the key through pi's model registry, including `!command` and `$ENV_VAR` sources, and never stores or prints it.

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
