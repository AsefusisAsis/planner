// Общие списки покупок: данные, доступные ДВУМ аккаунтам.
//
// Живут в отдельных таблицах (supabase/shared-lists.sql), а НЕ в records.
// Причина в SQL-файле подробно: в records ключ — (user_id, collection, id),
// и правка партнёра создала бы второй ряд вместо обновления общего. Трогать
// ради этого курсорную подкачку и 3-way merge — самое рискованное место
// проекта — не стоит.
//
// Область видимости обеспечивает RLS: обычный select возвращает ровно те
// списки, где ты владелец или участник. Никаких фильтров по user_id в
// запросах здесь нет намеренно — единственный источник правды о доступе
// должен быть один, на сервере.

import { supabase } from './supabase'
import type { SharedItem } from '../lib/sharedListMerge'

export interface SharedListRow {
  id: string
  owner_id: string
  name: string
  items: SharedItem[]
  updated_at: string
  server_updated_at: string
}

export interface SharedMember {
  user_id: string
  joined_at: string
}

function fail(msg: string, e: { message?: string } | null): never {
  // Причину не проглатываем: «не сработало» без текста уже дважды стоило
  // нам лишних итераций (удаление аккаунта, биометрия).
  throw new Error(e?.message ? `${msg}: ${e.message}` : msg)
}

/** Все доступные мне общие списки (свои + те, куда пригласили). */
export async function fetchSharedLists(): Promise<SharedListRow[]> {
  const { data, error } = await supabase
    .from('shared_lists')
    .select('id,owner_id,name,items,updated_at,server_updated_at')
  if (error) fail('shared: не удалось загрузить списки', error)
  return (data ?? []) as SharedListRow[]
}

/** Создать общий список (владельцем становится текущий пользователь). */
export async function createSharedList(
  ownerId: string,
  name: string,
  items: SharedItem[],
): Promise<SharedListRow> {
  const { data, error } = await supabase
    .from('shared_lists')
    .insert({ owner_id: ownerId, name, items, updated_at: new Date().toISOString() })
    .select('id,owner_id,name,items,updated_at,server_updated_at')
    .single()
  if (error) fail('shared: не удалось создать список', error)
  return data as SharedListRow
}

/**
 * Сохранить состояние списка. updated_at ставим клиентские — по нему
 * работает слияние позиций; серверное время проставит триггер.
 */
export async function saveSharedList(
  id: string,
  name: string,
  items: SharedItem[],
): Promise<void> {
  const { error } = await supabase
    .from('shared_lists')
    .update({ name, items, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) fail('shared: не удалось сохранить список', error)
}

/** Удалить общий список целиком (доступно только владельцу — проверит RLS). */
export async function deleteSharedList(id: string): Promise<void> {
  const { error } = await supabase.from('shared_lists').delete().eq('id', id)
  if (error) fail('shared: не удалось удалить список', error)
}

/** Ссылка-приглашение. Токен генерируем здесь — угадать его нельзя. */
export async function createInvite(listId: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, '')
  const { error } = await supabase.from('shared_list_invites').insert({ token, list_id: listId })
  if (error) fail('shared: не удалось создать приглашение', error)
  return token
}

/**
 * Принять приглашение. Идёт через SECURITY DEFINER функцию: приглашённый
 * ещё не участник и по RLS не может ни прочитать приглашение, ни увидеть
 * список — сам себе доступ он выдать не смог бы.
 */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_list_invite', { p_token: token })
  if (error) fail('shared: приглашение не принято', error)
  return data as string
}

/** Кто имеет доступ (для владельца — чтобы было что отзывать). */
export async function fetchMembers(listId: string): Promise<SharedMember[]> {
  const { data, error } = await supabase
    .from('shared_list_members')
    .select('user_id,joined_at')
    .eq('list_id', listId)
  if (error) fail('shared: не удалось получить участников', error)
  return (data ?? []) as SharedMember[]
}

/** Отозвать доступ у участника (владелец) либо выйти самому (участник). */
export async function removeMember(listId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('shared_list_members')
    .delete()
    .eq('list_id', listId)
    .eq('user_id', userId)
  if (error) fail('shared: не удалось изменить доступ', error)
}

/**
 * Отозвать ВСЕ приглашения списка. Нужно вместе с отзывом доступа: иначе
 * человек, у которого осталась ссылка, просто присоединится заново.
 */
export async function revokeInvites(listId: string): Promise<void> {
  const { error } = await supabase.from('shared_list_invites').delete().eq('list_id', listId)
  if (error) fail('shared: не удалось отозвать ссылки', error)
}
