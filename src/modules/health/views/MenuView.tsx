import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { UtensilsCrossed, Coffee, Sun, Moon, Apple, Info } from 'lucide-react'
import { useStore } from '../../../store'
import { Card, Empty } from '../../../components/ui'
import { computeHealth } from '../calc'
import { FOODS, type Food, type FoodCategory } from '../foods'

interface MealDef {
  key: string
  share: number
  icon: typeof Coffee
  /** Категории-кандидаты для подбора примеров продуктов. */
  categories: FoodCategory[]
}

// Доли приёмов пищи: завтрак 25%, обед 35%, ужин 30%, перекус 10%.
const MEALS: MealDef[] = [
  { key: 'mealBreakfast', share: 0.25, icon: Coffee, categories: ['dairy', 'carb', 'fruit'] },
  { key: 'mealLunch', share: 0.35, icon: Sun, categories: ['protein', 'carb', 'veg'] },
  { key: 'mealDinner', share: 0.3, icon: Moon, categories: ['protein', 'carb', 'veg'] },
  { key: 'mealSnack', share: 0.1, icon: Apple, categories: ['fruit', 'fat', 'dairy'] },
]

interface MealItem {
  food: Food
  grams: number
  kcal: number
}

/** Первый продукт указанной категории (стабильный порядок из FOODS). */
function pickFood(category: FoodCategory): Food | undefined {
  return FOODS.find((f) => f.category === category && f.kcal > 0)
}

export default function MenuView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'
  const profile = useStore((s) => s.data.healthProfile)

  const result = useMemo(() => (profile ? computeHealth(profile) : null), [profile])

  // Примерный рацион: для каждого приёма распределяем его ккал между подходящими
  // продуктами поровну и переводим в граммы (округление до 10 г). Приблизительно.
  const plan = useMemo(() => {
    if (!result) return []
    return MEALS.map((meal) => {
      const mealKcal = Math.round(result.targetKcal * meal.share)
      const foods = meal.categories
        .map(pickFood)
        .filter((f): f is Food => Boolean(f))
      const perFood = foods.length > 0 ? mealKcal / foods.length : 0
      const items: MealItem[] = foods.map((food) => {
        const grams = Math.max(10, Math.round(perFood / (food.kcal / 100) / 10) * 10)
        const kcal = Math.round((food.kcal / 100) * grams)
        return { food, grams, kcal }
      })
      return { meal, mealKcal, items }
    })
  }, [result])

  if (!profile || !result) {
    return (
      <Card>
        <Empty icon={<UtensilsCrossed size={28} />} text={t('health.menuNoProfile')} />
      </Card>
    )
  }

  const macros = result.macros

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-[var(--text-2)]">{t('health.menuTargetKcal')}</span>
          <span className="text-xl font-semibold tnum">
            {result.targetKcal} {t('health.menuKcalUnit')}
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--text-3)]">{t('health.menuIntro')}</p>
      </Card>

      {plan.map(({ meal, mealKcal, items }) => {
        const Icon = meal.icon
        return (
          <Card key={meal.key}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon size={16} style={{ color: 'var(--accent)' }} />
                {t(`health.${meal.key}`)}
              </span>
              <span className="text-sm text-[var(--text-2)] tnum">
                {mealKcal} {t('health.menuKcalUnit')}
                <span className="text-[var(--text-3)]">
                  {' · '}
                  {Math.round(meal.share * 100)}% {t('health.menuShare')}
                </span>
              </span>
            </div>
            <div>
              {items.map(({ food, grams, kcal }, idx) => (
                <div
                  key={food.id}
                  className="flex items-center justify-between gap-3 py-2"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{food[lang]}</span>
                  <span className="shrink-0 text-sm font-medium tnum">
                    {grams} {t('health.menuGramsUnit')}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--text-3)] tnum">
                    {kcal} {t('health.menuKcalUnit')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">
          {t('health.menuMacrosTitle')}
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold tnum">{macros.protein} {t('health.menuGramsUnit')}</div>
            <div className="text-xs text-[var(--text-3)]">{t('health.menuProtein')}</div>
          </div>
          <div>
            <div className="text-lg font-semibold tnum">{macros.fat} {t('health.menuGramsUnit')}</div>
            <div className="text-xs text-[var(--text-3)]">{t('health.menuFat')}</div>
          </div>
          <div>
            <div className="text-lg font-semibold tnum">{macros.carbs} {t('health.menuGramsUnit')}</div>
            <div className="text-xs text-[var(--text-3)]">{t('health.menuCarbs')}</div>
          </div>
        </div>
      </Card>

      <p className="flex items-start gap-2 px-1 text-xs text-[var(--text-3)]">
        <Info size={14} className="mt-0.5 shrink-0" />
        {t('health.menuExampleHint')}
      </p>
    </div>
  )
}
