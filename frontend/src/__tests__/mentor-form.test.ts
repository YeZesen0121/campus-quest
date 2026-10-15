import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyMentorFields, normalizeMentorFields, validateMentorFields, validateMentorConsent } from '../features/innovation/mentors/form';
import { buildMentorQuery, mentorListHref, parseMentorQuery } from '../features/innovation/mentors/query';

test('mentor drafts allow incomplete content but confirm requires the displayed identity and direction',()=>{
  assert.deepEqual(validateMentorFields(emptyMentorFields()),{});
  const errors=validateMentorFields(emptyMentorFields(),true);
  for(const key of ['name','unit','introduction','directions','project_types'] as const) assert.ok(errors[key]);
  assert.equal(errors.achievements,undefined);
});
test('mentor field limits count codepoints and reject invalid or duplicate contact channels',()=>{
  assert.equal(validateMentorFields({...emptyMentorFields(),name:'🌱'.repeat(50)}).name,undefined);
  assert.ok(validateMentorFields({...emptyMentorFields(),name:'🌱'.repeat(51)}).name);
  assert.ok(validateMentorFields({...emptyMentorFields(),contacts:[{channel:'EMAIL',value:'bad'}]}).contacts);
  assert.ok(validateMentorFields({...emptyMentorFields(),contacts:[{channel:'QQ',value:'12345'},{channel:'QQ',value:'23456'}]}).contacts);
});
test('mentor save trims only text and does not manufacture consent',()=>{
  const fields=normalizeMentorFields({...emptyMentorFields(),name:' 模拟导师 ',contacts:[{channel:'EMAIL',value:' qa@example.invalid '}]});
  assert.equal(fields.name,'模拟导师');assert.deepEqual(fields.contacts,[{channel:'EMAIL',value:'qa@example.invalid'}]);
  assert.equal('authorized_fields' in fields,false);
});
test('mentor contact consent is explicit, bound to shown channels, and can publish paused',()=>{
  const fields={...emptyMentorFields(),name:'模拟导师',unit:'模拟学院',introduction:'模拟介绍',directions:'学习',project_types:'学习实践',contacts:[{channel:'EMAIL' as const,value:'qa@example.invalid'}]};
  assert.ok(validateMentorConsent(fields,{confirm_profile:false,contact_channels:[],authorized_fields:[],accepting_contact:false}));
  assert.ok(validateMentorConsent(fields,{confirm_profile:true,contact_channels:[],authorized_fields:[],accepting_contact:true}));
  assert.ok(validateMentorConsent(fields,{confirm_profile:true,contact_channels:['PHONE'],authorized_fields:[],accepting_contact:true}));
  assert.equal(validateMentorConsent(fields,{confirm_profile:true,contact_channels:[],authorized_fields:[],accepting_contact:false}),'');
  assert.equal(validateMentorConsent(fields,{confirm_profile:true,contact_channels:['EMAIL'],authorized_fields:['introduction'],accepting_contact:true}),'');
});
test('mentor directory query preserves false and rejects arbitrary navigation and malformed pages',()=>{
  assert.equal(buildMentorQuery(parseMentorQuery(new URLSearchParams('q= AI &direction=学习&accepting_contact=false&offset=20'))).toString(),'q=AI&direction=%E5%AD%A6%E4%B9%A0&accepting_contact=false&offset=20');
  assert.equal(mentorListHref('next=https://evil.invalid&offset=-1&accepting_contact=anything'),'/innovation/mentors');
});
