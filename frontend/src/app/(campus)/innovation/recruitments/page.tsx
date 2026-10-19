import { PublicRecruitmentsView } from "@/features/innovation/PublicRecruitmentsView";
import { recruitmentQuery } from "@/features/innovation/recruitmentQuery";
import { PublicDiscoveryFrame } from "@/features/innovation/PublicDiscoveryFrame";
export const metadata = { title: "校内招募 · 华师令" };
export default async function RecruitmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = recruitmentQuery(await searchParams);
  return <PublicDiscoveryFrame section="recruitments" variant="bridge"><div className="page-head"><h1 className="page-title">校内招募</h1><p className="page-subtitle">从一个具体岗位开始，找到适合参与的项目。</p></div><PublicRecruitmentsView query={query} /></PublicDiscoveryFrame>;
}
