# AiroClient
Статический сайт загрузки AiroClient для Minecraft 1.21.4 (GitHub Pages).

## Покупка и ключи

Покупка проходит вручную в [профиле FunPay](https://funpay.com/users/21173765/). После подтверждения оплаты продавец создаёт ключ через защищённый backend и передаёт его покупателю вручную. Интеграции с FunPay API нет.

GitHub Pages не запускает серверный код. Для активации подготовлен отдельный Cloudflare Worker с базой D1:

1. Установи Node.js и Wrangler (`npm install --global wrangler`), затем выполни `npx wrangler d1 create airoclient-license-keys`.
2. Вставь выданный `database_id` в `wrangler.toml` вместо `REPLACE_WITH_D1_DATABASE_ID`.
3. Примени схему и задай секрет продавца:

   ```powershell
   npx wrangler d1 migrations apply airoclient-license-keys --remote
   npx wrangler secret put ADMIN_TOKEN
   ```

   Сгенерируй длинное случайное значение (например, `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`), введи его в prompt Wrangler и сохрани в менеджере паролей. Для выпуска ключей задавай то же значение локальной переменной окружения `AIRO_ADMIN_TOKEN`. Не добавляй его в файлы сайта или репозитория.
4. Опубликуй Worker командой `npx wrangler deploy`. `ALLOWED_ORIGIN` уже настроен для GitHub Pages; при смене домена укажи origin сайта без пути.
5. В `script.js` установи `LICENSE_API_URL` равным публичному URL Worker (например, `https://airoclient-license-api.<account>.workers.dev`) и опубликуй сайт.
6. После оплаты создай ключ из PowerShell, не раскрывая секрет в клиентском коде:

   ```powershell
   $headers = @{ Authorization = "Bearer $env:AIRO_ADMIN_TOKEN" }
   Invoke-RestMethod -Method Post -Uri "https://<worker-host>/api/keys" -Headers $headers
   ```

   Ответ содержит новый ключ — он сохраняется в D1 только в виде SHA-256-хеша и показывается один раз. Передай его покупателю вручную. Покупатель активирует ключ на сайте; каждый ключ активируется один раз.

**Важно:** пока Worker не развёрнут и `LICENSE_API_URL` не настроен, форма активации сообщает, что сервис недоступен. Выданная активация записывается в D1, но сама по себе не закрывает доступ к ZIP: сейчас архив остаётся публичным по ссылке GitHub Releases. Чтобы ограничить скачивание, потребуется отдельно разместить защищённый файл и реализовать авторизацию загрузки/проверку лицензии в клиенте. Не помещай мастер-ключи или секреты в браузер.

## Тесты

При установленном Node.js выполни `node --test`.
