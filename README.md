# pi-ocgo

Minimal [pi](https://pi.dev) extension that shows your OpenCode Go subscription usage and rotates between several subscriptions.

## Install

Requires a Go subscription with the `opencode-go` provider configured in pi:

```bash
pi auth login opencode-go
pi install git:github.com/S1M0N38/pi-ocgo
```

`/ocgo-usage` works right away. Account rotation is optional and needs a config file — see [Configuration](#configuration).

### Uninstall

```bash
pi remove git:github.com/S1M0N38/pi-ocgo
```

## Configuration

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

`accounts` maps an identity to a credential reference, using the same `!cmd`, `$ENV_VAR`
or literal forms as `auth.json`. `active` records the last identity activated through
this extension.

`/ocgo-account` is registered only when this file exists. Delete the file to remove the
command; nothing else in the extension depends on it.

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

```
/ocgo-account             # active: personal · accounts: ...
/ocgo-account university  # switch
```

`/ocgo-account` reports `active: none` before the first switch, flags an identity that is
no longer in `accounts`, and flags drift when `auth.json` no longer holds the active
identity's key. A switch copies the identity's value into `opencode-go.key` in `auth.json`
and nothing else: a `!command` stays a reference, so no secret passes through the
extension. It takes effect on the next request, with no restart or reload.

Limits are per model: the 5-hour window is 20% of your monthly allowance, weekly 50%,
monthly 100%. See [Go docs](https://opencode.ai/docs/console/go).

## Contributing

If you are a coding agent and you intend to change anything in this repository, read [CONTRIBUTING.md](CONTRIBUTING.md) first. It holds the local development loop, the checks, and a pointer to [ARCHITECTURE.md](ARCHITECTURE.md).
