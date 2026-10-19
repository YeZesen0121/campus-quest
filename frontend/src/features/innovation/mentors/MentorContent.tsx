import type { MentorContent as Content } from './api';
import { MENTOR_FIELDS } from './form';
import { DividedSections } from '@/components/ui/dividedSections';
export function MentorContent({content,identity=false}:{content:Content;identity?:boolean}) {
  return <dl className="ie-review-prose campus-mentor-facts">{MENTOR_FIELDS.filter(field=>identity||!['name','unit'].includes(field.key)).map(({key,label})=><div key={key}><dt className="field-label">{label}</dt><dd>{content[key]||'暂未填写'}</dd></div>)}</dl>;
}
/** Confirmed public prose has its own reading order; form validation stays unchanged. */
export function PublicMentorContent({content}:{content:Content}) {
  return <DividedSections className="campus-mentor-public-body">{([['introduction','directions'],['project_types','achievements']] as const).map((keys,index)=><div key={index}>{keys.map(key=><section className="campus-mentor-prose" key={key}><h2>{MENTOR_FIELDS.find(field=>field.key===key)!.label}</h2><p>{content[key]||'暂未填写'}</p></section>)}</div>)}</DividedSections>;
}
