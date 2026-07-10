<template>
  <view class="page">
    <view class="card">
      <view class="order-info">
        <text class="o-title">订单金额</text>
        <text class="o-amount">¥{{ amount }}</text>
      </view>
    </view>
    <view class="card">
      <view class="card-title">选择支付方式</view>
      <view class="pay-method" v-for="m in methods" :key="m.value" @tap="payType = m.value">
        <view class="pm-icon" :style="{ color: m.color }">{{ m.icon }}</view>
        <text class="pm-name">{{ m.name }}</text>
        <view class="radio" :class="{ active: payType === m.value }"></view>
      </view>
    </view>
    <button class="btn" @tap="onPay">确认支付 ¥{{ amount }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { pay } from '@/api'

const orderNo = ref('')
const amount = ref(0)
const payType = ref<'wechat' | 'balance' | 'alipay'>('wechat')
const methods = [
  { value: 'wechat' as const, name: '微信支付', icon: '微', color: '#09bb07' },
  { value: 'alipay' as const, name: '支付宝', icon: '支', color: '#1677ff' },
  { value: 'balance' as const, name: '余额支付', icon: '余', color: '#ff9a3c' },
]

onLoad((q: any) => { orderNo.value = q.orderNo || ''; amount.value = Number(q.amount) || 0 })

async function onPay() {
  if (!orderNo.value) return uni.showToast({ title: '订单异常', icon: 'none' })
  try {
    const res = await pay({ orderNo: orderNo.value, payType: payType.value })
    if (res.success) {
      uni.redirectTo({ url: `/pages/pay/result?orderNo=${orderNo.value}` })
    } else if (res.payUrl) {
      // #ifdef H5
      window.location.href = res.payUrl
      // #endif
    }
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.order-info { text-align: center; }
.o-title { display: block; font-size: 26rpx; color: #999; }
.o-amount { display: block; font-size: 60rpx; color: #dd524d; font-weight: 700; margin-top: 12rpx; }
.card-title { font-size: 28rpx; color: #333; font-weight: 600; margin-bottom: 24rpx; }
.pay-method { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.pm-icon { width: 60rpx; height: 60rpx; line-height: 60rpx; text-align: center; background: #f5f5f5; border-radius: 50%; font-size: 28rpx; }
.pm-name { flex: 1; margin-left: 24rpx; font-size: 28rpx; color: #333; }
.radio { width: 36rpx; height: 36rpx; border: 2rpx solid #ccc; border-radius: 50%; }
.radio.active { background: #007aff; border-color: #007aff; position: relative; }
.radio.active::after { content: '✓'; color: #fff; font-size: 22rpx; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
.btn { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
</style>
