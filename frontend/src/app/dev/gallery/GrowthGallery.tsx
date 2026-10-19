"use client";

import { BoardRow } from "@/features/rankings/Leaderboard";
import { GrowthBody } from "@/features/rankings/GrowthView";
import type { GrowthDto } from "@/features/rankings/api";
import { WalletSection } from "@/features/rewards/RewardsView";

const noop = () => {};
const EMPTY_GROWTH: GrowthDto = {
  month_points: 0, month_rank: null, total_earned_points: 0,
  completed_count: 0, on_time_count: 0, on_time_ratio: 0,
  current_streak: 0, best_month_rank: null, honors: [],
};
const POPULATED_GROWTH: GrowthDto = {
  month_points: 320, month_rank: 12, total_earned_points: 999999999999,
  completed_count: 20, on_time_count: 18, on_time_ratio: 0.9,
  current_streak: 4, best_month_rank: 2,
  honors: [{
    honor_id: "00000000-0000-4000-8000-0000000000f1",
    name: "校园共建实践与数据整理持续贡献纪念荣誉",
    honor_type: "COMMEMORATIVE", period: null,
    granted_at: "2026-10-15T10:00:00Z",
  }],
};

/** Deterministic dev-only boundary data, rendered by the real components. */
export function GrowthGallery() {
  return (
    <section className="section" aria-label="成长边界示例">
      <h2 className="section-title">钱包与成长 × 零值 × 长内容</h2>
      <p className="progress-note">仅为开发画廊示例，不读取或修改真实余额、排名和荣誉。</p>
      <div className="rewards-view" role="group" aria-label="零余额与透支">
        <WalletSection status="ready" error={null} retry={noop} shelfItems={[]} data={{ available_points: 0, spendable_points: 0, earned_points: 0, point_debt: 20 }} />
      </div>
      <div className="rewards-view" role="group" aria-label="极大余额与冻结">
        <WalletSection status="ready" error={null} retry={noop} shelfItems={[]} data={{ available_points: 999999999999, spendable_points: 999999999899, earned_points: 999999999999, point_debt: 0 }} />
      </div>
      <div role="group" aria-label="空成长"><GrowthBody data={EMPTY_GROWTH} /></div>
      <div role="group" aria-label="有荣誉的成长"><GrowthBody data={POPULATED_GROWTH} /></div>
      <ol className="board-rows" aria-label="长昵称荣誉排名">
        <BoardRow row={{ rank: 12345, nickname: "热爱校园实践与开放信息整理的超长中文昵称同学", displayHonor: "校园共建实践与数据整理持续贡献纪念荣誉", score: 999999999999 }} isMe />
      </ol>
    </section>
  );
}
