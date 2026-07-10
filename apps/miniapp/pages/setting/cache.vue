<template>
  <view class="page">
    <view class="card">
      <view class="row" @tap="onClear">
        <text class="label">当前缓存</text>
        <text class="value">{{ size }}</text>
      </view>
      <view class="row" @tap="onClear">
        <text class="label">清除图片缓存</text>
        <text class="arrow">›</text>
      </view>
      <view class="row" @tap="onClear">
        <text class="label">清除文件缓存</text>
        <text class="arrow">›</text>
      </view>
    </view>
    <button class="btn" @tap="onClearAll">一键清理</button>
    <view class="tips">
      <text>清理缓存不会影响您的账号数据</text>
      <text>清理后已下载的内容需重新加载</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { clearCacheSize, clearCache } from '@/api'

const size = ref('0KB')

async function load() {
  try { size.value = (await clearCacheSize()).size } catch (e) {}
}
async function onClear() {
  try {
    await clearCache()
    uni.showToast({ title: '清理成功', icon: 'success' })
    load()
  } catch (e) {}
}
function onClearAll() { onClear() }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.card { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.label { font-size: 28rpx; color: #333; }
.value { font-size: 28rpx; color: #007aff; }
.arrow { color: #ccc; }
.btn { margin: 60rpx 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.tips { padding: 0 32rpx; }
.tips text { display: block; font-size: 22rpx; color: #999; line-height: 1.8; }
</style>
