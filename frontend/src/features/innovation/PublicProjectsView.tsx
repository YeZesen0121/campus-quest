"use client";
import { DiscoveryArrow } from "./PublicDiscoveryFrame";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, SectionError, SectionSkeleton } from "@/components/ui/sectionStates";
import { useSection } from "@/components/ui/useSection";
import { useSession } from "@/features/auth/session";
import { getAuthEpoch } from "@/lib/accessToken";
import { getPublicProject, getPublicProjects } from "./recruitmentApi";
import { RecruitmentRows, PublicResourceError } from "./PublicRecruitmentsView";
import { PublicProjectMentors } from './mentors/ProjectMentors';
import { campusDiscoveryHref } from './recruitmentQuery';
import { DividedSections } from '@/components/ui/dividedSections';
import { projectSourceText } from './collaboration/presentation';
import { PublicMembers } from './collaboration/PublicMembers';

export function PublicProjectsView({ id, query = "", returnQuery = "" }: { id?: string; query?: string; returnQuery?: string }) {
  const { state } = useSession();
  if (state.status !== "authenticated" || state.me.status !== "ACTIVE") return null;
  const key = `${state.me.id}:${getAuthEpoch()}:${id ?? ""}:${query}`;
  return id ? <ProjectDetail key={key} id={id} query={query} returnQuery={returnQuery} /> : <ProjectPage key={key} query={query} />;
}
function ProjectPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const { state, retry } = useSection(() => getPublicProjects(params));
  return <>
    <div className="page-head campus-projects-heading"><h1 className="page-title">项目库</h1>{state.status === "ready" ? <p className="campus-directory-count"><b>{state.data.total}</b> 个项目</p> : null}</div>
    <section className="section" aria-label="校内项目列表"><CampusFilters path="/innovation/projects" params={params} mode="compact" />
      {state.status === "loading" ? <SectionSkeleton /> : state.status === "error" ? <SectionError error={state.error} onRetry={retry} /> : <>
        {state.data.items.length ? <ul className="ie-draft-list ie-discovery-list">{state.data.items.map((item) => <li className="ie-draft-row" key={item.id}><div className="ie-draft-copy">
          <h2 className="section-title"><Link href={campusDiscoveryHref("projects", query, item.id)}>{item.title}<DiscoveryArrow /></Link></h2>
          <p>{item.direction} · {item.stage}</p><p className="ie-draft-excerpt">{item.summary}</p>
          <p className="campus-project-facts"><span>{item.recruitment_count?<><strong>{item.recruitment_count}</strong> 个有效岗位</>:<>暂无有效岗位</>}</span><span><strong>{item.achievement_count}</strong> 份成果</span></p>
          <p className="field-hint campus-project-source">{item.lifecycle==='COMPLETED'?'已结项 · ':''}介绍来源：{projectSourceText(item)}</p>
        </div></li>)}</ul> : <EmptyState title="暂无符合条件的项目" hint="已核实成果或有效招募项目将在这里展示。" />}
        {state.data.offset > 0 || state.data.total > 20 ? <CampusPagination path="/innovation/projects" params={params} offset={state.data.offset} total={state.data.total} /> : null}
      </>}
    </section>
  </>;
}

function ProjectDetail({ id, query, returnQuery }: { id: string; query: string; returnQuery: string }) {
  const params = new URLSearchParams(query);
  const backHref = campusDiscoveryHref('projects', returnQuery);
  const navigationParams = new URLSearchParams(returnQuery);
  params.forEach((value, key) => navigationParams.set(key, value));
  const { state, retry } = useSection(() => getPublicProject(id, params));
  if (state.status === "loading") return <><Link className="section-link campus-discovery-back" href={backHref}><DiscoveryArrow direction="left" />返回项目库</Link><h1 className="page-title">校内项目</h1><SectionSkeleton /></>;
  if (state.status === "error") return <><Link className="section-link campus-discovery-back" href={backHref}><DiscoveryArrow direction="left" />返回项目库</Link><h1 className="page-title">校内项目</h1><PublicResourceError error={state.error} retry={retry} /></>;
  const { project, achievements, recruitments } = state.data;
  return <article className="section ie-recruitment-public" aria-label="校内项目详情">
    <Link className="section-link campus-discovery-back" href={backHref}><DiscoveryArrow direction="left" />返回项目库</Link>
    <header className="page-head"><h1 className="page-title">{project.title}</h1><p className="page-subtitle">{project.direction} · {project.stage}</p></header>
    <p className="ie-review-prose">{project.summary}</p>
    <p className="field-hint">{project.lifecycle==='COMPLETED'?'已结项 · ':''}介绍来源：{projectSourceText(project)}</p>
    <DividedSections className="campus-project-reading">
      <section className="section" aria-label="项目正在招募"><div className="section-head"><h2 className="section-title">正在招募</h2><p className="field-hint">{recruitments.total} 个有效岗位</p></div>
        {recruitments.items.length ? <RecruitmentRows items={recruitments.items} mode="feed" /> : <EmptyState title="暂无有效招募" hint="已关闭或截止的岗位不会展示。" />}
        {recruitments.offset>0||recruitments.total>20?<CampusPagination path={`/innovation/projects/${id}`} params={navigationParams} offset={recruitments.offset} total={recruitments.total} keyName="recruitment_offset" label="项目招募分页" />:null}
      </section>
      <section className="section campus-project-achievements" aria-label="项目已核实成果"><div className="section-head"><h2 className="section-title">已核实成果</h2><p className="field-hint">{achievements.total} 份成果</p></div>
        {achievements.items.length ? <ul className="ie-draft-list ie-discovery-list">{achievements.items.map((item) => <li key={item.id} className="ie-draft-row"><div className="ie-draft-copy"><h3 className="section-title"><Link href={`/innovation/achievements/${item.id}`}>{item.achievement.title}<DiscoveryArrow /></Link></h3><p className="ie-draft-excerpt">{item.achievement.description}</p></div></li>)}</ul> : <EmptyState title="暂无已核实成果" hint="招募无需依赖已核实成果。" />}
        {achievements.offset>0||achievements.total>20?<CampusPagination path={`/innovation/projects/${id}`} params={navigationParams} offset={achievements.offset} total={achievements.total} keyName="achievement_offset" label="项目成果分页" />:null}
      </section>
    </DividedSections>
    <PublicProjectMentors projectId={id}/>
    <PublicMembers projectId={id}/>
  </article>;
}
export function CampusFilters({ path, params, showRecruitingOnly = true, mode = "full" }: { path: string; params: URLSearchParams; showRecruitingOnly?: boolean; mode?: "full" | "compact" }) {
  if (mode === "compact") return <CompactCampusFilters path={path} params={params} showRecruitingOnly={showRecruitingOnly} />;
  return <form method="get" action={path} className="form ie-draft-form" aria-label="校内浏览筛选">{([ ["q", "搜索"], ["direction", "方向"], ["stage", "阶段"] ] as const).map(([key, label]) => <div className="field" key={key}><label className="field-label" htmlFor={`filter-${key}`}>{label}</label><input className="input" id={`filter-${key}`} name={key} defaultValue={params.get(key) ?? ""} maxLength={key === "stage" ? 80 : 120} placeholder={key==='q'?'岗位、项目名称或职责':key==='direction'?'例如 校园服务':'例如 原型验证'} /></div>)}<div className="field"><label className="field-label" htmlFor="filter-beginner">零基础友好</label><select className="input" id="filter-beginner" name="beginner_friendly" defaultValue={params.get("beginner_friendly") ?? ""}><option value="">不限</option><option value="true">是</option><option value="false">否</option></select></div>{showRecruitingOnly ? <label className="field-label"><input type="checkbox" name="recruiting_only" value="true" defaultChecked={params.get("recruiting_only") === "true"} /> 仅看正在招募</label> : null}<div className="ie-draft-actions"><button type="submit" className="btn btn-primary">筛选</button><Link href={path}>清空筛选</Link></div></form>;
}
function CompactCampusFilters({ path, params, showRecruitingOnly }: { path: string; params: URLSearchParams; showRecruitingOnly: boolean }) {
  const [expanded, setExpanded] = useState(() => ["direction", "stage", "beginner_friendly", "recruiting_only"].some(key => !!params.get(key)));
  return <form method="get" action={path} className="form campus-project-filters" data-expanded={expanded} aria-label="校内浏览筛选">
    <div className="campus-search-row"><div className="campus-search-field"><label className="sr-only" htmlFor="filter-q">搜索</label><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input className="input" id="filter-q" type="search" enterKeyHint="search" name="q" defaultValue={params.get("q") ?? ""} maxLength={120} placeholder="搜索项目名称或简介" /></div><button type="button" className="btn btn-secondary" aria-expanded={expanded} aria-controls="campus-project-filter-options" onClick={() => setExpanded(value => !value)}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 6h16M7 12h10m-7 6h4"/></svg>筛选</button></div>
    <fieldset className="campus-filter-options" id="campus-project-filter-options"><legend className="sr-only">项目筛选条件</legend>
      {([["direction", "方向"], ["stage", "阶段"]] as const).map(([key, label]) => <div className="field" key={key}><label className="field-label" htmlFor={`filter-${key}`}>{label}</label><input className="input" id={`filter-${key}`} name={key} defaultValue={params.get(key) ?? ""} maxLength={key === "stage" ? 80 : 120} placeholder={key==='direction'?'输入方向':'输入阶段'} /></div>)}
      <div className="field"><label className="field-label" htmlFor="filter-beginner">零基础友好</label><select className="input" id="filter-beginner" name="beginner_friendly" defaultValue={params.get("beginner_friendly") ?? ""}><option value="">不限</option><option value="true">是</option><option value="false">否</option></select></div>
      {showRecruitingOnly ? <label className="field-label"><input type="checkbox" name="recruiting_only" value="true" defaultChecked={params.get("recruiting_only") === "true"} />仅看正在招募</label> : null}
    </fieldset>
    <div className="ie-draft-actions"><button type="submit" className="btn btn-primary" aria-label="应用筛选">筛选</button><Link href={path} aria-label="清空筛选">清空</Link></div>
  </form>;
}
export function CampusPagination({ path, params, offset, total, keyName = "offset", label = "校内浏览分页" }: { path: string; params: URLSearchParams; offset: number; total: number; keyName?: string; label?: string }) {
  function href(next: number) { const query = new URLSearchParams(params); query.set(keyName, String(next)); return `${path}?${query}`; }
  return <nav className="ie-draft-actions" aria-label={label}>{offset > 0 ? <Link href={href(Math.max(0, offset - 20))}>上一页</Link> : null}<span className="field-hint">第 {Math.floor(offset / 20) + 1} 页 · 共 {total} 项</span>{offset + 20 < total ? <Link href={href(offset + 20)}>下一页</Link> : null}</nav>;
}
