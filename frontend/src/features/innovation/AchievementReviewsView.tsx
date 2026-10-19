"use client";
import { useRef, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DividedSections } from "@/components/ui/dividedSections";
import { EmptyState, SectionError, SectionSkeleton } from "@/components/ui/sectionStates";
import { useSection } from "@/components/ui/useSection";
import { useSession } from "@/features/auth/session";
import { getAuthEpoch } from "@/lib/accessToken";
import { isApiError } from "@/lib/errors";
import { formatDeadlineDateTime, parseServerInstant } from "@/lib/time";
import { getInnovationCapabilities } from "./operationsApi";
import { restoreReviewFocus } from "./reviewFocus";
import { claimReview, declareConflict, decideReview, getReviewDetail, listReviewQueue, readReviewEvidence, saveProofBlob, type DecisionCommand, type ReviewDetailDto, type ReviewItemDto } from "./reviewApi";
import { reviewError } from "./reviewPresentation";
import { ReviewConfirm } from "./ReviewConfirm";

function ReviewPageHeading({ action }: { action?: ReactNode }) {
  return <div className="page-head campus-review-page-head"><div className="campus-review-heading-row"><h1 className="page-title">成果核实待办</h1>{action}</div><p className="page-subtitle">核对已提交的内容，给出清楚的处理结果。</p></div>;
}
export function AchievementReviewsView() {
  const { state } = useSession();
  if (state.status !== "authenticated" || state.me.role !== "STUDENT" || state.me.status !== "ACTIVE") return <ReviewPageHeading />;
  return <OperationsScope key={`${state.me.id}:${getAuthEpoch()}`} />;
}
function OperationsScope() {
  const { state, retry } = useSection(getInnovationCapabilities);
  if (state.status === "loading") return <><ReviewPageHeading /><SectionSkeleton /></>;
  if (state.status === "error") return <><ReviewPageHeading /><SectionError error={state.error} onRetry={retry} /></>;
  if (!state.data.operations_enabled) return <><ReviewPageHeading /><p className="alert alert-warning" role="alert">尚未获管理员指定的双创运营授权。</p></>;
  return <Queue />;
}
function Queue() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  if (selected) return <><ReviewPageHeading /><Detail key={selected} id={selected} onBack={() => setSelected(null)} /></>;
  return <QueuePage key={offset} offset={offset} onPage={setOffset} onSelect={setSelected} />;
}
function QueuePage({ offset, onPage, onSelect }: { offset: number; onPage: (value: number) => void; onSelect: (id: string) => void }) {
  const focusRef = useRef<HTMLElement>(null);
  const { state, retry } = useSection(() => listReviewQueue(offset));
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [conflict, setConflict] = useState<ReviewItemDto | null>(null);
  const active = useRef(false); const epoch = useRef(getAuthEpoch());
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function current() { return active.current && epoch.current === getAuthEpoch(); }
  async function act(item: ReviewItemDto, avoid: boolean) {
    if (busy || !current()) return; setBusy(true); setError("");
    try {
      if (avoid) await declareConflict(item.id, item.version); else await claimReview(item.id, item.version);
      if (current()) { if (!avoid) onSelect(item.id); setConflict(null); retry(); }
    } catch (cause) { if (current()) { setError(reviewError(cause)); retry(); } }
    finally { if (current()) setBusy(false); }
  }
  return <><ReviewPageHeading action={<Button variant="secondary" disabled={busy} onClick={retry}>重新读取待办</Button>} /><section className="section campus-achievement-review-queue" aria-label="成果核实待办" ref={focusRef} tabIndex={-1}>
    <p className="field-hint campus-review-restriction" role="note">领取后才可查看负责人资料与证明。当前和历史负责人、已接受共管、成员、挂名导师及实际查阅交接证明者须回避；其他利益冲突请主动声明。新增参与关系会释放原领取，交由其他无冲突运营处理；暂无合适运营时请联系管理员安排。</p>
    <div className="section-head"><p className="list-count">{state.status === "ready" ? `共 ${state.data.total} 份待办 · 每页 20 份` : ""}</p></div>
    {state.status === "loading" ? <SectionSkeleton /> : state.status === "error" ? <SectionError error={state.error} onRetry={retry} /> : <>
      {state.data.items.length ? <><div className="campus-review-queue-header" aria-hidden="true"><span>成果 / 项目</span><span>核实类型</span><span className="campus-review-state">状态</span><span>提交时间</span><span>操作</span></div><ul className="ie-draft-list campus-review-queue-rows">{state.data.items.map((item) => <li className="ie-draft-row" key={item.id}>
        <div className="ie-draft-copy"><h2 className="section-title">{item.achievement_title}</h2><p>{item.project_title}</p></div>
        <p className="campus-review-operation" data-operation={item.operation}>{item.operation === "UPDATE" ? "更新复审" : "首次核实"}</p><p className="campus-review-state">{item.claimed_by_me ? "已由你领取" : "待领取"}</p><time className="campus-review-submitted" dateTime={item.submitted_at}>{formatDeadlineDateTime(parseServerInstant(item.submitted_at))}</time>
        <div className="ie-draft-actions"><Button disabled={busy} onClick={() => item.claimed_by_me ? onSelect(item.id) : void act(item, false)}>{item.claimed_by_me ? "查看核实快照" : "领取并核实"}</Button><Button variant="secondary" disabled={busy} aria-label={`声明回避：${item.achievement_title}`} onClick={() => setConflict(item)}>声明利益冲突</Button></div>
      </li>)}</ul></> : <EmptyState title="暂无可领取的成果" hint="已完成的审核单不再出现在待办中。" />}
      <nav className="ie-draft-actions" aria-label="核实待办分页"><Button variant="secondary" disabled={busy || !offset} onClick={() => onPage(Math.max(0, offset - 20))}>上一页</Button><span className="field-hint">共 {state.data.total} 份 · 第 {Math.floor(offset / 20) + 1} 页</span><Button variant="secondary" disabled={busy || offset + 20 >= state.data.total} onClick={() => onPage(offset + 20)}>下一页</Button></nav>
    </>}
    {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
    <ReviewConfirm fallbackFocus={() => focusRef.current} open={Boolean(conflict)} busy={busy} title="声明利益冲突并回避" description="你将不能领取或继续审核该项目的成果；当前领取会释放，其他无冲突运营可继续处理。" onClose={() => setConflict(null)} onConfirm={() => { if (conflict) void act(conflict, true); }} />
  </section><p className="campus-review-maintenance-link"><Link href="/innovation/operations/mentors">导师资料维护</Link></p></>;
}
function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, retry } = useSection(() => getReviewDetail(id));
  if (state.status === "loading") return <SectionSkeleton />;
  if (state.status === "error") return <><SectionError error={state.error} onRetry={retry} /><p className="field-hint">若参与关系发生变化，请停止核实并返回待办。释放后的事项由其他无冲突运营处理；暂无合适运营时请联系管理员安排。</p><Button variant="secondary" onClick={onBack}>返回核实待办</Button></>;
  return <ReviewEditor id={id} detail={state.data} onReload={retry} onBack={onBack} />;
}
function ReviewEditor({ id, detail, onReload, onBack }: { id: string; detail: ReviewDetailDto; onReload: () => void; onBack: () => void }) {
  const updateReview = detail.case.operation === "UPDATE";
  const approvalLabel = updateReview ? "通过更新复审" : "通过首次核实";
  const focusRef = useRef<HTMLElement>(null);
  const retryFocusRef = useRef<HTMLButtonElement>(null);
  const retryOpener = useRef<{ element: HTMLElement; epoch: number } | null>(null);
  const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"APPROVED" | "RETURNED" | null>(null);
  const [outcome, setOutcome] = useState(""); const [uncertain, setUncertain] = useState(false);
  useLayoutEffect(() => {
    if (!busy && retryOpener.current) {
      restoreReviewFocus(retryOpener.current, retryFocusRef.current ?? focusRef.current, getAuthEpoch());
      retryOpener.current = null;
    }
  }, [busy, uncertain]);
  const pending = useRef<DecisionCommand | null>(null);
  const active = useRef(false); const epoch = useRef(getAuthEpoch());
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function current() { return active.current && epoch.current === getAuthEpoch(); }
  async function decision(kind: "APPROVED" | "RETURNED") {
    if (busy || !current()) return;
    if (kind === "RETURNED" && !reason.trim()) { setError("退回必须填写原因。"); setConfirm(null); return; }
    setBusy(true); setError("");
    pending.current ??= { request_id: crypto.randomUUID(), version: detail.case.version, revision_id: detail.case.revision_id, decision: kind, reason: reason.trim() };
    try {
      const result = await decideReview(id, pending.current);
      if (current()) { setOutcome(result.status === "APPROVED" ? "核实通过，公开版本已更新；已下架成果仍保持下架。" : updateReview ? "更新已退回，旧通过版本及原公开状态保持不变；负责人可修改重交。" : "已退回，负责人可查看原因并修改重交。"); pending.current = null; setUncertain(false); }
    } catch (cause) {
      if (current()) { setError(reviewError(cause)); if (!isApiError(cause) || cause.status >= 500) setUncertain(true); else { pending.current = null; setUncertain(false); } }
    } finally { if (current()) { setBusy(false); setConfirm(null); } }
  }
  async function download(evidence: string) {
    if (busy || !current()) return; setBusy(true); setError("");
    try { const file = await readReviewEvidence(id, evidence); if (current()) saveProofBlob(file); }
    catch (cause) { if (current()) setError(reviewError(cause)); }
    finally { if (current()) setBusy(false); }
  }
  if (outcome) return <section className="section" aria-label="核实处理结果" ref={focusRef} tabIndex={-1}><p className="alert alert-success" role="status">{outcome}</p><Button onClick={onBack}>返回核实待办</Button></section>;
  return <section className="section campus-achievement-review-editor" aria-label="成果核实快照" ref={focusRef} tabIndex={-1}>
    <Button variant="ghost" className="campus-staff-back" disabled={busy} onClick={onBack}><span aria-hidden="true">← </span>返回核实待办</Button>
    <div className="page-head"><h1 className="page-title">{detail.achievement_content.title}</h1><p className="page-subtitle">{detail.project_content.title}</p></div>
    <div className="campus-review-snapshot-meta"><span className="badge badge-info">{updateReview ? "更新复审" : "首次核实"}</span><span className="field-hint">{{ SUBMITTED: "待核实", WITHDRAWN: "已撤回", APPROVED: "已通过", RETURNED: "已退回" }[detail.case.status]}</span></div>
    <p className="field-hint">此处为提交时的不可变版本。资料和证明仅用于本次核实，请勿向无权限人员传播。</p>
    <p className="alert">{updateReview ? "更新复审：通过后才替换公开版本；退回保留旧通过版本。" : "首次核实：通过后该版本向校内登录用户公开。"}</p>
    <DividedSections className="campus-review-content">
      <ContentFields title="已提交项目概况" content={detail.project_content} labels={{ title: "项目名称", summary: "项目简介", direction: "研究方向", stage: "项目阶段", team_status: "团队情况" }} />
      <ContentFields title="已提交成果内容" content={detail.achievement_content} labels={{ title: "成果名称", description: "作品与阶段成果说明", award_text: "立项或获奖说明", work_url: "作品链接" }} />
    </DividedSections>
    <DividedSections className="campus-review-private">
      <ContentFields title="核实用负责人资料" content={detail.owner_profile} labels={{ name: "姓名", student_no: "学号", major: "专业", grade: "年级" }} />
      <section className="campus-review-proofs"><h2 className="section-title">提交证明</h2><ul className="campus-review-proof-list">{detail.evidence.map((evidence, index) => <li key={evidence}><div><p>核实证明 {index + 1}</p><p className="field-hint">本次提交的固定材料</p></div><Button variant="secondary" aria-label={`下载核实证明 ${index + 1}`} disabled={busy || uncertain} onClick={() => void download(evidence)}>下载</Button></li>)}</ul><p className="field-hint">仅供本次核实，不能进入公开版本。</p></section>
    </DividedSections>
    <section className="campus-review-decision-section"><h2 className="section-title">核实决定</h2><DividedSections className="campus-review-decision">
    <div className="field"><label className="field-label" htmlFor="review-reason">核实备注／退回原因</label><textarea className="input ie-draft-textarea" id="review-reason" rows={4} maxLength={1000} value={reason} disabled={busy || uncertain} onChange={(event) => setReason(event.target.value)} aria-describedby="review-reason-hint" /><p id="review-reason-hint" className="field-hint">退回须说明具体修改要求，最多 1000 字；负责人将收到结果通知。</p></div>
    <div className="campus-review-decision-actions"><p className="field-hint">通过后公开项目概况与成果内容；私密证明和负责人资料仅供核实。已有公开版本在更新通过前保持原状态。</p>
    {error ? <p className="alert alert-error" role="alert">{error}</p> : null}
    <div className="ie-draft-actions"><Button disabled={busy || uncertain} onClick={() => setConfirm("APPROVED")}>{approvalLabel}</Button><Button variant="secondary" disabled={busy || uncertain} onClick={() => setConfirm("RETURNED")}>退回修改</Button><Button variant="ghost" disabled={busy || uncertain} onClick={onReload}>重新读取核实快照</Button>{uncertain ? <Button ref={retryFocusRef} disabled={busy} onClick={(event) => { retryOpener.current = { element: event.currentTarget, epoch: getAuthEpoch() }; void decision(pending.current!.decision); }}>确认上次决定结果（沿用原请求）</Button> : null}</div>
    </div></DividedSections></section>
    <ReviewConfirm fallbackFocus={() => retryFocusRef.current ?? focusRef.current} open={Boolean(confirm)} busy={busy} title={confirm === "RETURNED" ? "退回成果修改" : approvalLabel} description={confirm === "RETURNED" ? "该提交版本不会公开；已有公开版本保持不变。负责人将看到退回原因，并可以修改后重新提交。" : "确认材料与已提交内容一致。通过后仅公开项目概况与成果内容，私密证明及负责人资料不会进入公开版本；已下架成果保持下架。"} onClose={() => setConfirm(null)} onConfirm={() => { if (confirm) void decision(confirm); }} />
  </section>;
}
function ContentFields({ title, content, labels }: { title: string; content: Record<string, string>; labels: Record<string, string> }) {
  return <section className="campus-review-facts" aria-label={title}><h2 className="section-title">{title}</h2><dl>{Object.entries(labels).map(([key, label]) => <div key={key}><dt className="field-label">{label}</dt><dd>{content[key] || "未填写"}</dd></div>)}</dl></section>;
}
