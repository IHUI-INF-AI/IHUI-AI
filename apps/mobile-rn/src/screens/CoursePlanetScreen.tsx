// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CoursePlanetScreen 课程星球页 —— mobile-rn 薄壳。
 *
 * 渲染主体是共享层 `@ihui/rn-app` 的 CoursePlanetScreen（单一真相源）：
 * 壳侧只保留数据加载（`GET /api/course-planet`）、tab 选中态与导航端口注入，
 * 不再复制共享屏的课程列表渲染。
 *
 * 路由与入口：RootNavigator.tsx:678/1245，drawer-nav.ts:259/921-922。
 * 端口口径：共享屏全部 props 逐项真实接线；`onRetry` 单独绑定真实 reload，
 * 不用 `onRetry ?? onRefresh` 之类的别名，也不回落空函数。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { toUserFriendlyMessage } from '@ihui/shared/utils'
import {
  CoursePlanetScreen as SharedCoursePlanetScreen,
  type CoursePlanetMenuEntry,
} from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { ImageSourcePropType } from 'react-native'
import IMG_LUNBO6 from '../../assets/images/carousel/lunbo6.jpg'
import IMG_CAROUSEL1 from '../../assets/images/carousel/carousel1.jpg'
import IMG_CAROUSEL2 from '../../assets/images/carousel/carousel2.jpg'
import IMG_CAROUSEL3 from '../../assets/images/carousel/carousel3.jpg'
import IMG_CAROUSEL_TWO from '../../assets/images/carousel/carousel4-footer1-two.png'
import IMG_LUNBO1 from '../../assets/images/carousel/lunbo1.png'
import IMG_LUNBO2 from '../../assets/images/carousel/lunbo2.png'
import IMG_MENU_PIC from '../../assets/images/menu/8.png'
import IMG_MENU_VIDEO from '../../assets/images/menu/4.png'
import IMG_MENU_COPY from '../../assets/images/menu/2.png'
import IMG_MENU_AGENT from '../../assets/images/menu/11.png'
import IMG_MENU_RPA from '../../assets/images/menu/5.png'
import IMG_MENU_CODE from '../../assets/images/menu/7.png'
import IMG_MENU_MUSIC from '../../assets/images/menu/3.png'
import IMG_MENU_OTHER from '../../assets/images/menu/10.png'

/** 顶部轮播 7 张图(旧壳 SWIPER_IMAGES 原样恢复;打包器返回资源句柄,类型按 RN 口径收窄) */
const BANNER_IMAGES = [
  IMG_LUNBO6,
  IMG_CAROUSEL1,
  IMG_CAROUSEL2,
  IMG_CAROUSEL3,
  IMG_CAROUSEL_TWO,
  IMG_LUNBO1,
  IMG_LUNBO2,
] as unknown as readonly ImageSourcePropType[]

/** 菜单项 id/图标与 label 的 i18n 键(旧壳 Menu 默认 8 项,顺序不变) */
const MENU_ENTRIES = [
  { id: '1', name: 'menu.catImage', icon: IMG_MENU_PIC },
  { id: '2', name: 'menu.catVideo', icon: IMG_MENU_VIDEO },
  { id: '3', name: 'menu.catCopy', icon: IMG_MENU_COPY },
  { id: '4', name: 'menu.catAgent', icon: IMG_MENU_AGENT },
  { id: '5', name: 'menu.catRpa', icon: IMG_MENU_RPA },
  { id: '6', name: 'menu.catCode', icon: IMG_MENU_CODE },
  { id: '7', name: 'menu.catMusic', icon: IMG_MENU_MUSIC },
  { id: '8', name: 'menu.catOther', icon: IMG_MENU_OTHER },
] as const

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type CourseType = 'all' | 'free' | 'paid'

/** 课程星球接口返回的单门课程(沿用本页既有取数契约) */
interface PlanetCourse {
  id: string
  title: string
  coverImage?: string
  price: number
  isFree: boolean
}

interface PlanetData {
  hot: PlanetCourse[]
  beginner: PlanetCourse[]
  selected: PlanetCourse[]
}

const EMPTY_DATA: PlanetData = { hot: [], beginner: [], selected: [] }

export function CoursePlanetScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<PlanetData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<CourseType>('all')

  // 对齐原 coursePlanet():getCoursePlanet → beginner_courses/selected_courses/hot_courses
  const reload = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<PlanetData>('/api/course-planet')
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError(t('common.loadFailPullRetry'))
      }
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
      setError(detail.trim() ? toUserFriendlyMessage(e) : t('common.loadFailPullRetry'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void reload()
  }, [reload])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void reload()
  }, [reload])

  // 菜单 label 走既有 i18n key（旧壳 Menu 默认 8 项，顺序/图标不变）
  const menuItems = useMemo<CoursePlanetMenuEntry[]>(
    () => MENU_ENTRIES.map((item) => ({ id: item.id, label: t(item.name), icon: item.icon })),
    [t],
  )

  // 菜单项即课程分类：跳分类详情（旧壳 onMenuPress 语义）
  const onMenuPress = useCallback(
    (item: CoursePlanetMenuEntry) => {
      navigation.navigate('CategoryDetail', { categoryId: item.id, title: item.label })
    },
    [navigation],
  )

  return (
    <SharedCoursePlanetScreen
      t={t}
      data={data}
      loading={loading}
      refreshing={refreshing}
      error={error}
      selectedType={selectedType}
      onTypeChange={setSelectedType}
      onCoursePress={(id) => navigation.navigate('CourseDetail', { id })}
      onRefresh={onRefresh}
      onBack={() => navigation.goBack()}
      onRetry={reload}
      bannerImages={BANNER_IMAGES}
      menuItems={menuItems}
      onMenuPress={onMenuPress}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
