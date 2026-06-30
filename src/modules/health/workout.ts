// ============================================================
// Детерминированный генератор недельного плана тренировок.
// Без случайности — план стабилен при одинаковых входных данных.
// Фильтрует упражнения по доступному оборудованию (свой вес — всегда).
// ============================================================

import type { Equipment, Goal } from '../../types'
import { EXERCISES, type Exercise, type Muscle } from './exercises'

export type SessionFocus = 'fullbody' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'

/** Типы тренировки в зале. */
export const GYM_TYPES = ['strength', 'cardio', 'trainer', 'functional'] as const
export type GymType = (typeof GYM_TYPES)[number]

/** MET (метаболический эквивалент) по типу нагрузки — для оценки калорий. */
const MET: Record<string, number> = {
  fullbody: 4.5,
  upper: 4.5,
  lower: 4.5,
  push: 4.5,
  pull: 4.5,
  legs: 5,
  strength: 5,
  cardio: 7,
  trainer: 5.5,
  functional: 7,
}

/** Оценка сожжённых калорий: MET × вес(кг) × часы. weight по умолчанию 70. */
export function estimateCalories(focus: string, weightKg: number | undefined, durationMin: number): number {
  const met = MET[focus] ?? 5
  const w = weightKg && weightKg > 0 ? weightKg : 70
  return Math.round(met * w * (durationMin / 60))
}

export interface Prescription {
  exercise: Exercise
  sets?: number
  reps?: string
  minutes?: number
}

export interface Session {
  focus: SessionFocus
  items: Prescription[]
}

export interface WeekPlan {
  daysPerWeek: number
  /** рекомендованные минуты кардио в неделю [min, max] */
  cardioMinPerWeek: [number, number]
  sessions: Session[]
}

const FOCUS_MUSCLES: Record<SessionFocus, Muscle[]> = {
  fullbody: ['legs', 'chest', 'back', 'shoulders', 'core'],
  upper: ['chest', 'back', 'shoulders', 'arms'],
  lower: ['legs', 'legs', 'core'],
  push: ['chest', 'shoulders', 'arms'],
  pull: ['back', 'arms'],
  legs: ['legs', 'legs', 'core'],
}

function splitFor(days: number): SessionFocus[] {
  switch (Math.max(1, Math.min(6, days))) {
    case 1:
      return ['fullbody']
    case 2:
      return ['upper', 'lower']
    case 3:
      return ['fullbody', 'fullbody', 'fullbody']
    case 4:
      return ['upper', 'lower', 'upper', 'lower']
    case 5:
      return ['upper', 'lower', 'fullbody', 'upper', 'lower']
    default:
      return ['push', 'pull', 'legs', 'push', 'pull', 'legs']
  }
}

function cardioTarget(goal: Goal): [number, number] {
  if (goal === 'lose') return [200, 300]
  if (goal === 'gain') return [75, 150]
  return [150, 200]
}

const isBodyweight = (e: Exercise) => e.equipment === 'bodyweight'
/** оборудование вперёд (специфичнее), свой вес — в конец */
const preferEquipment = (a: Exercise, b: Exercise) =>
  (isBodyweight(a) ? 1 : 0) - (isBodyweight(b) ? 1 : 0)

/** Силовые для фокуса (детерминированно, со сдвигом по дню; приоритет — доступному оборудованию). */
function pickStrength(focus: SessionFocus, pool: Exercise[], dayIndex: number): Exercise[] {
  const chosen: Exercise[] = []
  const seen = new Set<string>()
  for (const m of FOCUS_MUSCLES[focus]) {
    const cands = pool.filter((e) => e.muscle === m).sort(preferEquipment)
    if (cands.length === 0) continue
    const pick = cands[dayIndex % cands.length]
    if (!seen.has(pick.id)) {
      chosen.push(pick)
      seen.add(pick.id)
    }
  }
  if (chosen.length < 4) {
    const focusPool = pool
      .filter((e) => FOCUS_MUSCLES[focus].includes(e.muscle))
      .sort(preferEquipment)
    for (const e of focusPool) {
      if (chosen.length >= 4) break
      if (!seen.has(e.id)) {
        chosen.push(e)
        seen.add(e.id)
      }
    }
  }
  return chosen.slice(0, 6)
}

export function generatePlan(goal: Goal, daysPerWeek: number, owned: Equipment[]): WeekPlan {
  const available = (e: Exercise) => e.equipment === 'bodyweight' || owned.includes(e.equipment)
  const strengthPool = EXERCISES.filter((e) => e.type === 'strength' && available(e))
  const cardioPool = EXERCISES.filter((e) => e.type === 'cardio' && available(e)).sort(preferEquipment)

  const scheme = goal === 'gain' ? { sets: 4, reps: '6–10' } : { sets: 3, reps: '10–15' }
  const split = splitFor(daysPerWeek)

  const sessions: Session[] = split.map((focus, i) => {
    const items: Prescription[] = pickStrength(focus, strengthPool, i).map((exercise) => ({
      exercise,
      sets: scheme.sets,
      reps: scheme.reps,
    }))
    if (goal !== 'gain' && cardioPool.length > 0) {
      const cardio = cardioPool[i % cardioPool.length]
      items.push({ exercise: cardio, minutes: 20 })
    }
    return { focus, items }
  })

  return {
    daysPerWeek: split.length,
    cardioMinPerWeek: cardioTarget(goal),
    sessions,
  }
}
