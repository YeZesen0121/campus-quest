import { PublicDiscoveryFrame } from '@/features/innovation/PublicDiscoveryFrame';
import { PublicAchievementsView } from "@/features/innovation/PublicAchievementsView";
export default function AchievementsPage() { return <PublicDiscoveryFrame section="achievements"><div className="page-head"><h1 className="page-title">校内成果</h1><p className="page-subtitle">从作品与阶段记录，了解正在发生的校园实践。</p></div><PublicAchievementsView /></PublicDiscoveryFrame>; }
