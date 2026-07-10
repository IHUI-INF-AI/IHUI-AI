<template>
  <view class="page">
    <view class="head" v-if="data.author">
      <image class="avatar" :src="data.avatar || '/static/default-avatar.png'" mode="aspectFill" />
      <view class="user-info">
        <text class="name">{{ data.author }}</text>
        <text class="time">{{ data.createTime }}</text>
      </view>
      <button class="follow" size="mini" @tap="onFollow">关注</button>
    </view>
    <view class="body" v-if="data.title">
      <text class="title">{{ data.title }}</text>
      <text class="content">{{ data.content }}</text>
      <view class="images" v-if="data.images?.length">
        <image class="img" v-for="(img, i) in data.images" :key="i" :src="img" mode="aspectFill" @tap="previewImg(i)" />
      </view>
    </view>
    <view class="actions">
      <view class="action" :class="{ active: liked }" @tap="onLike"><text>♡</text><text>{{ data.likes || 0 }}</text></view>
      <view class="action"><text>💬</text><text>{{ data.comments || 0 }}</text></view>
      <view class="action" @tap="onShare"><text>↗</text><text>分享</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCircleDetail, type Circle } from '@/api'

const data = ref<Circle>({} as Circle)
const liked = ref(false)

onLoad(async (q: any) => {
  if (!q.id) return
  try { data.value = await getCircleDetail(q.id) } catch (e) {}
})
function previewImg(i: number) {
  uni.previewImage({ urls: data.value.images || [], current: i })
}
function onFollow() { uni.showToast({ title: '关注成功', icon: 'success' }) }
function onLike() { liked.value = !liked.value; data.value.likes = (data.value.likes || 0) + (liked.value ? 1 : -1) }
function onShare() { uni.showToast({ title: '点击右上角分享', icon: 'none' }) }
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fff; }
.head { display: flex; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: #f5f5f5; }
.user-info { flex: 1; margin-left: 24rpx; }
.name { display: block; font-size: 28rpx; color: #333; font-weight: 600; }
.time { display: block; font-size: 22rpx; color: #999; margin-top: 4rpx; }
.follow { background: #007aff; color: #fff; font-size: 22rpx; }
.body { padding: 32rpx; }
.title { display: block; font-size: 36rpx; color: #333; font-weight: 700; margin-bottom: 24rpx; }
.content { font-size: 30rpx; color: #333; line-height: 1.8; }
.images { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 24rpx; }
.img { width: 220rpx; height: 220rpx; border-radius: 8rpx; background: #f5f5f5; }
.actions { display: flex; padding: 32rpx; border-top: 2rpx solid #f5f5f5; }
.action { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8rpx; font-size: 28rpx; color: #666; }
.action.active { color: #dd524d; }
</style>
