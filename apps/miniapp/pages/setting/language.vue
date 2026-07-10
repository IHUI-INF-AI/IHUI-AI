<template>
  <view class="page">
    <view class="list">
      <view class="item" v-for="l in langs" :key="l.value" :class="{ active: current === l.value }" @tap="onSelect(l.value)">
        <text class="name">{{ l.name }}</text>
        <text class="check" v-if="current === l.value">✓</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { setLanguage } from '@/api'

const langs = [
  { value: 'zh-CN', name: '简体中文' },
  { value: 'zh-TW', name: '繁體中文' },
  { value: 'en', name: 'English' },
  { value: 'ja', name: '日本語' },
]
const current = ref('zh-CN')

async function onSelect(v: string) {
  current.value = v
  try {
    await setLanguage(v)
    uni.showToast({ title: '设置成功', icon: 'success' })
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.item { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.item:last-child { border-bottom: none; }
.item.active { background: #e6f0ff; }
.name { font-size: 28rpx; color: #333; }
.check { color: #007aff; font-size: 32rpx; }
</style>
