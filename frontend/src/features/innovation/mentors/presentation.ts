import { describeSectionError, isApiError } from '@/lib/errors';
import type { MentorProfile } from './api';
export function mentorStatus(value:Pick<MentorProfile,'visibility'|'moderation_state'|'confirmation_state'>):string {
  if(value.moderation_state==='TAKEN_DOWN')return '已停止展示（治理限制）';
  return `${value.visibility==='VISIBLE'?'校内展示中':'未展示'} · ${value.confirmation_state==='PENDING'?'待本人确认':value.confirmation_state==='REJECTED'?'候选资料已拒绝':'资料已确认'}`;
}
export function mentorMutationError(cause:unknown) {
  const view=describeSectionError(cause);
  const refresh=isApiError(cause)&&[403,404,409].includes(cause.status);
  const message=isApiError(cause)&&cause.status===403?'当前账号没有操作权限，请返回工作台核对身份。当前输入仍保留。':refresh?'资料或权限已改变。请读取最新版本，核对后继续；当前输入仍保留。':view.message;
  return {...view,message,refresh,unknown:!isApiError(cause)||cause.status>=500};
}
export const LINK_STATUS={PENDING:'待导师确认',ACCEPTED:'导师已同意',REJECTED:'导师已拒绝',REVOKED:'已解除'} as const;
