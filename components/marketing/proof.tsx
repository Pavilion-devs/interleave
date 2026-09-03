import Image from 'next/image';
import { Download, GitBranch, Minimize2, Play, Radio } from 'lucide-react';
import { BentoCard } from './bento-card';

const stages = [
  { title: 'Record', body: 'Capture native WebMCP calls and browser state.', icon: Radio },
  { title: 'Replay', body: 'Run the same ordering against both modes.', icon: Play },
  { title: 'Minimize', body: 'Reduce the incident to three essential commands.', icon: Minimize2 },
  { title: 'Export', body: 'Generate a deterministic regression test.', icon: Download },
];

export function Proof() {
  return (
    <BentoCard className="p-6 sm:p-10" id="proof">
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="relative flex min-h-[25rem] flex-col justify-end overflow-hidden rounded-[2rem] border border-white/5 bg-[#09090b] p-7 text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] sm:p-8 lg:col-span-5">
          <Image
            src="/interleave-verdict.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-[#09090b]/20" />
          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur-md">
              <GitBranch size={12} /> Source verified
            </span>
            <h3 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl">
              Plane #9674,
              <br />
              reproduced locally.
            </h3>
            <p className="mt-4 text-sm font-medium leading-relaxed text-white/70">
              The fixture follows Plane’s public issue and pinned source, then
              proves a revision guard against the same recording.
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:col-span-7">
          <div className="mb-6">
            <h2 className="text-3xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl">
              From one incident
              <br />
              to a reusable guardrail.
            </h2>
            <p className="mt-4 max-w-lg text-base font-medium leading-relaxed text-gray-500">
              Every artifact stays connected to the exact behavior that produced it.
            </p>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            {stages.map(({ title, body, icon: Icon }, index) => (
              <div
                key={title}
                className="flex flex-col justify-between gap-8 rounded-[1.5rem] border border-gray-100 bg-white p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={18} /></span>
                  <span className="font-mono text-[10px] text-gray-300">0{index + 1}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-zinc-900">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-gray-500">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
