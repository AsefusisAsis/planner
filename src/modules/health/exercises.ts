// ============================================================
// Встроенная база упражнений (без внешних API).
// Каждое упражнение требует одного типа оборудования
// (bodyweight всегда доступно). Фильтруется генератором плана.
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

/** Список оборудования для выбора в UI (bodyweight подразумевается всегда). */
export const SELECTABLE_EQUIPMENT: Equipment[] = [
  'dumbbell',
  'barbell',
  'kettlebell',
  'bands',
  'pullupbar',
  'treadmill',
  'bike',
  'machines',
]

export const EXERCISES: Exercise[] = [
  // --- Свой вес ---
  { id: 'pushup', ru: 'Отжимания', en: 'Push-ups', muscle: 'chest', equipment: 'bodyweight', type: 'strength' },
  { id: 'pike_pushup', ru: 'Отжимания «щучкой»', en: 'Pike push-ups', muscle: 'shoulders', equipment: 'bodyweight', type: 'strength' },
  { id: 'chair_dips', ru: 'Обратные отжимания от опоры', en: 'Chair dips', muscle: 'arms', equipment: 'bodyweight', type: 'strength' },
  { id: 'squat_bw', ru: 'Приседания', en: 'Bodyweight squats', muscle: 'legs', equipment: 'bodyweight', type: 'strength' },
  { id: 'lunge_bw', ru: 'Выпады', en: 'Lunges', muscle: 'legs', equipment: 'bodyweight', type: 'strength' },
  { id: 'glute_bridge', ru: 'Ягодичный мост', en: 'Glute bridge', muscle: 'legs', equipment: 'bodyweight', type: 'strength' },
  { id: 'wall_sit', ru: 'Стульчик у стены', en: 'Wall sit', muscle: 'legs', equipment: 'bodyweight', type: 'strength' },
  { id: 'calf_raise', ru: 'Подъёмы на носки', en: 'Calf raises', muscle: 'legs', equipment: 'bodyweight', type: 'strength' },
  { id: 'step_up', ru: 'Зашагивания на возвышение', en: 'Step-ups', muscle: 'legs', equipment: 'bodyweight', type: 'strength' },
  { id: 'plank', ru: 'Планка', en: 'Plank', muscle: 'core', equipment: 'bodyweight', type: 'strength' },
  { id: 'crunch', ru: 'Скручивания', en: 'Crunches', muscle: 'core', equipment: 'bodyweight', type: 'strength' },
  { id: 'bird_dog', ru: 'Bird-dog', en: 'Bird-dog', muscle: 'core', equipment: 'bodyweight', type: 'strength' },
  { id: 'superman', ru: 'Лодочка (супермен)', en: 'Superman', muscle: 'back', equipment: 'bodyweight', type: 'strength' },
  { id: 'jumping_jacks', ru: 'Прыжки «джеки»', en: 'Jumping jacks', muscle: 'cardio', equipment: 'bodyweight', type: 'cardio' },
  { id: 'high_knees', ru: 'Бег на месте (высоко колени)', en: 'High knees', muscle: 'cardio', equipment: 'bodyweight', type: 'cardio' },
  { id: 'mountain_climbers', ru: 'Скалолаз', en: 'Mountain climbers', muscle: 'cardio', equipment: 'bodyweight', type: 'cardio' },
  { id: 'burpee', ru: 'Бёрпи', en: 'Burpees', muscle: 'cardio', equipment: 'bodyweight', type: 'cardio' },

  // --- Гантели ---
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

  // --- Штанга ---
  { id: 'bb_squat', ru: 'Приседания со штангой', en: 'Barbell squat', muscle: 'legs', equipment: 'barbell', type: 'strength' },
  { id: 'deadlift', ru: 'Становая тяга', en: 'Deadlift', muscle: 'back', equipment: 'barbell', type: 'strength' },
  { id: 'bb_bench', ru: 'Жим штанги лёжа', en: 'Barbell bench press', muscle: 'chest', equipment: 'barbell', type: 'strength' },
  { id: 'bb_row', ru: 'Тяга штанги в наклоне', en: 'Barbell row', muscle: 'back', equipment: 'barbell', type: 'strength' },
  { id: 'bb_ohp', ru: 'Жим штанги стоя', en: 'Overhead press', muscle: 'shoulders', equipment: 'barbell', type: 'strength' },

  // --- Гиря ---
  { id: 'kb_swing', ru: 'Махи гирей', en: 'Kettlebell swing', muscle: 'legs', equipment: 'kettlebell', type: 'strength' },
  { id: 'kb_goblet', ru: 'Гоблет-присед с гирей', en: 'Kettlebell goblet squat', muscle: 'legs', equipment: 'kettlebell', type: 'strength' },
  { id: 'kb_press', ru: 'Жим гири', en: 'Kettlebell press', muscle: 'shoulders', equipment: 'kettlebell', type: 'strength' },
  { id: 'kb_row', ru: 'Тяга гири', en: 'Kettlebell row', muscle: 'back', equipment: 'kettlebell', type: 'strength' },

  // --- Резинки/эспандер ---
  { id: 'band_row', ru: 'Тяга резинки', en: 'Band row', muscle: 'back', equipment: 'bands', type: 'strength' },
  { id: 'band_press', ru: 'Жим резинки', en: 'Band chest press', muscle: 'chest', equipment: 'bands', type: 'strength' },
  { id: 'band_pull_apart', ru: 'Разведение резинки', en: 'Band pull-apart', muscle: 'shoulders', equipment: 'bands', type: 'strength' },
  { id: 'band_squat', ru: 'Приседания с резинкой', en: 'Band squat', muscle: 'legs', equipment: 'bands', type: 'strength' },
  { id: 'band_curl', ru: 'Сгибания с резинкой', en: 'Band curl', muscle: 'arms', equipment: 'bands', type: 'strength' },

  // --- Турник ---
  { id: 'pullup', ru: 'Подтягивания', en: 'Pull-ups', muscle: 'back', equipment: 'pullupbar', type: 'strength' },
  { id: 'chinup', ru: 'Подтягивания обратным хватом', en: 'Chin-ups', muscle: 'arms', equipment: 'pullupbar', type: 'strength' },
  { id: 'hang_leg_raise', ru: 'Подъём ног в висе', en: 'Hanging leg raise', muscle: 'core', equipment: 'pullupbar', type: 'strength' },

  // --- Кардио-тренажёры ---
  { id: 'treadmill', ru: 'Беговая дорожка', en: 'Treadmill', muscle: 'cardio', equipment: 'treadmill', type: 'cardio' },
  { id: 'bike', ru: 'Велотренажёр', en: 'Stationary bike', muscle: 'cardio', equipment: 'bike', type: 'cardio' },

  // --- Тренажёры зала ---
  { id: 'lat_pulldown', ru: 'Тяга верхнего блока', en: 'Lat pulldown', muscle: 'back', equipment: 'machines', type: 'strength' },
  { id: 'seated_row', ru: 'Тяга горизонтального блока', en: 'Seated row', muscle: 'back', equipment: 'machines', type: 'strength' },
  { id: 'leg_press', ru: 'Жим ногами', en: 'Leg press', muscle: 'legs', equipment: 'machines', type: 'strength' },
  { id: 'leg_curl', ru: 'Сгибание ног', en: 'Leg curl', muscle: 'legs', equipment: 'machines', type: 'strength' },
  { id: 'leg_ext', ru: 'Разгибание ног', en: 'Leg extension', muscle: 'legs', equipment: 'machines', type: 'strength' },
  { id: 'chest_press_machine', ru: 'Жим в тренажёре на грудь', en: 'Machine chest press', muscle: 'chest', equipment: 'machines', type: 'strength' },
  { id: 'shoulder_press_machine', ru: 'Жим в тренажёре на плечи', en: 'Machine shoulder press', muscle: 'shoulders', equipment: 'machines', type: 'strength' },
  { id: 'cable_triceps', ru: 'Разгибания на блоке', en: 'Cable triceps pushdown', muscle: 'arms', equipment: 'machines', type: 'strength' },
  { id: 'rowing', ru: 'Гребной тренажёр', en: 'Rowing machine', muscle: 'cardio', equipment: 'machines', type: 'cardio' },
  { id: 'elliptical', ru: 'Эллипсоид', en: 'Elliptical', muscle: 'cardio', equipment: 'machines', type: 'cardio' },
]

/** Ссылка на поиск техники упражнения на YouTube. */
export function techniqueLink(ex: Exercise, lang: 'ru' | 'en'): string {
  const q = lang === 'ru' ? `${ex.ru} техника выполнения` : `${ex.en} proper form`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}
