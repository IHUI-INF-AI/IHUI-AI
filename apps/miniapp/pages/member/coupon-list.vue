<template>
  <view class="page">
    <view class="list" v-if="list.length">
      <view class="coupon" v-for="c in list" :key="c.id">
        <view class="coupon-left">
          <text class="c-amt">{{ c.amount }}</text>
          <text class="c-unit">元</text>
        </view>
        <view class="coupon-right">
          <text class="c-title">{{ c.title }}</text>
          <text class="c-thres">满{{ c.threshold }}可用</text>
          <text class="c-time">有效期至 {{ c.expireTime }}</text>
        </view>
        <view class="coupon-btn" @tap="onReceive(c.id)">领取</view>
      </view>
    </view>
    <view class="empty" v-else-if="!loading"><text>暂无可领取优惠券</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCouponList } from '@/api'

const list = ref<Array<{ id: string; title: string; amount: number; threshold: number; expireTime: string; status: string }>>([])
const loading = ref(true)

async function load() {
  try { list.value = (await getCouponList({ status: 'available' })).list || [] } finally { loading.value = false }
}
function onReceive(_id: string) {
  uni.showToast({ title: '领取成功', icon: 'success' })
  load()
}
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; padding: 24rpx 32rpx; }
.coupon { display: flex; background: #fff; border-radius: 16rpx; overflow: hidden; margin-bottom: 24rpx; }
.coupon-left { width: 180rpx; background: linear-gradient(135deg, #ff9a3c, #ff6e3c); color: #fff; display: flex; align-items: center; justify-content: center; }
.c-amt { font-size: 56rpx; font-weight: 700; }
.c-unit { font-size: 24rpx; margin-left: 8rpx; }
.coupon-right { flex: 1; padding: 24rpx; }
.c-title { display: block; font-size: 28rpx; color: #333; font-weight: 600; }
.c-thres { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.c-time { display: block; font-size: 22rpx; color: #999; margin-top: 8rpx; }
.coupon-btn { width: 120rpx; display: flex; align-items: center; justify-content: center; background: #ff6e3c; color: #fff; font-size: 26rpx; }
.empty { text-align: center; padding: 120rpx 0; color: #999; }
</style>
