import { PublicRecruitmentsView } from "@/features/innovation/PublicRecruitmentsView";
import { PublicDiscoveryFrame } from "@/features/innovation/PublicDiscoveryFrame";
import { recruitmentQuery } from "@/features/innovation/recruitmentQuery";
export const metadata = { title: "招募岗位 · 华师令" };
export default async function RecruitmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, values] = await Promise.all([params, searchParams]);
  return <PublicDiscoveryFrame section="recruitments" variant="role"><PublicRecruitmentsView id={id} query={recruitmentQuery(values)} /></PublicDiscoveryFrame>;
}
