// Local preview only. The production site must connect /api/waitlist to its signup service.
import http from 'node:http';
import { readFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = new Set(['index.html', 'clients.html', 'talent.html', 'about.html', 'waitlist.html']);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2' };

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}

export function validateSignup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid signup');
  if (!['talent', 'client'].includes(input.audience) || input.consent !== true) throw new Error('Audience and consent are required');
  const clean = { audience: input.audience, consent: true };
  const fields = { fullName: 120, email: 254, source: 200, ...(input.audience === 'talent'
    ? { phone: 30, location: 120, role: 50, experience: 50, skills: 500 }
    : { company: 160, project: 50, budget: 120, timeline: 50 }) };
  for (const [key, max] of Object.entries(fields)) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) throw new Error('Invalid ' + key);
    clean[key] = input[key].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) throw new Error('Invalid email');
  clean.email = clean.email.toLowerCase();
  if (clean.audience === 'talent') {
    if (!['Developer', 'Designer', 'Other'].includes(clean.role)) throw new Error('Invalid role');
    if (!['student', 'graduate', 'experienced', 'senior'].includes(clean.experience)) throw new Error('Invalid experience');
    if (!/^\+[\d\s().-]{7,29}$/.test(clean.phone) || !/^\d{8,15}$/.test(clean.phone.replace(/\D/g, ''))) throw new Error('Invalid phone');
    clean.portfolio = typeof input.portfolio === 'string' ? input.portfolio.trim() : '';
    if (clean.experience !== 'student' && !clean.portfolio) throw new Error('Portfolio required');
    if (clean.portfolio) {
      const link = new URL(clean.portfolio);
      if (!['http:', 'https:'].includes(link.protocol) || !link.hostname || clean.portfolio.length > 500) throw new Error('Invalid portfolio');
    }
  } else {
    if (!['Website', 'App', 'Design', 'Brand', 'Other'].includes(clean.project)) throw new Error('Invalid project');
    if (!['Immediately', 'Within a month', 'Exploring'].includes(clean.timeline)) throw new Error('Invalid timeline');
  }
  clean.attribution = {};
  for (const key of ['ref', 'source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (typeof input.attribution?.[key] === 'string') clean.attribution[key] = input.attribution[key].slice(0, 200);
  }
  return clean;
}

export function createPreviewServer({ dataDir = path.join(root, '.local') } = {}) {
  return http.createServer(async (req, res) => {
    try {
      // Restrict to loopback hosts, including protection against DNS rebinding.
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return json(res, 403, { ok: false });
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (url.pathname === '/api/waitlist') {
        if (req.method !== 'POST') return json(res, 405, { ok: false });
        if (req.headers.origin && req.headers.origin !== url.origin) return json(res, 403, { ok: false });
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { ok: false });
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { ok: false });
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) { json(res, 413, { ok: false }); return; }
          chunks.push(chunk);
        }
        let signup;
        try { signup = validateSignup(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { return json(res, 400, { ok: false, error: 'Please check your signup details.' }); }
        await mkdir(dataDir, { recursive: true, mode: 0o700 });
        const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...signup };
        const file = await open(path.join(dataDir, 'waitlist.jsonl'), 'a', 0o600);
        try { await file.writeFile(JSON.stringify(record) + '\n'); await file.sync(); }
        finally { await file.close(); }
        return json(res, 201, { ok: true, preview: true });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { ok: false });
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const segments = relative.split('/');
      // Serve only public site files; signup records, repository files and scripts stay private.
      const allowedAsset = relative.startsWith('assets/') && segments.every(part => part && !part.startsWith('.')) && mime[path.extname(relative)];
      if (!pages.has(relative) && !allowedAsset) return json(res, 404, { ok: false });
      const content = await readFile(path.join(root, relative));
      res.writeHead(200, { 'Content-Type': mime[path.extname(relative)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      json(res, error.code === 'ENOENT' ? 404 : 500, { ok: false, error: 'Unable to complete the request.' });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4321);
  const server = createPreviewServer();
  server.on('error', error => { console.error('Preview server:', error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Visio preview: http://127.0.0.1:${port}`);
    console.log('Waitlist signups are saved locally to .local/waitlist.jsonl (not sent to Visio).');
  });
}
