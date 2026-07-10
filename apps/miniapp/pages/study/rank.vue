<template>
  <view class="page">
    <view class="header">
      <text class="title">学习排行榜</text>
      <text class="subtitle">本周学习时长排名</text>
    </view>
    <view class="top3" v-if="list.length >= 3">
      <view class="top-item top2">
        <image class="avatar" :src="list[1].avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <text class="name">{{ list[1].nickname }}</text>
        <text class="minutes">{{ list[1].minutes }}分钟</text>
        <text class="rank">2</text>
      </view>
      <view class="top-item top1">
        <image class="avatar" :src="list[0].avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <text class="name">{{ list[0].nickname }}</text>
        <text class="minutes">{{ list[0].minutes }}分钟</text>
        <text class="rank">1</text>
      </view>
      <view class="top-item top3">
        <image class="avatar" :src="list[2].avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <text class="name">{{ list[2].nickname }}</text>
        <text class="minutes">{{ list[2].minutes }}分钟</text>
        <text class="rank">3</text>
      </view>
    </view>
    <view class="list">
      <view class="item" v-for="(u, i) in list.slice(3)" :key="u.id">
        <text class="rank-num">{{ i + 4 }}</text>
        <image class="avatar" :src="u.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <text class="name">{{ u.nickname }}</text>
        <text class="minutes">{{ u.minutes }}分钟</text>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无排行数据</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getStudyRank } from '@/api'

const list = ref<Array<{ id: string; nickname: string; avatar?: string; minutes: number }>>([])
const loading = ref(true)

async function load() {
  try { list.value = (await getStudyRank()).list || [] } finally { loading.value = false }
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.header { padding: 60rpx 0; text-align: center; background: linear-gradient(135deg, #007aff, #00c6ff); }
.title { display: block; color: #fff; font-size: 36rpx; font-weight: 700; }
.subtitle { display: block; color: rgba(255,255,255,.9); font-size: 24rpx; margin-top: 8rpx; }
.top3 { display: flex; align-items: flex-end; justify-content: center; padding: 32rpx 0; background: #fff; }
.top-item { display: flex; flex-direction: column; align-items: center; margin: 0 16rpx; position: relative; }
.top1 .avatar { width: 140rpx; height: 140rpx; border: 6rpx solid #ffd700; }
.top2 .avatar, .top3 .avatar { width: 110rpx; height: 110rpx; border: 4rpx solid #c0c0c0; }
.top3 .avatar { border-color: #cd7f32; }
.avatar { border-radius: 50%; background: #f5f5f5; }
.name { font-size: 24rpx; color: #333; margin-top: 12rpx; }
.minutes { font-size: 22rpx; color: #007aff; margin-top: 4rpx; }
.rank { position: absolute; top: -16rpx; width: 40rpx; height: 40rpx; line-height: 40rpx; text-align: center; border-radius: 50%; color: #fff; font-size: 22rpx; }
.top1 .rank { background: #ffd700; }
.top2 .rank { background: #c0c0c0; }
.top3 .rank { background: #cd7f32; }
.list { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.item { display: flex; align-items: center; padding: 24rpx 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.rank-num { width: 60rpx; font-size: 28rpx; color: #999; }
.avatar { width: 60rpx; height: 60rpx; border-radius: 50%; background: #f5f5f5; }
.name { flex: 1; margin-left: 24rpx; font-size: 28rpx; color: #333; }
.minutes { font-size: 28rpx; color: #007aff; font-weight: 600; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
