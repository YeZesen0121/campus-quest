"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BoundedTextarea } from "@/components/ui/bounded-textarea";
import { EmptyState, SectionError, SectionHeading, SectionSkeleton } from "@/components/ui/sectionStates";
import { useSection } from "@/components/ui/useSection";
import { AuthField } from "@/features/auth/AuthField";
import { SubmitButton } from "@/features/auth/SubmitButton";
import { useSession } from "@/features/auth/session";
import { getAuthEpoch } from "@/lib/accessToken";
import { PrivateHeader } from "./PrivateWorkspace";
import { formatDeadlineDateTime } from "@/lib/time";
import { ProjectMentorManagement } from './mentors/ProjectMentors';

import { createProjectDraft, getProjectDraft, listProjectDrafts, updateProjectDraft, type DraftFields, type ProjectDraftDto } from "./api";
import {
  codePointCount, describeDraftSaveError, draftFields, DRAFT_FIELDS, EMPTY_DRAFT_FIELDS,
  normalizeDraftFields, sameDraftFields, validateDraftFields,
  type DraftFieldErrors, type DraftSaveError,
} from "./draftForm";

const PAGE_SIZE = 20;
const EDITOR_FIELDS = (["title", "direction", "stage", "summary", "team_status"] as const).map(key => DRAFT_FIELDS.find(field => field.key === key)!);

export function ProjectDraftsView() {
  const { state } = useSession();
  if (state.status !== "authenticated") return null;
  if (state.me.role !== "STUDENT" || state.me.status !== "ACTIVE") {
    return <><ProjectHeader /><p className="alert alert-warning" role="alert">仅正常状态的学生账号可以管理自己的项目草稿。</p></>;
  }
  // Account transitions discard all private form/list state; the key is never DOM text.
  return <DraftWorkspace key={`${state.me.id}:${getAuthEpoch()}`} />;
}

function DraftWorkspace() {
  const [selected, setSelected] = useState<string | null | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  if (selected !== undefined) {
    return selected === null ? (
      <ProjectDraftEditor onBack={() => setSelected(undefined)} />
    ) : (
      <DraftLoader key={selected} id={selected} onBack={() => setSelected(undefined)} />
    );
  }
  return (
    <>
    <ProjectHeader />
    <section className="section campus-private-list" aria-label="项目草稿列表">
      <SectionHeading title="本人保存的项目概况" action={<Button onClick={() => setSelected(null)}>新建项目草稿</Button>} />
      <DraftList key={offset} offset={offset} onPage={setOffset} onEdit={setSelected} />
    </section></>
  );
}

function ProjectHeader() { return <PrivateHeader title="我的项目" subtitle="先记录项目概况，再分别管理成果与招募。草稿仅自己可见。" current="projects" />; }

function DraftList({ offset, onPage, onEdit }: { offset: number; onPage: (offset: number) => void; onEdit: (id: string) => void }) {
  // No shared cache: private records cannot survive a workspace/account remount.
  const { state, retry } = useSection(() => listProjectDrafts({ limit: PAGE_SIZE, offset }));
  if (state.status === "loading") return <div role="status" aria-label="正在加载项目草稿"><SectionSkeleton /></div>;
  if (state.status === "error") return <SectionError error={state.error} onRetry={retry} />;
  const page = state.data;
  return (
    <>
      {page.items.length === 0 ? (
        <EmptyState title="还没有项目草稿" hint="从一个名称开始，把你想推进的项目记下来。" />
      ) : (
        <ul className="ie-draft-list">
          {page.items.map((draft) => (
            <li className="ie-draft-row" key={draft.id}>
              <div className="ie-draft-copy">
                <h3 className="section-title">{draft.title}</h3>
                {draft.summary ? <p className="ie-draft-excerpt">{draft.summary}</p> : <p className="field-hint">简介待补充</p>}
                <p className="field-hint">私有草稿 · 更新于 <time dateTime={draft.updated_at}>{formatDeadlineDateTime(Date.parse(draft.updated_at))}</time></p>
              </div>
              <div className="ie-draft-actions"><Button variant="secondary" onClick={() => onEdit(draft.id)} aria-label={`编辑项目：${draft.title}`}>编辑</Button><Link href={`/profile/collaboration/projects/${draft.id}`}>协作与交接</Link></div>
            </li>
          ))}
        </ul>
      )}
      {page.total <= PAGE_SIZE && offset === 0 ? <p className="campus-private-total">共 {page.total} 份私有草稿</p> : null}
      {page.total > PAGE_SIZE || offset > 0 ? (
        <nav className="ie-draft-actions" aria-label="项目草稿分页">
          <Button variant="secondary" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - PAGE_SIZE))}>上一页</Button>
          <span className="field-hint">第 {Math.floor(offset / PAGE_SIZE) + 1} 页 · 共 {page.total} 份</span>
          <Button variant="secondary" disabled={offset + PAGE_SIZE >= page.total} onClick={() => onPage(offset + PAGE_SIZE)}>下一页</Button>
        </nav>
      ) : null}
    </>
  );
}

function DraftLoader({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, retry } = useSection(() => getProjectDraft(id));
  if (state.status === "loading") return <><ProjectHeader /><div role="status" aria-label="正在读取项目草稿"><SectionSkeleton /></div></>;
  if (state.status === "error") return <><ProjectHeader /><section className="section"><SectionError error={state.error} onRetry={retry} /><Button variant="secondary" onClick={onBack}>返回草稿列表</Button></section></>;
  return <ProjectDraftEditor initialDraft={state.data} onBack={onBack} />;
}

function ProjectDraftEditor({ initialDraft, onBack }: { initialDraft?: ProjectDraftDto; onBack: () => void }) {
  const [record, setRecord] = useState(initialDraft ?? null);
  const [fields, setFields] = useState<DraftFields>(initialDraft ? draftFields(initialDraft) : EMPTY_DRAFT_FIELDS);
  const [fieldErrors, setFieldErrors] = useState<DraftFieldErrors>({});
  const [saveError, setSaveError] = useState<DraftSaveError | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [remote, setRemote] = useState<ProjectDraftDto | null>(null);
  const requestId = useRef<string | null>(null);
  const active = useRef(false);
  const epoch = useRef(getAuthEpoch());
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = !sameDraftFields(fields, record ? draftFields(record) : EMPTY_DRAFT_FIELDS);

  useEffect(() => {
    active.current = true;
    headingRef.current?.focus();
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function current() { return active.current && epoch.current === getAuthEpoch(); }

  function back() {
    if (!dirty || window.confirm("当前内容尚未保存，确定返回草稿列表吗？")) onBack();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !current() || saveError?.reload) return;
    setSaved(false);
    const errors = validateDraftFields(fields);
    setFieldErrors(errors);
    setSaveError(null);
    const first = EDITOR_FIELDS.find(({ key }) => errors[key]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const values = normalizeDraftFields(fields);
      // Keep this UUID on every retry, including after an unknown network outcome.
      requestId.current ??= crypto.randomUUID();
      const result = record
        ? await updateProjectDraft(record.id, values, record.version)
        : await createProjectDraft(values, requestId.current);
      if (!current()) return;
      if ('ownership' in result) {
        setSaveError({message: '原创建请求已完成，但项目已转交。当前账号不再具有项目管理权，请到协作与交接查看结果。', requestId: null, reload: false});
        return;
      }
      setRecord(result);
      setFields(draftFields(result));
      setSaved(true);
      setRemote(null);
    } catch (error) {
      if (current()) setSaveError(describeDraftSaveError(error));
    } finally {
      if (current()) setBusy(false);
    }
  }

  async function readLatest() {
    if (!record || busy || !current()) return;
    setBusy(true);
    try {
      const result = await getProjectDraft(record.id);
      if (current()) setRemote(result);
    } catch (error) {
      if (current()) setSaveError({ ...describeDraftSaveError(error), reload: true });
    } finally {
      if (current()) setBusy(false);
    }
  }

  return (
    <section className="section campus-project-editor" aria-label="项目草稿编辑器">
      <PrivateHeader title={record ? "编辑项目草稿" : "新建项目草稿"} subtitle="保存项目概况不会自动对外公开。" current="projects" headingRef={headingRef} back={<Button variant="ghost" onClick={back} disabled={busy}><span aria-hidden="true">← </span>返回草稿列表</Button>} onCurrent={() => { if (!busy) back(); }} onLeave={() => !busy && (!dirty || window.confirm("项目有未保存的修改，确定离开吗？"))} />
      <div className="campus-private-context"><span className="campus-private-state">私有草稿</span>
      {record ? <Link href={`/profile/project-drafts/${record.id}/achievements`} onClick={(event) => {
        if (busy || (dirty && !window.confirm("项目有未保存的修改，确定进入成果草稿吗？"))) event.preventDefault();
      }}>管理成果草稿</Link> : null}
      {record ? <Link href={`/profile/project-drafts/${record.id}/recruitments`} onClick={(event) => {
        if (busy || (dirty && !window.confirm("项目有未保存的修改，确定进入招募管理吗？"))) event.preventDefault();
      }}>招募管理</Link> : null}
      </div>
      <form className="panel form ie-draft-form" method="post" onSubmit={onSubmit} noValidate ref={formRef}>
        <div className="campus-project-fields">{EDITOR_FIELDS.map((field) => {
          const count = codePointCount(fields[field.key].trim());
          const error = fieldErrors[field.key];
          if (field.rows === 1) return (
            <AuthField key={field.key} name={field.key} label={field.label} hint={`${field.hint} 最多 ${field.limit} 个字符。`} counter={`${count}/${field.limit}`} counterOver={count > field.limit} error={error}
              inputProps={{ value: fields[field.key], type: "text", required: field.key === "title", disabled: busy, onChange: (event) => { setFields({ ...fields, [field.key]: event.target.value }); setSaved(false); } }} />
          );
          return (
            <div className="field campus-private-wide" key={field.key}>
              <div className="field-head">
                <label className="field-label" htmlFor={field.key}>{field.label}</label>
                <span className="field-counter" data-over={count > field.limit ? "true" : undefined}>{count}/{field.limit}</span>
              </div>
              <BoundedTextarea className="input ie-draft-textarea" id={field.key} name={field.key} rows={field.key === "summary" ? 3 : 2} value={fields[field.key]} disabled={busy}
                aria-invalid={error ? true : undefined} aria-describedby={`${field.key}-hint${error ? ` ${field.key}-error` : ""}`}
                onChange={(event) => { setFields({ ...fields, [field.key]: event.target.value }); setSaved(false); }} />
              <p className="field-hint" id={`${field.key}-hint`}>{field.hint} 最多 {field.limit} 个字符。</p>
              {error ? <p className="field-error" id={`${field.key}-error`}>{error}</p> : null}
            </div>
          );
        })}</div>
        {saveError ? (
          <div className="alert alert-error" role="alert">
            <p>{saveError.message}</p>
            {saveError.requestId ? <p className="req-id">请求 ID：{saveError.requestId}</p> : null}
            {saveError.reload && record ? <Button variant="secondary" onClick={() => void readLatest()} disabled={busy}>读取最新版本（保留当前输入）</Button> : null}
          </div>
        ) : null}
        <p className="field-hint" role="status" aria-label="项目草稿保存状态">
          {busy ? "正在保存或读取，请稍候…" : saved ? "草稿已保存，仅自己可见。" : dirty ? "有未保存的修改。" : record ? "当前内容已保存。" : "尚未保存。"}
        </p>
        <div className="ie-draft-actions"><SubmitButton block={false} loading={busy} disabled={saveError?.reload === true}>保存草稿</SubmitButton><Button variant="secondary" onClick={back} disabled={busy}>返回列表</Button></div>
      </form>
      {record ? <ProjectMentorManagement key={record.id} projectId={record.id} invitationBlockedReason={busy ? "请等待项目保存或读取完成，再发起挂名。" : saveError ? "请先处理项目保存问题，核对最新资料后再发起挂名。" : dirty ? "请先保存项目修改，再发起挂名。" : undefined}/> : null}
      {remote ? (
        <section className="panel ie-draft-remote" aria-label="最新已保存版本">
          <h3 className="section-title">最新已保存版本</h3>
          <p className="field-hint">上方输入仍保留。请先复制你要保留的内容，再决定是否载入下列版本。</p>
          <dl>
            {DRAFT_FIELDS.map(({ key, label }) => <div key={key}><dt className="field-label">{label}</dt><dd>{remote[key] || "未填写"}</dd></div>)}
          </dl>
          <Button variant="secondary" onClick={() => {
            setRecord(remote); setFields(draftFields(remote)); setRemote(null); setSaveError(null); setFieldErrors({}); setSaved(false);
            headingRef.current?.focus();
          }}>载入此版本（替换当前输入）</Button>
        </section>
      ) : null}
    </section>
  );
}
