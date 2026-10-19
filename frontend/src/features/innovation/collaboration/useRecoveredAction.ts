'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import type { RecoveryOutcome, RecoveryStore } from '../mentors/recoveryStore';
import type { CommandContext } from './recoveryCommands';
import { collaborationError } from './presentation';

function useRecoveryScope(workspace:string) {
  const {state}=useSession();
  const userId=state.status==='authenticated'?state.me.id:'';
  const authEpoch=getAuthEpoch();
  return useMemo(()=>({userId,authEpoch,workspace}),[userId,authEpoch,workspace]);
}
export function useRecoveryEntry<Command,Result>(store:RecoveryStore<Command,CommandContext,Result>,workspace:string) {
  const scope=useRecoveryScope(workspace);
  return useSyncExternalStore(store.subscribe,()=>store.read(scope),()=>null);
}
export function useRecoveredAction<Command,Result>(store:RecoveryStore<Command,CommandContext,Result>,workspace:string,settle:(value:Result)=>void) {
  const scope=useRecoveryScope(workspace);const authEpoch=scope.authEpoch;
  const entry=useSyncExternalStore(store.subscribe,()=>store.read(scope),()=>null);
  const [failure,setFailure]=useState<{cause:unknown;unknown:boolean}|null>(null);
  const [message,setMessage]=useState('');
  const mounted=useRef(false); const settleRef=useRef(settle);
  const activeScope=useRef(scope);
  const observed=useRef<Promise<RecoveryOutcome<Result>>|null>(null);
  useEffect(()=>{settleRef.current=settle;});
  useEffect(()=>{mounted.current=true;activeScope.current=scope;return()=>{mounted.current=false;};},[scope]);
  const current=useCallback(()=>mounted.current&&activeScope.current===scope&&authEpoch===getAuthEpoch(),[scope,authEpoch]);
  const observe=useCallback((task:Promise<RecoveryOutcome<Result>>)=>{
    if(observed.current===task)return;observed.current=task;
    void task.then(result=>{
      if(!current())return;
      if(result.status==='success'){setFailure(null);setMessage('已核对当前结果，请查看状态。');settleRef.current(result.value);}
      else if(result.status==='unknown'||result.status==='rejected')setFailure({cause:result.cause,unknown:result.status==='unknown'});
    });
  },[current]);
  useEffect(()=>{if(entry)observe(entry.task);},[entry,observe]);
  useEffect(()=>{
    if(!entry)return;
    const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[entry]);
  function run(command:Command,context:CommandContext={}) {
    if(!current())return;setFailure(null);setMessage('');observe(store.start(scope,command,context));
  }
  function retry(){if(current()){setFailure(null);observe(store.retry(scope));}}
  const error=entry?.state==='unknown'?collaborationError(entry.cause,true):failure?collaborationError(failure.cause,failure.unknown):null;
  return {entry,run,retry,error,message,current,clearError:()=>setFailure(null),locked:!!entry,busy:entry?.state==='running',unknown:entry?.state==='unknown'};
}
