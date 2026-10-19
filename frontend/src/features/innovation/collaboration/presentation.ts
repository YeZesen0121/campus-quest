import type { components } from '@/lib/api/schema';
import { describeSectionError, isApiError } from '@/lib/errors';
import type { Collaboration, Transfer } from './api';
import { formatDeadlineDateTime } from '@/lib/time';

export const ROLE_LABELS = {OWNER:'我负责的',MANAGER:'我共管的',MEMBER:'我参与的'} as const;
export const collaborationStatus = (status: Collaboration['status']) => ({PENDING:'待本人确认',ACCEPTED:'本人已同意',REJECTED:'本人已拒绝',REVOKED:'已撤销或退出',EXPIRED:'邀请已到期'} as const)[status];
export const transferStatus = (status: Transfer['status']) => ({PENDING:'待接任人确认',ACCEPTED:'交接已生效',REJECTED:'接任人已拒绝',CANCELED:'发起人已取消',EXPIRED:'交接已到期',INVALIDATED:'交接已失效'} as const)[status];
export function projectSourceText(project: Pick<components['schemas']['PublicProjectSummary'],'source_kind'|'introduction_source'|'introduction_revision'>) {
  if (project.source_kind === 'ACHIEVEMENT') return '已核实成果版本';
  if (project.source_kind === 'RECRUITMENT') return '负责人发布的招募版本（免审）';
  return `项目介绍第 ${project.introduction_revision ?? 1} 版 · ${project.introduction_source === 'RECRUITMENT' ? '原招募公开版本（免审）' : '原公开成果介绍，成果另行核实'}`;
}
const SUMMARY_FIELDS = [
  ['title','项目名称'],['summary','项目简介'],['direction','方向'],['stage','阶段'],['team_status','团队概况'],
  ['achievement_count','成果草稿数'],['manager_count','共管人数'],['member_count','公开成员数'],['mentor_count','挂名导师数'],['open_recruitment_count','开放岗位数'],['lifecycle','项目状态'],['introduction_revision','留存介绍版本'],
] as const;
export function transferChanges(value: Pick<Transfer,'initial_summary'|'current_summary'>) {
  const before = value.initial_summary, after = value.current_summary;
  if (!before || !after) return [];
  const display=(key:typeof SUMMARY_FIELDS[number][0],value:unknown)=>key==='lifecycle'?(value==='COMPLETED'?'已结项':'进行中'):String(value??'');
  return SUMMARY_FIELDS.flatMap(([key,label]) => (key==='introduction_revision'&&(before.snapshot_version??1)<2)||before[key]===after[key]?[]:[{label,before:display(key,before[key]),after:display(key,after[key])}]);
}
export const RELATION_SCOPE_LABELS={TEXT_AND_RECRUITMENT:'共同管理文字与招募（不含证明、提审及团队授权）',PUBLIC_NAME_ONLY:'仅公开姓名与分工（无编辑权）',MENTOR_DISPLAY_ONLY:'仅项目导师挂名（无管理权）'} as const;
export function transferRelationshipText(row:components['schemas']['TransferRelationship']) {
  return `${row.name}${row.division?` · ${row.division}`:''} · ${RELATION_SCOPE_LABELS[row.scope]}`;
}
export function transferJobText(row:components['schemas']['TransferClosingRecruitment']) {
  return `${row.role_name||'未命名岗位'} · 当前开放 · ${row.deadline_at?`截止 ${formatDeadlineDateTime(Date.parse(row.deadline_at))}`:'无截止日期'}`;
}
export function transferChecklistChanges(value:Pick<Transfer,'initial_summary'|'current_summary'>) {
  const before=value.initial_summary,after=value.current_summary;
  if(!before||!after)return [];
  function compare<T extends {reference:string}>(original:T[]|null|undefined,current:T[]|null|undefined,label:string,describe:(row:T)=>string) {
    if(!original||!current)return [];
    const previous=new Map(original.map(row=>[row.reference,describe(row)]));
    const next=new Map(current.map(row=>[row.reference,describe(row)]));
    return [...new Set([...previous.keys(),...next.keys()])].flatMap(reference=>previous.get(reference)===next.get(reference)?[]:[{reference,label,before:previous.get(reference)??'',after:next.get(reference)??''}]);
  }
  return [...compare(before.relationships,after.relationships,'管理与挂名关系',transferRelationshipText),...compare(before.closing_recruitments,after.closing_recruitments,'将关闭的岗位',transferJobText)];
}
export function collaborationError(cause: unknown, unknownOutcome = false) {
  const base = describeSectionError(cause);
  if (unknownOutcome) return {...base,message:'暂时无法确认原操作结果。原请求和输入已保留，请先核对结果；勿另发一份新请求。',refresh:false};
  const refresh = isApiError(cause) && [403,404,409].includes(cause.status);
  const directions:Record<string,string>={
    TARGET_QUALIFICATION_REQUIRED:'接任人须先开通有效的负责人资格，可在负责人资料与资格页面申请，再重新核对交接。',
    PENDING_REVIEW:'项目仍有待核实成果，请由当前负责人等待结果或先撤回，再发起或确认交接。',
    MATERIAL_CHANGED_CREATE_NEW_TRANSFER:'所选证明已变化。请取消原交接，重新逐份选择材料并发起，原请求不会复活旧授权。',
    PROJECT_COMPLETED:'项目已结项。可保存草稿；开放招募须先由负责人在协作工作区明确恢复为进行中。',
  };
  if(isApiError(cause)&&cause.details&&typeof cause.details==='object'&&'kind' in cause.details&&typeof cause.details.kind==='string'&&directions[cause.details.kind])
    return {...base,message:directions[cause.details.kind],refresh};
  return {...base,message:refresh ? '资料、资格或权限已变化。当前输入仍保留，请读取最新资料后核对；交接记录可从协作与交接入口找回。' : base.message,refresh};
}
