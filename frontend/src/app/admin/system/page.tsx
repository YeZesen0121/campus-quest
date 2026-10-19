import type { Metadata } from "next";

import { SystemAdmin } from "@/features/admin/SystemAdmin";

export const metadata: Metadata = {
  title: "系统设置 · CampusQuest 管理后台",
  description: "系统设置键、通知模板、投递失败查询与具名状态修复",
};

/**
 * Admin system page: the five typed settings keys (versioned), the
 * NotificationTemplate administration, the §25.4 failure query, and the
 * two named state repairs.
 */
export default function AdminSystemPage() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">系统设置</h1>
        <p className="page-subtitle">系统参数、通知模板与异常投递的维护入口。</p>
      </div>
      <SystemAdmin />
    </>
  );
}
