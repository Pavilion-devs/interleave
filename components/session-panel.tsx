'use client';
import { useRef, useState } from 'react';
import { Download, FolderOpen, Play, Upload, X, Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Session } from '@/packages/recorder/src/index';
import type { RecordedState } from '@/lib/reservation-adapter';

type Recording = Session<RecordedState>;
export function SessionPanel({
  live,
  sessions,
  selected,
  onSelect,
  onReplay,
  onImport,
  onExport,
  warning,
  busy,
}: {
  live: Recording;
  sessions: Recording[];
  selected: Recording | null;
  onSelect: (session: Recording | null) => void;
  onReplay: (session: Recording) => void;
  onImport: (text: string) => void;
  onExport: (session: Recording) => void;
  warning: string;
  busy: boolean;
}) {
  const [entryId, setEntryId] = useState<number | null>(null);
  const [importError, setImportError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const active = selected ?? live;
  const entry =
    active.entries.find((item) => item.id === entryId) ?? active.entries.at(-1);
  const calls = active.entries.filter((item) => item.kind !== 'state');
  const select = (session: Recording | null) => {
    onSelect(session);
    setEntryId(null);
  };
  return (
    <section className="session-panel">
      <div className="proof-heading">
        <div>
          <span className="eyebrow">SESSION RECORDER</span>
          <h2>
            {selected ? 'Inspect a saved session' : 'Every call has a receipt.'}
          </h2>
        </div>
        <span className={`recording-badge ${selected ? 'archived' : ''}`}>
          {selected
            ? 'SAVED SESSION'
            : live.entries.some((item) => item.status === 'pending')
              ? 'CALL IN PROGRESS'
              : 'RECORDING'}
        </span>
      </div>
      <p className="proof-caption">
        Application tool arguments, results, errors, and state changes. Saved in
        this browser; no session data is uploaded.
      </p>
      {warning && (
        <p className="error-message" role="alert">
          {warning}
        </p>
      )}
      <div className="session-toolbar">
        <label>
          Session
          <select
            aria-label="Recording session"
            value={selected?.id ?? 'live'}
            onChange={(event) =>
              select(
                sessions.find((item) => item.id === event.target.value) ?? null,
              )
            }
          >
            <option value="live">
              Current recording · {live.entries.length} events
            </option>
            {sessions
              .filter((item) => item.id !== live.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.startedAt).toLocaleString()} ·{' '}
                  {item.initialState.mode} · {item.entries.length} events
                </option>
              ))}
          </select>
        </label>
        <div className="proof-actions">
          <Button
            variant="outline"
            disabled={
              busy ||
              !active.entries.length ||
              active.entries.some(
                (item) =>
                  item.status === 'pending' || item.status === 'interrupted',
              )
            }
            onClick={() => onReplay(active)}
          >
            <Play />
            Replay session
          </Button>
          <Button
            variant="outline"
            disabled={!active.entries.length}
            onClick={() => onExport(active)}
          >
            <Download />
            Session JSON
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload />
            Import session
          </Button>
          {selected && (
            <Button variant="ghost" onClick={() => select(null)}>
              <X />
              Return to live
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import session file"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            try {
              if (file.size > 1500000)
                throw new Error('Session files must be smaller than 1.5 MB.');
              onImport(await file.text());
              setImportError('');
            } catch (error) {
              setImportError(
                error instanceof Error ? error.message : 'Import failed.',
              );
            }
          }}
        />
      </div>
      {importError && (
        <p className="error-message" role="alert">
          {importError}
        </p>
      )}
      <div className="receipt-summary">
        <span>{calls.length} calls / actions</span>
        <span>
          {active.entries.filter((item) => item.kind === 'state').length} state
          changes
        </span>
        <span>
          {
            calls.filter(
              (item) =>
                item.status === 'rejected' || item.status === 'cancelled',
            ).length
          }{' '}
          errors / cancellations
        </span>
        {active.droppedEntries > 0 && (
          <strong>
            {active.droppedEntries} older events omitted · replay unavailable
          </strong>
        )}
      </div>
      <div className="receipt-grid">
        <div className="receipt-list">
          {!active.entries.length ? (
            <div className="empty-trace">
              <FolderOpen />
              <strong>Start a reservation to record it.</strong>
              <p>
                Completed and pending calls appear here alongside changes to
                application state.
              </p>
            </div>
          ) : (
            active.entries.map((item) => (
              <button
                key={item.id}
                className={`receipt-item ${item.status} ${entry?.id === item.id ? 'selected' : ''}`}
                aria-pressed={entry?.id === item.id}
                onClick={() => setEntryId(item.id)}
              >
                <span className="event-number">
                  {String(item.id).padStart(2, '0')}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.kind} · {item.source} ·{' '}
                    {item.durationMs === null
                      ? 'in progress'
                      : `${item.durationMs} ms`}
                  </small>
                </span>
                <span className="receipt-status">{item.status}</span>
              </button>
            ))
          )}
        </div>
        <div className="receipt-inspector">
          {entry ? (
            <>
              <div className="inspector-heading">
                CALL RECEIPT<span>{entry.status.toUpperCase()}</span>
              </div>
              <h3>{entry.name}</h3>
              <p>
                {entry.source} ·{' '}
                {entry.durationMs === null
                  ? 'Completion has not been recorded'
                  : `${entry.durationMs} ms from start to completion`}
              </p>
              <details open>
                <summary>Arguments</summary>
                <pre>{JSON.stringify(entry.input, null, 2)}</pre>
              </details>
              <details
                open={
                  entry.status === 'rejected' || entry.status === 'cancelled'
                }
              >
                <summary>{entry.error ? 'Error' : 'Result'}</summary>
                <pre>
                  {JSON.stringify(entry.error ?? entry.output, null, 2)}
                </pre>
              </details>
              <details>
                <summary>State before and after</summary>
                <pre>
                  {JSON.stringify(
                    { before: entry.before, after: entry.after },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          ) : (
            <div className="inspector-empty">
              <Braces />
              <p>Select an event to inspect its receipt.</p>
            </div>
          )}
        </div>
      </div>
      <p className="session-footnote">
        Up to 10 recent sessions within the browser storage limit. Lab
        navigation and session-management tools are excluded from application
        recordings. Imported sessions are inspected as data; replay executes
        only this adapter’s supported actions.
      </p>
      <a
        className="recorder-download"
        href="/interleave-recorder-0.2.0.tgz"
        download
      >
        Download @interleave/recorder v0.2.0
      </a>
    </section>
  );
}
