import type { Metadata } from 'next';
import Link from 'next/link';
import { MentorOperationsView } from '@/features/innovation/mentors/MentorOperationsView';
export const metadata:Metadata={title:'导师资料维护 · 华师令'};
export default function MentorOperationsPage(){return <div className="campus-mentor-page"><div className="page-head"><h1 className="page-title">导师录入与维护</h1><p className="page-subtitle">录入候选资料，请导师本人核对展示、联系渠道与维护范围。</p></div><MentorOperationsView/><p className="field-hint campus-mentor-workbench-return"><Link href="/innovation/reviews">返回双创运营工作台</Link></p></div>;}
