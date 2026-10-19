import { PublicProjectsView } from "@/features/innovation/PublicProjectsView";
import { recruitmentQuery } from "@/features/innovation/recruitmentQuery";
import { PublicDiscoveryFrame } from "@/features/innovation/PublicDiscoveryFrame";
export const metadata = { title: "项目库 · 华师令" };
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = recruitmentQuery(await searchParams);
  return <PublicDiscoveryFrame section="projects" variant="projects"><PublicProjectsView query={query} /></PublicDiscoveryFrame>;
}
