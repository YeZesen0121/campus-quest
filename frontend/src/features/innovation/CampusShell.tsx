"use client";

import Link from 'next/link';
import type { ReactNode } from 'react';
import { StudentShell } from '@/app/(student)/_components/StudentShell';
import { ApprovedNavIcon, WorkspaceSidebar, type SideNavItem } from '@/components/shell/WorkspaceSidebar';
import { StaffMenuSheet } from '@/components/shell/StaffMenuSheet';
import { WorkspaceContext } from '@/components/shell/WorkspaceContext';
import { SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { useSession } from '@/features/auth/session';
import { landingPathForRole } from '@/features/auth/workspace';
import { getAuthEpoch } from '@/lib/accessToken';
import { INNOVATION_NAV } from './InnovationNavigation';

/** Keep the session/ACTIVE/role gate and identity key ahead of page children. */
export function CampusShell({ children }: { children: ReactNode }) {
  const { state, refresh } = useSession();
  if (state.status === 'authenticated' && state.me.role === 'STUDENT' && state.me.status === 'ACTIVE') return <StudentShell>{children}</StudentShell>;
  const workspace = state.status === 'authenticated' ? state.me.role === 'ADMIN' ? '/admin/users' : landingPathForRole(state.me.role) : '/';
  const navigation: SideNavItem[] = state.status === 'authenticated' && state.me.role === 'MENTOR'
    ? [{ href: '/innovation/mentors/me', label: '本人档案与授权', icon: <ApprovedNavIcon name="mentorProfile" /> }, { href: '/innovation/mentors/me#mentor-projects', label: '项目挂名待办', icon: <ApprovedNavIcon name="mentorProjects" /> }, { href: '/innovation/mentors', label: '浏览导师库', exclude: ['/innovation/mentors/me'], icon: <ApprovedNavIcon name="mentorDirectory" /> }]
    : [{ ...INNOVATION_NAV, exclude: [...(INNOVATION_NAV.exclude ?? []), ...(workspace.startsWith('/innovation') ? [workspace] : [])] }, { href: workspace, label: '返回工作台' }];
  return <div className="app-shell">
    <WorkspaceSidebar brand={{ href: '/innovation', label: '华师令' }} workspaceCaption={state.status === 'authenticated' && state.me.role === 'MENTOR' ? '导师工作区' : undefined} density="compact" groups={state.status === 'authenticated' && state.me.role === 'MENTOR' ? [{ label: '导师工作区', items: navigation }] : [{ label: '校内发现', items: navigation.slice(0, 1) }, { label: '工作区', items: navigation.slice(1) }]} />
    <div className="app-body">
      <header className="app-topbar"><div className="app-topbar-inner">
        <Link className="app-brand" href="/innovation">华师令</Link><WorkspaceContext />
        <nav className="app-nav" aria-label="校内浏览导航">
          <Link href="/innovation">创新创业</Link><Link href={workspace}>返回工作台</Link>
        </nav>
        <div className="app-topbar-actions">
          {state.status === 'authenticated' ? <span className="app-user" title={state.me.nickname}><span className="app-user-name">{state.me.nickname}</span><span className="staff-role-tag">{state.me.role === 'MENTOR' ? '导师' : state.me.role === 'ADMIN' ? '管理员' : state.me.role === 'TEACHER' ? '教师' : '学生'}</span></span> : null}
          <StaffMenuSheet label="校内浏览菜单" items={navigation} footer={state.status === 'authenticated' ? <><p>{state.me.nickname}</p><Link className="btn btn-ghost" href="/logout" prefetch={false}>退出登录</Link></> : undefined} />
          {state.status === 'authenticated' ? <Link className="btn btn-ghost app-logout" href="/logout" prefetch={false}>退出登录</Link> : null}
        </div>
      </div></header>
      <main className="app-main task-detail">
        {state.status === 'loading' ? <SectionSkeleton /> : state.status === 'error' ? <SectionError error={state.error} onRetry={refresh} /> : state.status === 'anonymous' ? <p className="alert">请先<Link href="/login">登录校内账号</Link>后浏览成果。</p> : state.me.status !== 'ACTIVE' ? <p className="alert alert-warning" role="alert">当前账号状态不允许浏览校内成果。</p> : <div key={`${state.me.id}:${getAuthEpoch()}`}>{children}</div>}
      </main>
    </div>
  </div>;
}
