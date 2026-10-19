import type { Metadata } from "next";
import Link from "next/link";
import { PublicAchievementsView } from "@/features/innovation/PublicAchievementsView";
import { PublicRecruitmentsView } from "@/features/innovation/PublicRecruitmentsView";
import { PublicDiscoveryFrame } from "@/features/innovation/PublicDiscoveryFrame";
import { DividedSections } from "@/components/ui/dividedSections";

export const metadata: Metadata = { title: "创新创业 · 华师令" };

export default function InnovationPage() {
  return <PublicDiscoveryFrame section="overview" variant="bridge">
    <div className="page-head">
      <h1 className="page-title">创新创业</h1>
      <p className="page-subtitle">浏览校内成果与招募，了解项目与实践方向。</p>
      <p className="field-hint">演示资料均为模拟内容，学校统一身份认证尚未接入。</p>
    </div>
    <section className="campus-library-links" aria-label="双创三库">
      <h2 className="sr-only">三库资源</h2>
      {([['/innovation/projects', '项目库', '了解项目'], ['/innovation/talents', '人才库', '找同学'], ['/innovation/mentors', '导师库', '找导师']] as const).map(([href, label, hint]) => <Link href={href} key={href} aria-label={`${label} · ${hint}`}><span>{label} <small>{hint}</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></Link>)}
    </section>
    <DividedSections className="campus-discovery-feeds"><PublicAchievementsView compact /><PublicRecruitmentsView compact /></DividedSections>
    <p className="field-hint campus-discovery-end">人才档案由同学主动确认公开；导师本人核对资料与联系授权，项目挂名另行确认。</p>
  </PublicDiscoveryFrame>;
}
