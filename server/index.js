import path from 'node:path';
import { createStore } from './store.js';
import { createApp } from './app.js';
const store = createStore(path.resolve(process.env.QAFLOW_DATA_DIR || 'data'));
// Recover interrupted runs so history never remains permanently in progress.
for (const run of await store.list()) {
  if (run.status === 'running') {
    run.status = 'failed'; run.error = 'The server stopped before this run finished. Run the test again.';
    run.steps.forEach(s => { if (s.status === 'running' || s.status === 'pending') s.status = 'skipped'; });
    run.finishedAt = new Date().toISOString(); await store.save(run);
  }
}
createApp(store).listen(Number(process.env.PORT || 3001), '127.0.0.1', () => console.log(`QAFlow is ready at http://127.0.0.1:${process.env.PORT || 3001}`));
