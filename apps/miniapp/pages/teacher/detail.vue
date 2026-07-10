<template>
  <view class="page">
    <view class="head" v-if="teacher.name">
      <image class="avatar" :src="teacher.avatar || '/static/default-avatar.png'" mode="aspectFill" />
      <view class="info">
        <view class="name-row">
          <text class="name">{{ teacher.name }}</text>
          <text class="title-tag" v-if="teacher.title">{{ teacher.title }}</text>
        </view>
        <view class="meta">
          <text class="num">{{ teacher.courses || 0 }}课程</text>
          <text class="num">{{ teacher.students || 0 }}学员</text>
        </view>
      </view>
      <button class="follow" size="mini" @tap="onFollow">关注</button>
    </view>
    <view class="card" v-if="teacher.intro">
      <view class="card-title">讲师简介</view>
      <text class="intro">{{ teacher.intro }}</text>
    </view>
    <view class="card">
      <view class="card-title">讲师课程</view>
      <view class="empty" v-if="!loading"><text>暂无课程</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getTeacherDetail, type Teacher } from '@/api'

const teacher = ref<Teacher>({} as Teacher)
const loading = ref(true)

onLoad(async (q: any) => {
  if (!q.id) return
  try { teacher.value = await getTeacherDetail(q.id) } finally { loading.value = false }
})
function onFollow() { uni.showToast({ title: '关注成功', icon: 'success' }) }
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.head { display: flex; align-items: center; padding: 60rpx 32rpx; background: #fff; }
.avatar { width: 140rpx; height: 140rpx; border-radius: 50%; background: #f5f5f5; }
.info { flex: 1; margin-left: 24rpx; }
.name-row { display: flex; align-items: center; gap: 16rpx; }
.name { font-size: 36rpx; color: #333; font-weight: 700; }
.title-tag { font-size: 20rpx; color: #007aff; background: #e6f0ff; padding: 4rpx 12rpx; border-radius: 4rpx; }
.meta { display: flex; gap: 24rpx; margin-top: 16rpx; }
.num { font-size: 24rpx; color: #666; }
.follow { background: #007aff; color: #fff; font-size: 22rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.card-title { font-size: 28rpx; color: #333; font-weight: 600; margin-bottom: 24rpx; }
.intro { font-size: 26rpx; color: #666; line-height: 1.8; }
.empty { text-align: center; padding: 40rpx 0; color: #999; }
</style>
