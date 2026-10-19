import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { recordLogout, setAccessToken } from '../lib/accessToken';
import { resolveTarget, inviteCollaborator, actCollaborator, getMyProjects, getMyCollaborations, saveWorkspace, createTransfer, getMyTransfers, actTransfer, readTransferProof, getLifecycle, actLifecycle, previewIntroduction, publishIntroduction } from '../features/innovation/collaboration/api';
import * as collaborationApi from '../features/innovation/collaboration/api';
import { emptyRecruitmentForm, normalizeRecruitmentForm } from '../features/innovation/recruitmentForm';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; recordLogout(); });
const requestId = '00000000-0000-4000-8000-000000000001';

test('target account stays in private body; consent and text saves use distinct scopes', async () => {
  setAccessToken('demo-token');
  const calls: {path: string; init: RequestInit}[] = [];
  globalThis.fetch = (async (path, init) => { calls.push({path: String(path), init: init ?? {}}); return Response.json({}); }) as typeof fetch;
  await resolveTarget({account: '12345678'});
  await inviteCollaborator('p/a', {request_id: requestId, target_ref: 'opaque', kind: 'MANAGER'});
  await actCollaborator('c/a', 'accept', {request_id: requestId, version: 3});
  await saveWorkspace('p/a', {request_id: requestId, version: 3, title: '文字稿', summary: '', direction: '', stage: '', team_status: ''});
  assert.ok(!calls.some(c => c.path.includes('12345678')));
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {account: '12345678'});
  assert.match(calls[1].path, /me\/project-drafts\/p%2Fa\/collaborators$/);
  assert.match(calls[2].path, /ie\/collaborations\/c%2Fa\/accept$/);
  assert.match(calls[3].path, /ie\/collaboration\/projects\/p%2Fa$/);
  assert.equal(calls[3].init.method, 'PATCH');
  for (const call of calls.slice(1)) assert.equal(JSON.parse(String(call.init.body)).request_id, requestId);
  assert.ok(calls.every(c => c.init.cache === 'no-store' && c.init.signal instanceof AbortSignal));
});

test('personal categories, invitations and transfer results need no project-editor route', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async path => { calls.push(String(path)); return Response.json({}); }) as typeof fetch;
  await getMyProjects('MEMBER', 40);
  await getMyCollaborations(20);
  await getMyTransfers(60);
  const first = new URL(calls[0], 'http://test');
  assert.equal(first.searchParams.get('role'), 'MEMBER');
  assert.equal(first.searchParams.get('offset'), '40');
  assert.match(calls[1], /\/me\/collaborations\?/);
  assert.match(calls[2], /\/me\/transfers\?/);
  assert.ok(calls.every(path => !path.includes('/project-drafts/')));
});

test('transfer selection and confirmation remain separate from version-bound proof download', async () => {
  const calls: {path: string; init: RequestInit}[] = [];
  globalThis.fetch = (async (path, init) => { calls.push({path: String(path), init: init ?? {}}); return String(path).includes('/evidence/') ? new Response('%PDF-1.7', {headers: {'Content-Type': 'application/pdf'}}) : Response.json({}); }) as typeof fetch;
  const payload = {request_id: requestId, target_ref: 'target', evidence_ids: ['selected'], allow_preview: true};
  await createTransfer('p', payload);
  await actTransfer('t/a', 'accept', {request_id: requestId, version: 4, confirmation_digest: 'a'.repeat(64)});
  const file = await readTransferProof('t/a', 'e/a', 4);
  assert.equal(await file.text(), '%PDF-1.7');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload);
  assert.match(calls[1].path, /ie\/transfers\/t%2Fa\/accept$/);
  assert.match(calls[2].path, /transfers\/t%2Fa\/evidence\/e%2Fa\?version=4$/);
  assert.equal(calls[2].init.body, undefined);
});

test('lifecycle confirmation and introduction publication preserve original digest and fields', async () => {
  const calls: {path: string; init: RequestInit}[] = [];
  globalThis.fetch = (async (path, init) => { calls.push({path: String(path), init: init ?? {}}); return Response.json({}); }) as typeof fetch;
  const fields = {title: '介绍', summary: '明确发布', direction: '教育', stage: '结项'};
  await getLifecycle('p/a');
  await actLifecycle('p/a', 'complete', {request_id: requestId, version: 3, confirmation_digest: 'a'.repeat(64)});
  await previewIntroduction('p/a', {version: 4, fields});
  await publishIntroduction('p/a', {request_id: requestId, version: 4, fields, preview_digest: 'b'.repeat(64)});
  assert.match(calls[0].path, /me\/project-drafts\/p%2Fa\/lifecycle$/);
  assert.match(calls[1].path, /p%2Fa\/complete$/);
  assert.equal(JSON.parse(String(calls[1].init.body)).confirmation_digest, 'a'.repeat(64));
  assert.match(calls[2].path, /introduction\/preview$/);
  assert.deepEqual(JSON.parse(String(calls[3].init.body)), {request_id: requestId, version: 4, fields, preview_digest: 'b'.repeat(64)});
});

test('late private download cannot settle across an authentication epoch', async () => {
  setAccessToken('demo-token');
  let finish!: () => void;
  globalThis.fetch = (async () => { await new Promise<void>(resolve => { finish = resolve; }); return new Response('private', {headers: {'Content-Type': 'application/pdf'}}); }) as typeof fetch;
  const reading = readTransferProof('t', 'e', 1);
  recordLogout(); finish();
  await assert.rejects(reading, {name: 'AbortError'});
});

test('all editor resource contracts remain scoped, paginated and preserve caller-owned fields',async()=>{
  setAccessToken('demo-token');const calls:{path:string;method:string;body:unknown}[]=[];
  globalThis.fetch=(async(path,init)=>{calls.push({path:String(path),method:init?.method??'GET',body:init?.body?JSON.parse(String(init.body)):null});return Response.json({});}) as typeof fetch;
  const p='/api/v1/ie/collaboration/projects/p%2Fa';
  const fields={title:'成果',description:'说明',work_url:'',award_text:''};
  const recruitment=normalizeRecruitmentForm(emptyRecruitmentForm());
  const version={request_id:requestId,version:2};
  await collaborationApi.getProjectCollaborators('p/a',20);
  await collaborationApi.getWorkspace('p/a');
  await collaborationApi.getWorkspaceAchievements('p/a',40);
  await collaborationApi.getWorkspaceAchievement('p/a','a/b');
  await collaborationApi.createWorkspaceAchievement('p/a',{...fields,request_id:requestId});
  await collaborationApi.saveWorkspaceAchievement('p/a','a/b',{...fields,...version});
  await collaborationApi.getWorkspaceRecruitments('p/a',60);
  await collaborationApi.getWorkspaceRecruitment('p/a','r/b');
  await collaborationApi.createWorkspaceRecruitment('p/a',{request_id:requestId,fields:recruitment});
  await collaborationApi.saveWorkspaceRecruitment('p/a','r/b',{...version,fields:recruitment});
  await collaborationApi.actWorkspaceRecruitment('p/a','r/b','close',version);
  await collaborationApi.revokeWorkspaceContact('p/a','r/b',{...version,channel:'EMAIL',close_if_last:true});
  await collaborationApi.getTransfer('t/a');
  await collaborationApi.getPublicProjectMembers('p/a');
  assert.deepEqual(calls.map(({path,method})=>[method,path]),[
    ['GET','/api/v1/ie/me/project-drafts/p%2Fa/collaborators?limit=20&offset=20'],
    ['GET',p],['GET',`${p}/achievements?limit=20&offset=40`],['GET',`${p}/achievements/a%2Fb`],
    ['POST',`${p}/achievements`],['PATCH',`${p}/achievements/a%2Fb`],
    ['GET',`${p}/recruitments?limit=20&offset=60`],['GET',`${p}/recruitments/r%2Fb`],
    ['POST',`${p}/recruitments`],['PATCH',`${p}/recruitments/r%2Fb`],
    ['POST',`${p}/recruitments/r%2Fb/close`],['POST',`${p}/recruitments/r%2Fb/revoke-contact`],
    ['GET','/api/v1/ie/transfers/t%2Fa'],['GET','/api/v1/ie/projects/p%2Fa/members'],
  ]);
  assert.deepEqual(calls[5].body,{...fields,...version});
  assert.deepEqual(calls[9].body,{...version,fields:recruitment});
  assert.deepEqual(recruitment,normalizeRecruitmentForm(emptyRecruitmentForm()));
});
