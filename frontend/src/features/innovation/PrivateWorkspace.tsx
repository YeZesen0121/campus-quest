"use client";
import Link from "next/link";
import type { MouseEvent, ReactNode, Ref } from "react";
import { useSession } from "@/features/auth/session";

type Area = "projects" | "owner" | "talent" | "collaboration";
const links = [
  { area: "projects", href: "/profile/project-drafts", label: "我的项目" },
  { area: "collaboration", href: "/profile/collaboration", label: "协作与交接" },
  { area: "owner", href: "/profile/owner-profile", label: "负责人资料与资格" },
  { area: "talent", href: "/profile/talent-profile", label: "我的人才档案" },
] as const;

export function PrivatePage({ children }: { children: ReactNode }) {
  return <div className="campus-management-page">{children}</div>;
}

export function PrivateHeader({ title, subtitle, current, back, context, headingRef, onLeave, onCurrent }: {
  title: string; subtitle: string; current?: Area; back?: ReactNode; context?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>; onLeave?: () => boolean; onCurrent?: () => void;
}) {
  const { state } = useSession();
  function navigate(event: MouseEvent<HTMLAnchorElement>, same: boolean) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (same && onCurrent) { event.preventDefault(); onCurrent(); }
    else if (onLeave && !onLeave()) event.preventDefault();
  }
  return <header className="campus-private-header">
    <div className="campus-private-back">{back ?? <Link href="/profile" onClick={event => navigate(event, false)}><span aria-hidden="true">← </span>返回我的档案</Link>}</div>
    {context ? <div className="campus-private-context">{context}</div> : null}
    <div className="page-head"><h1 className="page-title" ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1><p className="page-subtitle">{subtitle}</p></div>
    {current && state.status === "authenticated" && state.me.role === "STUDENT" && state.me.status === "ACTIVE" ? <nav className="campus-private-nav" aria-label="本人双创管理">{links.map(link => <Link key={link.area} href={link.href} aria-current={link.area === current ? "page" : undefined} onClick={event => navigate(event, link.area === current)}>{link.label}</Link>)}</nav> : null}
  </header>;
}
