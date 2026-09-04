'use client';

import Link from 'next/link';
import {
  Braces,
  ExternalLink,
  FlaskConical,
  GitBranch,
  GitPullRequest,
  Link2,
  ListChecks,
  ScrollText,
} from 'lucide-react';

type LabRoute = 'plane' | 'tracker' | 'proof' | 'reservation' | 'todomvc';

interface AppSidebarProps {
  active: LabRoute;
  context?: 'plane' | 'reservation' | 'todomvc';
  scenarioHeading: string;
  scenarioTitle: string;
  scenarioDetail: string;
  footerTitle: string;
  footerBody: string;
  footerHref?: string;
  footerLinkLabel?: string;
}

const primaryRoutes: Array<{
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
    href: '/reservation',
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
  context = 'plane',
  scenarioHeading,
  scenarioTitle,
  scenarioDetail,
  footerTitle,
  footerBody,
  footerHref,
  footerLinkLabel,
}: AppSidebarProps) {
  const evidenceRoutes = [
    {
      id: 'tracker' as const,
      href: `/${context}/tracker`,
      label: 'Session tracker',
      tag: 'REC',
      icon: ScrollText,
    },
    {
      id: 'proof' as const,
      href: `/${context}/proof`,
      label: context === 'plane' ? 'Patch proof' : 'Regression proof',
      tag: context === 'plane' ? 'FIX' : 'TEST',
      icon: GitPullRequest,
    },
  ];
  const groups =
    context === 'plane'
      ? [
          { label: 'FLAGSHIP', routes: primaryRoutes.slice(0, 1) },
          { label: 'EVIDENCE', routes: evidenceRoutes },
          { label: 'ADAPTER LABS', routes: primaryRoutes.slice(1) },
        ]
      : [
          { label: 'FLAGSHIP', routes: primaryRoutes.slice(0, 1) },
          { label: 'ADAPTER LABS', routes: primaryRoutes.slice(1) },
          { label: 'EVIDENCE', routes: evidenceRoutes },
        ];

  return (
    <aside className="sidebar" aria-label="Interleave workbench">
      <div className="sidebar-main">
        <Link className="sidebar-brand" href="/" prefetch={false}>
          <span className="sidebar-brand-mark"><GitBranch size={17} /></span>
          <span>Interleave</span>
        </Link>

        <nav className="sidebar-nav">
          {groups.map((group, groupIndex) => (
            <div className="sidebar-group" key={group.label}>
              <div className={`sidebar-heading ${groupIndex ? 'labs-heading' : ''}`}>
                {group.label}
              </div>
              {group.routes.map((route) => {
                const Icon = route.icon;
                const item = (
                  <>
                    <span className="sidebar-route-icon"><Icon size={18} /></span>
                    <span className="sidebar-route-label">{route.label}</span>
                    <span className="sidebar-route-tag">{route.tag}</span>
                  </>
                );
                return (
                  <div className="sidebar-route" key={route.id}>
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
            </div>
          ))}
        </nav>

        <div className="sidebar-incident">
          <div className="sidebar-heading">{scenarioHeading}</div>
          <div className="scenario-nav">
            <span className="scenario-dot" />
            <div>
              {scenarioTitle}
              <small>{scenarioDetail}</small>
            </div>
          </div>
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
