<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ active: status === '' }" @tap="switchTab('')">全部</text>
      <text class="tab" :class="{ active: status === 'pending' }" @tap="switchTab('pending')">待支付</text>
      <text class="tab" :class="{ active: status === 'paid' }" @tap="switchTab('paid')">已支付</text>
      <text class="tab" :class="{ active: status === 'refunded' }" @tap="switchTab('refunded')">已退款</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="item" v-for="o in list" :key="o.id" @tap="goDetail(o.id)">
        <view class="item-top">
          <text class="o-title">{{ o.title }}</text>
          <text class="o-status" :class="o.status">{{ statusText(o.status) }}</text>
        </view>
        <text class="o-no">订单号：{{ o.orderNo }}</text>
        <view class="item-bottom">
          <text class="o-time">{{ o.createTime }}</text>
          <text class="o-amount">¥{{ o.amount }}</text>
        </view>
        <view class="item-actions" v-if="o.status === 'paid'">
          <text class="action" @tap.stop="goRefund(o)">申请退款</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无订单</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderList, type Order } from '@/api'

const list = ref<Order[]>([])
const loading = ref(false)
const status = ref('')
const page = ref(1)
const hasMore = ref(true)

async function load(reset = false) {
  if (loading.value) return
  if (reset) { page.value = 1; hasMore.value = true; list.value = [] }
  if (!hasMore.value) return
  loading.value = true
  try {
    const res = await getOrderList({ page: page.value, pageSize: 10, status: status.value || undefined })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } finally { loading.value = false }
}
function switchTab(s: string) { status.value = s; load(true) }
function statusText(s: string) { return ({ pending: '待支付', paid: '已支付', cancelled: '已取消', refunded: '已退款' } as any)[s] }
function goDetail(id: string | number) { uni.navigateTo({ url: `/pages/order/detail?id=${id}` }) }
function goRefund(o: Order) { uni.navigateTo({ url: `/pages/order/refund?orderNo=${o.orderNo}` }) }
onShow(() => load(true))
onReachBottom(() => load())
onPullDownRefresh(() => load(true).finally(() => uni.stopPullDownRefresh()))
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.tabs { display: flex; background: #fff; position: sticky; top: 0; z-index: 1; }
.tab { flex: 1; text-align: center; font-size: 26rpx; color: #666; padding: 24rpx 0; }
.tab.active { color: #007aff; font-weight: 600; }
.list { padding: 24rpx; }
.item { background: #fff; border-radius: 16rpx; padding: 32rpx; margin-bottom: 24rpx; }
.item-top { display: flex; justify-content: space-between; }
.o-title { font-size: 30rpx; color: #333; font-weight: 600; }
.o-status { font-size: 24rpx; }
.o-status.paid { color: #4caf50; }
.o-status.pending { color: #ff9a3c; }
.o-status.refunded { color: #999; }
.o-no { display: block; font-size: 22rpx; color: #999; margin-top: 12rpx; }
.item-bottom { display: flex; justify-content: space-between; margin-top: 16rpx; }
.o-time { font-size: 24rpx; color: #999; }
.o-amount { font-size: 32rpx; color: #dd524d; font-weight: 600; }
.item-actions { margin-top: 24rpx; text-align: right; }
.action { font-size: 24rpx; color: #007aff; padding: 8rpx 24rpx; border: 2rpx solid #007aff; border-radius: 24rpx; }
.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; }
</style>
