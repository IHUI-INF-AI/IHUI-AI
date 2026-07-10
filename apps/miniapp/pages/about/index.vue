<template>
  <view class="page">
    <view class="logo-box" v-if="info.name">
      <image class="logo" :src="info.logo || '/static/logo.png'" mode="aspectFit" />
      <text class="name">{{ info.name }}</text>
      <text class="version">V{{ info.version }}</text>
    </view>
    <view class="card">
      <text class="intro">{{ info.intro }}</text>
    </view>
    <view class="menu">
      <view class="menu-item" @tap="navigate('/pages/about/help')"><text>帮助中心</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/about/protocol')"><text>用户协议</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/about/privacy')"><text>隐私政策</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/about/contact')"><text>联系我们</text><text class="arrow">›</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getAbout } from '@/api'

const info = ref<{ name: string; version: string; intro: string; logo?: string }>({ name: '', version: '', intro: '' })

async function load() {
  try { info.value = await getAbout() } catch (e) {}
}
function navigate(url: string) { uni.navigateTo({ url }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.logo-box { padding: 80rpx 0; text-align: center; background: #fff; }
.logo { width: 160rpx; height: 160rpx; }
.name { display: block; font-size: 32rpx; color: #333; font-weight: 600; margin-top: 24rpx; }
.version { display: block; font-size: 24rpx; color: #999; margin-top: 8rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.intro { font-size: 26rpx; color: #666; line-height: 1.8; }
.menu { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; font-size: 28rpx; color: #333; }
.arrow { color: #ccc; }
</style>
