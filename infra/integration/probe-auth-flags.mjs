import assert from 'node:assert/strict';
const actual = {fence: process.env.CQ_E2E_FENCE, probe: process.env.CQ_E2E_PROBE};
console.log('DEDICATED_AUTH_FLAGS=' + JSON.stringify(actual));
assert.deepEqual(actual, {fence:'1', probe:'1'}, 'Explicit host flags must reach the dedicated auth tests');
