<template>
  <view class="page">
    <view class="preview">
      <view class="phone" :class="current">
        <view class="status-bar"></view>
        <view class="content-area"></view>
      </view>
    </view>
    <view class="list">
      <view class="item" v-for="t in themes" :key="t.value" :class="{ active: current === t.value }" @tap="onSelect(t.value)">
        <view class="color" :style="{ background: t.color }"></view>
        <text class="name">{{ t.name }}</text>
        <text class="check" v-if="current === t.value">✓</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { setTheme } from '@/api'

const themes = [
  { value: 'light', name: '浅色模式', color: '#ffffff' },
  { value: 'dark', name: '深色模式', color: '#1a1a1a' },
  { value: 'auto', name: '跟随系统', color: 'linear-gradient(135deg, #fff 50%, #1a1a1a 50%)' },
]
const current = ref('light')

async function onSelect(v: string) {
  current.value = v
  try {
    await setTheme(v)
    uni.showToast({ title: '设置成功', icon: 'success' })
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.preview { padding: 60rpx 0; display: flex; justify-content: center; }
.phone { width: 240rpx; height: 400rpx; border-radius: 32rpx; border: 8rpx solid #333; overflow: hidden; background: #fff; }
.phone.dark { background: #1a1a1a; }
.status-bar { height: 60rpx; background: #007aff; }
.phone.dark .status-bar { background: #0056b3; }
.content-area { flex: 1; padding: 16rpx; }
.phone.light .content-area { background: #f7f8fa; }
.phone.dark .content-area { background: #2a2a2a; }
.list { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.item { display: flex; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.item:last-child { border-bottom: none; }
.item.active { background: #e6f0ff; }
.color { width: 60rpx; height: 60rpx; border-radius: 12rpx; border: 2rpx solid #eee; }
.name { flex: 1; margin-left: 24rpx; font-size: 28rpx; color: #333; }
.check { color: #007aff; font-size: 32rpx; }
</style>
