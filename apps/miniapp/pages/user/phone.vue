<template>
  <view class="page">
    <view class="card">
      <view class="row">
        <text class="label">手机号</text>
        <input class="input" type="number" v-model="phone" placeholder="请输入手机号" maxlength="11" />
      </view>
      <view class="row">
        <text class="label">验证码</text>
        <view class="code-box">
          <input class="input" type="number" v-model="code" placeholder="请输入验证码" maxlength="6" />
          <text class="code-btn" :class="{ disabled: counting }" @tap="sendCode">{{ counting ? `${count}s` : '获取验证码' }}</text>
        </view>
      </view>
    </view>
    <button class="btn" @tap="onSubmit" :disabled="!phone || !code">绑定</button>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getProfile, sendSmsCode, bindPhone } from '@/api'

const phone = ref('')
const code = ref('')
const counting = ref(false)
const count = ref(60)

onShow(async () => { try { phone.value = (await getProfile()).phone || '' } catch (e) {} })

function sendCode() {
  if (counting.value) return
  if (!/^1\d{10}$/.test(phone.value)) return uni.showToast({ title: '手机号格式错误', icon: 'none' })
  sendSmsCode(phone.value).then(() => {
    counting.value = true
    const timer = setInterval(() => {
      count.value--
      if (count.value <= 0) { clearInterval(timer); counting.value = false; count.value = 60 }
    }, 1000)
  }).catch(() => {})
}

async function onSubmit() {
  try {
    await bindPhone(phone.value, code.value)
    uni.showToast({ title: '绑定成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) {}
}
</script>

<style lang="scss" scoped>
.page { min-height: 100vh; background: #f7f8fa; }
.card { margin: 24rpx; padding: 0 32rpx; background: #fff; border-radius: 16rpx; }
.row { display: flex; align-items: center; padding: 32rpx 0; border-bottom: 2rpx solid #f5f5f5; }
.label { width: 140rpx; font-size: 28rpx; color: #333; }
.input { flex: 1; font-size: 28rpx; }
.code-box { flex: 1; display: flex; align-items: center; }
.code-btn { color: #007aff; font-size: 24rpx; white-space: nowrap; }
.code-btn.disabled { color: #ccc; }
.btn { margin: 60rpx 32rpx; background: #007aff; color: #fff; border-radius: 40rpx; font-size: 32rpx; }
.btn[disabled] { background: #ccc; }
</style>
