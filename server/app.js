import express from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { parseSteps, validateUrl } from '../shared/parser.js';
import { executeRun } from './runner.js';
export function createApp(store) {
  const app = express();
  let busy = false;
  app.use((req, res, next) => {
    // A local browser runner must not accept commands from arbitrary websites.
    const origin = req.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Cross-origin requests are not allowed.' }); }
      catch { return res.status(403).json({ error: 'Invalid origin.' }); }
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/runs', async (req, res) => res.json(await store.list()));
  app.get('/api/runs/:id', async (req, res) => {
    const run = await store.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'This run was not found.' });
    res.json(run);
  });
  app.post('/api/runs', async (req, res) => {
    if (busy) return res.status(409).json({ error: 'A test is already running. Wait for it to finish.' });
    let url, steps;
    try { url = validateUrl(req.body.url); steps = parseSteps(req.body.steps); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const run = { id: randomUUID(), name: String(req.body.name || 'Untitled test').slice(0, 100), url, createdAt: new Date().toISOString(), status: 'running', steps: steps.map(s => ({ ...s, status: 'pending' })) };
    busy = true;
    try { await store.save(run); }
    catch (error) { busy = false; throw error; }
    res.status(202).json(run);
    executeRun(run, store).catch(error => console.error('Run failed to persist:', error.message)).finally(() => { busy = false; });
  });
  app.use('/artifacts', express.static(store.artifactsDir, { index: false, dotfiles: 'deny' }));
  app.get('/demo', (req, res) => res.type('html').send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>QAFlow demo</title><style>body{font:18px system-ui;background:#eef4f1;display:grid;place-items:center;min-height:95vh}main{padding:48px;background:white;border-radius:20px;max-width:360px}label,input{display:block}input{padding:12px;margin:8px 0 24px;font:inherit}button{background:#166e58;color:white;border:0;border-radius:8px;padding:12px 24px;font:inherit}</style><main><h1>A little test drive.</h1><p>This is QAFlow’s local demo app.</p><form><label for="email">Email</label><input id="email" type="email" required placeholder="you@example.com"><button>Sign in</button></form><h2 hidden>Welcome</h2><script>document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('h2').hidden=false}</script></main></html>`));
  app.use(express.static(path.resolve('dist')));
  app.get('/{*path}', (req, res) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found.' }); res.sendFile(path.resolve('dist/index.html')); });
  app.use((error, req, res, next) => { console.error(error.message); res.status(error.status || 500).json({ error: error.status === 400 ? 'Invalid JSON request.' : 'Unable to complete the request. Check the server terminal and try again.' }); });
  return app;
}
