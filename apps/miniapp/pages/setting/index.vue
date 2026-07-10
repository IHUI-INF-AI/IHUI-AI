<template>
  <view class="page">
    <view class="user-info" v-if="user.nickname">
      <image class="avatar" :src="user.avatar || '/static/default-avatar.png'" mode="aspectFill" />
      <view class="info">
        <text class="name">{{ user.nickname }}</text>
        <text class="phone">{{ user.phone || '未绑定手机' }}</text>
      </view>
    </view>
    <view class="menu-group">
      <text class="group-title">账号</text>
      <view class="menu">
        <view class="menu-item" @tap="navigate('/pages/user/profile')"><text>个人资料</text><text class="arrow">›</text></view>
        <view class="menu-item" @tap="navigate('/pages/setting/notification')"><text>通知设置</text><text class="arrow">›</text></view>
        <view class="menu-item" @tap="navigate('/pages/setting/cache')"><text>清除缓存</text><text class="arrow">›</text></view>
      </view>
    </view>
    <view class="menu-group">
      <text class="group-title">通用</text>
      <view class="menu">
        <view class="menu-item" @tap="navigate('/pages/setting/language')"><text>语言设置</text><text class="arrow">›</text></view>
        <view class="menu-item" @tap="navigate('/pages/setting/theme')"><text>主题设置</text><text class="arrow">›</text></view>
        <view class="menu-item" @tap="navigate('/pages/about/index')"><text>关于我们</text><text class="arrow">›</text></view>
      </view>
    </view>
    <button class="logout" @tap="onLogout">退出登录</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, logout, type UserInfo } from '@/api'

const user = ref<Partial<UserInfo>>({})

async function load() {
  try { user.value = await getProfile() } catch (e) {}
}
function navigate(url: string) { uni.navigateTo({ url }) }
async function onLogout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try { await logout() } catch (e) {}
        uni.reLaunch({ url: '/pages/login/login' })
      }
    }
  })
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.user-info { display: flex; align-items: center; padding: 60rpx 32rpx; background: #fff; }
.avatar { width: 120rpx; height: 120rpx; border-radius: 50%; background: #f5f5f5; }
.info { margin-left: 24rpx; }
.name { display: block; font-size: 32rpx; color: #333; font-weight: 600; }
.phone { display: block; font-size: 24rpx; color: #999; margin-top: 8rpx; }
.menu-group { margin-top: 24rpx; }
.group-title { display: block; padding: 0 32rpx 16rpx; font-size: 24rpx; color: #999; }
.menu { margin: 0 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; font-size: 28rpx; color: #333; }
.menu-item:last-child { border-bottom: none; }
.arrow { color: #ccc; }
.logout { margin: 60rpx 32rpx; background: #fff; color: #dd524d; border-radius: 40rpx; font-size: 30rpx; }
</style>
