import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getAuthEpoch, recordLogout, setAccessToken } from '../lib/accessToken';
import { transferRecovery, projectRecovery, lifecycleRecovery } from '../features/innovation/collaboration/recoveryCommands';
import { achievementRecovery, collaborationRecovery, recruitmentRecovery, type CommandContext } from '../features/innovation/collaboration/recoveryCommands';
import type { RecoveryStore } from '../features/innovation/mentors/recoveryStore';
import { emptyRecruitmentForm, normalizeRecruitmentForm } from '../features/innovation/recruitmentForm';

const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; recordLogout(); });
const scope = (workspace: string) => ({userId: 'student', authEpoch: getAuthEpoch(), workspace});

test('lost acceptance reads the transfer result and never sends another acceptance', async () => {
  setAccessToken('demo-token'); let posts = 0; let reads = 0;
  globalThis.fetch = (async (_path, init) => {
    if (init?.method === 'POST') { posts++; throw new TypeError('response lost'); }
    reads++; return Response.json({id: 't', status: 'ACCEPTED'});
  }) as typeof fetch;
  const owner = scope('transfer:t');
  const command = {kind: 'act' as const, transferId: 't', action: 'accept' as const, body: {request_id: 'stable', version: 1, confirmation_digest: 'a'.repeat(64)}};
  assert.equal((await transferRecovery.start(owner, command, {})).status, 'unknown');
  const result = await transferRecovery.retry(owner);
  assert.equal(result.status, 'success');
  if (result.status === 'success') assert.equal(result.value.status, 'ACCEPTED');
  assert.equal(posts, 1); assert.equal(reads, 1);
});

async function lostReplay<C,R>(store:RecoveryStore<C,CommandContext,R>,command:C,expectedLookup:string,expectedWrite:string,lookup:unknown={}) {
  setAccessToken('demo-token');const events:{path:string;body:unknown}[]=[];let writes=0;
  globalThis.fetch=(async(path,init)=>{
    events.push({path:String(path),body:init?.body?JSON.parse(String(init.body)):null});
    if(init?.method&&init.method!=='GET'){writes++;if(writes===1)throw new TypeError('response lost');return Response.json({});}
    return Response.json(lookup);
  }) as typeof fetch;
  const owner=scope('command-test');assert.equal((await store.start(owner,command,{})).status,'unknown');
  assert.equal((await store.retry(owner)).status,'success');
  assert.equal(events[0].path,expectedWrite);assert.equal(events[1].path,expectedLookup);assert.equal(events[2].path,expectedWrite);
  assert.deepEqual(events[2].body,events[0].body);assert.equal(writes,2);
}
test('invitation and pending transfer retry own history before replaying the exact original command',async()=>{
  await lostReplay(collaborationRecovery,{kind:'invite',projectId:'p',body:{request_id:'invite-key',target_ref:'target',kind:'MANAGER'}},'/api/v1/ie/me/collaborations?limit=100&offset=0','/api/v1/ie/me/project-drafts/p/collaborators',{items:[],total:0});
  await lostReplay(transferRecovery,{kind:'create',projectId:'p',body:{request_id:'transfer-key',target_ref:'target',evidence_ids:['selected'],allow_preview:false}},'/api/v1/ie/me/transfers?limit=20&offset=0','/api/v1/ie/me/project-drafts/p/transfers');
  await lostReplay(transferRecovery,{kind:'act',transferId:'t',action:'cancel',body:{request_id:'cancel-key',version:1,confirmation_digest:'a'.repeat(64)}},'/api/v1/ie/transfers/t','/api/v1/ie/transfers/t/cancel',{id:'t',status:'PENDING',version:99,confirmation_digest:'b'.repeat(64)});
});
test('collaboration result lookup scans past page one; revoke never mistakes accepted for already revoked',async()=>{
  setAccessToken('demo-token');let writes=0;const offsets:string[]=[];
  globalThis.fetch=(async(path,init)=>{
    if(init?.method==='POST'){writes++;if(writes===1)throw new TypeError('lost');return Response.json({id:'c',status:'REVOKED'});}
    const offset=new URL(String(path),'http://test').searchParams.get('offset')!;offsets.push(offset);
    return Response.json(offset==='0'?{items:Array.from({length:100},(_,index)=>({id:`other-${index}`,status:'EXPIRED'})),total:101}:{items:[{id:'c',status:'EXPIRED'}],total:101});
  }) as typeof fetch;
  const owner=scope('collab-scan');await collaborationRecovery.start(owner,{kind:'act',collaborationId:'c',action:'accept',body:{request_id:'key',version:1}},{});
  const result=await collaborationRecovery.retry(owner);assert.equal(result.status,'success');if(result.status==='success')assert.equal(result.value.status,'EXPIRED');assert.deepEqual(offsets,['0','100']);assert.equal(writes,1);
  await lostReplay(collaborationRecovery,{kind:'act',collaborationId:'c',action:'revoke',body:{request_id:'revoke-key',version:2}},'/api/v1/ie/me/collaborations?limit=100&offset=0','/api/v1/ie/collaborations/c/revoke',{items:[{id:'c',status:'ACCEPTED'}],total:1});
});
test('achievement and recruitment recovery keep original save and contact authorization bodies',async()=>{
  const fields={title:'文字',description:'原输入',work_url:'',award_text:''};const body={request_id:'original',version:1};
  await lostReplay(achievementRecovery,{kind:'create',projectId:'p',body:{...fields,request_id:body.request_id}},'/api/v1/ie/collaboration/projects/p/achievements?limit=20&offset=0','/api/v1/ie/collaboration/projects/p/achievements');
  await lostReplay(achievementRecovery,{kind:'save',projectId:'p',achievementId:'a',body:{...fields,...body}},'/api/v1/ie/collaboration/projects/p/achievements/a','/api/v1/ie/collaboration/projects/p/achievements/a',{version:20,title:'后来文字'});
  const recruitment=normalizeRecruitmentForm(emptyRecruitmentForm());
  await lostReplay(recruitmentRecovery,{kind:'create',projectId:'p',body:{request_id:body.request_id,fields:recruitment}},'/api/v1/ie/collaboration/projects/p/recruitments?limit=20&offset=0','/api/v1/ie/collaboration/projects/p/recruitments');
  await lostReplay(recruitmentRecovery,{kind:'save',projectId:'p',recruitmentId:'r',body:{...body,fields:recruitment}},'/api/v1/ie/collaboration/projects/p/recruitments/r','/api/v1/ie/collaboration/projects/p/recruitments/r');
  await lostReplay(recruitmentRecovery,{kind:'act',projectId:'p',recruitmentId:'r',action:'close',body},'/api/v1/ie/collaboration/projects/p/recruitments/r','/api/v1/ie/collaboration/projects/p/recruitments/r/close');
  await lostReplay(recruitmentRecovery,{kind:'revoke-contact',projectId:'p',recruitmentId:'r',body:{...body,channel:'EMAIL',close_if_last:true}},'/api/v1/ie/collaboration/projects/p/recruitments/r','/api/v1/ie/collaboration/projects/p/recruitments/r/revoke-contact');
});
test('introduction recovery never adopts a newer version or replaces its preview digest',async()=>{
  await lostReplay(lifecycleRecovery,{kind:'publish',projectId:'p',body:{request_id:'original',version:2,fields:{title:'原预览',summary:'原文字',direction:'学习',stage:'结项'},preview_digest:'a'.repeat(64)}},'/api/v1/ie/me/project-drafts/p/lifecycle','/api/v1/ie/me/project-drafts/p/introduction/publish',{version:9,confirmation_digest:'b'.repeat(64)});
});

test('lost text save reads current workspace but never rewrites its command version', async () => {
  setAccessToken('demo-token'); const events: string[] = []; const bodies: unknown[] = [];
  globalThis.fetch = (async (_path, init) => {
    if (init?.method === 'PATCH') { events.push('write'); bodies.push(JSON.parse(String(init.body))); if (bodies.length === 1) throw new TypeError('lost'); return Response.json({replayed: true, applied_version: 2}); }
    events.push('read'); return Response.json({draft: {version: 2}, role: 'OWNER'});
  }) as typeof fetch;
  const fields = {title: '原输入', summary: '', direction: '', stage: '', team_status: ''};
  const command = {projectId: 'p', body: {...fields, request_id: 'same-request', version: 1}};
  const owner = scope('project:p:save');
  await projectRecovery.start(owner, command, {fields});
  assert.equal((await projectRecovery.retry(owner)).status, 'success');
  assert.deepEqual(events, ['write', 'read', 'write']);
  assert.deepEqual(bodies, [command.body, command.body]);
});

test('lost lifecycle command stays unknown if current permission prevents reconciliation', async () => {
  setAccessToken('demo-token'); let writes = 0;
  globalThis.fetch = (async (_path, init) => {
    if (init?.method === 'POST') { writes++; throw new TypeError('lost'); }
    return Response.json({error: {code: 'PERMISSION_DENIED', message: '当前权限已变化'}}, {status: 403});
  }) as typeof fetch;
  const owner = scope('project:p:lifecycle');
  const command = {kind: 'act' as const, projectId: 'p', action: 'complete' as const, body: {request_id: 'same-request', version: 3, confirmation_digest: 'a'.repeat(64)}};
  await lifecycleRecovery.start(owner, command, {});
  assert.equal((await lifecycleRecovery.retry(owner)).status, 'unknown');
  assert.equal(lifecycleRecovery.read(owner)?.command.body.request_id, 'same-request');
  assert.equal(writes, 1);
});
