'use client';
import { DiscoveryArrow } from '../PublicDiscoveryFrame';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { isApiError } from '@/lib/errors';
import { AuthField } from '@/features/auth/AuthField';
import { getPublicMentor, getPublicMentors, readMentorContacts, type PublicMentor } from './api';
import { buildMentorQuery, mentorListHref, parseMentorQuery } from './query';
import { PublicMentorContent } from './MentorContent';
import { BUSINESS_TIME_CONFIG } from '@/lib/time';
import { useMentorAction } from './useMentorAction';
import { ActionFeedback } from './ActionFeedback';
import { CONTACT_LABELS } from '../recruitmentPresentation';
import { CampusPagination } from '../PublicProjectsView';

export function PublicMentorsView({id,query=''}:{id?:string;query?:string}) {
  const {state}=useSession();if(state.status!=='authenticated'||state.me.status!=='ACTIVE')return null;
  const key=`${state.me.id}:${getAuthEpoch()}:${id??query}`;
  return id?<Detail key={key} id={id} query={query}/>:<Directory key={key} query={query}/>;
}
function Directory({query}:{query:string}) {
  const filters=parseMentorQuery(new URLSearchParams(query));const params=buildMentorQuery(filters);
  const {state,retry}=useSection(()=>getPublicMentors(params));
  return <section className="section campus-mentor-directory" aria-label="校内导师库"><Filters query={query}/>
    {state.status==='loading'?<div role="status" aria-label="正在查找导师"><SectionSkeleton/></div>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:<><div className="campus-mentor-directory-meta"><p role="status">找到 {state.data.total} 位导师。</p><p>资料由导师本人确认 · 校内展示</p></div>{state.data.items.length?<ul className="campus-mentor-directory-list">{state.data.items.map(item=><li key={item.id}><div className="campus-mentor-person-head"><h2><Link href={`/innovation/mentors/${item.id}${params.size?'?'+params:''}`}>{item.name}</Link></h2><span>{item.accepting_contact?'接受联系':'暂停联系'}</span></div><p className="campus-mentor-unit">{item.unit}</p><p className="campus-mentor-introduction">{item.introduction}</p><dl className="campus-mentor-card-facts"><div><dt>指导方向</dt><dd>{item.directions}</dd></div><div><dt>适合项目</dt><dd>{item.project_types}</dd></div></dl><Link className="campus-mentor-card-link" href={`/innovation/mentors/${item.id}${params.size?'?'+params:''}`}>查看资料 <span aria-hidden="true">→</span></Link></li>)}</ul>:<EmptyState title="暂无符合条件的导师" hint="只展示导师本人确认的资料，可以调整筛选或稍后再来。"/>}<CampusPagination path="/innovation/mentors" params={params} offset={state.data.offset} total={state.data.total} label="导师分页"/></>}
  </section>;
}
function Filters({query}:{query:string}) {
  const router=useRouter();const [filters,setFilters]=useState(()=>parseMentorQuery(new URLSearchParams(query)));const [error,setError]=useState('');const ref=useRef<HTMLFormElement>(null);
  function submit(event:FormEvent){event.preventDefault();if([...filters.q.trim()].length>100||[...filters.direction.trim()].length>100){setError('搜索词和方向各最多 100 个字符。');ref.current?.querySelector<HTMLElement>('input')?.focus();return;}setError('');router.push(mentorListHref(buildMentorQuery(filters,0).toString()));}
  return <form className="form campus-mentor-filters" method="get" ref={ref} onSubmit={submit} aria-label="导师筛选" noValidate><AuthField name="mentor-search" label="搜索导师" inputProps={{placeholder:'姓名、单位或简介',value:filters.q,onChange:event=>setFilters({...filters,q:event.target.value})}}/><AuthField name="mentor-direction" label="指导方向" inputProps={{'aria-label':'指导方向筛选',placeholder:'输入方向',value:filters.direction,onChange:event=>setFilters({...filters,direction:event.target.value})}}/><div className="field"><label className="field-label" htmlFor="mentor-contact-filter">联系状态</label><select className="input" id="mentor-contact-filter" aria-label="接受联系筛选" value={filters.accepting_contact} onChange={event=>setFilters({...filters,accepting_contact:event.target.value as typeof filters.accepting_contact})}><option value="">不限</option><option value="true">接受联系</option><option value="false">暂停联系</option></select></div>{error?<p className="field-error" role="alert">{error}</p>:null}<div className="ie-draft-actions"><Button type="submit">查找导师</Button><Button asChild variant="secondary"><Link href="/innovation/mentors" aria-label="清除筛选">清除</Link></Button></div></form>;
}
function Detail({id,query}:{id:string;query:string}) {
  const {state,retry}=useSection(()=>getPublicMentor(id));const back=<Link className="campus-mentor-back" href={mentorListHref(query)}><DiscoveryArrow direction="left" />返回导师列表</Link>;
  if(state.status==='loading')return <>{back}<h1 className="page-title">导师资料</h1><SectionSkeleton/></>;
  if(state.status==='error')return <>{back}<h1 className="page-title">导师资料</h1>{isApiError(state.error)&&state.error.status===404?<p role="alert" className="alert alert-error">资料不存在或已停止展示，请返回导师列表。</p>:<SectionError error={state.error} onRetry={retry}/>}</>;
  const item=state.data;
  return <article className="section campus-mentor-detail" aria-label="校内导师详情">{back}<header className="page-head"><h1 className="page-title">{item.content.name}</h1><p className="page-subtitle">{item.content.unit}</p></header><div className="campus-mentor-public-meta"><span className="campus-mentor-state">{item.accepting_contact?'接受联系':'暂停联系'}</span><span>资料已由导师本人确认</span><span>已确认第 {item.public_version} 版 · <time dateTime={item.published_at} data-time-format="date">{new Intl.DateTimeFormat(BUSINESS_TIME_CONFIG.locale,{timeZone:BUSINESS_TIME_CONFIG.timeZone,month:"long",day:"numeric"}).format(new Date(item.published_at))}</time> 更新</span></div><Contacts key={item.public_version} item={item} onRefresh={retry}/><p className="campus-mentor-boundary">联系不代表导师已接受指导；项目挂名另行确认。</p><PublicMentorContent content={item.content}/><p className="campus-mentor-endnote">以上资料由导师本人确认。代表成果为导师提供的文字资料。</p></article>;
}
function Contacts({item,onRefresh}:{item:PublicMentor;onRefresh:()=>void}) {
  const [contacts,setContacts]=useState<Awaited<ReturnType<typeof readMentorContacts>>|null>(null);
  const [changed,setChanged]=useState(false);
  const action=useMentorAction<Awaited<ReturnType<typeof readMentorContacts>>>(value=>{if(value.public_version===item.public_version)setContacts(value);else setChanged(true);});
  function read(){setContacts(null);void action.run(()=>readMentorContacts(item.id,item.public_version));}
  return <section className="campus-mentor-contact-band" aria-label="导师授权联系"><h2 className="section-title">联系导师</h2>{item.accepting_contact&&item.contact_channels.length?<><p className="field-hint">授权渠道：{item.contact_channels.map(channel=>CONTACT_LABELS[channel]).join('、')}。点击后读取，访问会留存审计记录。</p><Button disabled={action.locked||action.error?.refresh||changed} onClick={read}>查看授权联系方式</Button></>:<p className="field-hint">导师目前暂停联系，暂不提供联系方式。</p>}<ActionFeedback {...action} message={contacts?'联系方式已读取，请查看下方渠道。':changed?'':action.message} pending={!!action.pending} onRetry={()=>void action.retry()} onRefresh={onRefresh}/>{changed?<p role="alert" className="alert alert-warning">资料已更新，请<Button variant="secondary" onClick={onRefresh}>刷新导师资料</Button>后重新读取。</p>:null}{contacts?<dl className="ie-review-prose campus-mentor-contact-results">{contacts.contacts.map(contact=><div key={contact.channel}><dt className="field-label">{CONTACT_LABELS[contact.channel]}</dt><dd>{contact.value}</dd></div>)}</dl>:null}</section>;
}
