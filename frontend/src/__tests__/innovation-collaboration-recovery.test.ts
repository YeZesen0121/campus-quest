import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecoveryStore } from '../features/innovation/mentors/recoveryStore';

type Command = {request_id: string; version: number; fields: {title: string}};
type Value = {status: string};
type Context = {draft: {title: string}};
const scope = {userId: 'A', authEpoch: 1, workspace: 'project:p:save'};
const body = (): Command => ({request_id: 'original-key', version: 3, fields: {title: '原输入'}});
const context = (): Context => ({draft: {title: '原输入'}});
function auth() {
  let epoch = 1;
  const listeners = new Set<() => void>();
  return {
    getAuthEpoch: () => epoch,
    onAuthEpochChange: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    advance: () => { epoch++; for (const fn of listeners) fn(); },
    isUnknown: (cause: unknown) => cause instanceof TypeError,
  };
}

test('unknown writes reconcile first, then reuse frozen command and input', async () => {
  const events: string[] = []; const sent: Command[] = []; let attempts = 0;
  const options = {...auth(), execute: async (command: Command): Promise<Value> => { events.push('write'); sent.push(command); if (++attempts === 1) throw new TypeError('response lost'); return {status: 'SAVED'}; }, reconcile: async () => { events.push('read'); return {status: 'retry' as const}; }};
  const store = createRecoveryStore<Command, Context, Value>(options);
  const command = body(); const input = context();
  assert.equal((await store.start(scope, command, input)).status, 'unknown');
  command.fields.title = '改动后的输入'; input.draft.title = '后续修改';
  assert.equal(store.read(scope)?.context.draft.title, '原输入');
  assert.equal((await store.retry(scope)).status, 'success');
  assert.deepEqual(events, ['write', 'read', 'write']);
  assert.deepEqual(sent, [body(), body()]);
  assert.equal(store.hasPending(), false); store.dispose();
});

test('failed status lookup retains unknown original even when lookup itself returns 403', async () => {
  let writes = 0; let unavailable = true;
  const options = {...auth(), execute: async (): Promise<Value> => { if (++writes === 1) throw new TypeError('lost'); return {status: 'SAVED'}; }, reconcile: async () => { if (unavailable) throw {status: 403}; return {status: 'retry' as const}; }};
  const store = createRecoveryStore<Command, Context, Value>(options);
  await store.start(scope, body(), context());
  assert.equal((await store.retry(scope)).status, 'unknown');
  assert.equal(writes, 1); assert.equal(store.read(scope)?.command.request_id, 'original-key');
  unavailable = false;
  assert.equal((await store.retry(scope)).status, 'success');
  assert.equal(writes, 2); store.dispose();
});

test('authoritative completed lookup settles without another mutation', async () => {
  let writes = 0;
  const options = {...auth(), execute: async (): Promise<Value> => { writes++; throw new TypeError('lost'); }, reconcile: async () => ({status: 'resolved' as const, value: {status: 'ACCEPTED'}})};
  const store = createRecoveryStore<Command, Context, Value>(options);
  await store.start(scope, body(), context());
  const outcome = await store.retry(scope);
  assert.deepEqual(outcome, {status: 'success', value: {status: 'ACCEPTED'}});
  assert.equal(writes, 1); assert.equal(store.read(scope), null); store.dispose();
});

test('authentication change during reconciliation suppresses late state and any replay', async () => {
  const identity = auth(); let writes = 0; let finish!: () => void;
  const options = {...identity, execute: async (): Promise<Value> => { writes++; throw new TypeError('lost'); }, reconcile: async () => { await new Promise<void>(resolve => { finish = resolve; }); return {status: 'retry' as const}; }};
  const store = createRecoveryStore<Command, Context, Value>(options);
  await store.start(scope, body(), context());
  const retrying = store.retry(scope); await Promise.resolve();
  identity.advance(); finish();
  assert.equal((await retrying).status, 'stale');
  assert.equal(writes, 1); assert.equal(store.read({...scope, userId: 'B', authEpoch: 2}), null);
  assert.equal(store.hasPending(), false); store.dispose();
});

test('known mutation rejection clears its command; user and workspace records stay separate', async () => {
  const options = {...auth(), execute: async (): Promise<Value> => { throw {status: 409}; }, reconcile: async () => ({status: 'retry' as const})};
  const store = createRecoveryStore<Command, Context, Value>(options);
  assert.equal((await store.start(scope, body(), context())).status, 'rejected');
  assert.equal(store.read(scope), null);
  assert.equal(store.read({...scope, userId: 'B'}), null);
  assert.equal(store.read({...scope, workspace: 'other'}), null);
  store.dispose();
});
