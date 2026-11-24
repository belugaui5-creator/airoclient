import { activateLicenseKey, normalizeLicenseKey } from './license.mjs';

// Replace this URL with the public file link when hosting the site online.
const DOWNLOAD_URL = 'https://github.com/belugaui5-creator/airoclient/releases/latest/download/AiroClient.zip';
// Set this to the deployed Worker URL; it is public configuration, not a secret.
const LICENSE_API_URL = '';

document.addEventListener('DOMContentLoaded', () => {
  const downloadLinks = document.querySelectorAll('a[download]');
  for (const link of downloadLinks) {
    link.href = DOWNLOAD_URL;
    link.addEventListener('click', () => {
      link.setAttribute('aria-label', 'Скачивание AiroClient.zip началось');
    });
  }

  const activationForm = document.querySelector('#activation-form');
  const keyInput = document.querySelector('#license-key');
  const status = document.querySelector('#activation-status');
  activationForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.dataset.state = '';
    status.textContent = 'Проверяем ключ…';
    const submitButton = activationForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const result = await activateLicenseKey(keyInput.value, LICENSE_API_URL);
      status.dataset.state = 'success';
      status.textContent = result.message || 'Ключ успешно активирован.';
    } catch (error) {
      status.dataset.state = 'error';
      status.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  keyInput?.addEventListener('input', () => {
    const start = keyInput.selectionStart;
    const end = keyInput.selectionEnd;
    keyInput.value = normalizeLicenseKey(keyInput.value);
    keyInput.setSelectionRange(start, end);
  });
});
