<template>
  <view class="page">
    <view class="banner">
      <view class="banner-title">升级VIP会员</view>
      <view class="banner-desc">解锁更多专属特权</view>
    </view>
    <view class="plans">
      <view class="plan" v-for="(p, i) in plans" :key="i" :class="{ active: selected === i }" @tap="selected = i">
        <view class="plan-tag" v-if="p.tag">{{ p.tag }}</view>
        <text class="plan-name">{{ p.name }}</text>
        <text class="plan-price">¥{{ p.price }}</text>
        <text class="plan-orig" v-if="p.origin">原价¥{{ p.origin }}</text>
      </view>
    </view>
    <view class="rights">
      <view class="rights-title">会员权益</view>
      <view class="rights-item" v-for="r in rights" :key="r">· {{ r }}</view>
    </view>
    <button class="btn" @tap="onUpgrade">立即升级 ¥{{ plans[selected].price }}</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { upgradeVip } from '@/api'

const plans = [
  { name: '月度VIP', price: 19, origin: 30, tag: '' },
  { name: '季度VIP', price: 49, origin: 90, tag: '推荐' },
  { name: '年度VIP', price: 158, origin: 360, tag: '超值' },
]
const rights = ['全部课程免费学', 'AI对话不限次', '专属客服服务', '会员专属折扣', '高清视频下载']
const selected = ref(2)

async function onUpgrade() {
  try {
    const res = await upgradeVip(selected.value + 1)
    uni.navigateTo({ url: `/pages/pay/index?orderNo=${res.orderNo}` })
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.banner { padding: 60rpx 40rpx; background: linear-gradient(135deg, #f8d486, #f2b04a); color: #fff; }
.banner-title { font-size: 44rpx; font-weight: 700; }
.banner-desc { font-size: 26rpx; margin-top: 12rpx; opacity: .9; }
.plans { display: flex; padding: 24rpx; gap: 16rpx; }
.plan { flex: 1; padding: 32rpx 0; background: #fff; border-radius: 16rpx; text-align: center; position: relative; border: 2rpx solid #eee; }
.plan.active { border-color: #f2b04a; background: #fff5e6; }
.plan-tag { position: absolute; top: -12rpx; left: 50%; transform: translateX(-50%); background: #dd524d; color: #fff; font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 10rpx; }
.plan-name { display: block; font-size: 28rpx; color: #333; }
.plan-price { display: block; font-size: 40rpx; color: #dd524d; font-weight: 700; margin: 12rpx 0; }
.plan-orig { display: block; font-size: 22rpx; color: #999; text-decoration: line-through; }
.rights { margin: 0 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.rights-title { font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 24rpx; }
.rights-item { font-size: 26rpx; color: #666; padding: 8rpx 0; }
.btn { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #f2b04a; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
</style>
