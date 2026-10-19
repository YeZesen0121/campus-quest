import type { Metadata } from "next";

import { AuditLogSearch } from "@/features/admin/AuditLogSearch";

export const metadata: Metadata = {
  title: "审计日志 · CampusQuest 管理后台",
  description: "只读审计检索（按操作 / 操作者 / 目标类型过滤）",
};

/**
 * Admin audit page (spec §30): the read-only, filterable audit page.
 * The anonymous-identity reveal deliberately does not live here — it
 * stays in the community moderation context's explicit dialog.
 */
export default function AdminAuditPage() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">审计日志</h1>
        <p className="page-subtitle">只读检索关键操作与变更快照。</p>
      </div>
      <AuditLogSearch />
    </>
  );
}
