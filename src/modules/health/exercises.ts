// ============================================================
// Встроенная база упражнений (без внешних API).
// Фильтруется по доступному инвентарю; используется генератором плана.
// ============================================================

import type { Equipment } from '../../types'
export type { Equipment }

export type Muscle =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'fullbody'
  | 'cardio'

export type ExType = 'strength' | 'cardio'

export interface Exercise {
  id: string
  ru: string
  en: string
  muscle: Muscle
  equipment: Equipment
  type: ExType
}

export const EXERCISES: Exercise[] = [
  // --- Без оборудования (none) ---
  { id: 'pushup', ru: 'Отжимания', en: 'Push-ups', muscle: 'chest', equipment: 'none', type: 'strength' },
  { id: 'pike_pushup', ru: 'Отжимания «щучкой»', en: 'Pike push-ups', muscle: 'shoulders', equipment: 'none', type: 'strength' },
  { id: 'chair_dips', ru: 'Обратные отжимания от опоры', en: 'Chair dips', muscle: 'arms', equipment: 'none', type: 'strength' },
  { id: 'squat_bw', ru: 'Приседания', en: 'Bodyweight squats', muscle: 'legs', equipment: 'none', type: 'strength' },
  { id: 'lunge_bw', ru: 'Выпады', en: 'Lunges', muscle: 'legs', equipment: 'none', type: 'strength' },
  { id: 'glute_bridge', ru: 'Ягодичный мост', en: 'Glute bridge', muscle: 'legs', equipment: 'none', type: 'strength' },
  { id: 'wall_sit', ru: 'Стульчик у стены', en: 'Wall sit', muscle: 'legs', equipment: 'none', type: 'strength' },
  { id: 'calf_raise', ru: 'Подъёмы на носки', en: 'Calf raises', muscle: 'legs', equipment: 'none', type: 'strength' },
  { id: 'step_up', ru: 'Зашагивания на возвышение', en: 'Step-ups', muscle: 'legs', equipment: 'none', type: 'strength' },
  { id: 'plank', ru: 'Планка', en: 'Plank', muscle: 'core', equipment: 'none', type: 'strength' },
  { id: 'crunch', ru: 'Скручивания', en: 'Crunches', muscle: 'core', equipment: 'none', type: 'strength' },
  { id: 'bird_dog', ru: 'Bird-dog', en: 'Bird-dog', muscle: 'core', equipment: 'none', type: 'strength' },
  { id: 'superman', ru: 'Лодочка (супермен)', en: 'Superman', muscle: 'back', equipment: 'none', type: 'strength' },
  { id: 'jumping_jacks', ru: 'Прыжки «джеки»', en: 'Jumping jacks', muscle: 'cardio', equipment: 'none', type: 'cardio' },
  { id: 'high_knees', ru: 'Бег на месте (высоко колени)', en: 'High knees', muscle: 'cardio', equipment: 'none', type: 'cardio' },
  { id: 'mountain_climbers', ru: 'Скалолаз', en: 'Mountain climbers', muscle: 'cardio', equipment: 'none', type: 'cardio' },
  { id: 'burpee', ru: 'Бёрпи', en: 'Burpees', muscle: 'cardio', equipment: 'none', type: 'cardio' },
  { id: 'jump_rope', ru: 'Скакалка', en: 'Jump rope', muscle: 'cardio', equipment: 'none', type: 'cardio' },
  { id: 'running', ru: 'Бег / быстрая ходьба', en: 'Running / brisk walk', muscle: 'cardio', equipment: 'none', type: 'cardio' },

  // --- Гантели (dumbbell) ---
  { id: 'db_bench', ru: 'Жим гантелей лёжа', en: 'Dumbbell bench press', muscle: 'chest', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_fly', ru: 'Разведения гантелей', en: 'Dumbbell fly', muscle: 'chest', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_row', ru: 'Тяга гантели в наклоне', en: 'Dumbbell row', muscle: 'back', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_press', ru: 'Жим гантелей стоя', en: 'Dumbbell shoulder press', muscle: 'shoulders', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_lateral', ru: 'Махи гантелями в стороны', en: 'Lateral raises', muscle: 'shoulders', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_curl', ru: 'Сгибания на бицепс', en: 'Dumbbell curls', muscle: 'arms', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_tri_ext', ru: 'Разгибания на трицепс', en: 'Dumbbell triceps extension', muscle: 'arms', equipment: 'dumbbell', type: 'strength' },
  { id: 'goblet_squat', ru: 'Гоблет-приседания', en: 'Goblet squat', muscle: 'legs', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_rdl', ru: 'Румынская тяга с гантелями', en: 'Dumbbell RDL', muscle: 'legs', equipment: 'dumbbell', type: 'strength' },
  { id: 'db_lunge', ru: 'Выпады с гантелями', en: 'Dumbbell lunges', muscle: 'legs', equipment: 'dumbbell', type: 'strength' },

  // --- Зал / тренажёры (gym) ---
  { id: 'bb_squat', ru: 'Приседания со штангой', en: 'Barbell squat', muscle: 'legs', equipment: 'gym', type: 'strength' },
  { id: 'deadlift', ru: 'Становая тяга', en: 'Deadlift', muscle: 'back', equipment: 'gym', type: 'strength' },
  { id: 'bb_bench', ru: 'Жим штанги лёжа', en: 'Barbell bench press', muscle: 'chest', equipment: 'gym', type: 'strength' },
  { id: 'lat_pulldown', ru: 'Тяга верхнего блока', en: 'Lat pulldown', muscle: 'back', equipment: 'gym', type: 'strength' },
  { id: 'seated_row', ru: 'Тяга горизонтального блока', en: 'Seated row', muscle: 'back', equipment: 'gym', type: 'strength' },
  { id: 'leg_press', ru: 'Жим ногами', en: 'Leg press', muscle: 'legs', equipment: 'gym', type: 'strength' },
  { id: 'leg_curl', ru: 'Сгибание ног', en: 'Leg curl', muscle: 'legs', equipment: 'gym', type: 'strength' },
  { id: 'leg_ext', ru: 'Разгибание ног', en: 'Leg extension', muscle: 'legs', equipment: 'gym', type: 'strength' },
  { id: 'shoulder_press_machine', ru: 'Жим в тренажёре на плечи', en: 'Machine shoulder press', muscle: 'shoulders', equipment: 'gym', type: 'strength' },
  { id: 'cable_triceps', ru: 'Разгибания на блоке', en: 'Cable triceps pushdown', muscle: 'arms', equipment: 'gym', type: 'strength' },
  { id: 'treadmill', ru: 'Беговая дорожка', en: 'Treadmill', muscle: 'cardio', equipment: 'gym', type: 'cardio' },
  { id: 'bike', ru: 'Велотренажёр', en: 'Stationary bike', muscle: 'cardio', equipment: 'gym', type: 'cardio' },
  { id: 'rowing', ru: 'Гребной тренажёр', en: 'Rowing machine', muscle: 'cardio', equipment: 'gym', type: 'cardio' },
  { id: 'elliptical', ru: 'Эллипсоид', en: 'Elliptical', muscle: 'cardio', equipment: 'gym', type: 'cardio' },
]

/** Какие уровни инвентаря доступны при выбранном. */
export function allowedEquipment(level: Equipment): Equipment[] {
  if (level === 'gym') return ['none', 'dumbbell', 'gym']
  if (level === 'dumbbell') return ['none', 'dumbbell']
  return ['none']
}

/** Ссылка на поиск техники упражнения на YouTube. */
export function techniqueLink(ex: Exercise, lang: 'ru' | 'en'): string {
  const q = lang === 'ru' ? `${ex.ru} техника выполнения` : `${ex.en} proper form`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}
