<template>
  <view class="page">
    <view class="card">
      <view class="card-title">申请退款</view>
      <view class="row"><text class="label">订单号</text><text class="value">{{ orderNo }}</text></view>
      <view class="reason-box">
        <text class="label">退款原因</text>
        <textarea class="textarea" v-model="reason" placeholder="请填写退款原因" maxlength="200" />
      </view>
    </view>
    <button class="btn" @tap="onSubmit" :disabled="!reason">提交申请</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { refund } from '@/api'

const orderNo = ref('')
const reason = ref('')

onLoad((q: any) => { orderNo.value = q.orderNo || '' })

async function onSubmit() {
  if (!reason.value) return
  try {
    await refund({ orderNo: orderNo.value, reason: reason.value })
    uni.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1500)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.card-title { font-size: 32rpx; color: #333; font-weight: 600; margin-bottom: 24rpx; }
.row { display: flex; justify-content: space-between; padding: 16rpx 0; }
.label { font-size: 26rpx; color: #999; }
.value { font-size: 26rpx; color: #333; }
.reason-box { margin-top: 24rpx; }
.textarea { width: 100%; min-height: 200rpx; margin-top: 16rpx; padding: 20rpx; background: #f7f8fa; border-radius: 12rpx; font-size: 26rpx; box-sizing: border-box; }
.btn { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
