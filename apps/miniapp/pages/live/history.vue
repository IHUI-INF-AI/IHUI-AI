<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="item" v-for="l in list" :key="l.id" @tap="goDetail(l.id)">
        <image class="cover" :src="l.coverUrl" mode="aspectFill" />
        <view class="info">
          <text class="title">{{ l.title }}</text>
          <text class="anchor" v-if="l.anchor">主播：{{ l.anchor }}</text>
          <view class="meta">
            <text class="time">{{ l.startTime }}</text>
            <text class="views">回放</text>
          </view>
        </view>
      </view>
    </view>
    <view class="empty" v-if="!loading && !list.length"><text>暂无直播回放</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getLiveHistory, type Live } from '@/api'

const list = ref<Live[]>([])
const loading = ref(false)
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getLiveHistory({ page: page.value, pageSize: 10 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/live/detail?id=${id}` }) }
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.list { padding: 24rpx; }
.item { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 24rpx; }
.cover { width: 240rpx; height: 160rpx; flex-shrink: 0; background: #f5f5f5; }
.info { flex: 1; padding: 20rpx; display: flex; flex-direction: column; justify-content: space-between; }
.title { font-size: 28rpx; color: #333; font-weight: 600; }
.anchor { font-size: 22rpx; color: #666; }
.meta { display: flex; justify-content: space-between; }
.time { font-size: 22rpx; color: #999; }
.views { font-size: 22rpx; color: #007aff; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
