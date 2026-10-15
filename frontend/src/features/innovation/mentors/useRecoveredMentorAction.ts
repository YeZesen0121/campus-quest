'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/features/auth/session';
import { getAuthEpoch } from '@/lib/accessToken';
import { mentorMutationError } from './presentation';
import type { MentorRecoveryContext } from './recoveryCommands';
import type { RecoveryOutcome, RecoveryStore } from './recoveryStore';

function useRecoveryScope(workspace:string){
  const {state}=useSession();const userId=state.status==='authenticated'?state.me.id:'';const authEpoch=getAuthEpoch();
  return useMemo(()=>({userId,authEpoch,workspace}),[userId,authEpoch,workspace]);
}
export function useMentorRecoveryEntry<Command,Result>(store:RecoveryStore<Command,MentorRecoveryContext,Result>,workspace:string){
  const scope=useRecoveryScope(workspace);
  return useSyncExternalStore(store.subscribe,()=>store.read(scope),()=>null);
}

/** Commands live in the account-scoped store; only this mounted view settles UI. */
export function useRecoveredMentorAction<Command,Result>(store:RecoveryStore<Command,MentorRecoveryContext,Result>,workspace:string,settle:(value:Result)=>void){
  const scope=useRecoveryScope(workspace);const scopeKey=JSON.stringify(scope);
  const recovery=useSyncExternalStore(store.subscribe,()=>store.read(scope),()=>null);
  const [error,setError]=useState<ReturnType<typeof mentorMutationError>|null>(null);const [message,setMessage]=useState('');
  const active=useRef(false);const activeScope=useRef(scopeKey);const settleRef=useRef(settle);const observed=useRef<Promise<RecoveryOutcome<Result>>|null>(null);
  useEffect(()=>{settleRef.current=settle;});
  useEffect(()=>{active.current=true;activeScope.current=scopeKey;return()=>{active.current=false;};},[scopeKey]);
  const current=useCallback(()=>active.current&&activeScope.current===scopeKey&&scope.authEpoch===getAuthEpoch(),[scopeKey,scope.authEpoch]);
  const observe=useCallback((task:Promise<RecoveryOutcome<Result>>)=>{
    if(observed.current===task)return;observed.current=task;
    void task.then(outcome=>{
      if(!current())return;
      if(outcome.status==='success'){setError(null);settleRef.current(outcome.value);setMessage('操作已保存，请核对当前状态。');}
      else if(outcome.status==='unknown'||outcome.status==='rejected')setError(mentorMutationError(outcome.cause));
    });
  },[current]);
  useEffect(()=>{if(recovery)observe(recovery.task);},[recovery,observe]);
  function run(command:Command,context:MentorRecoveryContext={}){
    if(!current())return Promise.resolve();setError(null);setMessage('');const task=store.start(scope,command,context);observe(task);return task.then(()=>{});
  }
  function retry(){if(!current())return Promise.resolve();setError(null);setMessage('');const task=store.retry(scope);observe(task);return task.then(()=>{});}
  return {busy:recovery?.state==='running',error:error??(recovery?.state==='unknown'?mentorMutationError(recovery.cause):null),pending:!!recovery,message,setMessage,locked:!!recovery,run,retry,clearError:()=>setError(null),current,recovery};
}
