<template>
  <view class="page">
    <view class="card" v-if="info.phone">
      <view class="row" @tap="call(info.phone)">
        <text class="icon">📞</text>
        <view class="body">
          <text class="label">客服电话</text>
          <text class="value">{{ info.phone }}</text>
        </view>
      </view>
      <view class="row" @tap="copy(info.email)">
        <text class="icon">✉️</text>
        <view class="body">
          <text class="label">邮箱</text>
          <text class="value">{{ info.email }}</text>
        </view>
      </view>
      <view class="row" @tap="copy(info.qq || '')">
        <text class="icon">💬</text>
        <view class="body">
          <text class="label">QQ</text>
          <text class="value">{{ info.qq }}</text>
        </view>
      </view>
      <view class="row">
        <text class="icon">📍</text>
        <view class="body">
          <text class="label">地址</text>
          <text class="value">{{ info.address }}</text>
        </view>
      </view>
    </view>
    <view class="tips">
      <text>工作时间：周一至周五 9:00-18:00</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getContact } from '@/api'

const info = ref<{ phone: string; email: string; address: string; qq?: string }>({ phone: '', email: '', address: '' })

async function load() {
  try { info.value = await getContact() } catch (e) {}
}
function call(phone: string) { uni.makePhoneCall({ phoneNumber: phone }) }
function copy(text: string) { uni.setClipboardData({ data: text }) }
onShow(load)
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.card { margin: 24rpx; background: #fff; border-radius: 16rpx; overflow: hidden; }
.row { display: flex; align-items: center; padding: 32rpx; border-bottom: 2rpx solid #f5f5f5; }
.icon { font-size: 40rpx; }
.body { margin-left: 24rpx; }
.label { display: block; font-size: 22rpx; color: #999; }
.value { display: block; font-size: 28rpx; color: #333; margin-top: 4rpx; }
.tips { text-align: center; padding: 32rpx; }
.tips text { font-size: 22rpx; color: #999; }
</style>
