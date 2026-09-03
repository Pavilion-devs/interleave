'use client';

import Link from 'next/link';
import {
  Braces,
  ExternalLink,
  FlaskConical,
  Link2,
  ListChecks,
} from 'lucide-react';

type LabRoute = 'plane' | 'reservation' | 'todomvc';

interface AppSidebarProps {
  active: LabRoute;
  scenarioHeading: string;
  scenarioTitle: string;
  scenarioDetail: string;
  footerTitle: string;
  footerBody: string;
  footerHref?: string;
  footerLinkLabel?: string;
}

const routes: Array<{
  id: LabRoute;
  href: string;
  label: string;
  tag: string;
  icon: typeof Link2;
}> = [
  {
    id: 'plane',
    href: '/plane',
    label: 'Plane #9674',
    tag: 'OSS',
    icon: Link2,
  },
  {
    id: 'reservation',
    href: '/',
    label: 'Reservation race',
    tag: 'LAB',
    icon: FlaskConical,
  },
  {
    id: 'todomvc',
    href: '/todomvc',
    label: 'TodoMVC adapter',
    tag: 'LAB',
    icon: ListChecks,
  },
];

export function AppSidebar({
  active,
  scenarioHeading,
  scenarioTitle,
  scenarioDetail,
  footerTitle,
  footerBody,
  footerHref,
  footerLinkLabel,
}: AppSidebarProps) {
  return (
    <aside className="sidebar" aria-label="Interleave workbench">
      <div className="sidebar-heading">FLAGSHIP</div>
      {routes.map((route, index) => {
        const Icon = route.icon;
        const item = (
          <>
            <Icon size={17} />
            {route.label}
            <span>{route.tag}</span>
          </>
        );
        const separator = index === 1 && (
          <div className="sidebar-heading labs-heading">ADAPTER LABS</div>
        );
        return (
          <div className="sidebar-route" key={route.id}>
            {separator}
            {route.id === active ? (
              <div className="nav-active" aria-current="page">
                {item}
              </div>
            ) : (
              <Link className="nav-link" href={route.href} prefetch={false}>
                {item}
              </Link>
            )}
          </div>
        );
      })}
      <div className="sidebar-heading scenario-heading">{scenarioHeading}</div>
      <div className="scenario-nav">
        <span className="scenario-dot" />
        <div>
          {scenarioTitle}
          <small>{scenarioDetail}</small>
        </div>
      </div>
      <div className="sidebar-bottom">
        <div className="tiny-symbol">
          <Braces size={17} />
        </div>
        <strong>{footerTitle}</strong>
        <p>{footerBody}</p>
        {footerHref && footerLinkLabel ? (
          <a
            className="upstream-link"
            href={footerHref}
            target="_blank"
            rel="noreferrer"
          >
            {footerLinkLabel} <ExternalLink size={12} />
          </a>
        ) : (
          <div className="local-indicator">
            <span />
            Browser-local fixture
          </div>
        )}
      </div>
    </aside>
  );
}
