"use client";
/**
 * Teacher community moderation for one task (spec §21.4/§23; brief step 4).
 *
 * PRIVACY BY CONSTRUCTION (the binding constraint): every rendered
 * comment row goes through `moderationRowView` — the single choke point
 * whose shape carries ONLY display fields. An anonymous row renders
 * 匿名用户 plus the PSEUDONYMOUS moderation key; no student number,
 * phone, email, or login identifier has any field to land in.
 *
 * The ADMIN identity reveal (plan Task 10 step 2) lives HERE, in the
 * community-governance context, as its own explicit dialog: the
 * 揭示身份 action renders only for an ADMIN session's anonymous rows,
 * opens `RevealIdentityDialog` (reason mandatory), and identity renders
 * only from the reveal API's response — the comment listing never
 * auto-fetches identities, for teachers or admins alike.
 *
 * The moderation delete is reason-mandatory (spec §21.4): the dialog
 * blocks on a blank reason exactly like the transport does. Reporter
 * nickname/id ride the report rows — the §23 moderator surface — and go
 * no further than this section.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useDialogReturnFocus } from "@/components/ui/useDialogReturnFocus";
import { getAuthEpoch } from "@/lib/accessToken";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  SectionError,
  SectionSkeleton,
} from "@/components/ui/sectionStates";
import { useSession } from "@/features/auth/session";
import { DividedSections } from "@/components/ui/dividedSections";
import { hasMorePages, mergeOffsetPage } from "@/lib/offsetPages";
import { formatDeadlineDateTime, parseServerInstant } from "@/lib/time";

import { RevealIdentityDialog } from "./RevealIdentityDialog";
import {
  listModerationComments,
  listTaskReports,
  moderateDeleteComment,
  type ModerationCommentDto,
  type ModerationReportDto,
} from "./teacherApi";
import {
  moderationRowView,
  reportStatusView,
  type ModerationRowView,
} from "./teacherView";

const PAGE_LIMIT = 20;

export function CommunityModeration({ taskId }: { taskId: string }) {
  // The reveal affordance is role-scoped (spec §21.4 Admin-only); the
  // backend's `require_admin_actor` stays the authority — this only
  // keeps the button off teacher screens.
  const { state } = useSession();
  const canReveal =
    state.status === "authenticated" && state.me.role === "ADMIN";

  return (
    <section className="section campus-teacher-community" aria-label="社区与举报" id="teacher-community">
      <div className="section-head">
        <h2 className="section-title">评论与举报</h2>
      </div>
      <DividedSections className="workbench-columns">
        <ModerationComments taskId={taskId} canReveal={canReveal} />
        <ReportQueue taskId={taskId} />
      </DividedSections>
    </section>
  );
}
import { Button } from "@/components/ui/button";

// --- moderation comment listing -------------------------------------------------------

function ModerationComments({
  taskId,
  canReveal,
}: {
  taskId: string;
  canReveal: boolean;
}) {
  const [items, setItems] = useState<ModerationCommentDto[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [deleting, setDeleting] = useState<ModerationRowView | null>(null);
  const [revealing, setRevealing] = useState<ModerationRowView | null>(null);
  const commentScope = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listModerationComments(taskId, { limit: PAGE_LIMIT }).then(
      (page) => {
        if (!cancelled) {
          setItems(page.items);
          setTotal(page.total);
          setPhase("ready");
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(cause);
          setPhase("error");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadSeed]);

  const loadMore = useCallback(async () => {
    if (loadingMore) {
      return;
    }
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listModerationComments(taskId, {
        limit: PAGE_LIMIT,
        offset: items.length,
      });
      setItems((previous) => mergeOffsetPage(previous, page.items, (row) => row.id));
      setTotal(page.total);
    } catch (cause) {
      setMoreError(cause);
    } finally {
      setLoadingMore(false);
    }
  }, [taskId, items.length, loadingMore]);

  /** After a moderation delete, refetch page one (the row's flags change server-side). */
  const onDeleted = useCallback(() => {
    setDeleting(null);
    setPhase("loading");
    setReloadSeed((seed) => seed + 1);
  }, []);

  return (
    <div className="panel moderation-panel" role="region" aria-label="评论管理列表" ref={commentScope} tabIndex={-1}>
      <h3 className="section-title">评论管理</h3>
      <p className="field-hint">
        匿名评论仅显示化名标识，不会自动加载身份信息。教师端不提供身份揭示；管理员须另行操作。
      </p>
      {phase === "loading" ? (
        <SectionSkeleton lines={4} />
      ) : phase === "error" ? (
        <SectionError
          error={error}
          onRetry={() => {
            setPhase("loading");
            setReloadSeed((seed) => seed + 1);
          }}
          retryLabel="重新加载"
        />
      ) : items.length === 0 ? (
        <EmptyState title="暂无评论" hint="该任务下还没有评论" />
      ) : (
        <>
          <ul className="moderation-list">
            {items.map((comment) => {
              const row = moderationRowView(comment, parseServerInstant);
              return (
                <ModerationRow
                  key={row.id}
                  row={row}
                  canReveal={canReveal}
                  onDelete={() => setDeleting(row)}
                  onReveal={() => setRevealing(row)}
                />
              );
            })}
          </ul>
          {hasMorePages(items.length, total) ? (
            <div className="load-more">
              <Button
                variant="secondary"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                aria-busy={loadingMore}
              >
                {loadingMore ? <span className="spinner" aria-hidden="true" /> : null}
                <span>
                  加载更多评论（{items.length}/{total}）
                </span>
              </Button>
              {moreError !== null ? (
                <SectionError error={moreError} onRetry={() => void loadMore()} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {deleting !== null ? (
        <ModerationDeleteDialog row={deleting} onDone={onDeleted} onCancel={() => setDeleting(null)} fallbackFocus={() => commentScope.current} />
      ) : null}
      {revealing !== null ? (
        <RevealIdentityDialog
          commentId={revealing.id}
          authorDisplay={revealing.authorDisplay}
          onCancel={() => setRevealing(null)}
        />
      ) : null}
    </div>
  );
}

function ModerationRow({
  row,
  canReveal,
  onDelete,
  onReveal,
}: {
  row: ModerationRowView;
  canReveal: boolean;
  onDelete: () => void;
  onReveal: () => void;
}) {
  return (
    <li className="moderation-item" data-deleted={row.deleted ? "true" : "false"}>
      <div className="campus-moderation-heading">
      <div className="comment-meta">
        <span className="comment-author">{row.authorDisplay}</span>
        {row.isAnonymous ? <span className="badge badge-info">匿名</span> : null}
        {row.deleted ? <span className="badge badge-warning">已删除</span> : null}
        {row.hardHidden ? <span className="badge badge-danger">已隐藏</span> : null}
        {row.edited ? <span className="comment-edited">已编辑</span> : null}
        <time className="notif-time" dateTime={new Date(row.createdAtMs).toISOString()}>
          {formatDeadlineDateTime(row.createdAtMs)}
        </time>
      </div>
      <div className="comment-actions">
        {canReveal && row.isAnonymous ? (
          <Button variant="ghost" className="comment-action" onClick={onReveal}>
            揭示身份
          </Button>
        ) : null}
        {!row.deleted ? (
          <Button variant="ghost" className="comment-action" onClick={onDelete}>
            删除评论
          </Button>
        ) : null}
      </div>
      </div>
        {row.moderationKey !== null ? (
          <span className="mono moderation-key" title="匿名追溯键（非身份信息）">
            {row.moderationKey}
          </span>
        ) : null}

      {row.content !== null ? (
        <p className="comment-content">{row.content}</p>
      ) : (
        <p className="comment-content">该评论已删除</p>
      )}
    </li>
  );
}

/** Reason-mandatory moderation delete (spec §21.4; audited server-side). */
function ModerationDeleteDialog({
  row,
  onDone,
  onCancel,
  fallbackFocus,
}: {
  row: ModerationRowView;
  onDone: () => void;
  onCancel: () => void;
  fallbackFocus: () => HTMLElement | null;
}) {
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const dialogFocus = useDialogReturnFocus(getAuthEpoch, fallbackFocus);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (reason.trim().length === 0) {
      setFieldError("删除原因必填（将记入审计日志）");
      return;
    }
    setFieldError(null);
    setBusy(true);
    try {
      await moderateDeleteComment(row.id, reason.trim());
      onDone();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) {
          onCancel();
        }
      }}
    >
      <DialogContent
        {...dialogFocus}
        asChild
        aria-labelledby="moderation-delete-title"
        onPointerDownOutside={(event) => {
          // The legacy dialog had no backdrop-click close.
          event.preventDefault();
        }}
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle id="moderation-delete-title">删除评论</DialogTitle>
          <p className="report-target">
            {row.authorDisplay} 的评论将以删除状态保留（学生端显示为已删除）；删除原因必填并记入审计日志。
          </p>
          <div className="field">
            <label className="field-label" htmlFor="moderation-reason">
              删除原因
            </label>
            <textarea
              id="moderation-reason"
              className="input"
              rows={3}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (fieldError !== null) {
                  setFieldError(null);
                }
              }}
              aria-invalid={fieldError !== null}
              disabled={busy}
              required
            />
            {fieldError !== null ? <p className="field-error">{fieldError}</p> : null}
          </div>
          {error !== null ? <SectionError error={error} /> : null}
          <DialogFooter>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              取消
            </Button>
            <Button type="submit" variant="danger" disabled={busy} aria-busy={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>确认删除</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- report queue ----------------------------------------------------------------------

function ReportQueue({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<ModerationReportDto[]>([]);
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [reloadSeed, setReloadSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listTaskReports(taskId, { limit: PAGE_LIMIT }).then(
      (page) => {
        if (!cancelled) {
          setItems(page.items);
          setTotal(page.total);
          setPhase("ready");
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(cause);
          setPhase("error");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadSeed]);

  const loadMore = useCallback(async () => {
    if (loadingMore) {
      return;
    }
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listTaskReports(taskId, {
        limit: PAGE_LIMIT,
        offset: items.length,
      });
      setItems((previous) => mergeOffsetPage(previous, page.items, (row) => row.id));
      setTotal(page.total);
    } catch (cause) {
      setMoreError(cause);
    } finally {
      setLoadingMore(false);
    }
  }, [taskId, items.length, loadingMore]);

  return (
    <div className="panel moderation-panel">
      <h3 className="section-title">举报队列</h3>
      {phase === "loading" ? (
        <SectionSkeleton lines={4} />
      ) : phase === "error" ? (
        <SectionError
          error={error}
          onRetry={() => {
            setPhase("loading");
            setReloadSeed((seed) => seed + 1);
          }}
          retryLabel="重新加载"
        />
      ) : items.length === 0 ? (
        <EmptyState title="暂无举报" hint="学生提交的举报会出现在这里" />
      ) : (
        <>
          <ul className="moderation-list">
            {items.map((report) => (
              <ReportRow key={report.id} report={report} />
            ))}
          </ul>
          {hasMorePages(items.length, total) ? (
            <div className="load-more">
              <Button
                variant="secondary"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                aria-busy={loadingMore}
              >
                {loadingMore ? <span className="spinner" aria-hidden="true" /> : null}
                <span>
                  加载更多举报（{items.length}/{total}）
                </span>
              </Button>
              {moreError !== null ? (
                <SectionError error={moreError} onRetry={() => void loadMore()} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReportRow({ report }: { report: ModerationReportDto }) {
  const status = reportStatusView(report.status);
  const comment = moderationRowView(report.comment, parseServerInstant);
  return (
    <li className="moderation-item">
      <div className="comment-meta">
        <span className={`badge badge-${status.tone}`}>{status.label}</span>
        <span className="comment-type">{report.category}</span>
        <time className="notif-time" dateTime={new Date(comment.createdAtMs).toISOString()}>
          {formatDeadlineDateTime(comment.createdAtMs)}
        </time>
      </div>
      <p className="comment-content">
        {comment.content !== null ? comment.content : "该评论已删除"}
      </p>
      <p className="report-meta">
        举报人：{report.reporter_nickname ?? "—"}
        {report.note !== null ? ` · 备注：${report.note}` : ""}
      </p>    </li>
  );
}
