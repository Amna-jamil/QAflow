export const formats = ['Open the page', 'Click "Sign in"', 'Fill "Email" with "test@example.com"', 'Expect to see "Welcome"'];
export function validateUrl(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Enter a full web address, for example https://example.com.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid URL including http:// or https://.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Use an http:// or https:// URL without embedded credentials.');
  return url.href;
}
export function parseStep(text, line) {
  const raw = text.trim();
  const normalized = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (/^open the page$/i.test(normalized)) return { type: 'open', raw, line };
  let match = normalized.match(/^click\s+"([^"\n]+)"$/i);
  if (match) return { type: 'click', target: match[1], raw, line };
  match = normalized.match(/^fill\s+"([^"\n]+)"\s+with\s+"([^"\n]*)"$/i);
  if (match) return { type: 'fill', target: match[1], value: match[2], raw, line };
  // A small, deterministic shorthand for the password instruction users naturally write.
  // It uses the same field-filling action as Fill "Password" with "...".
  match = normalized.match(/^add\s+password\s+"([^"\n]*)"$/i);
  if (match) return { type: 'fill', target: 'Password', value: match[1], raw, line };
  match = normalized.match(/^expect to see\s+"([^"\n]+)"$/i);
  if (match) return { type: 'expect', target: match[1], raw, line };
  let rewrite = 'Use one of the supported formats with double quotes: Open the page; Click "Sign in"; Fill "Email" with "test@example.com"; Expect to see "Welcome".';
  if (/^(add\s+password|fill\s+["']?password\b)/i.test(normalized)) {
    rewrite = 'To enter a password, use: Fill "Password" with "your password" or Add password "your password". Use double quotes and no extra instructions on the same line.';
  } else if (/^fill\b/i.test(normalized)) {
    rewrite = 'To enter text, use: Fill "Field label" with "value". Put both the field label and value in double quotes.';
  } else if (/^click\b/i.test(normalized)) {
    rewrite = 'To click an element, use: Click "Sign in". Put its exact visible text in double quotes and use one instruction per line.';
  } else if (/^expect\b/i.test(normalized)) {
    rewrite = 'To check visible text, use: Expect to see "Welcome". Put the exact expected text in double quotes.';
  }
  throw new Error(`Step on line ${line}: cannot understand this instruction. ${rewrite}`);
}
export function parseSteps(input) {
  if (typeof input !== 'string' || input.length > 12000) throw new Error('Enter test steps using at most 12,000 characters.');
  const lines = input.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 })).filter(x => x.text.trim());
  if (!lines.length || lines.length > 30) throw new Error('Add between 1 and 30 steps, one per line.');
  const steps = lines.map(({ text, line }) => parseStep(text, line));
  if (steps[0].type !== 'open') throw new Error('Start your test with: Open the page');
  return steps;
}
