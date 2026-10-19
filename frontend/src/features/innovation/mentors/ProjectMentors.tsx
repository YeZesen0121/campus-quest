'use client';
import Link from 'next/link';
import { useState } from 'react';
import { DividedSections } from '@/components/ui/dividedSections';
import { formatDeadlineDateTime } from '@/lib/time';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { getOwnMentorLinks, getProjectMentorLinks, getPublicProjectMentors, getPublicMentors, type ProjectMentor, type MentorSummary } from './api';
import { useRecoveredMentorAction, useMentorRecoveryEntry } from './useRecoveredMentorAction';
import { linkRecovery, mentorWorkspace } from './recoveryCommands';
import { ActionFeedback } from './ActionFeedback';
import { LINK_STATUS } from './presentation';
import { getOwnerQualification } from '../qualificationApi';

export function MentorProjectInbox({refreshVersion}:{refreshVersion:number}){return <LinksWorkspace mentor refreshVersion={refreshVersion}/>;}
export function ProjectMentorManagement({projectId,invitationBlockedReason}:{projectId:string;invitationBlockedReason?:string}){return <LinksWorkspace projectId={projectId} mentor={false} invitationBlockedReason={invitationBlockedReason}/>;}
function InviteGate({projectId,onChange,invitationBlockedReason}:{projectId:string;onChange:()=>void;invitationBlockedReason?:string}){
  const recovery=useMentorRecoveryEntry(linkRecovery,mentorWorkspace.invite(projectId));
  const {state,retry}=useSection(getOwnerQualification);
  if(recovery)return <InviteMentor projectId={projectId} onChange={onChange} invitationBlockedReason={invitationBlockedReason}/>;
  if(state.status==='loading')return <SectionSkeleton/>;
  if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return state.data.status==='APPROVED'?<InviteMentor projectId={projectId} onChange={onChange} invitationBlockedReason={invitationBlockedReason}/>:<p className="field-hint">取得项目负责人资格后，可邀请导师单独确认挂名。<Link href="/profile/owner-profile">完善负责人资料与资格</Link>；已有挂名仍可在下方解除。</p>;
}
function LinksWorkspace({projectId,mentor,invitationBlockedReason,refreshVersion=0}:{projectId?:string;mentor:boolean;invitationBlockedReason?:string;refreshVersion?:number}) {
  const recovery=useMentorRecoveryEntry(linkRecovery,mentorWorkspace.links(projectId));
  const [revision,setRevision]=useState(0);const [offset,setOffset]=useState(()=>recovery?.context.offset??0);
  const [appliedRefreshVersion,setAppliedRefreshVersion]=useState(refreshVersion);
  const refresh=()=>setRevision(value=>value+1);
  // Rows may move between pages after an action. Keep the original command and
  // its result outside those rows so refreshing cannot discard an unknown result.
  const action=useRecoveredMentorAction(linkRecovery,mentorWorkspace.links(projectId),refresh);const locked=action.locked||!!action.error?.refresh;
  // Profile changes invalidate list data, not the workspace's command or page.
  // Apply the newest signal only after any unknown command has been resolved.
  if(!action.locked&&appliedRefreshVersion!==refreshVersion)setAppliedRefreshVersion(refreshVersion);
  function mutate(link:ProjectMentor,kind:'accept'|'reject'|'revoke'){if(locked)return;const body={request_id:crypto.randomUUID(),version:link.version};void action.run({kind:'link',linkId:link.id,action:kind,body},{offset});}
  return <section className="section campus-mentor-links" id={mentor?'mentor-projects':undefined} aria-label={mentor?'导师项目挂名待办':'项目导师挂名'}><h2 className="section-title">{mentor?'项目挂名待办':'项目导师挂名'}</h2><p className="field-hint">挂名必须由导师对具体项目单独同意，不授予项目管理或证明材料权限。双方均可解除。</p>{mentor?<p className="campus-mentor-invitation-note">这是负责人向你提供的邀请摘要，仅用于核对。公开挂名沿用项目已获准公开的信息，不因此公开私有项目。</p>:null}<DividedSections className={mentor?'campus-mentor-inbox-body':'campus-mentor-links-grid'}>{!mentor&&projectId?<section className="section" aria-label="查找并邀请导师"><h3 className="section-title">查找并邀请导师</h3><InviteGate projectId={projectId} onChange={refresh} invitationBlockedReason={invitationBlockedReason??(locked?'请先处理当前挂名操作，再发起新的邀请。':undefined)}/></section>:null}<section className="section" aria-label="挂名关系与历史">{!mentor?<h3 className="section-title">挂名关系与历史</h3>:null}<LinkRows key={`${revision}:${offset}:${appliedRefreshVersion}`} projectId={projectId} mentor={mentor} offset={offset} onPage={setOffset} locked={locked} onAction={mutate}/><div role="region" aria-label="项目挂名操作结果"><ActionFeedback {...action} pending={!!action.pending} onRetry={()=>void action.retry()} onRefresh={()=>{action.clearError();refresh();}}/></div></section></DividedSections></section>;
}
function LinkRows({projectId,mentor,offset,onPage,locked,onAction}:{projectId?:string;mentor:boolean;offset:number;onPage:(value:number)=>void;locked:boolean;onAction:(link:ProjectMentor,kind:'accept'|'reject'|'revoke')=>void}) {
  const {state,retry}=useSection(()=>{const params=new URLSearchParams({limit:'20',offset:String(offset)});return mentor?getOwnMentorLinks(params):getProjectMentorLinks(projectId!,params);});
  if(state.status==='loading')return <SectionSkeleton/>;if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  const page=state.data;
  return <>{page.items.length?<ul className="ie-draft-list">{page.items.map(link=><LinkRow key={`${link.id}:${link.version}`} link={link} mentor={mentor} locked={locked} onAction={kind=>onAction(link,kind)}/>)}</ul>:<EmptyState title={mentor?'暂无项目挂名待办':'尚未邀请导师挂名'} hint="同意前不会在公开项目中展示导师。"/>}<nav className="ie-draft-actions" aria-label={mentor?'导师项目挂名分页':'项目导师挂名分页'}><Button variant="secondary" disabled={locked||page.offset===0} onClick={()=>onPage(Math.max(0,page.offset-page.limit))}>上一页</Button><p className="field-hint" role="status" aria-label="项目挂名分页状态">第 {Math.floor(page.offset/page.limit)+1} 页 · 共 {page.total} 项</p><Button variant="secondary" disabled={locked||page.offset+page.limit>=page.total} onClick={()=>onPage(page.offset+page.limit)}>下一页</Button></nav></>;
}
function LinkRow({link,mentor,locked,onAction}:{link:ProjectMentor;mentor:boolean;locked:boolean;onAction:(kind:'accept'|'reject'|'revoke')=>void}) {
  return <li className="ie-draft-row campus-mentor-link-row"><div className="ie-draft-copy"><div className="campus-mentor-person-head"><h3 className="section-title">{mentor?link.project_title:link.mentor_name}</h3><p className="campus-mentor-state" data-link-status={link.status}>{LINK_STATUS[link.status]}</p></div>{mentor?<><p className="ie-review-prose">{link.project_summary||'项目简介暂未填写'}</p><p className="field-hint">方向：{link.project_direction||'暂未填写'}</p></>:null}<p className="field-hint"><time dateTime={link.created_at}>{formatDeadlineDateTime(Date.parse(link.created_at))}</time></p><div className="ie-draft-actions">{mentor&&link.status==='PENDING'?<><Button disabled={locked} onClick={()=>onAction('accept')}>同意此项目挂名</Button><Button variant="secondary" disabled={locked} onClick={()=>onAction('reject')}>拒绝此项目挂名</Button></>:null}{link.status==='PENDING'||link.status==='ACCEPTED'?<Button variant="secondary" disabled={locked} onClick={()=>onAction('revoke')}>解除此项目挂名</Button>:null}</div></div></li>;
}

function InviteMentor({projectId,onChange,invitationBlockedReason}:{projectId:string;onChange:()=>void;invitationBlockedReason?:string}) {
  const recovery=useMentorRecoveryEntry(linkRecovery,mentorWorkspace.invite(projectId));
  const [query,setQuery]=useState(()=>recovery?.context.invite?.query??'');const [searched,setSearched]=useState<string|null>(()=>recovery?.context.invite?.searched??null);const [searchAttempt,setSearchAttempt]=useState(0);const [selected,setSelected]=useState<MentorSummary|null>(()=>recovery?.context.invite?structuredClone(recovery.context.invite.selected):null);
  const action=useRecoveredMentorAction(linkRecovery,mentorWorkspace.invite(projectId),()=>{setSelected(null);onChange();});
  const locked=action.locked||!!invitationBlockedReason;
  return <div className="panel form campus-mentor-invite">{invitationBlockedReason?<p role="status" className="field-hint">{invitationBlockedReason} 已有挂名仍可在下方解除。</p>:null}<form className="campus-mentor-search" method="get" aria-label="查找项目导师" onSubmit={event=>{event.preventDefault();if(locked)return;setSearched(query.trim());setSearchAttempt(value=>value+1);setSelected(null);}}><div className="field"><label className="field-label" htmlFor="project-mentor-search">查找已展示的导师</label><input className="input" id="project-mentor-search" placeholder="姓名、单位或方向" maxLength={100} value={query} disabled={locked} onChange={event=>setQuery(event.target.value)}/></div><Button variant="secondary" type="submit" aria-label="搜索可邀请导师" disabled={locked}>搜索</Button></form>{searched!==null?<MentorOptions key={`${searched}:${searchAttempt}`} query={searched} selected={selected?.id} disabled={locked} onSelect={setSelected}/>:null}{selected?<><p className="field-hint">将已保存的项目名称、简介和方向提供给 {selected.name} 核对；挂名需导师同意，项目不会因此自动公开。</p><Button disabled={locked||action.error?.refresh} onClick={()=>{if(locked)return;const body={request_id:crypto.randomUUID(),mentor_id:selected.id};void action.run({kind:'invite',projectId,body},{invite:{query,searched,selected}});}}>向导师发起挂名确认</Button></>:null}<ActionFeedback {...action} pending={!!action.pending} onRetry={()=>void action.retry()} onRefresh={()=>{action.clearError();setSelected(null);setSearchAttempt(value=>value+1);onChange();}}/></div>;
}
function MentorOptions({query,selected,disabled,onSelect}:{query:string;selected?:string;disabled:boolean;onSelect:(value:MentorSummary)=>void}) {
  const {state,retry}=useSection(()=>getPublicMentors(new URLSearchParams({q:query})));
  if(state.status==='loading')return <SectionSkeleton/>;if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return state.data.items.length?<fieldset className="ie-recruitment-fields" disabled={disabled}><legend className="field-label">选择导师</legend>{state.data.items.map(item=><label className="field-label campus-mentor-option" key={item.id}><input type="radio" name="project-mentor" checked={selected===item.id} onChange={()=>onSelect(item)}/> {item.name} · {item.unit}</label>)}{state.data.total>state.data.items.length?<p className="field-hint">仅展示前 {state.data.items.length} 位，请补充关键词缩小范围。</p>:null}</fieldset>:<p className="field-hint">暂无符合条件的导师。</p>;
}
export function PublicProjectMentors({projectId}:{projectId:string}) {
  const {state,retry}=useSection(()=>getPublicProjectMentors(projectId));
  return <section className="section campus-mentor-public-links" aria-label="项目已同意导师"><div className="section-head"><h2 className="section-title">已同意挂名的导师</h2>{state.status==='ready'?<span className="field-hint">{state.data.items.length} 位</span>:null}</div>{state.status==='loading'?<SectionSkeleton/>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:state.data.items.length?<ul className="ie-draft-list">{state.data.items.map(item=><li key={item.id} className="ie-draft-row"><div><h3><Link href={`/innovation/mentors/${item.id}`}>{item.name}</Link></h3><p>{item.unit} · {item.directions}</p><p className="field-hint">已单独同意此项目挂名</p></div><Link className="btn btn-secondary campus-mentor-card-link" href={`/innovation/mentors/${item.id}`}>查看导师档案</Link></li>)}</ul>:<p className="field-hint">暂无公开的导师挂名。</p>}<p className="field-hint">挂名针对具体项目单独同意，不授予项目管理或证明材料权限。</p></section>;
}
