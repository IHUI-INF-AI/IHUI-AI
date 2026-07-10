<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索资讯" v-model="keyword" @confirm="load(true)" />
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="n in list" :key="n.id" @tap="goDetail(n.id)">
        <image class="cover" v-if="n.coverUrl" :src="n.coverUrl" mode="aspectFill" />
        <view class="body">
          <text class="title">{{ n.title }}</text>
          <text class="summary">{{ n.summary }}</text>
          <view class="meta">
            <text class="time">{{ n.createTime }}</text>
            <text class="views">{{ n.views || 0 }}阅读</text>
          </view>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无资讯</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getNewsList, type News } from '@/api'

const list = ref<News[]>([])
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getNewsList({ page: page.value, pageSize: 10, keyword: keyword.value })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/news/detail?id=${id}` }) }
onPullDownRefresh(() => load(true).finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.search-bar { padding: 24rpx 32rpx; }
.search-input { height: 72rpx; padding: 0 24rpx; background: #fff; border-radius: 36rpx; font-size: 26rpx; }
.list { padding: 0 24rpx; }
.item { display: flex; background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.cover { width: 200rpx; height: 140rpx; border-radius: 8rpx; flex-shrink: 0; background: #f5f5f5; }
.body { flex: 1; margin-left: 24rpx; display: flex; flex-direction: column; justify-content: space-between; }
.title { font-size: 28rpx; color: #333; font-weight: 600; }
.summary { font-size: 22rpx; color: #999; margin-top: 8rpx; line-height: 1.4; }
.meta { display: flex; justify-content: space-between; }
.time, .views { font-size: 22rpx; color: #999; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
