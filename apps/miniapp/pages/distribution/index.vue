<template>
  <view class="page">
    <view class="header">
      <view class="h-row">
        <view class="h-item"><text class="h-num">¥{{ info.totalCommission }}</text><text class="h-label">累计佣金</text></view>
        <view class="h-item"><text class="h-num">¥{{ info.available }}</text><text class="h-label">可提现</text></view>
      </view>
      <view class="h-row">
        <view class="h-item"><text class="h-num">¥{{ info.withdrawn }}</text><text class="h-label">已提现</text></view>
        <view class="h-item"><text class="h-num">{{ info.teamCount }}</text><text class="h-label">团队人数</text></view>
      </view>
    </view>
    <view class="menu">
      <view class="menu-item" @tap="navigate('/pages/distribution/team')"><text>我的团队</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/distribution/commission')"><text>佣金记录</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/distribution/withdraw')"><text>申请提现</text><text class="arrow">›</text></view>
      <view class="menu-item" @tap="navigate('/pages/distribution/rank')"><text>分销排行</text><text class="arrow">›</text></view>
    </view>
    <button class="btn" @tap="navigate('/pages/distribution/withdraw')">立即提现</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getDistributionInfo, type DistributionInfo } from '@/api'

const info = ref<DistributionInfo>({ level: 0, totalCommission: 0, available: 0, withdrawn: 0, teamCount: 0 })

async function load() {
  try { info.value = await getDistributionInfo() } catch (e) {}
}
function navigate(url: string) { uni.navigateTo({ url }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; padding-bottom: 120rpx; }
.header { padding: 60rpx 40rpx; background: linear-gradient(135deg, #ff6e3c, #ff9a3c); color: #fff; }
.h-row { display: flex; margin-bottom: 32rpx; }
.h-row:last-child { margin-bottom: 0; }
.h-item { flex: 1; text-align: center; }
.h-num { display: block; font-size: 40rpx; font-weight: 700; }
.h-label { display: block; font-size: 24rpx; opacity: .9; margin-top: 8rpx; }
.menu { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.menu-item { display: flex; justify-content: space-between; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; font-size: 28rpx; color: #333; }
.arrow { color: #ccc; }
.btn { position: fixed; bottom: 32rpx; left: 32rpx; right: 32rpx; background: #ff6e3c; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
</style>
