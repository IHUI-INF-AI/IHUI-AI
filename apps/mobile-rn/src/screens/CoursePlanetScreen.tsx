/**
 * CoursePlanetScreen 课程星球页
 *
 * 对齐历史项目 pagesA/coursePlanet/index.vue(注:原文件模板整体被注释下线,
 * 但区块结构保留为对齐依据):
 * - 原页面结构:main-container(padding 20rpx, 渐变底 #fafcff→#81b5ff)
 *   > CourseCarousel(图片轮播) → MoreTitles(推荐课程) → Menu(课程菜单 8 项)
 *   → MoreTitles(课程赛道) → CourseCarouselList(入门/精选双 tab 列表)
 *   → MoreTitles(最新课程) → UpToDate(最新课程 2 列网格)
 * - RN 侧组件映射:CourseCarouselList → CourseCarousel variant='list'
 *   (CourseList1/CourseList2 → courses/courses2);UpToDate → CourseCarousel
 *   variant='UpToDate';顶部轮播 → CourseCarousel variant='swiper'。
 * - MoreTitles 原接收 images 装饰图 + title,RN 组件仅保留标题语义,3 处区段头一致对齐。
 * - Menu 默认 items 即原 Menu/index.vue 内置 8 项(tabbar/coursePlanet 图标),无需扩展 props。
 * - 加载态接入 components/common/Loading;原模板顶部搜索框不在本次对齐范围(原文件已注释)。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import { MoreTitles } from '../components/MoreTitles'
import Menu from '../components/Menu'
import Loading from '../components/common/Loading'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

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

/**
 * 顶部图片轮播(对齐来源:原 CourseCarousel/index.vue 内置 carouselList 7 张图,
 * 原页面 <CourseCarousel @item-click="onCarouselItemClick" /> 未传外部数据)
 */
const SWIPER_IMAGES: readonly string[] = [
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/lunbo6.jpg',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel1.jpg',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel2.jpg',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel3.jpg',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel4-footer1-two.png',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/lunbo1.png',
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/lunbo2.png',
]

/** 接口课程 → CourseCarouselItem(封面字段 coverImage → img) */
function toCarouselItem(c: PlanetCourse): CourseCarouselItem {
  return { id: c.id, title: c.title, price: c.price, isFree: c.isFree, img: c.coverImage }
}

export function CoursePlanetScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [data, setData] = useState<PlanetData>({ hot: [], beginner: [], selected: [] })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 对齐原 coursePlanet():getCoursePlanet → beginner_courses/selected_courses/hot_courses
  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<PlanetData>('/api/course-planet')
      if (res.success && res.data) {
        setData(res.data)
      } else {
        setError('加载失败，请下拉刷新重试')
      }
    } catch {
      setError('加载失败，请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  // 课程点击:对齐本页既有跳转(课程详情);原 vue 的 vip/pay 购买分流依赖支付与本地存储,不在本次范围
  const onCoursePress = useCallback(
    (id: string) => {
      navigation.navigate('CourseDetail', { id })
    },
    [navigation],
  )

  // 课程菜单点击:菜单 8 项即课程分类(图片/视频/文案/智能体/RPA/编程/音乐/其他),
  // 跳分类详情页(对齐 RootStack 已注册的 CategoryDetail 路由)
  const onMenuPress = useCallback(
    (item: { id: number | string; name: string }) => {
      navigation.navigate('CategoryDetail', { categoryId: String(item.id), title: item.name })
    },
    [navigation],
  )

  // 原入门/精选双 tab 列表(CourseList1/CourseList2)
  const beginnerItems = data.beginner.map(toCarouselItem)
  const selectedItems = data.selected.map(toCarouselItem)
  // 原最新课程网格(list)
  const hotItems = data.hot.map(toCarouselItem)

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 1. CourseCarousel 顶部图片轮播(对齐原 <CourseCarousel @item-click />,
            原点击回调仅 console.log,RN 侧不接线) */}
        <CourseCarousel courses={[]} variant="swiper" images={[...SWIPER_IMAGES]} />

        {/* 2. MoreTitles 推荐课程(对齐原 <MoreTitles :images="images" title="推荐课程" />) */}
        <MoreTitles title={t('courseScreen.recommended')} />

        {/* 3. Menu 课程菜单(对齐原 <Menu />,用组件默认 8 项即原 Menu/index.vue 数据) */}
        <Menu onPress={onMenuPress} />

        {/* 4. MoreTitles 课程赛道(对齐原 images=6.png 一处) */}
        <MoreTitles title={t('courseScreen.track')} />

        {/* 5. 入门/精选双 tab 课程列表(对齐原 <CourseCarouselList :CourseList1 :CourseList2 />) */}
        <CourseCarousel
          courses={beginnerItems}
          courses2={selectedItems}
          variant="list"
          onPress={onCoursePress}
        />

        {/* 6. MoreTitles 最新课程(对齐原 images=9.png 一处) */}
        <MoreTitles title={t('courseScreen.latest')} />

        {/* 7. 最新课程 2 列网格(对齐原 <UpToDate :list="list" />) */}
        <CourseCarousel courses={hotItems} variant="UpToDate" onPress={onCoursePress} />

        {/* 错误提示(原页面无,保留本页既有错误反馈能力) */}
        {error !== '' && !loading ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
      {/* 加载遮罩(对齐原项目 common/Loading 全屏 loading-mask 语义) */}
      {loading ? <Loading text={t('common.loading')} fullscreen /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // 原 main-container: linear-gradient(180deg,#fafcff 0%,#81b5ff 100%);
  // 项目未引入渐变库,取两端混合色 #C1DAFE 纯色近似
  root: {
    flex: 1,
    backgroundColor: '#C1DAFE',
  },
  scroll: {
    flex: 1,
  },
  // 原 main-container: padding:20rpx 20rpx 0 20rpx → 10dp(rpx/2 换算)
  scrollContent: {
    padding: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#D9534F',
    textAlign: 'center',
    paddingVertical: 8,
  },
})

export default CoursePlanetScreen
