import { BentoCard } from './bento-card';

const stats = [
  {
    value: '9',
    title: 'Native WebMCP tools',
    body: 'The agent drives the real application contract exposed by the page.',
    gradient: 'from-emerald-400/40 to-emerald-200/0',
    halo: 'shadow-[0_0_60px_-15px_rgba(16,185,129,0.45)]',
  },
  {
    value: '3',
    title: 'Commands after reduction',
    body: 'Dispatch, human edit, stale completion: the smallest reliable proof.',
    gradient: 'from-violet-400/40 to-violet-200/0',
    halo: 'shadow-[0_0_60px_-15px_rgba(139,92,246,0.45)]',
  },
  {
    value: '50/50',
    title: 'Project checks passing',
    body: '49 core checks plus the exported Plane regression, all passing.',
    gradient: 'from-orange-400/40 to-orange-200/0',
    halo: 'shadow-[0_0_60px_-15px_rgba(249,115,22,0.45)]',
  },
];

export function Stats() {
  return (
    <BentoCard className="p-6 sm:p-10">
      <div className="mb-10 grid grid-cols-1 items-end gap-8 lg:grid-cols-12">
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-5xl lg:col-span-7 lg:text-6xl">
          Evidence you
          <br />
          can inspect.
        </h2>
        <p className="max-w-md text-sm font-medium leading-relaxed text-gray-500 sm:text-base lg:col-span-5">
          Interleave does not stop at a warning. It leaves a recording, a
          minimal reproduction, and a test a maintainer can keep.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.title} className="group space-y-4">
            <div
              className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white transition-all duration-500 group-hover:-translate-y-1 ${stat.halo}`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${stat.gradient}`}
              />
              <div className="absolute inset-3 rounded-[1.5rem] bg-white/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,1)] backdrop-blur-sm" />
              <span className="relative text-5xl font-semibold tracking-tight text-zinc-900 transition-transform duration-500 group-hover:scale-105 sm:text-6xl">
                {stat.value}
              </span>
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-zinc-900">
                {stat.title}
              </h3>
              <p className="mt-1.5 text-sm font-medium leading-snug text-gray-500">
                {stat.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
