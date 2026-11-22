# apps/mobile — the Android shell

Empty on purpose. Run these two commands to populate it, then the CI workflow
(`.github/workflows/build-apk.yml`) stops skipping and starts producing signed APKs.

```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
npx cap init "device-agent" "app.deviceagent" --web-dir ../web
npx cap add android          # creates apps/mobile/android
npx cap sync
```

Read [`../../docs/ANDROID.md`](../../docs/ANDROID.md) first — Path A (sideload) is fine,
Path B (native accessibility tools) is the actual product, and Path C (Play) has a 15–30%
tax plus an accessibility-API review that you should not walk into unprepared.

What belongs in here, in this order:

1. `android/` Capacitor project, package `app.deviceagent`
2. `AgentAccessibility.kt` — screen dump / tap / type, exposed as `android.*` tools
3. `ApprovalOverlay.kt` — the sheet that shows the *literal* arguments before a mutation
4. `LedgerKeystore.kt` — HMAC key in the Android Keystore, so the chain is signed on-device
5. `KillSwitch.kt` — quick-settings tile that revokes the service immediately

Nothing here should contain business logic. The core stays portable so the same code runs
on a laptop, in CI, and in a WebView.