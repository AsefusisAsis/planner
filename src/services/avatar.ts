// Аватар пользователя в Supabase Storage (bucket 'avatars', приватный).
// Путь `{userId}/avatar.jpg`. RLS: пользователь читает/пишет только свой
// файл (политики в supabase/schema.sql). Отдаём blob → object-URL, чтобы
// не светить публичные ссылки. Требует настроенного bucket на проекте.
import { supabase } from './supabase'

const BUCKET = 'avatars'
const MAX = 256 // пикселей по большей стороне — аватар маленький

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}
const objectPath = (uid: string) => `${uid}/avatar.jpg`

/** Уменьшает картинку до MAX px и жмёт в JPEG — файл лёгкий. */
async function downscale(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85),
  )
}

/** Загружает (перезаписывает) аватар текущего пользователя. */
export async function uploadAvatar(file: File): Promise<void> {
  const uid = await currentUid()
  if (!uid) throw new Error('no-account')
  const blob = await downscale(file)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath(uid), blob, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
}

/** Скачивает аватар и возвращает object-URL (или null, если нет/недоступно). */
export async function fetchAvatarUrl(): Promise<string | null> {
  const uid = await currentUid()
  if (!uid) return null
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath(uid))
  if (error || !data) return null
  return URL.createObjectURL(data)
}

/** Удаляет аватар текущего пользователя. */
export async function removeAvatar(): Promise<void> {
  const uid = await currentUid()
  if (!uid) return
  await supabase.storage.from(BUCKET).remove([objectPath(uid)])
}
