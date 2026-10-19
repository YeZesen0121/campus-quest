'use client';
import { CollaborationLoading } from './CollaborationLoading';

import { EmptyState, SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { getPublicProjectMembers } from './api';

export function PublicMembers({projectId}:{projectId:string}) {
  const {state,retry}=useSection(()=>getPublicProjectMembers(projectId));
  return <section className="section" aria-label="本人同意公开的项目成员"><h2 className="section-title">项目成员与分工</h2><p className="field-hint">仅展示本人明确同意的姓名与分工，不代表全部团队成员或平台身份认证；共同管理权限不在此公开。</p>{state.status==='loading'?<CollaborationLoading/>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:state.data.items.length?<dl className="r6-summary">{state.data.items.map((member,index)=><div key={index}><dt>{member.public_name}</dt><dd>{member.division}</dd></div>)}</dl>:<EmptyState title="暂无本人同意公开的成员"/>}</section>;
}
