import type { MentorFields, MentorConsent } from './api';
import { codePointCount } from '../draftForm';
import { invalidRecruitmentContactChannels } from '../recruitmentForm';

export const MENTOR_FIELDS = [
  {key:'name',label:'导师姓名',limit:50,rows:1},
  {key:'unit',label:'所在单位',limit:100,rows:1},
  {key:'introduction',label:'导师简介',limit:2000,rows:4},
  {key:'directions',label:'指导方向',limit:1000,rows:3},
  {key:'achievements',label:'代表成果',limit:3000,rows:4},
  {key:'project_types',label:'适合的项目类型',limit:1000,rows:3},
] as const;
export const MAINTENANCE_FIELDS = [
  {key:'introduction',label:'导师简介'}, {key:'directions',label:'指导方向'},
  {key:'achievements',label:'代表成果'}, {key:'project_types',label:'适合的项目类型'},
] as const;
export type MentorFieldErrors = Partial<Record<keyof MentorFields,string>>;
export const emptyMentorFields = ():MentorFields => ({name:'',unit:'',introduction:'',directions:'',achievements:'',project_types:'',contacts:[]});
export function normalizeMentorFields(fields:MentorFields):MentorFields {
  const result={...fields,contacts:fields.contacts.map(contact=>({...contact,value:contact.value.trim()}))};
  for(const {key} of MENTOR_FIELDS) result[key]=fields[key].trim();
  return result;
}
export function validateMentorFields(fields:MentorFields,confirm=false):MentorFieldErrors {
  const errors:MentorFieldErrors={};
  for(const {key,label,limit} of MENTOR_FIELDS) {
    if(confirm&&key!=='achievements'&&!fields[key].trim())errors[key]=`请填写${label}。`;
    else if(codePointCount(fields[key].trim())>limit)errors[key]=`最多 ${limit} 个字符。`;
  }
  if(fields.contacts.length>4||invalidRecruitmentContactChannels(fields.contacts).length)errors.contacts='请核对联系值的格式，每种渠道最多填写一次。';
  return errors;
}
export function validateMentorConsent(fields:MentorFields,consent:MentorConsent):string {
  if(Object.keys(validateMentorFields(fields,true)).length)return '资料尚不完整，请联系运营补齐姓名、单位、简介、方向和项目类型。';
  if(!consent.confirm_profile)return '请先核对资料，并明确勾选同意校内展示。';
  if(consent.contact_channels.some(channel=>!fields.contacts.some(contact=>contact.channel===channel)))return '所选联系渠道已改变，请重新核对资料。';
  if(consent.accepting_contact&&!consent.contact_channels.length)return '接受联系时请至少授权一种渠道；也可以选择暂停联系。';
  return '';
}
