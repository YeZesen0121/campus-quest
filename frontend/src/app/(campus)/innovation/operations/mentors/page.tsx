import type { Metadata } from 'next';
import Link from 'next/link';
import { MentorOperationsView } from '@/features/innovation/mentors/MentorOperationsView';
export const metadata:Metadata={title:'导师资料维护 · 华师令'};
export default function MentorOperationsPage(){return <><div className="page-head"><Link href="/innovation/reviews">返回双创运营工作台</Link><h1 className="page-title">导师资料维护</h1><p className="page-subtitle">录入候选资料，并在本人授权范围内维护</p></div><MentorOperationsView/></>;}
