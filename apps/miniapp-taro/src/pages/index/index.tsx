import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { getHomePage, getCourseList, getLiveList, getStudyInfo, getBannerList, type Banner, type Course, type Live } from '@/api'
import { useI18n } from '@/i18n'

const defaultAvatar =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const entries = [
  { icon: '📚', key: 'home.entry.course', path: '/pages/course/list' },
  { icon: '📺', key: 'home.entry.live', path: '/pages/live/list' },
  { icon: '🤖', key: 'home.entry.ai', path: '/pages/ai/chat' },
  { icon: '📋', key: 'home.entry.order', path: '/pages/user/orders' },
  { icon: '⚙️', key: 'home.entry.setting', path: '/pages/user/settings' },
]

interface StudyStats {
  todayMinutes: number
  totalMinutes: number
  continuousDays: number
  courses: number
}

export default function Index() {
  const { t } = useI18n()
  const [isLogin, setIsLogin] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [bannerList, setBannerList] = useState<Banner[]>([])
  const [courseList, setCourseList] = useState<Course[]>([])
  const [livePreview, setLivePreview] = useState<Live[]>([])
  const [study, setStudy] = useState<StudyStats | null>(null)

  function refreshUser() {
    setIsLogin(isLoggedIn())
    setUserInfo(getUserInfo())
  }

  function goLogin() {
    Taro.navigateTo({ url: '/pages/login/login' })
  }

  function goPage(path: string) {
    Taro.switchTab({ url: path, fail: () => Taro.navigateTo({ url: path }) })
  }

  function goCourseDetail(id: string | number) {
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
  }

  function goLiveDetail(id: string | number) {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }

  function onBannerClick(item: Banner) {
    if (item.link) Taro.navigateTo({ url: item.link })
  }

  const loadData = useCallback(async () => {
    try {
      const [banners, courses, lives, studyRes, home] = await Promise.all([
        // 运营 banner 独立接口优先(支持精细化运营配置)
        getBannerList({ position: 'home', status: 1 })
          .then((res) => res.list || [])
          .catch(() => null),
        getCourseList({ page: 1, pageSize: 6 }).catch(() => ({ list: [] as Course[], total: 0 })),
        getLiveList({ page: 1, pageSize: 4, status: 'upcoming' }).catch(
          () => ({ list: [] as Live[], total: 0 }),
        ),
        getStudyInfo().catch(
          () => ({ todayMinutes: 0, totalMinutes: 0, continuousDays: 0, courses: 0 }),
        ),
        // 兜底:home 聚合接口里的 banner
        getHomePage().catch(() => null),
      ])
      const list =
        banners ?? (home?.banner as Banner[] | undefined) ?? []
      setBannerList(list)
      setCourseList(courses.list || [])
      setLivePreview(lives.list || [])
      setStudy(studyRes as StudyStats)
    } catch {
      // 静默处理,首页可离线展示
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useDidShow(() => {
    refreshUser()
  })

  // 微信分享配置(转发给好友/朋友圈)
  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/index/index',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  const showLearningSection = isLogin && study && study.courses > 0

  return (
    <View className="min-h-screen pb-[20px]">
      {/* 顶部用户信息条 */}
      <View
        className="flex items-center pt-[60px] px-[16px] pb-[16px]"
        style={{ background: 'linear-gradient(135deg, #07c160, #35e683)' }}
      >
        <Image
          className="w-[40px] h-[40px] rounded-md border-[1px] border-solid border-white"
          src={userInfo?.avatar || defaultAvatar}
          mode="aspectFill"
        />
        <View className="ml-[10px] flex flex-col">
          <Text className="text-white text-[15px] font-semibold">
            {userInfo?.userName || userInfo?.nickname || (isLogin ? t('common.user') : t('home.tapLogin'))}
          </Text>
          {isLogin ? (
            <Text className="text-white text-[11px] opacity-90">
              {study
                ? `${t('home.todayMinutes', { n: study.todayMinutes })} · ${t('home.continuousDays', { n: study.continuousDays })}`
                : t('home.slogan')}
            </Text>
          ) : (
            <Text className="text-white text-[11px] opacity-90" onClick={goLogin}>
              {t('home.slogan')}
            </Text>
          )}
        </View>
      </View>

      {/* 轮播图 */}
      <Swiper
        className="h-[140px] mx-[16px] my-[12px] rounded-[8px] overflow-hidden"
        indicatorDots
        autoplay
        interval={4000}
        circular
      >
        {bannerList.map((item) => (
          <SwiperItem key={item.id} onClick={() => onBannerClick(item)}>
            <Image className="w-full h-full" src={item.coverUrl} mode="aspectFill" />
          </SwiperItem>
        ))}
        {bannerList.length === 0 ? (
          <SwiperItem>
            <View className="w-full h-full flex items-center justify-center bg-white text-[#07c160] text-[15px]">
              <Text>{t('home.slogan')}</Text>
            </View>
          </SwiperItem>
        ) : null}
      </Swiper>

      {/* 学习进度(登录后) */}
      {showLearningSection && study ? (
        <View className="mx-[16px] mb-[12px] bg-white rounded-[8px] px-[12px] py-[12px]">
          <View className="flex justify-between items-center">
            <Text className="text-[15px] text-[#333] font-semibold">
              {t('home.learningProgress')}
            </Text>
            <Text
              className="text-[12px] text-[#999]"
              onClick={() => Taro.navigateTo({ url: '/pages/study/my-study/index' })}
            >
              {t('home.more')} {'>'}
            </Text>
          </View>
          <View className="flex mt-[10px]">
            <View className="flex-1 text-center">
              <Text className="block text-[18px] text-[#07c160] font-bold">
                {study.todayMinutes}
              </Text>
              <Text className="text-[11px] text-[#999] mt-[2px]">
                {t('home.todayMinutes', { n: '' })}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[18px] text-[#07c160] font-bold">
                {study.totalMinutes}
              </Text>
              <Text className="text-[11px] text-[#999] mt-[2px]">
                {t('home.totalMinutes', { n: '' })}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[18px] text-[#07c160] font-bold">
                {study.continuousDays}
              </Text>
              <Text className="text-[11px] text-[#999] mt-[2px]">
                {t('home.continuousDays', { n: '' })}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[18px] text-[#07c160] font-bold">{study.courses}</Text>
              <Text className="text-[11px] text-[#999] mt-[2px]">
                {t('home.coursesCount', { n: '' })}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* 直播预告 */}
      {livePreview.length > 0 ? (
        <View className="mx-[16px] my-[12px] bg-white rounded-[8px] px-[12px] py-[12px]">
          <View className="flex justify-between items-center">
            <Text className="text-[15px] text-[#333] font-semibold">{t('home.livePreview')}</Text>
            <Text className="text-[12px] text-[#999]" onClick={() => goPage('/pages/live/list')}>
              {t('home.more')} {'>'}
            </Text>
          </View>
          <ScrollView scrollX className="mt-[10px]">
            <View className="flex">
              {livePreview.map((live) => (
                <View
                  key={live.id}
                  className="inline-block w-[160px] mr-[10px] flex-shrink-0"
                  onClick={() => goLiveDetail(live.id)}
                >
                  <View className="relative w-[160px] h-[90px] rounded-[6px] overflow-hidden">
                    <Image className="w-full h-full" src={live.coverUrl} mode="aspectFill" />
                    <View className="absolute top-1 right-1 px-[4px] py-[1px] bg-[#f0ad4e] text-white text-[10px] rounded-[3px]">
                      <Text>{t('live.preview')}</Text>
                    </View>
                  </View>
                  <Text className="block mt-[6px] text-[12px] text-[#333] truncate">
                    {live.title}
                  </Text>
                  <Text className="block text-[10px] text-[#999] truncate">
                    {live.startTime ? `${t('home.startTime')}: ${live.startTime}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* 快捷入口 */}
      <View className="flex flex-wrap px-[16px] py-[10px] bg-white mx-[16px] rounded-[8px]">
        {entries.map((entry) => (
          <View
            key={entry.path}
            className="w-1/5 flex flex-col items-center py-[8px]"
            onClick={() => goPage(entry.path)}
          >
            <Text className="text-[22px]">{entry.icon}</Text>
            <Text className="mt-[3px] text-[11px] text-[#333]">{t(entry.key)}</Text>
          </View>
        ))}
      </View>

      {/* 推荐课程 */}
      <View className="mx-[16px] my-[12px]">
        <View className="flex justify-between items-center mb-[10px]">
          <Text className="text-[15px] font-semibold text-[#333]">{t('home.hotCourses')}</Text>
          <Text className="text-[12px] text-[#999]" onClick={() => goPage('/pages/course/list')}>
            {t('home.more')} {'>'}
          </Text>
        </View>
        <ScrollView scrollX>
          <View className="flex">
            {courseList.map((c) => (
              <View
                key={c.id}
                className="inline-block w-[140px] mr-[10px] bg-white rounded-[8px] overflow-hidden flex-shrink-0"
                onClick={() => goCourseDetail(c.id)}
              >
                <Image className="w-full h-[80px]" src={c.coverUrl} mode="aspectFill" />
                <Text className="block px-[6px] pt-[6px] text-[12px] text-[#333] truncate">
                  {c.title}
                </Text>
                <Text className="block px-[6px] pb-[6px] text-[13px] text-[#dd524d] font-semibold">
                  ¥{c.price ?? 0}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  )
}
