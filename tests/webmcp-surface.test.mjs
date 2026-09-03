import test from 'node:test';
import assert from 'node:assert/strict';

import { createSiteToolRegistry } from '../lib/webmcp.ts';
import { planeToolDefinitions } from '../lib/plane/webmcp-tools.ts';

const tick = () => new Promise((resolve) => setImmediate(resolve));

function tool(name, execute = () => ({ ok: true })) {
  return {
    name,
    title: name,
    description: `${name} test tool`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
    execute,
  };
}

test('state-aware registration waits for an active tool before replacing its surface', async () => {
  const registrations = [];
  const reports = [];
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      modelContext: {
        registerTool(registered, options) {
          registrations.push({ tool: registered, signal: options.signal });
        },
      },
    },
  });

  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const registry = createSiteToolRegistry((status, count) =>
    reports.push({ status, count }),
  );

  try {
    registry.update([tool('start', () => pending)]);
    await tick();
    assert.equal(registrations.length, 1);
    assert.equal(reports.at(-1).status, 'ready');

    const running = registrations[0].tool.execute({});
    registry.update([tool('complete')]);
    await tick();

    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].signal.aborted, false);

    release({ completed: true });
    await running;
    await tick();

    assert.equal(registrations.length, 2);
    assert.equal(registrations[0].signal.aborted, true);
    assert.equal(registrations[1].tool.name, 'complete');
    assert.equal(registrations[1].signal.aborted, false);
    assert.deepEqual(reports.at(-1), { status: 'ready', count: 1 });
  } finally {
    registry.dispose();
    if (originalDocument === undefined) delete globalThis.document;
    else
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      });
  }
});

test('Plane exposes a focused tool surface for each worker checkpoint', () => {
  const idle = planeToolDefinitions({ pending: false, held: false });
  const pending = planeToolDefinitions({ pending: true, held: false });
  const held = planeToolDefinitions({ pending: true, held: true });

  assert.equal(idle.length, 9);
  assert.equal(pending.length, 5);
  assert.equal(held.length, 4);
  assert.ok(idle.some((item) => item.name === 'plane_patch_link_slow'));
  assert.ok(!idle.some((item) => item.name === 'plane_complete_crawl'));
  assert.ok(pending.some((item) => item.name === 'plane_complete_crawl'));
  assert.ok(!pending.some((item) => item.name === 'plane_replay'));
  assert.ok(!held.some((item) => item.name === 'plane_hold_crawl'));
});

test('Plane WebMCP metadata stays descriptive and within browser budgets', () => {
  const all = [
    ...planeToolDefinitions({ pending: false, held: false }),
    ...planeToolDefinitions({ pending: true, held: false }),
  ];
  const unique = new Map(all.map((item) => [item.name, item]));

  for (const definition of unique.values()) {
    assert.ok(definition.name.length <= 30, definition.name);
    assert.ok(definition.title && definition.title.length <= 80);
    assert.ok(definition.description.length <= 500);
    assert.equal(definition.inputSchema.additionalProperties, false);
    for (const property of Object.values(
      definition.inputSchema.properties ?? {},
    )) {
      assert.ok(property.description);
      assert.ok(property.description.length <= 150);
    }
  }
});
