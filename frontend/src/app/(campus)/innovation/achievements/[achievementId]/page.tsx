import { DiscoveryArrow, PublicDiscoveryFrame } from '@/features/innovation/PublicDiscoveryFrame';
import Link from "next/link";
import { PublicAchievementsView } from "@/features/innovation/PublicAchievementsView";
export default async function AchievementPage({ params }: { params: Promise<{ achievementId: string }> }) { const { achievementId } = await params; return <PublicDiscoveryFrame section="achievements"><Link className="section-link campus-discovery-back" href="/innovation/achievements"><DiscoveryArrow direction="left" />返回校内成果</Link><PublicAchievementsView id={achievementId} /></PublicDiscoveryFrame>; }
