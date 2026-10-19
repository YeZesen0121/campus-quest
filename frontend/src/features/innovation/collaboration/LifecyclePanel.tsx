'use client';
import { CollaborationLoading } from './CollaborationLoading';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BoundedTextarea } from '@/components/ui/bounded-textarea';
import { SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { AuthField } from '@/features/auth/AuthField';

import { getLifecycle, previewIntroduction, type IntroductionFields, type IntroductionPreview, type LifecycleState } from './api';
import { collaborationError } from './presentation';
import { lifecycleRecovery } from './recoveryCommands';
import { useRecoveredAction, useRecoveryEntry } from './useRecoveredAction';
import { RecoveryNotice, RecoveryConfirm } from './RecoveryNotice';

const CONSEQUENCES={RETAIN_PRIOR_PUBLIC:'保留此前真实公开版本中的项目介绍；成果仍按各自核实事实展示。',PRIVATE:'此前没有可留存的公开来源，项目仍保持私有。',SOURCE_RESTRICTED:'原公开来源或档案受治理限制，不会通过结项或恢复绕过限制。'} as const;
const INTRO_FIELDS=[['title','介绍标题',120],['summary','介绍正文',2000],['direction','项目方向',120],['stage','项目阶段',80]] as const;

export function LifecyclePanel({projectId,initialFields}:{projectId:string;initialFields:IntroductionFields}) {
  const {state,retry}=useSection(()=>getLifecycle(projectId));
  if(state.status==='loading')return <CollaborationLoading/>;
  if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return <LifecycleEditor key={projectId} projectId={projectId} initial={state.data} initialFields={initialFields}/>;
}
function LifecycleEditor({projectId,initial,initialFields}:{projectId:string;initial:LifecycleState;initialFields:IntroductionFields}) {
  const pending=useRecoveryEntry(lifecycleRecovery,`project:${projectId}:lifecycle`);
  const [record,setRecord]=useState(initial);const [fields,setFields]=useState(()=>pending?.command.kind==='publish'?pending.command.body.fields:initialFields);
  const [preview,setPreview]=useState<IntroductionPreview|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
  const [confirm,setConfirm]=useState<{kind:'transition';snapshot:LifecycleState}|{kind:'publish';snapshot:IntroductionPreview}|null>(null);
  const resultRef=useRef<HTMLParagraphElement>(null);
  const action=useRecoveredAction(lifecycleRecovery,`project:${projectId}:lifecycle`,value=>{
    setConfirm(null);setPreview(null);setRecord(current=>({...current,lifecycle:value.lifecycle,version:value.version,introduction_revision:value.introduction_revision,confirmation_digest:'',closing_recruitments:[]}));
    void readLatest();
  });
  const locked=action.locked||busy;
  async function readLatest(){
    setBusy(true);setError(null);
    try{const value=await getLifecycle(projectId);if(action.current())setRecord(value);}
    catch(cause){if(action.current())setError(collaborationError(cause).message);}
    finally{if(action.current())setBusy(false);}
  }
  async function makePreview(){
    if(locked)return;setBusy(true);setError(null);setPreview(null);
    try{const value=await previewIntroduction(projectId,{version:record.version,fields});if(action.current())setPreview(value);}
    catch(cause){if(action.current())setError(collaborationError(cause).message);}
    finally{if(action.current())setBusy(false);}
  }
  return <section className="section" aria-label="项目状态与公开介绍"><h2 className="section-title">项目状态与公开介绍</h2>
    <p ref={resultRef} tabIndex={-1} role="status">当前状态：{record.lifecycle==='COMPLETED'?'已结项':'进行中'} · {record.introduction_revision?`留存介绍第 ${record.introduction_revision} 版`:'暂无留存介绍'}</p>
    <p className="field-hint">{CONSEQUENCES[record.public_consequence]}</p><RecoveryNotice {...action} onRetry={action.retry}/>{error?<p className="field-error" role="alert">{error}</p>:null}
    <div className="ie-draft-actions"><Button variant="secondary" disabled={locked} onClick={()=>void readLatest()}>读取最新状态（保留介绍输入）</Button>{record.can_transition?<Button variant={record.lifecycle==='ACTIVE'?'danger':'secondary'} disabled={locked||!record.confirmation_digest} onClick={()=>setConfirm({kind:'transition',snapshot:structuredClone(record)})}>{record.lifecycle==='ACTIVE'?'预览结项后果':'恢复为进行中'}</Button>:<p className="field-hint">共管可备稿与预览；结项、恢复和发布介绍由当前负责人确认。</p>}</div>
    <form className="panel form" onSubmit={event=>{event.preventDefault();void makePreview();}}><h3 className="section-title">准备更正公开介绍</h3><p className="field-hint">以下是待预览输入，不代表已公开。介绍仅含四项文字，不包含团队、联系、资格或附件；不会改写历史审核快照，也不代表成果核实。</p>
      <fieldset className="form" disabled={locked}>{INTRO_FIELDS.map(([key,label,limit])=>key==='summary'?<div className="field" key={key}><label className="field-label" htmlFor="r6-introduction-summary">{label}</label><BoundedTextarea className="input" id="r6-introduction-summary" rows={5} value={fields[key]} onChange={event=>{setFields({...fields,[key]:event.target.value});setPreview(null);}}/><p className="field-hint">最多 {limit} 个字符。</p></div>:<AuthField key={key} name={`r6-introduction-${key}`} label={label} hint={`最多 ${limit} 个字符。`} inputProps={{value:fields[key],required:key==='title',onChange:event=>{setFields({...fields,[key]:event.target.value});setPreview(null);}}}/>)}</fieldset>
      <Button type="submit" disabled={locked}>生成介绍预览</Button>
    </form>
    {preview?<section className="panel" aria-label="待发布介绍预览"><h3 className="section-title">介绍第 {preview.next_revision} 版预览</h3><p className="field-hint">来源：{preview.source_kind==='RECRUITMENT'?'此前真实发布的招募（免审）':'此前真实公开的成果介绍；不改写成果核实版本'}</p><dl className="r6-summary">{INTRO_FIELDS.map(([key,label])=><div key={key}><dt>{label}</dt><dd className="ie-review-prose">{preview.fields[key]}</dd></div>)}</dl>{preview.can_publish?<Button disabled={locked} onClick={()=>setConfirm({kind:'publish',snapshot:structuredClone(preview)})}>核对并发布此介绍</Button>:<p className="field-hint">当前只能预览。发布须由当前负责人具备有效资格后确认。<Link href="/profile/owner-profile">核对负责人资格</Link></p>}</section>:null}
    {confirm?<RecoveryConfirm feedback={{...action,onRetry:action.retry}} title={confirm.kind==='publish'?'发布项目介绍':confirm.snapshot.lifecycle==='ACTIVE'?'确认结项':'恢复为进行中'} description={confirm.kind==='publish'?'仅发布以上四项介绍文字。不会改动已核实成果快照，不恢复任何岗位、联系或关系授权。':confirm.snapshot.lifecycle==='ACTIVE'?`${CONSEQUENCES[confirm.snapshot.public_consequence]} 本次关闭 ${confirm.snapshot.closing_recruitments.length} 个开放岗位。`: '恢复后仍保留介绍与治理状态。岗位、旧邀请和联系授权不会自动恢复，须逐项重新核对。'} confirmLabel={confirm.kind==='publish'?'确认发布此介绍':confirm.snapshot.lifecycle==='ACTIVE'?'确认结项并关闭岗位':'确认恢复'} completed={false} busy={action.busy} resultFocus={()=>resultRef.current} onClose={()=>setConfirm(null)} onConfirm={()=>{
      if(confirm.kind==='publish')action.run({kind:'publish',projectId,body:{version:confirm.snapshot.version,fields:confirm.snapshot.fields,preview_digest:confirm.snapshot.preview_digest,request_id:crypto.randomUUID()}});
      else action.run({kind:'act',projectId,action:confirm.snapshot.lifecycle==='ACTIVE'?'complete':'resume',body:{version:confirm.snapshot.version,confirmation_digest:confirm.snapshot.confirmation_digest,request_id:crypto.randomUUID()}});
    }}>{confirm.kind==='transition'&&confirm.snapshot.lifecycle==='ACTIVE'?<ul>{confirm.snapshot.closing_recruitments.map(row=><li key={row.id}>{row.role_name||'未命名岗位'}</li>)}</ul>:null}</RecoveryConfirm>:null}
  </section>;
}
