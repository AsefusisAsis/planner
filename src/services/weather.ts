// ============================================================
// Погода через Open-Meteo (бесплатно, без API-ключа, CORS OK).
// Геокодинг города + текущая погода. Кэш в localStorage.
// ============================================================

import type { WeatherLocation } from '../types'

export interface CurrentWeather {
  tempC: number
  code: number
  fetchedAt: string
  lat: number
  lon: number
}

const CACHE_KEY = 'planner.weather'

/** Поиск координат по названию города. */
export async function geocodeCity(name: string, lang = 'ru'): Promise<WeatherLocation | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name.trim(),
  )}&count=1&language=${lang}&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`geocode ${res.status}`)
  const j = await res.json()
  const r = j.results?.[0]
  if (!r) return null
  const label = r.country_code ? `${r.name}, ${r.country_code}` : r.name
  return { name: label, lat: r.latitude, lon: r.longitude }
}

function readCache(): CurrentWeather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CurrentWeather) : null
  } catch {
    return null
  }
}

/** Текущая погода по координатам. Кэш ~30 минут для тех же координат. */
export async function getWeather(lat: number, lon: number, force = false): Promise<CurrentWeather> {
  const cached = readCache()
  if (
    !force &&
    cached &&
    Math.abs(cached.lat - lat) < 0.01 &&
    Math.abs(cached.lon - lon) < 0.01 &&
    Date.now() - new Date(cached.fetchedAt).getTime() < 30 * 60 * 1000
  ) {
    return cached
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`weather ${res.status}`)
  const j = await res.json()
  const cur = j.current
  const data: CurrentWeather = {
    tempC: Math.round(cur.temperature_2m),
    code: cur.weather_code,
    fetchedAt: new Date().toISOString(),
    lat,
    lon,
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  return data
}

/** Иконка (эмодзи) и короткое описание по коду WMO. */
export function describeWeather(code: number): { emoji: string; ru: string; en: string } {
  if (code === 0) return { emoji: '☀️', ru: 'Ясно', en: 'Clear' }
  if (code <= 2) return { emoji: '🌤️', ru: 'Малооблачно', en: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', ru: 'Облачно', en: 'Cloudy' }
  if (code <= 48) return { emoji: '🌫️', ru: 'Туман', en: 'Fog' }
  if (code <= 57) return { emoji: '🌦️', ru: 'Морось', en: 'Drizzle' }
  if (code <= 67) return { emoji: '🌧️', ru: 'Дождь', en: 'Rain' }
  if (code <= 77) return { emoji: '❄️', ru: 'Снег', en: 'Snow' }
  if (code <= 82) return { emoji: '🌧️', ru: 'Ливень', en: 'Showers' }
  if (code <= 86) return { emoji: '🌨️', ru: 'Снегопад', en: 'Snow showers' }
  return { emoji: '⛈️', ru: 'Гроза', en: 'Thunderstorm' }
}
