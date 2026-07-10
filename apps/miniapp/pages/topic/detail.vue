<template>
  <view class="page">
    <view class="head" v-if="topic.name">
      <text class="title">#{{ topic.name }}</text>
      <text class="count">{{ topic.posts?.length || 0 }}篇内容</text>
    </view>
    <view class="list" v-if="topic.posts?.length">
      <view class="item" v-for="p in topic.posts" :key="p.id" @tap="goCircle(p.id)">
        <view class="user">
          <image class="avatar" :src="p.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <text class="name">{{ p.author }}</text>
          <text class="time">{{ p.createTime }}</text>
        </view>
        <text class="title">{{ p.title }}</text>
        <text class="content">{{ p.content }}</text>
      </view>
    </view>
    <view class="empty" v-if="!loading && !topic.posts?.length"><text>暂无内容</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getTopicDetail } from '@/api'

const topic = ref<{ id: string; name: string; posts: Array<{ id: string; title: string; content: string; author?: string; avatar?: string; createTime: string }> }>({} as any)
const loading = ref(true)

onLoad(async (q: any) => {
  if (!q.id) return
  try { topic.value = await getTopicDetail(q.id) as typeof topic.value } finally { loading.value = false }
})
function goCircle(id: string) { uni.navigateTo({ url: `/pages/circle/detail?id=${id}` }) }
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.head { padding: 60rpx 32rpx; background: linear-gradient(135deg, #007aff, #00c6ff); color: #fff; }
.title { display: block; font-size: 40rpx; font-weight: 700; }
.count { display: block; font-size: 24rpx; opacity: .9; margin-top: 12rpx; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.user { display: flex; align-items: center; }
.avatar { width: 50rpx; height: 50rpx; border-radius: 50%; background: #f5f5f5; }
.name { margin-left: 16rpx; font-size: 24rpx; color: #666; }
.time { margin-left: auto; font-size: 22rpx; color: #999; }
.title { display: block; font-size: 30rpx; color: #333; font-weight: 600; margin: 16rpx 0; }
.content { font-size: 26rpx; color: #666; line-height: 1.6; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
