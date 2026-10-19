import type { ReactNode } from "react";

/** Presentation slots shared by server pages and client flows; forms own state. */
export function AuthPage({ title, description, kicker, children, links, layout = 'card' }: {
  title?: string;
  description?: string;
  kicker?: string;
  children: ReactNode;
  links?: ReactNode;
  layout?: 'card' | 'wide' | 'plain';
}) {
  const isWide = layout === 'wide';
  const isPlain = layout === 'plain';
  return (
    <>
      {title ? <header className={isWide ? 'auth-page-heading auth-page-heading-wide' : 'auth-page-heading'}>
        {kicker ? <p className="auth-kicker">{kicker}</p> : null}
        <h1 className="auth-title">{title}</h1>
        {description ? <p className="auth-subtitle">{description}</p> : null}
      </header> : null}
      <div className={isWide ? 'auth-wide' : isPlain ? 'auth-card auth-card-plain' : 'auth-card'}>{children}</div>
      {links ? <nav className="auth-entry-links" aria-label="其他登录与注册入口">{links}</nav> : null}
    </>
  );
}
