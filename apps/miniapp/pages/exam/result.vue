<template>
  <view class="page">
    <view class="result" :class="{ pass: info.pass }">
      <view class="icon">{{ info.pass ? '✓' : '×' }}</view>
      <text class="title">{{ info.pass ? '考试通过' : '未通过' }}</text>
      <text class="score">{{ info.score }}分</text>
    </view>
    <view class="card">
      <view class="row"><text class="label">得分</text><text class="value">{{ info.score }}分</text></view>
      <view class="row"><text class="label">是否通过</text><text class="value" :class="{ pass: info.pass }">{{ info.pass ? '通过' : '未通过' }}</text></view>
      <view class="row" v-if="info.rank"><text class="label">排名</text><text class="value">第{{ info.rank }}名 / {{ info.total }}人</text></view>
    </view>
    <view class="actions">
      <button class="btn primary" @tap="goList">返回列表</button>
      <button class="btn" @tap="goStudy">继续学习</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getExamResult } from '@/api'

const info = ref<{ score: number; pass: boolean; rank?: number; total?: number }>({ score: 0, pass: false })

onLoad(async (q: any) => {
  if (q.score) { info.value = { score: Number(q.score), pass: q.pass === 'true' }; return }
  if (!q.id) return
  try { info.value = await getExamResult(q.id) } catch (e) {}
})
function goList() { uni.redirectTo({ url: '/pages/exam/list' }) }
function goStudy() { uni.navigateTo({ url: '/pages/study/index' }) }
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.result { padding: 120rpx 0; text-align: center; }
.icon { width: 160rpx; height: 160rpx; line-height: 160rpx; margin: 0 auto; border-radius: 50%; font-size: 80rpx; color: #fff; background: #dd524d; }
.result.pass .icon { background: #4caf50; }
.title { display: block; font-size: 36rpx; color: #333; font-weight: 600; margin-top: 32rpx; }
.score { display: block; font-size: 60rpx; color: #007aff; font-weight: 700; margin-top: 16rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.row { display: flex; justify-content: space-between; padding: 24rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.label { font-size: 26rpx; color: #999; }
.value { font-size: 26rpx; color: #333; }
.value.pass { color: #4caf50; }
.actions { padding: 0 60rpx; }
.btn { margin-top: 32rpx; background: #fff; color: #333; border-radius: 40rpx; font-size: 30rpx; }
.btn.primary { background: #007aff; color: #fff; }
</style>
