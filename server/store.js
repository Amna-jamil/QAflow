import { mkdir, readdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
export function createStore(directory) {
  const runsDir = path.join(directory, 'runs');
  const artifactsDir = path.join(directory, 'artifacts');
  const ready = Promise.all([mkdir(runsDir, { recursive: true }), mkdir(artifactsDir, { recursive: true })]);
  const valid = id => typeof id === 'string' && /^[a-f0-9-]{36}$/.test(id);
  return {
    artifactsDir,
    async save(run) {
      await ready;
      if (!valid(run.id)) throw new Error('Invalid run ID.');
      const file = path.join(runsDir, `${run.id}.json`);
      await writeFile(`${file}.tmp`, JSON.stringify(run, null, 2));
      await rename(`${file}.tmp`, file);
    },
    async get(id) {
      await ready;
      if (!valid(id)) return null;
      try { return JSON.parse(await readFile(path.join(runsDir, `${id}.json`), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    async list() {
      await ready;
      const files = (await readdir(runsDir)).filter(f => f.endsWith('.json'));
      const runs = await Promise.all(files.map(async f => { try { return JSON.parse(await readFile(path.join(runsDir, f), 'utf8')); } catch { return null; } }));
      return runs.filter(Boolean).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  };
}
