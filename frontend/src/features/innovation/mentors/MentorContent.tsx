import type { MentorContent as Content } from './api';
import { MENTOR_FIELDS } from './form';
export function MentorContent({content,identity=false}:{content:Content;identity?:boolean}) {
  return <dl className="ie-review-prose">{MENTOR_FIELDS.filter(field=>identity||!['name','unit'].includes(field.key)).map(({key,label})=><div key={key}><dt className="field-label">{label}</dt><dd>{content[key]||'暂未填写'}</dd></div>)}</dl>;
}
