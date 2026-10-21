import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createStore } from '../server/store.js';
test('persists and reloads runs, sorts newest first and rejects traversal', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qaflow-store-'));
  try {
    const store = createStore(directory);
    const a = { id: randomUUID(), createdAt: '2026-01-01', status: 'running' };
    const b = { id: randomUUID(), createdAt: '2026-01-02', status: 'passed' };
    await store.save(a); await store.save(b);
    a.status = 'failed'; await store.save(a);
    const reopened = createStore(directory);
    assert.equal((await reopened.get(a.id)).status, 'failed');
    assert.deepEqual((await reopened.list()).map(r => r.id), [b.id, a.id]);
    assert.equal(await reopened.get('../package'), null);
    assert.equal(await reopened.get(randomUUID()), null);
    await assert.rejects(() => store.save({ id: '../escape' }), /Invalid run ID/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
