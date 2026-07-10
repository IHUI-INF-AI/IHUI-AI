<template>
  <view class="page">
    <view class="head">
      <view class="level-tag">{{ info.level || '普通用户' }}</view>
      <view class="stat-row">
        <view class="stat"><text class="stat-num">{{ info.integral }}</text><text class="stat-label">积分</text></view>
        <view class="stat"><text class="stat-num">{{ info.growth }}</text><text class="stat-label">成长值</text></view>
        <view class="stat"><text class="stat-num">{{ info.coupons }}</text><text class="stat-label">优惠券</text></view>
      </view>
    </view>
    <view class="menu">
      <view class="menu-item" @tap="navigate('/pages/member/benefits')"><text>会员权益</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/member/integral')"><text>积分明细</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/member/coupon')"><text>我的优惠券</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/member/coupon-list')"><text>领券中心</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/vip/index')"><text>VIP会员</text><text class="arrow">›</text></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMemberInfo, type MemberInfo } from '@/api'

const info = ref<MemberInfo>({} as MemberInfo)

async function load() {
  try { info.value = await getMemberInfo() } catch (e) {}
}
function navigate(url: string) { uni.navigateTo({ url }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.head { padding: 60rpx 40rpx; background: linear-gradient(135deg, #007aff, #00c6ff); color: #fff; }
.level-tag { display: inline-block; padding: 8rpx 24rpx; background: rgba(255,255,255,.2); border-radius: 20rpx; font-size: 26rpx; }
.stat-row { display: flex; margin-top: 40rpx; }
.stat { flex: 1; text-align: center; }
.stat-num { display: block; font-size: 40rpx; font-weight: 700; }
.stat-label { display: block; font-size: 24rpx; margin-top: 8rpx; opacity: .9; }
.menu { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; font-size: 28rpx; color: #333; }
.arrow { color: #ccc; }
</style>
