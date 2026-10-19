'use client';
import { CollaborationLoading } from './CollaborationLoading';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { formatDeadlineDateTime } from '@/lib/time';

import { getMyCollaborations, getProjectCollaborators, type Collaboration } from './api';
import { collaborationRecovery } from './recoveryCommands';
import { useRecoveredAction } from './useRecoveredAction';
import { RecoveryNotice, RecoveryConfirm } from './RecoveryNotice';
import { collaborationStatus } from './presentation';

export function PageControls({offset,total,onPage,label}:{offset:number;total:number;onPage:(offset:number)=>void;label:string}) {
  return total>20||offset>0?<nav className="ie-draft-actions" aria-label={label}><Button variant="secondary" disabled={offset===0} onClick={()=>onPage(Math.max(0,offset-20))}>上一页</Button><span className="field-hint">第 {Math.floor(offset/20)+1} 页 · 共 {total} 条</span><Button variant="secondary" disabled={offset+20>=total} onClick={()=>onPage(offset+20)}>下一页</Button></nav>:null;
}
export function CollaborationInbox({projectId}:{projectId?:string}) {
  const [offset,setOffset]=useState(0);
  return <section className="section" aria-label={projectId?'项目协作记录':'本人的协作邀请与同意'}><h2 className="section-title">{projectId?'项目协作记录':'协作邀请与同意'}</h2><p className="field-hint">共同管理、公开姓名与分工分别确认。拒绝新候选不会改动此前有效同意；撤下或退出只结束该项关系。</p><InboxPage key={`${projectId??'mine'}:${offset}`} projectId={projectId} offset={offset} onPage={setOffset}/></section>;
}
function InboxPage({projectId,offset,onPage}:{projectId?:string;offset:number;onPage:(offset:number)=>void}) {
  const {state,retry}=useSection(()=>projectId?getProjectCollaborators(projectId,offset):getMyCollaborations(offset));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return <><Button variant="ghost" onClick={retry}>刷新协作记录</Button>{state.data.items.length?<ul className="ie-draft-list">{state.data.items.map(row=><CollaborationRow key={row.id} initial={row}/>)}</ul>:<EmptyState title="暂无协作记录" hint="定向邀请在这里确认；不需要先取得负责人资格。"/>}<PageControls offset={offset} total={state.data.total} onPage={onPage} label="协作记录分页"/></>;
}
function CollaborationRow({initial}:{initial:Collaboration}) {
  const [row,setRow]=useState(initial);
  const [confirm,setConfirm]=useState<'accept'|'reject'|'revoke'|null>(null);
  const resultRef=useRef<HTMLParagraphElement>(null);
  const action=useRecoveredAction(collaborationRecovery,`collaboration:${row.id}`,value=>{setRow(value);setConfirm(null);});
  const manager=row.kind==='MANAGER';
  const purpose=manager?'共同管理':'公开挂名';
  const revocation=manager?(row.is_target?'退出共同管理':'撤销共同管理'):'撤下公开挂名';
  const label=confirm==='accept'?`同意${purpose}`:confirm==='reject'?`拒绝${purpose}`:row.status==='PENDING'?'撤销邀请':revocation;
  return <li className="ie-draft-row"><div className="ie-draft-copy">
    <h3 className="section-title">{row.project_title}</h3><p>{purpose} · {row.is_target?'发给我的邀请':`邀请对象：${row.target_nickname}`}</p>
    <p className="field-hint">{row.project_direction}</p><p className="ie-review-prose">{row.project_summary}</p>
    {!manager?<dl><dt>待本人确认的姓名</dt><dd>{row.public_name}</dd><dt>分工</dt><dd>{row.division}</dd></dl>:<p className="field-hint">同意后可编辑项目和成果文字、按资格管理招募；证明、成果提审、团队授权、导师、转让和结项仍由负责人处理。</p>}
    <p ref={resultRef} tabIndex={-1} role="status">{collaborationStatus(row.status)}{row.status==='PENDING'?` · 有效至 ${formatDeadlineDateTime(Date.parse(row.expires_at))}`:''}</p>
    <div className="ie-draft-actions">
      {row.status==='PENDING'&&row.is_target?<><Button disabled={action.locked} onClick={()=>setConfirm('accept')}>{`同意${purpose}`}</Button><Button variant="secondary" disabled={action.locked} onClick={()=>setConfirm('reject')}>{`拒绝${purpose}`}</Button></>:null}
      {(row.status==='ACCEPTED'||row.status==='PENDING'&&!row.is_target)?<Button variant="danger" disabled={action.locked} onClick={()=>setConfirm('revoke')}>{row.status==='PENDING'?'撤销邀请':revocation}</Button>:null}
      {manager&&row.is_target&&row.status==='ACCEPTED'?<Link href={`/profile/collaboration/projects/${row.project_id}`}>进入协作工作区</Link>:null}
    </div>
    <RecoveryNotice {...action} onRetry={action.retry}/>
    {confirm?<RecoveryConfirm feedback={{...action,onRetry:action.retry}} title={label} description={confirm==='revoke'?'确认后结束这一项关系。其他用途的同意不受影响；历史参与记录仍用于审核回避。':manager?'请核对项目简介。管理权限不包含公开挂名或证明读取。':'请核对以上姓名和分工。只有本次明确同意的内容才可公开；这不授予管理权限。'} confirmLabel={label} busy={action.busy} completed={false} onClose={()=>setConfirm(null)} resultFocus={()=>resultRef.current} onConfirm={()=>action.run({kind:'act',collaborationId:row.id,action:confirm,body:{request_id:crypto.randomUUID(),version:row.version}})}/>:null}
  </div></li>;
}
