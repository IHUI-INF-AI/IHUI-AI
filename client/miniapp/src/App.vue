<template>
  <view class="app-root">
    <slot />

    <!-- 隐私政策弹窗 -->
    <view class="privacy-modal" v-if="showPrivacyPolicy" :style="{ zIndex: 99999 }">
      <view class="privacy-mask" @click.stop="preventClose"></view>
      <view class="privacy-content">
        <view class="privacy-title">隐私政策</view>
        <scroll-view class="privacy-text" scroll-y>
          <text>欢迎使用由 吉林省爱智汇人工智能科技有限公司开发和运营的软件产品。我们非常重视用户个人信息的保护。请您在使用本软件前，仔细阅读并理解本政策的全部内容。</text>
        </scroll-view>
        <view class="privacy-buttons">
          <view class="privacy-btn disagree" @click="onPrivacyDisagreed">不同意</view>
          <view class="privacy-btn agree" @click="onPrivacyAccepted">同意</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()

// 全局状态
const appState = reactive({
  floatboxVisible: true,
  showPrivacyPolicy: false,
})

// 隐私政策相关
const privacyPolicyAccepted = ref(false)
const showPrivacyPolicy = ref(false)
const sdkInitialized = ref(false)

// 全局数据
const globalData = reactive({
  userInfo: null as any,
  cloudConnected: false,
  inviteCode: '',
  isLoggedIn: false,
})

// 应用生命周期
onLaunch(() => {
  console.log('App启动')

  // 检查隐私政策
  const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
  privacyPolicyAccepted.value = privacyPolicyShown === true

  if (!privacyPolicyAccepted.value) {
    showPrivacyPolicy.value = true
  } else {
    initializeApp()
  }

  // 监听隐私政策同意事件
  uni.$on('privacyAccepted', () => {
    onPrivacyAccepted()
  })
})

onShow(() => {
  console.log('App onShow')
})

onHide(() => {
  console.log('App onHide')
})

// 初始化应用
function initializeApp() {
  if (sdkInitialized.value) {
    return
  }

  console.log('开始初始化应用')

  // 检查登录状态
  const userData = uni.getStorageSync('data')
  if (userData && userData.uuid) {
    globalData.isLoggedIn = true
    // 跳转到主页
    uni.reLaunch({
      url: '/pages/table/aiIndex/ai_index',
    })
  } else {
    // 跳转到登录页
    uni.reLaunch({
      url: '/pages/login-app/login',
    })
  }

  sdkInitialized.value = true
}

// 用户同意隐私政策
function onPrivacyAccepted() {
  console.log('用户同意隐私政策')
  privacyPolicyAccepted.value = true
  showPrivacyPolicy.value = false
  uni.setStorageSync('privacyPolicyShown', true)
  initializeApp()
}

// 用户不同意隐私政策
function onPrivacyDisagreed() {
  uni.showModal({
    title: '提示',
    content: '您需要同意隐私政策才能使用本应用',
    showCancel: true,
    cancelText: '退出',
    confirmText: '重新阅读',
    success: (res) => {
      if (res.cancel) {
        // #ifdef APP-PLUS
        plus.runtime.quit()
        // #endif
        // #ifndef APP-PLUS
        uni.exitMiniProgram()
        // #endif
      }
    },
  })
}

function preventClose() {
  // 阻止关闭隐私政策弹窗
}
</script>

<style lang="scss">
/* 全局样式 */
page {
  background-color: #f5f5f5;
}

/* 隐私政策弹窗样式 */
.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.privacy-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.privacy-content {
  position: relative;
  width: 80%;
  max-height: 80vh;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  z-index: 1;
}

.privacy-title {
  font-size: 36rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 30rpx;
}

.privacy-text {
  height: 50vh;
  margin-bottom: 30rpx;
}

.privacy-buttons {
  display: flex;
  justify-content: space-between;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 10rpx;
  font-size: 30rpx;

  &.disagree {
    background: #f5f5f5;
    color: #666;
    margin-right: 20rpx;
  }

  &.agree {
    background: #007aff;
    color: #fff;
  }
}
</style>
