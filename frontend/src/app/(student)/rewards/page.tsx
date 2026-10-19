import type { Metadata } from "next";

import { RewardsView } from "@/features/rewards/RewardsView";

export const metadata: Metadata = {
  title: "积分兑换 · 华师令",
  description: "积分余额、奖励货架与兑换申请",
};

/**
 * Rewards page (spec §16/§42): the shell (layout) already gates on the
 * session; this server shell composes the rewards island, whose
 * sections each own their loading/empty/error states.
 */
export default function RewardsPage() {
  return (
    <div className="student-growth-page">
      <div className="page-head">
        <h1 className="page-title">积分奖励</h1>
        <p className="page-subtitle">把每一次完成，积累成下一份奖励。</p>
      </div>
      <RewardsView />
    </div>
  );
}
