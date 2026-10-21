import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Check, CircleCheck, CircleX, Clock3, FlaskConical, Globe2, History, Layers3, LoaderCircle, Play, Plus, ShieldCheck, Sparkles, Terminal, X } from 'lucide-react';
import { formats, parseSteps, validateUrl } from '../shared/parser.js';
import './styles.css';

const sample = 'Open the page\nFill "Email" with "test@example.com"\nClick "Sign in"\nExpect to see "Welcome"';
const duration = ms => ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`;
const date = value => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
async function api(url, options) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('QAFlow could not reach its server. Make sure npm run dev or npm start is running.'); }
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
function Status({ value }) { return <span className={`status ${value}`}>{value === 'running' ? <LoaderCircle size={13} className="spin"/> : value === 'passed' ? <CircleCheck size={13}/> : value === 'failed' ? <CircleX size={13}/> : <Clock3 size={13}/>} {value}</span>; }
function App() {
  const [tab, setTab] = useState('builder');
  const [name, setName] = useState('Sign-in smoke test');
  const [url, setUrl] = useState('');
  const [steps, setSteps] = useState(sample);
  const [review, setReview] = useState(null);
  const [runs, setRuns] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState(false);
  const [help, setHelp] = useState(false);
  const refresh = async () => { const data = await api('/api/runs'); setRuns(data); return data; };
  useEffect(() => { refresh().then(data => { const running = data.find(r => r.status === 'running'); if (running) { setActive(running); setTab('results'); } }).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (active?.status !== 'running') return;
    let disposed = false;
    const interval = setInterval(async () => {
      try { const run = await api(`/api/runs/${active.id}`); if (!disposed) { setActive(run); if (run.status !== 'running') await refresh(); } }
      catch (e) { if (!disposed) setError(e.message); }
    }, 700);
    return () => { disposed = true; clearInterval(interval); };
  }, [active?.id, active?.status]);
  const edit = setter => event => { setter(event.target.value); setReview(null); setError(''); };
  function loadSample() { setUrl(`${window.location.origin}/demo`); setSteps(sample); setName('Demo · sign-in smoke test'); setReview(null); setError(''); setTab('builder'); }
  function validate(event) {
    event.preventDefault(); setError('');
    try { const validUrl = validateUrl(url); const parsed = parseSteps(steps); setReview({ url: validUrl, steps: parsed, name: name.trim() || 'Untitled test', source: steps }); }
    catch (e) { setError(e.message); }
  }
  async function run() {
    setLaunching(true); setError('');
    try { const result = await api('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: review.name, url: review.url, steps: review.source }) }); setActive(result); setTab('results'); setReview(null); await refresh(); }
    catch (e) { setReview(null); setError(e.message); }
    finally { setLaunching(false); }
  }
  function openRun(run) { setActive(run); setError(''); setTab('results'); }
  const passed = runs.filter(r => r.status === 'passed').length;
  const running = runs.some(r => r.status === 'running') || active?.status === 'running';
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="QAFlow home"><span className="brand-mark"><Layers3 size={23}/></span>QAFlow<span className="brand-dot">.</span></a>
      <div className="workspace"><span className="workspace-avatar">W</span><div>My workspace<small>Local environment</small></div><span className="local-dot"/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav><button className={tab === 'builder' ? 'selected' : ''} onClick={() => { setTab('builder'); setError(''); }}><FlaskConical size={18}/>Test builder<span className="nav-plus">+</span></button><button className={tab === 'history' || tab === 'results' ? 'selected' : ''} onClick={() => { setTab('history'); refresh().catch(e => setError(e.message)); }}><History size={18}/>Run history<span className="count">{runs.length}</span></button></nav>
      <div className="sidebar-bottom"><div className="local-note"><span className="mini-icon"><ShieldCheck size={19}/></span><strong>Your tests. Your machine.</strong><p>Powered by open-source tools.<br/>No keys, no cloud, no setup fees.</p><span><i/> Saved locally</span></div><button className="help-link" onClick={() => setHelp(true)}><Terminal size={16}/>Quick guide<ArrowUpRight size={15}/></button><div className="version">QAFlow MVP <span>v1.0</span></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div>Workspace <span>/</span> <strong>{tab === 'builder' ? 'Test builder' : tab === 'history' ? 'Run history' : 'Run results'}</strong></div><span className="engine"><i/> Playwright + Chromium</span></header>
      <main><div className="page-heading"><div className="eyebrow">A LITTLE LESS MANUAL. A LOT MORE CONFIDENT.</div><div className="heading-row"><div><h1>{tab === 'builder' ? 'Great tests start with simple steps.' : tab === 'history' ? 'Every run, in one place.' : 'Your test, step by step.'}</h1><p>{tab === 'builder' ? 'Describe the check. Review the steps. Let your browser do the rest.' : tab === 'history' ? 'Revisit results, investigate failures, and keep moving forward.' : 'Real browser actions. Clear results. Nothing left to guess.'}</p></div>{tab !== 'builder' && <button className="primary" onClick={() => { setTab('builder'); setError(''); }}><Plus size={16}/>New test</button>}</div></div>
        <section className="stats"><div><span className="stat-icon"><Layers3 size={19}/></span><div><small>Total runs</small><strong>{runs.length}<em>all time</em></strong></div></div><div><span className="stat-icon green"><CircleCheck size={19}/></span><div><small>Passed runs</small><strong>{passed}<em>{runs.length ? `${Math.round(passed / runs.length * 100)}% pass rate` : 'Ready when you are'}</em></strong></div></div><div><span className="stat-icon amber"><Clock3 size={19}/></span><div><small>Latest activity</small><strong className="stat-date">{runs[0] ? date(runs[0].createdAt) : 'No runs yet'}<em>{runs[0] ? runs[0].name : 'Let’s run your first test'}</em></strong></div></div></section>
        {error && <div className="error-banner" role="alert"><CircleX size={19}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
        {tab === 'builder' && <div className="builder-layout"><section className="card builder"><div className="card-heading"><span className="section-icon"><FlaskConical size={20}/></span><div><h2>Create a test</h2><p>Turn your everyday checks into a repeatable flow.</p></div><span className="pill">NEW TEST</span></div><form onSubmit={validate}><label htmlFor="test-name">Test name <span>Optional</span></label><input id="test-name" value={name} onChange={edit(setName)} maxLength={100} placeholder="e.g. Sign-in smoke test"/><label htmlFor="url">Application URL</label><div className="url-input"><Globe2 size={18}/><input id="url" value={url} onChange={edit(setUrl)} placeholder="https://your-app.com" required spellCheck="false"/></div><p className="field-hint">Use a full URL. Localhost apps work, too.</p><div className="label-row"><label htmlFor="steps">Test steps</label><button type="button" className="text-button" onClick={loadSample}><Sparkles size={13}/>Try a sample</button></div><div className="editor"><div className="line-numbers" aria-hidden="true">{steps.split('\n').map((_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div><textarea id="steps" value={steps} onChange={edit(setSteps)} spellCheck="false" maxLength={12000} aria-describedby="steps-hint"/></div><div className="editor-bottom"><span id="steps-hint">One step per line · double quotes around text</span><span>{steps.split('\n').filter(s => s.trim()).length} / 30 steps</span></div><div className="form-actions"><span><ShieldCheck size={15}/>Runs locally in a real browser</span><button className="primary" type="submit">Review test<ArrowRight size={16}/></button></div></form></section>
          <aside className="right-column"><section className="card guide"><div className="guide-title"><span className="mini-icon"><Terminal size={19}/></span><h2>Simple words. Real actions.</h2></div><p>No code needed. Use these four supported formats to build your flow.</p><div className="format-list">{formats.map((format, i) => <div key={format}><span className="format-type">{['NAVIGATE', 'INTERACT', 'ENTER TEXT', 'VERIFY'][i]}</span><code>{format}</code></div>)}</div><div className="guide-tip"><span>↳</span><p>Use the exact visible text for buttons and links, or a field’s label or placeholder. For passwords, use Fill "Password" with "your password". Add password "your password" also works.</p></div></section><section className="sample-card"><span className="sample-badge"><Sparkles size={14}/>YOUR FIRST FLOW</span><h3>Take it for a test drive.</h3><p>Try our local demo. It’s a simple sign-in check, ready to run.</p><button onClick={loadSample}>Load sample test<ArrowUpRight size={17}/></button></section></aside>
        </div>}
        {tab === 'history' && <section className="card history-card"><div className="card-heading"><History size={21}/><h2>Run history</h2><span className="pill">{runs.length} RUNS</span></div>{runs.length ? <div className="table-wrap"><table><thead><tr><th>Test</th><th>Status</th><th>Started</th><th>Duration</th><th/></tr></thead><tbody>{runs.map(r => <tr key={r.id}><td><button className="run-name" onClick={() => openRun(r)}>{r.name}</button><small className="run-url">{r.url}</small></td><td><Status value={r.status}/></td><td>{date(r.createdAt)}</td><td>{duration(r.durationMs)}</td><td><button className="icon-button" aria-label={`Open ${r.name}`} onClick={() => openRun(r)}><ArrowUpRight size={18}/></button></td></tr>)}</tbody></table></div> : <div className="empty"><History size={32}/><h3>A clean slate.</h3><p>Your completed tests will show up here.</p><button className="primary" onClick={loadSample}>Try the sample test<ArrowRight size={15}/></button></div>}</section>}
        {tab === 'results' && active && <section className="card results"><div className="card-heading"><div><h2>{active.name}</h2><p className="result-url">{active.url}</p></div><Status value={active.status}/></div><div className="result-meta"><span>{date(active.createdAt)}</span><span>{active.steps.filter(s => s.status === 'passed').length} / {active.steps.length} passed</span><span>{duration(active.durationMs)}</span></div>{active.error && <div className="run-error" role="alert">{active.error}</div>}<ol className="results-list">{active.steps.map((s, i) => <li key={i}><div className="result-step"><span className={`step-number ${s.status}`}>{s.status === 'passed' ? <Check size={16}/> : i + 1}</span><strong>{s.raw}</strong><span className="step-duration">{duration(s.durationMs)}</span><Status value={s.status}/></div>{s.error && <div className="failure-detail"><h3>Step {i + 1} failed</h3><pre>{s.error}</pre>{s.screenshot && <a href={s.screenshot} target="_blank" rel="noreferrer"><img src={s.screenshot} alt={`Browser screenshot when step ${i + 1} failed`}/><span>Open full screenshot <ArrowUpRight size={14}/></span></a>}{s.screenshotError && <p>{s.screenshotError}</p>}</div>}</li>)}</ol><div className="result-footer">{active.status === 'running' ? <span className="live"><LoaderCircle size={16} className="spin"/> Running in Chromium. You can keep this page open for live results.</span> : <><span><ShieldCheck size={15}/>This run is saved on your machine.</span><button className="secondary" onClick={() => { setName(active.name); setUrl(active.url); setSteps(active.steps.map(s => s.raw).join('\n')); setReview(null); setTab('builder'); }}>Edit & run again<ArrowRight size={15}/></button></>}</div></section>}
        <footer className="page-footer"><span><i/>LOCAL BY DESIGN</span><span>Built for the checks you’d rather not repeat.</span><span>Open source. Always.</span></footer>
      </main>
    </div>
    {review && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><button className="close-modal" onClick={() => setReview(null)} aria-label="Close review"><X size={20}/></button><span className="review-icon"><FlaskConical size={24}/></span><h2 id="review-title">Ready for a real browser?</h2><p>Review your test before running. Each step will execute in a fresh Chromium session.</p><div className="review-summary"><strong>{review.name}</strong><small>{review.url}</small></div><ol className="review-steps">{review.steps.map((s, i) => <li key={i}><span>{i + 1}</span>{s.raw}</li>)}</ol><p className="review-note">Stops at the first failure. Results and failure screenshots are saved locally.</p><div className="modal-actions"><button className="secondary" onClick={() => setReview(null)}>Keep editing</button><button className="primary" onClick={run} disabled={launching || running}>{launching ? <LoaderCircle size={16} className="spin"/> : <Play size={15}/>} {running ? 'Another test is running' : launching ? 'Starting…' : 'Run test'}</button></div></section></div>}
    {help && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="close-modal" aria-label="Close guide" onClick={() => setHelp(false)}><X size={20}/></button><h2 id="help-title">Your quick guide</h2><p>Enter your application’s full URL and write one supported step per line, starting with “Open the page”. Review the steps, then run your test.</p><div className="format-list">{formats.map(f => <code key={f}>{f}</code>)}</div><p>Password shorthand: Add password "your password" works like Fill "Password" with "your password". For other field names, use their exact label. Names must match exactly. Use unique button text, field labels, or placeholders. A failure stops the test; later steps are skipped. Run history is saved in the local data folder.</p><p>The first version supports Chromium, a fresh browser session per run, and up to 30 steps. It does not handle CAPTCHAs, iframes, file uploads, or multi-tab flows.</p><button className="primary" onClick={() => { setHelp(false); loadSample(); }}>Try the sample<ArrowRight size={16}/></button></section></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
