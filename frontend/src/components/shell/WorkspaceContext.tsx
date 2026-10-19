"use client";

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const ADMIN_DESTINATIONS: Record<string, string> = {
  users: '用户与账户', 'innovation-operations': '双创运营授权',
  'owner-qualifications': '负责人资格', whitelist: '注册白名单',
  rewards: '奖励目录', redemptions: '兑换审核', audit: '审计日志', system: '系统设置',
};

function CurrentContext() {
  const path = usePathname();
  const search = useSearchParams();
  // Route labels are public; private entity names remain owned by each page.
  let context = '学生首页';
  if (path.startsWith('/admin/')) context = `管理后台 / ${ADMIN_DESTINATIONS[path.split('/')[2]] ?? '管理后台'}`;
  else if (path.startsWith('/teacher/')) context = path.startsWith('/teacher/reviews') ? '教师工作台 / 提交审核' : path === '/teacher/tasks' ? '教师工作台 / 任务管理' : '教师工作台 / 任务详情';
  else if (path.startsWith('/claims/')) context = '任务 / 我的领取记录';
  else if (path.startsWith('/tasks')) context = path === '/tasks' ? '任务 / 任务广场' : '任务 / 任务详情';
  else if (path.startsWith('/innovation/mentors/me')) context = '导师工作区 / 本人档案与授权';
  else if (path.startsWith('/innovation/operations/mentors')) context = path === '/innovation/operations/mentors' ? '双创运营 / 导师录入与维护' : '双创运营 / 维护导师资料';
  else if (path.startsWith('/innovation/reviews')) context = '双创运营 / 核实待办';
  else if (path.startsWith('/innovation/mentors')) context = path === '/innovation/mentors' ? '校内空间 / 导师库' : '校内空间 / 导师资料';
  else if (path.startsWith('/innovation/projects')) context = path === '/innovation/projects' ? '创新创业 / 项目库' : '创新创业 / 项目详情';
  else if (path.startsWith('/innovation/recruitments')) context = path === '/innovation/recruitments' ? '校内空间 / 校内招募' : '创新创业 / 招募岗位';
  else if (path.startsWith('/innovation/achievements')) context = path === '/innovation/achievements' ? '创新创业 / 校内成果' : '创新创业 / 成果详情';
  else if (path.startsWith('/innovation/talents')) context = path === '/innovation/talents' ? '创新创业 / 人才库' : '创新创业 / 人才档案';
  else if (path.startsWith('/innovation')) context = '校内空间 / 创新创业';
  else if (path === '/profile/owner-profile') context = '我的 / 负责人资料与资格';
  else if (path === '/profile/talent-profile') context = '我的 / 我的人才档案';
  else if (path.startsWith('/profile/project-drafts')) context = path.endsWith('/achievements') ? '我的 / 我的成果' : path.endsWith('/recruitments') ? '我的 / 我的招募' : '我的 / 我的项目';
  else if (path === '/profile') {
    const tab = search.get('tab');
    context = tab === 'info' ? '校内空间 / 个人信息' : tab === 'owner' ? '我的 / 负责人资料与资格' : tab === 'projects' ? '我的 / 我的项目' : tab === 'achievements' ? '我的 / 我的成果' : tab === 'recruitments' ? '我的 / 我的招募' : tab === 'talent' ? '我的 / 我的人才档案' : '我的档案';
  } else if (path.startsWith('/notifications')) context = '通知';
  else if (path.startsWith('/rankings')) context = '排行榜';
  else if (path.startsWith('/rewards')) context = '积分奖励';
  return <span className="app-context">{context}</span>;
}

/** Query-dependent context stays below its own suspense boundary. */
export function WorkspaceContext() {
  return <Suspense fallback={<span className="app-context">校内空间</span>}><CurrentContext /></Suspense>;
}
