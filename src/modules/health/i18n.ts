// i18n модуля «Здоровье». Общие ключи — здесь; ключи каждой вкладки —
// в отдельном файле views/<name>.i18n.ts (плоские строки под namespace health).
// Object.assign достаточно: ключи плоские и не пересекаются между вкладками.

import calcI18n from './views/calc.i18n'
import weightI18n from './views/weight.i18n'
import menuI18n from './views/menu.i18n'
import diaryI18n from './views/diary.i18n'
import workoutI18n from './views/workout.i18n'

const sharedRu = {
  title: 'Здоровье',
  subtitle: 'Калории, БЖУ и активность под твою цель',
  disclaimer:
    'Это образовательный калькулятор, а не медицинская рекомендация. При проблемах со здоровьем обратитесь к врачу.',
  tabCalc: 'Нормы',
  tabWeight: 'Вес',
  tabMenu: 'Меню',
  tabDiary: 'Дневник',
  tabWorkout: 'Тренировки',
}

const sharedEn = {
  title: 'Health',
  subtitle: 'Calories, macros and activity for your goal',
  disclaimer:
    'This is an educational calculator, not medical advice. Consult a doctor if you have health concerns.',
  tabCalc: 'Targets',
  tabWeight: 'Weight',
  tabMenu: 'Menu',
  tabDiary: 'Diary',
  tabWorkout: 'Workouts',
}

export default {
  ru: {
    health: Object.assign(
      {},
      sharedRu,
      calcI18n.ru,
      weightI18n.ru,
      menuI18n.ru,
      diaryI18n.ru,
      workoutI18n.ru,
    ),
  },
  en: {
    health: Object.assign(
      {},
      sharedEn,
      calcI18n.en,
      weightI18n.en,
      menuI18n.en,
      diaryI18n.en,
      workoutI18n.en,
    ),
  },
}
