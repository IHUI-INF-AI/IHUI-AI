<template>
  <view class="container">
    <!-- 顶部 Logo -->
    <view class="logo-box">
      <text class="logo-text">智汇AI</text>
      <text class="logo-sub">AI 赋能学习与成长</text>
    </view>

    <!-- 登录方式切换 -->
    <view class="tabs">
      <view class="tab" :class="{ active: loginType === 'phone' }" @tap="loginType = 'phone'">
        <text>验证码登录</text>
      </view>
      <view class="tab" :class="{ active: loginType === 'password' }" @tap="loginType = 'password'">
        <text>密码登录</text>
      </view>
    </view>

    <!-- 手机号 -->
    <view class="input-box">
      <input class="input" type="number" maxlength="11" placeholder="请输入手机号" v-model="phone" />
    </view>

    <!-- 验证码 -->
    <view class="input-box row" v-if="loginType === 'phone'">
      <input class="input" type="number" maxlength="6" placeholder="请输入验证码" v-model="code" />
      <view class="code-btn" :class="{ disabled: codeBtnDisabled }" @tap="sendCode">
        <text>{{ codeBtnText }}</text>
      </view>
    </view>

    <!-- 密码 -->
    <view class="input-box" v-if="loginType === 'password'">
      <input class="input" :password="true" placeholder="请输入密码" v-model="password" />
    </view>

    <!-- 登录按钮 -->
    <view class="login-btn" :class="{ loading: isLogging }" @tap="handleLogin">
      <text>{{ isLogging ? '登录中...' : '登录' }}</text>
    </view>

    <!-- 微信登录 -->
    <view class="wechat-login" @tap="handleWechatLogin">
      <text>微信一键登录</text>
    </view>

    <view class="agreement">
      <text>登录即代表同意《用户协议》和《隐私政策》</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { setToken, setUserInfo } from '@/utils/auth'
import { sendSmsCode, loginBySms, loginByPassword, loginByWechat } from '@/api'

const loginType = ref<'phone' | 'password'>('phone')
const phone = ref('')
const code = ref('')
const password = ref('')
const isLogging = ref(false)

const countdown = ref(0)
const codeBtnText = computed(() => (countdown.value > 0 ? `${countdown.value}s` : '获取验证码'))
const codeBtnDisabled = computed(() => countdown.value > 0 || phone.value.length !== 11)

let timer: ReturnType<typeof setInterval> | null = null

async function sendCode() {
  if (codeBtnDisabled.value) return
  try {
    await sendSmsCode(phone.value)
    uni.showToast({ title: '验证码已发送', icon: 'success' })
    countdown.value = 60
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && timer) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)
  } catch (e) {
    // 错误已由 request 统一提示
  }
}

async function handleLogin() {
  if (isLogging.value) return
  if (phone.value.length !== 11) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' })
    return
  }
  isLogging.value = true
  try {
    const res =
      loginType.value === 'phone'
        ? await loginBySms(phone.value, code.value)
        : await loginByPassword(phone.value, password.value)
    setToken(res.token)
    setUserInfo(res.user)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.reLaunch({ url: '/pages/index/index' }), 600)
  } catch (e) {
    // 错误已统一提示
  } finally {
    isLogging.value = false
  }
}

function handleWechatLogin() {
  // #ifdef MP-WEIXIN
  uni.login({
    provider: 'weixin',
    success: async (res) => {
      try {
        const data = await loginByWechat(res.code)
        setToken(data.token)
        setUserInfo(data.user)
        uni.reLaunch({ url: '/pages/index/index' })
      } catch (e) {
        uni.showToast({ title: '微信登录失败', icon: 'none' })
      }
    },
  })
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序中使用', icon: 'none' })
  // #endif
}
</script>

<style lang="scss" scoped>
.container { min-height: 100vh; padding: 0 48rpx; background: #fff; }

.logo-box { padding: 160rpx 0 80rpx; text-align: center; }
.logo-text { font-size: 56rpx; font-weight: 700; color: #007aff; }
.logo-sub { display: block; margin-top: 16rpx; font-size: 26rpx; color: #999; }

.tabs { display: flex; margin-bottom: 48rpx; }
.tab { flex: 1; text-align: center; padding: 20rpx 0; font-size: 30rpx; color: #999; border-bottom: 4rpx solid transparent; }
.tab.active { color: #007aff; font-weight: 600; border-bottom-color: #007aff; }

.input-box {
  display: flex; align-items: center; height: 96rpx; margin-bottom: 32rpx;
  border-bottom: 1rpx solid #eee;
  &.row .input { flex: 1; }
  .input { flex: 1; height: 96rpx; font-size: 30rpx; }
}
.code-btn { padding: 0 20rpx; font-size: 26rpx; color: #007aff; }
.code-btn.disabled { color: #ccc; }

.login-btn {
  height: 96rpx; margin-top: 24rpx; border-radius: 48rpx; background: #007aff;
  display: flex; align-items: center; justify-content: center; color: #fff; font-size: 32rpx;
  &.loading { opacity: 0.6; }
}

.wechat-login { margin-top: 48rpx; text-align: center; font-size: 28rpx; color: #07c160; }

.agreement { margin-top: 60rpx; text-align: center; font-size: 22rpx; color: #999; }
</style>
