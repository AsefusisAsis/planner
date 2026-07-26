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

-- ============================================================
-- Аватары пользователей (Supabase Storage, приватный bucket 'avatars').
-- Путь файла: {userId}/avatar.jpg. RLS через storage.objects: пользователь
-- работает только со своей папкой (первый сегмент пути = его uid).
-- Bucket создаётся идемпотентно; политики — только на этот bucket.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists "avatar read own" on storage.objects;
create policy "avatar read own" on storage.objects
  for select using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar write own" on storage.objects;
create policy "avatar write own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar update own" on storage.objects;
create policy "avatar update own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatar delete own" on storage.objects;
create policy "avatar delete own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- Удаление аккаунта (требование Google Play: в приложении должен быть путь
-- ПОЛНОГО удаления аккаунта и связанных данных; «заморозка» не засчитывается).
--
-- Клиент с анонимным ключом не может удалить строку в auth.users, поэтому
-- нужна функция security definer. Она работает ТОЛЬКО с текущим
-- пользователем: id берётся из auth.uid(), параметров нет — передать чужой
-- идентификатор невозможно. search_path зафиксирован (иначе security definer
-- уязвим к подмене схемы).
-- ============================================================
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth, storage, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- фото профиля
  delete from storage.objects
    where bucket_id = 'avatars' and (storage.foldername(name))[1] = uid::text;

  -- записи пользователя (страховка: ниже каскад от auth.users сделает то же)
  delete from public.records where user_id = uid;

  -- сам аккаунт; records уходят каскадом по внешнему ключу
  delete from auth.users where id = uid;
end $$;

-- вызывать может только вошедший пользователь (и только для себя)
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
