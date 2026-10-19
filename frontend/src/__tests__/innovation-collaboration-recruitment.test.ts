import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { collaborationRecruitmentTransport } from '../features/innovation/collaboration/recruitmentTransport';
import { recordLogout, setAccessToken } from '../lib/accessToken';
const original=globalThis.fetch;
afterEach(()=>{globalThis.fetch=original;recordLogout();});
test('shared recruitment editor collaboration transport has only scoped editor routes',async()=>{
  setAccessToken('token');const calls:string[]=[];
  globalThis.fetch=(async(path)=>{calls.push(String(path));return Response.json({});}) as typeof fetch;
  const transport=collaborationRecruitmentTransport;
  await transport.listRecruitments('p');await transport.getRecruitment('p','r');
  const body={request_id:'request',version:2};
  await transport.publishRecruitment('p','r',body);await transport.closeRecruitment('p','r',body);
  await transport.reopenRecruitment('p','r',body);await transport.confirmActiveRecruitment('p','r',body);
  await transport.revokeRecruitmentContact('p','r',{...body,channel:'EMAIL',close_if_last:false});
  assert.ok(calls.every(path=>path.startsWith('/api/v1/ie/collaboration/projects/p/recruitments')));
  assert.deepEqual(calls.slice(2).map(path=>path.split('/').at(-1)),['publish','close','reopen','confirm-active','revoke-contact']);
});
