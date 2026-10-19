import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared presentation for auth routes and anonymous workspace gates. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="auth-shell">
    <header className="auth-header">
      <Link className="auth-brand" href="/">华师令</Link>
      <Link className="auth-home-link" href="/">返回首页</Link>
    </header>
    <main className="auth-main" id="main">{children}</main>
  </div>;
}
