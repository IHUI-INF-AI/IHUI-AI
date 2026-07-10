import { View, Text, Image, Swiper, SwiperItem, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { getHomePage, getCourseList, type Banner, type Course } from '@/api'

const defaultAvatar = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const entries = [
  { icon: '📚', text: '课程', path: '/pages/course/list' },
  { icon: '📺', text: '直播', path: '/pages/live/list' },
  { icon: '🤖', text: 'AI', path: '/pages/ai/chat' },
  { icon: '📋', text: '订单', path: '/pages/user/orders' },
  { icon: '⚙️', text: '设置', path: '/pages/user/settings' },
]

export default function Index() {
  const [isLogin, setIsLogin] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [bannerList, setBannerList] = useState<Banner[]>([])
  const [courseList, setCourseList] = useState<Course[]>([])

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

  function onBannerClick(item: Banner) {
    if (item.link) Taro.navigateTo({ url: item.link })
  }

  async function loadData() {
    try {
      const [home, courses] = await Promise.all([
        getHomePage().catch(() => ({ banner: [] })),
        getCourseList({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0 })),
      ])
      setBannerList(home.banner || [])
      setCourseList(courses.list || [])
    } catch (e) {
      // 静默处理，首页可离线展示
    }
  }

  useEffect(() => { loadData() }, [])
  useDidShow(() => { refreshUser() })

  return (
    <View className="min-h-screen pb-[20px]">
      {/* 顶部用户信息条 */}
      {isLogin && userInfo ? (
        <View
          className="flex items-center pt-[60px] px-[16px] pb-[12px]"
          style={{ background: 'linear-gradient(135deg, #007aff, #00c6ff)' }}
        >
          <Image
            className="w-[36px] h-[36px] rounded-full border-[1px] border-solid border-white"
            src={userInfo.avatar || defaultAvatar}
            mode="aspectFill"
          />
          <View className="ml-[10px] flex items-center">
            <Text className="text-white text-[15px] font-semibold">
              {userInfo.userName || userInfo.nickname || '用户'}
            </Text>
            {userInfo.isVip ? (
              <Text className="ml-[6px] px-[6px] py-[1px] bg-[#f0ad4e] text-white text-[10px] rounded-[10px]">
                VIP
              </Text>
            ) : null}
          </View>
          <Text className="ml-auto text-white text-[13px]" onClick={goLogin}>去登录</Text>
        </View>
      ) : (
        <View
          className="flex items-center pt-[60px] px-[16px] pb-[12px]"
          style={{ background: 'linear-gradient(135deg, #007aff, #00c6ff)' }}
        >
          <Image
            className="w-[36px] h-[36px] rounded-full border-[1px] border-solid border-white"
            src={defaultAvatar}
            mode="aspectFill"
          />
          <Text className="ml-[10px] text-white text-[15px] font-semibold" onClick={goLogin}>
            点击登录
          </Text>
        </View>
      )}

      {/* 轮播图 */}
      <Swiper
        className="h-[140px] mx-[16px] my-[12px] rounded-[8px] overflow-hidden"
        indicatorDots
        autoplay
        interval={4000}
        circular
      >
        {bannerList.map(item => (
          <SwiperItem key={item.id} onClick={() => onBannerClick(item)}>
            <Image className="w-full h-full" src={item.coverUrl} mode="aspectFill" />
          </SwiperItem>
        ))}
        {bannerList.length === 0 ? (
          <SwiperItem>
            <View className="w-full h-full flex items-center justify-center bg-white text-[#007aff] text-[15px]">
              <Text>智汇社区 · AI 赋能学习</Text>
            </View>
          </SwiperItem>
        ) : null}
      </Swiper>

      {/* 功能入口 */}
      <View className="flex flex-wrap px-[16px] py-[8px] bg-white mx-[16px] rounded-[8px]">
        {entries.map(entry => (
          <View
            key={entry.path}
            className="w-1/5 flex flex-col items-center py-[12px]"
            onClick={() => goPage(entry.path)}
          >
            <Text className="text-[24px]">{entry.icon}</Text>
            <Text className="mt-[4px] text-[12px] text-[#333]">{entry.text}</Text>
          </View>
        ))}
      </View>

      {/* 推荐课程 */}
      <View className="mx-[16px] my-[16px]">
        <View className="flex justify-between items-center mb-[10px]">
          <Text className="text-[16px] font-semibold text-[#333]">热门课程</Text>
          <Text className="text-[12px] text-[#999]" onClick={() => goPage('/pages/course/list')}>
            更多 {'>'}
          </Text>
        </View>
        <ScrollView scrollX>
          <View className="flex">
            {courseList.map(c => (
              <View
                key={c.id}
                className="inline-block w-[140px] mr-[10px] bg-white rounded-[8px] overflow-hidden flex-shrink-0"
                onClick={() => goCourseDetail(c.id)}
              >
                <Image className="w-full h-[80px]" src={c.coverUrl} mode="aspectFill" />
                <Text className="block px-[6px] pt-[6px] text-[13px] text-[#333] truncate">
                  {c.title}
                </Text>
                <Text className="block px-[6px] pb-[6px] text-[14px] text-[#dd524d] font-semibold">
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
