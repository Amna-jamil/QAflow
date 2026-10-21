import { chromium } from 'playwright';
import path from 'node:path';
export async function executeRun(run, store, options = {}) {
  let browser, page;
  const started = Date.now();
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: false });
    page = await context.newPage();
    page.setDefaultTimeout(options.timeout ?? 8000);
    page.setDefaultNavigationTimeout(options.navigationTimeout ?? 20000);
    // Dialogs are dismissed by Playwright by default. Tests never execute user-provided code.
    for (let i = 0; i < run.steps.length; i++) {
      const step = run.steps[i];
      step.status = 'running';
      await store.save(run);
      const stepStart = Date.now();
      try {
        if (Date.now() - started > 120000) throw new Error('Run exceeded the two-minute limit. Split this test into smaller tests.');
        if (step.type === 'open') {
          const response = await page.goto(run.url, { waitUntil: 'domcontentloaded' });
          if (response && response.status() >= 400) throw new Error(`The page returned HTTP ${response.status()}. Check the address and whether the page is available.`);
        } else if (step.type === 'click') {
          const target = page.getByRole('button', { name: step.target, exact: true })
            .or(page.getByRole('link', { name: step.target, exact: true }));
          if (await target.count() > 0) await target.click();
          else await page.getByText(step.target, { exact: true }).click();
        } else if (step.type === 'fill') {
          await page.getByLabel(step.target, { exact: true })
            .or(page.getByPlaceholder(step.target, { exact: true })).fill(step.value);
        } else if (step.type === 'expect') {
          await page.getByText(step.target, { exact: true }).waitFor({ state: 'visible' });
        }
        step.status = 'passed';
      } catch (error) {
        step.status = 'failed';
        step.pageUrl = page.url();
        step.error = await describeStepFailure(error, step, page);
        const file = `${run.id}-${i + 1}.png`;
        try {
          // Capture the viewport so long landing pages do not become unreadable thumbnails.
          await page.screenshot({ path: path.join(store.artifactsDir, file), fullPage: false, timeout: 5000 });
          step.screenshot = `/artifacts/${file}`;
        } catch { step.screenshotError = 'The browser could not capture a screenshot (the page may have closed).'; }
        for (const remaining of run.steps.slice(i + 1)) remaining.status = 'skipped';
      }
      step.durationMs = Date.now() - stepStart;
      await store.save(run);
      if (step.status === 'failed') break;
    }
    run.status = run.steps.some(s => s.status === 'failed') ? 'failed' : 'passed';
  } catch (error) {
    run.status = 'failed';
    run.error = helpfulError(error);
    const pending = run.steps.find(s => ['pending', 'running'].includes(s.status));
    if (pending) { pending.status = 'failed'; pending.error = run.error; }
    run.steps.filter(s => ['pending', 'running'].includes(s.status)).forEach(s => { s.status = 'skipped'; });
  } finally {
    if (browser) await browser.close().catch(() => {});
    run.finishedAt = new Date().toISOString();
    run.durationMs = Date.now() - started;
    await store.save(run);
  }
  return run;
}
async function describeStepFailure(error, step, page) {
  const details = helpfulError(error);
  if (step.type !== 'fill' || error.name !== 'TimeoutError') return details;
  try {
    const matching = page.getByLabel(step.target, { exact: true }).or(page.getByPlaceholder(step.target, { exact: true }));
    if (await matching.count()) return `The field "${step.target}" exists but could not be filled. Check whether it is visible, enabled, and editable.\n\n${details}`;
    const login = await page.getByRole('link', { name: /^(log\s?in|sign\s?in)$/i }).evaluateAll(links => links.filter(link => link.getClientRects().length).map(link => ({ name: link.innerText.trim(), url: link.href })));
    let guidance = 'Check that the correct form is open and use the field\'s exact label or placeholder.';
    if (login.length === 1) guidance = `This page has a "${login[0].name}" link. Add Click "${login[0].name}" before filling the sign-in fields, or set the Application URL to ${login[0].url}.`;
    return `Could not find a field labeled or placeholder "${step.target}" on ${page.url()}.\n${guidance}\nQAFlow does not navigate to a sign-in form automatically.\n\n${details}`;
  } catch { return details; }
}
function helpfulError(error) {
  const message = (error.message || String(error)).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '');
  if (/Executable doesn't exist/.test(message)) return 'Chromium is not installed. Run npm run setup:browser in the QAFlow folder, then try again.';
  if (/net::ERR_/.test(message)) return `Could not reach the page. Check the URL, internet connection, and whether the app is running. ${message}`;
  if (/strict mode violation/.test(message)) return `More than one element matches. Use a unique visible label or text. ${message}`;
  return message;
}
