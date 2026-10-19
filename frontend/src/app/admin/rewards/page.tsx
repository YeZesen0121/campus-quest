import type { Metadata } from "next";

import { RewardsAdmin } from "@/features/admin/RewardsAdmin";

export const metadata: Metadata = {
  title: "奖励目录 · CampusQuest 管理后台",
  description: "奖励目录管理（积分 / 库存 / 限购 / 时间窗）与兑换审阅授权",
};

/**
 * Admin rewards page (spec §16): catalogue CRUD island plus the
 * REWARD_REVIEW grant lifecycle.
 */
export default function AdminRewardsPage() {
  return (
    <RewardsAdmin heading={<div className="page-head">
        <h1 className="page-title">奖励目录</h1>
        <p className="page-subtitle">维护上架奖励与兑换条件，调整只影响之后的新申请。</p>
      </div>} />
  );
}
