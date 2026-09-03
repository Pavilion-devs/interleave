import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  PLANE_COMMIT,
  SAMPLE_PLANE_RECIPE,
  PlaneLab,
  reducePlaneFailure,
  replayPlaneRecipe,
} from '../lib/plane/lab.ts';
import {
  PlaneAdapter,
  planeRecipeFromSession,
  replayPlaneAsync,
} from '../lib/plane/adapter.ts';
import { exportPlaneRegression } from '../lib/plane/regression.ts';
import { closePlaneSession, parsePlaneSession } from '../lib/plane/session.ts';

test('current Plane behavior overwrites a later explicit metadata edit', async () => {
  const adapter = new PlaneAdapter('unguarded');
  const pending = adapter.crawl('Production runbook', 500, 'native');
  assert.equal(adapter.recorder.getSnapshot().entries[0].status, 'pending');
  adapter.editMetadata('Human verified runbook');
  assert.equal(
    adapter.readState().document.link.metadata.title,
    'Human verified runbook',
  );

  const result = await pending;
  assert.equal(result.assertion?.passed, false);
  assert.equal(
    result.assertion?.expectedMetadataTitle,
    'Human verified runbook',
  );
  assert.equal(result.assertion?.actualMetadataTitle, 'Plane documentation');
  assert.equal(result.document.link.metadata.source, 'crawler');
  adapter.dispose();
});

test('the proposed compare-and-set preserves metadata changed after dispatch', async () => {
  const adapter = new PlaneAdapter('guarded');
  const pending = adapter.crawl('Production runbook', 500, 'native');
  adapter.editMetadata('Human verified runbook');

  const result = await pending;
  assert.equal(result.document.phase, 'blocked');
  assert.equal(result.assertion?.passed, true);
  assert.equal(result.document.link.metadata.title, 'Human verified runbook');
  assert.equal(result.document.link.metadata.source, 'human');
  adapter.dispose();
});

test('a non-stale Plane crawl still applies under the proposed guard', () => {
  const lab = new PlaneLab('guarded');
  lab.startCrawl('Production runbook');
  const result = lab.release();
  assert.equal(result.document.phase, 'applied');
  assert.equal(result.assertion?.passed, true);
});

test('the actual pending operation can be held and cancelled safely', async () => {
  const adapter = new PlaneAdapter();
  const pending = adapter.crawl('Production runbook', 500, 'native');
  adapter.hold();
  adapter.editMetadata('Keep this metadata');
  assert.equal(adapter.operation.getSnapshot().held, true);
  adapter.cancel();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(
    adapter.readState().document.link.metadata.title,
    'Keep this metadata',
  );
  adapter.dispose();
});

test('recordings replay through the asynchronous Plane adapter', async () => {
  const original = new PlaneAdapter();
  const pending = original.crawl('Production runbook', 20000, 'native');
  original.operation.hold();
  original.editMetadata('Human verified runbook');
  original.complete();
  await pending;

  const imported = parsePlaneSession(
    JSON.stringify(original.recorder.getSnapshot()),
  );
  const recipe = planeRecipeFromSession(imported);
  assert.deepEqual(recipe, [
    { type: 'start_crawl', title: 'Production runbook' },
    { type: 'edit_metadata', title: 'Human verified runbook' },
    { type: 'release' },
  ]);
  const fixed = new PlaneAdapter('guarded');
  const result = await replayPlaneAsync(recipe, fixed);
  assert.equal(result.assertion?.completion, 'blocked');
  assert.equal(result.document.link.metadata.title, 'Human verified runbook');
  original.dispose();
  fixed.dispose();
});

test('reduction finds the minimal Plane worker race', () => {
  const result = reducePlaneFailure(SAMPLE_PLANE_RECIPE);
  assert.deepEqual(result.recipe, [
    { type: 'start_crawl', title: 'Production runbook' },
    { type: 'edit_metadata', title: 'Human verified runbook' },
    { type: 'release' },
  ]);
  assert.equal(result.original?.passed, false);
  assert.equal(result.guarded?.passed, true);
  assert.equal(
    replayPlaneRecipe(result.recipe, 'unguarded').assertion?.passed,
    false,
  );
});

test('unknown and unfinished imported Plane sessions cannot replay', async () => {
  const adapter = new PlaneAdapter();
  const pending = adapter.crawl('Production runbook', 20000, 'native');
  const interrupted = closePlaneSession(
    parsePlaneSession(JSON.stringify(adapter.recorder.getSnapshot())),
  );
  assert.throws(() => planeRecipeFromSession(interrupted), /Finish every/);
  adapter.cancel();
  await assert.rejects(pending);
  const unknown = structuredClone(adapter.recorder.getSnapshot());
  unknown.entries.find((entry) => entry.kind === 'state').input = {
    type: 'execute_code',
  };
  assert.throws(() => planeRecipeFromSession(unknown), /unsupported/);
  adapter.dispose();
});

test('generated regression passes proposed and fails current Plane behavior', async () => {
  const projectTest = join(
    process.cwd(),
    'tests',
    'generated-plane-regression.test.mjs',
  );
  try {
    await writeFile(projectTest, exportPlaneRegression(SAMPLE_PLANE_RECIPE));
    const cleanEnvironment = { ...process.env };
    delete cleanEnvironment.NODE_TEST_CONTEXT;
    const good = spawnSync(process.execPath, ['--test', projectTest], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: cleanEnvironment,
    });
    assert.equal(good.status, 0, good.stdout + good.stderr);
    const bad = spawnSync(process.execPath, ['--test', projectTest], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...cleanEnvironment,
        INTERLEAVE_IMPLEMENTATION: 'unguarded',
      },
    });
    assert.notEqual(
      bad.status,
      0,
      'Current Plane behavior should fail the exported test.',
    );
  } finally {
    await rm(projectTest, { force: true });
  }
});

test('the upstream patch is pinned and contains both dispatch and write guards', async () => {
  const patch = await readFile(
    join(process.cwd(), 'public', 'plane-9674.patch'),
    'utf8',
  );
  assert.equal(PLANE_COMMIT, 'da1a7ab85012d16836459a10dd92ec55eb739c69');
  assert.match(patch, /should_crawl/);
  assert.match(patch, /expected_updated_at/);
  assert.match(patch, /filter\(id=id, url=url\)/);
  assert.match(patch, /updated_at=timezone\.now\(\)/);
  assert.match(
    patch,
    /test_skips_metadata_when_the_link_changed_after_dispatch/,
  );
  assert.match(patch, /test_skips_legacy_task_without_a_revision/);
});
