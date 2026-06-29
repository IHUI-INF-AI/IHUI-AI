<template>
  <view class="container-ali" @click="handleContainerClick">
    <view class="container1">
      <view class="container-box">
        <!-- 顶部 Logo -->
        <view class="top_box">
          <view class="logobox">
            <image class="logo" src="/static/images/sqlogo.svg" mode="aspectFit" />
          </view>
          <view class="titlebox">
            <image class="titlebox-image" src="https://test.aizhs.top/minio/sys-mini/loginengtext.png" mode=""></image>
            <image class="titlebox-image1" src="https://test.aizhs.top/minio/sys-mini/loginzhtext.png" mode=""></image>
          </view>
        </view>

        <!-- 登录表单 -->
        <view class="center_box">
          <!-- 登录方式切换 -->
          <view class="select-box">
            <view class="login-type-tabs">
              <view class="login-type-tab" :class="{ 'login-type-tab-active': loginType === 'phone' }" @tap.stop="loginType = 'phone'">
                <text>手机号验证码登录</text>
              </view>
              <view class="login-type-tab" :class="{ 'login-type-tab-active': loginType === 'password' }" @tap.stop="loginType = 'password'">
                <text>手机号密码登录</text>
              </view>
            </view>
          </view>

          <!-- 手机号输入 -->
          <view class="input-wbox" v-if="loginType === 'phone'">
            <view :class="['input-nbox', isPhoneFocused ? 'input-nbox-focused' : '']">
              <view class="input-box">
                <view class="input-icon phone">
                  <image class="phoneimg" src="https://test.aizhs.top/minio/sys-mini/phone-fill.png" mode=""></image>
                </view>
                <input class="input iponeinput input-text" type="text" placeholder="手机号码"
                  placeholder-style="color:#6B6980" v-model="phoneNumber"
                  @focusin="isPhoneFocused = true" @focusout="isPhoneFocused = false" />
              </view>
            </view>
          </view>

          <!-- 账号输入（密码登录） -->
          <view class="input-wbox" v-if="loginType === 'password'">
            <view :class="['input-nbox', isAccountFocused ? 'input-nbox-focused' : '']">
              <view class="input-box">
                <view class="input-icon pwd">
                  <image class="accountimg" src="https://test.aizhs.top/minio/sys-mini/account0.png" mode=""></image>
                </view>
                <input class="input iponeinput input-text" type="text" placeholder="手机号码"
                  placeholder-style="color:#6B6980" v-model="accountValue"
                  @focusin="isAccountFocused = true" @focusout="isAccountFocused = false" />
              </view>
            </view>
          </view>

          <!-- 验证码输入 -->
          <view class="input-wbox" v-if="loginType === 'phone'">
            <view :class="['input-nbox', isCodeFocused ? 'input-nbox-focused' : '']">
              <view class="input-box">
                <view class="input-icon code">
                  <image class="codeimg" src="https://test.aizhs.top/minio/sys-mini/code.png" mode=""></image>
                </view>
                <input class="input iponeinput input-text" type="number" maxlength="6" placeholder="验证码"
                  placeholder-style="color:#6B6980" v-model="verificationCode"
                  @focusin="isCodeFocused = true" @focusout="isCodeFocused = false" />
                <view class="send-code-btn" :class="{ 'code-disabled': codeBtnDisabled }" @tap.stop="sendCode">
                  <text>{{ codeBtnText }}</text>
                </view>
              </view>
            </view>
          </view>

          <!-- 密码输入 -->
          <view class="input-wbox" v-if="loginType === 'password'">
            <view :class="['input-nbox', isPasswordFocused ? 'input-nbox-focused' : '']">
              <view class="input-box">
                <view class="input-icon pwd">
                  <image class="pwdimg" src="https://test.aizhs.top/minio/sys-mini/pwd0.png" mode=""></image>
                </view>
                <input class="input iponeinput input-text" :type="showPassword ? 'text' : 'password'" placeholder="密码"
                  placeholder-style="color:#6B6980" v-model="password"
                  @focusin="isPasswordFocused = true" @focusout="isPasswordFocused = false" />
              </view>
            </view>
          </view>

          <!-- 登录按钮 -->
          <view class="login-btn" @tap.stop="handleLogin">
            <text class="login-btn-text">{{ isLogging ? '登录中...' : '登录' }}</text>
          </view>

          <!-- 其他登录方式 -->
          <view class="other-login">
            <view class="wechat-login" @tap="handleWechatLogin">
              <image class="wechat-icon" src="/static/images/wechat.png" mode=""></image>
              <text>微信登录</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useUserStore } from '@/store/modules/user'
import { sendTextMsg, userLogin, pwdLogin } from '@/service/login.js'

const userStore = useUserStore()

// 登录类型
const loginType = ref<'phone' | 'password'>('phone')

// 手机号验证码登录
const phoneNumber = ref('')
const verificationCode = ref('')
const isPhoneFocused = ref(false)
const isCodeFocused = ref(false)

// 密码登录
const accountValue = ref('')
const password = ref('')
const isAccountFocused = ref(false)
const isPasswordFocused = ref(false)
const showPassword = ref(false)

// 验证码按钮状态
const codeBtnText = ref('获取验证码')
const codeBtnDisabled = ref(false)
let codeTimer: ReturnType<typeof setTimeout> | null = null

// 登录状态
const isLogging = ref(false)

// 发送验证码
async function sendCode() {
  if (codeBtnDisabled.value) return
  
  if (!phoneNumber.value) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }

  try {
    const res = await sendTextMsg(phoneNumber.value, 1, '')
    const code = res?.data?.code
    const ok = code === 200 || code === '200' || code === 0
    if (!ok) {
      throw new Error(res?.data?.message || '发送失败')
    }
    uni.showToast({ title: '验证码已发送', icon: 'success' })

    // 倒计时
    codeBtnDisabled.value = true
    let seconds = 60
    codeBtnText.value = `${seconds}s`

    codeTimer = setInterval(() => {
      seconds--
      if (seconds <= 0) {
        clearInterval(codeTimer!)
        codeBtnDisabled.value = false
        codeBtnText.value = '获取验证码'
      } else {
        codeBtnText.value = `${seconds}s`
      }
    }, 1000)
  } catch (error) {
    uni.showToast({ title: error?.message || '发送失败', icon: 'none' })
  }
}

// 登录
async function handleLogin() {
  if (isLogging.value) return
  
  if (loginType.value === 'phone') {
    if (!phoneNumber.value) {
      uni.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!verificationCode.value) {
      uni.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
  } else {
    if (!accountValue.value) {
      uni.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!password.value) {
      uni.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
  }

  isLogging.value = true
  
  try {
    let res
    if (loginType.value === 'phone') {
      res = await userLogin(phoneNumber.value, '', verificationCode.value)
    } else {
      res = await pwdLogin(accountValue.value, password.value)
    }
    const code = res?.data?.code
    const ok = code === 200 || code === '200' || code === 0
    if (!ok) {
      throw new Error(res?.data?.message || '登录失败')
    }
    // 保存登录信息
    const loginData = res?.data?.data || {}
    uni.setStorageSync('data', loginData)
    if (loginData.thirdPartyAccounts?.accessToken) {
      uni.setStorageSync('token', loginData.thirdPartyAccounts.accessToken)
    }
    uni.showToast({ title: '登录成功', icon: 'success' })

    // 跳转到主页
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/table/aiIndex/ai_index' })
    }, 1500)
  } catch (error) {
    uni.showToast({ title: error?.message || '登录失败', icon: 'none' })
  } finally {
    isLogging.value = false
  }
}

// 微信登录
async function handleWechatLogin() {
  try {
    const loginRes = await uni.login({ provider: 'weixin' })
    if (loginRes.code) {
      // TODO: 调用微信登录 API
      uni.showToast({ title: '微信登录成功', icon: 'success' })
    }
  } catch (error) {
    uni.showToast({ title: '微信登录失败', icon: 'none' })
  }
}

function handleContainerClick() {
  // 点击容器
}
</script>

<style lang="scss" scoped>
.container-ali {
  min-height: 100vh;
  background: #fff;
}

.container1 {
  padding: 0 40rpx;
}

.top_box {
  padding-top: 150rpx;
  text-align: center;
}

.logobox {
  margin-bottom: 30rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
}

.titlebox {
  margin-bottom: 60rpx;
}

.titlebox-image {
  width: 310rpx;
  height: 37rpx;
  display: block;
  margin: 0 auto 10rpx;
}

.titlebox-image1 {
  width: 312rpx;
  height: 66rpx;
  display: block;
  margin: 0 auto;
}

.login-type-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 40rpx;
}

.login-type-tab {
  padding: 16rpx 30rpx;
  font-size: 28rpx;
  color: #666;
  border-bottom: 4rpx solid transparent;
  
  &.login-type-tab-active {
    color: #000;
    font-weight: bold;
    border-bottom-color: #000;
  }
}

.input-wbox {
  margin-bottom: 24rpx;
}

.input-nbox {
  border: 2rpx solid #e5e5e5;
  border-radius: 16rpx;
  padding: 20rpx;
  transition: all 0.3s;
  
  &.input-nbox-focused {
    border-color: #000;
  }
}

.input-box {
  display: flex;
  align-items: center;
}

.input-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 16rpx;
  
  image {
    width: 100%;
    height: 100%;
  }
}

.input {
  flex: 1;
  height: 60rpx;
  font-size: 32rpx;
}

.send-code-btn {
  padding: 10rpx 20rpx;
  background: #f5f5f5;
  border-radius: 8rpx;
  font-size: 24rpx;
  color: #333;
  
  &.code-disabled {
    color: #999;
  }
}

.login-btn {
  margin-top: 40rpx;
  padding: 24rpx;
  background: #000;
  border-radius: 12rpx;
  text-align: center;
}

.login-btn-text {
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
}

.other-login {
  margin-top: 60rpx;
  text-align: center;
}

.wechat-login {
  display: inline-flex;
  align-items: center;
  padding: 20rpx 40rpx;
  background: #07c160;
  border-radius: 12rpx;
  color: #fff;
  font-size: 28rpx;
  
  .wechat-icon {
    width: 40rpx;
    height: 40rpx;
    margin-right: 10rpx;
  }
}
</style>
