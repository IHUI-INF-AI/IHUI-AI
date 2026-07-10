<template>
  <view class="page">
    <view class="summary">
      <text class="sum-num">{{ total }}</text>
      <text class="sum-label">当前积分</text>
    </view>
    <view class="tabs">
      <text class="tab" :class="{ active: type === 'all' }" @tap="type = 'all'; load(true)">全部</text>
      <text class="tab" :class="{ active: type === 'in' }" @tap="type = 'in'; load(true)">收入</text>
      <text class="tab" :class="{ active: type === 'out' }" @tap="type = 'out'; load(true)">支出</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="it in list" :key="it.id">
        <view class="item-body">
          <text class="item-title">{{ it.type }}</text>
          <text class="item-time">{{ it.time }}</text>
        </view>
        <text class="item-amt" :class="{ in: it.amount > 0 }">{{ it.amount > 0 ? '+' : '' }}{{ it.amount }}</text>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无记录</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getIntegral } from '@/api'

const list = ref<Array<{ id: string; type: string; amount: number; time: string }>>([])
const loading = ref(false)
const type = ref<'all' | 'in' | 'out'>('all')
const total = ref(0)
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getIntegral({ page: page.value, pageSize: 20 })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.summary { padding: 60rpx 0; text-align: center; background: linear-gradient(135deg, #007aff, #00c6ff); color: #fff; }
.sum-num { display: block; font-size: 60rpx; font-weight: 700; }
.sum-label { display: block; font-size: 24rpx; opacity: .9; margin-top: 8rpx; }
.tabs { display: flex; padding: 24rpx; background: #fff; }
.tab { flex: 1; text-align: center; font-size: 26rpx; color: #666; padding: 12rpx 0; }
.tab.active { color: #007aff; font-weight: 600; }
.list { padding: 0 24rpx; }
.item { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 32rpx; margin-top: 24rpx; border-radius: 16rpx; }
.item-title { display: block; font-size: 28rpx; color: #333; }
.item-time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.item-amt { font-size: 32rpx; color: #dd524d; font-weight: 600; }
.item-amt.in { color: #4caf50; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
