# Soullab Capture control protocol v1

Newline-delimited JSON over one Unix-domain stream socket. Each message is at most 64 KiB.

## Launch

The host launches the helper as follows:

```
soullab-capture-helper --root <dir> --socket <path> --token-file <path>
```

- `--root` is the storage folder the member chose through a native folder dialog. Symlinks are resolved once, and every take lives directly inside it.
- `--socket` must sit in a directory owned by the user with mode `0700`. The helper binds and listens under a temporary name, then renames the socket into place. **When the path appears, the helper is ready.** It accepts exactly one client, from the same user (`getpeereid`), then removes the socket file.
- `--token-file` must be a `0600` regular file owned by the user, holding 32–512 bytes.
- `--synthetic` exists only in DEBUG builds.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Normal exit; any take was finalized |
| 2 | Authentication failed or token missing |
| 64 | Usage error |
| 65 | Protocol violation (malformed or oversize line) |
| 69 | macOS earlier than 14.2 |

## Requests (host → helper)

Every request carries `"id"` (an integer ≥ 0) and `"type"`. The first request must be `hello`.

| type | fields | result |
|---|---|---|
| `hello` | `protocol: 1`, `token` | `{protocol, version, build: "debug"\|"release", mode: "processTap"\|"synthetic", recovery, orphansRemoved}` |
| `listSources` | — | `{sources: [{id, name, bundleID, pid, producingOutput}]}` |
| `prepare` | `sourceId`, `takeName`, `channels` (1\|2, default 2), `member?` (see below), `sampleRate?` (synthetic only) | `{state: "prepared"}` |
| `start` | — | `{state: "starting"}`. The process tap is created here and nowhere else. |
| `stop` | — | `{take: TakeResult \| null}` |
| `status` | — | `{state, generation, takeName, source, framesWritten, seconds, discontinuities}` |
| `shutdown` | — | `{take}`, then the helper exits 0 |

The `member` object may contain only these optional strings, each at most 1 KiB: `performer`, `consentRef`, `rightsNote`, `location`, `notes`.

## Responses and events

A response is `{"id", "ok": true, "result"}` or `{"id", "ok": false, "error": {"code"}}`.

Events (helper → host):

| event | fields |
|---|---|
| `state` | `state` (`idle`, `prepared`, `starting`, `recording`, `finalizing`), `generation` |
| `meter` | `peak[]`, `rms[]`, `truePeak[]` (linear, 1.0 = 0 dBFS), `clipSamples`, `seconds`. At most 20 Hz. |
| `discontinuity` | `kind` (`overrun`, `timestampGap`, `processorOverload`, `recovered`), `framePosition`, `lostFrames` |
| `storageLow` | `availableBytes` (sent once, below 1 GiB) |
| `finalized` | `take`: `{takeId, path, provenancePath, sha256, frames, sampleRate, channels, bitsPerSample: 24, durationSeconds, stopReason, recovered, discontinuities, clipSamples}` |
| `error` | `code` |

**Stop reasons:** `memberStop`, `sourceExited`, `deviceChanged`, `formatChanged`, `storageCritical`, `sizeLimit`, `sleep`, `terminated`, `clientDisconnected`, `sourceFailed`, `recovered`.

**Error codes (closed set):** `AUTH_FAILED`, `PROTOCOL_VIOLATION`, `INVALID_STATE`, `ALREADY_STARTING`, `INVALID_NAME`, `NAME_EXISTS`, `OUTSIDE_ROOT`, `ROOT_INVALID`, `INSUFFICIENT_STORAGE`, `FORMAT_UNSUPPORTED`, `SOURCE_NOT_FOUND`, `PERMISSION_DENIED`, `TAP_FAILED`, `IO_FAILED`, `WRITE_FAILED`, `UNSUPPORTED_PLATFORM`, `INVALID_REQUEST`.

## Host obligations (enforced by `js/captureClient.mjs`)

The host treats any of the following as a violation, closes the socket and kills the helper:
- a malformed, oversize or unknown message;
- an error code outside the closed set;
- a response to an unknown request;
- a protocol version other than 1;
- a request that times out.

## Lifecycle rules

- A dropped connection, `SIGTERM`, system sleep, the source app exiting, an output-device change or a tap-format change each **stop and finalize** the take. Wake does nothing.
- There is no auto-start and no auto-resume.
- A late start result for a cancelled or superseded start is discarded, and whatever it created is released.
