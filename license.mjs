export const LICENSE_KEY_PATTERN = /^AIRO-(?:[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}-){3}[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/;

export function normalizeLicenseKey(value) {
  return String(value).trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidLicenseKey(value) {
  return LICENSE_KEY_PATTERN.test(normalizeLicenseKey(value));
}

export async function activateLicenseKey(value, apiUrl, fetchImpl = globalThis.fetch) {
  const key = normalizeLicenseKey(value);
  if (!isValidLicenseKey(key)) {
    throw new Error('Проверь формат ключа: AIRO-XXXXX-XXXXX-XXXXX-XXXXX.');
  }
  if (!apiUrl) {
    throw new Error('Сервис активации пока не настроен. Обратись к продавцу в FunPay.');
  }

  const response = await fetchImpl(`${apiUrl.replace(/\/+$/, '')}/api/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Сервис активации вернул некорректный ответ. Попробуй позже.');
  }
  if (!result || typeof result !== 'object') {
    throw new Error('Сервис активации вернул некорректный ответ. Попробуй позже.');
  }
  if (!response.ok) {
    throw new Error(result.message || 'Не удалось активировать ключ. Попробуй ещё раз.');
  }
  return result;
}
