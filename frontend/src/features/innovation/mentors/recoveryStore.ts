export type RecoveryScope={userId:string;authEpoch:number;workspace:string};
export type RecoveryOutcome<Result>=
  |{status:'success';value:Result}
  |{status:'rejected'|'unknown';cause:unknown}
  |{status:'stale'};
export type RecoveryEntry<Command,Context,Result>={
  command:Command;context:Context;state:'running'|'unknown';cause?:unknown;
  task:Promise<RecoveryOutcome<Result>>;
};
export interface RecoveryStore<Command,Context,Result>{
  read(scope:RecoveryScope):RecoveryEntry<Command,Context,Result>|null;
  start(scope:RecoveryScope,command:Command,context:Context):Promise<RecoveryOutcome<Result>>;
  retry(scope:RecoveryScope):Promise<RecoveryOutcome<Result>>;
  subscribe(listener:()=>void):()=>void;
  hasPending():boolean;
  dispose():void;
}
export type RecoveryOptions<Command,Result>={
  getAuthEpoch:()=>number;
  onAuthEpochChange:(listener:()=>void)=>()=>void;
  execute:(command:Command)=>Promise<Result>;
  isUnknown:(cause:unknown)=>boolean;
  /** A retry first reads authoritative state, without replacing its frozen command. */
  reconcile?:(command:Command)=>Promise<{status:'retry'}|{status:'resolved';value:Result}>;
};

export function createRecoveryStore<Command,Context,Result>(options:RecoveryOptions<Command,Result>):RecoveryStore<Command,Context,Result>{
  type Record={scope:RecoveryScope;entry:RecoveryEntry<Command,Context,Result>};
  const records=new Map<string,Record>();const listeners=new Set<()=>void>();let disposed=false;
  const key=(scope:RecoveryScope)=>JSON.stringify([scope.userId,scope.authEpoch,scope.workspace]);
  const notify=()=>{for(const listener of listeners)listener();};
  const valid=(scope:RecoveryScope)=>!disposed&&scope.authEpoch===options.getAuthEpoch();
  const current=(record:Record)=>valid(record.scope)&&records.get(key(record.scope))===record;
  const stale=():Promise<RecoveryOutcome<Result>>=>Promise.resolve({status:'stale'});
  const detach=options.onAuthEpochChange(()=>{records.clear();notify();});
  function attempt(record:Record,recover=false):Promise<RecoveryOutcome<Result>>{
    const task=Promise.resolve().then(async():Promise<RecoveryOutcome<Result>>=>{
      if(!current(record))return {status:'stale'};
      let checking=false;
      try{
        if(recover&&options.reconcile){
          checking=true;
          const result=await options.reconcile(structuredClone(record.entry.command));
          if(!current(record))return {status:'stale'};
          if(result.status==='resolved'){records.delete(key(record.scope));notify();return {status:'success',value:result.value};}
        }
        checking=false;
        const value=await options.execute(structuredClone(record.entry.command));
        if(!current(record))return {status:'stale'};
        records.delete(key(record.scope));notify();return {status:'success',value};
      }catch(cause){
        if(!current(record))return {status:'stale'};
        // A lookup failure is not a verdict about the original mutation.
        if(checking||options.isUnknown(cause)){record.entry={...record.entry,state:'unknown',cause};notify();return {status:'unknown',cause};}
        records.delete(key(record.scope));notify();return {status:'rejected',cause};
      }
    });
    record.entry={...record.entry,state:'running',cause:undefined,task};notify();return task;
  }
  return {
    read:scope=>valid(scope)?records.get(key(scope))?.entry??null:null,
    start(scope,command,context){
      if(!valid(scope))return stale();const existing=records.get(key(scope));if(existing)return existing.entry.task;
      const record:Record={scope:{...scope},entry:{command:freeze(structuredClone(command)),context:freeze(structuredClone(context)),state:'running',task:stale()}};
      records.set(key(scope),record);return attempt(record);
    },
    retry(scope){if(!valid(scope))return stale();const record=records.get(key(scope));return !record?stale():record.entry.state==='running'?record.entry.task:attempt(record,true);},
    subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};},
    hasPending:()=>records.size>0,
    dispose(){disposed=true;detach();records.clear();notify();listeners.clear();},
  };
}

function freeze<T>(value:T):T{
  if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;
}
