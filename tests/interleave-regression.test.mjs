// Save in this project's tests/ directory. Run: node --test tests/interleave-regression.test.mjs
// Seeded reservation fixture; checks actual application state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayRecipe } from '../lib/lab-engine.ts';

const recipe = [
  {
    type: 'begin',
  },
  {
    type: 'edit',
    quantity: 1,
  },
  {
    type: 'release',
  },
];

test('the stale-write fixture reproduces the defect', () => {
  const run = replayRecipe(recipe, 'unguarded');
  assert.equal(run.assertion.passed, false);
  assert.notEqual(run.reservation.quantity, run.reservation.humanIntent);
});

test('version checking preserves the newer human selection', () => {
  const run = replayRecipe(recipe, 'guarded');
  assert.equal(run.assertion.passed, true);
  assert.equal(run.reservation.quantity, run.reservation.humanIntent);
  assert.equal(run.reservation.phase, 'blocked');
  assert.equal(run.reservation.confirmed, null);
});
