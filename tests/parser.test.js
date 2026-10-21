import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSteps, validateUrl } from '../shared/parser.js';
test('parses all formats including curly quotes, case, CRLF and blank lines', () => {
  const steps = parseSteps(' Open the page\r\n\r\nclick “Sign in”\r\nFill "Email" with "test@example.com"\r\nExpect to see "Welcome"');
  assert.deepEqual(steps.map(s => s.type), ['open', 'click', 'fill', 'expect']);
  assert.equal(steps[1].line, 3);
  assert.equal(steps[2].value, 'test@example.com');
});
test('empty fill values clear fields and values preserve case', () => {
  assert.equal(parseSteps('Open the page\nFill "Name" with ""')[1].value, '');
  assert.equal(parseSteps('Open the page\nClick "SIGN IN"')[1].target, 'SIGN IN');
});
test('rejects arbitrary commands, malformed quotes and ambiguous prose with guidance', () => {
  for (const step of ['Click Sign in', 'Click "Sign in" then wait', 'Evaluate "process.exit()"', 'Expect "Welcome"', 'Click ""']) {
    assert.throws(() => parseSteps(`Open the page\n${step}`), /line 2.*(supported formats|To click|To check)/);
  }
});
test('accepts password shorthand as the normal fill action without altering the value', () => {
  const steps = parseSteps('Open the page\nAdd password "Example!Case24"\nADD PASSWORD ""\nAdd password \u201cAnother!Value\u201d');
  assert.deepEqual(steps.slice(1).map(({ type, target, value }) => ({ type, target, value })), [
    { type: 'fill', target: 'Password', value: 'Example!Case24' },
    { type: 'fill', target: 'Password', value: '' },
    { type: 'fill', target: 'Password', value: 'Another!Value' }
  ]);
  assert.equal(parseSteps('Open the page\nFill "Password" with "Example!Case24"')[1].value, steps[1].value);
});
test('gives command-specific rewrites without repeating entered password values', () => {
  for (const step of ['Add password secret123', 'Add password "secret123" then submit', 'Fill "Password" "secret123"']) {
    assert.throws(() => parseSteps(`Open the page\n${step}`), error => {
      assert.match(error.message, /line 2.*Fill "Password" with "your password"/);
      assert.ok(!error.message.includes('secret123'));
      return true;
    });
  }
  assert.throws(() => parseSteps('Open the page\nFill Email with value'), /Fill "Field label" with "value"/);
});
test('requires navigation first and enforces step and input limits', () => {
  assert.throws(() => parseSteps('Click "Hello"'), /Start your test/);
  for (const input of ['', null, 'a'.repeat(12001), Array(31).fill('Open the page').join('\n')]) assert.throws(() => parseSteps(input));
  assert.equal(parseSteps(Array(30).fill('Open the page').join('\n')).length, 30);
});
test('accepts http/https including localhost and rejects unsafe or invalid URLs', () => {
  assert.equal(validateUrl(' https://example.com '), 'https://example.com/');
  assert.equal(validateUrl('http://localhost:4000/demo'), 'http://localhost:4000/demo');
  for (const url of ['', undefined, 'example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'https://user:password@example.com', 'not a url']) assert.throws(() => validateUrl(url));
});
