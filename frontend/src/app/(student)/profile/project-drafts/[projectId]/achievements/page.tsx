import type { Metadata } from "next";
import { AchievementDraftsView } from "@/features/innovation/AchievementDraftsView";
import { PrivatePage } from "@/features/innovation/PrivateWorkspace";
export const metadata: Metadata = { title: "我的成果草稿 · 华师令" };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <PrivatePage><AchievementDraftsView projectId={projectId} /></PrivatePage>;
}
