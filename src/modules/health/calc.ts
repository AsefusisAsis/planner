// ============================================================
// Расчёты для раздела «Здоровье». Стандартные открытые формулы.
// ВНИМАНИЕ: это образовательный калькулятор, не медицинская рекомендация.
// Встроены безопасные ограничения (минимум калорий, темп, недовес).
// ============================================================

import type { ActivityLevel, Goal, HealthProfile, Sex } from '../../types'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

/** Допустимые варианты темпа, кг/неделю. */
export const PACES = [0.25, 0.5, 0.75, 1.0]

/** Безопасный нижний предел калорий (часто цитируемый). */
const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 }

/** 1 кг массы тела ≈ 7700 ккал. */
const KCAL_PER_KG = 7700

export interface MacroTargets {
  protein: number // г
  fat: number // г
  carbs: number // г
}

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'

export interface HealthResult {
  bmr: number // базовый обмен, ккал
  tdee: number // суточный расход с активностью, ккал
  /** Рекомендованная суточная норма калорий под цель (с ограничениями). */
  targetKcal: number
  macros: MacroTargets
  /** мл воды в сутки */
  waterMl: number
  bmi: number
  bmiCategory: BmiCategory
  /** недель до целевого веса (если применимо), иначе null */
  weeksToGoal: number | null
  /** фактический применённый дефицит/профицит ккал/сутки (со знаком) */
  appliedDelta: number
  warnings: HealthWarning[]
}

export type HealthWarning =
  | 'kcal_floor' // норму подняли до безопасного минимума
  | 'pace_too_fast' // выбранный темп требует слишком большого дефицита
  | 'underweight_lose' // уже недовес, а цель — похудение
  | 'goal_direction' // целевой вес не совпадает с направлением цели

export function bmr(sex: Sex, weight: number, height: number, age: number): number {
  // Миффлин — Сан Жеор
  const base = 10 * weight + 6.25 * height - 5 * age
  return Math.round(base + (sex === 'male' ? 5 : -161))
}

export function bmiOf(weight: number, height: number): number {
  const m = height / 100
  if (m <= 0) return 0
  return weight / (m * m)
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'overweight'
  return 'obese'
}

function macrosFor(targetKcal: number, weight: number, goal: Goal): MacroTargets {
  // Белок: больше при похудении (сохранение мышц). Жир ~0.9 г/кг. Остальное — углеводы.
  const proteinPerKg = goal === 'lose' ? 2.0 : 1.8
  const protein = Math.round(proteinPerKg * weight)
  let fat = Math.round(0.9 * weight)
  let carbs = Math.round((targetKcal - protein * 4 - fat * 9) / 4)
  if (carbs < 0) {
    // Углеводам калорий не хватило: обнуляем их, а жир пересчитываем как остаток,
    // чтобы сумма protein*4 + fat*9 + carbs*4 сходилась с targetKcal.
    carbs = 0
    fat = Math.max(0, Math.round(((targetKcal - protein * 4) / 9) * 10) / 10)
  }
  return { protein, fat, carbs }
}

export function computeHealth(p: HealthProfile): HealthResult {
  const warnings: HealthWarning[] = []

  const b = bmr(p.sex, p.weight, p.height, p.age)
  const tdee = Math.round(b * ACTIVITY_FACTORS[p.activity])

  const bmi = bmiOf(p.weight, p.height)
  const cat = bmiCategory(bmi)

  // Желаемый дневной дельта по темпу.
  let delta = (p.pace * KCAL_PER_KG) / 7 // ккал/сутки
  let targetKcal: number

  if (p.goal === 'maintain') {
    targetKcal = tdee
    delta = 0
  } else if (p.goal === 'lose') {
    if (p.goalWeight >= p.weight) warnings.push('goal_direction')
    if (cat === 'underweight') warnings.push('underweight_lose')
    // дефицит не больше 25% TDEE
    const maxDeficit = tdee * 0.25
    if (delta > maxDeficit) {
      warnings.push('pace_too_fast')
      delta = maxDeficit
    }
    targetKcal = Math.round(tdee - delta)
    const floor = MIN_KCAL[p.sex]
    if (targetKcal < floor) {
      warnings.push('kcal_floor')
      targetKcal = floor
    }
  } else {
    // gain
    if (p.goalWeight <= p.weight) warnings.push('goal_direction')
    const maxSurplus = tdee * 0.2
    if (delta > maxSurplus) {
      warnings.push('pace_too_fast')
      delta = maxSurplus
    }
    targetKcal = Math.round(tdee + delta)
  }

  const appliedDelta = targetKcal - tdee
  const macros = macrosFor(targetKcal, p.weight, p.goal)
  const waterMl = Math.round(p.weight * 30)

  // Недель до цели: по фактическому дельте (а не желаемому темпу).
  // Считаем только когда дельта ведёт к цели: знак appliedDelta совпадает
  // со знаком (goalWeight - weight), иначе срок бессмысленен.
  let weeksToGoal: number | null = null
  const gap = p.goalWeight - p.weight
  if (
    p.goal !== 'maintain' &&
    Math.abs(gap) > 0.1 &&
    Math.abs(appliedDelta) > 1 &&
    Math.sign(gap) === Math.sign(appliedDelta)
  ) {
    const kgPerWeek = (Math.abs(appliedDelta) * 7) / KCAL_PER_KG
    weeksToGoal = Math.ceil(Math.abs(gap) / kgPerWeek)
  }

  return {
    bmr: b,
    tdee,
    targetKcal,
    macros,
    waterMl,
    bmi: Math.round(bmi * 10) / 10,
    bmiCategory: cat,
    weeksToGoal,
    appliedDelta,
    warnings,
  }
}

/** Рекомендация по активности (ВОЗ): аэробика мин/нед + силовые. Без формул, просто диапазон. */
export const ACTIVITY_RECOMMENDATION = {
  aerobicMinPerWeek: [150, 300] as [number, number],
  strengthDaysPerWeek: 2,
}
