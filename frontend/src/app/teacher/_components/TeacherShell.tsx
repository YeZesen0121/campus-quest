"use client";
/**
 * Staff shell for the /teacher workspace (design §8 Teacher; patterns §2).
 *
 * The session gate REUSES the student shell's `useSession` (SWR-style /me
 * cache) with a STAFF rule: TEACHER/ADMIN pass, a STUDENT session gets
 * the permission-denied panel (design §10: explain + navigate back, not a
 * page of failing sections), anonymous visitors get the staff-login CTA.
 * ACTIVE-account and confirmed-TOTP enforcement stays with the backend's
 * `require_staff_management_actor` — a 403 surfaces through each
 * section's error state, never a client-side guess.
 *
 * The nav is deliberately distinct from the student shell: review queue
 * first (the workbench's primary loop), then task management. Per-task
 * surfaces (import, statistics, community moderation) hang off the task
 * detail, so no separate nav entries exist for them.
 */
import Link from "next/link";
import { AuthFrame } from "@/features/auth/AuthFrame";
import { AuthPage } from "@/features/auth/AuthPage";
import { WorkspaceContext } from "@/components/shell/WorkspaceContext";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SectionError } from "@/components/ui/sectionStates";
import { StaffLogoutButton } from "@/components/shell/StaffLogoutButton";
import { StaffMenuSheet } from "@/components/shell/StaffMenuSheet";
import { ApprovedNavIcon, WorkspaceSidebar } from "@/components/shell/WorkspaceSidebar";
import { StaffShellSkeleton } from "@/components/shell/StaffShellSkeleton";
import { useSession } from "@/features/auth/session";
import { NicknameNudge } from "@/features/auth/NicknameNudge";
import { teacherWorkspaceGate } from "@/features/auth/workspace";
import { INNOVATION_NAV } from "@/features/innovation/InnovationNavigation";

/* Plan 11 Task 3: the shared sidebar geometry (frozen contract);
 * per-task surfaces (import, statistics, community moderation) hang
 * off the task detail, so no separate nav entries exist for them. */
const NAV_ITEMS = [
  { href: "/teacher/reviews", label: "审核队列", icon: <ApprovedNavIcon name="teacherReviews" /> },
  { href: "/teacher/tasks", label: "任务管理", icon: <ApprovedNavIcon name="teacherTasks" /> },
  INNOVATION_NAV,
  { href: "/teacher/profile", label: "个人信息", icon: <ApprovedNavIcon name="profile" /> },
] as const;

const SIDEBAR_GROUPS = [{ label: "教师工作台", items: NAV_ITEMS }] as const;

export function TeacherShell({ children }: { children: ReactNode }) {
  const { state, refresh } = useSession();
  const pathname = usePathname();

  if (state.status === "loading") {
    // PATH IS GEOMETRY (owner feedback 2026-10-15): the /teacher group
    // renders its own workspace shape from the first frame.
    return (
      <StaffShellSkeleton
        brandHref="/teacher/reviews"
        navLabel="教师工作台导航"
        navItems={NAV_ITEMS}
        sidebarGroupLabel="教师工作台"
      />
    );
  }

  if (state.status === "anonymous") {
    return <AuthFrame><AuthPage title="员工工作台" kicker="校内空间" description="任务管理与提交审核需要员工账号登录" links={<Link href="/login">返回学生入口</Link>}><Link className="btn btn-primary" href="/login">前往员工登录</Link></AuthPage></AuthFrame>;
  }

  if (state.status === "error") {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/teacher/reviews">华师令</Link>
          </div>
        </div>
        <main className="app-main">
          <SectionError error={state.error} onRetry={refresh} retryLabel="重新加载" />
        </main>
      </div>
    );
  }

  // Role gate (`workspace.ts`, PR #4 hardening Task 3): the staff
  // workspace mounts ONLY for TEACHER/ADMIN; a STUDENT session gets the
  // permission guidance (design §10: explain + navigate back), never a
  // page of 403ing sections.
  const gate = teacherWorkspaceGate(state.me.role);
  if (gate.kind !== "staff") {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/teacher/reviews">华师令</Link>
          </div>
        </div>
        <main className="app-main">
          <div className="alert alert-error" role="alert">
            <p>
              <span className="alert-marker" aria-hidden="true">!</span>
              教师工作台仅对教师与管理员开放，当前账号是{gate.kind === "mentor-guidance" ? "导师" : "学生"}账号。
            </p>
            <p>
              <Link className="link" href={gate.workspacePath}>
                {gate.kind === "mentor-guidance" ? "前往我的导师档案" : "返回学生首页"}
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        brand={{ href: "/teacher/reviews", label: "华师令" }}
        groups={SIDEBAR_GROUPS}
        workspaceCaption="教师工作台"
      />
      <div className="app-body">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/teacher/reviews">华师令</Link>
            <WorkspaceContext />
            <nav className="app-nav" aria-label="教师工作台导航">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="app-topbar-actions">
              <span className="app-user" title={state.me.nickname}>
                <span className="app-user-name">{state.me.nickname}</span>
                <span className="staff-role-tag">
                  {state.me.role === "ADMIN" ? "管理员" : "教师"}
                </span>
              </span>
              <StaffLogoutButton />
              <StaffMenuSheet label="教师工作台菜单" items={NAV_ITEMS} footer={<><p>{state.me.nickname} · {state.me.role === "ADMIN" ? "管理员" : "教师"}</p><StaffLogoutButton /></>} />
            </div>
          </div>
        </header>
        <main className="app-main">
          <NicknameNudge me={state.me} />
          {children}
        </main>
      </div>
    </div>
  );
}
