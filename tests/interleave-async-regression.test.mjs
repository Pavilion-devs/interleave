// Save under tests/. This is an asynchronous adapter regression, not a model replay.
// Run: node --test tests/interleave-async-regression.test.mjs
// Verify the failing implementation: INTERLEAVE_IMPLEMENTATION=unguarded node --test tests/interleave-async-regression.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ReservationAdapter, replayAsyncRecipe } from '../lib/reservation-adapter.ts';

const recipe = [
  {
    "type": "begin"
  },
  {
    "type": "edit",
    "quantity": 1
  },
  {
    "type": "release"
  }
];
const implementation = process.env.INTERLEAVE_IMPLEMENTATION ?? 'guarded';

test('the latest human choice survives delayed completion and can be reserved', async () => {
  const adapter = new ReservationAdapter(implementation);
  try {
    const result = await replayAsyncRecipe(recipe, adapter);
    assert.equal(result.reservation.quantity, result.reservation.humanIntent, 'A delayed write overwrote the human choice');
    assert.equal(result.assertion.passed, true);
    if (result.reservation.phase === 'blocked') {
      const recovery = adapter.reserve(30000, 'replay');
      adapter.operation.completeNow();
      await recovery;
    }
    const final = adapter.readState();
    assert.equal(final.reservation.phase, 'committed');
    assert.equal(final.reservation.confirmed, final.reservation.humanIntent);
  } finally { adapter.dispose(); }
});
