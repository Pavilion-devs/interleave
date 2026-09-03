import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ADD_ITEM,
  REMOVE_COMPLETED_ITEMS,
  TOGGLE_ITEM,
  todoReducer,
} from '../lib/todomvc/upstream-reducer.ts';
import {
  SAMPLE_TODO_RECIPE,
  reduceTodoFailure,
  replayTodoRecipe,
} from '../lib/todomvc/lab.ts';
import {
  TodoAdapter,
  replayTodoAsync,
  todoRecipeFromSession,
} from '../lib/todomvc/adapter.ts';
import { exportTodoRegression } from '../lib/todomvc/regression.ts';
import { closeTodoSession, parseTodoSession } from '../lib/todomvc/session.ts';

test('the integration uses TodoMVC reducer behavior for add, toggle, and clear', () => {
  let todos = todoReducer([], { type: ADD_ITEM, payload: { title: 'One' } });
  assert.equal(todos.length, 1);
  assert.equal(todos[0].completed, false);
  todos = todoReducer(todos, {
    type: TOGGLE_ITEM,
    payload: { id: todos[0].id },
  });
  assert.equal(todos[0].completed, true);
  assert.deepEqual(todoReducer(todos, { type: REMOVE_COMPLETED_ITEMS }), []);
});

test('one delayed TodoMVC call loses a real human addition in seeded mode', async () => {
  const adapter = new TodoAdapter('unguarded');
  const pending = adapter.clear(500, 'native');
  assert.equal(adapter.recorder.getSnapshot().entries[0].status, 'pending');
  adapter.add('Human follow-up', 'manual');
  assert.ok(
    adapter
      .readState()
      .document.todos.some((todo) => todo.title === 'Human follow-up'),
  );
  const result = await pending;
  assert.equal(result.assertion?.passed, false);
  assert.equal(
    result.assertion?.message,
    'The stale replacement erased “Human follow-up”.',
  );
  assert.ok(
    !result.document.todos.some((todo) => todo.title === 'Human follow-up'),
  );
  const call = adapter.recorder
    .getSnapshot()
    .entries.find((entry) => entry.name === 'todos_clear_completed_slow');
  assert.equal(call.status, 'fulfilled');
  assert.equal(call.before.document.revision, 0);
  assert.equal(call.after.document.revision, 2);
  adapter.dispose();
});

test('the guard preserves the todo and a fresh retry completes the operation', async () => {
  const adapter = new TodoAdapter('guarded');
  const first = adapter.clear(500, 'native');
  adapter.add('Human follow-up');
  const blocked = await first;
  assert.equal(blocked.document.phase, 'blocked');
  assert.equal(blocked.assertion?.passed, true);
  assert.ok(
    blocked.document.todos.some((todo) => todo.title === 'Human follow-up'),
  );

  const retry = adapter.clear(20000, 'native');
  adapter.operation.completeNow();
  const recovered = await retry;
  assert.equal(recovered.document.phase, 'applied');
  assert.ok(
    recovered.document.todos.some((todo) => todo.title === 'Human follow-up'),
  );
  assert.ok(recovered.document.todos.every((todo) => !todo.completed));
  adapter.dispose();
});

test('hold and cancellation preserve the live TodoMVC list', async () => {
  const adapter = new TodoAdapter();
  const pending = adapter.clear(500, 'native');
  adapter.hold();
  adapter.add('Keep me');
  assert.equal(adapter.operation.getSnapshot().held, true);
  adapter.cancel();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.ok(
    adapter.readState().document.todos.some((todo) => todo.title === 'Keep me'),
  );
  assert.equal(adapter.recorder.getSnapshot().entries[0].status, 'cancelled');
  adapter.dispose();
});

test('recordings validate and replay through the asynchronous TodoMVC adapter', async () => {
  const original = new TodoAdapter();
  const pending = original.clear(20000, 'native');
  original.operation.hold();
  original.add('Human follow-up');
  original.complete();
  await pending;
  const imported = parseTodoSession(
    JSON.stringify(original.recorder.getSnapshot()),
  );
  const recipe = todoRecipeFromSession(imported);
  assert.deepEqual(recipe, [
    { type: 'start_clear' },
    { type: 'add', title: 'Human follow-up' },
    { type: 'release' },
  ]);
  const fixed = new TodoAdapter('guarded');
  const result = await replayTodoAsync(recipe, fixed);
  assert.equal(result.assertion?.completion, 'blocked');
  assert.ok(
    result.document.todos.some((todo) => todo.title === 'Human follow-up'),
  );
  original.dispose();
  fixed.dispose();
});

test('reduction finds the minimal witnessed TodoMVC race', () => {
  const result = reduceTodoFailure(SAMPLE_TODO_RECIPE);
  assert.deepEqual(result.recipe, [
    { type: 'start_clear' },
    { type: 'add', title: 'Human follow-up' },
    { type: 'release' },
  ]);
  assert.equal(result.original?.passed, false);
  assert.equal(result.guarded?.passed, true);
  assert.equal(
    replayTodoRecipe(result.recipe, 'unguarded').assertion?.passed,
    false,
  );
});

test('unfinished, unknown, and unsupported imported sessions cannot replay', async () => {
  const adapter = new TodoAdapter();
  const pending = adapter.clear(20000, 'native');
  const interrupted = closeTodoSession(
    parseTodoSession(JSON.stringify(adapter.recorder.getSnapshot())),
  );
  assert.throws(() => todoRecipeFromSession(interrupted), /Finish every/);
  assert.throws(
    () =>
      parseTodoSession(
        JSON.stringify({
          ...interrupted,
          adapter: { id: 'other', version: 1 },
        }),
      ),
    /supported/,
  );
  adapter.cancel();
  await assert.rejects(pending);
  const unknown = structuredClone(adapter.recorder.getSnapshot());
  unknown.entries.find((entry) => entry.kind === 'state').input = {
    type: 'execute_code',
  };
  assert.throws(() => todoRecipeFromSession(unknown), /unsupported/);
  adapter.dispose();
});

test('exported TodoMVC regression passes patched and fails seeded implementations', async () => {
  const projectTest = join(
    process.cwd(),
    'tests',
    'generated-todomvc-regression.test.mjs',
  );
  try {
    await writeFile(projectTest, exportTodoRegression(SAMPLE_TODO_RECIPE));
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
      env: { ...cleanEnvironment, INTERLEAVE_IMPLEMENTATION: 'unguarded' },
    });
    assert.notEqual(
      bad.status,
      0,
      'Seeded implementation should fail the exported test.',
    );
  } finally {
    await rm(projectTest, { force: true });
  }
});
