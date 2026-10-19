import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectSourceText, transferChanges, transferStatus, collaborationStatus, collaborationError, transferChecklistChanges } from '../features/innovation/collaboration/presentation';
import { ApiError } from '../lib/errors';
import type { Transfer } from '../features/innovation/collaboration/api';

test('archived recruitment text never claims achievement verification', () => {
  assert.match(projectSourceText({source_kind:'INTRODUCTION',introduction_source:'RECRUITMENT',introduction_revision:2}), /招募.*免审/);
  assert.match(projectSourceText({source_kind:'INTRODUCTION',introduction_source:'ACHIEVEMENT',introduction_revision:2}), /项目介绍.*成果另行核实/);
  assert.match(projectSourceText({source_kind:'ACHIEVEMENT',introduction_source:null,introduction_revision:null}), /已核实成果版本/);
});
test('checklist differences expose equal-count replacement and leave missing historical lists unknown',()=>{
  const before={relationships:[{reference:'old',kind:'MEMBER',name:'原确认姓名',division:'原分工',scope:'PUBLIC_NAME_ONLY'}],closing_recruitments:[{reference:'job',role_name:'研究伙伴',status:'OPEN',deadline_at:null}]};
  const after={relationships:[{reference:'new',kind:'MEMBER',name:'新确认姓名',division:'新分工',scope:'PUBLIC_NAME_ONLY'}],closing_recruitments:[{reference:'job',role_name:'新岗位名称',status:'OPEN',deadline_at:null}]};
  const changes=transferChecklistChanges({initial_summary:before,current_summary:after} as unknown as Transfer);
  assert.equal(changes.length,3);assert.match(JSON.stringify(changes),/原确认姓名/);assert.match(JSON.stringify(changes),/新确认姓名/);assert.match(JSON.stringify(changes),/新岗位名称/);
  assert.doesNotMatch(JSON.stringify(changes),/state_digest|target_user_id|contacts/);
  assert.deepEqual(transferChecklistChanges({initial_summary:{relationships:null,closing_recruitments:null},current_summary:after} as unknown as Transfer),[]);
});
test('legacy introduction metadata is unknown and never presented as an empty original revision',()=>{
  const before={snapshot_version:1,introduction_revision:null};const current={snapshot_version:2,introduction_revision:1};
  assert.deepEqual(transferChanges({initial_summary:before,current_summary:current} as unknown as Transfer),[]);
});
test('state confirmation differences use readable status names',()=>{
  const value={initial_summary:{snapshot_version:2,lifecycle:'ACTIVE'},current_summary:{snapshot_version:2,lifecycle:'COMPLETED'}} as unknown as Transfer;
  assert.deepEqual(transferChanges(value),[{label:'项目状态',before:'进行中',after:'已结项'}]);
});
test('transfer blockers have specific handling directions while lookup uncertainty stays uncertain',()=>{
  const qualification=new ApiError({code:'CONFLICT',status:409,message:'opaque',details:{kind:'TARGET_QUALIFICATION_REQUIRED'}});
  const pending=new ApiError({code:'CONFLICT',status:409,message:'opaque',details:{kind:'PENDING_REVIEW'}});
  assert.match(collaborationError(qualification).message,/接任人.*负责人资格/);
  assert.match(collaborationError(pending).message,/待核实.*等待结果.*撤回/);
  assert.match(collaborationError(qualification,true).message,/无法确认原操作结果/);
});
test('terminal result labels describe the actual state, including expiry and invalidation', () => {
  assert.equal(transferStatus('ACCEPTED'), '交接已生效');
  assert.equal(transferStatus('INVALIDATED'), '交接已失效');
  assert.equal(transferStatus('EXPIRED'), '交接已到期');
  assert.equal(collaborationStatus('REVOKED'), '已撤销或退出');
});
test('confirmation differences exclude hashes and internal metadata', () => {
  const initial = {title:'旧名称',state_digest:'secret-before',project_version:1,ownership_generation:1,open_recruitment_count:2};
  const current = {...initial,title:'新名称',state_digest:'secret-after',project_version:2,open_recruitment_count:3};
  const changes = transferChanges({initial_summary:initial,current_summary:current} as unknown as Transfer);
  assert.ok(changes.some(row => row.label === '项目名称' && row.before === '旧名称' && row.after === '新名称'));
  assert.ok(changes.some(row => row.label === '开放岗位数' && row.after === '3'));
  assert.doesNotMatch(JSON.stringify(changes), /secret|state_digest|ownership_generation/);
  assert.deepEqual(transferChanges({initial_summary:null,current_summary:null} as Transfer), []);
});
