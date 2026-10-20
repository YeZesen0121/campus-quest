"use client";
/**
 * Staff shell for the /admin workspace (design §8 Admin; patterns §2 —
 * the TeacherShell precedent).
 *
 * The session gate reuses the shared `useSession` cache with an
 * ADMIN-only rule (`adminWorkspaceGate`): `kind: "admin"` is the sole
 * branch that mounts the admin pages, so a TEACHER or STUDENT
 * session renders ONLY the permission guidance — zero admin API calls
 * fire (the plan's step-1 privilege test; the backend's
 * `require_admin_actor` stays the authority, this gate is the
 * no-wasted-requests mirror). Anonymous visitors get the staff-login
 * CTA; ACTIVE-account and confirmed-TOTP enforcement stays server-side.
 *
 * The nav lists the seven operational pages (users/invitations/
 * platforms/rewards/redemptions/audit/system; the whitelist entry
 * retired with auth extension II, the approvals entry follows); the
 * anonymous-reveal entry deliberately does NOT live here — it hangs off
 * the teacher workspace's community moderation context where the
 * comment rows are.
 */
import Link from "next/link";
import { AuthFrame } from "@/features/auth/AuthFrame";
import { AuthPage } from "@/features/auth/AuthPage";
import { WorkspaceContext } from "@/components/shell/WorkspaceContext";
import { RAIL_WIDTH_ADMIN_DEFAULT_PX } from "@/lib/sidebarPreference";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SectionError } from "@/components/ui/sectionStates";
import { StaffLogoutButton } from "@/components/shell/StaffLogoutButton";
import { StaffMenuSheet } from "@/components/shell/StaffMenuSheet";
import { ApprovedNavIcon, navItemActive, WorkspaceSidebar } from "@/components/shell/WorkspaceSidebar";
import { StaffShellSkeleton } from "@/components/shell/StaffShellSkeleton";
import { useSession } from "@/features/auth/session";
import { NicknameNudge } from "@/features/auth/NicknameNudge";
import { adminWorkspaceGate } from "@/features/auth/workspace";
import { INNOVATION_NAV } from "@/features/innovation/InnovationNavigation";

const NAV_ITEMS = [
  { href: "/admin", label: "概览", icon: <ApprovedNavIcon name="tasks" /> },
  { href: "/admin/users", label: "用户与账户", icon: <ApprovedNavIcon name="adminUsers" /> },
  { href: "/admin/invitations", label: "员工邀请", icon: <ApprovedNavIcon name="notifications" /> },
  { href: "/admin/platforms", label: "平台管理", icon: <ApprovedNavIcon name="tasks" /> },
  { href: "/admin/approvals", label: "注册审批", icon: <ApprovedNavIcon name="teacherReviews" /> },
  { href: "/admin/innovation-operations", label: "双创运营授权", icon: <ApprovedNavIcon name="adminOperations" /> },
  { href: "/admin/owner-qualifications", label: "负责人资格", icon: <ApprovedNavIcon name="adminQualification" /> },
  { href: "/admin/rewards", label: "奖励目录", icon: <ApprovedNavIcon name="adminRewards" /> },
  { href: "/admin/redemptions", label: "兑换审核", icon: <ApprovedNavIcon name="adminRedemptions" /> },
  { href: "/admin/audit", label: "审计日志", icon: <ApprovedNavIcon name="adminAudit" /> },
  { href: "/admin/system", label: "系统设置", icon: <ApprovedNavIcon name="adminSystem" /> },
  INNOVATION_NAV,
] as const;

const SIDEBAR_GROUPS = [{ label: "管理后台", items: NAV_ITEMS }] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const { state, refresh } = useSession();
  const pathname = usePathname();

  if (state.status === "loading") {
    // PATH IS GEOMETRY (owner feedback 2026-10-15): the /admin group
    // renders its own workspace shape from the first frame — no
    // white-bar topbar, no cross-shape repaint when the session lands.
    return (
      <StaffShellSkeleton
        brandHref="/admin"
        navLabel="管理后台导航"
        navItems={NAV_ITEMS}
        sidebarGroupLabel="管理后台"
      />
    );
  }

  if (state.status === "anonymous") {
    return <AuthFrame><AuthPage title="管理后台" kicker="校内空间" description="运营管理需要管理员账号登录" links={<Link href="/login">返回学生入口</Link>}><Link className="btn btn-primary" href="/login">前往员工登录</Link></AuthPage></AuthFrame>;
  }

  if (state.status === "error") {
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/admin/users">华师令</Link>
          </div>
        </div>
        <main className="app-main">
          <SectionError error={state.error} onRetry={refresh} retryLabel="重新加载" />
        </main>
      </div>
    );
  }

  // Role gate: the admin workspace mounts ONLY for ADMIN; TEACHER and
  // STUDENT sessions get permission guidance (design §10) — never the
  // pages, so no admin data request can fire from a non-admin session.
  const gate = adminWorkspaceGate(state.me.role);
  if (gate.kind !== "admin") {
    const isTeacher = gate.kind === "staff-guidance";
    const isMentor = gate.kind === "mentor-guidance";
    return (
      <div className="app-shell">
        <div className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/admin/users">华师令</Link>
          </div>
        </div>
        <main className="app-main">
          <div className="alert alert-error" role="alert">
            <p>
              <span className="alert-marker" aria-hidden="true">!</span>
              管理后台仅对管理员开放，当前账号是{isTeacher ? "教师" : isMentor ? "导师" : "学生"}账号。
            </p>
            <p>
              <Link className="link" href={gate.workspacePath}>
                {isTeacher ? "返回教师工作台" : isMentor ? "前往我的导师档案" : "返回学生首页"}
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
        brand={{ href: "/admin", label: "华师令" }}
        groups={SIDEBAR_GROUPS}
        workspaceCaption="管理后台"
        defaultWidthPx={RAIL_WIDTH_ADMIN_DEFAULT_PX}
      />
      <div className="app-body">
        <header className="app-topbar">
          <div className="app-topbar-inner">
            <Link className="app-brand" href="/admin/users">华师令</Link>
            <WorkspaceContext />
            <nav className="app-nav" aria-label="管理后台导航">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={navItemActive(pathname, item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="app-topbar-actions">
              <span className="app-user" title={state.me.nickname}>
                <span className="app-user-name">{state.me.nickname}</span>
                <span className="staff-role-tag">管理员</span>
              </span>
              <StaffLogoutButton />
              <StaffMenuSheet label="管理后台菜单" items={NAV_ITEMS} footer={<><p>{state.me.nickname} · 管理员</p><StaffLogoutButton /></>} />
            </div>
          </div>
        </header>
        <main className="app-main campus-admin-main">
          <NicknameNudge me={state.me} />
          {children}
        </main>
      </div>
    </div>
  );
}
