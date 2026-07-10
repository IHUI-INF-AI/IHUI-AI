<template>
  <view class="page" v-if="course">
    <!-- 课程封面 -->
    <view class="cover-wrap">
      <image class="cover" :src="course.coverUrl" mode="aspectFill" />
      <view class="cover-mask">
        <text class="title">{{ course.title }}</text>
        <text class="subtitle" v-if="course.subtitle">{{ course.subtitle }}</text>
      </view>
    </view>

    <!-- 课程信息 -->
    <view class="info-bar">
      <view class="info-item" v-if="course.teacher">
        <text class="label">讲师</text>
        <text class="value">{{ course.teacher }}</text>
      </view>
      <view class="info-item" v-if="course.duration">
        <text class="label">时长</text>
        <text class="value">{{ course.duration }}</text>
      </view>
      <view class="info-item" v-if="course.level">
        <text class="label">难度</text>
        <text class="value">{{ course.level }}</text>
      </view>
    </view>

    <!-- 课程简介 -->
    <view class="section">
      <text class="section-title">课程简介</text>
      <text class="section-content">{{ course.description || '暂无简介' }}</text>
    </view>

    <!-- 课程大纲 -->
    <view class="section" v-if="course.outline && course.outline.length">
      <text class="section-title">课程大纲</text>
      <view class="outline-item" v-for="(item, idx) in course.outline" :key="idx">
        <view class="outline-head">
          <text class="outline-title">{{ item.title }}</text>
          <text class="outline-dur">{{ item.duration }}</text>
        </view>
        <text class="outline-desc">{{ item.description }}</text>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar safe-area-bottom">
      <view class="price">
        <text class="symbol">¥</text>
        <text class="amount">{{ course.price ?? 0 }}</text>
      </view>
      <view class="buy-btn" @tap="handleBuy"><text>立即购买</text></view>
    </view>
  </view>

  <view class="loading-page" v-else><text>加载中...</text></view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCourseDetail, type Course } from '@/api'

const course = ref<Course | null>(null)
const courseId = ref<string | number>('')

onLoad((options) => {
  courseId.value = options?.id || ''
  loadDetail()
})

async function loadDetail() {
  try {
    course.value = await getCourseDetail(courseId.value)
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function handleBuy() {
  uni.showToast({ title: '购买功能开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding-bottom: 140rpx; }

.cover-wrap { position: relative; width: 100%; height: 400rpx; }
.cover { width: 100%; height: 100%; }
.cover-mask { position: absolute; left: 0; right: 0; bottom: 0; padding: 32rpx; background: linear-gradient(transparent, rgba(0,0,0,0.6)); }
.title { display: block; color: #fff; font-size: 36rpx; font-weight: 700; }
.subtitle { display: block; margin-top: 8rpx; color: rgba(255,255,255,0.8); font-size: 26rpx; }

.info-bar { display: flex; padding: 24rpx 32rpx; background: #fff; }
.info-item { flex: 1; text-align: center; }
.info-item .label { display: block; font-size: 22rpx; color: #999; }
.info-item .value { display: block; margin-top: 8rpx; font-size: 28rpx; color: #333; }

.section { margin: 24rpx 32rpx; padding: 24rpx; background: #fff; border-radius: 16rpx; }
.section-title { display: block; font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 16rpx; }
.section-content { font-size: 26rpx; color: #666; line-height: 1.6; }

.outline-item { padding: 20rpx 0; border-bottom: 1rpx solid #f5f5f5; }
.outline-head { display: flex; justify-content: space-between; }
.outline-title { font-size: 28rpx; color: #333; }
.outline-dur { font-size: 24rpx; color: #999; }
.outline-desc { display: block; margin-top: 8rpx; font-size: 24rpx; color: #999; }

.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; height: 120rpx; background: #fff;
  display: flex; align-items: center; padding: 0 32rpx; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.06);
}
.price { flex: 1; }
.price .symbol { font-size: 26rpx; color: #dd524d; }
.price .amount { font-size: 44rpx; color: #dd524d; font-weight: 700; }
.buy-btn { padding: 0 56rpx; height: 80rpx; line-height: 80rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 30rpx; }

.loading-page { display: flex; align-items: center; justify-content: center; height: 100vh; color: #999; }
</style>
