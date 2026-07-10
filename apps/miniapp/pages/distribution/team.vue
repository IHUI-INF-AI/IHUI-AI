<template>
  <view class="page">
    <view class="summary">团队总人数：{{ total }}</view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="m in list" :key="m.id">
        <image class="avatar" :src="m.avatar || '/static/default-avatar.png'" mode="aspectFill" />
        <view class="item-body">
          <text class="name">{{ m.nickname }}</text>
          <text class="time">加入时间：{{ m.joinTime }}</text>
        </view>
        <text class="level">L{{ m.level }}</text>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无团队成员</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getDistributionTeam } from '@/api'

const list = ref<Array<{ id: string; nickname: string; avatar?: string; joinTime: string; level: number }>>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getDistributionTeam({ page: page.value, pageSize: 20 })
    list.value.push(...(res.list || []))
    total.value = res.total
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.summary { padding: 24rpx 32rpx; font-size: 26rpx; color: #666; }
.list { padding: 0 24rpx; }
.item { display: flex; align-items: center; background: #fff; padding: 24rpx; margin-bottom: 24rpx; border-radius: 16rpx; }
.avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: #f5f5f5; }
.item-body { flex: 1; margin-left: 24rpx; }
.name { display: block; font-size: 28rpx; color: #333; }
.time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.level { font-size: 24rpx; color: #ff6e3c; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
