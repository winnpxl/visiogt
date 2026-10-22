import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPreviewServer, validateSignup } from '../scripts/dev-server.mjs';

const talent = { audience: 'talent', fullName: 'Preview Tester', email: 'TALENT@example.com', phone: '+234 801 234 5678', location: 'Lagos', role: 'Developer', experience: 'student', skills: 'React', portfolio: '', source: 'Campus community', consent: true };
const client = { audience: 'client', fullName: 'Client Tester', email: 'client@example.com', company: 'Preview Co', project: 'Website', budget: 'USD 1,000–3,000', timeline: 'Exploring', source: 'LinkedIn', consent: true };

test('students can omit a portfolio; other experience levels need a web URL', () => {
  assert.equal(validateSignup(talent).portfolio, '');
  assert.throws(() => validateSignup({ ...talent, experience: 'graduate' }));
  assert.throws(() => validateSignup({ ...talent, portfolio: 'javascript:alert(1)' }));
  assert.equal(validateSignup({ ...talent, experience: 'experienced', portfolio: 'https://example.com/work' }).portfolio, 'https://example.com/work');
});

test('rejects missing consent, invalid contact data, and unknown choices', () => {
  for (const changes of [{ consent: false }, { fullName: '  ' }, { email: 'bad' }, { phone: '08012345678' }, { phone: '+123' }, { role: 'invalid' }, { experience: 'invalid' }, { source: '' }]) {
    assert.throws(() => validateSignup({ ...talent, ...changes }));
  }
  assert.throws(() => validateSignup({ ...client, project: 'invalid' }));
  assert.throws(() => validateSignup({ ...client, timeline: 'invalid' }));
  assert.equal(validateSignup(talent).email, 'talent@example.com');
});

test('both audiences persist privately; invalid requests never save', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'visio-api-test-'));
  const server = createPreviewServer({ dataDir });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(base + '/api/waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    for (const signup of [talent, client]) {
      const response = await post({ ...signup, attribution: { utm_source: 'event-qr', utm_campaign: 'launch' } });
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { ok: true, preview: true });
    }
    assert.equal((await post({ ...talent, consent: false })).status, 400);
    assert.equal((await post(talent, { Origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await post(talent, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post({ ...talent, skills: 'x'.repeat(17000) })).status, 413);
    const records = (await readFile(path.join(dataDir, 'waitlist.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 2);
    assert.equal(records[0].attribution.utm_source, 'event-qr');
    assert.equal(records[1].audience, 'client');
    assert.equal((await stat(path.join(dataDir, 'waitlist.jsonl'))).mode & 0o777, 0o600);
    for (const route of ['/.local/waitlist.jsonl', '/.git/config', '/scripts/dev-server.mjs', '/assets/../.local/waitlist.jsonl', '/assets/%2e%2e%2f.local/waitlist.jsonl', '/package.json']) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
    for (const route of ['/', '/waitlist.html', '/assets/css/waitlist.css', '/assets/js/waitlist.js']) {
      assert.equal((await fetch(base + route)).status, 200, route);
    }
    assert.equal((await fetch(base + '/api/waitlist')).status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  }
});
