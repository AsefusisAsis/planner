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
