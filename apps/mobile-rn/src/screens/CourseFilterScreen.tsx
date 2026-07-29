import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  CourseFilterScreen as SharedCourseFilterScreen,
  type CourseFilterItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { usePaginatedList } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type Category = 'all' | 'tech' | 'design' | 'business' | 'language'
type Level = 'all' | 'beginner' | 'intermediate' | 'advanced'
type PriceTab = 'all' | 'free' | 'paid'

interface CourseItem {
  id: string
  title: string
  instructor: string
  level: 'beginner' | 'intermediate' | 'advanced'
  price: number
  category: string
  cover: string | null
}

interface CoursePage {
  list: CourseItem[]
  total: number
}

const PAGE_SIZE = 20

export function CourseFilterScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [category, setCategory] = useState<Category>('all')
  const [level, setLevel] = useState<Level>('all')
  const [priceTab, setPriceTab] = useState<PriceTab>('all')

  const fetcher = useCallback(async () => {
    const res = await fetchApi<CoursePage>('/courses', {
      params: { page: 1, pageSize: PAGE_SIZE, category, level, price: priceTab },
    })
    if (!res.success) return { success: false as const, error: t('courseFilter.loadFailed') }
    const list = res.data?.list ?? []
    return { success: true as const, data: { list, total: res.data?.total ?? list.length } }
  }, [category, level, priceTab, t])

  const { items, loading, refreshing, error, refresh } = usePaginatedList<CourseItem>(
    fetcher,
    PAGE_SIZE,
  )

  const applyFilter = () => {
    setTimeout(refresh, 0)
  }

  const reset = () => {
    setCategory('all')
    setLevel('all')
    setPriceTab('all')
    setTimeout(refresh, 50)
  }

  const filterItems: CourseFilterItem[] = items.map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    level: c.level,
    price: c.price,
  }))

  return (
    <SharedCourseFilterScreen
      t={t}
      items={filterItems}
      loading={loading}
      refreshing={refreshing}
      error={error}
      category={category}
      level={level}
      priceTab={priceTab}
      onCategoryChange={setCategory}
      onLevelChange={setLevel}
      onPriceTabChange={setPriceTab}
      onApply={applyFilter}
      onReset={reset}
      onRefresh={refresh}
      onBack={() => navigation.goBack()}
    />
  )
}
