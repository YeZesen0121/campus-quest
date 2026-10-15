import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../lib/errors';
import { mentorStatus, mentorMutationError } from '../features/innovation/mentors/presentation';

test('mentor presentation separates pending confirmation from retained public profile and moderation',()=>{
  assert.match(mentorStatus({visibility:'VISIBLE',moderation_state:'NORMAL',confirmation_state:'PENDING'}),/展示中.*待本人确认/);
  assert.match(mentorStatus({visibility:'HIDDEN',moderation_state:'NORMAL',confirmation_state:'CONFIRMED'}),/未展示/);
  assert.match(mentorStatus({visibility:'VISIBLE',moderation_state:'TAKEN_DOWN',confirmation_state:'CONFIRMED'}),/停止展示/);
});
test('mentor conflict keeps input for explicit comparison but unknown outcome retains the original command',()=>{
  assert.equal(mentorMutationError(new ApiError({code:'CONFLICT',message:'changed',status:409})).refresh,true);
  assert.equal(mentorMutationError(new ApiError({code:'CONFLICT',message:'changed',status:409})).unknown,false);
  assert.equal(mentorMutationError(new Error('network')).unknown,true);
});
