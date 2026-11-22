# Signing keystore

Generated on this device at `apps/mobile/android/release.jks`.

```
alias       deviceagent
keyalg      RSA 2048
validity    10000 days  (until 2054-04-09)
storetype   PKCS12
SHA256      85:EB:62:09:18:80:45:7E:37:EC:CA:71:57:A2:B6:F4:2E:9A:70:45:D9:E3:9A:86:79:C4:CD:EA:FE:31:64:A4
```

## Back this up now, before anything else

Three gitignored files sit next to this one:

| File | What it is |
|---|---|
| `release.jks` | the signing key. **Lose it and you can never update the app again** |
| `release.jks.b64` | the same key, base64, for pasting into GitHub's `KEYSTORE_BASE64` secret |
| `keystore-password.txt` | the store/key password (identical, PKCS12 requires it) |

Move all three somewhere that is not this phone: a password manager, an encrypted archive on
a machine you control. Then confirm nothing leaked into git:

```bash
cd /workspace/device-agent
git check-ignore -v apps/mobile/android/release.jks apps/mobile/android/release.jks.b64 apps/mobile/android/keystore-password.txt
```

Verified: all three are ignored.

## Put them into GitHub secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | contents of `release.jks.b64` (one line, no newlines) |
| `KEYSTORE_PASSWORD` | contents of `keystore-password.txt` |
| `KEY_ALIAS` | `deviceagent` |
| `KEY_PASSWORD` | same as `KEYSTORE_PASSWORD` |

Then: Actions → `build-apk` → Run workflow. The APK arrives as a release asset with a
`.sha256` beside it.

## Why the build happens on a runner, not here

Verified on this device, 2026-11-22:

```
build-tools_r35.0.1_linux.zip → android-15/aapt2
ELF class: 64-bit
e_machine: 0x3e   (x86-64)
this host: aarch64
$ ./aapt2 version
cannot execute: required file not found
```

The Android SDK publishes host binaries for `linux`, `windows` and `macosx` with no
architecture variants — the Linux tools are x86-64 only. On an aarch64 host they cannot
execute. `d8`, the dex compiler, is in the same package and has the same problem.

So an APK cannot be produced on this device without x86-64 emulation. It can be produced on
GitHub's runners in about five minutes, which is what `.github/workflows/build-apk.yml` does.
The keystore is the only part that had to be generated locally, and it is now done.
