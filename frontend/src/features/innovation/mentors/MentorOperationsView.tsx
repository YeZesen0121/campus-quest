'use client';
import { DiscoveryArrow } from '../PublicDiscoveryFrame';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { AuthField } from '@/features/auth/AuthField';
import { getAuthEpoch } from '@/lib/accessToken';
import { getInnovationCapabilities } from '../operationsApi';
import { invalidRecruitmentContactChannels } from '../recruitmentForm';
import { getOperationsMentor, getOperationsMentors, type MentorProfile } from './api';
import { emptyMentorFields, normalizeMentorFields, validateMentorFields, type MentorFieldErrors } from './form';
import { MentorFields } from './MentorFields';
import { MentorContent } from './MentorContent';
import { DividedSections } from '@/components/ui/dividedSections';
import { mentorStatus } from './presentation';
import { ActionFeedback } from './ActionFeedback';
import { useRecoveredMentorAction, useMentorRecoveryEntry } from './useRecoveredMentorAction';
import { mentorWorkspace, profileRecovery } from './recoveryCommands';


function OperationsDetailHeading() {
  return <header className="campus-mentor-editor-header"><Link href="/innovation/operations/mentors"><DiscoveryArrow direction="left" />返回导师运营列表</Link><div className="page-head"><h1 className="page-title">维护导师资料</h1></div></header>;
}

export function MentorOperationsView({id}:{id?:string}) {
  const {state}=useSession();if(state.status!=='authenticated'||state.me.status!=='ACTIVE')return null;
  if(state.me.role!=='STUDENT')return <>{id?<OperationsDetailHeading/>:null}<p role="alert" className="alert alert-warning">仅获授权的双创运营学生可以维护导师资料。</p></>;
  return <OperationsGate key={`${state.me.id}:${getAuthEpoch()}:${id??''}`} id={id}/>;
}
function OperationsGate({id}:{id?:string}) {
  const {state,retry}=useSection(getInnovationCapabilities);
  if(state.status==='loading')return <>{id?<OperationsDetailHeading/>:null}<SectionSkeleton/></>;if(state.status==='error')return <>{id?<OperationsDetailHeading/>:null}<SectionError error={state.error} onRetry={retry}/></>;
  if(!state.data.operations_enabled)return <>{id?<OperationsDetailHeading/>:null}<p role="alert" className="alert alert-warning">你尚未获得双创运营授权，无法查看或录入导师私有资料。</p></>;
  return id?<EditorLoader id={id}/>:<OperationsList/>;
}
function OperationsList() {
  const recovery=useMentorRecoveryEntry(profileRecovery,mentorWorkspace.create);
  const [offset,setOffset]=useState(0);const [create,setCreate]=useState(false);
  if(recovery&&!create)setCreate(true);
  return create?<Editor onBack={()=>setCreate(false)}/>:<section className="section campus-mentor-operations" aria-label="导师运营列表"><div className="section-head"><p className="field-hint">仅获授权的运营可见下列私有资料</p><Button onClick={()=>setCreate(true)}>录入导师</Button></div><OperationsRows key={offset} offset={offset} onPage={setOffset}/><p className="field-hint">未确认候选只在运营与导师本人工作区可见。校内浏览继续使用本人已确认的公开版本。</p></section>;
}
function OperationsRows({offset,onPage}:{offset:number;onPage:(value:number)=>void}) {
  const {state,retry}=useSection(()=>getOperationsMentors(offset));
  if(state.status==='loading')return <SectionSkeleton/>;if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return <><p className="field-hint campus-mentor-record-count">共 {state.data.total} 份导师档案 · 每页 20 份</p>{state.data.items.length?<><div className="campus-mentor-operations-columns" aria-hidden="true"><span>导师 / 单位</span><span>当前状态</span><span>操作</span></div><ul className="ie-draft-list">{state.data.items.map(item=><li className="ie-draft-row campus-mentor-operations-row" key={item.id}><div className="ie-draft-copy"><h2 className="section-title"><Link href={`/innovation/operations/mentors/${item.id}`}>{item.name||'姓名待补充'}</Link></h2><p>{item.unit||'单位待补充'}</p></div><p className="campus-mentor-operations-state"><span>{mentorStatus(item)}</span></p><Button asChild variant="secondary"><Link className="campus-mentor-maintain-link" href={`/innovation/operations/mentors/${item.id}`}>维护资料</Link></Button></li>)}</ul></>:<EmptyState title="尚未录入导师" hint="录入资料后请导师从本人确认入口核对，未经同意不会展示。"/>}<nav className="ie-draft-actions campus-mentor-operations-pagination" aria-label="运营导师分页"><Button variant="secondary" disabled={offset===0} onClick={()=>onPage(Math.max(0,offset-20))}>上一页</Button><span className="field-hint">{Math.floor(offset/20)+1}</span><Button variant="secondary" disabled={offset+20>=state.data.total} onClick={()=>onPage(offset+20)}>下一页</Button></nav></>;
}
function EditorLoader({id}:{id:string}) {
  const {state,retry}=useSection(()=>getOperationsMentor(id));if(state.status==='loading')return <>{id?<OperationsDetailHeading/>:null}<SectionSkeleton/></>;if(state.status==='error')return <>{id?<OperationsDetailHeading/>:null}<SectionError error={state.error} onRetry={retry}/></>;
  return <Editor initial={state.data}/>;
}
function Editor({initial,onBack}:{initial?:MentorProfile;onBack?:()=>void}) {
  const recovery=useMentorRecoveryEntry(profileRecovery,initial?mentorWorkspace.profile(initial.id):mentorWorkspace.create);
  const [record,setRecord]=useState(initial??null);const [fields,setFields]=useState(()=>recovery?.context.draft?structuredClone(recovery.context.draft.fields):({...emptyMentorFields(),...initial?.fields}));const [username,setUsername]=useState(()=>recovery?.context.draft?.username??'');const [errors,setErrors]=useState<MentorFieldErrors>({});const [remote,setRemote]=useState<MentorProfile|null>(null);const formRef=useRef<HTMLFormElement>(null);
  const action=useRecoveredMentorAction(profileRecovery,record?mentorWorkspace.profile(record.id):mentorWorkspace.create,value=>{setRecord(value.current);setFields({...emptyMentorFields(),...value.current.fields});setRemote(null);});
  const dirty=JSON.stringify(fields)!==JSON.stringify({...emptyMentorFields(),...record?.fields});
  useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>event.preventDefault();window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  function save(event:FormEvent){event.preventDefault();if(action.locked||action.error?.refresh)return;const next=validateMentorFields(fields);setErrors(next);if(Object.keys(next).length){const first=Object.keys(next)[0];formRef.current?.querySelector<HTMLElement>(first==='contacts'?`[name="mentor-contact-${invalidRecruitmentContactChannels(fields.contacts)[0]}"]`:`[name="mentor-${first}"]`)?.focus();return;}if(!record&&!username.trim()){action.setMessage('请填写预先建立的导师账号。');formRef.current?.querySelector<HTMLElement>('[name="mentor-username"]')?.focus();return;}const values=normalizeMentorFields(fields);const request_id=crypto.randomUUID();void action.run(record?{kind:'save',mentorId:record.id,body:{request_id,version:record.version,fields:values}}:{kind:'create',body:{request_id,mentor_username:username.trim(),fields:values}},{draft:{username,fields}});}
  async function readLatest(){if(!record)return;try{const next=await getOperationsMentor(record.id);if(action.current())setRemote(next);}catch{if(action.current())action.setMessage('读取最新版本失败，请稍后重试；当前输入仍保留。');}}
  const backControl = <>{onBack?<Button variant="secondary" disabled={action.locked} onClick={()=>{if(!dirty||window.confirm('输入尚未保存，确定返回列表吗？'))onBack();}}><DiscoveryArrow direction="left" />返回导师运营列表</Button>:<Link href="/innovation/operations/mentors" aria-disabled={action.locked||undefined} onClick={event=>{if(action.locked||(dirty&&!window.confirm('输入尚未保存，确定返回列表吗？')))event.preventDefault();}}><DiscoveryArrow direction="left" />返回导师运营列表</Link>}</>;
  return <section className="section campus-mentor-editor" aria-label="导师运营编辑器"><header className="campus-mentor-editor-header">{onBack?<><h2 className="section-title">{record?'维护导师资料':'录入导师资料'}</h2>{backControl}</>:backControl}{!onBack?<div className="page-head"><h1 className="page-title">维护导师资料</h1>{record?<p className="campus-mentor-identity">{record.fields.name||'姓名待补充'} · {record.fields.unit||'单位待补充'}</p>:null}</div>:null}</header>{record?<>{onBack?<p className="campus-mentor-identity">{record.fields.name||'姓名待补充'} · {record.fields.unit||'单位待补充'}</p>:null}<p className="field-hint">{mentorStatus(record)} · 当前资料第 {record.version} 版 · {record.public_content?<>校内已确认第 {record.public_version} 版</>:'尚无已确认公开版本'}</p></>:null}<p className="field-hint campus-mentor-editor-note">{record?null:'录入后等待导师本人确认。'} 仅当前已确认且展示中的资料，全部修改都在导师授权范围内时，才会同步展示；其他修改保留为待确认候选。</p>
    <DividedSections className={record?'campus-mentor-maintain-grid':'campus-mentor-create-grid'}><section className="section">{record?<h2 className="section-title">候选资料</h2>:null}<form className="panel form ie-draft-form campus-mentor-edit-form" method="post" onSubmit={save} ref={formRef} noValidate>{!record?<AuthField name="mentor-username" label="导师账号" hint="填写已建立的导师或教师账号；保存后不可重新绑定。演示阶段请使用明确标注的模拟账号。" inputProps={{value:username,disabled:action.locked,onChange:event=>setUsername(event.target.value),autoComplete:'off',placeholder:'例如 mentor-demo'}}/>:null}<MentorFields fields={fields} errors={errors} disabled={action.locked} onChange={value=>{setFields(value);setErrors({});}}/><ActionFeedback {...action} pending={!!action.pending} onRetry={()=>void action.retry()} onRefresh={record?()=>void readLatest():undefined}/>{!record&&action.error?.refresh?<div className="ie-draft-actions"><Link href="/innovation/operations/mentors">查找已录入的导师</Link><Button variant="secondary" onClick={()=>{action.clearError();formRef.current?.querySelector<HTMLElement>('[name="mentor-username"]')?.focus();}}>重新核对导师账号</Button></div>:null}<p className="field-hint">{dirty?'有未保存输入。':''}</p><Button type="submit" disabled={action.locked||action.error?.refresh}>保存导师资料</Button></form></section>{record?<aside className="section campus-mentor-maintain-aside" aria-label="导师当前授权与已确认版本"><section className="section"><h2 className="section-title">本人已授权维护范围</h2><div className="panel"><p className="campus-mentor-scope-tags">{record.authorized_fields.length?record.authorized_fields.map(key=><span key={key}>{{introduction:'导师简介',directions:'指导方向',achievements:'代表成果',project_types:'适合的项目类型'}[key]}</span>):'无'}</p><p className="field-hint">姓名、单位和联系方式变更需本人重新确认；尚未确认的候选不会直接替换校内展示。</p></div></section>{record.public_content?<section className="section"><h2 className="section-title">{record.visibility==='VISIBLE'?'校内仍在展示':'最近已确认记录（当前未展示）'} · 第 {record.public_version} 版</h2><div className="panel">{record.visibility==='VISIBLE'?<div className="campus-mentor-public-summary"><h3>{record.public_content.name}</h3><p>{record.public_content.unit}</p><p>{record.public_content.introduction}</p><p>方向：{record.public_content.directions}</p></div>:<MentorContent content={record.public_content} identity/>}{record.visibility==='VISIBLE'?<Link className="btn btn-secondary campus-mentor-maintain-link" href={`/innovation/mentors/${record.id}`}>查看当前校内档案 <span aria-hidden="true">→</span></Link>:null}</div></section>:<p className="field-hint">尚无本人已确认的公开版本。</p>}<section className="section"><h2 className="section-title">确认入口</h2>{record?<p className="field-hint">导师本人确认入口：<Link href="/innovation/mentors/me">我的导师资料</Link>。请导师使用自己的账号登录核对。</p>:null}
    </section></aside>:null}</DividedSections>
    {remote?<section className="panel" aria-label="最新导师版本"><h3 className="section-title">最新已保存版本</h3><MentorContent content={remote.fields} identity/><div className="ie-draft-actions"><Button variant="secondary" onClick={()=>{setRecord(remote);setRemote(null);action.clearError();action.setMessage('已采用最新版本号，当前输入仍保留，请核对后保存。');}}>以最新版本继续（保留输入）</Button><Button variant="secondary" onClick={()=>{setRecord(remote);setFields({...emptyMentorFields(),...remote.fields});setRemote(null);action.clearError();}}>载入服务器内容（替换输入）</Button></div></section>:null}
  </section>;
}
