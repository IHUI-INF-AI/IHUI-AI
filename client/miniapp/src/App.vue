<template>
  <view class="app-root">
    <slot />

    <!-- 全局弹窗浮动按钮 -->
    <view
      class="global-floatbox"
      :class="{ 'floatbox-enter': appState.floatboxVisible, 'floatbox-leave': !appState.floatboxVisible }"
      @mouseenter="onFloatboxEnter"
      @mouseleave="onFloatboxLeave"
    >
      <view class="floatbox-item" @click="onPromote">
        <text class="iconfont icon-tui"></text>
        <text class="floatbox-label">推广</text>
      </view>
      <view class="floatbox-item" @click="onConsult">
        <text class="iconfont icon-zixun"></text>
        <text class="floatbox-label">咨询</text>
      </view>
      <view class="floatbox-item" @click="onMore">
        <text class="iconfont icon-more"></text>
        <text class="floatbox-label">更多</text>
      </view>
      <view class="floatbox-arrow" @click="toggleFloatbox">
        <text :class="appState.floatboxVisible ? 'arrow-hide' : 'arrow-show'"></text>
      </view>
    </view>

    <!-- 系统公告 -->
    <view class="global-notice">
      系统公告：欢迎使用我们的服务
    </view>

    <!-- 推送通知弹窗 -->
    <PushNotification
      v-if="pushNotificationVisible"
      :title="pushNotificationTitle"
      :content="pushNotificationContent"
      :time="pushNotificationTime"
      @click="handlePushNotificationClick"
      @close="closePushNotification"
    />

    <!-- 隐私政策弹窗 -->
    <view class="privacy-modal" v-if="showPrivacyPolicy" :style="{ zIndex: 99999 }">
      <view class="privacy-mask" @click.stop="preventClose"></view>
      <view class="privacy-content">
        <view class="privacy-title">隐私政策</view>
        <scroll-view class="privacy-text" scroll-y>
          <text>欢迎使用由 吉林省爱智汇人工智能科技有限公司（以下简称 "我们"）开发和运营的软件产品（包括但不限于 APP、小程序、web 应用，以下统称 "本软件"）。我们非常重视用户个人信息的保护，致力于维护您的隐私安全。本《隐私政策》（以下简称 "本政策"）旨在向您说明我们在收集、使用、存储、共享、转让、公开披露您个人信息时的规则和方法。请您在使用本软件前，仔细阅读并理解本政策的全部内容。如您使用本软件，即表示您已充分理解并同意我们按照本政策处理您的个人信息。</text>
          <text>一、我们收集的个人信息</text>
          <text>我们仅收集为提供本软件功能和服务所必要的个人信息，具体包括以下类型：</text>
          <text>1. 基本信息：当您注册、登录本软件时，我们可能收集您的手机号码、电子邮箱地址、用户名、密码等用于身份识别和账号管理的信息。</text>
          <text>2. 设备标识信息：为了保障服务的安全性和稳定性，我们会在您同意本隐私政策后，通过集成的第三方SDK收集以下设备标识信息：</text>
          <text>（1）IMEI（国际移动设备识别码）：收集目的：用于设备识别、推送消息服务、安全防护和统计分析；收集方式：通过个推公共库SDK（Gtc）和DCloud开发通用工具库自动收集；收集范围：仅用于设备识别、推送服务和安全保障，不会与您的个人身份信息关联，不会用于广告追踪。</text>
          <text>（2）IMSI（国际移动用户识别码）：收集目的：用于设备识别、推送消息服务和安全防护；收集方式：通过个推公共库SDK（Gtc）自动收集；收集范围：仅用于设备识别和安全保障，不会与您的个人身份信息关联，不会用于其他目的。</text>
          <text>（3）OAID（开放匿名设备标识符）：收集目的：用于推送消息服务、统计分析、反作弊；收集方式：通过DCloud开发通用工具库和个推公共库SDK自动收集；收集范围：仅用于推送服务、数据统计和安全保障，不会与您的个人身份信息关联。</text>
          <text>（4）Android ID（安卓设备标识符）：收集目的：用于设备识别、推送消息服务、统计分析；收集方式：通过个推公共库SDK（Gtc）自动收集；收集范围：仅用于设备识别和推送服务，不会用于其他目的。</text>
          <text>（5）GAID（Google广告标识符）：收集目的：用于推送消息服务、统计分析；收集方式：通过个推公共库SDK（Gtc）自动收集；收集范围：仅用于推送服务和数据统计，不会用于广告追踪。</text>
          <text>（6）MAC地址（媒体访问控制地址）：收集目的：用于保障网络连接的稳定性和安全性；收集方式：通过个推公共库SDK（Gtc）自动收集；收集范围：仅用于网络连接和安全保障，不会与您的个人身份信息关联。</text>
          <text>（7）IP地址：收集目的：用于网络连接、服务请求、安全防护和统计分析；收集方式：通过OkHttp框架和DCloud开发通用工具库在网络请求时自动收集；收集范围：仅用于网络通信、服务提供和安全防护，不会用于精确定位。</text>
          <text>（8）应用列表：收集目的：用于安全防护、反作弊和统计分析；收集方式：通过个推公共库SDK（Gtc）和DCloud开发通用工具库自动收集；收集范围：仅用于安全防护和反作弊检测，不会用于其他目的，不会与您的个人身份信息关联。</text>
          <text>3. 使用信息：在您使用本软件过程中，我们会自动收集相关使用信息，例如设备信息（包括设备型号、操作系统版本、设备标识符等）、软件版本号、登录时间、使用时长、操作记录、点击行为、浏览记录等，用于优化软件性能、提升用户体验和保障软件安全。</text>
          <text>4. 位置信息：若您使用与位置相关的功能（如定位导航、基于位置的推荐服务等），我们会在获得您明确授权后，收集您的位置信息（包括精确位置和大致位置）。您可以随时在设备设置中关闭位置权限以停止我们收集位置信息，但这可能导致部分功能无法正常使用。</text>
          <text>5. 其他信息：根据具体业务场景，我们还可能收集您主动提供的其他信息，如在参与活动、反馈意见时提供的姓名、联系方式、照片、视频等信息；或从第三方合作伙伴处合法获取的您的相关信息（在获取前会向您告知并征得您同意）。</text>
          <text>重要提示：上述设备标识信息（IMEI、IMSI、OAID、Android ID、GAID、MAC地址、IP地址、应用列表）的收集将在您点击"同意"本隐私政策后才会开始。如果您不同意本隐私政策，我们将不会收集上述信息，APP及SDK不会提前收集和使用这些信息，但可能影响部分功能的正常使用。</text>
          <text>二、个人信息的使用</text>
          <text>我们仅会将收集的个人信息用于以下目的：</text>
          <text>1. 提供和维护软件服务：用于身份验证、账号管理、交易处理、订单跟踪等，以保障您正常使用本软件的各项功能。</text>
          <text>2. 推送消息服务：使用OAID、Android ID、GAID等设备标识信息，通过个推公共库SDK向您推送重要通知和消息。</text>
          <text>3. 网络通信和安全：使用IP地址、MAC地址等信息，保障网络连接的稳定性和安全性，防止网络攻击和欺诈行为。</text>
          <text>4. 数据统计分析：使用设备标识信息进行匿名化的数据统计和分析，用于优化产品功能和服务质量。</text>
          <text>5. 个性化服务：根据您的使用习惯、偏好和历史行为，为您提供个性化的内容推荐、广告展示和功能优化建议。</text>
          <text>6. 安全保障：用于检测、预防、调查欺诈、滥用、安全风险和技术问题，以保护您、其他用户和我们的合法权益。</text>
          <text>7. 客户服务：用于响应您的咨询、投诉、建议，提供技术支持和服务改进。</text>
          <text>8. 在获得您明确同意的情况下，将您的个人信息用于其他目的。</text>
          <text>三、个人信息的共享、转让和公开披露</text>
          <text>1. 共享：我们不会与任何公司、组织和个人共享您的个人信息，除非：</text>
          <text>（1）获得您的明确同意；</text>
          <text>（2）法律法规规定；</text>
          <text>（3）与我们的关联公司共享（我们仅会共享必要的个人信息，且受本政策约束）；</text>
          <text>（4）与授权合作伙伴共享（我们仅会共享提供服务所必要的信息，且合作伙伴无权将共享的个人信息用于任何其他用途）。</text>
          <text>2. 转让：我们不会将您的个人信息转让给第三方，除非获得您的明确同意，或根据法律法规要求。</text>
          <text>3. 公开披露：我们不会公开披露您的个人信息，除非获得您的明确同意，或根据法律法规要求。</text>
          <text>四、个人信息的安全保护</text>
          <text>我们采用行业标准的安全技术和措施，保护您的个人信息免受未经授权的访问、使用、披露、修改、损坏或丢失。我们会采取合理可行的措施，尽力避免收集无关的个人信息。</text>
          <text>五、您的权利</text>
          <text>您有权访问、更正、删除您的个人信息，以及撤回同意、注销账号等。您可以通过本软件内的设置功能或联系我们行使上述权利。</text>
          <text>六、第三方SDK收集使用规则</text>
          <text>为了向您提供更好的服务，我们集成了以下第三方SDK，这些SDK可能会收集您的设备信息。我们已要求第三方SDK严格遵守本隐私政策，仅在您同意本隐私政策后才进行信息收集：</text>
          <text>1. 个推公共库SDK（Gtc）：收集目的：用于推送消息服务、设备识别和安全防护；收集方式：自动收集IMEI、IMSI、Android ID、GAID、MAC地址、OAID、应用列表；收集范围：仅用于推送服务、设备识别和安全防护，不会用于广告追踪或其他商业目的；隐私政策：https://docs.getui.com/privacy</text>
          <text>2. DCloud开发通用工具库：收集目的：用于应用基础功能和服务、设备识别；收集方式：自动收集IMEI、OAID、IP地址、应用列表；收集范围：仅用于应用功能实现、网络通信和设备识别，不会用于其他目的；隐私政策：https://www.dcloud.io/privacy.html</text>
          <text>3. OkHttp框架：收集目的：用于网络请求和通信；收集方式：在网络请求时自动收集IP地址；收集范围：仅用于网络通信和服务请求，不会用于其他目的；隐私政策：https://square.github.io/okhttp/</text>
          <text>重要提示：上述第三方SDK的初始化将在您点击"同意"本隐私政策后才会执行。在您授权同意隐私政策前，APP及SDK不会提前收集和使用IMEI、OAID、IMSI、MAC、应用列表等信息。如果您不同意本隐私政策，我们将不会初始化这些SDK，也不会收集相关信息。</text>
          <text>七、隐私政策的更新</text>
          <text>我们可能会适时更新本政策。更新后的政策将在本软件内发布，并在发布时通过适当方式通知您。如您继续使用本软件，即表示您同意接受更新后的政策。</text>
          <text>八、联系我们</text>
          <text>如果您对本政策或我们处理您个人信息的行为有任何疑问、意见或建议，或需要行使您的个人信息权利（包括访问、更正、删除、撤回同意、注销账号等），您可以通过以下方式联系我们：</text>
          <text>1. 客服邮箱：502319984@qq.com</text>
          <text>2. 客服电话：19944894487</text>
          <text>3. 在线客服：您可以通过本软件内的在线客服功能与我们联系（包含二维码联系）</text>
          <text>4. 公司地址：吉林省长春市高新区益田硅谷公馆二期(益田罗堤悦府)B9栋1801室</text>
          <text>我们将在收到您的反馈后7个工作日内予以回复，并尽力解决您的问题。</text>
          <text>九、未成年人保护</text>
          <text>我们非常重视未成年人个人信息的保护。如果您是未成年人，请在监护人指导下使用本软件。如果您是未成年人的监护人，请您关注未成年人的个人信息使用情况，并有权要求我们更正、删除未成年人的个人信息。</text>
          <text>十、其他说明</text>
          <text>本隐私政策的生效日期：2025年06月20日</text>
          <text>本隐私政策的更新日期：2025年06月20日</text>
          <text>吉林省爱智汇人工智能科技有限公司</text>
        </scroll-view>
        <view class="privacy-buttons">
          <view class="privacy-btn disagree" @click="onPrivacyDisagreed" role="button">不同意</view>
          <view class="privacy-btn agree" @click="onPrivacyAccepted" role="button">同意</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { onLaunch, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/modules/user'
import { shareConfig } from '@/utils/shareConfig.js'
import { initPush, savePushClientIdToServer, createPushMessage } from '@/utils/push.js'
import websocketManager from '@/utils/websocket.js'
import { baseUrl3 } from '@/utils/service/index.js'
import PushNotification from '@/components/PushNotification/index.vue'

const userStore = useUserStore()

// 全局状态
const appState = reactive({
  floatboxVisible: true,
  floatboxTimer: null as any,
})

// 隐私政策相关
const privacyPolicyAccepted = ref(false)
const showPrivacyPolicy = ref(false)
const sdkInitialized = ref(false)

// 推送通知相关
const pushNotificationVisible = ref(false)
const pushNotificationTitle = ref('新消息')
const pushNotificationContent = ref('您收到一条新消息')
const pushNotificationTime = ref('')
const pushNotificationCallback = ref<(() => void) | null>(null)
const pushNotificationTimer = ref<any>(null)

// 全局数据
const globalData = reactive({
  userInfo: null as any,
  cloudConnected: false,
  inviteCode: '',
  isLoggedIn: false,
  pushClientId: null as any,
  selectedFont: null as any,
  currentFontFamily: 'AlimamaFangYuanTi',
})

// 应用生命周期
onLaunch(() => {
  console.log('App启动')

  // 首先检查隐私政策是否已同意
  const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
  privacyPolicyAccepted.value = privacyPolicyShown === true

  if (!privacyPolicyAccepted.value) {
    console.log('用户未同意隐私政策，显示隐私政策弹窗')
    showPrivacyPolicy.value = true
  } else {
    console.log('用户已同意隐私政策，可以初始化SDK')
    initializeApp()
  }

  // 监听隐私政策同意事件
  uni.$on('privacyAccepted', () => {
    console.log('收到隐私政策同意事件，开始初始化SDK')
    onPrivacyAccepted()
  })

  // 监听全局字体更新事件
  uni.$on('globalFontUpdated', (fontFamily: string) => {
    applyFontFamily(fontFamily)
  })

  // 监听登录成功事件，保存 pushClientId 并连接 WebSocket
  uni.$on('loginSuccess', (userData: any) => {
    console.log('监听到登录成功事件，准备保存 pushClientId 并连接 WebSocket')
    if (!privacyPolicyAccepted.value) {
      console.log('用户未同意隐私政策，暂不保存pushClientId')
      return
    }
    const pushClientId = globalData.pushClientId || uni.getStorageSync('pushClientId')
    if (pushClientId && userData && userData.uuid) {
      savePushClientId(pushClientId, userData.uuid)
    }
    if (userData && userData.uuid) {
      connectWebSocket(userData.uuid)
    }
  })

  // 处理从分享链接打开APP的情况（仅在用户同意隐私政策后执行）
  if (privacyPolicyAccepted.value) {
    handleSchemeUrl()
  }

  globalData.cloudConnected = false
  if (privacyPolicyAccepted.value) {
    setDynamicTabBarIcons()
  }

  // 检查更新
  if (uni.canIUse('getUpdateManager')) {
    const updateManager = uni.getUpdateManager()
    updateManager.onCheckForUpdate((res: any) => {
      if (res.hasUpdate) {
        updateManager.onUpdateReady(() => {
          uni.showModal({
            title: '更新提示',
            content: '新版本已经准备好，是否重启应用？',
            success: (res: any) => {
              if (res.confirm) {
                updateManager.applyUpdate()
              }
            },
          })
        })
      }
    })
  }

  globalData.isOfflineMode = false
})

onShow(() => {
  console.log('App onShow')
  appState.floatboxVisible = true

  // 微信小程序更新检查
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && wx.getUpdateManager) {
    const updateManager = wx.getUpdateManager()
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success: (res: any) => {
          if (res.confirm) {
            wx.clearStorageSync()
            wx.clearStorage()
            wx.removeStorageSync('userInfo')
            wx.removeStorageSync('token')
            wx.removeStorageSync('settings')
            updateManager.applyUpdate()
          }
        },
      })
    })
  }
  // #endif
})

onHide(() => {
  appState.floatboxVisible = false
})

onUnload(() => {
  // 应用卸载时关闭 WebSocket 连接
  disconnectWebSocket()
})

onMounted(() => {
  uni.setStorageSync('currentIndexActive', false)
  uni.setStorageSync('currentIndexaActive', false)
})

onUnmounted(() => {
  // 清理定时器
  if (appState.floatboxTimer) {
    clearTimeout(appState.floatboxTimer)
  }
  if (pushNotificationTimer.value) {
    clearTimeout(pushNotificationTimer.value)
  }
})

// 初始化应用（在用户同意隐私政策后调用）
function initializeApp() {
  if (sdkInitialized.value) {
    console.log('SDK已初始化，跳过')
    return
  }

  console.log('开始初始化应用和SDK')

  // 再次确认用户已同意隐私政策（三重检查）
  const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
  if (!privacyPolicyShown) {
    console.warn('⚠️ 用户未同意隐私政策，停止初始化应用')
    return
  }

  // 检查本地存储的登录状态
  const userData = uni.getStorageSync('data')
  console.log('本地登录状态检查:', userData ? (userData.uuid ? '已登录' : '未登录') : '无数据')

  if (userData && userData.uuid) {
    console.log('本地已登录，跳转到ai_index页面')
    uni.reLaunch({
      url: '/pages/table/aiIndex/ai_index',
      success: () => {
        console.log('跳转到ai_index页面成功')
      },
      fail: (err: any) => {
        console.error('跳转到ai_index页面失败:', err)
      },
    })
    // 异步进行服务器验证
    verifyLoginStatus()
  } else {
    console.log('本地未登录，跳转到登录页面')
    uni.reLaunch({
      url: '/pages/login-app/login',
      success: () => {
        console.log('跳转到登录页面成功')
      },
      fail: (err: any) => {
        console.error('跳转到登录页面失败:', err)
      },
    })
  }

  // 初始化推送功能（可能收集设备信息，必须在用户同意后执行）
  initPushService()

  // 设置TabBar图标（调用uniCloud，可能触发网络请求，必须在用户同意后执行）
  setDynamicTabBarIcons()

  // 处理从分享链接打开APP的情况
  handleSchemeUrl()

  // 如果已登录，连接 WebSocket
  if (userData && userData.uuid) {
    connectWebSocket(userData.uuid)
  }

  sdkInitialized.value = true
}

// 用户同意隐私政策后的回调
function onPrivacyAccepted() {
  console.log('用户同意隐私政策，开始初始化SDK')
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
    success: (res: any) => {
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

// 服务器验证登录状态
function verifyLoginStatus() {
  console.log('开始服务器验证登录状态')
  uni.login({
    provider: 'weixin',
    success: (res: any) => {
      if (res.code) {
        // 这里调用 openId 接口验证登录状态
        // 由于 openId 在 service/login.js 中，这里通过事件触发
        uni.$emit('verifyLogin', res.code)
      }
    },
    fail: (err: any) => {
      console.log('微信登录失败:', err)
    },
  })
}

// 处理从分享链接打开APP的情况
function handleSchemeUrl() {
  // #ifdef APP-PLUS
  const args = plus.runtime.argument
  console.log('APP启动参数:', args)

  if (args && args.includes('aizhs://')) {
    try {
      const url = new URL(args)
      const inviteCode = url.searchParams.get('inviteCode')

      if (inviteCode) {
        console.log('检测到邀请码:', inviteCode)
        uni.setStorageSync('inviteCode', inviteCode)

        const userData = uni.getStorageSync('data')
        if (userData && userData.uuid) {
          uni.reLaunch({
            url: `/pages/table/aiIndex/ai_index?inviteCode=${inviteCode}`,
          })
        } else {
          uni.reLaunch({
            url: '/pages/login-app/login',
          })
        }
      }
    } catch (error) {
      console.error('解析URL Scheme失败:', error)
    }
  }
  // #endif
}

// 浮动按钮相关方法
function onFloatboxEnter() {
  if (appState.floatboxTimer) {
    clearTimeout(appState.floatboxTimer)
  }
  appState.floatboxVisible = true
}

function onFloatboxLeave() {
  appState.floatboxTimer = setTimeout(() => {
    appState.floatboxVisible = false
  }, 800)
}

function toggleFloatbox() {
  appState.floatboxVisible = !appState.floatboxVisible
}

function onPromote() {
  // 推广逻辑
  console.log('点击推广')
}

function onConsult() {
  // 咨询逻辑
  console.log('点击咨询')
}

function onMore() {
  // 更多逻辑
  console.log('点击更多')
}

// 应用字体
function applyFontFamily(fontFamily: string) {
  globalData.currentFontFamily = fontFamily
  globalData.selectedFont = fontFamily
  console.log('应用字体:', fontFamily)
}

// 初始化推送服务
async function initPushService() {
  // #ifdef APP-PLUS
  try {
    const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
    if (!privacyPolicyShown) {
      console.warn('⚠️ 用户未同意隐私政策，跳过推送服务初始化（避免读取OAID等设备信息）')
      return
    }

    console.log('开始初始化推送服务...')

    const pushClientId = await initPush({
      onMessage: (res: any) => {
        console.log('收到推送消息:', res)
        if (res.type === 'click') {
          console.log('用户点击了推送消息:', res.data)
          handlePushMessageClick(res.data)
        }
        if (res.type === 'receive') {
          console.log('接收到推送消息:', res.data)
          showPushNotificationFromData(res.data)
        }
      },
      onClientId: (cid: string) => {
        if (cid) {
          console.log('获取到推送客户端ID:', cid)
          globalData.pushClientId = cid
          const userData = uni.getStorageSync('data')
          if (userData && userData.uuid) {
            savePushClientId(cid, userData.uuid)
          }
        } else {
          console.warn('uni-push 未启用，推送功能将不可用')
        }
      },
    })

    if (pushClientId) {
      console.log('推送服务初始化成功，ClientId:', pushClientId)
    } else {
      console.warn('推送服务未启用，将使用 WebSocket 进行消息推送')
    }
  } catch (error) {
    console.error('推送服务初始化失败:', error)
    console.warn('推送初始化失败不影响应用正常使用，将使用 WebSocket 进行消息推送')
  }
  // #endif
}

// 保存推送客户端ID到服务器
async function savePushClientId(pushClientId: string, userId: string) {
  if (!pushClientId) {
    console.warn('pushClientId 为空，跳过保存')
    return
  }
  try {
    await savePushClientIdToServer(pushClientId, userId)
    console.log('推送客户端ID已保存到服务器')
  } catch (error) {
    console.error('保存推送客户端ID失败:', error)
  }
}

// 处理推送消息点击事件
function handlePushMessageClick(data: any) {
  try {
    let messageData = data
    if (typeof data === 'string') {
      try {
        messageData = JSON.parse(data)
      } catch (e) {
        messageData = { content: data }
      }
    }

    if (messageData.type) {
      switch (messageData.type) {
        case 'page':
          if (messageData.url) {
            uni.navigateTo({
              url: messageData.url,
              fail: () => {
                uni.reLaunch({ url: messageData.url })
              },
            })
          }
          break
        case 'url':
          if (messageData.url) {
            // #ifdef APP-PLUS
            plus.runtime.openURL(messageData.url)
            // #endif
          }
          break
        default:
          console.log('未知的推送消息类型:', messageData.type)
      }
    } else if (messageData.url) {
      uni.navigateTo({
        url: messageData.url,
        fail: () => {
          uni.reLaunch({ url: messageData.url })
        },
      })
    }
  } catch (error) {
    console.error('处理推送消息点击失败:', error)
  }
}

// 连接 WebSocket
function connectWebSocket(userUuid: string) {
  if (!userUuid) {
    console.warn('无法连接 WebSocket：缺少用户UUID')
    return
  }

  if (websocketManager.isConnected()) {
    console.log('WebSocket 已连接，先关闭旧连接')
    websocketManager.close()
  }

  let wsBaseUrl: string
  try {
    const stored = uni.getStorageSync('API_WS_BASE_URL')
    if (stored && typeof stored === 'string' && stored.trim()) {
      wsBaseUrl = stored.trim().replace(/\/$/, '')
    } else if (/^https?:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.test(baseUrl3 || '')) {
      wsBaseUrl = 'wss://zca.aizhs.top'
    } else {
      wsBaseUrl = (baseUrl3 || '').replace('https://', 'wss://').replace('http://', 'ws://')
    }
  } catch (e) {
    wsBaseUrl = (baseUrl3 || '').replace('https://', 'wss://').replace('http://', 'ws://')
  }
  const wsUrl = `${wsBaseUrl || 'wss://zca.aizhs.top'}/cozeZhsApi/chat-room/ws`

  console.log('准备连接 WebSocket:', wsUrl)
  console.log('用户UUID:', userUuid)

  websocketManager.connect(wsUrl, userUuid, {
    onOpen: () => {
      console.log('WebSocket 连接成功')
    },
    onMessage: (message: any) => {
      console.log('收到 WebSocket 消息:', message)
      handleWebSocketMessage(message)
    },
    onError: (error: any) => {
      console.error('WebSocket 连接错误:', error)
    },
    onClose: (res: any) => {
      console.log('WebSocket 连接关闭:', res)
    },
  })
}

// 断开 WebSocket 连接
function disconnectWebSocket() {
  console.log('断开 WebSocket 连接')
  websocketManager.close()
}

// 处理 WebSocket 消息
function handleWebSocketMessage(message: any) {
  try {
    console.log('=== handleWebSocketMessage 开始处理消息 ===')

    // 处理房间消息
    if (message && message.event === 'room_message') {
      console.log('✅ 确认为房间消息，开始处理')
      createPushNotificationFromMessage(message)
    } else {
      console.log('⚠️ 不是房间消息，消息类型:', message?.event || '未知')
    }
    console.log('=== handleWebSocketMessage 处理完成 ===')
  } catch (error) {
    console.error('❌ 处理 WebSocket 消息失败:', error)
  }
}

// 从推送数据中显示弹窗通知
function showPushNotificationFromData(data: any) {
  try {
    let messageData = data
    if (typeof data === 'string') {
      try {
        messageData = JSON.parse(data)
      } catch (e) {
        messageData = { content: data }
      }
    }

    const title = messageData.title || '新消息'
    const content = messageData.content || messageData.body || '您收到一条新消息'

    uni.$emit('showPushNotification', {
      title: title,
      content: content,
      timestamp: messageData.timestamp || Date.now(),
      duration: 5000,
      onClick: () => {
        if (messageData.type === 'page' && messageData.url) {
          uni.navigateTo({
            url: messageData.url,
            fail: () => {
              uni.reLaunch({ url: messageData.url })
            },
          })
        } else if (messageData.type === 'url' && messageData.url) {
          // #ifdef APP-PLUS
          plus.runtime.openURL(messageData.url)
          // #endif
        }
      },
    })
  } catch (error) {
    console.error('显示推送弹窗失败:', error)
  }
}

// 根据 WebSocket 消息创建推送通知
function createPushNotificationFromMessage(message: any) {
  try {
    const title = '新消息'
    const content = message.content || '您收到一条新消息'

    showPushNotification({
      title: title,
      content: content,
      timestamp: message.timestamp ? new Date(message.timestamp).getTime() : Date.now(),
      duration: 5000,
      onClick: () => {
        uni.navigateTo({
          url: '/pagesA/message/index',
          fail: () => {
            uni.reLaunch({ url: '/pagesA/message/index' })
          },
        })
      },
    })
  } catch (error) {
    console.error('创建推送通知失败:', error)
  }
}

// 显示推送通知弹窗
function showPushNotification(options: any = {}) {
  console.log('显示推送通知弹窗:', options)
  pushNotificationTitle.value = options.title || '新消息'
  pushNotificationContent.value = options.content || '您收到一条新消息'
  pushNotificationTime.value = formatPushTime(options.timestamp || Date.now())
  pushNotificationCallback.value = options.onClick || null

  if (pushNotificationTimer.value) {
    clearTimeout(pushNotificationTimer.value)
    pushNotificationTimer.value = null
  }

  pushNotificationVisible.value = true
  console.log('pushNotificationVisible 已设置为:', pushNotificationVisible.value)

  const duration = options.duration || 5000
  if (duration > 0) {
    pushNotificationTimer.value = setTimeout(() => {
      closePushNotification()
    }, duration)
  }
}

// 关闭推送通知弹窗
function closePushNotification() {
  pushNotificationVisible.value = false
  if (pushNotificationTimer.value) {
    clearTimeout(pushNotificationTimer.value)
    pushNotificationTimer.value = null
  }
}

// 处理推送通知点击
function handlePushNotificationClick() {
  if (pushNotificationCallback.value && typeof pushNotificationCallback.value === 'function') {
    pushNotificationCallback.value()
  }
  closePushNotification()
}

// 格式化推送时间
function formatPushTime(timestamp: number) {
  if (!timestamp) return ''
  const now = new Date()
  const time = new Date(timestamp)
  const diff = now.getTime() - time.getTime()

  if (diff < 60000) {
    return '刚刚'
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`
  } else {
    const month = time.getMonth() + 1
    const day = time.getDate()
    const hour = time.getHours()
    const minute = time.getMinutes()
    return `${month}-${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }
}

// 动态设置TabBar图标
async function setDynamicTabBarIcons() {
  try {
    // #ifdef UNI_CLOUD
    if (typeof uniCloud === 'undefined') return

    const iconRes = await uniCloud.callFunction({
      name: 'common',
      data: { action: 'getTabBarIcons' },
    })

    if (iconRes.result.code !== 0 || !iconRes.result.data) {
      return
    }

    const icons = iconRes.result.data
    const fileIDs = [
      icons.home,
      icons.homeActive,
      icons.chat,
      icons.chatActive,
      icons.member,
      icons.memberActive,
      icons.settings,
      icons.settingsActive,
    ]

    const urlRes = await uniCloud.getTempFileURL({
      fileList: fileIDs,
    })

    if (urlRes.fileList && urlRes.fileList.length > 0) {
      const tempFileURLs: Record<string, string> = {}
      urlRes.fileList.forEach((item: any) => {
        if (item.tempFileURL) {
          tempFileURLs[item.fileID] = item.tempFileURL
        }
      })

      const tabBarList = [
        { index: 0, icon: icons.home, activeIcon: icons.homeActive },
        { index: 1, icon: icons.chat, activeIcon: icons.chatActive },
        { index: 2, icon: icons.member, activeIcon: icons.memberActive },
        { index: 3, icon: icons.settings, activeIcon: icons.settingsActive },
      ]

      tabBarList.forEach((item) => {
        const iconPath = tempFileURLs[item.icon]
        const selectedIconPath = tempFileURLs[item.activeIcon]

        if (iconPath && selectedIconPath) {
          uni.setTabBarItem({
            index: item.index,
            iconPath: iconPath,
            selectedIconPath: selectedIconPath,
          })
        }
      })
    }
    // #endif
  } catch (error) {
    console.error('设置TabBar图标失败:', error)
  }
}

// 阻止点击遮罩层关闭弹窗
function preventClose() {
  return false
}
</script>

<style lang="scss">
/* 引入图标字体 */
@import "./static/iconfont.css";

/* 引入全局样式变量 */
@import "./uni.scss";

/* 引入公共样式 */
@import "./static/css/common.scss";

@font-face {
  font-family: 'AlimamaFangYuanTi';
  src: url('/static/fonts/AlimamaFangYuanTiVF-Thin.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}

/* 全局样式 - 统一使用阿里妈妈方圆体，BEVL 圆角 100 */
page {
  background-color: #fff;
  background-repeat: repeat-y;
  background-size: cover;
  background-position: center;
  font-family: 'AlimamaFangYuanTi';
  font-variation-settings: "BEVL" 100;
  color: $text-color;
  font-size: $font-size-base;
  font-weight: 400;
  --tabbar-border-color: rgba(0, 242, 255, 0.5);
}

/* 确保所有元素都使用统一字体，BEVL 圆角 100 */
* {
  font-family: 'AlimamaFangYuanTi';
  font-variation-settings: "BEVL" 100;
}

/* 一级标题 */
h1, .text-h1 {
  font-weight: 700;
  font-variation-settings: "BEVL" 100;
}
/* 二级标题 */
h2, .text-h2 {
  font-weight: 600;
  font-variation-settings: "BEVL" 100;
}
/* 三级标题 */
h3, .text-h3 {
  font-weight: 600;
  font-variation-settings: "BEVL" 100;
}
/* 四级及以下标题 */
h4, h5, h6, .text-h4, .text-h5, .text-h6 {
  font-weight: 500;
  font-variation-settings: "BEVL" 100;
}
/* 正文 */
body, p, view, text, .text-body {
  font-weight: 400;
  font-variation-settings: "BEVL" 100;
}

view, text, button, input, textarea, label, span, div, p, h1, h2, h3, h4, h5, h6 {
  font-family: 'AlimamaFangYuanTi';
  font-variation-settings: "BEVL" 100;
}

.unity_background_image {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.tab-bar {
  height: var(--app-top-bar-height);
}

/* 设置原生TabBar的样式 */
.uni-tabbar {
  border-top: none;
  height: 100rpx;
}

.uni-tabbar__bd {
  height: 100rpx;
}

.uni-tabbar__icon {
  width: 48rpx;
  height: 48rpx;
}

/* 设置TabBar边框 */
.uni-tabbar-border {
  background-color: rgba(0, 242, 255, 0.3);
}

/* 去除默认滚动条样式 */
::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
  color: transparent;
}

/* 去除按钮默认边框 */
button::after {
  border: none;
}

/* 统一图片默认样式 */
image {
  will-change: transform;
}

.padding_bottom_safety {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 统一列表样式 */
.list-cell {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  background-color: $background-color-light;
  padding: 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1rpx solid $border-color;
  transition: all $animation-duration-fast;

  &:active {
    background-color: $background-color-hover;
  }

  &:last-child {
    border-bottom: none;
  }
}

/* 统一卡片样式 */
.card {
  background-color: $background-color-card;
  border-radius: $border-radius-large;
  border: 1rpx solid $border-color;
  padding: $spacing-large;
  margin-bottom: $spacing-large;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  &:active {
    transform: scale(0.98);
  }
}

/* 统一按钮样式 */
.btn {
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: $border-radius-large;
  font-size: $font-size-base;
  transition: all $animation-duration-fast;
  position: relative;
  overflow: hidden;

  &:active {
    transform: scale(0.95);
  }

  &.btn-primary {
    background: $primary-color;
    color: $background-color;
    border: 1rpx solid $primary-color;

    &:active {
      background: darken($primary-color, 5%);
    }
  }

  &.btn-accent {
    background: $accent-color;
    color: #fff;
    border: 1rpx solid $accent-color;

    &:active {
      background: darken($accent-color, 5%);
    }
  }

  &.btn-outline {
    background-color: transparent;
    border: 1rpx solid $primary-color;
    color: $primary-color;

    &:active {
      background-color: rgba($primary-color, 0.05);
    }
  }

  &.btn-ghost {
    background-color: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    color: $text-color;
    border: 1rpx solid rgba(255, 255, 255, 0.1);

    &:active {
      background-color: rgba(255, 255, 255, 0.12);
    }
  }

  &.btn-icon {
    width: 88rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;

    .iconfont {
      font-size: $font-size-lg;
    }
  }
}

/* 统一文本样式 */
.text-primary {
  color: $primary-color;
}

.text-accent {
  color: $accent-color;
}

.text-light {
  color: $text-color-light;
}

.text-success {
  color: $success-color;
}

.text-warning {
  color: $warning-color;
}

.text-error {
  color: $error-color;
}

.text-info {
  color: $info-color;
}

/* 统一间距类 */
.mt-1 { margin-top: $spacing-mini; }
.mt-2 { margin-top: $spacing-small; }
.mt-3 { margin-top: $spacing-base; }
.mt-4 { margin-top: $spacing-large; }
.mt-5 { margin-top: $spacing-xlarge; }

.mb-1 { margin-bottom: $spacing-mini; }
.mb-2 { margin-bottom: $spacing-small; }
.mb-3 { margin-bottom: $spacing-base; }
.mb-4 { margin-bottom: $spacing-large; }
.mb-5 { margin-bottom: $spacing-xlarge; }

.ml-1 { margin-left: $spacing-mini; }
.ml-2 { margin-left: $spacing-small; }
.ml-3 { margin-left: $spacing-base; }
.ml-4 { margin-left: $spacing-large; }
.ml-5 { margin-left: $spacing-xlarge; }

.mr-1 { margin-right: $spacing-mini; }
.mr-2 { margin-right: $spacing-small; }
.mr-3 { margin-right: $spacing-base; }
.mr-4 { margin-right: $spacing-large; }
.mr-5 { margin-right: $spacing-xlarge; }

.pa-1 { padding: $spacing-mini; }
.pa-2 { padding: $spacing-small; }
.pa-3 { padding: $spacing-base; }
.pa-4 { padding: $spacing-large; }
.pa-5 { padding: $spacing-xlarge; }

/* 统一flex布局类 */
.flex { display: flex; }
.flex-column { display: flex; flex-direction: column; }
.flex-center { display: flex; align-items: center; justify-content: center; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-around { display: flex; align-items: center; justify-content: space-around; }
.flex-wrap { flex-wrap: wrap; }
.flex-1 { flex: 1; }
.align-center { align-items: center; }
.align-start { align-items: flex-start; }
.align-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

/* 统一文本溢出省略 */
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.text-ellipsis-3 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.outContainer {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

* {
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
  outline: none;
}

.conceal-img {
  height: 44rpx;
  width: 40rpx;
  position: fixed;
  z-index: 3;
  margin-top: -25rpx;
  transform: rotate(270deg);
}

.agent-content-item {
  line-height: 42rpx;
  font-size: 32rpx;
}

.agent-content-item-question {
  line-height: 42rpx;
  font-size: 32rpx;
}

view.border-all-style {
  background: rgba(248, 249, 252, 0.65);
  border: 1rpx solid #f8f9fc;
}

/* 全局浮动按钮样式 */
.global-floatbox {
  position: fixed;
  right: 30rpx;
  bottom: 200rpx;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  transition: all 0.3s ease;

  &.floatbox-enter {
    opacity: 1;
    visibility: visible;
  }

  &.floatbox-leave {
    opacity: 0;
    visibility: hidden;
  }
}

.floatbox-item {
  width: 80rpx;
  height: 80rpx;
  background: rgba(147, 210, 243, 0.9);
  border: 1rpx solid rgba(147, 210, 243, 0.3);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;

  .floatbox-label {
    font-size: 18rpx;
    color: #333;
  }
}

.floatbox-arrow {
  width: 80rpx;
  height: 80rpx;
  background: rgba(147, 210, 243, 0.9);
  border: 1rpx solid rgba(147, 210, 243, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  .arrow-show::before {
    content: "↑";
  }

  .arrow-hide::before {
    content: "↓";
  }
}

/* 系统公告样式 */
.global-notice {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.8);
  color: red;
  padding: 10rpx;
  text-align: center;
  font-size: 24rpx;
  margin-top: 200rpx;
}

/* 隐私政策弹窗样式 */
.privacy-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
}

.privacy-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 999998;
  pointer-events: auto;
}

.privacy-content {
  position: relative;
  width: 600rpx;
  max-height: 80vh;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  z-index: 1000000;
  overflow: hidden;
  pointer-events: auto;
}

.privacy-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: 30rpx;
}

.privacy-text {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 30rpx;
  font-size: 28rpx;
  line-height: 1.8;
  color: #666;
  max-height: 60vh;
}

.privacy-text text {
  display: block;
  margin-bottom: 20rpx;
}

.privacy-buttons {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
  font-size: 32rpx;
  font-weight: bold;
  cursor: pointer;
}

.privacy-btn.disagree {
  background: #f5f5f5;
  color: #999;
}

.privacy-btn.agree {
  background: #667eea;
  color: #fff;
}
</style>
