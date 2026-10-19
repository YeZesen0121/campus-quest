'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { getOwnMentor, type MaintenanceField, type MentorConsent, type MentorProfile } from './api';
import { emptyMentorFields, MAINTENANCE_FIELDS, validateMentorConsent } from './form';
import { MentorContent } from './MentorContent';
import { DividedSections } from '@/components/ui/dividedSections';
import { formatDeadlineDateTime } from '@/lib/time';
import { mentorStatus } from './presentation';
import { useRecoveredMentorAction } from './useRecoveredMentorAction';
import { mentorWorkspace, profileRecovery } from './recoveryCommands';
import { ActionFeedback } from './ActionFeedback';
import { CONTACT_LABELS } from '../recruitmentPresentation';
import { RecruitmentConfirm } from '../RecruitmentConfirm';
import { MentorProjectInbox } from './ProjectMentors';
import { DiscoveryArrow } from '../PublicDiscoveryFrame';

export function MentorSelfView() {
  const {state}=useSession();if(state.status!=='authenticated'||state.me.status!=='ACTIVE')return null;
  return <OwnLoader key={`${state.me.id}:${getAuthEpoch()}`}/>;
}
function OwnLoader() {
  const {state,retry}=useSection(getOwnMentor);
  if(state.status==='loading')return <SectionSkeleton/>;if(state.status==='error')return <SectionError error={state.error} onRetry={retry}/>;
  return state.data.profile?<OwnProfile initial={state.data.profile}/>:<EmptyState title="尚未绑定导师资料" hint="请联系双创运营建立档案并绑定你的账号。资料需由你亲自核对后才会展示。"/>;
}
function OwnProfile({initial}:{initial:MentorProfile}) {
  const [record,setRecord]=useState(initial);const [remote,setRemote]=useState<MentorProfile|null>(null);
  const [withdraw,setWithdraw]=useState<{completed:boolean}|null>(null);const result=useRef<HTMLDivElement>(null);
  const action=useRecoveredMentorAction(profileRecovery,mentorWorkspace.self,value=>{setRecord(value.current);setRemote(null);setWithdraw(value=>value?{completed:true}:null);});
  function version(){return {request_id:crypto.randomUUID(),version:record.version};}
  async function refresh(){try{const value=await getOwnMentor();if(action.current()){setRemote(value.profile);if(!value.profile)action.setMessage('当前账号已无导师资料，请刷新页面。');}}catch{if(action.current())action.setMessage('读取失败，请重试；当前选择仍保留。');}}
  const [visibilityLabel,confirmationLabel]=mentorStatus(record).split(' · ');
  return <section className="section campus-mentor-self" aria-label="我的导师资料"><div className="campus-mentor-self-summary"><p className="campus-mentor-self-states"><span className="campus-mentor-state">{visibilityLabel}</span>{confirmationLabel?<span className="campus-mentor-state">{confirmationLabel}</span>:null}<span>{record.accepting_contact?'接受联系':'暂停联系'}</span></p>{record.visibility==='VISIBLE'?<Link className="campus-mentor-self-public-link" href={`/innovation/mentors/${record.id}`}>查看当前校内展示<DiscoveryArrow /></Link>:null}</div><nav className="campus-mentor-local-nav" aria-label="导师本人资料分区"><a href="#mentor-candidate">核对候选资料</a>{record.visibility==='VISIBLE'?<a href="#mentor-current">管理当前授权</a>:null}<a href="#mentor-projects">项目挂名</a></nav>
    <section className="section" id="mentor-candidate" aria-label="候选导师资料"><div className="campus-mentor-section-head"><h2>核对候选资料</h2><span>第 {record.version} 版 · <time dateTime={record.updated_at}>{formatDeadlineDateTime(Date.parse(record.updated_at))}</time></span></div><p className="campus-mentor-explain">请核对候选资料。展示、联系与代维护范围分别选择；确认前不会替换旧公开内容。</p><DividedSections className="campus-mentor-candidate-grid"><div><MentorContent content={record.fields} identity/>
    {record.visibility==='VISIBLE'&&record.public_content&&record.confirmation_state!=='CONFIRMED'?<details className="campus-mentor-old-version"><summary>当前仍在展示的已确认版本 · 第 {record.public_version} 版</summary><MentorContent content={record.public_content} identity/></details>:null}
    </div><ConsentForm key={record.version} record={record} disabled={action.locked||!!action.error?.refresh} onConfirm={consent=>{const body={...version(),...consent};void action.run({kind:'confirm',body});}}>{record.confirmation_state==='PENDING'?<Button variant="secondary" disabled={action.locked||action.error?.refresh} onClick={()=>{const body=version();void action.run({kind:'reject',body});}}>拒绝候选资料</Button>:null}</ConsentForm></DividedSections></section>
    <div tabIndex={-1} ref={result}><ActionFeedback {...action} pending={!!action.pending} onRetry={()=>void action.retry()} onRefresh={()=>void refresh()}/></div>
    {remote?<section className="panel" aria-label="最新待确认导师资料"><h3 className="section-title">资料已变化，请重新核对</h3><MentorContent content={remote.fields} identity/><p className="field-hint">读取不会自动同意新内容；载入后将清空本次确认勾选。</p><Button variant="secondary" onClick={()=>{setRecord(remote);setRemote(null);action.clearError();action.setMessage('已载入最新资料，请重新逐项确认。');}}>载入最新资料并重新选择</Button></section>:null}
    {record.visibility==='VISIBLE'?<section className="section campus-mentor-current" id="mentor-current" aria-label="当前导师授权"><div className="campus-mentor-section-head"><h2>管理当前授权</h2><span>已确认第 {record.public_version} 版</span></div><DividedSections className="campus-mentor-current-grid"><div><h3>联系与展示</h3><p className="field-hint">当前状态：{record.accepting_contact?'接受联系':'暂停联系'}</p><p className="field-hint">暂停联系保留公开档案；恢复由本人操作。</p><div className="ie-draft-actions"><Button variant="secondary" disabled={action.locked||action.error?.refresh||(!record.accepting_contact&&!record.public_contact_channels.length)} onClick={()=>{const body={...version(),accepting_contact:!record.accepting_contact};void action.run({kind:'contact-state',body});}}>{record.accepting_contact?'暂停联系':'恢复联系'}</Button></div>{!record.public_contact_channels.length?<p className="field-hint">尚无授权联系渠道。若需恢复联系，请在上方核对当前候选资料并重新授权渠道。</p>:<ul className="campus-mentor-current-channels">{record.public_contact_channels.map(channel=><li key={channel}><span>{CONTACT_LABELS[channel]}</span><span className="field-hint">已授权</span><Button aria-label={`撤销${CONTACT_LABELS[channel]}联系授权`} variant="secondary" disabled={action.locked||action.error?.refresh} onClick={()=>{const body={...version(),channel};void action.run({kind:'revoke-contact',body});}}>撤销</Button></li>)}</ul>}<div className="campus-mentor-withdraw"><p className="field-hint">暂停联系保留资料；撤回展示会停止档案访问、清空代维护范围并解除全部项目挂名。重新确认不会恢复旧挂名。</p><Button variant="danger" disabled={action.locked||action.error?.refresh} onClick={()=>setWithdraw({completed:false})}>撤回导师展示</Button></div></div><ScopeForm key={record.version} selected={record.authorized_fields} disabled={action.locked||!!action.error?.refresh} onSave={authorized_fields=>{const body={...version(),authorized_fields};void action.run({kind:'scope',body});}}/></DividedSections></section>:null}
    <MentorProjectInbox refreshVersion={record.version}/>
    {withdraw?<RecruitmentConfirm title="撤回导师展示" description="导师资料将停止展示和联系，运营代维护授权会清空，所有待定与已接受的项目挂名都将解除。重新公开需要你再次确认。" confirmLabel={action.pending?'重试原撤回请求':action.error?.refresh?'关闭并读取最新资料':'确认撤回展示'} busy={action.busy} completed={withdraw.completed} onClose={()=>setWithdraw(null)} onConfirm={()=>{if(action.pending){void action.retry();return;}if(action.error?.refresh){setWithdraw(null);void refresh();return;}const body=version();void action.run({kind:'withdraw',body});}} resultFocus={()=>result.current}>{action.error?<p role="alert" className="alert alert-error">{action.error.message}</p>:null}</RecruitmentConfirm>:null}
  </section>;
}
function ConsentForm({record,disabled,onConfirm,children}:{record:MentorProfile;disabled:boolean;onConfirm:(value:MentorConsent)=>void;children?:ReactNode}) {
  const [consent,setConsent]=useState<MentorConsent>({confirm_profile:false,contact_channels:[],authorized_fields:[],accepting_contact:false});const [error,setError]=useState('');const ref=useRef<HTMLFormElement>(null);const fields={...emptyMentorFields(),...record.fields};
  function submit(event:FormEvent){event.preventDefault();if(disabled)return;const issue=validateMentorConsent(fields,consent);setError(issue);if(issue){ref.current?.querySelector<HTMLElement>('input')?.focus();return;}onConfirm(consent);}
  return <form className="form campus-mentor-consent" method="post" onSubmit={submit} ref={ref} aria-label="导师本人确认" noValidate><fieldset disabled={disabled} className="ie-recruitment-fields"><legend className="field-label">本人确认</legend><label className="field-label"><input type="checkbox" checked={consent.confirm_profile} onChange={event=>setConsent({...consent,confirm_profile:event.target.checked})}/> 我已核对以上资料，同意在校内展示</label></fieldset><fieldset disabled={disabled} className="ie-recruitment-fields"><legend className="field-label">逐项授权联系渠道</legend>{fields.contacts.length?fields.contacts.map(contact=><label className="field-label ie-review-prose" key={contact.channel}><input type="checkbox" checked={consent.contact_channels.includes(contact.channel)} onChange={event=>setConsent({...consent,contact_channels:event.target.checked?[...consent.contact_channels,contact.channel]:consent.contact_channels.filter(value=>value!==contact.channel)})}/> 允许展示{CONTACT_LABELS[contact.channel]}：{contact.value}</label>):<p className="field-hint">候选资料未填写联系方式，可以保持暂停联系。</p>}<label className="field-label"><input type="checkbox" checked={consent.accepting_contact} onChange={event=>setConsent({...consent,accepting_contact:event.target.checked})}/> 接受校内用户联系</label><p className="field-hint">不勾选接受联系时，档案可以展示，但不会提供联系方式。</p></fieldset><ScopeChoices selected={consent.authorized_fields} disabled={disabled} onChange={authorized_fields=>setConsent({...consent,authorized_fields})}/>{error?<p role="alert" className="field-error">{error}</p>:null}<div className="ie-draft-actions"><Button type="submit" disabled={disabled}>确认资料与授权</Button>{children}</div></form>;
}
function ScopeChoices({selected,disabled,onChange,legend="允许运营代维护的字段"}:{selected:MaintenanceField[];disabled:boolean;onChange:(value:MaintenanceField[])=>void;legend?:string}) {
  return <fieldset className="ie-recruitment-fields campus-mentor-scope-choices" disabled={disabled}><legend className="field-label">{legend}</legend>{MAINTENANCE_FIELDS.map(({key,label})=><label className="field-label" key={key}><input type="checkbox" checked={selected.includes(key)} onChange={event=>onChange(event.target.checked?[...selected,key]:selected.filter(value=>value!==key))}/> {label}</label>)}<p className="field-hint">仅授权勾选字段；运营在授权内修改可直接更新展示。姓名、单位、联系方式始终需要你另行确认。</p></fieldset>;
}
function ScopeForm({selected,disabled,onSave}:{selected:MaintenanceField[];disabled:boolean;onSave:(value:MaintenanceField[])=>void}) {
  const [scope,setScope]=useState(selected);return <form className="form campus-mentor-scope-form" method="post" aria-label="修改代维护授权" onSubmit={event=>{event.preventDefault();if(!disabled)onSave(scope);}}><ScopeChoices legend="运营代维护范围" selected={scope} disabled={disabled} onChange={setScope}/><Button variant="secondary" disabled={disabled} type="submit">保存代维护授权</Button></form>;
}
