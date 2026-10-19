"use client";
/**
 * Teacher workbench task detail (spec §41; patterns §8): the full
 * contract view (everything the owner configured, DRAFT readable) plus
 * the four management surfaces the brief pins — assignment import
 * (preview -> confirm -> refetch statistics), statistics (real rating
 * adapter values), collaborators, and community moderation.
 *
 * Access-denied UX (design §10): an unknown or unshared task answers
 * NOT_FOUND/PERMISSION_DENIED — both render the same explain-and-return
 * panel instead of a page of failing sections (the brief's
 * "another Teacher's unshared Task" case). Everything else keeps the
 * §10 triad per section.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SectionError, SectionSkeleton } from "@/components/ui/sectionStates";
import { isApiError } from "@/lib/errors";
import { formatDeadlineDateTime, parseServerInstant } from "@/lib/time";
import { formatFileSize } from "@/features/submissions/api";
import { rarityView } from "@/features/tasks/display";

import { getTeacherTask, type TaskTransitionDto, type TeacherTaskDto } from "./teacherApi";
import { taskEditable, taskStatusView, TASK_NOTIFICATION_CHANNEL_OPTIONS } from "./teacherView";
import { TaskLifecycleActions } from "./TaskLifecycleActions";
import { EditTaskDialog } from "./EditTaskDialog";
import { AssignmentImport } from "./AssignmentImport";
import { CollaboratorsPanel } from "./CollaboratorsPanel";
import { CommunityModeration } from "./CommunityModeration";
import { TaskStatisticsPanel } from "./TaskStatisticsPanel";
import { Button } from "@/components/ui/button";

type DetailState =
  | { kind: "loading" }
  | { kind: "ready"; task: TeacherTaskDto }
  | { kind: "denied" }
  | { kind: "error"; error: unknown };

export function TeacherTaskDetailView({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ kind: "loading" });
  const [reloadSeed, setReloadSeed] = useState(0);
  const [statsSeed, setStatsSeed] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    // The effect only STARTS the fetch (the island rule): refetches after
    // a lifecycle verdict keep the previous detail visible until the
    // answer lands; `retry` re-enters loading as an event handler.
    let cancelled = false;
    getTeacherTask(taskId).then(
      (task) => {
        if (!cancelled) {
          setState({ kind: "ready", task });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          if (isApiError(error) && isAccessDenied(error.code)) {
            setState({ kind: "denied" });
          } else {
            setState({ kind: "error", error });
          }
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadSeed]);

  /** A lifecycle verdict re-reads the detail (contract fields freeze at publish). */
  const onTransitioned = useCallback(
    (transition: TaskTransitionDto) => {
      if (transition.status === "ARCHIVED") {
        // Archived tasks leave the workbench; back to the list.
        router.push("/teacher/tasks");
        return;
      }
      setReloadSeed((seed) => seed + 1);
    },
    [router],
  );

  /** A confirmed import bumps the statistics reload seed (patterns §3 boundary). */
  const onImported = useCallback(() => {
    setStatsSeed((seed) => seed + 1);
  }, []);

  if (state.kind === "loading") {
    return <SectionSkeleton lines={6} />;
  }
  if (state.kind === "denied") {
    return (
      <div className="alert alert-error" role="alert">
        <p>
          <span className="alert-marker" aria-hidden="true">!</span>
          任务不存在，或您不是该任务的所有者 / 协作者，无法访问。
        </p>
        <p>
          <Link className="link" href="/teacher/tasks">
            返回任务管理
          </Link>
        </p>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <SectionError
        error={state.error}
        onRetry={() => {
          setState({ kind: "loading" });
          setReloadSeed((seed) => seed + 1);
        }}
        retryLabel="重新加载"
      />
    );
  }

  const { task } = state;
  const status = taskStatusView(task.status);
  const rarity = rarityView(task.rarity);
  const createdMs = parseServerInstant(task.created_at);

  return (
    <div className="campus-teacher-task">
      <Link className="campus-staff-back" href="/teacher/tasks"><span aria-hidden="true">← </span>返回任务管理</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{task.title}</h1>
          <p className="page-subtitle">任务配置、参与情况与协作管理。</p>
        </div>
        <div className="campus-staff-heading-row">
          <p className="task-detail-badges">
            <span className={`badge badge-${status.tone}`}>{status.label}</span>
            <span className="rarity-badge" data-rarity={rarity.rarity}>
              {rarity.label}
            </span>
            <span className="page-subtitle">创建于 {formatDeadlineDateTime(createdMs)}</span>
          </p>
        <div className="dialog-actions">
          {taskEditable(task.status) ? (
            <Button
              variant="secondary"
              onClick={() => setEditOpen(true)}
            >
              编辑
            </Button>
          ) : null}
          <TaskLifecycleActions
            taskId={task.id}
            status={task.status}
            onTransitioned={onTransitioned}
          />
        </div>
        </div>
      </div>

      <nav className="campus-staff-tabs" aria-label="任务管理章节">
        <a href="#teacher-configuration">配置</a><a href="#teacher-statistics">统计</a><a href="#teacher-assignments">任务单元</a><a href="#teacher-collaborators">协作者</a><a href="#teacher-community">社区治理</a>
      </nav>

      <section className="section campus-teacher-configuration" aria-label="任务配置" id="teacher-configuration">
        <div className="section-head">
          <h2 className="section-title">任务配置</h2>
        </div>
        <p className="task-description">{task.description}</p>
        <dl className="fact-rows">
          <div className="fact-row">
            <dt className="fact-label">基础奖励积分</dt>
            <dd className="fact-value meta-num">{task.base_reward_points}</dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">截止模式</dt>
            <dd className="fact-value">
              {task.deadline_mode === "RELATIVE"
                ? `领取后计时（${task.duration_minutes ?? "—"} 分钟）`
                : task.fixed_deadline_at !== null
                  ? formatDeadlineDateTime(parseServerInstant(task.fixed_deadline_at))
                  : "固定截止（未设置）"}
            </dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">领取截止</dt>
            <dd className="fact-value">{task.deadline_mode === "FIXED" ? `固定截止前 ${task.claim_cutoff_minutes} 分钟停止新领取` : "按领取时限计时，不使用固定截止领取窗口"}</dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">宽限期</dt>
            <dd className="fact-value">{task.grace_period_minutes} 分钟</dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">允许文件类型</dt>
            <dd className="fact-value mono">{task.allowed_file_types.join("、") || "—"}</dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">单文件上限</dt>
            <dd className="fact-value">{formatFileSize(task.max_file_size_bytes)}</dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">提交校验 schema</dt>
            <dd className="fact-value mono">
              {task.submission_schema !== null ? <details className="campus-task-schema"><summary>查看校验规则 · v{task.submission_schema_version ?? "—"}</summary><pre>{JSON.stringify(task.submission_schema, null, 2)}</pre></details> : "未配置（发布前必填）"}
            </dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">截止提醒</dt>
            <dd className="fact-value">24 小时：{task.notify_24h ? "开启" : "关闭"}；4 小时：{task.notify_4h ? "开启" : "关闭"}</dd>
          </div>
          <div className="fact-row">
            <dt className="fact-label">通知渠道</dt>
            <dd className="fact-value">{task.notification_channels.map((channel) => TASK_NOTIFICATION_CHANNEL_OPTIONS.find((option) => option.value === channel)?.label ?? channel).join("、") || "未选择通知渠道"}</dd>
          </div>
          {task.published_at !== null ? (
            <div className="fact-row">
              <dt className="fact-label">发布时间</dt>
              <dd className="fact-value">
                {formatDeadlineDateTime(parseServerInstant(task.published_at))}
              </dd>
            </div>
          ) : null}
          {task.closed_at !== null ? (
            <div className="fact-row">
              <dt className="fact-label">关闭时间</dt>
              <dd className="fact-value">
                {formatDeadlineDateTime(parseServerInstant(task.closed_at))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {editOpen ? (
        <EditTaskDialog
          task={task}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            setEditOpen(false);
            setReloadSeed((seed) => seed + 1);
          }}
        />
      ) : null}

      <TaskStatisticsPanel taskId={task.id} reloadSeed={statsSeed} />
      <AssignmentImport taskId={task.id} onImported={onImported} />
      <CollaboratorsPanel taskId={task.id} />
      <CommunityModeration taskId={task.id} />
    </div>
  );
}

function isAccessDenied(code: string): boolean {
  return code === "NOT_FOUND" || code === "PERMISSION_DENIED";
}
