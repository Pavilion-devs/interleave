import {
  Activity,
  ArrowDown,
  Bot,
  Braces,
  GitCompareArrows,
  History,
  UserRound,
} from 'lucide-react';
import { BentoCard } from './bento-card';

const features = [
  {
    label: 'Native tool calls and human actions on one timeline',
    icon: Activity,
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    label: 'Expected and actual state compared at the failure',
    icon: GitCompareArrows,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'A minimized sequence that replays deterministically',
    icon: History,
    tone: 'bg-amber-50 text-amber-700',
  },
];

export function Insights() {
  return (
    <BentoCard className="p-6 sm:p-10" id="workflow">
      <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-2 lg:gap-8">
        <div className="flex h-full flex-col justify-between gap-10">
          <div>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
              A race becomes
              <br />
              evidence.
            </h2>
            <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-gray-500 sm:text-lg">
              Interleave captures the dispatch, the human edit, and the delayed
              completion as one inspectable session.
            </p>
          </div>

          <div className="flex max-w-md flex-col gap-4">
            {features.map(({ label, icon: Icon, tone }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
                  <Icon size={17} strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold tracking-tight text-zinc-900">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[2rem] border border-gray-100 bg-[#f7f7f8] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold tracking-tight text-zinc-900">Recorded session</div>
                <div className="mt-1 text-[11px] font-medium text-gray-400">Plane metadata crawler · 8.8 seconds</div>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">CAPTURED</span>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Bot size={17} /></span>
                <div className="min-w-0 flex-1"><strong className="block text-sm text-zinc-900">Agent queues metadata crawl</strong><small className="text-gray-400">Reads “Plane documentation”</small></div>
                <code className="text-[10px] text-gray-400">+846 ms</code>
              </div>
              <ArrowDown className="mx-auto text-gray-300" size={16} />
              <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><UserRound size={17} /></span>
                <div className="min-w-0 flex-1"><strong className="block text-sm text-zinc-900">Human saves explicit metadata</strong><small className="text-amber-700/70">Changes to “Human verified runbook”</small></div>
                <code className="text-[10px] text-amber-700/60">+2.3 s</code>
              </div>
              <ArrowDown className="mx-auto text-gray-300" size={16} />
              <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 p-4">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-red-700"><Braces size={17} /></span>
                <div className="min-w-0 flex-1"><strong className="block text-sm text-zinc-900">Delayed worker overwrites it</strong><small className="text-red-700/70">Restores stale metadata</small></div>
                <code className="text-[10px] text-red-700/60">+8.8 s</code>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/5 bg-[#09090b] p-5 text-white shadow-[0_20px_60px_-25px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-zinc-400">PRESERVATION RULE</span>
              <span className="rounded-full bg-red-400/10 px-3 py-1 text-[10px] font-semibold text-red-300">VIOLATED</span>
            </div>
            <p className="text-sm font-medium leading-relaxed text-zinc-300">
              Metadata saved after dispatch must survive that stale completion.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.05] p-3"><small className="text-zinc-500">Expected</small><strong className="mt-1 block text-xs text-emerald-300">Human verified runbook</strong></div>
              <div className="rounded-xl bg-white/[0.05] p-3"><small className="text-zinc-500">Actual</small><strong className="mt-1 block text-xs text-red-300">Plane documentation</strong></div>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
