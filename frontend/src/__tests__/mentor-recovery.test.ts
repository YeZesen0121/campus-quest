import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecoveryStore, type RecoveryScope } from '../features/innovation/mentors/recoveryStore';

type Command={kind:string;body:{request_id:string;mentor_username:string;fields:{name:string}}};
type Context={username:string;fields:{name:string};offset:number};
const command=():Command=>({kind:'create',body:{request_id:'original-uuid',mentor_username:'simulated-mentor',fields:{name:'原始模拟资料'}}});
const context=():Context=>({username:' simulated-mentor ',fields:{name:' 原始模拟资料 '},offset:20});
const scope=(workspace='operations:create',userId='operator-a',authEpoch=1):RecoveryScope=>({userId,authEpoch,workspace});
const network=new Error('unknown network outcome');
function deferred<T>(){let resolve!:(value:T)=>void;let reject!:(cause:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(execute:(value:Command)=>Promise<string>){
  let epoch=1;const listeners=new Set<()=>void>();
  const store=createRecoveryStore<Command,Context,string>({getAuthEpoch:()=>epoch,onAuthEpochChange:listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},execute,isUnknown:cause=>cause===network});
  return {store,advance:()=>{epoch+=1;for(const listener of listeners)listener();},listeners};
}

test('mentor recovery retains an immutable original command and draft across unknown retry',async()=>{
  const bodies:string[]=[];const {store}=harness(async value=>{bodies.push(JSON.stringify(value));if(bodies.length===1){value.body.fields.name='executor mutated copy';throw network;}return 'saved';});
  const input=command();const draft=context();const first=store.start(scope(),input,draft);input.body.fields.name='new local input';draft.username='other account text';
  assert.equal((await first).status,'unknown');const reopened=store.read(scope());assert.ok(reopened);assert.equal(reopened.state,'unknown');assert.equal(reopened.command.body.fields.name,'原始模拟资料');assert.equal(reopened.context.username,' simulated-mentor ');assert.equal(reopened.context.offset,20);assert.equal(Object.isFrozen(reopened.command.body.fields),true);
  assert.equal((await store.retry(scope())).status,'success');assert.deepEqual(bodies,[JSON.stringify(command()),JSON.stringify(command())]);assert.equal(store.read(scope()),null);assert.equal(store.hasPending(),false);store.dispose();
});

test('mentor recovery keeps in-flight work discoverable and refuses a replacement command',async()=>{
  const response=deferred<string>();let calls=0;const {store}=harness(async()=>{calls+=1;return response.promise;});
  const first=store.start(scope(),command(),context());assert.equal(store.read(scope())?.state,'running');assert.equal(store.hasPending(),true);assert.equal(store.start(scope(),{...command(),body:{...command().body,request_id:'replacement'}},context()),first);assert.equal(store.retry(scope()),first);
  await Promise.resolve();assert.equal(calls,1);response.reject(network);assert.equal((await first).status,'unknown');assert.equal(store.read(scope())?.command.body.request_id,'original-uuid');assert.equal((await store.start(scope(),{...command(),body:{...command().body,request_id:'another'}},context())).status,'unknown');assert.equal(calls,1);store.dispose();
});

test('mentor recovery clears a definite rejection and can then start a new command',async()=>{
  const forbidden={status:403};let calls=0;const {store}=harness(async()=>{calls+=1;if(calls===1)throw forbidden;return 'saved';});
  assert.deepEqual(await store.start(scope(),command(),context()),{status:'rejected',cause:forbidden});assert.equal(store.read(scope()),null);assert.equal(store.hasPending(),false);
  assert.equal((await store.start(scope(),{...command(),body:{...command().body,request_id:'new-uuid'}},context())).status,'success');assert.equal(calls,2);store.dispose();
});

test('mentor recovery isolates create, profile, self, invite and links by account and workspace',async()=>{
  const {store}=harness(async()=>{throw network;});const workspaces=['operations:create','operations:profile:one','mentor:self','project:one:invite','project:one:links','mentor:links'];
  for(const workspace of workspaces)await store.start(scope(workspace),{...command(),kind:workspace},context());
  for(const workspace of workspaces)assert.equal(store.read(scope(workspace))?.command.kind,workspace);
  assert.equal(store.read(scope('operations:create','operator-b')),null);assert.equal(store.read(scope('operations:create','operator-a',2)),null);assert.equal(store.read(scope('project:two:links')),null);assert.equal(store.hasPending(),true);store.dispose();
});

test('mentor recovery synchronously clears on auth change and fences late old-account responses',async()=>{
  const response=deferred<string>();const {store,advance}=harness(async()=>response.promise);const first=store.start(scope(),command(),context());await Promise.resolve();assert.equal(store.hasPending(),true);
  advance();assert.equal(store.hasPending(),false);assert.equal(store.read(scope()),null);response.resolve('old private result');assert.deepEqual(await first,{status:'stale'});assert.equal(store.read(scope()),null);assert.equal(store.read(scope('operations:create','operator-b',2)),null);store.dispose();
});

test('mentor recovery never starts an old-epoch command and unsubscribes departed views',async()=>{
  let calls=0;const {store,advance,listeners}=harness(async()=>{calls+=1;throw network;});let oldView=0;let newView=0;const detach=store.subscribe(()=>{oldView+=1;});
  const first=store.start(scope(),command(),context());assert.ok(oldView>0);detach();const previous=oldView;store.subscribe(()=>{newView+=1;});advance();assert.equal(oldView,previous);assert.ok(newView>0);assert.deepEqual(await first,{status:'stale'});assert.equal(calls,0);
  assert.deepEqual(await store.start(scope(),command(),context()),{status:'stale'});assert.equal(calls,0);assert.equal(listeners.size,1);store.dispose();assert.equal(listeners.size,0);
});
