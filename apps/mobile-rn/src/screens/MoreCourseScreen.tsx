/**
 * MoreCourseScreen 更多课程页
 *
 * 对齐历史项目 pagesA/course/MoreCourse.vue(TONG - 04/09):
 * - 原页面结构:main-container(渐变底) > CommissionFloatingIcon(悬浮,滚动区外)
 *   + scroll-view(page-scroll 宽 95% 居中) > Carousel → ToolBar → PopularCourses
 *   → KnowledgePlanet → BottomFigure
 * - 原页面 6 个公共组件此前在 RN 侧全部未接入,本文件按原顺序 1:1 组合本地
 *   components/ 下已存在的对应组件。
 * - 原页面各组件内部自行取数,RN 组件改为 props 注入:课程数据沿用本页既有的
 *   getCourses 分页加载;知识星球资讯沿用 KnowledgePlanetScreen 同源接口。
 * - 加载态接入 components/common/Loading(对齐原项目 common/Loading 遮罩语义)。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getCourses, type Course } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { CarouselItem } from '@ihui/ui-native'
import Carousel from '../components/Carousel'
import Toolbar from '../components/Toolbar'
import PopularCourses, { type PopularCourse } from '../components/PopularCourses'
import { KnowledgePlanet, type KnowledgePlanetItem } from '../components/KnowledgePlanet'
import BottomFigure from '../components/BottomFigure'
import CommissionFloatingIcon from '../components/CommissionFloatingIcon'
import Loading from '../components/common/Loading'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 10

/**
 * 轮播图数据(对齐来源:原 MoreCourse.vue 的 <Carousel /> 未传 banner,组件内部自渲染;
 * RN Carousel 需外部注入,复用历史项目 CourseCarousel/index.vue 内置的同源 7 张 CDN 图)
 */
const BANNER_ITEMS: CarouselItem[] = [
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/lunbo6.jpg',
  },
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel1.jpg',
  },
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel2.jpg',
  },
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel3.jpg',
  },
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/carousel4-footer1-two.png',
  },
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/lunbo1.png',
  },
  {
    img: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/carousel4-footer1/lunbo2.png',
  },
]

/** 知识星球资讯接口(api 层 miniapp-compat 路由,返回 { list, total };旧路径 /resource/getKnowledgePlanet 已下线 404) */
const PLANET_API_PATH = '/api/knowledge-planet/news'

/** 时间字段归一化为毫秒时间戳(复用 KnowledgePlanetScreen 既有实现) */
function toTimestamp(time: string | number | undefined): number {
  if (time === undefined || time === null) return Date.now()
  if (typeof time === 'number') {
    return time < 1e12 ? time * 1000 : time
  }
  const parsed = Date.parse(time)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/** 课程列表 → PopularCourses 网格数据(取前 6 条:2 列 × 3 行;unknownInstructor 兜底文案参数化走 i18n) */
function toPopularCourses(items: Course[], unknownInstructor: string): PopularCourse[] {
  return items.slice(0, 6).map((item) => ({
    id: String(item.id),
    title: item.title,
    instructor: item.instructor || unknownInstructor,
    lessons: item.lessonCount,
    price: item.price,
    isFree: item.isFree,
    isVip: !item.isFree,
    studentCount: item.studentCount,
  }))
}

export function MoreCourseScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [planetItems, setPlanetItems] = useState<KnowledgePlanetItem[]>([])

  // 原页面为 scroll-view 整页滚动无触底分页,课程取首页数据供热门课程网格展示
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getCourses({ page: 1, pageSize: PAGE_SIZE })
      if (!res.success) throw new Error(res.error)
      setItems(res.data.list ?? [])
    } catch {
      setError('加载失败,请下拉刷新重试')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  /** 知识星球资讯加载(api 层 newsArticles 数据源;失败静默,区块走空态) */
  const loadPlanet = useCallback(async () => {
    try {
      const res = await fetchApi<{
        list: {
          id: string | number
          title: string
          summary?: string | null
          coverImage?: string | null
          createdAt?: string | number
        }[]
        total: number
      }>(PLANET_API_PATH)
      if (!res.success) return
      setPlanetItems(
        (res.data?.list ?? []).map((raw) => ({
          id: String(raw.id),
          title: raw.title,
          cover: raw.coverImage ?? undefined,
          summary: raw.summary ?? undefined,
          createdAt: toTimestamp(raw.createdAt),
        })),
      )
    } catch {
      // 资讯为辅区块,失败不打断主课程列表
    }
  }, [])

  useEffect(() => {
    void load()
    void loadPlanet()
  }, [load, loadPlanet])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
    void loadPlanet()
  }

  // Toolbar 跳转映射(对齐 HomeScreen 既有 onToolbar* 映射,保持全端一致;
  // 原 MoreCourse.vue 的 <ToolBar /> 组件内部自行 navigateTo,RN 侧收敛为回调注入)
  const onToolbarMore = () => navigation.navigate('AgentMarket')
  const onToolbarBanner = () => navigation.navigate('AigcList')
  const onToolbarToolPress = (key: string) => {
    switch (key) {
      case 'ai_live': // AI直播
        navigation.navigate('LiveList')
        break
      case 'ai_avatar': // AI数字人
      case 'ai_image':
      case 'ai_video':
      case 'ai_wenan':
      case 'ai_clip':
        navigation.navigate('AigcList')
        break
      default:
        break
    }
  }
  const onToolbarCustomMade = () => navigation.navigate('AgentMarket')

  return (
    <View style={styles.root}>
      {/* 悬浮佣金入口(对齐原 MoreCourse.vue:CommissionFloatingIcon 位于 main-container 层,
          渲染在滚动区外;RN 组件无拖拽 props,按其现有 onPress 跳 EarnCommission 分销页) */}
      <CommissionFloatingIcon onPress={() => navigation.navigate('EarnCommission')} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 1. Carousel 轮播(对齐原 <Carousel @item-click />,原点击回调为空实现,RN 侧同样不接线) */}
        <Carousel banner={BANNER_ITEMS} />

        {/* 2. ToolBar 首页内容大块(对齐原 <ToolBar />,items 传空数组只渲染内容大块) */}
        <Toolbar
          items={[]}
          onMorePress={onToolbarMore}
          onBannerPress={onToolbarBanner}
          onToolPress={onToolbarToolPress}
          onCustomServicePress={onToolbarCustomMade}
        />

        {/* 3. PopularCourses 热门课程(对齐原 <PopularCourses />,数据来自本页 getCourses) */}
        <PopularCourses
          courses={toPopularCourses(items, t('courseScreen.unknownInstructor'))}
          title={t('courseScreen.popular')}
          onPress={(id) => navigation.navigate('CourseDetail', { id })}
          onMore={() => navigation.navigate('CourseFilter')}
        />

        {/* 4. KnowledgePlanet 知识星球(对齐原 <KnowledgePlanet />;"进入星球"跳知识星球页,
            资讯点击跳公告详情,均对齐 KnowledgePlanetScreen 既有跳转) */}
        <KnowledgePlanet
          items={planetItems}
          onItemClick={(id) => navigation.navigate('AnnouncementDetail', { id })}
          onEnter={() => navigation.navigate('KnowledgePlanet')}
        />

        {/* 5. BottomFigure 底部图(对齐原 <BottomFigure />,缺省用组件内置 3 张原项目图;
            原项目仅 index===1 跳招聘页,对齐跳 Recruitment) */}
        <BottomFigure
          onItemPress={(_, index) => {
            if (index === 1) navigation.navigate('Recruitment')
          }}
        />

        {/* 错误提示(原页面无,保留本页既有错误反馈能力) */}
        {error !== '' && !loading ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </ScrollView>
      {/* 加载遮罩(对齐原项目 common/Loading 全屏 loading-mask 语义) */}
      {loading ? <Loading text={t('common.loading')} fullscreen /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // 原 main-container: linear-gradient(180deg,#93D2F3,#93D2E2,#9bd1d1);
  // 项目未引入渐变库,取中间色 #93D2E2 纯色近似
  root: {
    flex: 1,
    backgroundColor: '#93D2E2',
  },
  // 原 page-scroll: width:95%; margin:0 auto(RN 用百分比宽 + 居中对齐等价实现)
  scroll: {
    flex: 1,
    width: '95%',
    alignSelf: 'center',
  },
  // 原 .container: padding-bottom:40rpx → 20dp(区块间距由组件自带 marginTop 承担,
  // 对齐原页面不在页面层额外加区块间距的写法)
  scrollContent: {
    paddingBottom: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#D9534F',
    textAlign: 'center',
    paddingVertical: 8,
  },
})
