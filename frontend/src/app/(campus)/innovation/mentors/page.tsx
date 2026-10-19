import { PublicDiscoveryFrame } from '@/features/innovation/PublicDiscoveryFrame';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicMentorsView } from '@/features/innovation/mentors/PublicMentorsView';
export const metadata:Metadata={title:'导师库 · 华师令'};
export default async function MentorsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const values=await searchParams;const query=new URLSearchParams();for(const [key,value] of Object.entries(values))if(typeof value==='string')query.set(key,value);
  return <div className="campus-mentor-page"><PublicDiscoveryFrame section="mentors" variant="bridge"><div className="page-head"><h1 className="page-title">导师库</h1><p className="page-subtitle">从真实问题出发，寻找适合交流的方向。</p></div><PublicMentorsView query={query.toString()}/><p className="field-hint campus-mentor-directory-note">仅展示导师本人确认的资料。演示资料为模拟内容；学校统一身份认证尚未接入。 <Link href="/innovation/mentors/me">我的导师资料与挂名待办</Link></p></PublicDiscoveryFrame></div>;
}
