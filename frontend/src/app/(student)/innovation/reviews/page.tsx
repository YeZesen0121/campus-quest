import { AchievementReviewsView } from "@/features/innovation/AchievementReviewsView";
import Link from 'next/link';
export default function ReviewsPage() { return <><div className="page-head"><h1 className="page-title">双创运营工作台</h1><p className="page-subtitle">领取待办，核对提交版本，明确反馈结果</p><Link href="/innovation/operations/mentors">导师资料维护</Link></div><AchievementReviewsView /></>; }
