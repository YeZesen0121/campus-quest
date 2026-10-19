import type { Metadata } from 'next';
import { PrivatePage } from '@/features/innovation/PrivateWorkspace';
import { ProjectWorkspace } from '@/features/innovation/collaboration/ProjectWorkspace';
export const metadata:Metadata={title:'协作工作区 · 华师令'};
export default async function Page({params}:{params:Promise<{projectId:string}>}) {
  const {projectId}=await params;return <PrivatePage><ProjectWorkspace projectId={projectId}/></PrivatePage>;
}
