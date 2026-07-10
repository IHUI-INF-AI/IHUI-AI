<template>
  <view class="page">
    <!-- 顶部用户信息条 -->
    <view v-if="isLogin && userInfo" class="user-bar">
      <image class="avatar" :src="userInfo.avatar || defaultAvatar" mode="aspectFill" />
      <view class="user-meta">
        <text class="name">{{ userInfo.userName || userInfo.nickname || '用户' }}</text>
        <text v-if="userInfo.isVip" class="vip-tag">VIP</text>
      </view>
      <text class="login-entry" v-else @tap="goLogin">去登录</text>
    </view>
    <view v-else class="user-bar">
      <image class="avatar" :src="defaultAvatar" mode="aspectFill" />
      <text class="name" @tap="goLogin">点击登录</text>
    </view>

    <!-- 轮播图 -->
    <swiper class="banner" :indicator-dots="true" :autoplay="true" :interval="4000" circular>
      <swiper-item v-for="item in bannerList" :key="item.id" @tap="onBannerClick(item)">
        <image class="banner-img" :src="item.coverUrl" mode="aspectFill" />
      </swiper-item>
      <swiper-item v-if="bannerList.length === 0">
        <view class="banner-empty"><text>智汇社区 · AI 赋能学习</text></view>
      </swiper-item>
    </swiper>

    <!-- 功能入口 -->
    <view class="entry-grid">
      <view class="entry-item" v-for="entry in entries" :key="entry.path" @tap="goPage(entry.path)">
        <text class="entry-icon">{{ entry.icon }}</text>
        <text class="entry-text">{{ entry.text }}</text>
      </view>
    </view>

    <!-- 推荐课程 -->
    <view class="section">
      <view class="section-head">
        <text class="section-title">热门课程</text>
        <text class="section-more" @tap="goPage('/pages/course/list')">更多 ></text>
      </view>
      <scroll-view scroll-x class="course-scroll" :show-scrollbar="false">
        <view class="course-card" v-for="c in courseList" :key="c.id" @tap="goCourseDetail(c.id)">
          <image class="course-cover" :src="c.coverUrl" mode="aspectFill" />
          <text class="course-title">{{ c.title }}</text>
          <text class="course-price">¥{{ c.price ?? 0 }}</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isLoggedIn, getUserInfo, type UserInfo } from '@/utils/auth'
import { getHomePage, getCourseList, type Banner, type Course } from '@/api'

const defaultAvatar = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const isLogin = ref(false)
const userInfo = ref<UserInfo | null>(null)
const bannerList = ref<Banner[]>([])
const courseList = ref<Course[]>([])

const entries = [
  { icon: '📚', text: '课程', path: '/pages/course/list' },
  { icon: '📺', text: '直播', path: '/pages/live/list' },
  { icon: '🤖', text: 'AI', path: '/pages/ai/chat' },
  { icon: '📋', text: '订单', path: '/pages/user/orders' },
  { icon: '⚙️', text: '设置', path: '/pages/user/settings' },
]

function refreshUser() {
  isLogin.value = isLoggedIn()
  userInfo.value = getUserInfo()
}

function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' })
}

function goPage(path: string) {
  uni.switchTab({ url: path, fail: () => uni.navigateTo({ url: path }) })
}

function goCourseDetail(id: string | number) {
  uni.navigateTo({ url: `/pages/course/detail?id=${id}` })
}

function onBannerClick(item: Banner) {
  if (item.link) uni.navigateTo({ url: item.link })
}

async function loadData() {
  try {
    const [home, courses] = await Promise.all([
      getHomePage().catch(() => ({ banner: [] })),
      getCourseList({ page: 1, pageSize: 6 }).catch(() => ({ list: [], total: 0 })),
    ])
    bannerList.value = home.banner || []
    courseList.value = courses.list || []
  } catch (e) {
    // 静默处理，首页可离线展示
  }
}

onMounted(loadData)
onShow(refreshUser)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding-bottom: 40rpx; }

.user-bar {
  display: flex; align-items: center; padding: 120rpx 32rpx 24rpx;
  background: linear-gradient(135deg, #007aff, #00c6ff);
  .avatar { width: 72rpx; height: 72rpx; border-radius: 50%; border: 2rpx solid #fff; }
  .user-meta { margin-left: 20rpx; display: flex; align-items: center; }
  .name { color: #fff; font-size: 30rpx; font-weight: 600; }
  .vip-tag { margin-left: 12rpx; padding: 2rpx 12rpx; background: #f0ad4e; color: #fff; font-size: 20rpx; border-radius: 20rpx; }
  .login-entry { margin-left: auto; color: #fff; font-size: 26rpx; }
}

.banner { height: 280rpx; margin: 24rpx 32rpx; border-radius: 16rpx; overflow: hidden; }
.banner-img { width: 100%; height: 100%; }
.banner-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #fff; color: #007aff; font-size: 30rpx; }

.entry-grid {
  display: flex; flex-wrap: wrap; padding: 16rpx 32rpx; background: #fff; margin: 0 32rpx; border-radius: 16rpx;
  .entry-item { width: 20%; display: flex; flex-direction: column; align-items: center; padding: 24rpx 0; }
  .entry-icon { font-size: 48rpx; }
  .entry-text { margin-top: 8rpx; font-size: 24rpx; color: #333; }
}

.section { margin: 32rpx; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.section-title { font-size: 32rpx; font-weight: 600; color: #333; }
.section-more { font-size: 24rpx; color: #999; }

.course-scroll { white-space: nowrap; }
.course-card {
  display: inline-block; width: 280rpx; margin-right: 20rpx; background: #fff; border-radius: 16rpx; overflow: hidden;
  .course-cover { width: 100%; height: 160rpx; }
  .course-title { display: block; padding: 12rpx; font-size: 26rpx; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .course-price { display: block; padding: 0 12rpx 12rpx; font-size: 28rpx; color: #dd524d; font-weight: 600; }
}
</style>
