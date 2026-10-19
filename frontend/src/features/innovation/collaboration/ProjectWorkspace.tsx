'use client';
import { CollaborationLoading } from './CollaborationLoading';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BoundedTextarea } from '@/components/ui/bounded-textarea';
import { SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { AuthField } from '@/features/auth/AuthField';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { PrivateHeader } from '../PrivateWorkspace';
import { DRAFT_FIELDS, draftFields, normalizeDraftFields, sameDraftFields, validateDraftFields, type DraftFieldErrors } from '../draftForm';
import type { DraftFields } from '../api';
import { getWorkspace, type ProjectWorkspace as Workspace } from './api';
import { projectRecovery } from './recoveryCommands';
import { useRecoveredAction, useRecoveryEntry } from './useRecoveredAction';
import { RecoveryNotice } from './RecoveryNotice';
import { collaborationError } from './presentation';
import { InviteForm } from './InviteForm';
import { CollaborationInbox } from './CollaborationInbox';
import { TransferCreate } from './TransferView';
import { LifecyclePanel } from './LifecyclePanel';

export function ProjectWorkspace({projectId}:{projectId:string}) {
  const {state}=useSession();if(state.status!=='authenticated')return null;
  return <Loader key={`${state.me.id}:${getAuthEpoch()}:${projectId}`} projectId={projectId}/>;
}
function Loader({projectId}:{projectId:string}) {
  const {state,retry}=useSection(()=>getWorkspace(projectId));
  if(state.status==='ready')return <Editor initial={state.data}/>;
  return <><PrivateHeader title="协作工作区" subtitle="项目文字与协作管理" back={<Link href="/profile/collaboration">返回协作与交接</Link>}/>{state.status==='loading'?<CollaborationLoading/>:<SectionError error={state.error} onRetry={retry}/>}<p><Link href="/profile/collaboration">仍可从本人入口拒绝邀请、退出关系或查看交接结果</Link></p></>;
}
function Editor({initial}:{initial:Workspace}) {
  const [workspace,setWorkspace]=useState(initial);const projectId=workspace.draft.id;
  const pending=useRecoveryEntry(projectRecovery,`project:${projectId}:save`);
  const [fields,setFields]=useState<DraftFields>(()=>pending?normalizeDraftFields(pending.command.body):draftFields(initial.draft));
  const [errors,setErrors]=useState<DraftFieldErrors>({});const [remote,setRemote]=useState<Workspace|null>(null);
  const action=useRecoveredAction(projectRecovery,`project:${projectId}:save`,value=>{if(value.replayed&&value.applied_version!==value.draft.version){setRemote(value);return;}setWorkspace(value);setFields(draftFields(value.draft));setRemote(null);});
  const [reading,setReading]=useState(false);const [readError,setReadError]=useState<string|null>(null);const [revision,setRevision]=useState(0);
  const formId=useId();const formRef=useRef<HTMLFormElement>(null);
  const dirty=!sameDraftFields(fields,draftFields(workspace.draft));
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  async function readLatest(){setReading(true);setReadError(null);try{const result=await getWorkspace(projectId);if(action.current())setRemote(result);}catch(cause){if(action.current())setReadError(collaborationError(cause).message);}finally{if(action.current())setReading(false);}}
  function leave(){return !dirty||window.confirm('当前文字尚未保存，确定离开吗？');}
  const owner=workspace.role==='OWNER';const blocked=dirty||action.locked||reading;
  return <>
    <PrivateHeader title={workspace.draft.title} subtitle={owner?'当前负责人 · 协作管理':'已接受的共同管理 · 文字与招募'} back={<Link href="/profile/collaboration" onClick={event=>{if(!leave())event.preventDefault();}}>返回协作与交接</Link>}/>
    <p className="alert">{owner?'可管理协作、导师、证明、提审及交接；各类公开与授权仍分别确认。':'可以编辑项目和成果文字、按资格管理招募。共同管理不包含证明查阅、成果提审、授权他人、导师、转让、结项或发布项目介绍。'}</p>
    <section className="section" aria-label="协作项目文字"><h2 className="section-title">项目文字</h2><form ref={formRef} className="panel form" onSubmit={event=>{event.preventDefault();if(action.locked)return;const next=validateDraftFields(fields);setErrors(next);const first=DRAFT_FIELDS.find(field=>next[field.key]);if(first){formRef.current?.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus();return;}action.run({projectId,body:{...normalizeDraftFields(fields),version:workspace.draft.version,request_id:crypto.randomUUID()}},{fields});}}>
      <p className="field-hint">文字草稿供当前负责人和已接受共管准备，不会自动改动公开版本。</p>
      <fieldset className="form" disabled={action.locked||reading}>{DRAFT_FIELDS.map(field=>field.rows===1?<AuthField key={field.key} name={field.key} label={field.label} hint={`最多 ${field.limit} 个字符。`} error={errors[field.key]} inputProps={{value:fields[field.key],onChange:event=>setFields({...fields,[field.key]:event.target.value})}}/>:<div className="field" key={field.key}><label className="field-label" htmlFor={`${formId}-${field.key}`}>{field.label}</label><BoundedTextarea className="input" id={`${formId}-${field.key}`} name={field.key} rows={field.rows} value={fields[field.key]} aria-invalid={!!errors[field.key]} aria-describedby={`${formId}-${field.key}-hint`} onChange={event=>setFields({...fields,[field.key]:event.target.value})}/><p id={`${formId}-${field.key}-hint`} className={errors[field.key]?'field-error':'field-hint'}>{errors[field.key]??`最多 ${field.limit} 个字符。`}</p></div>)}</fieldset>
      <RecoveryNotice {...action} onRetry={action.retry}/>{readError?<p className="field-error" role="alert">{readError}</p>:null}<p role="status" className="field-hint">{dirty?'有未保存的文字。':'文字与当前读取版本一致。'}</p>
      <div className="ie-draft-actions"><Button type="submit" disabled={action.locked||reading||action.error?.refresh||!!remote}>保存项目文字</Button><Button variant="secondary" disabled={action.locked||reading} onClick={()=>void readLatest()}>读取最新文字（保留输入）</Button></div>
    </form>{remote?<section className="panel" aria-label="最新项目文字"><h3 className="section-title">最新已保存版本</h3><dl className="r6-summary">{DRAFT_FIELDS.map(field=><div key={field.key}><dt>{field.label}</dt><dd className="ie-review-prose">{remote.draft[field.key]}</dd></div>)}</dl><p className="field-hint">上方输入仍保留；先复制需要保留的内容，再载入最新版本。</p><Button variant="secondary" onClick={()=>{setWorkspace(remote);setFields(draftFields(remote.draft));setRemote(null);action.clearError();}}>载入最新文字</Button></section>:null}</section>
    <nav className="ie-draft-actions" aria-label="协作项目工作入口"><Link href={`/profile/collaboration/projects/${projectId}/achievements`} onClick={event=>{if(!leave())event.preventDefault();}}>成果文字协作</Link><Link href={`/profile/collaboration/projects/${projectId}/recruitments`} onClick={event=>{if(!leave())event.preventDefault();}}>协作招募管理</Link>{owner?<><Link href={`/profile/project-drafts/${projectId}/achievements`} onClick={event=>{if(!leave())event.preventDefault();}}>负责人证明与成果提审</Link><Link href="/profile/project-drafts" onClick={event=>{if(!leave())event.preventDefault();}}>负责人导师与完整编辑器</Link></>:null}</nav>
    {blocked?<p className="field-hint">请先完成上方保存或结果核对，再操作协作、交接及项目状态。</p>:null}
    <fieldset className="r6-workflow-group" disabled={blocked}>{owner?<><InviteForm projectId={projectId} onInvited={()=>setRevision(value=>value+1)}/><CollaborationInbox key={revision} projectId={projectId}/><TransferCreate projectId={projectId}/></>:null}<LifecyclePanel projectId={projectId} initialFields={{title:workspace.draft.title,summary:workspace.draft.summary,direction:workspace.draft.direction,stage:workspace.draft.stage}}/></fieldset>
  </>;
}
