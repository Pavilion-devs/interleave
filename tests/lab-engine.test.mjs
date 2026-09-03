import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReservationLab,
  SAMPLE_RECIPE,
  replayRecipe,
  reduceFailure,
  exportRegression,
} from '../lib/lab-engine.ts';

test('the sample witnesses a real lost update in the unguarded store', () => {
  const run = replayRecipe(SAMPLE_RECIPE, 'unguarded');
  assert.equal(run.reservation.humanIntent, 1);
  assert.equal(run.reservation.quantity, 2);
  assert.equal(run.reservation.confirmed, 2);
  assert.equal(run.assertion.passed, false);
  assert.equal(run.events.at(-1).before.quantity, 1);
  assert.equal(run.events.at(-1).after.quantity, 2);
});
test('the guard preserves intent without falsely reporting a completed reservation', () => {
  const run = replayRecipe(SAMPLE_RECIPE, 'guarded');
  assert.equal(run.reservation.quantity, 1);
  assert.equal(run.reservation.confirmed, null);
  assert.equal(run.reservation.phase, 'blocked');
  assert.equal(run.assertion.passed, true);
  assert.equal(run.assertion.completion, 'blocked');
});
test('a fresh capture after conflict completes the requested reservation', () => {
  const lab = new ReservationLab('guarded');
  for (const command of SAMPLE_RECIPE) lab.execute(command);
  lab.begin('native');
  lab.release('native');
  assert.equal(lab.getSnapshot().reservation.confirmed, 1);
  assert.equal(lab.getSnapshot().reservation.phase, 'committed');
  assert.equal(lab.getSnapshot().assertion.passed, true);
});
test('healthy interleavings pass under both implementations', () => {
  for (const mode of ['guarded', 'unguarded']) {
    const before = replayRecipe(
      [{ type: 'edit', quantity: 3 }, { type: 'begin' }, { type: 'release' }],
      mode,
    );
    assert.equal(before.assertion.passed, true);
    assert.equal(before.reservation.confirmed, 3);
    const noEdit = replayRecipe([{ type: 'begin' }, { type: 'release' }], mode);
    assert.equal(noEdit.assertion.passed, true);
    assert.equal(noEdit.reservation.confirmed, 2);
  }
});
test('every valid changed quantity produces the correct protected outcome', () => {
  for (const quantity of [1, 3, 4]) {
    const recipe = [
      { type: 'begin' },
      { type: 'edit', quantity },
      { type: 'release' },
    ];
    assert.equal(replayRecipe(recipe, 'unguarded').assertion.passed, false);
    assert.equal(
      replayRecipe(recipe, 'guarded').reservation.quantity,
      quantity,
    );
  }
});
test('invalid inputs and repeated releases leave the state untouched', () => {
  const lab = new ReservationLab();
  const initial = lab.getSnapshot();
  for (const quantity of [0, 5, 1.5, NaN, '1', undefined, null])
    assert.throws(() => lab.edit(quantity));
  assert.throws(() => lab.reset('invalid'));
  assert.throws(() => lab.release());
  assert.equal(lab.getSnapshot(), initial);
  lab.begin();
  const paused = lab.getSnapshot();
  assert.throws(() => lab.begin());
  assert.equal(lab.getSnapshot(), paused);
  lab.release();
  const committed = lab.getSnapshot();
  assert.throws(() => lab.release());
  assert.equal(lab.getSnapshot(), committed);
});
test('captured state and trace frames cannot be mutated by subscribers', () => {
  const lab = new ReservationLab();
  lab.begin();
  const snapshot = lab.getSnapshot();
  assert.throws(() => {
    snapshot.reservation.pending.quantity = 4;
  });
  assert.throws(() => {
    snapshot.events[0].after.quantity = 4;
  });
  lab.edit(1);
  assert.equal(snapshot.events[0].after.quantity, 2);
  assert.equal(lab.getSnapshot().events[0].after.quantity, 2);
});
test('reduction removes observations and rechecks all retained steps', () => {
  const result = reduceFailure(SAMPLE_RECIPE);
  assert.equal(result.originalLength, 6);
  assert.equal(result.reducedLength, 3);
  assert.deepEqual(result.recipe, [
    { type: 'begin' },
    { type: 'edit', quantity: 1 },
    { type: 'release' },
  ]);
  assert.equal(result.baseline.passed, false);
  assert.equal(result.guarded.passed, true);
  for (let i = 0; i < result.recipe.length; i++) {
    const candidate = result.recipe.filter((_, j) => j !== i);
    try {
      assert.notEqual(
        replayRecipe(candidate, 'unguarded').assertion?.passed,
        false,
      );
    } catch (error) {
      if (error.code === 'ERR_ASSERTION') throw error;
    }
  }
});
test('healthy recordings cannot be advertised as reduced failures', () => {
  assert.throws(
    () => reduceFailure([{ type: 'begin' }, { type: 'release' }]),
    /no reproducible/,
  );
  assert.throws(() => exportRegression([]), /no reproducible/);
});
test('provenance separates live calls from replayed and injected events', () => {
  const lab = new ReservationLab();
  lab.begin('native');
  lab.edit(1, 'manual');
  lab.release('native');
  assert.deepEqual(
    lab.getSnapshot().events.map((e) => e.source),
    ['native', 'manual', 'native'],
  );
  const replay = replayRecipe(lab.getSnapshot().recipe, 'unguarded');
  assert.ok(replay.events.every((e) => e.source === 'replay'));
  assert.equal(replay.events[1].title, 'Injected human edit');
});
