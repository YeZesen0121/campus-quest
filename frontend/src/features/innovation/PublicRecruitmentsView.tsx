"use client";
import { DiscoveryArrow } from "./PublicDiscoveryFrame";
import Link from "next/link";
import { EmptyState, SectionError, SectionSkeleton } from "@/components/ui/sectionStates";
import { useSection } from "@/components/ui/useSection";
import { useSession } from "@/features/auth/session";
import { getAuthEpoch } from "@/lib/accessToken";
import { BUSINESS_TIME_CONFIG } from "@/lib/time";
import { isApiError } from "@/lib/errors";
import { recruitmentDateTime } from "./recruitmentPresentation";
import { getPublicRecruitment, getPublicRecruitments, type PublicRecruitmentDto } from "./recruitmentApi";
import { RecruitmentContacts } from "./RecruitmentContacts";
import { CampusFilters, CampusPagination } from "./PublicProjectsView";
import { campusDiscoveryHref } from './recruitmentQuery';
import { DividedSections } from '@/components/ui/dividedSections';

export function PublicRecruitmentsView({ id, query = "", compact = false }: { id?: string; query?: string; compact?: boolean }) {
  const { state } = useSession();
  if (state.status !== "authenticated" || state.me.status !== "ACTIVE") return null;
  const key = `${state.me.id}:${getAuthEpoch()}:${id ?? query}`;
  return id ? <RecruitmentDetail key={key} id={id} query={query} /> : <RecruitmentPage key={key} query={query} compact={compact} />;
}
function RecruitmentPage({ query, compact }: { query: string; compact: boolean }) {
  const params = new URLSearchParams(query);
  const { state, retry } = useSection(() => getPublicRecruitments(params));
  return <section className={compact ? "section" : "section campus-recruitments-directory"} aria-label="校内招募岗位">{compact ? <div className="section-head"><h2 className="section-title">正在招募</h2><Link href="/innovation/recruitments" aria-label="浏览全部招募">浏览全部<DiscoveryArrow /></Link></div> : <CampusFilters path="/innovation/recruitments" params={params} showRecruitingOnly={false} />}{compact?<p className="field-hint">负责人独立发布，免审；岗位内容未经成果核实。</p>:null}{state.status === "loading" ? <SectionSkeleton /> : state.status === "error" ? <SectionError error={state.error} onRetry={retry} /> : <>{!compact ? <div className="section-head campus-recruitment-directory-heading"><h2 className="section-title">当前有效岗位</h2><p className="field-hint">{state.data.total} 个岗位</p></div> : null}{state.data.items.length ? <RecruitmentRows items={compact ? state.data.items.slice(0, 3) : state.data.items} query={query} mode={compact ? 'feed' : 'directory'} /> : <EmptyState title="暂无符合条件的招募" hint="当前有效且有联系授权的岗位将在这里展示，可以调整筛选或稍后再来。" />}{!compact ? <CampusPagination path="/innovation/recruitments" params={params} offset={state.data.offset} total={state.data.total} /> : null}</>}</section>;
}
export function RecruitmentRows({ items, query = '', mode = 'directory' }: { items: PublicRecruitmentDto[]; query?: string; mode?: 'feed' | 'directory' }) {
  const Heading = mode === 'feed' ? 'h3' : 'h2';
  return <ul className="ie-draft-list ie-discovery-list campus-recruitment-rows" data-density={mode}>{items.map((item) => {
    const href = campusDiscoveryHref('recruitments', query, item.id);
    const facts = <p>{item.content.headcount} 人 · {item.content.beginner_friendly ? "零基础友好" : "不接受零基础"}</p>;
    return <li className="ie-draft-row" key={item.id}><div className="ie-draft-copy"><Heading className="section-title"><Link href={href}>{item.content.role_name}</Link></Heading><p>{item.content.project_title} · {item.content.direction} · {item.content.stage}</p><p className="ie-draft-excerpt">{item.content.duties}</p>{mode === 'feed' ? facts : null}<RecruitmentDeadline value={item.content.deadline_at} /><p className="field-hint campus-recruitment-disclaimer">负责人独立发布，免审，未经成果核实</p></div>{mode === 'directory' ? <div className="campus-recruitment-facts">{facts}<Link className="btn btn-secondary" href={href}>查看岗位</Link></div> : null}</li>;
  })}</ul>;
}
function RecruitmentDetail({ id, query }: { id: string; query: string }) {
  const { state, retry } = useSection(() => getPublicRecruitment(id));
  const backHref = campusDiscoveryHref('recruitments', query);
  if (state.status === "loading") return <><Link className="section-link campus-discovery-back" href={backHref}><DiscoveryArrow direction="left" />返回招募列表</Link><h1 className="page-title">招募岗位</h1><SectionSkeleton /></>;
  if (state.status === "error") return <><Link className="section-link campus-discovery-back" href={backHref}><DiscoveryArrow direction="left" />返回招募列表</Link><h1 className="page-title">招募岗位</h1><PublicResourceError error={state.error} retry={retry} /></>;
  const item = state.data; const content = item.content;
  return <article className="section ie-recruitment-public" aria-label="校内招募详情">
    <Link className="section-link campus-discovery-back" href={backHref}><DiscoveryArrow direction="left" />返回招募列表</Link><header className="campus-role-heading"><p className="campus-role-status">正在招募</p><h1 className="page-title">{content.role_name}</h1><p className="field-hint">负责人独立发布，免审，未经成果核实</p></header>
    <DividedSections className="campus-role-reading">
      <section className="section campus-role-facts" aria-label="岗位信息"><h2 className="campus-role-facts-title">岗位信息</h2><dl><div><dt>招募人数</dt><dd><strong>{content.headcount}</strong> 人</dd></div><div><dt>参与基础</dt><dd>{content.beginner_friendly ? "零基础友好" : "不接受零基础"}</dd></div><RecruitmentDeadline value={content.deadline_at} mode="fact" /></dl></section>
      <div className="campus-role-copy"><section className="section" aria-label="招募项目介绍"><h2 className="section-title"><Link href={`/innovation/projects/${item.project_id}`}>{content.project_title}<DiscoveryArrow /></Link></h2><p className="field-hint">{content.direction} · {content.idea_stage && content.stage !== "创意起步" ? `创意起步（${content.stage}）` : content.stage}</p><p className="ie-review-prose">{content.introduction}</p>{content.idea_stage ? <><h3 className="section-title">阶段目标</h3><p className="ie-review-prose">{content.goal}</p><h3 className="section-title">初步方案</h3><p className="ie-review-prose">{content.initial_plan}</p></> : null}</section>
        {([["主要职责", content.duties], ["能力要求", content.requirements], ["时间投入", content.time_commitment]] as const).map(([label, value]) => <section className="section" key={label}><h2 className="section-title">{label}</h2><p className="ie-review-prose">{value}</p></section>)}
      </div>
      <RecruitmentContacts key={item.revision_number} item={item} />
    </DividedSections>
  </article>;
}
function RecruitmentDeadline({ value, mode = "inline" }: { value: string | null; mode?: "inline" | "fact" }) {
  const content = value ? <><time dateTime={value}>{recruitmentDateTime(value)}</time>（{BUSINESS_TIME_CONFIG.timeZone}）</> : <>无截止日期 · 负责人每 30 天收到确认提醒</>;
  return mode === "fact" ? <div className="campus-role-deadline"><dt>截止时间</dt><dd>{content}</dd></div> : <p className="field-hint">{value ? "截止：" : null}{content}</p>;
}

export function PublicResourceError({ error, retry }: { error: unknown; retry: () => void }) {
  return isApiError(error) && error.status === 404 ? <p className="alert alert-error" role="alert">内容不存在或已停止校内展示，请返回列表查看当前有效内容。</p> : <SectionError error={error} onRetry={retry} />;
}
