import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import {
  getAllStudyProgress,
  getCourses,
  getLiveList,
  type Course,
  type Live,
  type StudyProgress,
} from '@ihui/api-client'
import {
  HomeScreen as SharedHomeScreen,
  type HomeLiveItem,
  type HomeMenuItem,
  type HomeProgressItem,
  type HomeRecommendItem,
} from '@ihui/rn-app'
import type { CarouselItem } from '@ihui/ui-native'
import type { AiModelData } from '@ihui/types'
import CourseCarousel, { type CourseCarouselItem } from '../components/CourseCarousel'
import Carousel from '../components/Carousel'
import CardWithList, { type CardWithListItem } from '../components/CardWithList'
import { OfflineBanner } from '../components/OfflineBanner'
import AiModelCard from '../components/AiModelCard'
import { Toolbar, type ToolbarItem } from '../components/Toolbar'
import { GlobalFloatBox } from '../components/GlobalFloatBox'
import { KnowledgePlanet, type KnowledgePlanetItem } from '../components/KnowledgePlanet'
import PopularCourses, { type PopularCourse } from '../components/PopularCourses'
import { FunctionBlockColumn, type FunctionBlock } from '../components/FunctionBlockColumn'
import { BottomFigure } from '../components/BottomFigure'
import { MoreTitles } from '../components/MoreTitles'
import { useAuth } from '../context/AuthContext'
import { useNotificationStore } from '../stores/notification'
import { useI18n } from '../i18n'
import type {
  HomeStackParamList,
  MainTabParamList,
  RootStackParamList,
} from '../navigation/RootNavigator'
import { formatShortDateTime } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>
type TabNav = BottomTabNavigationProp<MainTabParamList>

const MENU_ITEMS: HomeMenuItem[] = [
  { key: 'Search', labelKey: 'menu.search', icon: '🔍' },
  { key: 'History', labelKey: 'menu.history', icon: '🕘' },
  { key: 'Bookmark', labelKey: 'menu.bookmark', icon: '🔖' },
  { key: 'CourseFilter', labelKey: 'menu.courseFilter', icon: '🎯' },
  { key: 'LiveList', labelKey: 'menu.liveList', icon: '📡' },
  { key: 'LivePlaybackList', labelKey: 'menu.livePlaybackList', icon: '🎬' },
  { key: 'CourseAnnex', labelKey: 'menu.courseAnnex', icon: '📎' },
  { key: 'CourseResource', labelKey: 'menu.courseResource', icon: '📚' },
  { key: 'CourseQAList', labelKey: 'menu.courseQAList', icon: '❓' },
]

function toRecommend(courses: Course[]): HomeRecommendItem[] {
  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    instructor: c.instructor,
    level: c.level,
    studentCount: c.studentCount,
    price: c.price,
    isFree: c.isFree,
  }))
}

function toLiveItem(lives: Live[]): HomeLiveItem[] {
  return lives.map((l) => ({
    id: l.id,
    title: l.title,
    lecturerName: l.lecturerName,
    isLive: l.isLive,
    startTimeText: formatShortDateTime(l.startTime),
  }))
}

function toProgressItem(items: StudyProgress[]): HomeProgressItem[] {
  return items.map((p) => ({
    courseId: p.courseId,
    courseTitle: p.courseTitle,
    progress: p.progress,
    completedLessons: p.completedLessons,
    totalLessons: p.totalLessons,
  }))
}

/** 顶部轮播:取前 5 条推荐课程,适配 CourseCarouselItem 形状 */
function toCarouselItems(items: HomeRecommendItem[]): CourseCarouselItem[] {
  return items.slice(0, 5).map((r) => ({
    id: r.id,
    title: r.title,
    price: r.price,
    isFree: r.isFree,
    icon: '📘',
  }))
}

/** KnowledgePlanet 数据:取推荐课程前 5 条转为资讯卡片形式 */
function toKnowledgeItems(items: HomeRecommendItem[]): KnowledgePlanetItem[] {
  return items.slice(0, 5).map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.instructor ? `讲师:${r.instructor}` : undefined,
    author: r.instructor || 'AI 智汇社',
    createdAt: Date.now(),
  }))
}

/** PopularCourses 数据:取推荐课程前 4 条(2 列网格 × 2 行) */
function toPopularCourseItems(items: HomeRecommendItem[]): PopularCourse[] {
  return items.slice(0, 4).map((r) => ({
    id: r.id,
    title: r.title,
    instructor: r.instructor || '未知讲师',
    lessons: 0,
    price: r.price,
    isFree: r.isFree,
    isVip: !r.isFree,
    studentCount: r.studentCount,
  }))
}

/** FunctionBlockColumn 功能块(对齐 Uniapp 首页功能入口) */
const FUNCTION_BLOCKS: FunctionBlock[] = [
  { id: 'distribution', title: '分销中心', icon: '🎁', description: '推广赚佣金' },
  { id: 'task', title: '任务中心', icon: '✅', description: '完成领奖励' },
  { id: 'checkin', title: '每日签到', icon: '📅', description: '连续签到得好礼' },
  { id: 'ranking', title: '排行榜', icon: '🏆', description: '查看学习排名' },
]

export function HomeScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const { connected, unreadCount, setVisible } = useNotificationStore()
  const [recommends, setRecommends] = useState<HomeRecommendItem[]>([])
  const [lives, setLives] = useState<HomeLiveItem[]>([])
  const [progress, setProgress] = useState<HomeProgressItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  /** 父级 RootStack 导航(用于跳转 Search/Chat/Promote 等 RootStack 路由) */
  const rootNav = navigation.getParent<RootNav>()
  /** 父级 Tabs 导航(用于跳转 'course' / 'live' 等 Tab 路由) */
  const tabNav = navigation.getParent<TabNav>()

  /** Carousel 轮播 banner(对齐 Uniapp 首页轮播图) */
  const bannerItems: CarouselItem[] = useMemo(
    () =>
      recommends.slice(0, 5).map((r) => ({
        img: '',
        title: r.title,
        link: r.id,
      })),
    [recommends],
  )

  /** CardWithList 推荐课程横向列表(对齐 Uniapp 首页推荐区) */
  const cardItems: CardWithListItem[] = useMemo(
    () =>
      recommends.slice(0, 6).map((r) => ({
        id: r.id,
        title: r.title,
        subtitle: r.instructor,
        icon: '📘',
      })),
    [recommends],
  )

  /** KnowledgePlanet 知识星球卡片数据(对齐 Uniapp 首页知识星球入口) */
  const knowledgeItems = useMemo(() => toKnowledgeItems(recommends), [recommends])

  /** PopularCourses 热门课程网格数据(对齐 Uniapp 首页热门课程区) */
  const popularCourseItems = useMemo(() => toPopularCourseItems(recommends), [recommends])

  /** AiModelCard AI 模型卡片(对齐 Uniapp 首页 AI 模型入口) */
  const aiModelData: AiModelData = {
    name: '智汇 AI 助手',
    subname: '智能问答 / 课程推荐',
    userType: 'freeuse',
    tags: ['免费', '热门'],
  }

  /** Toolbar 快捷工具栏(对齐 Uniapp 首页工具条) */
  const toolbarItems: ToolbarItem[] = [
    { key: 'search', icon: '🔍', onPress: () => rootNav?.navigate('Search') },
    { key: 'bookmark', icon: '🔖', onPress: () => rootNav?.navigate('Bookmark') },
    { key: 'history', icon: '🕘', onPress: () => rootNav?.navigate('History') },
    { key: 'share', icon: '📤', onPress: () => rootNav?.navigate('Share') },
  ]

  /** FunctionBlockColumn 点击路由映射 */
  const onFunctionBlockPress = (id: string) => {
    switch (id) {
      case 'distribution':
        rootNav?.navigate('Distribution')
        break
      case 'task':
        rootNav?.navigate('TaskCenter')
        break
      case 'checkin':
        rootNav?.navigate('CheckIn')
        break
      case 'ranking':
        rootNav?.navigate('Ranking')
        break
      default:
        // 未识别的入口 id,静默忽略(防御性:防止 FUNCTION_BLOCKS 配置漂移)
        break
    }
  }

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const [courseRes, liveRes, progressRes] = await Promise.all([
      getCourses({ page: 1, pageSize: 6 }),
      getLiveList({ page: 1, pageSize: 3 }),
      getAllStudyProgress({ page: 1, pageSize: 3 }),
    ])
    if (courseRes.success) setRecommends(toRecommend(courseRes.data.list))
    if (liveRes.success) setLives(toLiveItem(liveRes.data.list))
    if (progressRes.success) setProgress(toProgressItem(progressRes.data.list))
    if (!courseRes.success && !liveRes.success && !progressRes.success) {
      setError(courseRes.error || liveRes.error || progressRes.error || t('common.networkError'))
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carouselItems = useMemo<CourseCarouselItem[]>(
    () => toCarouselItems(recommends),
    [recommends],
  )

  return (
    <View style={shellStyles.root}>
      {/* OfflineBanner 网络状态横条(对齐 Uniapp 离线提示) */}
      <OfflineBanner isOnline={connected} />
      <ScrollView style={shellStyles.scroll} contentContainerStyle={shellStyles.scrollContent}>
        {/* Carousel banner 轮播(对齐 Uniapp 首页轮播图) */}
        {bannerItems.length > 0 ? (
          <View style={shellStyles.carouselWrap}>
            <Carousel
              banner={bannerItems}
              onItemPress={(item) => {
                if (item.link) navigation.navigate('CourseDetail', { id: item.link })
              }}
            />
          </View>
        ) : null}
        <CourseCarousel
          courses={carouselItems}
          onPress={(id) => navigation.navigate('CourseDetail', { id })}
        />
        {/* Toolbar 快捷工具栏(对齐 Uniapp 首页工具条) */}
        <View style={shellStyles.toolbarWrap}>
          <Toolbar items={toolbarItems} separators={['history']} />
        </View>
        {/* CardWithList 推荐课程横向列表(对齐 Uniapp 首页推荐区) */}
        {cardItems.length > 0 ? (
          <View style={shellStyles.cardListWrap}>
            <CardWithList
              title="推荐课程"
              items={cardItems}
              onItemClick={(id) => navigation.navigate('CourseDetail', { id })}
            />
          </View>
        ) : null}
        {/* AiModelCard AI 模型卡片(对齐 Uniapp 首页 AI 模型入口) */}
        <View style={shellStyles.aiModelWrap}>
          <AiModelCard
            data={aiModelData}
            onPress={() => rootNav?.navigate('Chat')}
          />
        </View>
        <SharedHomeScreen
          t={t}
          userNickname={user?.nickname || user?.phone || ''}
          connected={connected}
          unreadCount={unreadCount}
          recommends={recommends}
          lives={lives}
          progress={progress}
          menuItems={MENU_ITEMS}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={() => load(true)}
          onOpenNotifications={() => setVisible(true)}
          onPressProgress={(courseId) => navigation.navigate('CourseDetail', { id: courseId })}
          onPressLive={(id) => navigation.navigate('LiveDetail', { id })}
          onPressCourse={(id) => navigation.navigate('CourseDetail', { id })}
          onPressMenu={(key) => {
            switch (key) {
              case 'Search':
                rootNav?.navigate('Search')
                break
              case 'History':
                rootNav?.navigate('History')
                break
              case 'Bookmark':
                rootNav?.navigate('Bookmark')
                break
              case 'CourseFilter':
                rootNav?.navigate('CourseFilter')
                break
              case 'LiveList':
                rootNav?.navigate('LiveList')
                break
              case 'LivePlaybackList':
                rootNav?.navigate('LivePlaybackList')
                break
              case 'CourseAnnex':
                rootNav?.navigate('CourseAnnex')
                break
              case 'CourseResource':
                rootNav?.navigate('CourseResource')
                break
              case 'CourseQAList':
                rootNav?.navigate('CourseQAList')
                break
              default:
                // 未识别的菜单 key,静默忽略(防御性:防止菜单配置漂移)
                break
            }
          }}
          onNavigateCourses={() => tabNav?.navigate('course')}
          onNavigateLives={() => tabNav?.navigate('live')}
        />
        {/* KnowledgePlanet 知识星球卡片列表(对齐 Uniapp 首页知识星球入口) */}
        {knowledgeItems.length > 0 ? (
          <View style={shellStyles.sectionWrap}>
            <MoreTitles title="知识星球" />
            <KnowledgePlanet
              items={knowledgeItems}
              onItemClick={(id) => navigation.navigate('CourseDetail', { id })}
            />
          </View>
        ) : null}
        {/* PopularCourses 热门课程 2 列网格(对齐 Uniapp 首页热门课程区) */}
        {popularCourseItems.length > 0 ? (
          <View style={shellStyles.sectionWrap}>
            <PopularCourses
              courses={popularCourseItems}
              title="热门课程"
              subtitle="精选好课 0 元学"
              onPress={(id) => navigation.navigate('CourseDetail', { id })}
            />
          </View>
        ) : null}
        {/* FunctionBlockColumn 功能块列(对齐 Uniapp 首页功能入口) */}
        <View style={shellStyles.sectionWrap}>
          <MoreTitles title="功能入口" />
          <FunctionBlockColumn blocks={FUNCTION_BLOCKS} onBlockPress={onFunctionBlockPress} />
        </View>
        {/* BottomFigure 底部装饰图(对齐 Uniapp 首页底部装饰) */}
        <View style={shellStyles.bottomFigureWrap}>
          <BottomFigure />
        </View>
      </ScrollView>
      {/* GlobalFloatBox 全局浮窗按钮(对齐 Uniapp App.vue 全局浮窗) */}
      <GlobalFloatBox
        onPromote={() => rootNav?.navigate('Promote')}
        onConsult={() => rootNav?.navigate('CustomerService')}
        onMore={() => rootNav?.navigate('Settings')}
      />
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: 16 } as const,
  carouselWrap: { marginBottom: 8 } as const,
  toolbarWrap: { paddingHorizontal: 16, paddingVertical: 8 } as const,
  cardListWrap: { paddingHorizontal: 16, paddingVertical: 8 } as const,
  aiModelWrap: { paddingHorizontal: 16, paddingVertical: 8 } as const,
  sectionWrap: { paddingHorizontal: 16, paddingVertical: 8 } as const,
  bottomFigureWrap: { paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 } as const,
}
