import Link from 'next/link';
import { MarketingLogo } from './logo';

const navItems = [
  { label: 'Home', href: '#' },
  { label: 'Platform', href: '#platform', active: true },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Proof', href: '#proof' },
  { label: 'GitHub', href: 'https://github.com/Pavilion-devs/interleave' },
];

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <MarketingLogo />
      <nav className="marketing-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <a
            key={item.label}
            className={item.active ? 'is-active' : undefined}
            href={item.href}
            target={item.label === 'GitHub' ? '_blank' : undefined}
            rel={item.label === 'GitHub' ? 'noreferrer' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="marketing-header-actions">
        <a className="marketing-header-secondary" href="https://github.com/Pavilion-devs/interleave" target="_blank" rel="noreferrer">
          View source
        </a>
        <Link className="marketing-header-primary" href="/plane">Open dashboard</Link>
      </div>
    </header>
  );
}
