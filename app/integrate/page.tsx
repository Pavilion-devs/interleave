import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Braces,
  Check,
  Download,
  FileJson,
  GitBranch,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { BentoCard } from '@/components/marketing/bento-card';
import { MarketingFooter } from '@/components/marketing/footer';
import { MarketingHeader } from '@/components/marketing/header';
import { Reveal } from '@/components/marketing/reveal';

const installCommand =
  'npm install https://interleave-webmcp-lab.asaborodaniel.chatgpt.site/interleave-recorder-0.2.0.tgz';

const example = `import { SessionRecorder } from '@interleave/recorder';

const recorder = new SessionRecorder({
  adapter: { id: 'document-editor', version: 1 },
  readState: () => ({
    text: editor.text,
    revision: editor.revision,
  }),
  redact: redactForSharing,
});

document.modelContext.registerTool({
  name: 'save_document',
  description: 'Save the current document.',
  inputSchema: saveSchema,
  execute: (input, options) =>
    recorder.run('save_document', input, 'native', () =>
      editor.save(input, options?.signal),
    ),
});

function editText(text) {
  const before = readEditorState();
  editor.setText(text);
  recorder.stateChange(
    'edit_text', { text }, before, readEditorState(), 'manual'
  );
}`;

const steps = [
  {
    number: '01',
    title: 'Describe relevant state',
    body: 'Give the recorder a small, serializable view of the application state that matters to the operation.',
    icon: FileJson,
  },
  {
    number: '02',
    title: 'Wrap tools and human actions',
    body: 'Record the native WebMCP call and the semantic UI edits that can happen while that call remains pending.',
    icon: Radio,
  },
  {
    number: '03',
    title: 'Apply your application rule',
    body: 'Replay the captured sequence against the behavior your product promises, then export the failure as a regression.',
    icon: ShieldCheck,
  },
];

const boundaries = [
  'The recorder captures only values supplied by your integration.',
  'Your application defines correctness rules and replay behavior.',
  'Optional redaction runs before state enters the recording.',
  'No browser patching, hidden reasoning, or cross-site inspection.',
];

export default function IntegratePage() {
  return (
    <main className="marketing-shell">
      <div className="marketing-stack flex flex-col gap-5 sm:gap-6">
        <BentoCard className="integration-hero">
          <div className="marketing-hero-decoration" aria-hidden="true">
            <div className="marketing-dot-grid" />
            <div className="marketing-wash marketing-wash-left" />
            <div className="marketing-wash marketing-wash-right" />
          </div>
          <div className="integration-hero-inner">
            <MarketingHeader current="developers" />
            <div className="integration-hero-copy">
              <span className="integration-kicker">
                <Box size={14} /> @interleave/recorder · v0.2.0
              </span>
              <h1>
                Instrument the race.
                <br />
                Keep your app in control.
              </h1>
              <p>
                Add an opt-in session recorder to an agent-callable application
                without changing its framework or surrendering its state model.
              </p>
              <div className="marketing-actions">
                <a
                  className="marketing-primary"
                  href="/interleave-recorder-0.2.0.tgz"
                  download
                >
                  <Download size={16} /> Download package
                </a>
                <Link className="marketing-secondary" href="/plane">
                  Run the Plane proof <ArrowRight size={15} />
                </Link>
              </div>
              <div className="integration-facts" aria-label="Package facts">
                <span>
                  <Check size={13} /> Dependency-free core
                </span>
                <span>
                  <Check size={13} /> Framework-independent
                </span>
                <span>
                  <Check size={13} /> MIT licensed
                </span>
              </div>
            </div>
          </div>
        </BentoCard>

        <Reveal>
          <BentoCard className="p-6 sm:p-10">
            <div className="integration-section-heading">
              <div>
                <span>THREE STEPS</span>
                <h2>Make the interleaving observable.</h2>
              </div>
              <p>
                Interleave records what your app can prove: tool calls, semantic
                human actions, and the state before and after each transition.
              </p>
            </div>
            <div className="integration-steps">
              {steps.map(({ number, title, body, icon: Icon }) => (
                <article key={number}>
                  <div className="integration-step-top">
                    <span>{number}</span>
                    <i>
                      <Icon size={18} />
                    </i>
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </BentoCard>
        </Reveal>

        <Reveal>
          <section className="integration-code-grid">
            <div className="integration-code-card">
              <div className="integration-code-heading">
                <span>
                  <Braces size={15} /> MINIMAL INTEGRATION
                </span>
                <span>TypeScript</span>
              </div>
              <pre>
                <code>{example}</code>
              </pre>
            </div>
            <div className="integration-guide-card">
              <div>
                <span className="integration-guide-icon">
                  <GitBranch size={20} />
                </span>
                <h2>Your model stays yours.</h2>
                <p>
                  The package supplies trustworthy receipts. Your adapter
                  decides which state matters and what should happen during
                  replay.
                </p>
              </div>
              <ul>
                {boundaries.map((item) => (
                  <li key={item}>
                    <Check size={14} /> {item}
                  </li>
                ))}
              </ul>
              <div className="integration-install">
                <small>INSTALL THE PUBLIC BUILD</small>
                <code>{installCommand}</code>
              </div>
              <a
                className="integration-source-link"
                href="https://github.com/Pavilion-devs/interleave/tree/main/packages/recorder"
                target="_blank"
                rel="noreferrer"
              >
                Read the package source <ArrowRight size={14} />
              </a>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <MarketingFooter />
        </Reveal>
      </div>
    </main>
  );
}
