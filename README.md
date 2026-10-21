# QAFlow

A local web app for turning simple manual checks into real Playwright browser tests. No accounts, paid services, API keys, or AI integration. React + Vite provide the interface; Express runs Chromium and saves run history on your machine.

## Setup

Install [Node.js](https://nodejs.org/) 22.12 or later (Node 24 LTS recommended), then run in this folder:

```sh
git clone https://github.com/Amna-jamil/QAflow.git
cd QAflow
npm ci
npm run setup:browser
npm run dev
```

Open **http://127.0.0.1:5173**. The Vite development server proxies API requests to the local Node server on port 3001. On Linux, if Chromium is missing system libraries, use `npx playwright install --with-deps chromium`.

For a production build served entirely by Node:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Keep the terminal running. Stop with Ctrl+C. `PORT` changes the production server port; development expects port 3001. The server binds to 127.0.0.1 for local use.

## Try your first test

1. Click **Load sample test**. It fills in the URL of the included local `/demo` page and these steps:

   ```text
   Open the page
   Fill "Email" with "test@example.com"
   Click "Sign in"
   Expect to see "Welcome"
   ```

2. Click **Review test**, inspect the URL and steps, then **Run test**.
3. Watch each step update. Open **Run history** to revisit a run, or **Edit & run again** to reuse its steps.
4. To see a real failure and screenshot, change the last line to `Expect to see "Goodbye"` and run again.

For your own app, enter its full `http://` or `https://` URL, including its port for local apps. QAFlow reaches it from the machine running the Node server. Pages that return HTTP 400 or higher fail navigation; connection and timeout errors appear in the result.

If the URL opens a public landing page, first navigate to the form, for example `Open the page` followed by `Click "Login"`, then fill Email and Password. Alternatively, enter the sign-in page URL directly. QAFlow follows your explicit steps; it does not automatically find or open a sign-in form. Missing-field failures include the current page URL and suggest a visible Login/Sign in link when one can be identified. Failure screenshots capture the browser viewport so long pages remain readable.

## Supported language

One instruction per line, up to 30 steps and 12,000 characters. Start with `Open the page`. Blank lines are ignored. Command words are case-insensitive; target names and expected text match exactly, including case. Straight double quotes and typographic double quotes are accepted. Literal double quotes inside values and multiline values are not supported.

| Format | Behavior |
| --- | --- |
| `Open the page` | Navigate to the application URL; repeated navigation uses the same URL. |
| `Click "Sign in"` | Find a button or link by accessible name, with exact visible-text fallback. |
| `Fill "Email" with "test@example.com"` | Fill a field by exact accessible label or placeholder. An empty value clears it. |
| `Add password "your password"` | Shorthand for `Fill "Password" with "your password"`; targets a field labeled Password or with that exact placeholder. |
| `Expect to see "Welcome"` | Wait for an exact text match to be visible. |

For password fields with a different label, use that exact label, for example `Fill "Enter password" with "your password"`. Unsupported instructions show a command-specific rewrite where possible. Use unique names: multiple matching elements produce a helpful failure instead of silently clicking the first. Unsupported instructions are rejected before any browser actions. The implementation uses [Playwright locators](https://playwright.dev/docs/locators) and their built-in waiting, not generated JavaScript or paid language models.

## Results and storage

Each run uses a fresh headless Chromium context at 1280 × 800. Steps run in order. The first failing step records its error and screenshot; subsequent steps are **Skipped**, not passed. If Chromium cannot launch or the page has closed, the result explains why a screenshot is unavailable. Default action timeout: 8 seconds; navigation: 20 seconds. A two-minute elapsed-time guard is checked before each step; an in-progress action can take its remaining timeout before stopping. Only one test runs at a time.

Run JSON files live in `data/runs/`; screenshots live in `data/artifacts/`. Writes use a temporary file and rename. The server recovers interrupted runs on restart as failed with an explanation. Files survive browser refreshes and server restarts. To choose another location, set `QAFLOW_DATA_DIR` before starting the server. To reset history, stop the server and remove `data/`. There is no automatic retention policy.

Values entered in tests, errors, and screenshots may contain sensitive data, and are stored as plain local files. Use test data. Run only tests against applications you intend to interact with: actions can change the target app. This MVP is a local tool, not a public multi-user service. It permits local/private target URLs intentionally and rejects cross-origin API requests. Do not expose its server to the internet.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

Unit tests cover parser syntax, malformed input, password shorthand and rewrite guidance, limits, URL validation, disk persistence, sorting, and path handling. End-to-end tests start an isolated server with temporary storage, exercise the UI in real Chromium, verify that review does not execute, run passing and failing tests, fetch a failure screenshot, reopen history after refresh, check mobile overflow, and test invalid requests, development proxy behavior, cross-origin rejection, HTTP errors, and unreachable pages. Dedicated regressions cover real password-field entry and missing-field navigation advice on landing pages. Build before running the end-to-end suite. UI screenshots are written to ignored `artifacts/`; temporary test run data is removed afterward.

## Project layout

```text
src/             React interface and responsive styles
shared/parser.js Shared deterministic step parser and URL validation
server/          HTTP API, Playwright runner, disk storage, demo page
tests/           Unit, storage, and real-browser end-to-end tests
data/            Local run history and failure screenshots (gitignored)
```

## Current limits

Chromium only. No saved authentication sessions, iframe/shadow-specific commands, multi-tab flows, file uploads, CAPTCHA solving, visual assertions, scheduling, cancellation, or parallel runs. A site must expose usable visible text or accessible field names. Assertions match a single element’s exact text rather than arbitrary page-wide substrings. No natural language beyond the four core formats and the documented password shorthand. The local JSON store is designed for a single server process and a modest history, with no database, search, or pagination. The UI uses optional Google Fonts with system fallbacks; testing and storage do not depend on that service.
