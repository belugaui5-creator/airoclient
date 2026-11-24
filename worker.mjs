const DEFAULT_ALLOWED_ORIGIN = 'https://belugaui5-creator.github.io';
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const KEY_PATTERN = /^AIRO-(?:[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}-){3}[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/;
const encoder = new TextEncoder();

function response(body, status, env, request, extraHeaders = {}) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  const origin = request.headers.get('Origin');
  if (!origin || origin === (env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)) {
    headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Vary', 'Origin');
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function secureStringEqual(left, right) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    mismatch |= (a[i] || 0) ^ (b[i] || 0);
  }
  return mismatch === 0;
}

function generateLicenseKey() {
  let chars = '';
  while (chars.length < 20) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    for (const byte of bytes) {
      if (byte < 248) chars += KEY_ALPHABET[byte % KEY_ALPHABET.length];
      if (chars.length === 20) break;
    }
  }
  return `AIRO-${chars.match(/.{5}/g).join('-')}`;
}

async function hashLicenseKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(key));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > 512) throw new Error('Слишком большой запрос.');
  return JSON.parse(text);
}

async function handleIssue(request, env) {
  if (!env.ADMIN_TOKEN) {
    return response({ message: 'Сервис выдачи ключей не настроен.' }, 503, env, request);
  }
  const authorization = request.headers.get('Authorization') || '';
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  if (authorization.length > 2048 || !secureStringEqual(authorization, expected)) {
    return response({ message: 'Требуется авторизация продавца.' }, 401, env, request);
  }

  const key = generateLicenseKey();
  const hash = await hashLicenseKey(key);
  await env.LICENSES.prepare(
    'INSERT INTO license_keys (key_hash, created_at) VALUES (?, ?)',
  ).bind(hash, new Date().toISOString()).run();
  return response({ key }, 201, env, request);
}

async function handleActivate(request, env) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    return response({ message: 'Отправь корректный JSON-запрос.' }, 400, env, request);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.key !== 'string') {
    return response({ message: 'Введи ключ активации.' }, 400, env, request);
  }
  const key = body.key.trim().toUpperCase().replace(/\s+/g, '');
  if (!KEY_PATTERN.test(key)) {
    return response({ message: 'Проверь формат ключа: AIRO-XXXXX-XXXXX-XXXXX-XXXXX.' }, 400, env, request);
  }

  const hash = await hashLicenseKey(key);
  const updated = await env.LICENSES.prepare(
    'UPDATE license_keys SET activated_at = ? WHERE key_hash = ? AND activated_at IS NULL',
  ).bind(new Date().toISOString(), hash).run();
  if (updated.meta.changes === 1) {
    return response({ message: 'Ключ успешно активирован.' }, 200, env, request);
  }

  const existing = await env.LICENSES.prepare(
    'SELECT activated_at FROM license_keys WHERE key_hash = ?',
  ).bind(hash).first();
  if (!existing) {
    return response({ message: 'Ключ не найден. Проверь его или обратись к продавцу.' }, 404, env, request);
  }
  return response({ message: 'Этот ключ уже был активирован.' }, 409, env, request);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== (env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)) {
      return response({ message: 'Источник запроса не разрешён.' }, 403, env, request);
    }
    if (request.method === 'OPTIONS') return response({}, 204, env, request);

    const url = new URL(request.url);
    if (url.pathname === '/api/keys' && request.method === 'POST') {
      return handleIssue(request, env);
    }
    if (url.pathname === '/api/activate' && request.method === 'POST') {
      return handleActivate(request, env);
    }
    if (url.pathname === '/api/keys' || url.pathname === '/api/activate') {
      return response({ message: 'Метод не поддерживается.' }, 405, env, request, { Allow: 'POST, OPTIONS' });
    }
    return response({ message: 'Маршрут не найден.' }, 404, env, request);
  },
};
