import { createSSRApp } from 'vue'
import App from './App.vue'
import pinia from './store'
import * as utils from './utils'
import { styleVariables } from './constants/style'

// 引入全局组件
import Loading from './components/common/Loading.vue'
import FloatBox from '@/components/FloatBox.vue'
import PushNotification from '@/components/PushNotification/index.vue'

// 检查是否已登录，恢复用户状态
function checkLoginStatus(): boolean {
  try {
    const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
    if (!privacyPolicyShown) {
      return false
    }

    const token = uni.getStorageSync('token')
    const userInfo = uni.getStorageSync('userInfo')
    const data = uni.getStorageSync('data')

    if (token && userInfo) {
      return true
    } else if (data && data.thirdPartyAccounts && data.thirdPartyAccounts.accessToken) {
      return true
    }
  } catch (e) {
    console.error('checkLoginStatus error:', e)
  }
  return false
}

export function createApp() {
  const app = createSSRApp(App)

  // 使用 Pinia
  app.use(pinia)

  // 注册全局组件
  app.component('Loading', Loading)
  app.component('FloatBox', FloatBox)
  app.component('PushNotification', PushNotification)

  // 注册全局方法
  for (const key of Object.keys(utils)) {
    app.config.globalProperties[`$${key}`] = (utils as Record<string, unknown>)[key]
  }

  // 注册全局样式变量（替代 Vue2 的 Vue.prototype.$styleVariables）
  app.config.globalProperties.$styleVariables = styleVariables

  // 初始化微信云开发环境
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.init({
      env: 'cloud1-5gszljn762dc4719',
      traceUser: true,
    })
  }
  // #endif

  return {
    app,
  }
}
