"use client";
/**
 * RewardsAdmin — the reward-catalogue page (spec §16; plan Task 10
 * step 3/4): catalogue management (create / partial edit of
 * cost/stock/term-limit/time-window / disable) plus the REWARD_REVIEW
 * grant lifecycle (W3's scoped delegation, reason mandatory both ways).
 *
 * The existing admin catalogue lists enabled and disabled rows with
 * server offset pagination. Decisions still replace rows with server
 * verdicts; refresh reads the same authorized management surface.
 *
 * Edit discipline: use the authorized catalogue's known values and a
 * diff-only PATCH. Explicit null clears a held nullable value; untouched
 * values stay absent. Review policy remains create-only in this UI.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { formatDeadlineDateTime, parseServerInstant } from "@/lib/time";
import { hasMorePages, mergeOffsetPage } from "@/lib/offsetPages";
import { toDatetimeLocalValue } from "./teacherView";

import {
  createRewardItem,
  disableRewardItem,
  grantRewardReview,
  listAdminRewardItems,
  revokeRewardReview,
  updateRewardItem,
  type AdminRewardItemDto,
} from "./adminApi";
import {
  adminReasonReady,
  describeAdminMutationError,
  EMPTY_REWARD_FORM,
  rewardFormFromCatalogue,
  rewardFormToCreateBody,
  rewardFormToUpdateBody,
  rewardWindowText,
  type RewardEditSource,
  type RewardFormErrors,
  type RewardFormValues,
} from "./adminView";

export function RewardsAdmin({ heading }: { heading: ReactNode }) {
  return (
    <>
      <RewardCatalogue heading={heading} />
      <ReviewGrants />
    </>
  );
}

// --- catalogue -----------------------------------------------------------------------------

type Row = { source: "catalogue" | "verdict"; row: AdminRewardItemDto };
const CATALOGUE_PAGE_LIMIT = 20;

function rowId(row: Row): string {
  return row.row.id;
}
import { Button } from "@/components/ui/button";

function RewardCatalogue({ heading }: { heading: ReactNode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<unknown>(null);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const readEpoch = useRef(0);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RewardEditSource | null>(null);
  const [disabling, setDisabling] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const epoch = ++readEpoch.current;
    listAdminRewardItems({ limit: CATALOGUE_PAGE_LIMIT }).then(
      (page) => {
        if (!cancelled && epoch === readEpoch.current) {
          setRows(page.items.map((row) => ({ source: "catalogue", row }) as Row));
          setTotal(page.total);
          setMoreError(null);
          setLoadingMore(false);
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
      readEpoch.current += 1;
    };
  }, [reloadSeed]);

  /** Replace a row with its admin VERDICT (patterns §3 — server state at boundaries). */
  const onVerdict = useCallback((verdict: AdminRewardItemDto) => {
    setEditing(null);
    setDisabling(null);
    setRows((previous) =>
      previous.map((entry) => (rowId(entry) === verdict.id ? { source: "verdict", row: verdict } : entry)),
    );
    setPhase("loading");
    setReloadSeed((seed) => seed + 1);
  }, []);

  const onCreated = useCallback(() => {
    setCreating(false);
    setPhase("loading");
    setReloadSeed((seed) => seed + 1);
  }, []);

  async function loadMore() {
    if (loadingMore || phase !== "ready") return;
    const epoch = readEpoch.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listAdminRewardItems({ limit: CATALOGUE_PAGE_LIMIT, offset: rows.length });
      if (epoch !== readEpoch.current) return;
      setRows((previous) => mergeOffsetPage(previous, page.items.map((row) => ({ source: "catalogue", row }) as Row), rowId));
      setTotal(page.total);
    } catch (cause) {
      if (epoch === readEpoch.current) setMoreError(cause);
    } finally {
      if (epoch === readEpoch.current) setLoadingMore(false);
    }
  }

  return (
    <section className="section" aria-label="奖励目录" data-admin-return="rewards" tabIndex={-1}>
      <div className="section-head campus-admin-rewards-heading">
        {heading}
        <div className="row-actions">
          <Button
            variant="ghost"
            onClick={() => {
              setPhase("loading");
              setReloadSeed((seed) => seed + 1);
            }}
          >
            刷新
          </Button>
          <Button
            variant="primary"
            onClick={() => setCreating(true)}
          >
            新建奖励
          </Button>
        </div>
      </div>

      {phase === "loading" ? (
        <SectionSkeleton lines={6} />
      ) : phase === "error" ? (
        <SectionError
          error={error}
          onRetry={() => {
            setPhase("loading");
            setReloadSeed((seed) => seed + 1);
          }}
          retryLabel="重新加载"
        />
      ) : rows.length === 0 ? (
        <EmptyState title="目录为空" hint="点击「新建奖励」创建第一个兑换奖励" />
      ) : (
        <div className="table-scroll">
          <table className="staff-table" aria-label="奖励目录列表">
            <thead>
              <tr>
                <th scope="col">名称</th>
                <th scope="col">积分</th>
                <th scope="col">库存</th>
                <th scope="col">学期限购</th>
                <th scope="col">可用时间窗</th>
                <th scope="col" className="cq-status-cell">状态</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <CatalogueRow
                  key={rowId(entry)}
                  entry={entry}
                  windowText={rewardWindowText(
                    entry.row,
                    (iso) => formatDeadlineDateTime(parseServerInstant(iso)),
                  )}
                  onEdit={() => setEditing(entry.row)}
                  onDisable={() =>
                    setDisabling({ id: entry.row.id, name: entry.row.name })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {phase === "ready" ? <p className="list-footer">共 {total} 项奖励，已显示 {rows.length} 项</p> : null}
      {phase === "ready" && hasMorePages(rows.length, total) ? (
        <div className="load-more">
          <Button variant="secondary" disabled={loadingMore} aria-busy={loadingMore} onClick={() => void loadMore()}>加载更多（{rows.length}/{total}）</Button>
          {moreError !== null ? <SectionError error={moreError} onRetry={() => void loadMore()} /> : null}
        </div>
      ) : null}

      <p className="field-hint">
        管理目录包含上架与下架项目。
        积分/库存/限购/时间窗的调整只影响之后的兑换请求，已创建的兑换保持原快照。
      </p>
      {creating ? (
        <RewardFormDialog
          title="新建奖励"
          submitLabel="创建奖励"
          initial={EMPTY_REWARD_FORM}
          showCreateFields={true}
          onDone={onCreated}
          onCancel={() => setCreating(false)}
        />
      ) : null}
      {editing !== null ? (
        <RewardFormDialog
          title={`编辑奖励：${editing.name}`}
          submitLabel="保存修改"
          initial={rewardFormFromCatalogue(editing, toDatetimeLocalValue)}
          showCreateFields={false}
          row={editing}
          onDone={onVerdict}
          onCancel={() => setEditing(null)}
        />
      ) : null}      {disabling !== null ? (
        <DisableRewardDialog
          target={disabling}
          onDone={onVerdict}
          onCancel={() => setDisabling(null)}
        />
      ) : null}
    </section>
  );
}

function CatalogueRow({
  entry,
  windowText,
  onEdit,
  onDisable,
}: {
  entry: Row;
  windowText: string;
  onEdit: () => void;
  onDisable: () => void;
}) {
  const row = entry.row;
  const enabled = row.enabled;
  const stock = row.stock === null ? "不限" : String(row.stock);
  const limit = row.per_user_term_limit === null ? "不限" : String(row.per_user_term_limit);
  return (
    <tr>
      <td className="staff-cell-title" data-label="名称">{row.name}</td>
      <td className="meta-num" data-label="积分">{row.point_cost}</td>
      <td className="meta-num" data-label="库存">{stock}</td>
      <td className="meta-num" data-label="学期限购">{limit}</td>
      <td data-label="可用时间窗">{windowText}</td>
      <td className="cq-status-cell" data-label="状态">
        <span className={`badge badge-${enabled ? "success" : "muted"}`}>
          {enabled ? "上架" : "已下架"}
        </span>
      </td>
      <td data-label="操作">
        <div className="row-actions">
          <Button variant="secondary" onClick={onEdit}>
            编辑
          </Button>
          {enabled ? (
            <Button variant="danger" onClick={onDisable}>
              下架
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

/** Shared create/edit dialog (field set differs; reason mandatory both ways). */
function RewardFormDialog({
  title,
  submitLabel,
  initial,
  showCreateFields,
  row,
  onDone,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  initial: RewardFormValues;
  /** Create manages description-bounds + instructions + review flag; edit does not. */
  showCreateFields: boolean;
  row?: RewardEditSource;
  onDone: (verdict: AdminRewardItemDto) => void;
  onCancel: () => void;
}) {
  const dialogFocus = useDialogReturnFocus(getAuthEpoch, () => document.querySelector<HTMLElement>('[data-admin-return="rewards"]'));
  const [values, setValues] = useState<RewardFormValues>(initial);
  const [errors, setErrors] = useState<RewardFormErrors>({});
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof RewardFormValues>(key: K, value: RewardFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!adminReasonReady(values.reason)) {
      setReasonError("操作原因必填（将记入审计日志）");
      return;
    }
    setReasonError(null);
    if (row === undefined) {
      const result = rewardFormToCreateBody(values);
      setErrors(result.errors);
      if (!result.ok || result.body === undefined) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        onDone(await createRewardItem(result.body));
      } catch (cause) {
        setError(cause);
      } finally {
        setBusy(false);
      }
      return;
    }
    const result = rewardFormToUpdateBody(values, row);
    setErrors(result.errors);
    if (!result.ok || result.body === undefined) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onDone(await updateRewardItem(row.id, result.body));
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const errorView =
    error !== null
      ? describeAdminMutationError(error, "保存失败，请稍后重试")
      : null;

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
        asChild
        size="wide"
        aria-labelledby="reward-form-title"
        onPointerDownOutside={(event) => {
          // The legacy dialog had no backdrop-click close.
          event.preventDefault();
        }} className="campus-admin-dialog" {...dialogFocus}
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle id="reward-form-title">{title}</DialogTitle>
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="reward-name">名称</label>
              <input
                id="reward-name"
                className="input"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                aria-invalid={errors.name !== undefined}
                disabled={busy}
                required
              />
              {errors.name !== undefined ? <p className="field-error">{errors.name}</p> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reward-cost">兑换积分</label>
              <input
                id="reward-cost"
                className="input"
                inputMode="numeric"
                value={values.pointCost}
                onChange={(event) => set("pointCost", event.target.value)}
                aria-invalid={errors.pointCost !== undefined}
                disabled={busy}
                required
              />
              {errors.pointCost !== undefined ? (
                <p className="field-error">{errors.pointCost}</p>
              ) : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reward-stock">库存（留空 = 不限）</label>
              <input
                id="reward-stock"
                className="input"
                inputMode="numeric"
                value={values.stock}
                onChange={(event) => set("stock", event.target.value)}
                aria-invalid={errors.stock !== undefined}
                disabled={busy}
              />
              {errors.stock !== undefined ? <p className="field-error">{errors.stock}</p> : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reward-term-limit">
                学期限购（留空 = 不限）
              </label>
              <input
                id="reward-term-limit"
                className="input"
                inputMode="numeric"
                value={values.perUserTermLimit}
                onChange={(event) => set("perUserTermLimit", event.target.value)}
                aria-invalid={errors.perUserTermLimit !== undefined}
                disabled={busy}
              />
              {errors.perUserTermLimit !== undefined ? (
                <p className="field-error">{errors.perUserTermLimit}</p>
              ) : null}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reward-from">可用起（留空 = 不限）</label>
              <input
                id="reward-from"
                className="input"
                type="datetime-local"
                value={values.availableFromLocal}
                onChange={(event) => set("availableFromLocal", event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reward-until">可用止（留空 = 不限）</label>
              <input
                id="reward-until"
                className="input"
                type="datetime-local"
                value={values.availableUntilLocal}
                onChange={(event) => set("availableUntilLocal", event.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          {errors.window !== undefined ? <p className="field-error">{errors.window}</p> : null}
              <div className="field">
                <label className="field-label" htmlFor="reward-description">描述（选填）</label>
                <textarea
                  id="reward-description"
                  className="input"
                  rows={2}
                  value={values.description}
                  onChange={(event) => set("description", event.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="reward-instructions">
                  发放说明（选填，学生兑换后可见）
                </label>
                <textarea
                  id="reward-instructions"
                  className="input"
                  rows={2}
                  value={values.fulfillmentInstructions}
                  onChange={(event) => set("fulfillmentInstructions", event.target.value)}
                  disabled={busy}
                />
              </div>
            {showCreateFields ? (
              <div className="field">
                <label className="field-hint">
                  <input
                    type="checkbox"
                    checked={values.requiresManualReview}
                    onChange={(event) => set("requiresManualReview", event.target.checked)}
                    disabled={busy}
                  />{" "}
                  需要人工审核兑换
                </label>
              </div>
            ) : <p className="field-hint">编辑保留未改动字段；兑换审核规则沿用原设定，不在这里调整。</p>}
          <div className="field">
            <label className="field-label" htmlFor="reward-reason">操作原因</label>
            <textarea
              id="reward-reason"
              className="input"
              rows={2}
              value={values.reason}
              onChange={(event) => {
                set("reason", event.target.value);
                if (reasonError !== null) {
                  setReasonError(null);
                }
              }}
              aria-invalid={reasonError !== null}
              disabled={busy}
              required
            />
            {reasonError !== null ? <p className="field-error">{reasonError}</p> : null}
          </div>
          {errorView !== null ? (
            <div className="alert alert-error" role="alert">
              <p>
                <span className="alert-marker" aria-hidden="true">!</span>
                {errorView.message}
              </p>
              {errorView.requestId !== null ? (
                <p className="req-id">请求 ID：{errorView.requestId}</p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              取消
            </Button>
            <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>{submitLabel}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** 下架 — the dedicated, reason-requiring transition (idempotent replay server-side). */
function DisableRewardDialog({
  target,
  onDone,
  onCancel,
}: {
  target: { id: string; name: string };
  onDone: (verdict: AdminRewardItemDto) => void;
  onCancel: () => void;
}) {
  const dialogFocus = useDialogReturnFocus(getAuthEpoch, () => document.querySelector<HTMLElement>('[data-admin-return="rewards"]'));
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (!adminReasonReady(reason)) {
      setFieldError("下架原因必填（将记入审计日志）");
      return;
    }
    setFieldError(null);
    setBusy(true);
    setError(null);
    try {
      onDone(await disableRewardItem(target.id, reason.trim()));
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const errorView =
    error !== null
      ? describeAdminMutationError(error, "下架失败，请稍后重试")
      : null;

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
        asChild
        aria-labelledby="reward-disable-title"
        onPointerDownOutside={(event) => {
          // The legacy dialog had no backdrop-click close.
          event.preventDefault();
        }} className="campus-admin-dialog" {...dialogFocus}
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle id="reward-disable-title">下架奖励</DialogTitle>
          <p className="report-target">
            下架后「{target.name}」不再对学生可见、不能发起新兑换；已创建的兑换保持原快照并继续处理。
            下架原因必填并记入审计日志。
          </p>
          <div className="field">
            <label className="field-label" htmlFor="reward-disable-reason">下架原因</label>
            <textarea
              id="reward-disable-reason"
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
          {errorView !== null ? (
            <div className="alert alert-error" role="alert">
              <p>
                <span className="alert-marker" aria-hidden="true">!</span>
                {errorView.message}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={onCancel} disabled={busy}>
              取消
            </Button>
            <Button type="submit" variant="danger" disabled={busy} aria-busy={busy}>
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              <span>确认下架</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- review grants (W3 scoped delegation) --------------------------------------------------

function ReviewGrants() {
  return (
    <section className="section" aria-label="审阅授权管理">
      <div className="section-head">
        <h2 className="section-title">兑换审阅授权</h2>
      </div>
      <p className="field-hint">
        按教师用户 ID 授予或撤销全局兑换审阅权限，撤销立即生效。
      </p>
      <GrantForm />
    </section>
  );
}

function GrantForm() {
  const [mode, setMode] = useState<"grant" | "revoke">("grant");
  const [teacherId, setTeacherId] = useState("");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) {
      return;
    }
    if (teacherId.trim().length === 0) {
      setFieldError("请填写教师的用户 ID");
      return;
    }
    if (!adminReasonReady(reason)) {
      setFieldError("操作原因必填（将记入审计日志）");
      return;
    }
    setFieldError(null);
    setBusy(true);
    setError(null);
    try {
      if (mode === "grant") {
        await grantRewardReview(teacherId.trim(), reason.trim());
      } else {
        await revokeRewardReview(teacherId.trim(), reason.trim());
      }
      setDone(true);
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }

  const errorView =
    error !== null
      ? describeAdminMutationError(
          error,
          mode === "grant" ? "授权失败，请稍后重试" : "撤销失败，请稍后重试",
        )
      : null;

  return (
    <form className="campus-admin-review-grant" onSubmit={onSubmit} noValidate>
      <div className="campus-admin-review-grant-grid">
      <div className="field">
        <label className="field-label" htmlFor={`grant-teacher-${mode}`}>
          教师用户 ID
        </label>
        <input
          id={`grant-teacher-${mode}`}
          className="input mono"
          value={teacherId}
          onChange={(event) => {
            setTeacherId(event.target.value);
            if (fieldError !== null) {
              setFieldError(null);
            }
          }}
          aria-invalid={fieldError !== null}
          disabled={busy || done}
          placeholder="00000000-0000-0000-0000-000000000000"
          required
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="reward-grant-mode">授权操作</label>
        <select id="reward-grant-mode" className="input" value={mode} disabled={busy || done} onChange={event => {
          setMode(event.target.value as "grant" | "revoke");
          setFieldError(null);
          setError(null);
        }}>
          <option value="grant">授予审阅权限</option>
          <option value="revoke">撤销审阅权限</option>
        </select>
      </div>
      <div className="field campus-admin-review-grant-reason">
        <label className="field-label" htmlFor={`grant-reason-${mode}`}>
          操作原因
        </label>
        <textarea
          id={`grant-reason-${mode}`}
          className="input"
          rows={2}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (fieldError !== null) {
              setFieldError(null);
            }
          }}
          aria-invalid={fieldError !== null}
          disabled={busy || done}
          required
        />
        <p className="field-hint">将写入审计日志。</p>
        {fieldError !== null ? <p className="field-error">{fieldError}</p> : null}
      </div>
      </div>
      {done ? (
        <div className="alert alert-success" role="status">
          <p>
            {mode === "grant" ? "已授予审阅权限。" : "已撤销审阅权限。"}
            可在审计日志中核对操作记录。
          </p>
        </div>
      ) : null}
      {errorView !== null ? (
        <div className="alert alert-error" role="alert">
          <p>
            <span className="alert-marker" aria-hidden="true">!</span>
            {errorView.message}
          </p>
          {errorView.requestId !== null ? (
            <p className="req-id">请求 ID：{errorView.requestId}</p>
          ) : null}
        </div>
      ) : null}
      <div className="dialog-actions">
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || done}
          aria-busy={busy}
        >
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          <span>确认操作</span>
        </Button>
        {done ? (
          <Button
            variant="secondary"
            onClick={() => {
              setTeacherId("");
              setReason("");
              setDone(false);
            }}
          >
            再操作一次
          </Button>
        ) : null}
      </div>
    </form>
  );
}
