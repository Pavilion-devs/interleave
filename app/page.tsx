import { Hero } from '@/components/marketing/hero';
import { Insights } from '@/components/marketing/insights';
import { Proof } from '@/components/marketing/proof';
import { Stats } from '@/components/marketing/stats';
import { Contribution } from '@/components/marketing/contribution';
import { MarketingFooter } from '@/components/marketing/footer';
import { Reveal } from '@/components/marketing/reveal';

export default function HomePage() {
  return (
    <main className="marketing-shell">
      <div className="marketing-stack flex flex-col gap-5 sm:gap-6">
        <Hero />
        <Reveal><Insights /></Reveal>
        <Reveal><Proof /></Reveal>
        <Reveal><Stats /></Reveal>
        <Reveal><Contribution /></Reveal>
        <Reveal><MarketingFooter /></Reveal>
      </div>
    </main>
  );
}
