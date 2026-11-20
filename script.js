// Replace this URL with the public file link when hosting the site online.
const DOWNLOAD_URL = 'https://github.com/belugauji5-creator/airoclient/releases/latest/download/AiroClient.zip';

document.addEventListener('DOMContentLoaded', () => {
  const downloadLinks = document.querySelectorAll('a[download]');
  for (const link of downloadLinks) {
    link.href = DOWNLOAD_URL;
    link.addEventListener('click', () => {
      link.setAttribute('aria-label', 'Скачивание AiroClient.zip началось');
    });
  }
});
