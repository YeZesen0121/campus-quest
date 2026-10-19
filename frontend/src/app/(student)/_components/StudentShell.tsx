"use client";
/**
 * Authenticated student shell (patterns §2/§8): client island wrapping the
 * whole (student) route group. The session hook (SWR-style /me cache)
 * gates the group — anonymous visitors get the login CTA instead of a
 * page of failing sections, a session outage gets a retryable error, and
 * only STUDENT sessions reach the pages (design §10); a TEACHER/ADMIN
 * session gets guidance to the staff workspace (see `workspace.ts`).
 *
 * Pages inside stay Server Components; this file is the ONLY client
 * boundary of the shell (patterns §2: isolate the interactive child).
 */
import Link from "next/link";
import { AuthFrame } from "@/features/auth/AuthFrame";
import { AuthPage } from "@/features/auth/AuthPage";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SectionError } from "@/components/ui/sectionStates";
import { BottomNav } from "@/components/shell/BottomNav";
import { WorkspaceContext } from "@/components/shell/WorkspaceContext";
import { ApprovedNavIcon, WorkspaceSidebar, navItemActive, type SideNavItem } from "@/components/shell/WorkspaceSidebar";
import { useSession } from "@/features/auth/session";
import { studentWorkspaceGate } from "@/features/auth/workspace";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { StaffMenuSheet } from "@/components/shell/StaffMenuSheet";
import { useSection } from "@/components/ui/useSection";
import { getInnovationCapabilities } from "@/features/innovation/operationsApi";
import { INNOVATION_NAV, OPERATIONS_NAV } from "@/features/innovation/InnovationNavigation";
import { getAuthEpoch } from "@/lib/accessToken";

/* Plan 11 Task 3 — the frozen navigation contract (route-true
 * amendment): desktop sidebar primary + secondary, narrow bottom nav.
 * 我的任务 stays anchored on the dashboard (its only list surface);
 * 社区 stays anchored on task detail — V1 has neither route. */
const SIDEBAR_PRIMARY = [
  { href: "/", label: "首页", icon: <ApprovedNavIcon name="home" /> },
  { href: "/tasks", label: "任务", icon: <ApprovedNavIcon name="tasks" /> },
  INNOVATION_NAV,
  { href: "/rankings", label: "排行榜", icon: <ApprovedNavIcon name="rankings" /> },
  { href: "/rewards", label: "积分奖励", icon: <ApprovedNavIcon name="rewards" /> },
] as const;

const SIDEBAR_SECONDARY = [
  { href: "/notifications", label: "通知", icon: <ApprovedNavIcon name="notifications" /> },
  { href: "/profile", label: "我的", icon: <ApprovedNavIcon name="profile" /> },
] as const;

/* The medium menu keeps every destination between sidebar and bottom. */
const MEDIUM_NAV = [...SIDEBAR_PRIMARY, ...SIDEBAR_SECONDARY];

const BOTTOM_NAV = [
  { href: "/", label: "首页", icon: <ApprovedNavIcon name="home" /> },
  { href: "/tasks", label: "任务", icon: <ApprovedNavIcon name="tasks" /> },
  INNOVATION_NAV,
  { href: "/rankings", label: "排行榜", icon: <ApprovedNavIcon name="rankings" /> },
  { href: "/profile", label: "我的", icon: <ApprovedNavIcon name="profile" /> },
] as const;

/* Audit #4: one grapheme-safe initial helper (nicknames are validated
 * per grapheme cluster; Array.from splits ZWJ emoji in half). */
function nicknameInitial(nickname: string): string {
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
  const first = segmenter.segment(nickname)[Symbol.iterator]().next();
  return first.done ? "同" : first.value.segment;
}

export function StudentShell({ children }: { children: ReactNode }) {
  const { state, refresh } = useSession();

  if (state.status === "loading") {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/">华师令</Link>
          </div>
        </div>
        <main className="app-main" aria-busy="true">
          <span className="skeleton skeleton-line" style={{ width: "40%" }} />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-block" />
        </main>
      </div>
    );
  }

  if (state.status === "anonymous") {
    return <AuthFrame><AuthPage title="登录华师令" kicker="校内空间" description="领取任务单元、累积积分并兑换奖励" links={<Link href="/register">注册学生账号</Link>}><Link className="btn btn-primary" href="/login">去登录</Link></AuthPage></AuthFrame>;
  }

  if (state.status === "error") {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/">华师令</Link>
          </div>
        </div>
        <main className="app-main">
          <SectionError error={state.error} onRetry={refresh} retryLabel="重新加载" />
        </main>
      </div>
    );
  }

  // Role gate (PR #4 hardening Task 3): the student workspace mounts
  // ONLY for a STUDENT session. A TEACHER/ADMIN session gets guidance
  // to the staff workspace instead — and because the pages (children)
  // never mount, none of the student-only sections can fire their API
  // calls from a staff session.
  const gate = studentWorkspaceGate(state.me.role);
  if (gate.kind !== "student") {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/">华师令</Link>
          </div>
        </div>
        <main className="app-main">
          <div className="alert alert-warning" role="alert">
            <p>
              <span className="alert-marker" aria-hidden="true">!</span>
              学生工作区仅对学生账号开放，当前登录的是{gate.kind === "mentor-guidance" ? "导师" : "教师或管理员"}账号。
            </p>
            <p>
              <Link className="btn btn-primary" href={gate.workspacePath}>
                {gate.kind === "mentor-guidance" ? "前往我的导师档案" : "前往教师工作台"}
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return <StudentNavigationShell key={`${state.me.id}:${getAuthEpoch()}`} nickname={state.me.nickname} active={state.me.status === "ACTIVE"}>{children}</StudentNavigationShell>;
}

function StudentNavigationShell({ children, nickname, active }: { children: ReactNode; nickname: string; active: boolean }) {
  const pathname = usePathname();
  const { state: capabilities, retry } = useSection(() => active ? getInnovationCapabilities().then((data) => data.operations_enabled) : Promise.resolve(false));
  const operationsEnabled = capabilities.status === "ready" && capabilities.data;
  const groups = [
    { label: "主导航", items: SIDEBAR_PRIMARY },
    { label: "个人", items: SIDEBAR_SECONDARY },
    ...(operationsEnabled ? [{ label: "双创运营", items: [OPERATIONS_NAV] }] : []),
  ];
  const nav: SideNavItem[] = [...MEDIUM_NAV, ...(operationsEnabled ? [OPERATIONS_NAV] : [])];
  return (
    <div className="app-shell">
      <WorkspaceSidebar
        brand={{ href: "/", label: "华师令" }}
        groups={groups}
        workspaceCaption={pathname.startsWith('/innovation/operations/') || pathname.startsWith('/innovation/reviews') ? '双创运营' : undefined}
        density={pathname.startsWith('/innovation/mentors') ? 'compact' : undefined}
        footer={
          // Review round 2: the account lives in the rail footer — a
          // purposeful bottom anchor for the dark rail, and one less
          // floating generic-admin element at the top.
          <Link className="rail-account" href="/profile" title="我的账户">
            <span className="rail-avatar" aria-hidden="true">
              {nicknameInitial(nickname)}
            </span>
            <span className="rail-account-name">{nickname}</span>
          </Link>
        }
      />
      <div className="app-body">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/">华师令</Link>
            <WorkspaceContext />
            <nav className="app-nav" aria-label="主导航">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={navItemActive(pathname, item.href, item.exclude) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="app-topbar-actions">
              <NotificationBell />
              <Link
                className="app-user app-account-name"
                href="/profile"
                aria-label="我的账户"
                title="我的账户"
              >
                {nickname}
              </Link>
              <StaffMenuSheet label="全部导航" items={nav} footer={<><p>{nickname}</p><Link className="btn btn-ghost" href="/profile?tab=info">个人信息</Link><Link className="btn btn-ghost" href="/logout" prefetch={false}>退出登录</Link></>} />
            </div>
          </div>
        </header>
        <main className="app-main">
          {capabilities.status === "error" ? <SectionError error={capabilities.error} onRetry={retry} retryLabel="重新读取运营入口" /> : null}
          {children}
        </main>
      </div>
      <BottomNav items={BOTTOM_NAV} />
    </div>
  );
}
