export interface SiteTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown, options?: { signal?: AbortSignal }) => unknown;
}
interface NativeContext {
  registerTool(
    tool: SiteTool,
    options?: { signal: AbortSignal },
  ): void | Promise<void>;
}
export function registerSiteTools(
  tools: SiteTool[],
  report: (
    status: 'ready' | 'unsupported' | 'error',
    count: number,
    error?: string,
  ) => void,
) {
  const context = (document as Document & { modelContext?: NativeContext })
    .modelContext;
  if (!context?.registerTool) {
    report('unsupported', 0);
    return () => {};
  }
  const lifecycle = new AbortController();
  const register = async () => {
    try {
      for (const tool of tools) {
        if (lifecycle.signal.aborted) return;
        await context.registerTool(tool, { signal: lifecycle.signal });
      }
      if (!lifecycle.signal.aborted) report('ready', tools.length);
    } catch (error) {
      if (!lifecycle.signal.aborted) {
        lifecycle.abort();
        report(
          'error',
          0,
          error instanceof Error ? error.message : 'Tool registration failed.',
        );
      }
    }
  };
  void register();
  return () => lifecycle.abort();
}
export function objectInput(value: unknown, allowed: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Input must be a JSON object.');
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input))
    if (!allowed.includes(key)) throw new Error(`Unexpected argument: ${key}`);
  return input;
}
