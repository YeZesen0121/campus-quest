'use client';
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
import { MentorContent } from './MentorContent';
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
  return <section className="section ie-talent-directory" aria-label="校内导师库"><Filters query={query}/>
    {state.status==='loading'?<div role="status" aria-label="正在查找导师"><SectionSkeleton/></div>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:<><p role="status" className="field-hint">找到 {state.data.total} 位导师。</p>{state.data.items.length?<ul className="ie-draft-list ie-discovery-list">{state.data.items.map(item=><li className="ie-draft-row" key={item.id}><div className="ie-draft-copy"><h2 className="section-title"><Link href={`/innovation/mentors/${item.id}${params.size?'?'+params:''}`}>{item.name}</Link></h2><p className="field-hint">{item.unit} · {item.accepting_contact?'接受联系':'暂停联系'}</p><p className="ie-draft-excerpt">{item.introduction}</p><p className="ie-draft-excerpt">指导方向：{item.directions}</p></div></li>)}</ul>:<EmptyState title="暂无符合条件的导师" hint="只展示导师本人确认的资料，可以调整筛选或稍后再来。"/>}<CampusPagination path="/innovation/mentors" params={params} offset={state.data.offset} total={state.data.total} label="导师分页"/></>}
  </section>;
}
function Filters({query}:{query:string}) {
  const router=useRouter();const [filters,setFilters]=useState(()=>parseMentorQuery(new URLSearchParams(query)));const [error,setError]=useState('');const ref=useRef<HTMLFormElement>(null);
  function submit(event:FormEvent){event.preventDefault();if([...filters.q.trim()].length>100||[...filters.direction.trim()].length>100){setError('搜索词和方向各最多 100 个字符。');ref.current?.querySelector<HTMLElement>('input')?.focus();return;}setError('');router.push(mentorListHref(buildMentorQuery(filters,0).toString()));}
  return <form className="panel form ie-draft-form" method="get" ref={ref} onSubmit={submit} aria-label="导师筛选" noValidate><AuthField name="mentor-search" label="搜索导师" inputProps={{value:filters.q,onChange:event=>setFilters({...filters,q:event.target.value})}}/><AuthField name="mentor-direction" label="指导方向筛选" inputProps={{value:filters.direction,onChange:event=>setFilters({...filters,direction:event.target.value})}}/><div className="field"><label className="field-label" htmlFor="mentor-contact-filter">接受联系筛选</label><select className="input" id="mentor-contact-filter" value={filters.accepting_contact} onChange={event=>setFilters({...filters,accepting_contact:event.target.value as typeof filters.accepting_contact})}><option value="">不限</option><option value="true">接受联系</option><option value="false">暂停联系</option></select></div>{error?<p className="field-error" role="alert">{error}</p>:null}<div className="ie-draft-actions"><Button type="submit">查找导师</Button><Link href="/innovation/mentors">清除筛选</Link></div></form>;
}
function Detail({id,query}:{id:string;query:string}) {
  const {state,retry}=useSection(()=>getPublicMentor(id));const back=<Link href={mentorListHref(query)}>返回导师列表</Link>;
  if(state.status==='loading')return <>{back}<h1 className="page-title">导师资料</h1><SectionSkeleton/></>;
  if(state.status==='error')return <>{back}<h1 className="page-title">导师资料</h1>{isApiError(state.error)&&state.error.status===404?<p role="alert" className="alert alert-error">资料不存在或已停止展示，请返回导师列表。</p>:<SectionError error={state.error} onRetry={retry}/>}</>;
  const item=state.data;
  return <article className="section ie-talent-public" aria-label="校内导师详情">{back}<h1 className="page-title">{item.content.name}</h1><p className="page-subtitle">{item.content.unit}</p><p className="field-hint">{item.accepting_contact?'接受联系':'暂停联系'} · 资料已由导师本人确认。联系不代表导师已接受指导；项目挂名另行确认。</p><MentorContent content={item.content}/><Contacts key={item.public_version} item={item} onRefresh={retry}/></article>;
}
function Contacts({item,onRefresh}:{item:PublicMentor;onRefresh:()=>void}) {
  const [contacts,setContacts]=useState<Awaited<ReturnType<typeof readMentorContacts>>|null>(null);
  const [changed,setChanged]=useState(false);
  const action=useMentorAction<Awaited<ReturnType<typeof readMentorContacts>>>(value=>{if(value.public_version===item.public_version)setContacts(value);else setChanged(true);});
  function read(){setContacts(null);void action.run(()=>readMentorContacts(item.id,item.public_version));}
  return <section className="section" aria-label="导师授权联系"><h2 className="section-title">联系导师</h2>{item.accepting_contact&&item.contact_channels.length?<><p className="field-hint">授权渠道：{item.contact_channels.map(channel=>CONTACT_LABELS[channel]).join('、')}。点击后读取，访问会留存审计记录。</p><Button variant="secondary" disabled={action.locked||action.error?.refresh||changed} onClick={read}>查看授权联系方式</Button></>:<p className="field-hint">导师目前暂停联系，暂不提供联系方式。</p>}<ActionFeedback {...action} message={contacts?'联系方式已读取，请查看下方渠道。':changed?'':action.message} pending={!!action.pending} onRetry={()=>void action.retry()} onRefresh={onRefresh}/>{changed?<p role="alert" className="alert alert-warning">资料已更新，请<Button variant="secondary" onClick={onRefresh}>刷新导师资料</Button>后重新读取。</p>:null}{contacts?<dl className="ie-review-prose">{contacts.contacts.map(contact=><div key={contact.channel}><dt className="field-label">{CONTACT_LABELS[contact.channel]}</dt><dd>{contact.value}</dd></div>)}</dl>:null}</section>;
}
