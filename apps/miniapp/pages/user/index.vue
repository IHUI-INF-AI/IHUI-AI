<template>
  <view class="page">
    <!-- 用户信息头部 -->
    <view class="header">
      <view class="user-info" v-if="userInfo">
        <image class="avatar" :src="userInfo.avatar || defaultAvatar" mode="aspectFill" />
        <view class="meta">
          <text class="name">{{ userInfo.userName || userInfo.nickname || '用户' }}</text>
          <text class="phone" v-if="userInfo.phone">{{ maskPhone(userInfo.phone) }}</text>
          <text class="vip-tag" v-if="userInfo.isVip">VIP 会员</text>
        </view>
      </view>
      <view class="user-info" v-else @tap="goLogin">
        <image class="avatar" :src="defaultAvatar" mode="aspectFill" />
        <view class="meta">
          <text class="name">点击登录</text>
          <text class="phone">登录后享受更多服务</text>
        </view>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="menu">
      <view class="menu-item" v-for="item in menus" :key="item.path" @tap="goPage(item.path)">
        <text class="menu-icon">{{ item.icon }}</text>
        <text class="menu-text">{{ item.text }}</text>
        <text class="menu-arrow">></text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-btn" v-if="isLogin" @tap="handleLogout">
      <text>退出登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { isLoggedIn, getUserInfo, clearAuth, type UserInfo } from '@/utils/auth'
import { logout } from '@/api'

const defaultAvatar = 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png'

const userInfo = ref<UserInfo | null>(null)
const isLogin = computed(() => !!userInfo.value)

const menus = [
  { icon: '📋', text: '我的订单', path: '/pages/user/orders' },
  { icon: '⚙️', text: '设置', path: '/pages/user/settings' },
  { icon: '📚', text: '我的课程', path: '/pages/course/list' },
  { icon: '🤖', text: 'AI 对话', path: '/pages/ai/chat' },
]

function refresh() {
  userInfo.value = isLoggedIn() ? getUserInfo() : null
}

function maskPhone(phone: string) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function goLogin() {
  uni.navigateTo({ url: '/pages/login/login' })
}

function goPage(path: string) {
  uni.navigateTo({ url: path })
}

async function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await logout()
        } catch (e) {
          // 忽略退出接口错误
        }
        clearAuth()
        userInfo.value = null
        uni.showToast({ title: '已退出登录', icon: 'success' })
      }
    },
  })
}

onShow(refresh)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; }

.header { padding: 120rpx 32rpx 48rpx; background: linear-gradient(135deg, #007aff, #00c6ff); }
.user-info { display: flex; align-items: center; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; border: 4rpx solid #fff; }
.meta { margin-left: 24rpx; }
.name { display: block; color: #fff; font-size: 36rpx; font-weight: 600; }
.phone { display: block; margin-top: 8rpx; color: rgba(255,255,255,0.85); font-size: 24rpx; }
.vip-tag { display: inline-block; margin-top: 12rpx; padding: 4rpx 16rpx; background: #f0ad4e; color: #fff; font-size: 20rpx; border-radius: 20rpx; }

.menu { margin: 24rpx 32rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item { display: flex; align-items: center; padding: 32rpx; border-bottom: 1rpx solid #f5f5f5; }
.menu-item:last-child { border-bottom: none; }
.menu-icon { font-size: 40rpx; }
.menu-text { flex: 1; margin-left: 20rpx; font-size: 30rpx; color: #333; }
.menu-arrow { font-size: 26rpx; color: #ccc; }

.logout-btn { margin: 48rpx 32rpx; height: 96rpx; line-height: 96rpx; text-align: center; background: #fff; border-radius: 48rpx; color: #dd524d; font-size: 30rpx; }
</style>
