import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicMentorsView } from '@/features/innovation/mentors/PublicMentorsView';
export const metadata:Metadata={title:'导师库 · 华师令'};
export default async function MentorsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const values=await searchParams;const query=new URLSearchParams();for(const [key,value] of Object.entries(values))if(typeof value==='string')query.set(key,value);
  return <><div className="page-head"><Link className="section-link" href="/innovation">返回创新创业</Link><h1 className="page-title">导师库</h1><p className="page-subtitle">了解指导方向，寻找适合项目的导师</p><p className="field-hint">仅展示导师本人确认的资料。演示资料为模拟内容；学校统一身份认证尚未接入。</p><Link href="/innovation/mentors/me">我的导师资料与挂名待办</Link></div><PublicMentorsView query={query.toString()}/></>;
}
