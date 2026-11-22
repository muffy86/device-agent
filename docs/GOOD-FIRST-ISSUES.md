# Good first issues — 10, each with a file and an acceptance test

Copy each block into a GitHub issue with the `good first issue` label. The point of an
acceptance test in the issue text is that a contributor can tell whether they are done
without asking you, which is what keeps the queue moving.

---

**1. `fs.stat` tool**
`packages/core/src/tools.js`
Read-only tool returning size, mtime, directory flag, permissions for one path. Register it
in the same style as `fs.read`.
*Accept:* `tests/tools.test.js` covers a missing file (`not_found`) and a path outside root
(`path_escape`).

**2. Real glob support in `fs.search`**
`packages/core/src/tools.js`
Currently the `glob` argument is a substring match. Make `**/*.md` and `src/**/*.js` work
without adding a dependency.
*Accept:* a test with a nested fixture tree asserting `**/*.md` excludes `.js` files.

**3. Anthropic streaming deltas**
`packages/core/src/providers.js`
`anthropicProvider` returns whole blocks. Stream text deltas via `onDelta`, accumulating
`tool_use` blocks the same way the OpenAI path does.
*Accept:* a unit test with a stubbed SSE body asserting deltas arrive in order and tool calls
are stitched correctly.

**4. Google tool response carries the tool name**
`packages/core/src/providers.js` → `toGoogleContents`
`functionResponse` currently sends `name: 'tool'` when the name is unknown, which breaks
Gemini's matching.
*Accept:* test asserting the emitted `functionResponse.name` equals the assistant's
`toolCalls[0].name`.

**5. Ledger rotation**
`packages/core/src/ledger.js`
Append-only JSONL grows forever. Roll to `events.1.jsonl` at N bytes while keeping the chain
valid across the roll (store the previous file's head hash as the next file's genesis).
*Accept:* a test that writes past the threshold and verifies both files.

**6. `--json` output schema + validator**
`apps/cli/index.js`, new `docs/schema/events.json`
Document the event stream and validate it in a test so `--json` consumers can rely on it.
*Accept:* `npm test` fails if any emitted event type is missing from the schema.

**7. Render `tool_denied` distinctly in the web client**
`apps/web/index.html`
Denials currently reuse the error card. Give them their own card with the reason and the
approval affordance stubbed out for the server flow.
*Accept:* manual check in the README + a screenshot in the PR.

**8. Batch approvals with a diff**
`packages/core/src/tools.js`
For runs requesting several mutations, show one approval with a diff instead of N prompts.
Cap at 5 mutations per task.
*Accept:* test asserting a 6-mutation run is truncated with a clear reason recorded in the
ledger.

**9. MCP stdio bridge example**
new `examples/mcp-stdio/`
A 20-line adapter that exposes `fs.read` and `fs.list` over MCP stdio, proving the tool
registry can back a server.
*Accept:* `node examples/mcp-stdio/index.js` responds to a `tools/list` request from a pipe.

**10. `.env` parsing test**
`packages/core/src/agent.js` → `loadEnv`
Quoted values, comments and whitespace are handled by eye, not by test.
*Accept:* fixture `.env` with quotes, `#` comments and a blank value; assert parsed values
and that existing `process.env` wins.