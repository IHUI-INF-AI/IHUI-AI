<template>
  <view class="page">
    <view class="header">
      <view class="stats">
        <view class="stat"><text class="num">{{ info.todayMinutes }}</text><text class="label">今日(分钟)</text></view>
        <view class="stat"><text class="num">{{ info.totalMinutes }}</text><text class="label">累计(分钟)</text></view>
        <view class="stat"><text class="num">{{ info.continuousDays }}</text><text class="label">连续(天)</text></view>
        <view class="stat"><text class="num">{{ info.courses }}</text><text class="label">学习课程</text></view>
      </view>
    </view>
    <view class="menu">
      <view class="menu-item" @tap="navigate('/pages/study/record')"><text>📋</text><text class="m-name">学习记录</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/study/plan')"><text>🎯</text><text class="m-name">学习计划</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/study/rank')"><text>🏆</text><text class="m-name">学习排行</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/exam/list')"><text>📝</text><text class="m-name">我的考试</text><text class="arrow">›</text></view>
    </view>
    <view class="card">
      <view class="card-title">继续学习</view>
      <view class="empty" v-if="!loading"><text>暂无学习中的课程</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStudyInfo } from '@/api'

const info = ref({ todayMinutes: 0, totalMinutes: 0, continuousDays: 0, courses: 0 })
const loading = ref(true)

async function load() {
  try { info.value = await getStudyInfo() } finally { loading.value = false }
}
function navigate(url: string) { uni.navigateTo({ url }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.header { padding: 60rpx 40rpx; background: linear-gradient(135deg, #007aff, #00c6ff); }
.stats { display: flex; flex-wrap: wrap; }
.stat { width: 50%; text-align: center; margin-bottom: 24rpx; color: #fff; }
.num { display: block; font-size: 40rpx; font-weight: 700; }
.label { display: block; font-size: 22rpx; opacity: .9; margin-top: 4rpx; }
.menu { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item { display: flex; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; font-size: 32rpx; }
.menu-item:last-child { border-bottom: none; }
.m-name { flex: 1; margin-left: 24rpx; font-size: 28rpx; color: #333; }
.arrow { color: #ccc; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.card-title { font-size: 30rpx; color: #333; font-weight: 600; margin-bottom: 24rpx; }
.empty { text-align: center; padding: 60rpx 0; color: #999; }
</style>
