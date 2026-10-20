import assert from 'node:assert/strict';

assert.equal(process.env.CQ_E2E_MOCK_STORAGE, '1', 'Host mock-storage flag must reach the dedicated wire test');
assert.equal(process.env.CQ_E2E_CAPTURE_DIR, '/workspace/infra/integration/.runtime/captures/forwarding-proof', 'Capture output must stay inside this integration runtime');
console.log('INTEGRATION_SPECIAL_FLAGS=PASS');
