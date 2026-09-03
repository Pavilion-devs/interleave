import type { SiteTool } from '../webmcp.ts';

export type PlaneToolName =
  | 'plane_read_context'
  | 'plane_reset'
  | 'plane_patch_link_slow'
  | 'plane_set_link_metadata'
  | 'plane_hold_crawl'
  | 'plane_complete_crawl'
  | 'plane_cancel_crawl'
  | 'plane_replay'
  | 'plane_compare_modes'
  | 'plane_reduce_failure'
  | 'plane_export_regression'
  | 'plane_export_upstream_patch'
  | 'plane_list_sessions';

export type PlaneToolDefinition = Omit<SiteTool, 'execute'> & {
  name: PlaneToolName;
};

const schema = (properties: object = {}, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const modes = {
  type: 'string',
  enum: ['unguarded', 'guarded'],
  description: 'Use current Plane behavior or the proposed guarded behavior.',
};
const titleInput = {
  type: 'string',
  minLength: 1,
  maxLength: 120,
  description: 'Visible issue-link title to save in the local fixture.',
};

const definitions: Record<PlaneToolName, PlaneToolDefinition> = {
  plane_read_context: {
    name: 'plane_read_context',
    title: 'Read Plane incident state',
    description:
      'Read the local Plane #9674 reproduction, recent actor transitions, preservation rule, verdict, and pinned source. No live Plane service is contacted.',
    inputSchema: schema(),
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  plane_reset: {
    name: 'plane_reset',
    title: 'Reset Plane incident',
    description:
      'Reset the disposable Plane fixture and select current or proposed guarded behavior.',
    inputSchema: schema({ mode: modes }, ['mode']),
    annotations: { readOnlyHint: false },
  },
  plane_patch_link_slow: {
    name: 'plane_patch_link_slow',
    title: 'Queue delayed Plane crawl',
    description:
      'Model Plane issue-link PATCH at preview@da1a7ab and keep its background metadata write pending so a person can edit the link before completion.',
    inputSchema: schema(
      {
        title: titleInput,
        delayMs: {
          type: 'integer',
          minimum: 500,
          maximum: 20000,
          description: 'Local worker delay in milliseconds, from 500 to 20000.',
        },
      },
      ['title', 'delayMs'],
    ),
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  plane_set_link_metadata: {
    name: 'plane_set_link_metadata',
    title: 'Save human link metadata',
    description:
      'Save explicit issue-link metadata while the queued Plane crawler is pending.',
    inputSchema: schema({ title: titleInput }, ['title']),
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  plane_hold_crawl: {
    name: 'plane_hold_crawl',
    title: 'Hold Plane crawl',
    description:
      'Hold the local crawler at its final metadata-write checkpoint.',
    inputSchema: schema(),
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  plane_complete_crawl: {
    name: 'plane_complete_crawl',
    title: 'Complete Plane crawl',
    description:
      'Complete the queued local crawler using current or proposed guarded behavior.',
    inputSchema: schema(),
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  plane_cancel_crawl: {
    name: 'plane_cancel_crawl',
    title: 'Cancel Plane crawl',
    description: 'Cancel the queued local crawler without writing metadata.',
    inputSchema: schema(),
    annotations: { readOnlyHint: false },
  },
  plane_replay: {
    name: 'plane_replay',
    title: 'Replay Plane recording',
    description:
      'Replay the current or selected validated recording through the real asynchronous checkpoint.',
    inputSchema: schema(
      {
        mode: modes,
        sessionId: {
          type: 'string',
          description: 'Optional browser-local recording identifier.',
        },
      },
      ['mode'],
    ),
    annotations: { readOnlyHint: false, untrustedContentHint: true },
  },
  plane_compare_modes: {
    name: 'plane_compare_modes',
    title: 'Compare current and patched Plane',
    description:
      'Run the same witnessed sequence against Plane preview@da1a7ab and the proposed compare-and-set patch.',
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
  },
  plane_reduce_failure: {
    name: 'plane_reduce_failure',
    title: 'Minimize Plane failure',
    description:
      'Delta-debug the latest witnessed failure until no semantic command can be removed.',
    inputSchema: schema(),
    annotations: { readOnlyHint: true, untrustedContentHint: true },
  },
  plane_export_regression: {
    name: 'plane_export_regression',
    title: 'Export Plane regression receipt',
    description:
      'Return a compact receipt and download URL for a deterministic regression that fails on current Plane behavior and passes with the guard.',
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
  },
  plane_export_upstream_patch: {
    name: 'plane_export_upstream_patch',
    title: 'Export Plane patch receipt',
    description:
      'Return a compact receipt for the local Plane #9674 patch. This never publishes or contacts maintainers.',
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
  },
  plane_list_sessions: {
    name: 'plane_list_sessions',
    title: 'List Plane recordings',
    description:
      'Read compact metadata for the current and five most recent browser-local incident recordings.',
    inputSchema: schema(),
    annotations: { readOnlyHint: true },
  },
};

const idleNames: PlaneToolName[] = [
  'plane_read_context',
  'plane_reset',
  'plane_patch_link_slow',
  'plane_replay',
  'plane_compare_modes',
  'plane_reduce_failure',
  'plane_export_regression',
  'plane_export_upstream_patch',
  'plane_list_sessions',
];

const pendingNames: PlaneToolName[] = [
  'plane_read_context',
  'plane_set_link_metadata',
  'plane_hold_crawl',
  'plane_complete_crawl',
  'plane_cancel_crawl',
];

export function planeToolDefinitions(options: {
  pending: boolean;
  held: boolean;
}): PlaneToolDefinition[] {
  const names = options.pending ? pendingNames : idleNames;
  return names
    .filter((name) => !(options.held && name === 'plane_hold_crawl'))
    .map((name) => definitions[name]);
}
