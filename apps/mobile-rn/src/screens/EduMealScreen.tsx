// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 食堂餐次模板页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen
 * (覆盖 web edu/edu-management/meal 的模板实体,复合页首版)。
 * 端点(与 web meal/page.tsx 同源):
 *  - GET /api/edu-ai-management/meal/template ⇒ { list: MealTemplate[] }
 * 首版承载餐次模板列表;菜谱(MealRecipe)与按周排餐编辑排后续轮。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface MealTemplate {
  id: string
  name: string
  weekday: number
  mealType: string
  dishName: string
  ingredients: string | null
  nutrition: string | null
  notes: string | null
}

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function EduMealScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const weekdayLabel = useCallback(
    (n: number) => {
      const key = `eduSchedule.weekday.${WEEKDAY_KEYS[n - 1] ?? ''}`
      const v = t(key)
      return v === key ? String(n) : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ list: MealTemplate[] }>('/api/edu-ai-management/meal/template')
      if (!res.success) throw new Error(res.error || 'load failed')
      setRows(
        (res.data?.list ?? []).map((m) => ({
          id: m.id,
          cells: {
            name: m.name,
            weekday: weekdayLabel(m.weekday),
            mealType: m.mealType,
            dish: m.dishName,
            ingredients: m.ingredients ?? '—',
            nutrition: m.nutrition ?? '—',
          },
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [weekdayLabel])

  useEffect(() => {
    void load()
  }, [load])

  const columns: ConsoleColumn[] = [
    { key: 'name', title: t('eduMeal.name'), flex: 2 },
    { key: 'weekday', title: t('eduSchedule.weekdayTitle'), render: 'badge' },
    { key: 'mealType', title: t('eduChildMeals.mealType') },
    { key: 'dish', title: t('eduChildMeals.dish'), flex: 2 },
    { key: 'ingredients', title: t('eduChildMeals.ingredients'), flex: 2 },
    { key: 'nutrition', title: t('eduChildMeals.nutrition') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('eduMeal.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
    />
  )
}

export default EduMealScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
