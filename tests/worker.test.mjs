import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import worker from '../worker.mjs';

globalThis.crypto ??= webcrypto;

class MemoryD1 {
  constructor() {
    this.keys = new Map();
  }

  prepare(query) {
    return {
      bind: (...values) => ({
        run: async () => {
          if (query.startsWith('INSERT')) {
            this.keys.set(values[0], null);
            return { meta: { changes: 1 } };
          }
          if (query.startsWith('UPDATE')) {
            if (!this.keys.has(values[1]) || this.keys.get(values[1]) !== null) {
              return { meta: { changes: 0 } };
            }
            this.keys.set(values[1], values[0]);
            return { meta: { changes: 1 } };
          }
          throw new Error(`Unexpected query: ${query}`);
        },
        first: async () => this.keys.has(values[0]) ? { activated_at: this.keys.get(values[0]) } : null,
      }),
    };
  }
}

const env = () => ({
  ADMIN_TOKEN: 'test-admin-token',
  ALLOWED_ORIGIN: 'https://belugaui5-creator.github.io',
  LICENSES: new MemoryD1(),
});

function request(path, { method = 'POST', headers = {}, body } = {}) {
  return new Request(`https://licenses.example${path}`, {
    method,
    headers,
    body,
  });
}

async function hash(key) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

test('rejects malformed keys before querying the key store', async () => {
  const environment = env();
  const result = await worker.fetch(request('/api/activate', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'invalid' }),
  }), environment);
  assert.equal(result.status, 400);
  assert.equal(environment.LICENSES.keys.size, 0);
});

test('rejects JSON null without throwing a server error', async () => {
  const result = await worker.fetch(request('/api/activate', {
    headers: { 'Content-Type': 'application/json' },
    body: 'null',
  }), env());
  assert.equal(result.status, 400);
});

test('answers CORS preflight without a response body and rejects other origins', async () => {
  const environment = env();
  const preflight = await worker.fetch(request('/api/activate', {
    method: 'OPTIONS',
    headers: { Origin: 'https://belugaui5-creator.github.io' },
  }), environment);
  assert.equal(preflight.status, 204);
  assert.equal(await preflight.text(), '');
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), environment.ALLOWED_ORIGIN);

  const blocked = await worker.fetch(request('/api/activate', {
    headers: { Origin: 'https://example.com' },
    body: JSON.stringify({ key: 'AIRO-23456-ABCDE-FGHJK-MNPQR' }),
  }), environment);
  assert.equal(blocked.status, 403);
});

test('activates a stored key once and rejects subsequent attempts', async () => {
  const environment = env();
  const key = 'AIRO-23456-ABCDE-FGHJK-MNPQR';
  environment.LICENSES.keys.set(await hash(key), null);
  const makeRequest = () => request('/api/activate', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });

  const first = await worker.fetch(makeRequest(), environment);
  assert.equal(first.status, 200);
  assert.match((await first.json()).message, /успешно активирован/);
  const second = await worker.fetch(makeRequest(), environment);
  assert.equal(second.status, 409);
});

test('issues high-entropy keys only to the authenticated seller and stores only a hash', async () => {
  const environment = env();
  const denied = await worker.fetch(request('/api/keys'), environment);
  assert.equal(denied.status, 401);

  const issued = await worker.fetch(request('/api/keys', {
    headers: { Authorization: 'Bearer test-admin-token' },
  }), environment);
  assert.equal(issued.status, 201);
  const { key } = await issued.json();
  assert.match(key, /^AIRO-(?:[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}-){3}[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/);
  assert.equal(environment.LICENSES.keys.has(key), false);
  assert.equal(environment.LICENSES.keys.has(await hash(key)), true);
});
