# Android — from this repo to an installable APK

Three paths. They are not equivalent, and the order matters.

---

## Path A — sideload (fastest, use this first)

No store, no review, no revenue share. Put a signed APK on GitHub Releases.

```bash
# 1. wrap the existing web client (2 commands)
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
npx cap init "device-agent" "app.deviceagent" --web-dir apps/web
npx cap add android
npx cap sync

# 2. the app now loads apps/web/index.html inside a WebView.
#    Point the client at your core: either
#      - loopback to a Core running under Termux, or
#      - bundle a small native bridge (see Path B)
```

### Signing (do this once, keep the keystore forever)

```bash
keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias deviceagent -storetype JKS
base64 -w0 release.jks > release.jks.b64   # paste into GitHub secret KEYSTORE_BASE64
```

Lose the keystore and you can never update the app again. Back it up somewhere that is not
this phone.

### CI build

`.github/workflows/build-apk.yml` in this repo does exactly this on a GitHub runner — the
phone never compiles anything. Required secrets:

| Secret | What |
|---|---|
| `KEYSTORE_BASE64` | the base64 keystore from above |
| `KEYSTORE_PASSWORD` | store password |
| `KEY_ALIAS` | `deviceagent` |
| `KEY_PASSWORD` | key password |

The workflow skips itself cleanly until `android/` exists, so CI stays green today.

---

## Path B — native shell with real device tools (the actual product)

This is where the project becomes different from every self-hosted chat wrapper. Kotlin
hosts the UI and the privileged capability; the JS core stays portable and testable.

**Modules**

```
android/app/src/main/java/app/deviceagent/
  MainActivity.kt          WebView + foreground service for the core
  CoreService.kt           runs node core on a loopback socket (or JS-in-WebView)
  AgentAccessibility.kt    screen dump, tap, type, scroll — the only real way in
  NotifierBridge.kt        notification read/reply
  ApprovalOverlay.kt       the "agent wants to act" sheet with the exact args
  LedgerKeystore.kt        HMAC key in Android Keystore; signs each ledger append
```

**Tool namespace exposed to the core** (all `mutating: true` except reads):

| Tool | Args | Gate |
|---|---|---|
| `android.screen.dump` | `{}` → accessibility tree with node ids | read |
| `android.tap` | `{node_id}` or `{x,y}` | approval |
| `android.type` | `{node_id, text}` | approval |
| `android.open_app` | `{package}` | approval |
| `android.notifications` | `{limit}` | read (Android 13+ needs notification consent) |
| `android.calendar` | `{from,to}` | read (runtime permission) |

**Non-negotiables if you ship this:**

1. A persistent, unmissable indicator whenever the agent can act. Silent accessibility
   automation is how these apps get removed from the store *and* how they get used for harm.
2. The approval sheet shows the literal arguments (`tap node 41: "Send"`), not a summary.
3. Every action lands in the same hash-chained ledger as `fs.*`. One verifier, one story.
4. Kill switch: one tile/quick-setting that revokes the accessibility service immediately.

---

## Path C — Google Play (only after A and B work)

Costs and constraints:

| Item | Detail |
|---|---|
| Play Console | one-time $25 |
| Billing cut | 15% on the first $1M/yr of revenue, 30% above — **and digital goods in-app must use Play Billing** |
| Target API level | Play raises the minimum target API every year; check the current requirement before your first upload (it will be one or two API levels behind the newest release) |
| Data safety form | mandatory; must declare what you collect, including crash logs and any analytics |
| Accessibility API | Play restricts `AccessibilityService` to genuine accessibility or clearly documented use. You must declare and justify it in the listing and in-app. "Screen control for an AI agent" needs an explicit, honest disclosure and a user-facing enablement flow — do not ship it silently |
| Deceptive behaviour policy | apps that manipulate purchase flows or hide behaviour are removed outright [cite:e8c6bf][cite:cae8fe] |

**Subscription rules that decide your architecture:** you cannot ship a store-distributed
app whose only purchase path is an external payment link for digital goods. That means the
Play build must either (a) use Play Billing and give up 15–30%, or (b) be free on Play with
an account created elsewhere — which most reviewers will read as circumvention if the app
nags about it.

**Practical answer:** ship the **APK on GitHub Releases** and **on F-Droid** (free, no
billing machinery, no cut), and keep Play for a *limited, read-only* build later if the
distribution is worth the 15%.

### F-Droid recipe (the credibility channel)

F-Droid requires FOSS, no proprietary dependencies, no tracking, and a reproducible build.

```
metadata/app.deviceagent.yml      # summary, description, categories, licence
build:                            # auto-generated by `fdroid import`
  versionCode: 100
  build: npm run build && cd android && ./gradlew assembleRelease
  prebuild: apt-get install -y openjdk-17-jdk android-sdk
  ndk: r27
```

Include an `AntiFeatures:` line declaring anything that phones home. F-Droid reviewers read
it, and so do the people most likely to star your repo.

---

## Checklist before you call it "released"

- [ ] Install on a phone that has never seen the dev build
- [ ] Kill the app mid-run; reopen; ledger `--verify` still passes
- [ ] Revoke the accessibility service; the agent reports "cannot act" instead of crashing
- [ ] Airplane mode: the agent refuses remote tools with a clear message, local tools work
- [ ] A $0 cap run: the agent exits cleanly, no partial mutation
- [ ] Uninstall/reinstall: exported ledger verifies on a different machine