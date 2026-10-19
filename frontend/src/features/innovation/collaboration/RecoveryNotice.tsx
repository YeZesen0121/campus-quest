'use client';
import { Button } from '@/components/ui/button';
import type { collaborationError } from './presentation';
import type { ComponentProps } from 'react';
import { RecruitmentConfirm } from '../RecruitmentConfirm';

export function RecoveryNotice({error,message,unknown,busy,onRetry}:{error:ReturnType<typeof collaborationError>|null;message:string;unknown:boolean;busy:boolean;onRetry:()=>void}) {
  return <>
    {error?<div className="alert alert-error" role="alert"><p>{error.message}</p>{error.requestId?<p className="req-id">请求 ID：{error.requestId}</p>:null}</div>:null}
    {unknown?<Button variant="secondary" disabled={busy} onClick={onRetry}>核对原操作结果</Button>:null}
    <p className="field-hint" role="status">{busy?'正在处理，请稍候…':message}</p>
  </>;
}

export function RecoveryConfirm({feedback,children,...props}:ComponentProps<typeof RecruitmentConfirm>&{feedback:ComponentProps<typeof RecoveryNotice>}) {
  // Unknown outcomes return to the visible recovery controls instead of trapping
  // the user behind a modal whose underlying alert is aria-hidden by Radix.
  if(feedback.unknown)return null;
  return <RecruitmentConfirm {...props} confirmDisabled={props.confirmDisabled||!!feedback.error}>{children}{feedback.error?<RecoveryNotice {...feedback}/>:null}</RecruitmentConfirm>;
}
