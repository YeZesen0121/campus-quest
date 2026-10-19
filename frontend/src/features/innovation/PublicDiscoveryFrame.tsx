import Link from 'next/link';
import type { ReactNode } from 'react';

const destinations = [
  ['overview', '/innovation', '概览'],
  ['projects', '/innovation/projects', '项目库'],
  ['recruitments', '/innovation/recruitments', '招募'],
  ['achievements', '/innovation/achievements', '成果'],
  ['talents', '/innovation/talents', '人才库'],
  ['mentors', '/innovation/mentors', '导师库'],
] as const;
type Section = (typeof destinations)[number][0];

/** The approved specimen's decorative arrow; link names stay textual. */
export function DiscoveryArrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg className="campus-discovery-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={direction === 'left' ? 'M20 12H4m6-6-6 6 6 6' : 'M4 12h16m-6-6 6 6-6 6'} /></svg>;
}

/** Public presentation only; CampusShell and feature islands retain their gates. */
export function PublicDiscoveryFrame({ section, variant = 'reading', children }: {
  section: Section;
  variant?: 'bridge' | 'projects' | 'reading' | 'role';
  children: ReactNode;
}) {
  return <div className="campus-discovery-page" data-variant={variant}>
    {variant !== "role" ? <nav className="campus-discovery-tabs" aria-label="双创公共浏览">
      {destinations.map(([key, href, label]) => <Link key={key} href={href} aria-current={section === key ? 'page' : undefined}>{label}</Link>)}
    </nav> : null}
    {children}
  </div>;
}
