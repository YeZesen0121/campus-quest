import type { Metadata } from 'next';
import { MentorOperationsView } from '@/features/innovation/mentors/MentorOperationsView';
export const metadata:Metadata={title:'维护导师资料 · 华师令'};
export default async function MentorOperationPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <><h1 className="page-title">维护导师资料</h1><MentorOperationsView id={id}/></>;}
