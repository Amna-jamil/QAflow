import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { createStore } from '../server/store.js';
import { createApp } from '../server/app.js';
import { executeRun } from '../server/runner.js';
import { parseSteps } from '../shared/parser.js';
import { createServer as createViteServer } from 'vite';
import viteConfig from '../vite.config.js';
import { createServer as createFixtureServer } from 'node:http';

test('landing page password failures explain navigation; explicit Login step fixes the flow', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qaflow-login-navigation-'));
  const store = createStore(directory);
  const server = createFixtureServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(req.url === '/login'
      ? '<!doctype html><label for="email">Email</label><input id="email"><label for="password">Password</label><input id="password" type="password"><button onclick="document.querySelector(\'h1\').textContent=\'Signed in\'">Sign in</button><h1>Welcome back</h1>'
      : '<!doctype html><a href="/login">Login</a><label for="email">Email</label><input id="email"><div style="height:4000px">Public landing page</div>');
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const runSteps = async source => {
    const run = { id: randomUUID(), url: base, name: 'Login navigation regression', status: 'running', createdAt: new Date().toISOString(), steps: parseSteps(source).map(s => ({ ...s, status: 'pending' })) };
    await store.save(run); await executeRun(run, store, { timeout: 500 }); return run;
  };
  try {
    const failed = await runSteps('Open the page\nFill "Email" with "test@example.com"\nFill "Password" with "Example!Case24"');
    assert.equal(failed.steps[1].status, 'passed');
    assert.equal(failed.status, 'failed');
    assert.match(failed.steps[2].error, /Could not find a field/);
    assert.match(failed.steps[2].error, /Add Click "Login" before filling/);
    assert.ok(failed.steps[2].error.includes(`${base}/login`));
    assert.ok(!failed.steps[2].error.includes('\u001b['));
    assert.equal(failed.steps[2].pageUrl, `${base}/`);
    const { readFile } = await import('node:fs/promises');
    const png = await readFile(path.join(store.artifactsDir, path.basename(failed.steps[2].screenshot)));
    assert.equal(png.readUInt32BE(20), 800, 'Failure screenshot captures readable viewport rather than the 4000px page');
    const passed = await runSteps('Open the page\nClick "Login"\nFill "Email" with "test@example.com"\nFill "Password" with "Example!Case24"\nClick "Sign in"\nExpect to see "Signed in"');
    assert.equal(passed.status, 'passed');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('password shorthand fills a real password field in Chromium', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qaflow-password-'));
  const store = createStore(directory);
  const server = createFixtureServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html lang="en"><title>Password fixture</title><label for="password">Password</label><input id="password" type="password"><button onclick="document.querySelector('h1').textContent = document.querySelector('input').value === 'Example!Case24' ? 'Password accepted' : 'Wrong password'">Sign in</button><h1>Ready</h1></html>`);
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const run = {
      id: randomUUID(), name: 'Password shorthand regression',
      url: `http://127.0.0.1:${server.address().port}`, status: 'running', createdAt: new Date().toISOString(),
      steps: parseSteps('Open the page\nAdd password "Example!Case24"\nClick "Sign in"\nExpect to see "Password accepted"').map(step => ({ ...step, status: 'pending' }))
    };
    await store.save(run);
    await executeRun(run, store);
    assert.equal(run.status, 'passed', JSON.stringify(run.steps.map(({ status, error }) => ({ status, error }))));
    assert.equal((await store.get(run.id)).steps[1].status, 'passed');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('real Chromium: UI review, passing run, failed screenshot, persisted history, mobile and API validation', { timeout: 120000 }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'qaflow-e2e-'));
  const store = createStore(directory);
  const server = createApp(store).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser, vite;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(base);
    await page.getByRole('button', { name: 'Load sample test' }).click();
    await page.getByRole('button', { name: 'Review test', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.equal((await store.list()).length, 0, 'Review does not run the test');
    await page.getByRole('button', { name: 'Run test', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.results .card-heading .status')?.textContent.trim() === 'passed');
    assert.equal(await page.locator('.result-step .status.passed').count(), 4);
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: 'artifacts/passing-run.png', fullPage: true });
    await page.getByRole('button', { name: 'Edit & run again' }).click();
    await page.locator('#steps').fill('Open the page\nExpect to see "This text does not exist"\nClick "Sign in"');
    await page.getByRole('button', { name: 'Review test', exact: true }).click();
    await page.getByRole('button', { name: 'Run test', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.results .card-heading .status')?.textContent.trim() === 'failed');
    assert.equal(await page.locator('.result-step .status.failed').count(), 1);
    assert.equal(await page.locator('.result-step .status.skipped').count(), 1);
    const screenshotUrl = await page.locator('.failure-detail img').getAttribute('src');
    assert.equal((await fetch(`${base}${screenshotUrl}`)).status, 200);
    await page.reload();
    await page.getByRole('button', { name: /Run history/ }).click();
    assert.equal(await page.locator('tbody tr').count(), 2);
    await page.locator('tbody tr').first().getByRole('button', { name: 'Open Demo', exact: false }).click();
    await page.getByRole('heading', { name: 'Step 2 failed' }).waitFor();
    const persisted = createStore(directory);
    assert.equal((await persisted.list()).length, 2);
    await page.getByRole('button', { name: 'New test', exact: true }).click();
    await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile horizontal overflow');
    await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
    for (const body of [{ url: 'bad', steps: 'Open the page' }, { url: `${base}/demo`, steps: 'Do something' }]) {
      const response = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error);
    }
    assert.equal((await fetch(`${base}/api/runs`, { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    // Exercise the actual Vite proxy settings: string proxy shorthand rewrites Host
    // and would incorrectly trigger the local API's cross-origin protection.
    const proxy = Object.fromEntries(Object.entries(viteConfig.server.proxy).map(([key, value]) => [key, typeof value === 'string' ? base : { ...value, target: base }]));
    vite = await createViteServer({ ...viteConfig, configFile: false, server: { ...viteConfig.server, host: '127.0.0.1', port: 0, proxy } });
    await vite.listen();
    const devBase = `http://127.0.0.1:${vite.httpServer.address().port}`;
    assert.equal((await fetch(devBase)).status, 200);
    const devResponse = await fetch(`${devBase}/api/runs`, { method: 'POST', headers: { Origin: devBase, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'invalid', steps: 'Open the page' }) });
    assert.equal(devResponse.status, 400, 'Development proxy must preserve the original host so valid same-origin requests reach validation');
    // Check navigation failures and HTTP errors using the same production runner.
    for (const [url, pattern] of [[`${base}/api/missing-page`, /HTTP 404/], ['http://127.0.0.1:1', /Could not reach/]]) {
      const run = { id: randomUUID(), url, name: 'Failure validation', status: 'running', createdAt: new Date().toISOString(), steps: parseSteps('Open the page\nExpect to see "Welcome"').map(s => ({ ...s, status: 'pending' })) };
      await store.save(run);
      await executeRun(run, store, { timeout: 1000, navigationTimeout: 3000 });
      assert.equal(run.status, 'failed'); assert.match(run.steps[0].error, pattern); assert.ok(run.steps[0].screenshot);
    }
  } finally {
    if (vite) await vite.close();
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
