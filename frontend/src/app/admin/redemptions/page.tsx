import type { Metadata } from "next";

import { RedemptionsAdmin } from "@/features/admin/RedemptionsAdmin";

export const metadata: Metadata = {
  title: "兑换审核 · CampusQuest 管理后台",
  description: "兑换申请审核队列（通过 / 拒绝 / 发放）",
};

/**
 * Admin redemptions page (spec §16.2): the pending-queue master/detail
 * island with the three decision verbs.
 */
export default function AdminRedemptionsPage() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">兑换审核</h1>
        <p className="page-subtitle">按申请时间处理，批准与实际发放分开记录。</p>
      </div>
      <RedemptionsAdmin />
    </>
  );
}
