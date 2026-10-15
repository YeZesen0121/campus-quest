import { Button } from '@/components/ui/button';
import type { mentorMutationError } from './presentation';
export function ActionFeedback({busy,error,message,pending,onRetry,onRefresh}:{busy:boolean;error:ReturnType<typeof mentorMutationError>|null;message:string;pending:boolean;onRetry:()=>void;onRefresh?:()=>void}){
  return <>{error?<div role="alert" className="alert alert-error"><p>{error.message}</p>{error.requestId?<p className="req-id">请求 ID：{error.requestId}</p>:null}{pending?<Button variant="secondary" disabled={busy} onClick={onRetry}>重试原请求</Button>:error.refresh&&onRefresh?<Button variant="secondary" disabled={busy} onClick={onRefresh}>读取最新版本（保留输入）</Button>:null}</div>:null}<p role="status" aria-label="导师操作结果" className="field-hint">{busy?'正在处理，请稍候…':message}</p></>;
}
