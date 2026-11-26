import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from '../packages/core/src/agent.js';

const KEYS = ['ENV_QUOTED', 'ENV_COMMENT', 'ENV_BLANK', 'ENV_SPACED', 'ENV_SINGLE', 'ENV_PRESENT'];

function withFixture(body, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'device-agent-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, body);
  for (const k of KEYS) delete process.env[k];
  try { return fn(file); }
  finally {
    for (const k of KEYS) delete process.env[k];
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('loadEnv parses quoted values, inline comments, blanks and whitespace', () => {
  withFixture(
    'ENV_QUOTED="hello world"\n' +
    'ENV_COMMENT=value # trailing comment\n' +
    'ENV_BLANK=\n' +
    'ENV_SPACED=  padded  \n' +
    'ENV_SINGLE=\'single\'\n' +
    '# ENV_IGNORED=nope\n',
    (file) => {
      loadEnv(file);
      assert.equal(process.env.ENV_QUOTED, 'hello world');
      assert.equal(process.env.ENV_COMMENT, 'value');
      assert.equal(process.env.ENV_BLANK, '');
      assert.equal(process.env.ENV_SPACED, 'padded');
      assert.equal(process.env.ENV_SINGLE, 'single');
      assert.equal(process.env.ENV_IGNORED, undefined);
    },
  );
});

test('loadEnv does not overwrite an existing process.env value', () => {
  withFixture('ENV_PRESENT=from-file\n', (file) => {
    process.env.ENV_PRESENT = 'from-env';
    loadEnv(file);
    assert.equal(process.env.ENV_PRESENT, 'from-env');
  });
});
