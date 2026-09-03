import Link from 'next/link';
import { GitBranch } from 'lucide-react';

export function MarketingLogo() {
  return (
    <Link className="marketing-logo" href="/" aria-label="Interleave home">
      <span className="marketing-logo-mark"><GitBranch size={16} strokeWidth={2.4} /></span>
      <span>Interleave</span>
    </Link>
  );
}
