<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ active: type === 'all' }" @tap="type='all'; load(true)">全部</text>
      <text class="tab" :class="{ active: type === 'in' }" @tap="type='in'; load(true)">收入</text>
      <text class="tab" :class="{ active: type === 'out' }" @tap="type='out'; load(true)">支出</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="r in list" :key="r.id">
        <view class="item-body">
          <text class="title">{{ r.type }}</text>
          <text class="time">{{ r.time }}<text v-if="r.nickname"> · {{ r.nickname }}</text></text>
        </view>
        <text class="amt" :class="{ in: r.amount > 0 }">{{ r.amount > 0 ? '+' : '' }}¥{{ r.amount }}</text>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无记录</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom } from '@dcloudio/uni-app'
import { getCommissionRecords } from '@/api'

const list = ref<Array<{ id: string; amount: number; type: string; time: string; nickname?: string }>>([])
const loading = ref(false)
const type = ref<'all' | 'in' | 'out'>('all')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getCommissionRecords({ page: page.value, pageSize: 20 })
    let items = res.list || []
    if (type.value === 'in') items = items.filter(i => i.amount > 0)
    if (type.value === 'out') items = items.filter(i => i.amount < 0)
    list.value.push(...items)
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
onReachBottom(() => load())
load()
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.tabs { display: flex; background: #fff; }
.tab { flex: 1; text-align: center; font-size: 26rpx; color: #666; padding: 24rpx 0; }
.tab.active { color: #ff6e3c; font-weight: 600; }
.list { padding: 24rpx; }
.item { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 32rpx; margin-bottom: 24rpx; border-radius: 16rpx; }
.title { display: block; font-size: 28rpx; color: #333; }
.time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.amt { font-size: 32rpx; color: #dd524d; font-weight: 600; }
.amt.in { color: #4caf50; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
