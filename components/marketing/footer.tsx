import Link from 'next/link';
import { ArrowRight, Braces, GitPullRequest, Play } from 'lucide-react';

const platform = [
  { label: 'Plane incident', href: '/plane' },
  { label: 'Reservation race', href: '/reservation' },
  { label: 'TodoMVC adapter', href: '/todomvc' },
  { label: 'Recorder integration', href: '/integrate' },
  { label: 'Regression export', href: '/plane/proof' },
];

export function MarketingFooter() {
  return (
    <footer className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="flex min-h-[20rem] flex-col justify-between rounded-[2rem] border border-gray-100 bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] lg:col-span-4">
        <h3 className="text-3xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-4xl">
          Catch the race.
          <br />
          Keep the proof.
        </h3>
        <div className="mt-8">
          <Link
            href="/plane"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#09090b] px-6 text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)]"
          >
            Open Dashboard <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="flex min-h-[20rem] flex-col justify-between rounded-[2rem] border border-gray-100 bg-white p-8 shadow-[0_2px_10px_rgba(0,0,0,0.02)] lg:col-span-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Platform
            </p>
            <ul className="space-y-3">
              {platform.map((item) => (
                <li key={item.label}>
                  <Link
                    className="text-sm font-medium text-zinc-900 transition-colors hover:text-zinc-600"
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Project
            </p>
            <ul className="space-y-3">
              <li>
                <a
                  className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
                  href="https://github.com/Pavilion-devs/interleave"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub repository
                </a>
              </li>
              <li>
                <a
                  className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
                  href="https://github.com/makeplane/plane/issues/9674"
                  target="_blank"
                  rel="noreferrer"
                >
                  Plane issue #9674
                </a>
              </li>
              <li>
                <Link
                  className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
                  href="/plane-9674.patch"
                >
                  Proposed patch
                </Link>
              </li>
              <li>
                <Link
                  className="text-sm font-medium text-zinc-900 hover:text-zinc-600"
                  href="/interleave-plane-regression.test.mjs"
                >
                  Regression test
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-gray-100 pt-6 text-sm font-medium text-zinc-700">
          <span>
            Open-source concurrency assurance for agent-callable apps.
          </span>
          <span className="ml-auto text-xs text-gray-400">
            Interleave · 2026
          </span>
        </div>
      </div>

      <div className="flex min-h-[20rem] flex-col items-center gap-4 rounded-[2rem] border border-gray-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] lg:col-span-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          Explore
        </p>
        <div className="flex flex-col gap-3">
          <a
            aria-label="GitHub"
            href="https://github.com/Pavilion-devs/interleave"
            target="_blank"
            rel="noreferrer"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-[#09090b] text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
          >
            <Braces size={18} />
          </a>
          <Link
            aria-label="Launch demo"
            href="/plane"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-[#09090b] text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
          >
            <Play size={18} />
          </Link>
          <a
            aria-label="Plane issue"
            href="https://github.com/makeplane/plane/issues/9674"
            target="_blank"
            rel="noreferrer"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-[#09090b] text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
          >
            <GitPullRequest size={18} />
          </a>
        </div>
      </div>
    </footer>
  );
}
