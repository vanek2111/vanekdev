# FORMA Detail Studio

Сайт детейлинг-студии с личным кабинетом. Локально поддерживается Node.js + SQLite; для GitHub Pages используются Supabase Auth, Postgres и Edge Function.

## Локальный запуск

```sh
cd detailing
npm start
```

Открой `http://127.0.0.1:8787/vanekdev/detailing/`. Локальная база хранится в `data/forma.sqlite` и не публикуется в Git.

## Подключение отдельного проекта Supabase

1. Создайте проект Supabase специально для FORMA. Не используйте проект ExoTech.
2. В SQL Editor запустите `supabase/migrations/202610090001_forma_schema.sql`.
3. В Project Settings → API Keys → Legacy возьмите Project URL и ключ `anon` (он помечен Supabase как публичный). Создайте рядом с `index.html` файл `forma-supabase-config.js` по образцу `forma-supabase-config.example.js`. В Edge Function оставлена проверка legacy JWT, поэтому здесь используется `anon`; RLS закрывает доступ к таблицам. Никогда не используйте `service_role` или secret key на клиенте.
4. Создайте аккаунт владельца через страницу `account.html`, затем выдайте ему роль владельца запросом в SQL Editor:

   ```sql
   insert into public.forma_staff (user_id, role)
   select id, 'owner' from auth.users where lower(email) = lower('ВАША_ПОЧТА')
   on conflict (user_id) do update set role = 'owner';
   ```

5. Установите Supabase CLI, из каталога `detailing` выполните `supabase login`, `supabase link --project-ref ВАШ_PROJECT_REF`, затем `supabase functions deploy forma-booking`.
6. В настройках Edge Function Secrets задайте `FORMA_ALLOWED_ORIGINS` со значениями `https://vanek2111.github.io,http://127.0.0.1:8787`. Если позже вернёте уведомления n8n, добавьте `N8N_BOOKING_WEBHOOK` туда же. Supabase сам передаёт функции секретный ключ проекта; ключи `secret`/`service_role` не копируйте в сайт и не отправляйте в чат.
7. Включите подтверждение адреса электронной почты в Auth → Providers → Email по своему сценарию. Если подтверждение выключено, новый владелец может войти сразу; затем обновите кабинет.
8. Добавьте `forma-supabase-config.js`, схему и функцию в Git и публикуйте сайт на GitHub Pages. В браузер попадает только URL проекта и публичный ключ `anon`; доступ к данным ограничивают RLS-политики.

Для локальной разработки без конфигурации Supabase сохраняется SQLite API. Если конфигурация Supabase создана, локальный сайт тоже подключается к ней.

## Структура и безопасность

- `supabase/migrations/` — таблицы, триггеры и RLS-политики.
- `supabase/functions/forma-booking/` — проверка и сохранение заявок, необязательное уведомление в n8n.
- `forma-supabase-config.js` — публичные параметры проекта для GitHub Pages.
- Секрет webhook n8n хранится в Supabase Function Secrets, не во фронтенде.

Проверьте локальную SQLite-заявочную схему отдельно от продакшена. GitHub Pages раздаёт только статические файлы и сам не запускает Node.js сервер.
