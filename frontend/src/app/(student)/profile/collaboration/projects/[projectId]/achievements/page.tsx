import type { Metadata } from 'next';
import { PrivatePage } from '@/features/innovation/PrivateWorkspace';
import { CollaborativeAchievements } from '@/features/innovation/collaboration/AchievementWorkspace';
export const metadata:Metadata={title:'成果文字协作 · 华师令'};
export default async function Page({params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params;return <PrivatePage><CollaborativeAchievements projectId={projectId}/></PrivatePage>;
}
