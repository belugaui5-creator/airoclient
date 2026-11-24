import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  activateLicenseKey,
  isValidLicenseKey,
  normalizeLicenseKey,
} from '../license.mjs';

const VALID_KEY = 'AIRO-23456-ABCDE-FGHJK-MNPQR';

test('normalizes pasted keys and validates the expected format', () => {
  assert.equal(normalizeLicenseKey(' airo-23456-abcde-fghjk-mnpqr '), VALID_KEY);
  assert.equal(isValidLicenseKey(VALID_KEY), true);
  assert.equal(isValidLicenseKey('AIRO-2345-ABCDE-FGHJK-MNPQR'), false);
  assert.equal(isValidLicenseKey('AIRO-23456-ABCDE-FGHJK-MNPQO'), false);
});

test('activation sends the key to the configured backend', async () => {
  let request;
  const result = await activateLicenseKey(VALID_KEY, 'https://licenses.example/', async (...args) => {
    request = args;
    return { ok: true, json: async () => ({ message: 'Ключ успешно активирован.' }) };
  });
  assert.equal(request[0], 'https://licenses.example/api/activate');
  assert.equal(request[1].method, 'POST');
  assert.deepEqual(JSON.parse(request[1].body), { key: VALID_KEY });
  assert.equal(result.message, 'Ключ успешно активирован.');
});

test('does not send malformed keys or silently accept an unconfigured backend', async () => {
  let requests = 0;
  const fetchMock = async () => {
    requests += 1;
    throw new Error('Unexpected request');
  };
  await assert.rejects(activateLicenseKey('not-a-key', 'https://licenses.example', fetchMock), /формат ключа/);
  await assert.rejects(activateLicenseKey(VALID_KEY, '', fetchMock), /пока не настроен/);
  assert.equal(requests, 0);
});

test('reports an invalid backend response instead of showing an activation error from the runtime', async () => {
  await assert.rejects(
    activateLicenseKey(VALID_KEY, 'https://licenses.example', async () => ({
      ok: true,
      json: async () => { throw new Error('invalid JSON'); },
    })),
    /некорректный ответ/,
  );
});

test('purchase link points to the seller profile and opens safely in a new tab', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /href="https:\/\/funpay\.com\/users\/21173765\/"[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /Перейти в профиль FunPay/);
});
