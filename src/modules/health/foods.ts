// ============================================================
// Небольшая встроенная база распространённых продуктов.
// Значения на 100 г (приблизительные, для оценки). Без внешних API.
// ============================================================

export type FoodCategory = 'protein' | 'carb' | 'veg' | 'fruit' | 'fat' | 'dairy' | 'drink'

export interface Food {
  id: string
  ru: string
  en: string
  category: FoodCategory
  /** на 100 г */
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export const FOODS: Food[] = [
  // Белок
  { id: 'chicken_breast', ru: 'Куриная грудка', en: 'Chicken breast', category: 'protein', kcal: 165, protein: 31, fat: 3.6, carbs: 0 },
  { id: 'beef_lean', ru: 'Говядина постная', en: 'Lean beef', category: 'protein', kcal: 187, protein: 26, fat: 9, carbs: 0 },
  { id: 'pork_lean', ru: 'Свинина постная', en: 'Lean pork', category: 'protein', kcal: 210, protein: 27, fat: 11, carbs: 0 },
  { id: 'salmon', ru: 'Лосось', en: 'Salmon', category: 'protein', kcal: 208, protein: 20, fat: 13, carbs: 0 },
  { id: 'cod', ru: 'Треска', en: 'Cod', category: 'protein', kcal: 82, protein: 18, fat: 0.7, carbs: 0 },
  { id: 'tuna_can', ru: 'Тунец (консерв.)', en: 'Tuna (canned)', category: 'protein', kcal: 116, protein: 26, fat: 1, carbs: 0 },
  { id: 'egg', ru: 'Яйцо', en: 'Egg', category: 'protein', kcal: 155, protein: 13, fat: 11, carbs: 1.1 },
  { id: 'shrimp', ru: 'Креветки', en: 'Shrimp', category: 'protein', kcal: 99, protein: 24, fat: 0.3, carbs: 0.2 },
  { id: 'tofu', ru: 'Тофу', en: 'Tofu', category: 'protein', kcal: 76, protein: 8, fat: 4.8, carbs: 1.9 },

  // Молочное
  { id: 'cottage_cheese', ru: 'Творог 5%', en: 'Cottage cheese 5%', category: 'dairy', kcal: 121, protein: 17, fat: 5, carbs: 3 },
  { id: 'greek_yogurt', ru: 'Греческий йогурт', en: 'Greek yogurt', category: 'dairy', kcal: 59, protein: 10, fat: 0.4, carbs: 3.6 },
  { id: 'milk', ru: 'Молоко 2.5%', en: 'Milk 2.5%', category: 'dairy', kcal: 52, protein: 2.9, fat: 2.5, carbs: 4.7 },
  { id: 'cheese', ru: 'Сыр', en: 'Cheese', category: 'dairy', kcal: 350, protein: 25, fat: 27, carbs: 2 },

  // Углеводы / крупы
  { id: 'rice_cooked', ru: 'Рис варёный', en: 'Rice (cooked)', category: 'carb', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28 },
  { id: 'buckwheat_cooked', ru: 'Гречка варёная', en: 'Buckwheat (cooked)', category: 'carb', kcal: 110, protein: 4, fat: 1.1, carbs: 21 },
  { id: 'oats', ru: 'Овсянка (сухая)', en: 'Oats (dry)', category: 'carb', kcal: 379, protein: 13, fat: 7, carbs: 67 },
  { id: 'pasta_cooked', ru: 'Макароны варёные', en: 'Pasta (cooked)', category: 'carb', kcal: 131, protein: 5, fat: 1.1, carbs: 25 },
  { id: 'potato', ru: 'Картофель варёный', en: 'Potato (boiled)', category: 'carb', kcal: 87, protein: 2, fat: 0.1, carbs: 20 },
  { id: 'bread_whole', ru: 'Хлеб цельнозерновой', en: 'Whole-grain bread', category: 'carb', kcal: 247, protein: 13, fat: 3.4, carbs: 41 },
  { id: 'bread_white', ru: 'Хлеб белый', en: 'White bread', category: 'carb', kcal: 265, protein: 9, fat: 3.2, carbs: 49 },

  // Бобовые
  { id: 'lentils_cooked', ru: 'Чечевица варёная', en: 'Lentils (cooked)', category: 'protein', kcal: 116, protein: 9, fat: 0.4, carbs: 20 },
  { id: 'beans_cooked', ru: 'Фасоль варёная', en: 'Beans (cooked)', category: 'protein', kcal: 127, protein: 9, fat: 0.5, carbs: 22 },
  { id: 'chickpeas', ru: 'Нут варёный', en: 'Chickpeas (cooked)', category: 'protein', kcal: 164, protein: 9, fat: 2.6, carbs: 27 },

  // Овощи
  { id: 'broccoli', ru: 'Брокколи', en: 'Broccoli', category: 'veg', kcal: 34, protein: 2.8, fat: 0.4, carbs: 7 },
  { id: 'tomato', ru: 'Помидор', en: 'Tomato', category: 'veg', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
  { id: 'cucumber', ru: 'Огурец', en: 'Cucumber', category: 'veg', kcal: 15, protein: 0.7, fat: 0.1, carbs: 3.6 },
  { id: 'carrot', ru: 'Морковь', en: 'Carrot', category: 'veg', kcal: 41, protein: 0.9, fat: 0.2, carbs: 10 },
  { id: 'spinach', ru: 'Шпинат', en: 'Spinach', category: 'veg', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6 },
  { id: 'bell_pepper', ru: 'Перец болгарский', en: 'Bell pepper', category: 'veg', kcal: 31, protein: 1, fat: 0.3, carbs: 6 },

  // Фрукты
  { id: 'apple', ru: 'Яблоко', en: 'Apple', category: 'fruit', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14 },
  { id: 'banana', ru: 'Банан', en: 'Banana', category: 'fruit', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23 },
  { id: 'orange', ru: 'Апельсин', en: 'Orange', category: 'fruit', kcal: 47, protein: 0.9, fat: 0.1, carbs: 12 },
  { id: 'berries', ru: 'Ягоды', en: 'Berries', category: 'fruit', kcal: 57, protein: 0.7, fat: 0.3, carbs: 14 },

  // Жиры / орехи
  { id: 'olive_oil', ru: 'Оливковое масло', en: 'Olive oil', category: 'fat', kcal: 884, protein: 0, fat: 100, carbs: 0 },
  { id: 'butter', ru: 'Сливочное масло', en: 'Butter', category: 'fat', kcal: 717, protein: 0.9, fat: 81, carbs: 0.1 },
  { id: 'almonds', ru: 'Миндаль', en: 'Almonds', category: 'fat', kcal: 579, protein: 21, fat: 50, carbs: 22 },
  { id: 'peanut_butter', ru: 'Арахисовая паста', en: 'Peanut butter', category: 'fat', kcal: 588, protein: 25, fat: 50, carbs: 20 },
  { id: 'avocado', ru: 'Авокадо', en: 'Avocado', category: 'fat', kcal: 160, protein: 2, fat: 15, carbs: 9 },
]

export function findFood(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id)
}
