'use client';
import { DiscoveryArrow } from "./PublicDiscoveryFrame";
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthField } from '@/features/auth/AuthField';
import { EmptyState, SectionError, SectionSkeleton } from '@/components/ui/sectionStates';
import { useSection } from '@/components/ui/useSection';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { describeSectionError, isApiError } from '@/lib/errors';
import { getPublicTalents, getPublicTalent, getTalentTags, downloadPublicTalentFile, saveTalentBlob, type PublicTalentDto, type TalentTagDto } from './talentApi';
import { parseTalentQuery, buildTalentQuery, talentListHref } from './talentQuery';
import { TALENT_STATES } from './talentForm';
import { codePointCount } from './draftForm';
import { TalentContacts } from './TalentContacts';
import { talentSize } from './talentPresentation';
import { TalentTags, TalentMaterialFlag, TalentReadingSections, TALENT_MATERIAL_NOTICE } from './TalentOverview';

export function PublicTalentManagementLink(){
  const {state}=useSession();
  if(state.status!=='authenticated'||state.me.status!=='ACTIVE'||state.me.role!=='STUDENT')return null;
  return <Link className="campus-talent-management" aria-label="建立或管理我的人才档案" href="/profile/talent-profile">我的人才档案</Link>;
}

export function PublicTalentsView({id,query=''}:{id?:string;query?:string}){
  const {state}=useSession();if(state.status!=='authenticated'||state.me.status!=='ACTIVE')return null;
  const key=`${state.me.id}:${getAuthEpoch()}:${id??query}`;
  return id?<TalentDetail key={key} id={id} query={query}/>:<TalentDirectory key={key} query={query}/>;
}
function TalentDirectory({query}:{query:string}){
  const filters=parseTalentQuery(new URLSearchParams(query));
  const {state,retry}=useSection(async()=>{const [list,tags]=await Promise.all([getPublicTalents(buildTalentQuery(filters)),getTalentTags()]);return {list,tags:tags.items};});
  return <section className="section ie-talent-directory" aria-label="校内人才库">
    {state.status==='loading'?<div role="status" aria-label="正在查找人才"><SectionSkeleton/></div>:state.status==='error'?<SectionError error={state.error} onRetry={retry}/>:<>
      <TalentFilters query={query} tags={state.data.tags}/><div className="campus-talent-directory-notes"><p className="field-hint" id="talent-material-notice">{TALENT_MATERIAL_NOTICE} 没有材料也可以公开档案。</p><div className="campus-talent-result-meta"><p className="field-hint" role="status">找到 {state.data.list.total} 位同学</p><p className="field-hint">最近公开在前</p></div></div>
      {state.data.list.items.length?<ul className="ie-draft-list ie-discovery-list">{state.data.list.items.map(item=><li className="ie-draft-row" key={item.id}><div className="ie-draft-copy"><div className="ie-talent-heading"><h2 className="section-title"><Link href={`/innovation/talents/${item.id}${buildTalentQuery(filters).size?'?'+buildTalentQuery(filters):''}`}>{item.name}</Link></h2><span className="ie-talent-state" data-cooperation-state={item.cooperation_state}>{TALENT_STATES[item.cooperation_state]}</span></div><p className="field-hint">{item.faculty} · {item.grade}</p><TalentTags tags={item.tags}/><p className="ie-draft-excerpt ie-talent-headline">{item.headline||'暂未填写一句话介绍'}</p><TalentMaterialFlag present={item.has_public_materials} describedBy="talent-material-notice"/></div></li>)}</ul>:<EmptyState title="暂无符合条件的人才" hint="只有同学主动公开的档案会出现在这里，可以调整筛选或稍后再来。"/>}
      <nav className="ie-draft-actions" aria-label="人才分页">{filters.offset>0?<Link href={talentListHref(buildTalentQuery(filters,Math.max(0,filters.offset-20)).toString())}>上一页</Link>:null}{filters.offset+state.data.list.items.length<state.data.list.total?<Link href={talentListHref(buildTalentQuery(filters,filters.offset+20).toString())}>下一页</Link>:null}</nav>
    </>}
  </section>;
}
function TalentFilters({query,tags}:{query:string;tags:TalentTagDto[]}){
  const router=useRouter();const [filters,setFilters]=useState(()=>parseTalentQuery(new URLSearchParams(query)));const [error,setError]=useState('');const inputRef=useRef<HTMLInputElement>(null);const [showTags,setShowTags]=useState(()=>filters.tag_ids.length>0);
  function submit(event:FormEvent){event.preventDefault();if(codePointCount(filters.q.trim())>100){setError('搜索词最多 100 个字符。');inputRef.current?.focus();return;}setError('');router.push(talentListHref(buildTalentQuery(filters,0).toString()));}
  return <form className="panel form ie-talent-filters" onSubmit={submit} noValidate method="get" aria-label="人才筛选"><AuthField name="talent-search" label="搜索同学或技能" error={error} inputProps={{placeholder:"姓名、院系或技能，最多 100 字",value:filters.q,ref:inputRef,onChange:event=>setFilters({...filters,q:event.target.value})}}/>
    <div className="field"><label className="field-label" htmlFor="talent-filter-state">合作状态</label><select aria-label="合作状态筛选" className="input" id="talent-filter-state" value={filters.cooperation_state} onChange={event=>setFilters({...filters,cooperation_state:event.target.value as typeof filters.cooperation_state})}><option value="">全部</option>{Object.entries(TALENT_STATES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label className="field-label" htmlFor="talent-filter-materials">作品/证明材料</label><select aria-label="作品/证明材料筛选" className="input" id="talent-filter-materials" value={filters.has_public_materials} onChange={event=>setFilters({...filters,has_public_materials:event.target.value as typeof filters.has_public_materials})}><option value="">全部</option><option value="true">有公开作品或证明材料</option><option value="false">无公开作品或证明材料</option></select></div>
    <details className="campus-talent-filter-tags" open={showTags} onToggle={event=>setShowTags(event.currentTarget.open)}><summary>技能筛选 <small>最多 5 个，需同时具备</small></summary><fieldset className="ie-recruitment-fields ie-talent-filter-tags"><legend className="sr-only">技能选项</legend><div className="ie-talent-choices">{tags.map(tag=><label className="field-label" key={tag.id}><input type="checkbox" checked={filters.tag_ids.includes(tag.id)} disabled={!filters.tag_ids.includes(tag.id)&&filters.tag_ids.length>=5} onChange={event=>setFilters({...filters,tag_ids:event.target.checked?[...filters.tag_ids,tag.id]:filters.tag_ids.filter(id=>id!==tag.id)})}/> {tag.name}</label>)}</div></fieldset></details>
    <div className="ie-draft-actions"><Button type="submit">查找人才</Button><Button asChild variant="secondary"><Link href="/innovation/talents">清除筛选</Link></Button></div>
  </form>;
}
function TalentDetail({id,query}:{id:string;query:string}){
  const {state,retry}=useSection(()=>getPublicTalent(id));
  const back=<Link className="section-link campus-discovery-back" href={talentListHref(query)}><DiscoveryArrow direction="left" />返回人才列表</Link>;
  if(state.status==='loading')return <>{back}<h1 className="page-title">人才档案</h1><SectionSkeleton/></>;
  if(state.status==='error')return <>{back}<h1 className="page-title">人才档案</h1>{isApiError(state.error)&&state.error.status===404?<p className="alert alert-error" role="alert">档案不存在或已停止校内展示，请返回列表查看当前人才。</p>:<SectionError error={state.error} onRetry={retry}/>}</>;
  const item=state.data;const content=item.content;
  return <article className="section ie-talent-public" aria-label="校内人才详情">{back}<header className="ie-talent-summary"><div className="ie-talent-heading"><h1 className="page-title">{content.name}</h1></div><p className="page-subtitle">{content.faculty} · {content.grade}</p></header><div className="campus-talent-detail-intro"><div className="campus-talent-public-meta"><span className="ie-talent-state" data-cooperation-state={content.cooperation_state}>{TALENT_STATES[content.cooperation_state]}</span><p className="field-hint">本人填写并确认公开 · 演示资料</p></div><TalentTags tags={content.tags}/><TalentMaterialFlag present={item.files.length>0} describedBy="talent-detail-material-notice"/><p className="ie-talent-headline">{content.headline||'暂未填写一句话介绍'}</p><p className="field-hint" id="talent-detail-material-notice">{TALENT_MATERIAL_NOTICE}</p></div>
    <div className="campus-talent-contact-bar"><TalentContacts key={`contacts:${item.public_version}`} item={item} onRefresh={retry}/></div><div className="campus-talent-reading"><TalentReadingSections content={content}/></div>
    <div className="campus-talent-materials"><section className="section" aria-label="公开作品链接"><h2 className="section-title">作品链接</h2>{content.links.length?<ul>{content.links.map((link,index)=><li key={index}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}（新窗口）</a></li>)}</ul>:<p className="field-hint">暂无作品链接。</p>}</section>
    <TalentPublicFiles key={`files:${item.public_version}`} item={item} onRefresh={retry}/></div>
  </article>;
}
function TalentPublicFiles({item,onRefresh}:{item:PublicTalentDto;onRefresh:()=>void}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [changed,setChanged]=useState(false);const active=useRef(false);const epoch=useRef(getAuthEpoch());const running=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function download(file:PublicTalentDto['files'][number]){if(running.current)return;running.current=true;setBusy(true);setError('');try{const blob=await downloadPublicTalentFile(item.id,file.id,item.public_version);if(active.current&&epoch.current===getAuthEpoch())saveTalentBlob(blob,file.name);}catch(cause){if(active.current&&epoch.current===getAuthEpoch()){setError(isApiError(cause)&&cause.status===404?'档案或文件已停止公开，无法下载。':describeSectionError(cause).message);setChanged(isApiError(cause)&&[404,409].includes(cause.status));}}finally{running.current=false;if(active.current&&epoch.current===getAuthEpoch())setBusy(false);}}
  return <section className="section" aria-label="公开作品文件"><h2 className="section-title">作品与证明文件</h2>{item.files.length?<ul className="ie-draft-list">{item.files.map(file=><li className="ie-draft-row" key={file.id}><div className="ie-draft-copy"><div><p>{file.name}</p><p className="field-hint">{talentSize(file.size)}</p></div><Button variant="secondary" aria-label={`下载 ${file.name}`} disabled={busy||changed} onClick={()=>void download(file)}>下载</Button></div></li>)}</ul>:<p className="field-hint">暂无公开文件。</p>}<p className="field-hint" role="status">{busy?'正在核对权限并读取文件…':''}</p>{error?<p className="alert alert-error" role="alert">{error}</p>:null}{changed?<Button variant="secondary" onClick={onRefresh}>刷新档案</Button>:null}</section>;
}
