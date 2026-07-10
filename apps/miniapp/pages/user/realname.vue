<template>
  <view class="page">
    <view class="status" v-if="verified">
      <view class="s-icon">✓</view>
      <text class="s-title">已实名认证</text>
      <text class="s-name">{{ form.realName }}</text>
      <text class="s-id">{{ maskedId }}</text>
    </view>
    <view v-else>
      <view class="card">
        <view class="row">
          <text class="label">真实姓名</text>
          <input class="input" v-model="form.realName" placeholder="请输入真实姓名" />
        </view>
        <view class="row">
          <text class="label">身份证号</text>
          <input class="input" v-model="form.idCard" placeholder="请输入身份证号" maxlength="18" />
        </view>
      </view>
      <view class="tips">
        <text>实名信息一经认证不可修改</text>
        <text>请确保信息与身份证一致</text>
      </view>
      <button class="btn" @tap="onSubmit" :disabled="!form.realName || !form.idCard">立即认证</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, realNameAuth } from '@/api'

const form = ref<{ realName: string; idCard: string }>({ realName: '', idCard: '' })
const verified = ref(false)
const maskedId = computed(() => form.value.idCard ? form.value.idCard.slice(0, 4) + '**********' + form.value.idCard.slice(-4) : '')

onShow(async () => {
  try {
    const p = await getProfile() as any
    if (p.realName) { form.value.realName = p.realName; form.value.idCard = p.idCard || ''; verified.value = true }
  } catch (e) {}
})

async function onSubmit() {
  if (!/^[\u4e00-\u9fa5]{2,10}$/.test(form.value.realName)) return uni.showToast({ title: '姓名格式错误', icon: 'none' })
  if (!/^\d{17}[\dXx]$/.test(form.value.idCard)) return uni.showToast({ title: '身份证号格式错误', icon: 'none' })
  try {
    await realNameAuth(form.value)
    uni.showToast({ title: '认证成功', icon: 'success' })
    verified.value = true
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.status { padding: 120rpx 0; text-align: center; background: #fff; }
.s-icon { width: 140rpx; height: 140rpx; line-height: 140rpx; margin: 0 auto; border-radius: 50%; background: #4caf50; color: #fff; font-size: 70rpx; }
.s-title { display: block; font-size: 32rpx; color: #333; margin-top: 32rpx; }
.s-name { display: block; font-size: 28rpx; color: #666; margin-top: 16rpx; }
.s-id { display: block; font-size: 26rpx; color: #999; margin-top: 8rpx; }
.card { margin: 24rpx; padding: 0 32rpx; background: #fff; border-radius: 16rpx; }
.row { display: flex; align-items: center; padding: 32rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.label { width: 160rpx; font-size: 28rpx; color: #333; }
.input { flex: 1; font-size: 28rpx; }
.tips { padding: 24rpx 32rpx; }
.tips text { display: block; font-size: 22rpx; color: #999; line-height: 1.8; }
.btn { margin: 60rpx 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
