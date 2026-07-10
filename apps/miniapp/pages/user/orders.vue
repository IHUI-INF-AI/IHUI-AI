<template>
  <view class="page">
    <!-- 状态筛选 -->
    <view class="tabs">
      <view class="tab" :class="{ active: status === '' }" @tap="switchStatus('')"><text>全部</text></view>
      <view class="tab" :class="{ active: status === 'pending' }" @tap="switchStatus('pending')"><text>待付款</text></view>
      <view class="tab" :class="{ active: status === 'paid' }" @tap="switchStatus('paid')"><text>已付款</text></view>
      <view class="tab" :class="{ active: status === 'cancelled' }" @tap="switchStatus('cancelled')"><text>已取消</text></view>
    </view>

    <!-- 订单列表 -->
    <view class="list" v-if="list.length">
      <view class="card" v-for="item in list" :key="item.id">
        <view class="card-head">
          <text class="order-no">订单号：{{ item.orderNo }}</text>
          <text class="status" :class="item.status">{{ statusText(item.status) }}</text>
        </view>
        <view class="card-body">
          <text class="title">{{ item.title }}</text>
          <text class="type">{{ item.type }}</text>
        </view>
        <view class="card-foot">
          <text class="time">{{ item.createTime }}</text>
          <view class="amount-wrap">
            <text class="amount-symbol">¥</text>
            <text class="amount">{{ item.amount }}</text>
          </view>
          <view class="action-btn" v-if="item.status === 'pending'" @tap="handlePay(item)">
            <text>去支付</text>
          </view>
        </view>
      </view>
    </view>

    <view class="empty" v-if="!loading && !list.length"><text>暂无订单</text></view>
    <view class="loading" v-if="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderList, type Order } from '@/api'

const list = ref<Order[]>([])
const loading = ref(false)
const status = ref('')
const page = ref(1)
const pageSize = 10
const hasMore = ref(true)

function statusText(s: Order['status']) {
  const map: Record<Order['status'], string> = {
    pending: '待付款',
    paid: '已付款',
    cancelled: '已取消',
    refunded: '已退款',
  }
  return map[s] || s
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
    const res = await getOrderList({ page: page.value, pageSize, status: status.value })
    list.value.push(...(res.list || []))
    hasMore.value = list.value.length < res.total
    page.value++
  } catch (e) {
    // 统一提示
  } finally {
    loading.value = false
  }
}

function handlePay(item: Order) {
  uni.showToast({ title: `支付订单 ${item.orderNo}`, icon: 'none' })
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

.card { background: #fff; border-radius: 16rpx; padding: 24rpx; margin-bottom: 24rpx; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.order-no { font-size: 24rpx; color: #999; }
.status { font-size: 26rpx; }
.status.paid { color: #4cd964; }
.status.pending { color: #f0ad4e; }
.status.cancelled { color: #999; }
.status.refunded { color: #dd524d; }

.card-body { display: flex; flex-direction: column; margin: 20rpx 0; }
.title { font-size: 30rpx; color: #333; font-weight: 600; }
.type { margin-top: 8rpx; font-size: 24rpx; color: #999; }

.card-foot { display: flex; align-items: center; padding-top: 20rpx; border-top: 1rpx solid #f5f5f5; }
.time { flex: 1; font-size: 24rpx; color: #999; }
.amount-wrap { margin-right: 24rpx; }
.amount-symbol { font-size: 24rpx; color: #dd524d; }
.amount { font-size: 34rpx; color: #dd524d; font-weight: 700; }
.action-btn { padding: 10rpx 32rpx; background: #007aff; color: #fff; border-radius: 30rpx; font-size: 26rpx; }

.empty, .loading { text-align: center; padding: 120rpx 0; color: #999; font-size: 26rpx; }
</style>
