<template>
  <view class="page">
    <!-- 状态筛选 -->
    <view class="tabs">
      <view class="tab" :class="{ active: status === '' }" @tap="switchStatus('')"><text>全部</text></view>
      <view class="tab" :class="{ active: status === 'living' }" @tap="switchStatus('living')"><text>直播中</text></view>
      <view class="tab" :class="{ active: status === 'upcoming' }" @tap="switchStatus('upcoming')"><text>预告</text></view>
      <view class="tab" :class="{ active: status === 'ended' }" @tap="switchStatus('ended')"><text>回放</text></view>
    </view>

    <!-- 直播列表 -->
    <view class="list" v-if="list.length">
      <view class="card" v-for="item in list" :key="item.id" @tap="goDetail(item.id)">
        <view class="cover-wrap">
          <image class="cover" :src="item.coverUrl" mode="aspectFill" />
          <view class="status-tag" :class="item.status">
            <text>{{ statusText(item.status) }}</text>
          </view>
        </view>
        <view class="info">
          <text class="title">{{ item.title }}</text>
          <view class="meta">
            <text class="anchor" v-if="item.anchor">{{ item.anchor }}</text>
            <text class="time" v-if="item.startTime">{{ item.startTime }}</text>
          </view>
          <text class="watch" v-if="item.watchCount !== undefined">{{ item.watchCount }}人观看</text>
        </view>
      </view>
    </view>

    <view class="empty" v-if="!loading && !list.length"><text>暂无直播</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getLiveList, type Live } from '@/api'

const list = ref<Live[]>([])
const loading = ref(false)
const status = ref('')
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)

function statusText(s: Live['status']) {
  return s === 'living' ? '直播中' : s === 'upcoming' ? '预告' : '回放'
}

function switchStatus(s: string) {
  status.value = s
  load(true)
}

async function load(reset = false) {
  if (loading.value) return
  if (reset) {
    page.value = 1
    hasMore.value = true
    list.value = []
  }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getLiveList({ page: page.value, pageSize, status: status.value })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } catch (e) {
    // 统一提示
  } finally {
    loading.value = false
  }
}

function goDetail(id: string | number) {
  uni.navigateTo({ url: `/pages/live/detail?id=${id}` })
}

onPullDownRefresh(() => load(true).finally(() => uni.stopPullDownRefresh()))
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; }

.tabs { display: flex; margin-bottom: 24rpx; background: #fff; border-radius: 12rpx; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; font-size: 26rpx; color: #666; }
.tab.active { color: #007aff; font-weight: 600; }

.card { background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 24rpx; }
.cover-wrap { position: relative; width: 100%; height: 320rpx; }
.cover { width: 100%; height: 100%; }
.status-tag { position: absolute; top: 20rpx; right: 20rpx; padding: 6rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; }
.status-tag.living { background: #dd524d; color: #fff; }
.status-tag.upcoming { background: #f0ad4e; color: #fff; }
.status-tag.ended { background: rgba(0,0,0,0.5); color: #fff; }

.info { padding: 20rpx; }
.title { font-size: 30rpx; color: #333; font-weight: 600; }
.meta { display: flex; justify-content: space-between; margin-top: 12rpx; }
.anchor { font-size: 24rpx; color: #007aff; }
.time { font-size: 24rpx; color: #999; }
.watch { display: block; margin-top: 8rpx; font-size: 24rpx; color: #999; }

.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; font-size: 26rpx; }
</style>
