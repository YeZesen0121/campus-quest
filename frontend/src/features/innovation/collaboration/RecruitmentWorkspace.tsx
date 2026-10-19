'use client';
import { CollaborationLoading } from './CollaborationLoading';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { PrivateHeader } from '../PrivateWorkspace';
import { RecruitmentEditor } from '../RecruitmentEditor';
import { recruitmentStatusText } from '../recruitmentPresentation';
import { getPendingRecruitment } from '../recruitmentPending';
import { getRecruitmentRecovery } from '../recruitmentRecovery';
import { getWorkspace, getWorkspaceRecruitment, getWorkspaceRecruitments, type ProjectWorkspace } from './api';
import { PageControls } from './CollaborationInbox';

export function CollaborativeRecruitments({projectId}:{projectId:string}) {
  const {state}=useSession();if(state.status!=='authenticated')return null;
  return <Guard key={`${state.me.id}:${getAuthEpoch()}:${projectId}`} projectId={projectId}/>;
}
function Guard({projectId}:{projectId:string}) {
  const {state,retry}=useSection(()=>getWorkspace(projectId));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <><SectionError error={state.error} onRetry={retry}/><Link href="/profile/collaboration">返回协作与交接</Link></>;
  return <Workspace project={state.data}/>;
}
function Workspace({project}:{project:ProjectWorkspace}) {
  const projectId=project.draft.id;const recoveryKey=`collaboration:${projectId}`;
  const [selected,setSelected]=useState<string|null|undefined>(()=>{
    const pending=getPendingRecruitment(recoveryKey),recovery=getRecruitmentRecovery(recoveryKey);
    return pending?pending.command.id:recovery?recovery.record?.id??null:undefined;
  });
  const [offset,setOffset]=useState(0);
  const blocked=project.draft.lifecycle==='COMPLETED'?'项目已结项。可准备草稿、关闭或撤销联系；开放招募须负责人先恢复为进行中。':!project.can_publish_recruitment?'当前可准备草稿、关闭或撤销联系。发布招募须当前负责人及操作者都具备有效资格。':undefined;
  const props={projectId,projectDefaults:project.draft,onBack:()=>setSelected(undefined),collaboration:true,publicationBlockedReason:blocked};
  if(selected!==undefined){
    if(selected===null||getPendingRecruitment(recoveryKey)||getRecruitmentRecovery(recoveryKey))return <RecruitmentEditor {...props}/>;
    return <EditorLoader key={selected} recruitmentId={selected} editorProps={props}/>;
  }
  return <><PrivateHeader title="协作招募管理" subtitle={project.draft.title} back={<Link href={`/profile/collaboration/projects/${projectId}`}>返回协作工作区</Link>}/><p className="field-hint">复用同一招募编辑器；按当前协作权限操作。保存不自动更新公开版本；联系渠道须预览并明确授权。</p>{blocked?<p className="alert alert-warning" role="alert">{blocked}</p>:null}<section className="section" aria-label="协作招募岗位"><div className="section-head"><h2 className="section-title">招募岗位</h2><Button onClick={()=>setSelected(null)}>新建招募岗位</Button></div><RecruitmentList key={offset} projectId={projectId} offset={offset} onPage={setOffset} onEdit={setSelected}/></section></>;
}
type EditorProps={projectId:string;projectDefaults:ProjectWorkspace['draft'];onBack:()=>void;collaboration:boolean;publicationBlockedReason:string|undefined};
function EditorLoader({recruitmentId,editorProps}:{recruitmentId:string;editorProps:EditorProps}) {
  const {state,retry}=useSection(()=>getWorkspaceRecruitment(editorProps.projectId,recruitmentId));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <><SectionError error={state.error} onRetry={retry}/><Button variant="secondary" onClick={editorProps.onBack}>返回协作招募列表</Button></>;
  return <RecruitmentEditor {...editorProps} initial={state.data}/>;
}
function RecruitmentList({projectId,offset,onPage,onEdit}:{projectId:string;offset:number;onPage:(offset:number)=>void;onEdit:(id:string)=>void}) {
  const {state,retry}=useSection(()=>getWorkspaceRecruitments(projectId,offset));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return <>{state.data.items.length?<ul className="ie-draft-list">{state.data.items.map(item=><li className="ie-draft-row" key={item.id}><div className="ie-draft-copy"><h3 className="section-title">{item.fields.role_name||'未命名岗位'}</h3><p>{recruitmentStatusText(item.status,item.moderation_state)}{item.has_unpublished_changes?' · 有未发布改动':''}</p><p className="field-hint">交接关闭的岗位须逐岗核对内容和新联系渠道，再预览并明确重新开放。</p></div><Button variant="secondary" onClick={()=>onEdit(item.id)}>编辑与核对岗位</Button></li>)}</ul>:<EmptyState title="暂无招募岗位"/>}<PageControls offset={offset} total={state.data.total} onPage={onPage} label="协作招募分页"/></>;
}
