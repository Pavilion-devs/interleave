import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  PLANE_COMMIT,
  PLANE_RULE,
  replayPlaneRecipe,
} from '../lib/plane/lab.ts';
import { exportPlaneRegression } from '../lib/plane/regression.ts';
import { planeToolDefinitions } from '../lib/plane/webmcp-tools.ts';

test('published browser acceptance stays consistent with the executable Plane proof', async () => {
  const acceptance = JSON.parse(
    await readFile(
      join(process.cwd(), 'public', 'webmcp-plane-acceptance.json'),
      'utf8',
    ),
  );
  const patch = await readFile(
    join(process.cwd(), 'public', 'plane-9674.patch'),
  );
  const regression = await readFile(
    join(process.cwd(), 'public', 'interleave-plane-regression.test.mjs'),
    'utf8',
  );

  assert.equal(acceptance.schemaVersion, 1);
  assert.equal(acceptance.environment.api, 'document.modelContext');
  assert.equal(acceptance.target.commit, PLANE_COMMIT);
  assert.equal(acceptance.target.liveSystemsContacted, false);
  assert.equal(
    acceptance.nativeWebMcp.idleToolCount,
    planeToolDefinitions({
      pending: false,
      held: false,
    }).length,
  );
  assert.equal(acceptance.nativeWebMcp.raceTool.status, 'fulfilled');
  assert.equal(acceptance.incident.rule, PLANE_RULE);
  assert.deepEqual(
    acceptance.incident.events.map(({ actor, source, kind }) => ({
      actor,
      source,
      kind,
    })),
    [
      { actor: 'agent', source: 'native', kind: 'dispatch' },
      { actor: 'human', source: 'manual', kind: 'edit' },
      { actor: 'worker', source: 'native', kind: 'violation' },
    ],
  );
  assert.ok(
    acceptance.incident.events[0].elapsedMs <
      acceptance.incident.events[1].elapsedMs,
  );
  assert.ok(
    acceptance.incident.events[1].elapsedMs <
      acceptance.incident.events[2].elapsedMs,
  );
  assert.equal(acceptance.incident.verdict.expected, 'Human verified runbook');
  assert.equal(acceptance.incident.verdict.actual, 'Plane documentation');

  const current = replayPlaneRecipe(acceptance.reduction.recipe, 'unguarded');
  const guarded = replayPlaneRecipe(acceptance.reduction.recipe, 'guarded');
  assert.equal(current.assertion?.passed, false);
  assert.equal(current.assertion?.actualMetadataTitle, 'Plane documentation');
  assert.equal(guarded.assertion?.passed, true);
  assert.equal(
    guarded.assertion?.actualMetadataTitle,
    'Human verified runbook',
  );

  assert.equal(
    createHash('sha256').update(patch).digest('hex'),
    acceptance.exports.upstreamPatch.sha256,
  );
  assert.equal(
    regression,
    exportPlaneRegression(acceptance.reduction.recipe),
    'The public regression must be the exact standalone export of the witnessed recipe.',
  );
  assert.equal(
    acceptance.exports.regression.generatedCharacters,
    regression.length,
  );
});
