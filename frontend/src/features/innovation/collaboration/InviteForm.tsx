'use client';
import { useState, useId } from 'react';
import { Button } from '@/components/ui/button';
import { AuthField } from '@/features/auth/AuthField';
import { getAuthEpoch } from '@/lib/accessToken';
import { resolveTarget, type Target } from './api';
import { collaborationRecovery } from './recoveryCommands';
import { collaborationError } from './presentation';
import { RecoveryNotice } from './RecoveryNotice';
import { useRecoveredAction } from './useRecoveredAction';

export function TargetPicker({target,onTarget,disabled}:{target:Target|null;onTarget:(target:Target|null)=>void;disabled:boolean}) {
  const inputId=useId();
  const [account,setAccount]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
  async function resolve(){
    const epoch=getAuthEpoch();setBusy(true);setError(null);
    try{const result=await resolveTarget({account});if(epoch===getAuthEpoch()){onTarget(result);setAccount('');}}
    catch(cause){if(epoch===getAuthEpoch())setError(collaborationError(cause).message);}
    finally{if(epoch===getAuthEpoch())setBusy(false);}
  }
  return <fieldset className="form" disabled={disabled||busy}><legend className="field-label">指定对象</legend>{target?<><p role="status">已核对昵称：{target.nickname}</p><Button variant="secondary" onClick={()=>onTarget(null)}>重新指定对象</Button></>:<><AuthField name={inputId} label="对方账号" hint="输入对方提供的账号以核对昵称。账号不会出现在邀请记录中。" error={error??undefined} inputProps={{inputMode:'numeric',autoComplete:'off',value:account,onChange:event=>setAccount(event.target.value)}}/><Button variant="secondary" disabled={!/^[0-9]{6,20}$/.test(account)} onClick={()=>void resolve()}>{busy?'正在核对…':'核对对象'}</Button></>}</fieldset>;
}
export function InviteForm({projectId,onInvited}:{projectId:string;onInvited:()=>void}) {
  const [target,setTarget]=useState<Target|null>(null);
  const [kind,setKind]=useState<'MANAGER'|'MEMBER'>('MANAGER');const [name,setName]=useState('');const [division,setDivision]=useState('');
  const fieldId=useId();
  const action=useRecoveredAction(collaborationRecovery,`project:${projectId}:invite`,()=>{setTarget(null);onInvited();});
  return <section className="section" aria-label="邀请协作"><h2 className="section-title">定向邀请</h2><form className="panel form" onSubmit={event=>{event.preventDefault();if(!target||action.locked)return;action.run({kind:'invite',projectId,body:{request_id:crypto.randomUUID(),target_ref:target.target_ref,kind,...(kind==='MEMBER'?{public_name:name.trim(),division:division.trim()}:{})}});}}>
    <fieldset className="form" disabled={action.locked}><legend className="field-label">邀请用途（每次仅一项）</legend><label className="r6-choice"><input type="radio" name={`${fieldId}-kind`} checked={kind==='MANAGER'} onChange={()=>setKind('MANAGER')}/> 共同管理文字与招募</label><label className="r6-choice"><input type="radio" name={`${fieldId}-kind`} checked={kind==='MEMBER'} onChange={()=>setKind('MEMBER')}/> 公开姓名与分工</label></fieldset>
    <TargetPicker target={target} onTarget={setTarget} disabled={action.locked}/>
    {kind==='MEMBER'?<><AuthField name={`${fieldId}-name`} label="候选公开姓名" hint="由对方逐次确认；待确认或拒绝不覆盖旧同意。" inputProps={{value:name,maxLength:80,required:true,disabled:action.locked,onChange:event=>setName(event.target.value)}}/><AuthField name={`${fieldId}-division`} label="候选分工" inputProps={{value:division,maxLength:120,required:true,disabled:action.locked,onChange:event=>setDivision(event.target.value)}}/></>:<p className="field-hint">共同管理不开放证明，也不代表同意公开姓名。需要挂名时另发一份邀请。</p>}
    <Button type="submit" disabled={!target||action.locked}>{kind==='MANAGER'?'发送共同管理邀请':'发送公开挂名候选'}</Button><RecoveryNotice {...action} onRetry={action.retry}/>
  </form></section>;
}
