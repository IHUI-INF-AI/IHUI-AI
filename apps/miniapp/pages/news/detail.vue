<template>
  <view class="page">
    <view class="head" v-if="news.title">
      <text class="title">{{ news.title }}</text>
      <view class="meta">
        <text>{{ news.createTime }}</text>
        <text>{{ news.views || 0 }}阅读</text>
      </view>
    </view>
    <view class="content" v-if="news.content">
      <rich-text :nodes="news.content" />
    </view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getNewsDetail, type News } from '@/api'

const news = ref<News>({} as News)
const loading = ref(true)

onLoad(async (q: any) => {
  if (!q.id) return
  try { news.value = await getNewsDetail(q.id) } finally { loading.value = false }
})
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #fff; padding: 32rpx; }
.head { padding-bottom: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.title { font-size: 40rpx; color: #333; font-weight: 700; line-height: 1.4; }
.meta { display: flex; gap: 24rpx; margin-top: 24rpx; font-size: 22rpx; color: #999; }
.content { padding: 32rpx 0; font-size: 30rpx; color: #333; line-height: 1.8; }
.loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
