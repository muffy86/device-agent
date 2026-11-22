# Contributing

The bar is: **does it make the receipt more trustworthy, or the device surface more useful?**
Features that only make the output feel better are declined, kindly.

## Ground rules

1. **No new dependencies in `packages/core`.** The zero-dependency property is the reason
   the project runs on a phone, inside a WebView, with no build step. Tools and SDKs belong
   in `apps/` or in optional packages.
2. **Every new tool declares a contract.** `parameters` with types, `mutating` flag set
   honestly. If it can change the world, it must be `mutating: true`.
3. **Every refusal is logged.** `tool_denied` with the reason. Silence is not allowed in the
   ledger.
4. **Every money path is metered before it spends.** Never after.
5. **Tests come with the PR.** `npm test` must pass, and new behaviour needs a test that
   fails without your change.

## Good first issues

Look for the `good first issue` label. The eight that always exist:

- `fs.stat` tool (size, mtime, permissions) with a test
- `fs.search` honouring a real glob (`**/*.md`) instead of substring matching
- Anthropic streaming deltas in `providers.js`
- Google `functionResponse` should carry the tool name, not `'tool'`
- Ledger rotation: append-only file that rolls at N bytes and keeps the chain valid
- `--json` output schema documented with a JSON Schema file and a validator test
- Web client: render `tool_denied` as a distinct card with the reason
- `docs/` example: a 20-line MCP stdio bridge adapter

## Running the thing

```bash
npm test                                   # 10 tests, no install
node apps/cli/index.js --mock --yes "what is in this repo"
DEVICE_AGENT_TOKEN=t npm run serve         # then open http://127.0.0.1:8787
```

## Commit style

`scope: what changed` — `tools: refuse symlink escapes in safeJoin`. One idea per commit.
Reference the issue. If it changes the ledger format, that is a breaking change: bump the
format version in the record and document the migration.

## Security

Anything that could let a tool output escalate privilege (path traversal, command
injection, egress) is a security issue, not a bug. Open a draft advisory rather than a PR
with the exploit in it.