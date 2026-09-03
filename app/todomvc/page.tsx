'use client';

import Link from 'next/link';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { flushSync } from 'react-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronRight,
  CircleDot,
  Download,
  ExternalLink,
  FileCode2,
  FlaskConical,
  GitBranch,
  ListChecks,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionPanel } from '@/components/session-panel';
import { assertMode, type Mode } from '@/lib/lab-engine';
import {
  TodoAdapter,
  replayTodoAsync,
  todoRecipeFromSession,
  type TodoRecordedState,
} from '@/lib/todomvc/adapter';
import {
  SAMPLE_TODO_RECIPE,
  TODO_RULE,
  assertTodoTitle,
  reduceTodoFailure,
  replayTodoRecipe,
  type TodoCommand,
} from '@/lib/todomvc/lab';
import { exportTodoRegression } from '@/lib/todomvc/regression';
import {
  TodoSessionArchive,
  closeTodoSession,
  parseTodoSession,
} from '@/lib/todomvc/session';
import { objectInput, registerSiteTools, type SiteTool } from '@/lib/webmcp';
import type { Session } from '@/packages/recorder/src/index';

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function CompletionClock({ dueAt }: { dueAt: number | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return (
    <span>
      {dueAt === null
        ? 'Completion held'
        : `Finishes in ${Math.max(0, Math.ceil((dueAt - (now || dueAt)) / 1000))}s`}
    </span>
  );
}

type Comparison = {
  original: ReturnType<typeof replayTodoRecipe>;
  guarded: ReturnType<typeof replayTodoRecipe>;
  steps: number;
};

export default function TodoMvcLab() {
  const [adapter] = useState(() => new TodoAdapter());
  const [archive] = useState(() => new TodoSessionArchive());
  const state = useSyncExternalStore(
    adapter.lab.subscribe,
    adapter.lab.getSnapshot,
    adapter.lab.getSnapshot,
  );
  const operation = useSyncExternalStore(
    adapter.operation.subscribe,
    adapter.operation.getSnapshot,
    () => null,
  );
  const recording = useSyncExternalStore(
    adapter.recorder.subscribe,
    adapter.recorder.getSnapshot,
    adapter.recorder.getSnapshot,
  );
  const archiveState = useSyncExternalStore(
    archive.subscribe,
    archive.getSnapshot,
    archive.getServerSnapshot,
  );
  const [selectedSession, setSelectedSession] =
    useState<Session<TodoRecordedState> | null>(null);
  const [delayMs, setDelayMs] = useState(15000);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hasRecording, setHasRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [reduction, setReduction] = useState<ReturnType<
    typeof reduceTodoFailure
  > | null>(null);
  const [native, setNative] = useState<{
    status: string;
    count: number;
    error?: string;
  }>({ status: 'connecting', count: 0 });
  const savedRecipe = useRef<TodoCommand[]>([]);
  const failureRecipe = useRef<TodoCommand[]>([]);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const actionsRef = useRef<
    Record<
      string,
      (input: unknown, options?: { signal?: AbortSignal }) => unknown
    >
  >({});

  useEffect(() => {
    archive.initialize();
    const save = () => archive.save(adapter.recorder.getSnapshot());
    const detach = adapter.recorder.subscribe(save);
    const leave = () => {
      if (adapter.operation.getSnapshot())
        adapter.operation.cancel('The TodoMVC document was closed.');
      adapter.recorder.interruptPending('The TodoMVC document was closed.');
      save();
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      leave();
      detach();
      window.removeEventListener('beforeunload', leave);
      adapter.dispose();
    };
  }, [adapter, archive]);
  useEffect(
    () =>
      adapter.lab.subscribe(() => {
        const current = adapter.lab.getSnapshot();
        if (current.assertion) {
          savedRecipe.current = structuredClone(current.recipe);
          setHasRecording(true);
          if (
            !current.assertion.passed ||
            current.assertion.completion === 'blocked'
          )
            failureRecipe.current = structuredClone(current.recipe);
        }
      }),
    [adapter],
  );

  const compactState = () => {
    const current = adapter.lab.getSnapshot();
    return {
      mode: current.mode,
      document: current.document,
      assertion: current.assertion,
      eventCount: current.events.length,
      operation: adapter.operation.getSnapshot(),
      recording: {
        id: adapter.recorder.getSnapshot().id,
        eventCount: adapter.recorder.getSnapshot().entries.length,
      },
      integration: {
        application: 'TodoMVC React',
        upstream:
          'https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/react',
        faultOwner: 'Interleave seeded orchestration layer',
      },
    };
  };
  const checkBusy = () => {
    if (busyRef.current) throw new Error('A replay is already running.');
  };
  const reset = (mode: Mode = adapter.lab.getSnapshot().mode) => {
    generation.current++;
    busyRef.current = false;
    setPlaying(false);
    adapter.reset(mode);
    setSelectedSession(null);
    setSelectedEvent(null);
    setTitle('');
    setError('');
    setNotice('');
    setComparison(null);
    setReduction(null);
  };
  const chooseRecipe = () =>
    structuredClone(
      savedRecipe.current.length ? savedRecipe.current : SAMPLE_TODO_RECIPE,
    );
  const chooseFailure = () =>
    structuredClone(
      failureRecipe.current.length ? failureRecipe.current : SAMPLE_TODO_RECIPE,
    );
  const play = async (recipe: TodoCommand[], mode: Mode, animate = true) => {
    checkBusy();
    reset(mode);
    const token = generation.current;
    busyRef.current = true;
    setPlaying(true);
    try {
      await replayTodoAsync(recipe, adapter, async () => {
        if (animate) await new Promise((resolve) => setTimeout(resolve, 350));
        if (token !== generation.current)
          throw new DOMException('Replay stopped.', 'AbortError');
      });
    } catch (reason) {
      if (
        token === generation.current &&
        !(reason instanceof Error && reason.name === 'AbortError')
      )
        setError(reason instanceof Error ? reason.message : 'Replay failed.');
      throw reason;
    } finally {
      if (token === generation.current) {
        busyRef.current = false;
        setPlaying(false);
      }
    }
  };
  const findSession = (id: unknown) => {
    const current = adapter.recorder.getSnapshot();
    const session =
      id === undefined || id === current.id
        ? current
        : archive.getSnapshot().sessions.find((item) => item.id === id);
    if (!session)
      throw new Error('Saved session does not exist in this browser.');
    return session;
  };
  const importSession = (text: string) => {
    const imported = closeTodoSession(parseTodoSession(text));
    if (imported.id === adapter.recorder.getSnapshot().id)
      throw new Error('This file is already the current session.');
    archive.save(imported);
    setSelectedSession(imported);
    return imported;
  };
  const compare = () => {
    if (adapter.operation.getSnapshot())
      throw new Error('Finish or cancel the delayed clear before comparing.');
    const recipe = chooseFailure();
    const result = {
      original: replayTodoRecipe(recipe, 'unguarded'),
      guarded: replayTodoRecipe(recipe, 'guarded'),
      steps: recipe.length,
    };
    setComparison(result);
    return result;
  };
  const minimize = () => {
    if (adapter.operation.getSnapshot())
      throw new Error('Finish or cancel the delayed clear before reducing.');
    const result = reduceTodoFailure(chooseFailure());
    setReduction(result);
    return result;
  };
  const exportTest = () => {
    const content = exportTodoRegression(chooseFailure());
    download(
      'interleave-todomvc-regression.test.mjs',
      content,
      'text/javascript',
    );
    setNotice('Runnable TodoMVC regression test downloaded.');
    return content;
  };
  const run = (action: () => unknown) => {
    try {
      action();
      setError('');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Something went wrong.',
      );
    }
  };
  const startClear = (quick = false) => {
    setError('');
    const pending = adapter.clear(quick ? 20000 : delayMs);
    if (quick) adapter.operation.completeNow();
    void pending.catch((reason) => {
      if (!(reason instanceof Error && reason.name === 'AbortError'))
        setError(reason instanceof Error ? reason.message : 'Clear failed.');
    });
  };
  const addTodo = () => {
    run(() => {
      assertTodoTitle(title);
      adapter.add(title);
      setTitle('');
    });
  };

  useLayoutEffect(() => {
    const summary = (session: Session<TodoRecordedState>) => ({
      id: session.id,
      startedAt: session.startedAt,
      mode: session.initialState.mode,
      eventCount: session.entries.length,
      unfinished: session.entries.some(
        (entry) => entry.status === 'pending' || entry.status === 'interrupted',
      ),
    });
    actionsRef.current = {
      todos_read_context(input) {
        objectInput(input, []);
        return {
          ...compactState(),
          events: adapter.lab.getSnapshot().events,
          rule: TODO_RULE,
        };
      },
      todos_reset(input) {
        const args = objectInput(input, ['mode']);
        assertMode(args.mode);
        reset(args.mode);
        return compactState();
      },
      todos_add(input) {
        const args = objectInput(input, ['title']);
        assertTodoTitle(args.title);
        checkBusy();
        adapter.lab.add(args.title, 'native');
        return compactState();
      },
      todos_toggle(input) {
        const args = objectInput(input, ['title']);
        assertTodoTitle(args.title);
        checkBusy();
        adapter.lab.toggle(args.title, 'native');
        return compactState();
      },
      todos_clear_completed_slow(input, options) {
        const args = objectInput(input, ['delayMs']);
        checkBusy();
        return adapter.operation
          .clear(args.delayMs as number, 'native', options?.signal)
          .then(() => compactState());
      },
      todos_hold_clear(input) {
        objectInput(input, []);
        checkBusy();
        return adapter.operation.hold();
      },
      todos_complete_clear(input) {
        objectInput(input, []);
        checkBusy();
        adapter.operation.completeNow();
        return compactState();
      },
      todos_cancel_clear(input) {
        objectInput(input, []);
        checkBusy();
        adapter.operation.cancel();
        return compactState();
      },
      async todos_replay(input) {
        const args = objectInput(input, ['mode', 'sessionId']);
        assertMode(args.mode);
        checkBusy();
        if (adapter.operation.getSnapshot())
          throw new Error(
            'Finish or cancel the delayed clear before replaying.',
          );
        const recipe =
          args.sessionId === undefined
            ? chooseRecipe()
            : todoRecipeFromSession(findSession(args.sessionId));
        await play(recipe, args.mode, false);
        return { ...compactState(), replayedSteps: recipe.length };
      },
      todos_compare_modes(input) {
        objectInput(input, []);
        const result = compare();
        return {
          steps: result.steps,
          original: result.original.assertion,
          guarded: result.guarded.assertion,
        };
      },
      todos_reduce_failure(input) {
        objectInput(input, []);
        return minimize();
      },
      todos_export_regression(input) {
        objectInput(input, []);
        const content = exportTodoRegression(chooseFailure());
        return {
          filename: 'interleave-todomvc-regression.test.mjs',
          content,
          instructions:
            'Run with Node 22: node --test tests/interleave-todomvc-regression.test.mjs. Set INTERLEAVE_IMPLEMENTATION=unguarded to confirm the test catches the seeded stale replacement.',
        };
      },
      todos_list_sessions(input) {
        objectInput(input, []);
        return {
          current: summary(adapter.recorder.getSnapshot()),
          saved: archive
            .getSnapshot()
            .sessions.filter(
              (session) => session.id !== adapter.recorder.getSnapshot().id,
            )
            .map(summary),
          storageWarning: archive.getSnapshot().warning,
        };
      },
      todos_export_session(input) {
        const args = objectInput(input, ['sessionId']);
        const session = findSession(args.sessionId);
        return {
          filename: `interleave-todomvc-${session.id}.json`,
          json: JSON.stringify(session, null, 2),
        };
      },
      todos_import_session(input) {
        const args = objectInput(input, ['json']);
        if (typeof args.json !== 'string')
          throw new Error('Session JSON is required.');
        return summary(importSession(args.json));
      },
    };
  });

  useEffect(() => {
    const schema = (properties: object = {}, required: string[] = []) => ({
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    });
    const modes = { type: 'string', enum: ['unguarded', 'guarded'] };
    const titleInput = { type: 'string', minLength: 1, maxLength: 100 };
    const definitions: Array<[string, string, object, boolean]> = [
      [
        'todos_read_context',
        'Read the live TodoMVC list, revision, pending operation, preservation rule, trace, and recorder metadata. This integration uses the upstream TodoMVC React reducer with a clearly labeled Interleave fault.',
        schema(),
        true,
      ],
      [
        'todos_reset',
        'Reset the TodoMVC integration to its two sample todos and choose seeded or guarded orchestration. This deletes only disposable sample state in this page.',
        schema({ mode: modes }, ['mode']),
        false,
      ],
      [
        'todos_add',
        'Add a todo through the TodoMVC React reducer. During a delayed clear, this represents a concurrent application edit. Use only a short non-sensitive title.',
        schema({ title: titleInput }, ['title']),
        false,
      ],
      [
        'todos_toggle',
        'Toggle the one TodoMVC item whose title exactly matches. Errors if no item or multiple items match.',
        schema({ title: titleInput }, ['title']),
        false,
      ],
      [
        'todos_clear_completed_slow',
        'Start one asynchronous clear-completed call that remains pending while the visible TodoMVC app stays editable. The delay models application work. Seeded mode can replace the live list with stale reducer output; guarded mode blocks that replacement.',
        schema({ delayMs: { type: 'integer', minimum: 500, maximum: 20000 } }, [
          'delayMs',
        ]),
        false,
      ],
      [
        'todos_hold_clear',
        'Hold the currently pending TodoMVC clear at its completion checkpoint until completed or cancelled.',
        schema(),
        false,
      ],
      [
        'todos_complete_clear',
        'Complete the currently pending TodoMVC clear immediately, applying the active seeded or guarded orchestration.',
        schema(),
        false,
      ],
      [
        'todos_cancel_clear',
        'Cancel the pending TodoMVC clear without replacing the live list. The original tool call rejects with AbortError.',
        schema(),
        false,
      ],
      [
        'todos_replay',
        'Replay the current or selected completed TodoMVC recording through a real asynchronous checkpoint under seeded or guarded orchestration. Imported data is validated and only known actions execute.',
        schema({ mode: modes, sessionId: { type: 'string' } }, ['mode']),
        false,
      ],
      [
        'todos_compare_modes',
        'Run the latest witnessed failure on isolated seeded and guarded TodoMVC state machines and return both assertions.',
        schema(),
        true,
      ],
      [
        'todos_reduce_failure',
        'Delta-debug the latest witnessed TodoMVC failure by rerunning candidate command lists until no more commands can be removed.',
        schema(),
        true,
      ],
      [
        'todos_export_regression',
        'Return a runnable Node regression test generated from the latest witnessed TodoMVC failure. The guarded adapter passes and the seeded adapter fails.',
        schema(),
        true,
      ],
      [
        'todos_list_sessions',
        'Read metadata for the current and browser-local TodoMVC recordings.',
        schema(),
        true,
      ],
      [
        'todos_export_session',
        'Return validated TodoMVC session JSON for the current or named browser-local recording.',
        schema({ sessionId: { type: 'string' } }),
        true,
      ],
      [
        'todos_import_session',
        'Validate and save TodoMVC adapter session JSON as inert browser-local data. Replay is a separate explicit action limited to known semantic commands.',
        schema({ json: { type: 'string', maxLength: 1500000 } }, ['json']),
        false,
      ],
    ];
    const recorded = new Set([
      'todos_add',
      'todos_toggle',
      'todos_clear_completed_slow',
      'todos_hold_clear',
      'todos_complete_clear',
      'todos_cancel_clear',
    ]);
    const tools: SiteTool[] = definitions.map(
      ([name, description, inputSchema, readOnlyHint]) => ({
        name,
        description,
        inputSchema,
        annotations: { readOnlyHint },
        execute(input, options) {
          let result: unknown;
          flushSync(() => {
            const invoke = () => actionsRef.current[name](input, options);
            result = recorded.has(name)
              ? adapter.recorder.run(name, input, 'native', invoke)
              : invoke();
          });
          return result;
        },
      }),
    );
    return registerSiteTools(tools, (status, count, registrationError) =>
      setNative({ status, count, error: registrationError }),
    );
  }, [adapter]);

  const event =
    state.events.find((item) => item.id === selectedEvent) ??
    state.events.at(-1);
  const documentState = state.document;
  const assertion = state.assertion;
  const activeCount = documentState.todos.filter(
    (todo) => !todo.completed,
  ).length;
  const completedCount = documentState.todos.length - activeCount;

  return (
    <main className="lab-app todo-lab">
      <header className="app-header">
        <Link
          className="brand"
          href="/"
          aria-label="Interleave reservation lab"
        >
          <span className="brand-mark">
            <GitBranch size={21} />
          </span>
          interleave<span className="brand-suffix">/ lab</span>
        </Link>
        <div className="header-path">
          <span>Integrations</span>
          <ChevronRight size={14} />
          <span>TodoMVC</span>
        </div>
        <span
          className={`native-status ${native.status}`}
          title={native.error ?? 'Native document.modelContext tools'}
        >
          <span className="status-dot" />
          {native.status === 'ready'
            ? `${native.count} native tools`
            : native.status === 'unsupported'
              ? 'Manual mode'
              : native.status === 'error'
                ? 'Tool registration failed'
                : 'Connecting tools'}
        </span>
        <span className="version-chip">
          EXTERNAL APP <span>v0.3</span>
        </span>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">WORKBENCH</div>
          <Link className="nav-link" href="/">
            <FlaskConical size={17} />
            Reservation fixture<span>01</span>
          </Link>
          <div className="nav-active">
            <ListChecks size={17} />
            TodoMVC integration<span>02</span>
          </div>
          <div className="sidebar-heading scenario-heading">
            CURRENT SCENARIO
          </div>
          <div className="scenario-nav">
            <span className="scenario-dot" />
            <div>
              Delayed clear
              <small>Human add × stale replacement</small>
            </div>
          </div>
          <div className="sidebar-bottom">
            <div className="tiny-symbol">
              <Braces size={17} />
            </div>
            <strong>Real reducer. Seeded race.</strong>
            <p>
              TodoMVC owns the app behavior. Interleave owns the delayed fault.
            </p>
            <a
              className="upstream-link"
              href="https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/react"
              target="_blank"
              rel="noreferrer"
            >
              Upstream source <ExternalLink size={12} />
            </a>
          </div>
        </aside>
        <section className="workbench">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                INTEGRATION 002 <span>/</span> TODOMVC REACT
              </div>
              <h1>
                The lost todo race
                <span className="seeded">Interleave-seeded fault</span>
              </h1>
              <p>A delayed agent clear meets a human adding work.</p>
            </div>
            <Button
              variant="outline"
              className="reset-button"
              onClick={() => reset()}
            >
              <RotateCcw />
              {playing ? 'Stop & reset' : 'Reset app'}
            </Button>
          </div>

          <div className="provenance-strip">
            <Check size={15} />
            <span>
              Application mutations run through TodoMVC’s upstream React
              reducer. The delayed snapshot replacement is intentionally
              injected by Interleave.
            </span>
            <a
              href="https://github.com/tastejs/todomvc/blob/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/react/src/todo/reducer.js"
              target="_blank"
              rel="noreferrer"
            >
              Inspect reducer <ExternalLink size={12} />
            </a>
          </div>

          <div className="run-toolbar">
            <Tabs
              value={state.mode}
              onValueChange={(value) => reset(value as Mode)}
            >
              <TabsList className="mode-tabs">
                <TabsTrigger value="unguarded" disabled={playing}>
                  <CircleDot /> Seeded integration
                </TabsTrigger>
                <TabsTrigger value="guarded" disabled={playing}>
                  <ShieldCheck /> With revision guard
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="proof-actions">
              <Button
                variant="outline"
                disabled={playing || !!operation || !hasRecording}
                onClick={() =>
                  void play(chooseRecipe(), state.mode).catch(() => {})
                }
              >
                <RotateCcw /> Replay recording
              </Button>
              <Button
                className="sample-button"
                disabled={playing || !!operation}
                onClick={() =>
                  void play(
                    structuredClone(SAMPLE_TODO_RECIPE),
                    state.mode,
                  ).catch(() => {})
                }
              >
                <Play /> {playing ? 'Replaying…' : 'Run guided sample'}
              </Button>
            </div>
          </div>

          <div className="experiment-grid todo-experiment-grid">
            <section className="fixture-panel">
              <div className="panel-heading">
                <span>
                  <ListChecks size={15} /> APPLICATION UNDER TEST
                </span>
                <span className="small-label">TodoMVC React reducer</span>
              </div>
              <div className="fixture-stage todo-stage">
                <section
                  className="todomvc-app"
                  aria-label="TodoMVC application"
                >
                  <h2>todos</h2>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      addTodo();
                    }}
                  >
                    <input
                      aria-label="New todo title"
                      value={title}
                      maxLength={100}
                      disabled={playing}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="What needs to be done?"
                    />
                    <Button type="submit" disabled={playing || !title.trim()}>
                      Add
                    </Button>
                  </form>
                  <ul>
                    {documentState.todos.map((todo) => (
                      <li
                        key={todo.id}
                        className={todo.completed ? 'completed' : ''}
                      >
                        <button
                          className="todo-toggle"
                          aria-label={`${todo.completed ? 'Mark active' : 'Mark completed'}: ${todo.title}`}
                          aria-pressed={todo.completed}
                          disabled={playing}
                          onClick={() => run(() => adapter.toggle(todo.title))}
                        >
                          {todo.completed && <Check size={15} />}
                        </button>
                        <span>{todo.title}</span>
                        {documentState.pending &&
                          !documentState.pending.todos.some(
                            (captured) => captured.id === todo.id,
                          ) && <em>added during call</em>}
                      </li>
                    ))}
                  </ul>
                  <footer>
                    <span>
                      <strong>{activeCount}</strong>{' '}
                      {activeCount === 1 ? 'item' : 'items'} left
                    </span>
                    <span>All</span>
                    <button disabled={!completedCount}>Clear completed</button>
                  </footer>
                </section>
              </div>
              <div className="live-state">
                <span>LIVE TODOMVC STATE</span>
                <code>
                  todos <b>{documentState.todos.length}</b>
                </code>
                <code>
                  revision <b>{documentState.revision}</b>
                </code>
                <code>
                  captured <b>{documentState.pending?.todos.length ?? '—'}</b>
                </code>
              </div>
            </section>

            <section className="controls-panel">
              <div className="panel-heading">
                <span>
                  <FlaskConical size={15} /> CONTROL THE RACE
                </span>
              </div>
              <div className="control-content">
                <span className="step-index">
                  {documentState.pending
                    ? '02 / ADD A TODO'
                    : documentState.phase === 'blocked'
                      ? '03 / RECOVER'
                      : '01 / START CLEAR'}
                </span>
                <h3>
                  {documentState.pending
                    ? 'The agent is still working.'
                    : documentState.phase === 'blocked'
                      ? 'The stale write was refused.'
                      : 'Delay “clear completed.”'}
                </h3>
                <p>
                  {documentState.pending
                    ? 'Add a todo in the real app on the left. The original call remains pending while the human changes state.'
                    : documentState.phase === 'blocked'
                      ? 'Your todo survived. Retry from the current list to finish the requested clear safely.'
                      : 'The agent captures the current TodoMVC list, then completes later. Add work during the gap to test preservation.'}
                </p>
                <label className="delay-control">
                  Finish after
                  <select
                    aria-label="Todo clear delay"
                    value={delayMs}
                    disabled={playing || !!operation}
                    onChange={(event) => setDelayMs(Number(event.target.value))}
                  >
                    <option value={8000}>8 seconds</option>
                    <option value={15000}>15 seconds</option>
                    <option value={20000}>20 seconds</option>
                  </select>
                </label>
                <Button
                  className="primary-action"
                  disabled={playing || !!operation || !completedCount}
                  onClick={() => startClear(documentState.phase === 'blocked')}
                >
                  <Bot />
                  {documentState.phase === 'blocked'
                    ? 'Retry current list now'
                    : 'Start delayed clear'}
                  <ArrowRight />
                </Button>
                <div
                  className={`checkpoint ${documentState.pending ? 'checkpoint-active' : ''}`}
                >
                  <span className="checkpoint-line" />
                  <span>
                    <Pause size={13} />
                    {operation ? (
                      <CompletionClock dueAt={operation.dueAt} />
                    ) : (
                      'Before list replacement'
                    )}
                  </span>
                  <span className="checkpoint-line" />
                </div>
                <div className="operation-actions">
                  <Button
                    variant="outline"
                    disabled={!operation || operation.held}
                    onClick={() => run(() => adapter.hold())}
                  >
                    <Pause /> Hold
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!operation}
                    onClick={() => run(() => adapter.complete())}
                  >
                    <Check /> Complete now
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!operation}
                    onClick={() => run(() => adapter.cancel())}
                  >
                    <X /> Cancel
                  </Button>
                </div>
                <div className="rule-box">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Explicit preservation rule</strong>
                    <p>{TODO_RULE}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {assertion && (
            <div
              className={`verdict ${assertion.passed ? 'passed' : 'failed'}`}
            >
              <span className="verdict-icon">
                {assertion.passed ? <ShieldCheck /> : <Trash2 />}
              </span>
              <div>
                <strong>
                  {assertion.passed
                    ? assertion.completion === 'blocked'
                      ? 'PASS · stale replacement blocked'
                      : 'PASS · human work preserved'
                    : 'FAIL · human todo silently erased'}
                </strong>
                <p>{assertion.message}</p>
              </div>
              <span className="verdict-value">
                {assertion.passed ? 'RULE HOLDS' : 'RULE VIOLATED'}
              </span>
            </div>
          )}

          <section className="todo-trace-section">
            <div className="trace-title">
              <h2>
                <Activity size={16} /> Execution trace
                <span>{state.events.length} EVENTS</span>
              </h2>
              <div className="trace-legend">
                <i className="agent-dot" /> Agent
                <i className="human-dot" /> Human
                <i className="system-dot" /> System / guard
              </div>
            </div>
            <div className="trace-grid">
              <div className="event-list">
                {!state.events.length ? (
                  <div className="empty-trace">
                    <Activity />
                    <strong>No events yet.</strong>
                    <p>
                      Start the delayed clear, then add a todo while it runs.
                    </p>
                  </div>
                ) : (
                  state.events.map((item) => (
                    <button
                      key={item.id}
                      className={`trace-event ${item.kind} ${event?.id === item.id ? 'selected' : ''}`}
                      onClick={() => setSelectedEvent(item.id)}
                    >
                      <span className="event-number">
                        {String(item.id).padStart(2, '0')}
                      </span>
                      <span className={`actor-icon ${item.actor}`}>
                        {item.actor === 'human' ? (
                          <UserRound size={16} />
                        ) : item.actor === 'guard' ? (
                          <ShieldCheck size={16} />
                        ) : (
                          <Bot size={16} />
                        )}
                      </span>
                      <span className="event-text">
                        <strong>{item.title}</strong>
                        <small>
                          {item.source} · +{item.elapsedMs} ms
                        </small>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="event-inspector">
                {event ? (
                  <>
                    <div className="inspector-heading">
                      EVENT RECEIPT <span>{event.kind.toUpperCase()}</span>
                    </div>
                    <p>{event.detail}</p>
                    <div className="diff-head">
                      <span>FIELD</span>
                      <span>BEFORE</span>
                      <span>AFTER</span>
                    </div>
                    <div className="diff-row changed">
                      <code>todo count</code>
                      <code>{event.before.todos.length}</code>
                      <code>{event.after.todos.length}</code>
                    </div>
                    <div className="diff-row changed">
                      <code>revision</code>
                      <code>{event.before.revision}</code>
                      <code>{event.after.revision}</code>
                    </div>
                    <div className="diff-row changed">
                      <code>phase</code>
                      <code>{event.before.phase}</code>
                      <code>{event.after.phase}</code>
                    </div>
                  </>
                ) : (
                  <div className="inspector-empty">
                    <Braces />
                    <p>
                      Select an event to inspect the application transition.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="proof-panel">
            <div className="proof-heading">
              <div>
                <span className="eyebrow">FAILURE ANALYSIS</span>
                <h2>Prove the patch against the same recording.</h2>
              </div>
              <div className="proof-actions">
                <Button
                  variant="outline"
                  disabled={!!operation}
                  onClick={() => run(compare)}
                >
                  <GitBranch /> Compare modes
                </Button>
                <Button
                  variant="outline"
                  disabled={!!operation}
                  onClick={() => run(minimize)}
                >
                  <Minimize2 /> Reduce failure
                </Button>
              </div>
            </div>
            <p className="proof-caption">
              Analysis keeps the latest witnessed failure even after a
              successful retry.
            </p>
            {comparison && (
              <div className="comparison-grid">
                <div className="comparison-card">
                  <div>
                    <strong>Seeded integration</strong>
                    <span>FAIL</span>
                  </div>
                  <p>
                    <span>Human todo survives</span>
                    <b>
                      {comparison.original.assertion?.passed ? 'yes' : 'no'}
                    </b>
                  </p>
                  <small>{comparison.original.assertion?.message}</small>
                </div>
                <div className="comparison-card pass">
                  <div>
                    <strong>Revision guard</strong>
                    <span>PASS</span>
                  </div>
                  <p>
                    <span>Stale replacement</span>
                    <b>{comparison.guarded.assertion?.completion}</b>
                  </p>
                  <small>{comparison.guarded.assertion?.message}</small>
                </div>
              </div>
            )}
            {reduction && (
              <div className="reduction-result">
                <div>
                  <div className="reduction-count">
                    {reduction.originalLength} <ArrowRight />{' '}
                    <b>{reduction.reducedLength}</b>
                  </div>
                  <div>
                    <strong>Minimal witnessed sequence</strong>
                    <p>{reduction.attempts} candidates executed</p>
                  </div>
                </div>
                <div className="recipe-strip">
                  {reduction.recipe.map((command, index) => (
                    <span key={`${command.type}-${index}`}>{command.type}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="export-row">
              <div>
                <FileCode2 />
                <div>
                  interleave-todomvc-regression.test.mjs
                  <small>Same test passes guarded and fails seeded.</small>
                </div>
              </div>
              <Button
                variant="outline"
                disabled={!!operation}
                onClick={() => run(exportTest)}
              >
                <Download /> Export regression
              </Button>
            </div>
            {notice && <p className="export-notice">{notice}</p>}
          </section>

          <SessionPanel
            live={recording}
            sessions={archiveState.sessions}
            selected={selectedSession}
            onSelect={setSelectedSession}
            onReplay={(session) =>
              void play(todoRecipeFromSession(session), state.mode).catch(
                () => {},
              )
            }
            onImport={importSession}
            onExport={(session) =>
              download(
                `interleave-todomvc-${session.id}.json`,
                JSON.stringify(session, null, 2),
                'application/json',
              )
            }
            warning={archiveState.warning}
            busy={playing || !!operation}
            sessionLabel={(session) =>
              `${session.initialState.mode} · ${session.entries.length} events`
            }
            emptyTitle="Start a TodoMVC clear to record it."
            emptyBody="The pending tool, human todo changes, completion, and state transitions will appear here."
            footnote="TodoMVC sessions use their own versioned adapter. Imports are inert data; replay accepts only validated TodoMVC actions and never executes uploaded code."
          />

          <footer className="integration-footer">
            <Link href="/">
              <ArrowLeft size={14} /> Reservation fixture
            </Link>
            <span>
              TodoMVC reducer · ff43b02 · pinned 2026-09-03 · MIT · See
              THIRD_PARTY_NOTICES.md
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
