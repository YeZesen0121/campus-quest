export type MentorQuery={q:string;direction:string;accepting_contact:''|'true'|'false';offset:number};
export function parseMentorQuery(params:URLSearchParams):MentorQuery {
  const raw=params.get('offset')??'0';const offset=Number(raw);const contact=params.get('accepting_contact');
  return {q:params.get('q')??'',direction:params.get('direction')??'',accepting_contact:contact==='true'||contact==='false'?contact:'',offset:/^\d+$/.test(raw)&&Number.isSafeInteger(offset)?offset:0};
}
export function buildMentorQuery(filters:MentorQuery,offset=filters.offset):URLSearchParams {
  const params=new URLSearchParams();if(filters.q.trim())params.set('q',filters.q.trim());if(filters.direction.trim())params.set('direction',filters.direction.trim());if(filters.accepting_contact)params.set('accepting_contact',filters.accepting_contact);if(offset>0)params.set('offset',String(offset));return params;
}
export function mentorListHref(query:string):string {const params=buildMentorQuery(parseMentorQuery(new URLSearchParams(query)));return `/innovation/mentors${params.size?'?'+params:''}`;}
