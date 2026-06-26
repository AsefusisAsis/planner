// ============================================================
// Детерминированный генератор недельного плана тренировок.
// Без случайности — план стабилен при одинаковых входных данных.
// ============================================================

import type { Equipment, Goal } from '../../types'
import { EXERCISES, allowedEquipment, type Exercise, type Muscle } from './exercises'

export type SessionFocus = 'fullbody' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'

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

/** Приоритет инвентаря: выбранный уровень первым, ниже — как запасной. */
function tierOrder(selected: Equipment): Equipment[] {
  if (selected === 'gym') return ['gym', 'dumbbell', 'none']
  if (selected === 'dumbbell') return ['dumbbell', 'none']
  return ['none']
}

/** Кандидаты на мышцу: берём упражнения выбранного уровня, иначе спускаемся к запасному. */
function candidatesFor(muscle: Muscle, pool: Exercise[], selected: Equipment): Exercise[] {
  for (const tier of tierOrder(selected)) {
    const c = pool.filter((e) => e.muscle === muscle && e.equipment === tier)
    if (c.length > 0) return c
  }
  return []
}

/** Силовые упражнения для фокуса (детерминированно, со сдвигом по индексу дня для разнообразия). */
function pickStrength(
  focus: SessionFocus,
  pool: Exercise[],
  dayIndex: number,
  selected: Equipment,
): Exercise[] {
  const chosen: Exercise[] = []
  const seen = new Set<string>()
  for (const m of FOCUS_MUSCLES[focus]) {
    const cands = candidatesFor(m, pool, selected)
    if (cands.length === 0) continue
    const pick = cands[dayIndex % cands.length]
    if (!seen.has(pick.id)) {
      chosen.push(pick)
      seen.add(pick.id)
    }
  }
  // добиваем до минимум 4 упражнений (предпочитая выбранный инвентарь)
  if (chosen.length < 4) {
    const order = tierOrder(selected)
    const focusPool = pool
      .filter((e) => FOCUS_MUSCLES[focus].includes(e.muscle))
      .sort((a, b) => order.indexOf(a.equipment) - order.indexOf(b.equipment))
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

export function generatePlan(goal: Goal, daysPerWeek: number, equipment: Equipment): WeekPlan {
  const allowed = allowedEquipment(equipment)
  const strengthPool = EXERCISES.filter(
    (e) => e.type === 'strength' && allowed.includes(e.equipment),
  )
  const cardioPool = EXERCISES.filter((e) => e.type === 'cardio' && allowed.includes(e.equipment))

  const scheme = goal === 'gain' ? { sets: 4, reps: '6–10' } : { sets: 3, reps: '10–15' }
  const split = splitFor(daysPerWeek)

  const sessions: Session[] = split.map((focus, i) => {
    const items: Prescription[] = pickStrength(focus, strengthPool, i, equipment).map((exercise) => ({
      exercise,
      sets: scheme.sets,
      reps: scheme.reps,
    }))
    // кардио-финишёр (кроме набора массы), если есть из чего
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
