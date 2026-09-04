import Link from 'next/link';
import { MarketingLogo } from './logo';

const navItems = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'platform', label: 'Platform', href: '/#platform' },
  { id: 'workflow', label: 'Workflow', href: '/#workflow' },
  { id: 'proof', label: 'Proof', href: '/#proof' },
  { id: 'developers', label: 'Developers', href: '/integrate' },
  { label: 'GitHub', href: 'https://github.com/Pavilion-devs/interleave' },
];

export function MarketingHeader({
  current = 'platform',
}: {
  current?: string;
}) {
  return (
    <header className="marketing-header">
      <MarketingLogo />
      <nav className="marketing-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <a
            key={item.label}
            className={
              'id' in item && item.id === current ? 'is-active' : undefined
            }
            href={item.href}
            target={item.label === 'GitHub' ? '_blank' : undefined}
            rel={item.label === 'GitHub' ? 'noreferrer' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="marketing-header-actions">
        <a
          className="marketing-header-secondary"
          href="https://github.com/Pavilion-devs/interleave"
          target="_blank"
          rel="noreferrer"
        >
          View source
        </a>
        <Link className="marketing-header-primary" href="/plane">
          Open dashboard
        </Link>
      </div>
    </header>
  );
}
