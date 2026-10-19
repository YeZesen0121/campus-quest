"use client";
import { DiscoveryArrow } from "./PublicDiscoveryFrame";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionError, SectionSkeleton } from "@/components/ui/sectionStates";
import { useSection } from "@/components/ui/useSection";
import { useSession } from "@/features/auth/session";
import { getAuthEpoch } from "@/lib/accessToken";
import { BUSINESS_TIME_CONFIG, formatPublicationDateTime, parseServerInstant } from "@/lib/time";
import { validWorkLink } from "./achievementForm";
import { getPublicAchievement, listPublicAchievements, type PublicAchievementDto } from "./reviewApi";
import { publicReviewText } from "./reviewPresentation";
export { CampusShell as CampusAchievementShell } from './CampusShell';
export function PublicAchievementsView({ id, compact = false }: { id?: string; compact?: boolean }) {
  const { state } = useSession();
  if (state.status !== "authenticated" || state.me.status !== "ACTIVE") return null;
  return id ? <PublicDetail key={`${state.me.id}:${getAuthEpoch()}:${id}`} id={id} /> : <PublicList key={`${state.me.id}:${getAuthEpoch()}`} compact={compact} canManage={state.me.role === "STUDENT"} />;
}
function PublicList({ compact, canManage }: { compact: boolean; canManage: boolean }) {
  const [offset, setOffset] = useState(0);
  return <PublicPage key={offset} offset={offset} onPage={setOffset} compact={compact} canManage={canManage} />;
}
function PublicPage({ offset, onPage, compact, canManage }: { offset: number; onPage: (value: number) => void; compact: boolean; canManage: boolean }) {
  const { state, retry } = useSection(() => listPublicAchievements(offset));
  return <section className="section campus-achievements" data-density={compact ? "feed" : "directory"} aria-label="校内已核实成果">
    {compact ? <><div className="section-head"><h2 className="section-title">校内成果</h2><Link href="/innovation/achievements" aria-label="浏览全部成果">浏览全部<DiscoveryArrow /></Link></div><p className="field-hint">通过核实的成果版本，保留每次实践留下的记录。</p></> : null}
    {!compact ? <div className="campus-achievement-toolbar">{state.status === "ready" ? <p className="field-hint">已核实的公开版本 · {state.data.total} 份成果</p> : null}{canManage ? <Link className="section-link" href="/profile/project-drafts">管理我的项目 <DiscoveryArrow /></Link> : null}</div> : null}
    {state.status === "loading" ? <SectionSkeleton /> : state.status === "error" ? <SectionError error={state.error} onRetry={retry} /> : <>
    {state.data.items.length ? <ul className="ie-draft-list ie-discovery-list">{(compact ? state.data.items.slice(0, 3) : state.data.items).map((item) => <li className="ie-draft-row" key={item.id}><div className="ie-draft-copy"><AchievementTitle item={item} compact={compact} /><p>{item.project.title} · {item.project.stage}</p><p className="ie-draft-excerpt">{item.achievement.description}</p><PublicationSummary item={item} compact={compact} /></div></li>)}</ul> : <EmptyState title="暂无可浏览的成果" hint="首次核实通过的成果将在这里展示。" />}
    {!compact ? <nav className="ie-draft-actions" aria-label="校内成果分页"><Button variant="secondary" disabled={!offset} onClick={() => onPage(Math.max(0, offset - 20))}>上一页</Button><span className="field-hint">第 {Math.floor(offset / 20) + 1} 页 · 共 {state.data.total} 份</span><Button variant="secondary" disabled={offset + 20 >= state.data.total} onClick={() => onPage(offset + 20)}>下一页</Button></nav> : null}</>}
  </section>;
}
function AchievementTitle({ item, compact }: { item: PublicAchievementDto; compact: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return <Heading className="section-title"><Link href={`/innovation/achievements/${item.id}`}>{item.achievement.title}<DiscoveryArrow /></Link></Heading>;
}
function PublicationSummary({item,compact}:{item:PublicAchievementDto;compact:boolean}) {
  const instant=item.latest_reviewed_at??(item.updated_after_first_review?item.updated_at:item.first_approved_at);
  const legacy=item.updated_after_first_review&&!item.latest_reviewed_at;
  const date=new Intl.DateTimeFormat(BUSINESS_TIME_CONFIG.locale,{timeZone:BUSINESS_TIME_CONFIG.timeZone,year:'numeric',month:'long',day:'numeric'}).format(new Date(parseServerInstant(instant)));
  const status=legacy?publicReviewText(item):item.updated_after_first_review?'更新复审通过':'首次核实通过';
  return compact?<div className="campus-achievement-feed-date"><p className="field-hint">{legacy?'最近发布：':'本版核实：'}<time dateTime={instant}>{date}</time></p>{legacy?<p className="field-hint">{status}</p>:null}</div>:<div className="campus-achievement-card-status"><span className="campus-achievement-review-tag" title={publicReviewText(item)}>{status}</span><time dateTime={instant} title={formatPublicationDateTime(parseServerInstant(instant))}>{date}</time></div>;
}
function PublicDetail({ id }: { id: string }) {
  const { state, retry } = useSection(() => getPublicAchievement(id));
  if (state.status === "loading") return <SectionSkeleton />;
  if (state.status === "error") return <SectionError error={state.error} onRetry={retry} />;
  const item = state.data;
  return <article className="section" aria-label="校内成果详情"><header className="campus-public-detail-heading"><h1 className="page-title">{item.achievement.title}</h1></header><PublicationDates item={item} /><div className="campus-achievement-reading"><div className="campus-achievement-main"><section className="section" aria-label="作品与阶段成果"><h2 className="section-title">作品与阶段成果</h2><p className="ie-review-prose">{item.achievement.description}</p>
</section><section className="section" aria-label="立项或获奖说明"><h2 className="section-title">立项或获奖说明</h2><p className="ie-review-prose">{item.achievement.award_text || "未填写"}</p></section>{validWorkLink(item.achievement.work_url)?<div className="campus-achievement-work-link"><Button asChild variant="secondary"><a href={item.achievement.work_url} target="_blank" rel="noopener noreferrer">打开公开作品链接</a></Button><p className="field-hint">由发布者填写的 HTTP / HTTPS 链接</p></div>:null}</div><aside className="campus-achievement-context"><section className="panel ie-draft-remote" aria-label="公开项目概况"><h2 className="section-title">{item.project.title}</h2><dl>{([ ["项目简介", item.project.summary], ["研究方向", item.project.direction], ["项目阶段", item.project.stage], ["团队情况", item.project.team_status] ] as const).map(([label, value]) => <div key={label}><dt className="field-label">{label}</dt><dd>{value || "未填写"}</dd></div>)}</dl></section><p className="field-hint">展示已通过核实的成果版本及其项目概况。后续修改须经更新复审后替换。</p></aside>
    </div>
  </article>;
}
function PublicationDates({ item }: { item: PublicAchievementDto }) {
  return <div className="campus-publication-dates"><p className="field-hint">首次核实：<time dateTime={item.first_approved_at}>{formatPublicationDateTime(parseServerInstant(item.first_approved_at))}</time> · {item.latest_reviewed_at ? <>本版核实：<time dateTime={item.latest_reviewed_at}>{formatPublicationDateTime(parseServerInstant(item.latest_reviewed_at))}</time></> : <>最近发布：<time dateTime={item.updated_at}>{formatPublicationDateTime(parseServerInstant(item.updated_at))}</time></>}</p><p className={item.updated_after_first_review && !item.latest_reviewed_at ? "alert" : "field-hint"}>{publicReviewText(item)}</p></div>;
}
