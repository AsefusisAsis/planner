-- ============================================================
-- Планировщик: схема облачной синхронизации.
-- Запустить ОДИН раз: Supabase → SQL Editor → New query → вставить → Run.
-- Повторный запуск безопасен (if not exists / or replace).
-- ============================================================

-- Все данные всех коллекций — в одной таблице записей.
-- payload — запись целиком (как в приложении), ключ — (пользователь, коллекция, id).
create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null,
  id text not null,
  payload jsonb not null default '{}'::jsonb,
  -- время правки на устройстве: по нему выбирается победитель при конфликте
  updated_at timestamptz not null default now(),
  -- серверное время записи: курсор инкрементальной подкачки (ставится триггером)
  server_updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  primary key (user_id, collection, id)
);

create index if not exists records_pull_idx
  on public.records (user_id, server_updated_at);

-- Каждый пользователь видит и меняет ТОЛЬКО свои записи.
alter table public.records enable row level security;

drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Серверное время не доверяем клиенту — проставляем триггером.
-- clock_timestamp(), а не now(): у строк одного пакетного upsert будут
-- РАЗНЫЕ штампы — курсорная подкачка не теряет строки на границе страницы.
create or replace function public.touch_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before insert or update on public.records
  for each row execute function public.touch_server_updated_at();
