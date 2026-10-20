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
 *
 * Chrome verdict (backlog UX: the refresh shell jump): while the
 * session resolves, the pre-resolve frames (loading, error) render the
 * workspace geometry OPTIMISTICALLY when the server HTML carried
 * session evidence (`shellChromeFor` + the layout's cookie probe), so
 * a reload never repaints a different shell for the ~0.6s resolve
 * window. The user-data slots (rail account, topbar actions) render
 * as placeholders; the notification bell does NOT mount until the
 * session answers (no speculative polling).
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
import { BellIcon } from "@/components/shell/navIcons";
import type { MeProfile } from "@/features/auth/session";
import { useSession } from "@/features/auth/session";
import { NicknameNudge } from "@/features/auth/NicknameNudge";
import { ApprovalPendingBanner } from "@/features/auth/ApprovalPendingBanner";
import { shellChromeFor, type ShellHint } from "@/features/auth/shellChrome";
import { StaffRouteRedirect } from "@/features/auth/StaffRouteRedirect";
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
const SIDEBAR_GROUPS = [{ label: "主导航", items: SIDEBAR_PRIMARY }, { label: "个人", items: SIDEBAR_SECONDARY }];

const MEDIUM_NAV: readonly SideNavItem[] = [...SIDEBAR_PRIMARY, ...SIDEBAR_SECONDARY];

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

/** The medium band's horizontal top nav — shared by the authenticated
 * shell and the optimistic pre-resolve frame so the two cannot drift. */
function MediumTopNav({ pathname }: { pathname: string }) {
  return (
    <nav className="app-nav" aria-label="主导航">
      {MEDIUM_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={navItemActive(pathname, item.href, item.exclude) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** The rail footer's account slot while the session resolves: the
 * real avatar + nickname are user data, so the optimistic frame holds
 * their geometry with rail-toned placeholders instead. */
function RailAccountPlaceholder() {
  return (
    <div className="rail-account" data-loading="true" aria-hidden="true">
      <span className="rail-avatar skeleton" />
      <span className="rail-account-name-slot skeleton skeleton-line" />
    </div>
  );
}

/**
 * The optimistic workspace frame: the authenticated shell's geometry
 * (rail, degraded topbar strip with its actions pill, bottom nav)
 * with the session-dependent slots as placeholders. Serves the
 * loading frame (skeleton content) and the session-outage frame
 * (retryable error card) — a resolve or a retry then settles into
 * the authenticated shell WITHOUT a layout jump.
 */
function OptimisticWorkspaceShell({
  state,
  main,
}: {
  state: "loading" | "error";
  main: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="app-shell" data-shell={state}>
      <WorkspaceSidebar
        brand={{ href: "/", label: "华师令" }}
        groups={SIDEBAR_GROUPS}
        footer={<RailAccountPlaceholder />}
      />
      <div className="app-body">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <span className="app-brand">华师令</span>
            <MediumTopNav pathname={pathname} />
            <div className="app-topbar-actions" aria-hidden="true">
              {/* The bell's glyph at rest — the real NotificationBell
               * polls, so it mounts only once the session answers. */}
              <span className="topbar-bell">
                <span className="bell-glyph">
                  <BellIcon />
                </span>
              </span>
              <span className="avatar-chip skeleton" />
            </div>
          </div>
        </header>
        <main className="app-main" aria-busy={state === "loading" ? "true" : undefined}>
          {main}
        </main>
      </div>
      <BottomNav items={BOTTOM_NAV} />
    </div>
  );
}

/** The minimal single-column shell: the chrome for visitors WITHOUT
 * session evidence (the pre-resolve frames) and for everyone the
 * workspace is not for (anonymous card, staff guidance). */
function MinimalShell({ state, children }: { state: string; children?: ReactNode }) {
  return (
    <div className="app-shell" data-shell={state}>
      <div className="app-topbar">
        <div className="app-topbar-inner">
          <span className="app-brand">华师令</span>
        </div>
      </div>
      <main className="app-main" aria-busy={state === "loading" ? "true" : undefined}>
        {children}
      </main>
    </div>
  );
}

export function StudentShell({
  children,
  sessionCookiePresent,
  shellHint,
}: {
  children: ReactNode;
  /** The layout's server-side probe: did the document request carry
   * the readable csrf cookie (session evidence)? */
  sessionCookiePresent: boolean;
  /** The mint's coarse role hint (cq_shell), when present — routes a
   * STAFF session's pre-resolve frames to the minimal chrome (their
   * terminal geometry here) instead of the student workspace. */
  shellHint: ShellHint | undefined;
}) {
  const { state, refresh } = useSession();

  if (state.status === "loading") {
    if (shellChromeFor("loading", sessionCookiePresent, shellHint) === "workspace") {
      return (
        <OptimisticWorkspaceShell
          state="loading"
          main={
            <>
              <span className="skeleton skeleton-line" style={{ width: "40%" }} />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-block" />
            </>
          }
        />
      );
    }
    if (shellHint === "staff") {
      // The staff redirect placeholder: the hint routes the pre-resolve
      // frame to minimal geometry carrying the SAME quiet copy the
      // redirect island shows — one placeholder across the whole jump.
      return (
        <MinimalShell state="loading">
          <p className="field-hint" role="status">
            正在前往工作台…
            <span className="spinner" aria-hidden="true" />
          </p>
        </MinimalShell>
      );
    }
    return (
      <MinimalShell state="loading">
        <span className="skeleton skeleton-line" style={{ width: "40%" }} />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-block" />
      </MinimalShell>
    );
  }

  if (state.status === "anonymous") {
    return <div className="app-shell" data-shell="anonymous"><AuthFrame><AuthPage title="登录华师令" kicker="校内空间" description="领取任务单元、累积积分并兑换奖励" links={<Link href="/register">注册学生账号</Link>}><Link className="btn btn-primary" href="/login">去登录</Link></AuthPage></AuthFrame></div>;
  }

  if (state.status === "error") {
    const errorCard = <SectionError error={state.error} onRetry={refresh} retryLabel="重新加载" />;
    if (shellChromeFor("error", sessionCookiePresent, shellHint) === "workspace") {
      return <OptimisticWorkspaceShell state="error" main={errorCard} />;
    }
    if (shellHint === "staff") {
      // A /me failure under a staff hint: the error frame lives INSIDE
      // the placeholder shell — a retry AND a way out (the session may
      // be dead), never an infinite 正在前往.
      return (
        <MinimalShell state="error">
          {errorCard}
          <p className="auth-alt-action">
            <Link className="link" href="/login">
              前往员工登录
            </Link>
          </p>
        </MinimalShell>
      );
    }
    return <MinimalShell state="error">{errorCard}</MinimalShell>;
  }

  // Role gate (PR #4 hardening Task 3): the student workspace mounts
  // ONLY for a STUDENT session. A TEACHER/ADMIN session is REDIRECTED
  // to its own workspace (audit item A, owner feedback 2026-10-15 —
  // the guidance card is retired for this family; true cross-role
  // errors keep their cards in the staff shells) — and because the
  // pages (children) never mount, none of the student-only sections
  // can fire their API calls from a staff session.
  const gate = studentWorkspaceGate(state.me.role);
  if (gate.kind !== "student") {
    return (
      <MinimalShell state="gate">
        {gate.kind === "mentor-guidance" ? (
          <div className="alert alert-warning" role="alert">
            <p>学生工作区仅对学生账号开放，当前登录的是导师账号。</p>
            <Link className="btn btn-primary" href={gate.workspacePath}>前往我的导师档案</Link>
          </div>
        ) : <StaffRouteRedirect role={state.me.role} />}
      </MinimalShell>
    );
  }

  return <StudentNavigationShell key={`${state.me.id}:${getAuthEpoch()}`} me={state.me}>{children}</StudentNavigationShell>;
}

function StudentNavigationShell({ children, me }: { children: ReactNode; me: MeProfile }) {
  const nickname = me.nickname;
  const active = me.status === "ACTIVE";
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
    <div className="app-shell" data-shell="workspace">
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
          <ApprovalPendingBanner me={me} />
          <NicknameNudge me={me} />
          {children}
        </main>
      </div>
      <BottomNav items={BOTTOM_NAV} />
    </div>
  );
}
