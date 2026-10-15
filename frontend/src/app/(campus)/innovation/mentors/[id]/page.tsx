import type { Metadata } from 'next';
import { PublicMentorsView } from '@/features/innovation/mentors/PublicMentorsView';
export const metadata:Metadata={title:'导师资料 · 华师令'};
export default async function MentorPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const [{id},values]=await Promise.all([params,searchParams]);const query=new URLSearchParams();for(const [key,value] of Object.entries(values))if(typeof value==='string')query.set(key,value);
  return <PublicMentorsView id={id} query={query.toString()}/>;
}
