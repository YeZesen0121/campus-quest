import type { Metadata } from 'next';
import Link from 'next/link';
import { MentorSelfView } from '@/features/innovation/mentors/MentorSelfView';
export const metadata:Metadata={title:'我的导师资料 · 华师令'};
export default function MyMentorPage(){return <><div className="page-head"><Link href="/innovation/mentors">返回导师库</Link><h1 className="page-title">我的导师资料</h1><p className="page-subtitle">本人核对资料、管理授权与项目挂名</p><p className="field-hint">演示阶段使用模拟导师账号与资料，学校统一身份认证尚未接入。</p></div><MentorSelfView/></>;}
