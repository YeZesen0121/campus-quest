import type { Metadata } from 'next';
import { PrivatePage } from '@/features/innovation/PrivateWorkspace';
import { TransferView } from '@/features/innovation/collaboration/TransferView';
export const metadata:Metadata={title:'项目交接 · 华师令'};
export default async function Page({params}:{params:Promise<{transferId:string}>}) {
  const {transferId}=await params;
  return <PrivatePage><TransferView transferId={transferId}/></PrivatePage>;
}
