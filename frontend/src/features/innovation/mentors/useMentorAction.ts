'use client';
import { useEffect, useRef, useState } from 'react';
import { getAuthEpoch } from '@/lib/accessToken';
import { mentorMutationError } from './presentation';

/** One operation at a time; an uncertain outcome keeps its original UUID/body. */
export function useMentorAction<T>(settle:(value:T)=>void) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState<ReturnType<typeof mentorMutationError>|null>(null);
  const [pending,setPending]=useState<(()=>Promise<T>)|null>(null);const [message,setMessage]=useState('');
  const active=useRef(false);const running=useRef(false);const epoch=useRef(getAuthEpoch());
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  function current(){return active.current&&epoch.current===getAuthEpoch();}
  async function run(operation:()=>Promise<T>) {
    if(running.current||!current())return;
    running.current=true;setBusy(true);setError(null);setMessage('');setPending(()=>operation);
    try{const value=await operation();if(current()){setPending(null);settle(value);setMessage('操作已保存，请核对当前状态。');}}
    catch(cause){if(current()){const next=mentorMutationError(cause);setError(next);if(!next.unknown)setPending(null);}}
    finally{running.current=false;if(current())setBusy(false);}
  }
  return {busy,error,pending,message,setMessage,locked:busy||!!pending,run,retry:()=>pending?run(pending):Promise.resolve(),clearError:()=>setError(null),current};
}
