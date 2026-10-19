import { PublicProjectsView } from "@/features/innovation/PublicProjectsView";
import { recruitmentQuery } from "@/features/innovation/recruitmentQuery";
import { PublicDiscoveryFrame } from "@/features/innovation/PublicDiscoveryFrame";
export const metadata = { title: "校内项目 · 华师令" };
export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <PublicDiscoveryFrame section="projects" variant="bridge"><PublicProjectsView id={id} query={recruitmentQuery(query, true)} returnQuery={recruitmentQuery(query)} /></PublicDiscoveryFrame>;
}
