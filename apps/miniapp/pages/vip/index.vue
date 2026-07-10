<template>
  <view class="page">
    <view class="header" :style="{ background: info.level ? gradient : '#999' }">
      <view class="level">{{ info.level ? info.name : '未开通VIP' }}</view>
      <view class="expire" v-if="info.expireTime">到期时间：{{ info.expireTime }}</view>
      <view class="expire" v-else>开通VIP享更多特权</view>
    </view>

    <view class="card">
      <view class="card-title">VIP特权</view>
      <view class="grid">
        <view class="grid-item" v-for="p in privileges" :key="p.id" @tap="goPrivilege">
          <view class="gicon">★</view>
          <text class="gtext">{{ p.title }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="card-title">开通套餐</view>
      <view class="plans">
        <view class="plan" v-for="lv in 3" :key="lv" :class="{ active: selected === lv }" @tap="selected = lv">
          <text class="plan-name">{{ ['月度', '季度', '年度'][lv - 1] }}VIP</text>
          <text class="plan-price">¥{{ [19, 49, 158][lv - 1] }}</text>
        </view>
      </view>
      <button class="btn" @tap="onUpgrade">立即开通</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getVipInfo, getVipPrivilege, upgradeVip, type VipInfo } from '@/api'

const gradient = 'linear-gradient(135deg, #f8d486, #f2b04a)'
const info = ref<VipInfo>({} as VipInfo)
const privileges = ref<Array<{ id: string; title: string; desc: string }>>([])
const selected = ref(3)

async function load() {
  try {
    const [i, p] = await Promise.all([getVipInfo(), getVipPrivilege()])
    info.value = i
    privileges.value = p.list || []
  } catch (e) {}
}

function goPrivilege() {
  uni.navigateTo({ url: '/pages/vip/privilege' })
}

async function onUpgrade() {
  try {
    const res = await upgradeVip(selected.value)
    uni.navigateTo({ url: `/pages/pay/index?orderNo=${res.orderNo}` })
  } catch (e) {}
}

onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.header { padding: 60rpx 40rpx; color: #fff; }
.level { font-size: 44rpx; font-weight: 700; }
.expire { font-size: 24rpx; margin-top: 12rpx; opacity: .9; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.card-title { font-size: 30rpx; font-weight: 600; color: #333; margin-bottom: 24rpx; }
.grid { display: flex; flex-wrap: wrap; }
.grid-item { width: 25%; display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.gicon { width: 72rpx; height: 72rpx; line-height: 72rpx; text-align: center; border-radius: 50%; background: #fff5e6; color: #f2b04a; font-size: 32rpx; }
.gtext { font-size: 22rpx; color: #666; margin-top: 8rpx; }
.plans { display: flex; justify-content: space-between; }
.plan { flex: 1; margin: 0 8rpx; padding: 24rpx 0; border: 2rpx solid #eee; border-radius: 12rpx; text-align: center; }
.plan.active { border-color: #f2b04a; background: #fff5e6; }
.plan-name { display: block; font-size: 26rpx; color: #333; }
.plan-price { display: block; font-size: 32rpx; color: #dd524d; font-weight: 600; margin-top: 8rpx; }
.btn { margin-top: 32rpx; background: #f2b04a; color: #fff; border-radius: 40rpx; font-size: 30rpx; }
</style>
