"use client";
import { useEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionError, SectionHeading, SectionSkeleton } from "@/components/ui/sectionStates";
import { useSection } from "@/components/ui/useSection";
import { useSession } from "@/features/auth/session";
import { getAuthEpoch } from "@/lib/accessToken";
import { isApiError } from "@/lib/errors";
import { getProjectDraft } from "./api";
import { getOwnerQualification } from "./qualificationApi";
import { getRecruitment, listRecruitments, type RecruitmentDto } from "./recruitmentApi";
import { CONTACT_LABELS, recruitmentDateTime, recruitmentStatusText } from "./recruitmentPresentation";
import { PrivateHeader } from "./PrivateWorkspace";
import { RecruitmentEditor, type RecruitmentOverviewIntent } from "./RecruitmentEditor";
import { getPendingRecruitment } from "./recruitmentPending";
import type { RecruitmentProjectDefaults } from "./recruitmentForm";
import { getRecruitmentRecovery } from "./recruitmentRecovery";

export function RecruitmentWorkspace({ projectId }: { projectId: string }) {
  const { state } = useSession();
  if (state.status !== "authenticated") return null;
  if (state.me.role !== "STUDENT" || state.me.status !== "ACTIVE") return <><RecruitmentHeader /><p className="alert" role="alert">仅正常状态的学生负责人可以管理本人的招募。</p></>;
  return <WorkspaceGuard key={`${state.me.id}:${getAuthEpoch()}:${projectId}`} projectId={projectId} />;
}
function RecruitmentHeader() {
  return <PrivateHeader title="我的招募" subtitle="草稿、校内发布与联系授权在这里管理。" back={<Link href="/profile/project-drafts"><span aria-hidden="true">← </span>返回我的项目</Link>} />;
}
function WorkspaceGuard({ projectId }: { projectId: string }) {
  const { state, retry } = useSection(async () => { const [project, qualification] = await Promise.all([getProjectDraft(projectId), getOwnerQualification()]); return { project, qualification }; });
  if (state.status === "loading") return <><RecruitmentHeader /><SectionSkeleton /></>;
  if (state.status === "error") return <><RecruitmentHeader /><WorkspaceError error={state.error} retry={retry} /></>;
  return <Workspace projectId={projectId} projectDefaults={state.data.project} notice={state.data.qualification.status !== "APPROVED" ? <p className="alert" role="alert">可准备草稿；发布须先<Link href="/profile/owner-profile">申请并开通负责人资格</Link>。招募独立免审，无需已有审核成果。</p> : null} />;
}

function Workspace({ projectId, projectDefaults, notice }: { projectId: string; projectDefaults: RecruitmentProjectDefaults; notice: ReactNode }) {
  const [selected, setSelected] = useState<string | null | undefined>(() => {
    const resumed = getPendingRecruitment(projectId);
    const recovered = getRecruitmentRecovery(projectId);
    return resumed ? resumed.command.id : recovered ? recovered.record?.id ?? null : undefined;
  });
  const [offset, setOffset] = useState(0);
  const [initialAction, setInitialAction] = useState<RecruitmentOverviewIntent>();
  const [returnFocus, setReturnFocus] = useState<string | null | undefined>(undefined);
  const createRef = useRef<HTMLButtonElement>(null);
  function back() { setReturnFocus(selected); setInitialAction(undefined); setSelected(undefined); }
  function openEditor(id: string | null, action?: RecruitmentOverviewIntent) { setInitialAction(action); setSelected(id); }
  if (selected !== undefined) return selected === null || getPendingRecruitment(projectId) || getRecruitmentRecovery(projectId) ? <RecruitmentEditor projectId={projectId} projectDefaults={projectDefaults} onBack={back} initialAction={initialAction} notice={notice} /> : <EditorLoader projectId={projectId} projectDefaults={projectDefaults} id={selected} onBack={back} initialAction={initialAction} notice={notice} />;
  return <><PrivateHeader title="我的招募" subtitle={projectDefaults.title} back={<Link href="/profile/project-drafts"><span aria-hidden="true">← </span>返回我的项目</Link>} />{notice}<p className="campus-private-note">草稿供本人准备；发布须具备负责人资格和当前项目权限。招募独立免审，无需先有核实成果。</p><section className="section campus-private-list" aria-label="招募岗位列表"><SectionHeading title="招募岗位" action={<Button ref={createRef} onClick={() => openEditor(null)}>新建招募岗位</Button>} /><RecruitmentList key={offset} projectId={projectId} offset={offset} onPage={(next) => { setReturnFocus(undefined); setOffset(next); }} onEdit={openEditor} onAction={openEditor} returnFocus={returnFocus} createRef={createRef} /></section></>;
}
function RecruitmentList({ projectId, offset, onPage, onEdit, onAction, returnFocus, createRef }: { projectId: string; offset: number; onPage: (offset: number) => void; onEdit: (id: string) => void; onAction: (id: string, action: RecruitmentOverviewIntent) => void; returnFocus: string | null | undefined; createRef: RefObject<HTMLButtonElement | null> }) {
  const { state, retry } = useSection(() => listRecruitments(projectId, offset));
  const editRef = useRef<HTMLButtonElement>(null);
  const [overviewId, setOverviewId] = useState(returnFocus ?? null);
  useEffect(() => { if (state.status === "ready" && returnFocus !== undefined) (editRef.current ?? createRef.current)?.focus(); }, [state.status, returnFocus, createRef]);
  if (state.status === "loading") return <SectionSkeleton />;
  if (state.status === "error") return <WorkspaceError error={state.error} retry={retry} />;
  const selected = state.data.items.find(item => item.id === overviewId) ?? state.data.items[0];
  return <>
    {state.data.items.length ? <ul className="ie-draft-list">{state.data.items.map(item => <li className="ie-draft-row" key={item.id}>
      <div className="ie-draft-copy"><h3 className="section-title"><Button variant="ghost" className="campus-recruitment-select" aria-label={`查看岗位摘要：${item.fields.role_name || "未命名岗位"}`} aria-pressed={selected?.id === item.id} aria-controls="own-recruitment-overview" onClick={() => setOverviewId(item.id)}>{item.fields.role_name || "未命名岗位"}</Button></h3><p className="field-hint">{recruitmentStatusText(item.status, item.moderation_state)}{item.has_unpublished_changes ? " · 有未发布改动" : ""}</p></div>
      <Button ref={item.id === returnFocus ? editRef : undefined} variant="secondary" aria-label={`编辑招募：${item.fields.role_name || "未命名岗位"}`} onClick={() => onEdit(item.id)}>编辑</Button>
    </li>)}</ul> : <EmptyState title="还没有招募岗位" hint="先保存草稿，再预览发布内容与联系授权。" />}
    {selected ? <RecruitmentOverview record={selected} onEdit={() => onEdit(selected.id)} onAction={action => onAction(selected.id, action)} /> : null}
    <nav className="ie-draft-actions campus-private-pagination" aria-label="本人招募分页"><Button variant="secondary" disabled={!offset} onClick={() => onPage(Math.max(0, offset - 20))}>上一页</Button><span className="field-hint">第 {Math.floor(offset / 20) + 1} 页 · 共 {state.data.total} 个</span><Button variant="secondary" disabled={offset + 20 >= state.data.total} onClick={() => onPage(offset + 20)}>下一页</Button></nav>
  </>;
}

function RecruitmentOverview({ record, onEdit, onAction }: { record: RecruitmentDto; onEdit: () => void; onAction: (action: RecruitmentOverviewIntent) => void }) {
  const available = record.moderation_state === "NORMAL", open = available && record.status === "OPEN";
  return <section className="section campus-recruitment-overview" id="own-recruitment-overview" aria-label="当前招募摘要">
    <div className="section-head"><h2 className="section-title">{record.fields.role_name || "未命名岗位"}</h2><span className="campus-private-state">{recruitmentStatusText(record.status, record.moderation_state)}</span></div>
    <div className="panel"><p className="field-hint">{!available ? "岗位已停止校内展示；维护草稿不会自动恢复展示。" : record.status === "DRAFT" ? "草稿仅自己可见。保存后仍需预览并确认发布。" : !open ? "岗位当前未开放招募，私有草稿仍可维护。" : record.has_unpublished_changes ? "已发布版本保持原内容；当前草稿改动尚未公开，请编辑后预览确认更新。" : "已发布版本与草稿分别维护；保存草稿不会自动更新公开内容。"}</p>
      <dl className="campus-private-summary-facts"><div><dt>截止时间</dt><dd>{record.deadline_at ? <time dateTime={record.deadline_at}>{recruitmentDateTime(record.deadline_at)}</time> : "无截止日期"}</dd></div>{record.next_remind_at ? <div><dt>下次提醒</dt><dd><time dateTime={record.next_remind_at}>{recruitmentDateTime(record.next_remind_at)}</time></dd></div> : null}<div><dt>联系授权</dt><dd>{record.public_contact_channels.length ? `${record.public_contact_channels.map(channel => CONTACT_LABELS[channel]).join("、")} · ${record.public_contact_channels.length} 个渠道` : "暂无当前公开渠道"}</dd></div></dl>
      <div className="ie-draft-actions"><Button variant="secondary" onClick={onEdit}>{open ? "编辑与发布更新" : "编辑草稿"}</Button>{open ? <>{!record.deadline_at ? <Button variant="secondary" onClick={() => onAction({kind:"confirm"})}>确认继续招募</Button> : null}<Button variant="secondary" onClick={() => onAction({kind:"close"})}>关闭招募</Button></> : null}{available ? record.public_contact_channels.map(channel => <Button key={channel} variant="secondary" onClick={() => onAction({kind:"revoke",channel})}>撤销{CONTACT_LABELS[channel]}授权</Button>) : null}{open ? <Button asChild variant="secondary"><Link href={`/innovation/recruitments/${record.id}`}>查看校内岗位</Link></Button> : null}</div>
    </div>
  </section>;
}

function EditorLoader({ projectId, projectDefaults, id, onBack, initialAction, notice }: { projectId: string; projectDefaults: RecruitmentProjectDefaults; id: string; onBack: () => void; initialAction?: RecruitmentOverviewIntent; notice: ReactNode }) {
  const { state, retry } = useSection(() => getRecruitment(projectId, id));
  if (state.status === "loading") return <><RecruitmentHeader /><SectionSkeleton /></>;
  if (state.status === "error") return <><RecruitmentHeader /><WorkspaceError error={state.error} retry={retry} /><Button variant="secondary" onClick={onBack}>返回招募列表</Button></>;
  return <RecruitmentEditor projectId={projectId} projectDefaults={projectDefaults} initial={state.data} onBack={onBack} initialAction={initialAction} notice={notice} />;
}
function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  return isApiError(error) && error.status === 404 ? <p className="alert alert-error" role="alert">项目不存在或不可访问，请返回我的项目查看可管理的项目。</p> : <SectionError error={error} onRetry={retry} />;
}
