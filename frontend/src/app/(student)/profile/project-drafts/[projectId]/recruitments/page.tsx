import type { Metadata } from "next";
import { RecruitmentWorkspace } from "@/features/innovation/RecruitmentWorkspace";
import { PrivatePage } from "@/features/innovation/PrivateWorkspace";
export const metadata: Metadata = { title: "我的招募 · 华师令" };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <PrivatePage><RecruitmentWorkspace projectId={projectId} /></PrivatePage>;
}
