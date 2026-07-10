<template>
  <view class="page">
    <view class="card">
      <text class="label">可提现金额</text>
      <text class="amount">¥{{ available }}</text>
      <view class="input-box">
        <text class="unit">¥</text>
        <input class="input" type="digit" v-model="amount" placeholder="请输入提现金额" />
      </view>
      <view class="types">
        <text class="tlabel">提现方式</text>
        <view class="type-row">
          <view class="type" v-for="t in types" :key="t.value" :class="{ active: payType === t.value }" @tap="payType = t.value">
            <text>{{ t.name }}</text>
          </view>
        </view>
      </view>
    </view>
    <button class="btn" @tap="onSubmit">立即提现</button>
    <view class="tips">
      <text>提现说明：</text>
      <text>1. 最低提现金额 ¥10</text>
      <text>2. 提现申请将在1-3个工作日内审核</text>
      <text>3. 工作日17:00前申请当日到账</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getDistributionInfo, withdraw } from '@/api'

const available = ref(0)
const amount = ref('')
const payType = ref('wechat')
const types = [
  { value: 'wechat', name: '微信' },
  { value: 'alipay', name: '支付宝' },
  { value: 'bank', name: '银行卡' },
]

async function load() {
  try { available.value = (await getDistributionInfo()).available } catch (e) {}
}
async function onSubmit() {
  const amt = Number(amount.value)
  if (!amt || amt < 10) return uni.showToast({ title: '最低提现¥10', icon: 'none' })
  if (amt > available.value) return uni.showToast({ title: '余额不足', icon: 'none' })
  try {
    await withdraw({ amount: amt, type: payType.value })
    uni.showToast({ title: '提现申请已提交', icon: 'success' })
    amount.value = ''
    load()
  } catch (e) {}
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 40rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.label { font-size: 26rpx; color: #999; }
.amount { display: block; font-size: 60rpx; color: #333; font-weight: 700; margin: 16rpx 0 32rpx; }
.input-box { display: flex; align-items: center; padding: 24rpx 0; border-top: 2rpx solid #f5f5f5; }
.unit { font-size: 40rpx; color: #333; font-weight: 600; }
.input { flex: 1; margin-left: 16rpx; font-size: 40rpx; }
.types { margin-top: 32rpx; }
.tlabel { font-size: 26rpx; color: #999; }
.type-row { display: flex; margin-top: 16rpx; gap: 16rpx; }
.type { flex: 1; padding: 20rpx 0; text-align: center; border: 2rpx solid #eee; border-radius: 12rpx; font-size: 26rpx; color: #333; }
.type.active { border-color: #ff6e3c; color: #ff6e3c; }
.btn { margin: 32rpx; background: #ff6e3c; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.tips { padding: 0 32rpx; }
.tips text { display: block; font-size: 22rpx; color: #999; line-height: 1.8; }
</style>
