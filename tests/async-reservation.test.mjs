import test from 'node:test';
import assert from 'node:assert/strict';
import { ReservationAdapter, replayAsyncRecipe, recipeFromSession } from '../lib/reservation-adapter.ts';
import { SAMPLE_RECIPE } from '../lib/lab-engine.ts';
import { parseSession, closeInterruptedSession } from '../lib/session-archive.ts';

test('one call stays pending during an edit and finishes without a release call', async () => {
  const adapter=new ReservationAdapter('unguarded');let finished=false;
  const promise=adapter.reserve(500,'native').then(result=>{finished=true;return result;});
  assert.equal(finished,false);assert.equal(adapter.recorder.getSnapshot().entries[0].status,'pending');
  adapter.edit(1,'manual');assert.equal(finished,false);
  const result=await promise;
  assert.equal(result.reservation.quantity,2);assert.equal(result.reservation.humanIntent,1);assert.equal(result.assertion.passed,false);
  const call=adapter.recorder.getSnapshot().entries[0];
  assert.equal(call.status,'fulfilled');assert.deepEqual(call.input,{delayMs:500});assert.ok(call.durationMs>=400);
  assert.equal(call.output.assertion.passed,false);assert.equal(call.before.reservation.revision,0);assert.equal(call.after.reservation.revision,2);adapter.dispose();
});
test('guarded completion preserves intent and a fresh call completes recovery', async () => {
  const adapter=new ReservationAdapter('guarded');const first=adapter.reserve(500,'native');adapter.edit(3);
  const blocked=await first;assert.equal(blocked.reservation.quantity,3);assert.equal(blocked.reservation.confirmed,null);assert.equal(blocked.reservation.phase,'blocked');
  const recovery=adapter.reserve(30000,'native');adapter.release();const complete=await recovery;
  assert.equal(complete.reservation.confirmed,3);assert.equal(complete.reservation.phase,'committed');assert.equal(adapter.operation.getSnapshot(),null);adapter.dispose();
});
test('holding completion retains the same promise until released', async () => {
  const adapter=new ReservationAdapter();const pending=adapter.reserve(500,'native');adapter.hold();
  assert.equal(adapter.operation.getSnapshot().held,true);adapter.edit(4);adapter.release();
  assert.equal((await pending).assertion.passed,false);assert.equal(adapter.recorder.getSnapshot().entries.filter(entry=>entry.name==='reservation_reserve').length,1);adapter.dispose();
});
test('caller cancellation rejects the call without committing the captured value', async () => {
  const adapter=new ReservationAdapter();const abort=new AbortController();const pending=adapter.reserve(30000,'native',abort.signal);
  adapter.edit(1);abort.abort();await assert.rejects(pending,{name:'AbortError'});
  assert.equal(adapter.readState().reservation.quantity,1);assert.equal(adapter.readState().reservation.confirmed,null);assert.equal(adapter.readState().reservation.phase,'cancelled');
  assert.equal(adapter.recorder.getSnapshot().entries[0].status,'cancelled');assert.throws(()=>adapter.release());adapter.dispose();
});
test('invalid delays, duplicates, and pre-aborted calls are recorded without changing selection', async () => {
  const adapter=new ReservationAdapter();
  for(const delay of [0,499,30001,'1000',NaN])await assert.rejects(adapter.reserve(delay,'native'));
  assert.equal(adapter.lab.getSnapshot().events.length,0);
  const abort=new AbortController();abort.abort();await assert.rejects(adapter.reserve(500,'native',abort.signal),{name:'AbortError'});
  const pending=adapter.reserve(30000,'native');await assert.rejects(adapter.reserve(500,'native'),/already pending/);
  adapter.cancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(adapter.readState().reservation.quantity,2);
  assert.equal(adapter.recorder.getSnapshot().entries.filter(entry=>entry.status==='rejected').length,6);adapter.dispose();
});
test('reset cancels an old call and excludes late results from the new session', async () => {
  const adapter=new ReservationAdapter();const oldId=adapter.recorder.getSnapshot().id;
  const pending=adapter.reserve(30000,'native');adapter.edit(1);adapter.reset('guarded');
  assert.notEqual(oldId,adapter.recorder.getSnapshot().id);await assert.rejects(pending,{name:'AbortError'});assert.equal(adapter.recorder.getSnapshot().entries.length,0);
  const fresh=adapter.reserve(30000,'native');adapter.release();await fresh;assert.equal(adapter.readState().reservation.confirmed,2);assert.equal(adapter.recorder.getSnapshot().entries[0].status,'fulfilled');adapter.dispose();
});
test('a JSON recording replays through actual async checkpoints', async () => {
  const original=new ReservationAdapter();const first=original.reserve(30000,'native');original.hold();original.edit(1);original.release();await first;
  const imported=parseSession(JSON.stringify(original.recorder.getSnapshot()));
  assert.deepEqual(recipeFromSession(imported),[{type:'begin'},{type:'edit',quantity:1},{type:'release'}]);
  const fixed=new ReservationAdapter('guarded');const result=await replayAsyncRecipe(recipeFromSession(imported),fixed);
  assert.equal(result.assertion.passed,true);assert.equal(fixed.recorder.getSnapshot().entries.find(entry=>entry.name==='reservation_reserve').source,'replay');original.dispose();fixed.dispose();
});
test('healthy schedules remain healthy in both implementations', async () => {
  for(const mode of ['unguarded','guarded']){const adapter=new ReservationAdapter(mode);const result=await replayAsyncRecipe([{type:'edit',quantity:4},{type:'begin'},{type:'release'}],adapter);assert.equal(result.assertion.passed,true);assert.equal(result.reservation.confirmed,4);adapter.dispose();}
});
test('incomplete and corrupt imports cannot execute unsupported actions', async () => {
  const adapter=new ReservationAdapter();const pending=adapter.reserve(30000,'native');
  const interrupted=closeInterruptedSession(parseSession(JSON.stringify(adapter.recorder.getSnapshot())));assert.throws(()=>recipeFromSession(interrupted),/unfinished/);
  assert.throws(()=>parseSession('{bad json'));assert.throws(()=>parseSession(JSON.stringify({...interrupted,adapter:{id:'unknown',version:2}})),/supported/);
  adapter.cancel();await assert.rejects(pending);
  const unknown=structuredClone(adapter.recorder.getSnapshot());unknown.entries.find(entry=>entry.kind==='state').input={type:'execute_code',code:'forbidden'};
  assert.throws(()=>recipeFromSession(unknown),/Unsupported/);adapter.dispose();
});
test('stopping an old replay does not cancel a newly started call', async () => {
  const adapter=new ReservationAdapter();let nextStep;let steps=0;
  const replay=replayAsyncRecipe(SAMPLE_RECIPE,adapter,()=>++steps<3?Promise.resolve():new Promise((resolve,reject)=>{nextStep=reject;}));
  for(let i=0;i<10&&!nextStep;i++)await Promise.resolve();assert.ok(nextStep);adapter.reset('guarded');
  const fresh=adapter.reserve(30000,'native');const freshId=adapter.operation.getSnapshot().id;
  nextStep(new DOMException('Replay stopped.','AbortError'));await assert.rejects(replay);assert.equal(adapter.operation.getSnapshot().id,freshId);adapter.release();await fresh;adapter.dispose();
});
