<template>
  <view class="page">
    <view class="result" :class="status">
      <view class="icon">{{ status === 'paid' ? '✓' : status === 'failed' ? '×' : '…' }}</view>
      <text class="title">{{ status === 'paid' ? '支付成功' : status === 'failed' ? '支付失败' : '支付处理中' }}</text>
      <text class="amount" v-if="amount">¥{{ amount }}</text>
    </view>
    <view class="actions" v-if="status !== 'pending'">
      <button class="btn primary" @tap="goHome">返回首页</button>
      <button class="btn" @tap="goOrders">查看订单</button>
    </view>
    <view class="actions" v-else>
      <button class="btn primary" @tap="check">刷新状态</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getPayResult } from '@/api'

const orderNo = ref('')
const status = ref<'pending' | 'paid' | 'failed'>('pending')
const amount = ref(0)

onLoad((q: any) => { orderNo.value = q.orderNo || ''; check() })

async function check() {
  if (!orderNo.value) return
  try {
    const res = await getPayResult(orderNo.value)
    status.value = res.status
    amount.value = res.amount
  } catch (e) {}
}
function goHome() { uni.switchTab({ url: '/pages/index/index' }) }
function goOrders() { uni.navigateTo({ url: '/pages/order/list' }) }
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.result { padding: 120rpx 0; text-align: center; }
.icon { width: 160rpx; height: 160rpx; line-height: 160rpx; margin: 0 auto; border-radius: 50%; font-size: 80rpx; color: #fff; }
.result.paid .icon { background: #4caf50; }
.result.failed .icon { background: #dd524d; }
.result.pending .icon { background: #ff9a3c; }
.title { display: block; font-size: 36rpx; color: #333; font-weight: 600; margin-top: 32rpx; }
.amount { display: block; font-size: 40rpx; color: #dd524d; margin-top: 16rpx; }
.actions { padding: 0 60rpx; }
.btn { margin-top: 32rpx; background: #fff; color: #333; border-radius: 40rpx; font-size: 30rpx; }
.btn.primary { background: #007aff; color: #fff; }
</style>
