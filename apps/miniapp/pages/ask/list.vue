<template>
  <view class="page">
    <view class="search-bar">
      <input class="search-input" placeholder="搜索问题" v-model="keyword" @confirm="load(true)" />
    </view>
    <view class="tabs">
      <text class="tab" :class="{ active: tab === 'new' }" @tap="switchTab('new')">最新</text>
      <text class="tab" :class="{ active: tab === 'hot' }" @tap="switchTab('hot')">热门</text>
      <text class="tab" :class="{ active: tab === 'unanswered' }" @tap="switchTab('unanswered')">待回答</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="a in list" :key="a.id" @tap="goDetail(a.id)">
        <text class="title">{{ a.title }}</text>
        <text class="content">{{ a.content }}</text>
        <view class="meta">
          <image class="avatar" :src="a.avatar || '/static/default-avatar.png'" mode="aspectFill" />
          <text class="author">{{ a.author }}</text>
          <text class="time">{{ a.createTime }}</text>
          <text class="answers" :class="{ adopted: a.adopted }">{{ a.answers || 0 }}回答</text>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无问题</text></view>
    <view class="fab" @tap="goCreate">+</view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getAskList, type Ask } from '@/api'

const list = ref<Ask[]>([])
const loading = ref(false)
const keyword = ref('')
const tab = ref('new')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getAskList({ page: page.value, pageSize: 10, keyword: keyword.value })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function switchTab(t: string) { tab.value = t; load(true) }
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/ask/detail?id=${id}` }) }
function goCreate() { uni.navigateTo({ url: '/pages/ask/create' }) }
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.search-bar { padding: 24rpx 32rpx; }
.search-input { height: 72rpx; padding: 0 24rpx; background: #fff; border-radius: 36rpx; font-size: 26rpx; }
.tabs { display: flex; background: #fff; }
.tab { flex: 1; text-align: center; font-size: 26rpx; color: #666; padding: 24rpx 0; }
.tab.active { color: #007aff; font-weight: 600; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.title { font-size: 30rpx; color: #333; font-weight: 600; }
.content { display: block; font-size: 26rpx; color: #666; margin-top: 12rpx; line-height: 1.5; }
.meta { display: flex; align-items: center; margin-top: 16rpx; padding-top: 16rpx; border-top: 2rpx solid #f5f5f5; }
.avatar { width: 40rpx; height: 40rpx; border-radius: 50%; background: #f5f5f5; }
.author { margin-left: 12rpx; font-size: 22rpx; color: #666; }
.time { margin-left: auto; font-size: 22rpx; color: #999; }
.answers { margin-left: 16rpx; font-size: 22rpx; color: #007aff; }
.answers.adopted { color: #4caf50; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
.fab { position: fixed; right: 40rpx; bottom: 60rpx; width: 100rpx; height: 100rpx; line-height: 100rpx; text-align: center; background: #007aff; color: #fff; border-radius: 50%; font-size: 60rpx; box-shadow: 0 4rpx 20rpx rgba(0,122,255,.4); }
</style>
