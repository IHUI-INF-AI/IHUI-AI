<template>
  <view class="page">
    <view class="card">
      <view class="card-title">{{ order.title }}</view>
      <view class="row"><text class="label">订单号</text><text class="value">{{ order.orderNo }}</text></view>
      <view class="row"><text class="label">创建时间</text><text class="value">{{ order.createTime }}</text></view>
      <view class="row"><text class="label">订单类型</text><text class="value">{{ order.type }}</text></view>
      <view class="row"><text class="label">订单状态</text><text class="value" :class="order.status">{{ statusText }}</text></view>
      <view class="row"><text class="label">订单金额</text><text class="value price">¥{{ order.amount }}</text></view>
    </view>
    <view class="actions">
      <button class="btn primary" v-if="order.status === 'pending'" @tap="goPay">去支付</button>
      <button class="btn" v-if="order.status === 'paid'" @tap="goRefund">申请退款</button>
      <button class="btn" @tap="goList">订单列表</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getOrderDetail, type Order } from '@/api'

const order = ref<Order>({} as Order)
const statusText = computed(() => ({ pending: '待支付', paid: '已支付', cancelled: '已取消', refunded: '已退款' } as any)[order.value.status])

onLoad(async (q: any) => {
  if (!q.id) return
  try { order.value = await getOrderDetail(q.id) } catch (e) {}
})
function goPay() { uni.navigateTo({ url: `/pages/pay/index?orderNo=${order.value.orderNo}&amount=${order.value.amount}` }) }
function goRefund() { uni.navigateTo({ url: `/pages/order/refund?orderNo=${order.value.orderNo}` }) }
function goList() { uni.navigateTo({ url: '/pages/order/list' }) }
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.card-title { font-size: 32rpx; color: #333; font-weight: 600; padding-bottom: 24rpx; border-bottom: 2rpx solid #f5f5f5; }
.row { display: flex; justify-content: space-between; padding: 24rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.label { font-size: 26rpx; color: #999; }
.value { font-size: 26rpx; color: #333; }
.value.paid { color: #4caf50; }
.value.pending { color: #ff9a3c; }
.value.refunded { color: #999; }
.value.price { color: #dd524d; font-weight: 600; font-size: 32rpx; }
.actions { padding: 0 32rpx; }
.btn { margin-top: 24rpx; background: #fff; color: #333; border-radius: 40rpx; font-size: 30rpx; }
.btn.primary { background: #007aff; color: #fff; }
</style>
