import type { Metadata } from 'next';
import { PrivatePage } from '@/features/innovation/PrivateWorkspace';
import { CollaborativeRecruitments } from '@/features/innovation/collaboration/RecruitmentWorkspace';
export const metadata:Metadata={title:'协作招募管理 · 华师令'};
export default async function Page({params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params;return <PrivatePage><CollaborativeRecruitments projectId={projectId}/></PrivatePage>;
}
