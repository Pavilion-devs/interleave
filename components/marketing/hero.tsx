import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { BentoCard } from './bento-card';
import { MarketingHeader } from './header';

export function Hero() {
  return (
    <BentoCard className="marketing-hero" id="platform">
      <div className="marketing-hero-decoration" aria-hidden="true">
        <div className="marketing-dot-grid" />
        <div className="marketing-wash marketing-wash-left" />
        <div className="marketing-wash marketing-wash-right" />
      </div>

      <div className="marketing-hero-inner">
        <MarketingHeader />
        <div className="marketing-hero-copy">
          <h1>
            Catch the race.
            <br />
            Prove the fix.
          </h1>
          <div className="marketing-actions">
            <Link className="marketing-primary" href="/plane">
              Open Dashboard <ArrowRight size={16} />
            </Link>
            <Link className="marketing-secondary" href="/plane#experiment">
              <Play size={15} /> Launch Demo
            </Link>
          </div>
        </div>

        <div className="marketing-product-grid" id="workflow">
          <div className="marketing-proof-column">
            <div className="marketing-proof-stat">
              <strong>49/49</strong>
              <span>Regression checks passing</span>
            </div>
            <div className="marketing-verdict-image" id="proof">
              <Image
                src="/interleave-verdict.png"
                alt="Interleave showing the exact preservation rule violation"
                fill
                sizes="(min-width: 1024px) 30vw, 100vw"
                className="marketing-cover-image"
              />
            </div>
          </div>

          <div className="marketing-dashboard-card">
            <div className="marketing-dashboard-label">
              <span>Plane #9674</span>
              <span className="marketing-live"><i /> Live WebMCP tools</span>
            </div>
            <div className="marketing-dashboard-image">
              <Image
                src="/interleave-dashboard.png"
                alt="Interleave recording and replaying the Plane metadata race"
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="marketing-cover-image"
              />
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
