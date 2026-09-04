import Link from 'next/link';
import {
  ArrowRight,
  Check,
  FileCode2,
  GitPullRequest,
  ShieldCheck,
} from 'lucide-react';
import { BentoCard } from './bento-card';

const patchProof = [
  'Checks the dispatch revision before applying crawler output',
  'Preserves metadata explicitly saved while work is pending',
  'Covers stale and current completion paths with focused tests',
];

const exports = [
  'Portable session JSON',
  'Minimal replay recipe',
  'Runnable JavaScript regression',
  'Local Plane patch and test artifact',
];

export function Contribution() {
  return (
    <BentoCard className="p-6 sm:p-10">
      <div className="mb-10 max-w-3xl">
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
          The proof ends
          <br />
          in a contribution.
        </h2>
        <p className="mt-5 max-w-lg text-sm font-medium leading-relaxed text-gray-500 sm:text-base">
          A failure is useful when it becomes a fix maintainers can review and a
          regression the project can keep.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#09090b] p-7 text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="relative flex h-full flex-col">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold text-emerald-300">
                  <GitPullRequest size={12} /> REVIEW ARTIFACT
                </span>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                  A real Plane patch.
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                  Pinned to commit da1a7ab8 and prepared locally for maintainer
                  review.
                </p>
              </div>
            </div>
            <ul className="mb-8 grid gap-3">
              {patchProof.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm font-medium text-zinc-200"
                >
                  <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] text-emerald-300">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <strong className="block text-sm">Revision guarded</strong>
                  <small className="text-zinc-500">stale work ignored</small>
                </div>
              </div>
              <Link
                href="/plane"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-zinc-900"
              >
                Run proof <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.03)] sm:p-8">
          <div className="flex h-full flex-col">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
              <FileCode2 size={20} />
            </span>
            <h3 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-900">
              A regression teams can keep.
            </h3>
            <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-gray-500">
              Export the failure as portable evidence, then rerun it against the
              fix.
            </p>
            <ul className="my-8 grid gap-3">
              {exports.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm font-medium text-zinc-700"
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-violet-50 text-violet-700">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <Link
                href="/integrate"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#09090b] px-6 text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]"
              >
                Integrate the recorder <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
