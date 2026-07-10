<template>
  <view class="page">
    <view class="card" v-if="exam.title">
      <text class="title">{{ exam.title }}</text>
      <view class="info">
        <view class="info-item"><text class="label">题量</text><text class="value">{{ exam.questions }}题</text></view>
        <view class="info-item"><text class="label">时长</text><text class="value">{{ exam.duration }}分钟</text></view>
        <view class="info-item"><text class="label">及格</text><text class="value">{{ exam.passScore }}分</text></view>
      </view>
      <view class="time" v-if="exam.startTime">考试时间：{{ exam.startTime }} - {{ exam.endTime }}</view>
    </view>
    <view class="rules">
      <view class="rules-title">考试须知</view>
      <view class="rule">1. 考试开始后计时不可暂停</view>
      <view class="rule">2. 每题选择后不可修改</view>
      <view class="rule">3. 达到及格分数即通过</view>
      <view class="rule">4. 考试结束后自动提交</view>
    </view>
    <button class="btn" @tap="onStart" v-if="exam.title">开始考试</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getExamDetail, type Exam } from '@/api'

const exam = ref<Exam>({} as Exam)

onLoad(async (q: any) => {
  if (!q.id) return
  try { exam.value = await getExamDetail(q.id) } catch (e) {}
})
function onStart() {
  uni.navigateTo({ url: `/pages/exam/answer?id=${exam.value.id}` })
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.title { font-size: 36rpx; color: #333; font-weight: 700; }
.info { display: flex; margin-top: 32rpx; }
.info-item { flex: 1; text-align: center; }
.label { display: block; font-size: 22rpx; color: #999; }
.value { display: block; font-size: 32rpx; color: #007aff; font-weight: 600; margin-top: 8rpx; }
.time { margin-top: 24rpx; font-size: 24rpx; color: #999; }
.rules { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.rules-title { font-size: 28rpx; color: #333; font-weight: 600; margin-bottom: 24rpx; }
.rule { font-size: 26rpx; color: #666; line-height: 2; }
.btn { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
</style>
