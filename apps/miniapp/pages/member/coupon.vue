<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ active: status === 'unused' }" @tap="switchTab('unused')">未使用</text>
      <text class="tab" :class="{ active: status === 'used' }" @tap="switchTab('used')">已使用</text>
      <text class="tab" :class="{ active: status === 'expired' }" @tap="switchTab('expired')">已过期</text>
    </view>
    <view class="list" v-if="list.length">
      <view class="coupon" v-for="c in list" :key="c.id" :class="{ disabled: c.status !== 'unused' }">
        <view class="coupon-left">
          <text class="c-amt">{{ c.amount }}</text>
          <text class="c-unit">元</text>
        </view>
        <view class="coupon-right">
          <text class="c-title">{{ c.title }}</text>
          <text class="c-thres">满{{ c.threshold }}可用</text>
          <text class="c-time">{{ c.expireTime }}</text>
        </view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无优惠券</text></view>
    <button class="btn" @tap="goList">领券中心</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCouponList } from '@/api'

const list = ref<Array<{ id: string; title: string; amount: number; threshold: number; expireTime: string; status: string }>>([])
const loading = ref(true)
const status = ref('unused')

async function load() {
  loading.value = true
  try { list.value = (await getCouponList({ status: status.value })).list || [] } finally { loading.value = false }
}
function switchTab(s: string) { status.value = s; load() }
function goList() { uni.navigateTo({ url: '/pages/member/coupon-list' }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.tabs { display: flex; background: #fff; }
.tab { flex: 1; text-align: center; font-size: 26rpx; color: #666; padding: 24rpx 0; }
.tab.active { color: #dd524d; font-weight: 600; }
.list { padding: 24rpx; }
.coupon { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 24rpx; }
.coupon.disabled { opacity: .5; }
.coupon-left { width: 180rpx; background: #dd524d; color: #fff; display: flex; align-items: center; justify-content: center; }
.c-amt { font-size: 56rpx; font-weight: 700; }
.c-unit { font-size: 24rpx; margin-left: 8rpx; }
.coupon-right { flex: 1; padding: 24rpx; }
.c-title { display: block; font-size: 28rpx; color: #333; font-weight: 600; }
.c-thres { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.c-time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
.btn { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #dd524d; color: #fff; border-radius: 40rpx; }
</style>
