-- ============================================================
-- ОБЩИЕ СПИСКИ ПОКУПОК (данные, доступные ДВУМ аккаунтам).
-- Запустить в Supabase → SQL Editor ПОСЛЕ schema.sql.
-- Повторный запуск безопасен.
--
-- Почему отдельные таблицы, а не records. В records ключ —
-- (user_id, collection, id), и запись всегда кладётся под user_id того, кто
-- пишет. Правка партнёра создала бы ВТОРОЙ ряд вместо обновления общего, а
-- чинить это пришлось бы в самом деликатном месте проекта — курсорной
-- подкачке и 3-way merge. Общий список по своей природе не «мои данные»,
-- поэтому у него своя таблица с явным владельцем и участниками.
--
-- Решения, принятые пользователем (01.08):
--   1. участник РЕДАКТИРУЕТ наравне с владельцем (для списка покупок
--      просмотр почти бесполезен);
--   2. у участника ОБЯЗАН быть аккаунт — доступ ложится на ту же модель RLS;
--   3. доступ можно ОТОЗВАТЬ;
--   4. синхронизация как у остальных данных, без realtime.
-- ============================================================

create table if not exists public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '',
  -- позиции целиком, как в приложении: сливаются по позициям на клиенте
  items jsonb not null default '[]'::jsonb,
  -- время правки на устройстве (для слияния)
  updated_at timestamptz not null default now(),
  -- серверное время (курсор подкачки); ставится триггером, клиенту не верим
  server_updated_at timestamptz not null default now()
);

create table if not exists public.shared_list_members (
  list_id uuid not null references public.shared_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

-- Приглашение по ссылке. Токен генерирует клиент (crypto.randomUUID) —
-- угадать нельзя. Срок жизни ограничен: вечная ссылка в переписке это
-- вечный доступ.
create table if not exists public.shared_list_invites (
  token text primary key,
  list_id uuid not null references public.shared_lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists shared_lists_pull_idx
  on public.shared_lists (server_updated_at);
create index if not exists shared_list_members_user_idx
  on public.shared_list_members (user_id);

alter table public.shared_lists enable row level security;
alter table public.shared_list_members enable row level security;
alter table public.shared_list_invites enable row level security;

-- Участник — это владелец или тот, кто принял приглашение.
-- SECURITY DEFINER, чтобы политика на shared_lists могла проверить членство,
-- не упираясь в RLS самой таблицы участников (иначе — рекурсия политик).
create or replace function public.is_list_member(p_list uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $fn$
  select exists (
    select 1 from public.shared_lists l
     where l.id = p_list and l.owner_id = auth.uid()
  ) or exists (
    select 1 from public.shared_list_members m
     where m.list_id = p_list and m.user_id = auth.uid()
  )
$fn$;

-- Читать и МЕНЯТЬ список может любой участник (решение 1).
drop policy if exists "shared list read" on public.shared_lists;
create policy "shared list read" on public.shared_lists
  for select using (public.is_list_member(id));

drop policy if exists "shared list update" on public.shared_lists;
create policy "shared list update" on public.shared_lists
  for update using (public.is_list_member(id)) with check (public.is_list_member(id));

-- Создать список может любой вошедший, но только на своё имя.
drop policy if exists "shared list insert" on public.shared_lists;
create policy "shared list insert" on public.shared_lists
  for insert with check (auth.uid() = owner_id);

-- Удалить список целиком — только владелец. Участник может лишь выйти.
drop policy if exists "shared list delete" on public.shared_lists;
create policy "shared list delete" on public.shared_lists
  for delete using (auth.uid() = owner_id);

-- Участников видит владелец (чтобы отозвать доступ) и каждый — свою строку.
drop policy if exists "members read" on public.shared_list_members;
create policy "members read" on public.shared_list_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.shared_lists l where l.id = list_id and l.owner_id = auth.uid())
  );

-- Отозвать доступ может владелец; выйти самому — участник (решение 3).
drop policy if exists "members delete" on public.shared_list_members;
create policy "members delete" on public.shared_list_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.shared_lists l where l.id = list_id and l.owner_id = auth.uid())
  );

-- Приглашения создаёт только владелец списка.
drop policy if exists "invites insert" on public.shared_list_invites;
create policy "invites insert" on public.shared_list_invites
  for insert with check (
    exists (select 1 from public.shared_lists l where l.id = list_id and l.owner_id = auth.uid())
  );

drop policy if exists "invites owner read" on public.shared_list_invites;
create policy "invites owner read" on public.shared_list_invites
  for select using (
    exists (select 1 from public.shared_lists l where l.id = list_id and l.owner_id = auth.uid())
  );

drop policy if exists "invites owner delete" on public.shared_list_invites;
create policy "invites owner delete" on public.shared_list_invites
  for delete using (
    exists (select 1 from public.shared_lists l where l.id = list_id and l.owner_id = auth.uid())
  );

-- Серверное время правки — триггером, как и у records.
drop trigger if exists shared_lists_touch on public.shared_lists;
create trigger shared_lists_touch
  before insert or update on public.shared_lists
  for each row execute function public.touch_server_updated_at();

-- ============================================================
-- Принятие приглашения.
--
-- SECURITY DEFINER обязателен: приглашённый ЕЩЁ НЕ участник, поэтому по RLS
-- он не может ни прочитать строку приглашения, ни увидеть список. Функция
-- сама проверяет токен и срок, а наружу отдаёт только id списка.
--
-- Токен после использования НЕ удаляется: одной ссылкой может воспользоваться
-- и второе устройство того же человека. Ограничение — срок жизни, плюс
-- владелец может отозвать доступ в любой момент.
-- ============================================================
create or replace function public.accept_list_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  uid uuid := auth.uid();
  v_list uuid;
  v_owner uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select i.list_id into v_list
    from public.shared_list_invites i
   where i.token = p_token and i.expires_at > now();

  if v_list is null then
    raise exception 'invite not found or expired';
  end if;

  select l.owner_id into v_owner from public.shared_lists l where l.id = v_list;
  -- владельцу присоединяться к своему же списку не нужно (и не вредно)
  if v_owner = uid then
    return v_list;
  end if;

  insert into public.shared_list_members (list_id, user_id)
  values (v_list, uid)
  on conflict do nothing;

  return v_list;
end $fn$;

revoke all on function public.accept_list_invite(text) from public, anon;
grant execute on function public.accept_list_invite(text) to authenticated;
