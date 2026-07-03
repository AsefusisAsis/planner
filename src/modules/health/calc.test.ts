import { describe, it, expect } from 'vitest'
import { bmr, bmiCategory, bmiOf, computeHealth } from './calc'
import type { HealthProfile } from '../../types'

describe('bmr (Mifflin–St Jeor)', () => {
  it('мужчина 80кг/180см/30л = 1780', () => {
    expect(bmr('male', 80, 180, 30)).toBe(1780)
  })
  it('женщина 80кг/180см/30л = 1614', () => {
    expect(bmr('female', 80, 180, 30)).toBe(1614)
  })
})

describe('bmi', () => {
  it('80/180 ≈ нормальный', () => {
    expect(bmiCategory(bmiOf(80, 180))).toBe('normal')
  })
  it('классификация', () => {
    expect(bmiCategory(17)).toBe('underweight')
    expect(bmiCategory(27)).toBe('overweight')
    expect(bmiCategory(33)).toBe('obese')
  })
})

const base: HealthProfile = {
  sex: 'male',
  age: 30,
  height: 180,
  weight: 80,
  goalWeight: 75,
  activity: 'moderate',
  goal: 'lose',
  pace: 0.5,
  updatedAt: '',
}

describe('computeHealth', () => {
  it('дефицит при похудении: target < tdee', () => {
    const r = computeHealth(base)
    expect(r.targetKcal).toBeLessThan(r.tdee)
    expect(r.macros.protein).toBeGreaterThan(0)
  })
  it('не опускается ниже безопасного минимума (женский экстрим)', () => {
    const r = computeHealth({ ...base, sex: 'female', weight: 45, height: 150, pace: 1 })
    expect(r.targetKcal).toBeGreaterThanOrEqual(1200)
  })
  it('поддержание: target = tdee', () => {
    const r = computeHealth({ ...base, goal: 'maintain' })
    expect(r.targetKcal).toBe(r.tdee)
  })
})

describe('БЖУ сходится с целевыми калориями', () => {
  const profiles: [string, HealthProfile][] = [
    ['базовый (похудение)', base],
    ['поддержание', { ...base, goal: 'maintain' }],
    ['набор', { ...base, goal: 'gain', goalWeight: 85 }],
    // тяжёлый профиль с малоподвижностью: углеводы клампятся в 0
    [
      'клампинг углеводов (мужчина 120 кг, сидячий)',
      { ...base, weight: 120, height: 170, age: 50, activity: 'sedentary', goalWeight: 90, pace: 1 },
    ],
    [
      'клампинг углеводов (женщина 100 кг, сидячая)',
      { ...base, sex: 'female', weight: 100, height: 160, age: 40, activity: 'sedentary', goalWeight: 70, pace: 1 },
    ],
  ]
  for (const [name, p] of profiles) {
    it(name, () => {
      const r = computeHealth(p)
      const kcalFromMacros = r.macros.protein * 4 + r.macros.fat * 9 + r.macros.carbs * 4
      expect(Math.abs(kcalFromMacros - r.targetKcal)).toBeLessThanOrEqual(2)
      expect(r.macros.fat).toBeGreaterThanOrEqual(0)
      expect(r.macros.carbs).toBeGreaterThanOrEqual(0)
    })
  }
})

describe('weeksToGoal', () => {
  it('обычное похудение: срок есть', () => {
    const r = computeHealth(base)
    expect(r.weeksToGoal).not.toBeNull()
    expect(r.weeksToGoal).toBeGreaterThan(0)
  })
  it('цель противоречит направлению (lose, а goalWeight > weight) → null', () => {
    const r = computeHealth({ ...base, goalWeight: 90 })
    expect(r.warnings).toContain('goal_direction')
    expect(r.weeksToGoal).toBeNull()
  })
  it('цель противоречит направлению (gain, а goalWeight < weight) → null', () => {
    const r = computeHealth({ ...base, goal: 'gain', goalWeight: 70 })
    expect(r.warnings).toContain('goal_direction')
    expect(r.weeksToGoal).toBeNull()
  })
  it('набор в правильном направлении: срок есть', () => {
    const r = computeHealth({ ...base, goal: 'gain', goalWeight: 85 })
    expect(r.weeksToGoal).not.toBeNull()
  })
})
