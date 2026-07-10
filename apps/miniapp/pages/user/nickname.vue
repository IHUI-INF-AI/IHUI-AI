<template>
  <view class="page">
    <view class="card">
      <text class="label">新昵称</text>
      <input class="input" v-model="nickname" placeholder="请输入新昵称" maxlength="20" />
    </view>
    <button class="btn" @tap="onSave" :disabled="!nickname">保存</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, updateUserNickname } from '@/api'

const nickname = ref('')

onShow(async () => { try { nickname.value = (await getProfile()).nickname || '' } catch (e) {} })

async function onSave() {
  if (!nickname.value) return
  try {
    await updateUserNickname(nickname.value)
    uni.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.card { margin: 24rpx; padding: 32rpx; background: #fff; border-radius: 16rpx; }
.label { font-size: 26rpx; color: #999; }
.input { width: 100%; margin-top: 16rpx; padding: 16rpx 0; font-size: 30rpx; border-bottom: 2rpx solid #f5f5f5; }
.btn { margin: 60rpx 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
