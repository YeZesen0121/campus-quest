'use client';
import { CollaborationLoading } from './CollaborationLoading';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { formatDeadlineDateTime } from '@/lib/time';
import { PrivateHeader } from '../PrivateWorkspace';

import { getTransfer, getTransferProofChoices, readTransferProof, type Target, type Transfer, type TransferProofChoice } from './api';
import { transferRecovery } from './recoveryCommands';
import { useRecoveredAction } from './useRecoveredAction';
import { RecoveryNotice, RecoveryConfirm } from './RecoveryNotice';
import { TargetPicker } from './InviteForm';
import { collaborationError, transferChanges, transferChecklistChanges, transferStatus } from './presentation';
import { TransferChecklists } from './TransferChecklists';

const BLOCKERS:Record<string,string>={
  MATERIAL_CHANGED_CREATE_NEW_TRANSFER:'所选证明已变化，请取消后重新逐份选择并发起交接。',
  PENDING_REVIEW_WITHDRAW_OR_WAIT:'仍有待核实成果。请联系当前负责人等待结果，或由其先撤回审核。',
  TARGET_QUALIFICATION_REQUIRED:'接任人须先开通有效的负责人资格。',
};
const SUMMARY_LABELS=[['title','项目名称'],['summary','项目简介'],['direction','方向'],['stage','阶段'],['team_status','团队概况'],['achievement_count','成果草稿数'],['manager_count','共管人数'],['member_count','公开成员数'],['mentor_count','挂名导师数'],['open_recruitment_count','生效时将关闭的岗位数']] as const;

export function TransferView({transferId}:{transferId:string}) {
  const {state}=useSession();
  if(state.status!=='authenticated')return null;
  return <TransferLoader key={`${state.me.id}:${getAuthEpoch()}:${transferId}`} transferId={transferId}/>;
}
function TransferLoader({transferId}:{transferId:string}) {
  const {state,retry}=useSection(()=>getTransfer(transferId));
  const header=<PrivateHeader title="项目交接" subtitle="按当前资料明确确认，交接结果可长期从本人入口查询。" back={<Link href="/profile/collaboration">返回协作与交接</Link>}/>;
  if(state.status==='loading')return <>{header}<CollaborationLoading/></>;
  if(state.status==='error')return <>{header}<SectionError error={state.error} onRetry={retry}/></>;
  return <>{header}<TransferDetail initial={state.data} onRefresh={retry}/></>;
}
function TransferDetail({initial,onRefresh}:{initial:Transfer;onRefresh:()=>void}) {
  const [row,setRow]=useState(initial);
  const [confirm,setConfirm]=useState<{action:'accept'|'reject'|'cancel';row:Transfer}|null>(null);
  const [proof,setProof]=useState<{id:string;index:number}|null>(null);
  const [reading,setReading]=useState(false);const [readError,setReadError]=useState<string|null>(null);
  const resultRef=useRef<HTMLParagraphElement>(null);
  const action=useRecoveredAction(transferRecovery,`transfer:${row.id}`,value=>{setRow(value);setConfirm(null);});
  const changes=transferChanges(row);const summary=row.current_summary;
  const checklistChanges=transferChecklistChanges(row);
  const blockers=row.blockers??[];const evidence=row.evidence??[];
  const changed=!!summary&&!!row.initial_summary&&(row.initial_summary.project_version!==summary.project_version||row.initial_summary.state_digest!==summary.state_digest);
  async function download(){
    if(!proof||reading)return;
    const epoch=getAuthEpoch();setReading(true);setReadError(null);
    try{
      const blob=await readTransferProof(row.id,proof.id,row.version);
      if(!action.current()||epoch!==getAuthEpoch())return;
      const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;
      anchor.download=`交接证明-${proof.index+1}.${blob.type==='application/pdf'?'pdf':blob.type==='image/png'?'png':'jpg'}`;
      anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setProof(null);
    }catch(cause){if(action.current()){setReadError(collaborationError(cause).message);setProof(null);}}
    finally{if(action.current())setReading(false);}
  }
  return <section className="section" aria-label="交接摘要与结果"><h2 className="section-title">{row.project_title}</h2><p>对方：{row.counterpart_nickname} · {row.is_target?'由对方交给我':'由我发起'}</p>
    <p ref={resultRef} tabIndex={-1} role="status">{transferStatus(row.status)}</p>
    <RecoveryNotice {...action} onRetry={action.retry}/>
    {row.status==='PENDING'?<>
      <p className="field-hint">有效至 {formatDeadlineDateTime(Date.parse(row.expires_at))}。这是工程有效期，不代表学校审批制度。</p>
      {summary?<dl className="r6-summary">{SUMMARY_LABELS.map(([key,label])=><div key={key}><dt>{label}</dt><dd className="ie-review-prose">{String(summary[key]??'')}</dd></div>)}<div><dt>项目状态</dt><dd>{summary.lifecycle==='COMPLETED'?'已结项':'进行中'}</dd></div></dl>:null}
      {changed?<div className="alert alert-warning"><p>发起后资料已有变化。请按当前摘要和后果重新核对。</p>{changes.length?<ul>{changes.map(change=><li key={change.label}><strong>{change.label}</strong>：{change.before||'空'} → {change.after||'空'}</li>)}</ul>:<p>证明、岗位、关系或公开版本等状态已变化。</p>}</div>:null}
      {checklistChanges.length?<section className="alert alert-warning" aria-label="关系与岗位清单变化"><h3 className="field-label">关系与岗位清单变化</h3><ul>{checklistChanges.map(change=><li key={`${change.label}:${change.reference}`}><strong>{change.label}</strong>：{change.before||'此前没有此项'} → {change.after||'当前已移除'}</li>)}</ul></section>:null}
      {summary?<><p className="field-hint">当前留存介绍：{summary.introduction_revision?`第 ${summary.introduction_revision} 版`:'暂无留存介绍'}</p><TransferChecklists summary={summary} label="当前关系与将关闭岗位清单"/></>:null}
      {row.initial_summary?<details><summary>查看发起时清单</summary>{(row.initial_summary.snapshot_version??1)<2?<p className="field-hint">旧交接只记录了数量，未记录当时具体名单。以下不会用当前关系补写历史；请完整核对上方当前清单。</p>:null}<TransferChecklists summary={row.initial_summary} label="发起时已记录的清单"/></details>:null}
      {blockers.length?<div role="alert" className="alert alert-warning">{blockers.map(blocker=><p key={blocker}>{BLOCKERS[blocker]??'当前条件不满足交接，请核对最新资料后重试。'}</p>)}<Link href="/profile/owner-profile">负责人资料与资格</Link></div>:null}
      <section className="section" aria-label="本次逐份交接的证明"><h3 className="section-title">本次选中的证明</h3><p className="field-hint">未列出的材料及资格申请资料不在交接范围。交接证明只赋予读取和用于后续成果审核的权限，不移交旧上传合同或删除权限。</p>
        {evidence.length?<ul>{evidence.map((item,index)=><li key={item.id}>证明 {index+1} · {item.content_type} · {Math.ceil(item.size/1024)} KB · {item.state==='READY'?'已就绪':'状态已变化'} {row.is_target&&row.allow_preview?<Button variant="secondary" disabled={reading||action.locked||item.state!=='READY'||item.removed} onClick={()=>setProof({id:item.id,index})}>主动查阅证明 {index+1}</Button>:null}</li>)}</ul>:<EmptyState title="未选择证明"/>}
        {row.is_target&&!row.allow_preview?<p className="field-hint">发起人未授权接受前查阅，当前不可提前读取。</p>:null}{readError?<p role="alert" className="field-error">{readError}</p>:null}
      </section>
      <p className="alert alert-warning">交接生效后，原负责人失去全部管理权；有效共管、成员及导师关系保留，未确认邀请失效。现有岗位全部关闭，旧联系授权撤销。新负责人须逐岗核对并明确发布或重新开放，不会自动恢复。</p>
      <div className="ie-draft-actions"><Button variant="secondary" disabled={action.locked||!!confirm||reading} onClick={onRefresh}>读取最新交接摘要</Button>{row.is_target?<><Button disabled={action.locked||!!blockers.length||!row.confirmation_digest} onClick={()=>setConfirm({action:'accept',row:structuredClone(row)})}>确认接任项目</Button><Button variant="secondary" disabled={action.locked} onClick={()=>setConfirm({action:'reject',row:structuredClone(row)})}>拒绝接任</Button></>:<Button variant="danger" disabled={action.locked} onClick={()=>setConfirm({action:'cancel',row:structuredClone(row)})}>取消交接</Button>}</div>
    </>:<>
      <p className="field-hint">这里只保留双方交接结果，不再返回待交接私稿或证明。</p>
      {row.status==='ACCEPTED'&&row.is_target?<div className="ie-draft-actions"><Link href={`/profile/collaboration/projects/${row.project_id}`}>进入接任后的项目工作区</Link><Link href={`/profile/project-drafts/${row.project_id}/recruitments`}>逐岗核对招募与新联系授权</Link></div>:null}
    </>}
    {confirm?<RecoveryConfirm feedback={{...action,onRetry:action.retry}} title={confirm.action==='accept'?'确认接任项目':confirm.action==='reject'?'拒绝接任':'取消交接'} description={confirm.action==='accept'?'确认以上当前摘要及关闭岗位、撤销旧联系授权等后果。资格资料和未选证明不移交。':'本次待交接及提前查阅授权将结束，已发生的实际查阅记录仍用于审核回避。'} confirmLabel={confirm.action==='accept'?'确认接任并关闭现有岗位':confirm.action==='reject'?'确认拒绝':'确认取消交接'} completed={false} busy={action.busy} onClose={()=>setConfirm(null)} resultFocus={()=>resultRef.current} onConfirm={()=>{if(confirm.row.confirmation_digest)action.run({kind:'act',transferId:row.id,action:confirm.action,body:{request_id:crypto.randomUUID(),version:confirm.row.version,confirmation_digest:confirm.row.confirmation_digest}});}}/>:null}
    {proof?<RecoveryConfirm feedback={{...action,onRetry:action.retry}} title="主动查阅交接证明" description="实际读取会写入持久审计和项目参与历史，今后须回避该项目成果审核；拒绝交接不会抹去此记录。仅收到邀请或查看摘要不会触发证明查阅记录。" confirmLabel="确认并读取这份证明" completed={false} busy={reading} onClose={()=>setProof(null)} resultFocus={()=>resultRef.current} onConfirm={()=>void download()}/>:null}
  </section>;
}

type ProofChoice={achievementTitle:string;evidence:TransferProofChoice;ordinal:number};
async function availableProofs(projectId:string):Promise<ProofChoice[]> {
  const results:ProofChoice[]=[];let offset=0;
  do{
    const page=await getTransferProofChoices(projectId,offset);
    for(const item of page.items)results.push({achievementTitle:item.achievement_title,evidence:item,ordinal:results.length+1});
    offset+=page.items.length;if(!page.items.length||offset>=page.total)return results;
  }while(true);
}
export function TransferCreate({projectId}:{projectId:string}) {
  const [target,setTarget]=useState<Target|null>(null);const [selected,setSelected]=useState<string[]>([]);const [allowPreview,setPreview]=useState(false);
  const [confirmation,setConfirmation]=useState(false);const [result,setResult]=useState<Transfer|null>(null);
  const resultRef=useRef<HTMLParagraphElement>(null);
  const action=useRecoveredAction(transferRecovery,`project:${projectId}:transfer:create`,value=>{setResult(value);setConfirmation(false);});
  const {state,retry}=useSection(()=>availableProofs(projectId));
  return <section className="section" aria-label="发起负责人交接"><h2 className="section-title">交给新负责人</h2><p className="field-hint">原负责人无需仍具备发布资格；接任人必须具备有效负责人资格。待核实成果须先等结果或撤回。</p>
    <TargetPicker target={target} onTarget={setTarget} disabled={action.locked}/>
    {state.status==='loading'?<CollaborationLoading/>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:<fieldset className="form" disabled={action.locked}><legend className="field-label">逐份选择交接证明（最多100份）</legend>{state.data.length?state.data.map(({achievementTitle,evidence,ordinal})=><label className="r6-choice" key={evidence.id}><input type="checkbox" checked={selected.includes(evidence.id)} disabled={!selected.includes(evidence.id)&&selected.length>=100} onChange={event=>setSelected(value=>event.target.checked?[...value,evidence.id]:value.filter(id=>id!==evidence.id))}/> {achievementTitle||'未命名成果'} · 证明 {ordinal} · {evidence.content_type} · {Math.ceil(evidence.size/1024)} KB</label>):<p className="field-hint">暂无已就绪证明，可不选证明发起交接。</p>}<label className="r6-choice"><input type="checkbox" checked={allowPreview} onChange={event=>setPreview(event.target.checked)}/> 另行授权接任人在接受前主动查阅上述已选证明</label></fieldset>}
    <p className="field-hint">资格申请资料不移交；未选材料不授权。证明提前查阅须接任人主动确认，实际查阅后形成审核回避记录。</p>
    <Button disabled={!target||action.locked||state.status!=='ready'} onClick={()=>setConfirmation(true)}>核对并发起交接</Button><RecoveryNotice {...action} onRetry={action.retry}/><p ref={resultRef} tabIndex={-1} role="status">{result?transferStatus(result.status):''}</p>{result?<Link href={`/profile/collaboration/transfers/${result.id}`}>查看本次交接</Link>:null}
    {confirmation&&target?<RecoveryConfirm feedback={{...action,onRetry:action.retry}} title="发起项目交接" description={`交给 ${target.nickname}，选择 ${selected.length} 份证明；${allowPreview?'另行允许接受前主动查阅。':'接受前不可查阅证明。'} 发起后仍需对方明确确认；只有交接生效才移除你的管理权、关闭岗位并撤销旧联系授权。`} confirmLabel="确认发起交接" completed={false} busy={action.busy} onClose={()=>setConfirmation(false)} resultFocus={()=>resultRef.current} onConfirm={()=>action.run({kind:'create',projectId,body:{request_id:crypto.randomUUID(),target_ref:target.target_ref,evidence_ids:[...selected],allow_preview:allowPreview}})}/>:null}
  </section>;
}
