export interface SiteTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: object;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: unknown, options?: { signal?: AbortSignal }) => unknown;
}

interface NativeContext {
  registerTool(
    tool: SiteTool,
    options?: { signal: AbortSignal },
  ): void | Promise<void>;
}

export type ToolRegistrationReport = (
  status: 'ready' | 'updating' | 'unsupported' | 'error',
  count: number,
  error?: string,
) => void;

export interface SiteToolRegistry {
  update(tools: SiteTool[]): void;
  dispose(): void;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/**
 * Owns one native WebMCP tool surface. Updates are deferred while a registered
 * tool is running because aborting a registration signal may also abort that
 * call in older browser implementations.
 */
export function createSiteToolRegistry(
  report: ToolRegistrationReport,
): SiteToolRegistry {
  const context = (document as Document & { modelContext?: NativeContext })
    .modelContext;
  if (!context?.registerTool) {
    report('unsupported', 0);
    return { update() {}, dispose() {} };
  }

  let lifecycle: AbortController | null = null;
  let pendingTools: SiteTool[] | null = null;
  let activeExecutions = 0;
  let registrationVersion = 0;
  let disposed = false;

  const register = async (tools: SiteTool[]) => {
    if (disposed) return;
    const version = ++registrationVersion;
    lifecycle?.abort();
    lifecycle = new AbortController();
    const signal = lifecycle.signal;
    report('updating', tools.length);

    const settleExecution = () => {
      activeExecutions = Math.max(0, activeExecutions - 1);
      if (activeExecutions === 0 && pendingTools) {
        const next = pendingTools;
        pendingTools = null;
        void register(next);
      }
    };

    try {
      for (const tool of tools) {
        if (disposed || signal.aborted || version !== registrationVersion)
          return;
        const wrapped: SiteTool = {
          ...tool,
          execute(input, options) {
            activeExecutions++;
            try {
              const result = tool.execute(input, options);
              if (isPromiseLike(result))
                return Promise.resolve(result).finally(settleExecution);
              settleExecution();
              return result;
            } catch (error) {
              settleExecution();
              throw error;
            }
          },
        };
        await context.registerTool(wrapped, { signal });
      }
      if (!disposed && !signal.aborted && version === registrationVersion)
        report('ready', tools.length);
    } catch (error) {
      if (!disposed && !signal.aborted && version === registrationVersion) {
        lifecycle.abort();
        report(
          'error',
          0,
          error instanceof Error ? error.message : 'Tool registration failed.',
        );
      }
    }
  };

  return {
    update(tools) {
      if (disposed) return;
      const next = [...tools];
      if (activeExecutions > 0) {
        pendingTools = next;
        return;
      }
      void register(next);
    },
    dispose() {
      disposed = true;
      pendingTools = null;
      lifecycle?.abort();
    },
  };
}

export function registerSiteTools(
  tools: SiteTool[],
  report: ToolRegistrationReport,
) {
  const registry = createSiteToolRegistry(report);
  registry.update(tools);
  return () => registry.dispose();
}

export function objectInput(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Input must be a JSON object.');
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) throw new Error(`Unexpected argument: ${key}`);
  return input;
}
