<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <text class="label">原密码</text>
        <input class="input" type="password" v-model="oldPwd" placeholder="请输入原密码" />
      </view>
      <view class="row">
        <text class="label">新密码</text>
        <input class="input" type="password" v-model="newPwd" placeholder="请输入新密码" />
      </view>
      <view class="row">
        <text class="label">确认密码</text>
        <input class="input" type="password" v-model="confirmPwd" placeholder="请再次输入新密码" />
      </view>
    </view>
    <view class="tips">
      <text>密码长度8-20位，需包含字母和数字</text>
    </view>
    <button class="btn" @tap="onSubmit" :disabled="!oldPwd || !newPwd">确认修改</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { updatePassword } from '@/api'

const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')

async function onSubmit() {
  if (newPwd.value !== confirmPwd.value) return uni.showToast({ title: '两次密码不一致', icon: 'none' })
  if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,20}$/.test(newPwd.value)) return uni.showToast({ title: '密码格式错误', icon: 'none' })
  try {
    await updatePassword(oldPwd.value, newPwd.value)
    uni.showToast({ title: '修改成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.card { margin: 24rpx; padding: 0 32rpx; background: #fff; border-radius: 16rpx; }
.row { display: flex; align-items: center; padding: 32rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.label { width: 160rpx; font-size: 28rpx; color: #333; }
.input { flex: 1; font-size: 28rpx; }
.tips { padding: 0 32rpx; margin-top: 16rpx; }
.tips text { font-size: 22rpx; color: #999; }
.btn { margin: 60rpx 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
