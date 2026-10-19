import type { Metadata } from 'next';
import { PrivatePage } from '@/features/innovation/PrivateWorkspace';
import { CollaborationHome } from '@/features/innovation/collaboration/CollaborationHome';
export const metadata:Metadata={title:'协作与交接 · 华师令'};
export default async function Page({searchParams}:{searchParams:Promise<{role?:string|string[]}>}) {
  const {role}=await searchParams;
  return <PrivatePage><CollaborationHome role={role==='MANAGER'||role==='MEMBER'?role:'OWNER'}/></PrivatePage>;
}
