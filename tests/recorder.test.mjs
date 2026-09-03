import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionRecorder } from '../packages/recorder/src/index.ts';

test('generic document adapter records interleavings and preserves returned data', async () => {
  let document={text:'draft',revision:0};const recorder=new SessionRecorder({adapter:{id:'document-example',version:1},readState:()=>document});let finish;
  const call=recorder.run('save_document',{revision:0},'native',()=>new Promise(resolve=>{finish=resolve;}));
  const before=document;document={text:'human edit',revision:1};recorder.stateChange('edit_document',{text:'human edit'},before,document,'manual');
  finish({saved:false,reason:'conflict'});assert.deepEqual(await call,{saved:false,reason:'conflict'});
  const session=recorder.getSnapshot();assert.equal(session.entries[0].before.text,'draft');assert.equal(session.entries[0].after.text,'human edit');assert.equal(session.entries[1].source,'manual');assert.throws(()=>{session.entries[0].input.revision=8;});
});
test('redaction affects recordings without changing application input or output', () => {
  const recorder=new SessionRecorder({adapter:{id:'redacted',version:1},readState:()=>({count:1}),redact:(value,field)=>field==='input'||field==='output'?{safe:value.safe}:value});
  const input={safe:1,secret:'keep out'};const result=recorder.run('echo',input,'native',()=>input);
  assert.equal(result,input);assert.equal(result.secret,'keep out');assert.deepEqual(recorder.getSnapshot().entries[0].input,{safe:1});assert.ok(!JSON.stringify(recorder.getSnapshot()).includes('keep out'));
});
test('sync exceptions and async rejections preserve their original identity', async () => {
  const recorder=new SessionRecorder({adapter:{id:'errors',version:1},readState:()=>({ok:true})});const failure=new Error('original failure');
  assert.throws(()=>recorder.run('sync',{},'native',()=>{throw failure;}),error=>error===failure);
  await assert.rejects(recorder.run('async',{},'native',()=>Promise.reject(failure)),error=>error===failure);assert.ok(recorder.getSnapshot().entries.every(entry=>entry.status==='rejected'));
});
test('late results cannot overwrite new recordings and bounded logs report truncation', async () => {
  const recorder=new SessionRecorder({adapter:{id:'bounded',version:1},readState:()=>({value:1}),maxEntries:10});let finish;
  const old=recorder.run('old',{},'native',()=>new Promise(resolve=>{finish=resolve;}));recorder.newSession();const id=recorder.getSnapshot().id;finish('done');await old;
  assert.equal(recorder.getSnapshot().id,id);assert.equal(recorder.getSnapshot().entries.length,0);
  for(let i=0;i<15;i++)recorder.run('value',{i},'manual',()=>i);assert.equal(recorder.getSnapshot().entries.length,10);assert.equal(recorder.getSnapshot().droppedEntries,5);
});
