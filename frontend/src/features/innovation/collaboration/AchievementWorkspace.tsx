'use client';
import { CollaborationLoading } from './CollaborationLoading';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BoundedTextarea } from '@/components/ui/bounded-textarea';
import { EmptyState, SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { AuthField } from '@/features/auth/AuthField';
import { getAuthEpoch } from '@/lib/accessToken';
import { PrivateHeader } from '../PrivateWorkspace';
import { ACHIEVEMENT_FIELDS, achievementFields, EMPTY_ACHIEVEMENT, normalizeAchievementFields, validateAchievementFields, type AchievementErrors } from '../achievementForm';
import type { AchievementFields } from '../achievementApi';
import { getWorkspace, getWorkspaceAchievement, getWorkspaceAchievements, type TextAchievement } from './api';
import { achievementRecovery } from './recoveryCommands';
import { useRecoveredAction, useRecoveryEntry } from './useRecoveredAction';
import { RecoveryNotice } from './RecoveryNotice';
import { PageControls } from './CollaborationInbox';
import { collaborationError } from './presentation';

export function CollaborativeAchievements({projectId}:{projectId:string}) {
  const {state}=useSession();if(state.status!=='authenticated')return null;
  return <Guard key={`${state.me.id}:${getAuthEpoch()}:${projectId}`} projectId={projectId}/>;
}
function Guard({projectId}:{projectId:string}) {
  const {state,retry}=useSection(()=>getWorkspace(projectId));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <><SectionError error={state.error} onRetry={retry}/><Link href="/profile/collaboration">返回协作与交接</Link></>;
  return <Workspace projectId={projectId} title={state.data.draft.title}/>;
}
function Workspace({projectId,title}:{projectId:string;title:string}) {
  const [selected,setSelected]=useState<string|null|undefined>(undefined);const [offset,setOffset]=useState(0);
  const [notice,setNotice]=useState('');
  if(selected!==undefined)return selected===null?<Editor projectId={projectId} onBack={()=>setSelected(undefined)} onCreated={value=>{setNotice('成果文字已保存；公开版本仍按原核实流程维护。');setSelected(value.id);}}/>:<Loader key={selected} projectId={projectId} achievementId={selected} notice={notice} onBack={()=>{setNotice('');setSelected(undefined);}}/>;
  return <><PrivateHeader title="成果文字协作" subtitle={title} back={<Link href={`/profile/collaboration/projects/${projectId}`}>返回协作工作区</Link>}/><p className="field-hint">这里只准备成果文字，不开放证明或审核提交。需由当前负责人核对已保存文字后处理证明与提审。</p><section className="section" aria-label="协作成果文字列表"><div className="section-head"><h2 className="section-title">成果文字</h2><Button onClick={()=>setSelected(null)}>新建成果文字</Button></div><List key={offset} projectId={projectId} offset={offset} onPage={setOffset} onEdit={setSelected}/></section></>;
}
function List({projectId,offset,onPage,onEdit}:{projectId:string;offset:number;onPage:(offset:number)=>void;onEdit:(id:string)=>void}) {
  const {state,retry}=useSection(()=>getWorkspaceAchievements(projectId,offset));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return <>{state.data.items.length?<ul className="ie-draft-list">{state.data.items.map(item=><li className="ie-draft-row" key={item.id}><div className="ie-draft-copy"><h3 className="section-title">{item.title}</h3><p className="ie-draft-excerpt">{item.description}</p></div><Button variant="secondary" onClick={()=>onEdit(item.id)}>编辑成果文字</Button></li>)}</ul>:<EmptyState title="暂无成果文字草稿"/>}<PageControls offset={offset} total={state.data.total} onPage={onPage} label="成果文字分页"/></>;
}
function Loader({projectId,achievementId,onBack,notice}:{projectId:string;achievementId:string;onBack:()=>void;notice:string}) {
  const {state,retry}=useSection(()=>getWorkspaceAchievement(projectId,achievementId));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <><SectionError error={state.error} onRetry={retry}/><Button variant="secondary" onClick={onBack}>返回成果文字列表</Button></>;
  return <Editor projectId={projectId} initial={state.data} onBack={onBack} initialMessage={notice}/>;
}
function Editor({projectId,initial,onBack,onCreated,initialMessage=''}:{projectId:string;initial?:TextAchievement;onBack:()=>void;onCreated?:(value:TextAchievement)=>void;initialMessage?:string}) {
  const [record,setRecord]=useState(initial??null);const [remote,setRemote]=useState<TextAchievement|null>(null);const [message,setMessage]=useState(initialMessage);
  const recoveryKey=`project:${projectId}:achievement:${initial?.id??'create'}`;
  const pending=useRecoveryEntry(achievementRecovery,recoveryKey);
  const [fields,setFields]=useState<AchievementFields>(()=>pending?achievementFields(pending.command.body):initial?achievementFields(initial):{...EMPTY_ACHIEVEMENT});
  const action=useRecoveredAction(achievementRecovery,recoveryKey,value=>{
    const current='current' in value?value.current:value;
    // Bare creation results start at 1; later versions belong in comparison,
    // just like a PATCH receipt whose applied version is no longer current.
    if('current' in value?value.replayed&&value.applied_version!==current.version:current.version!==1){setRemote(current);setMessage('已确认原请求已保存；此后文字又有更新。原输入仍保留，请对照最新版本。');return;}
    setRecord(current);setFields(achievementFields(current));setRemote(null);setMessage('成果文字已保存；公开版本仍按原核实流程维护。');
    if(!initial)onCreated?.(current);
  });
  const [errors,setErrors]=useState<AchievementErrors>({});const [reading,setReading]=useState(false);const [readError,setReadError]=useState<string|null>(null);
  const formRef=useRef<HTMLFormElement>(null);const formId=useId();
  const dirty=JSON.stringify(fields)!==JSON.stringify(record?achievementFields(record):EMPTY_ACHIEVEMENT);
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  async function readLatest(){if(!record)return;setReading(true);setReadError(null);try{const value=await getWorkspaceAchievement(projectId,record.id);if(action.current())setRemote(value);}catch(cause){if(action.current())setReadError(collaborationError(cause).message);}finally{if(action.current())setReading(false);}}
  function back(){if(!dirty||window.confirm('有未保存的成果文字，确定返回列表吗？'))onBack();}
  return <section className="section" aria-label="成果文字编辑器"><PrivateHeader title={record?'编辑成果文字':'新建成果文字'} subtitle="仅文字草稿；不包含证明与提审权限。" back={<Button variant="ghost" disabled={action.busy} onClick={back}>返回成果文字列表</Button>}/>
    <form className="panel form" ref={formRef} onSubmit={event=>{event.preventDefault();if(action.locked)return;const next=validateAchievementFields(fields);setErrors(next);const first=ACHIEVEMENT_FIELDS.find(field=>next[field.key]);if(first){formRef.current?.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus();return;}const body={...normalizeAchievementFields(fields),request_id:crypto.randomUUID()};action.run(record?{kind:'save',projectId,achievementId:record.id,body:{...body,version:record.version}}:{kind:'create',projectId,body},{fields});}}>
      <fieldset className="form" disabled={action.locked||reading}>{ACHIEVEMENT_FIELDS.map(field=>field.rows===1?<AuthField key={field.key} name={field.key} label={field.label} hint={`${field.hint} 最多 ${field.limit} 个字符。`} error={errors[field.key]} inputProps={{value:fields[field.key],onChange:event=>setFields({...fields,[field.key]:event.target.value})}}/>:<div className="field" key={field.key}><label className="field-label" htmlFor={`${formId}-${field.key}`}>{field.label}</label><BoundedTextarea className="input" id={`${formId}-${field.key}`} name={field.key} rows={field.rows} value={fields[field.key]} aria-invalid={!!errors[field.key]} aria-describedby={`${formId}-${field.key}-hint`} onChange={event=>setFields({...fields,[field.key]:event.target.value})}/><p id={`${formId}-${field.key}-hint`} className={errors[field.key]?'field-error':'field-hint'}>{errors[field.key]??`${field.hint} 最多 ${field.limit} 个字符。`}</p></div>)}</fieldset>
      <RecoveryNotice {...action} message={message||action.message} onRetry={action.retry}/>{readError?<p role="alert" className="field-error">{readError}</p>:null}<div className="ie-draft-actions"><Button type="submit" disabled={action.locked||reading||action.error?.refresh||!!remote}>保存成果文字</Button>{record?<Button variant="secondary" disabled={action.locked||reading} onClick={()=>void readLatest()}>读取最新成果文字（保留输入）</Button>:null}</div>
    </form>{remote?<section className="panel" aria-label="最新成果文字"><h3 className="section-title">最新已保存文字</h3><dl className="r6-summary">{ACHIEVEMENT_FIELDS.map(field=><div key={field.key}><dt>{field.label}</dt><dd className="ie-review-prose">{remote[field.key]}</dd></div>)}</dl><p className="field-hint">原输入仍保留，请先复制需要保留的内容。</p><Button variant="secondary" onClick={()=>{setRecord(remote);setFields(achievementFields(remote));setRemote(null);action.clearError();}}>载入最新成果文字</Button></section>:null}
  </section>;
}
