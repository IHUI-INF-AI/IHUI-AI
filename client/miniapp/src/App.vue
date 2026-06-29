<template>
  <view class="app-root">
    <slot />

    <!-- 全局悬浮球（已在 main.ts 全局注册） -->
    <FloatBox />

    <!-- 全局推送通知弹窗（已在 main.ts 全局注册） -->
    <PushNotification />

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
import websocketManager from '@/utils/websocket.js'
import { initPush, savePushClientIdToServer } from '@/utils/push.js'
import { baseUrl3 } from '@/utils/service/index.js'

const userStore = useUserStore()

// ===== 类型定义 =====
interface UserData {
  uuid?: string
  [key: string]: unknown
}

interface WsMessage {
  event?: string
  content?: string
  timestamp?: string | number
  [key: string]: unknown
}

interface PushMessageData {
  type?: string
  url?: string
  title?: string
  content?: string
  body?: string
  timestamp?: number
  [key: string]: unknown
}

interface WsCallbacks {
  onOpen?: () => void
  onMessage?: (message: WsMessage) => void
  onError?: (error: unknown) => void
  onClose?: (res: unknown) => void
}

interface WsManager {
  connect(url: string, userUuid: string, callbacks: WsCallbacks): void
  close(): void
  isConnected(): boolean
  send(message: unknown): boolean
}

interface ErrorLogItem {
  type: string
  message: string
  stack: string
  timestamp: number
}

// ===== 全局状态 =====
const appState = reactive({
  floatboxVisible: true,
  showPrivacyPolicy: false,
  isOffline: false,
})

// 隐私政策相关
const privacyPolicyAccepted = ref(false)
const showPrivacyPolicy = ref(false)
const sdkInitialized = ref(false)

// 全局数据
const globalData = reactive({
  userInfo: null as UserData | null,
  cloudConnected: false,
  inviteCode: '',
  isLoggedIn: false,
  pushClientId: null as string | null,
})

// WebSocket 默认地址（IP 直连或未配置时的回退域名）
const WS_DEFAULT_URL = 'wss://zca.aizhs.top'
const WS_PATH = '/cozeZhsApi/chat-room/ws'

// 把 JS 导入的 websocketManager 收敛为已知接口类型，避免 any 扩散
const wsManager = websocketManager as unknown as WsManager

// ===== 应用生命周期 =====
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

  // 全局错误处理
  setupGlobalErrorHandler()

  // 网络状态监听
  setupNetworkListener()

  // 系统更新检测
  checkForUpdate()

  // 监听登录成功事件：保存 pushClientId 并连接 WebSocket
  uni.$on('loginSuccess', (userData: UserData) => {
    console.log('监听到登录成功事件，准备保存 pushClientId 并连接 WebSocket')
    if (!privacyPolicyAccepted.value) {
      console.log('用户未同意隐私政策，暂不保存pushClientId')
      return
    }
    const pushClientId = globalData.pushClientId || (uni.getStorageSync('pushClientId') as string)
    if (pushClientId && userData && userData.uuid) {
      savePushClientId(pushClientId, userData.uuid)
    }
    if (userData && userData.uuid) {
      connectWebSocket(userData.uuid)
    }
  })
})

onShow(() => {
  console.log('App onShow')
  appState.floatboxVisible = true

  // 应用回到前台时，若已登录则重连 WebSocket
  if (privacyPolicyAccepted.value) {
    const userData = uni.getStorageSync('data') as UserData
    if (userData && userData.uuid && !wsManager.isConnected()) {
      connectWebSocket(userData.uuid)
    }
  }
})

onHide(() => {
  console.log('App onHide')
  appState.floatboxVisible = false
  // 应用进入后台时断开 WebSocket，onShow 时重连
  disconnectWebSocket()
})

// ===== 初始化应用（保持原有逻辑不变） =====
function initializeApp() {
  if (sdkInitialized.value) {
    return
  }

  console.log('开始初始化应用')

  // 检查登录状态
  const userData = uni.getStorageSync('data') as UserData
  if (userData && userData.uuid) {
    globalData.isLoggedIn = true
    // 跳转到主页
    uni.reLaunch({
      url: '/pages/table/aiIndex/ai_index',
    })
    // 已登录则连接 WebSocket
    connectWebSocket(userData.uuid)
  } else {
    // 跳转到登录页
    uni.reLaunch({
      url: '/pages/login-app/login',
    })
  }

  // 初始化推送服务（可能收集设备信息，必须在用户同意后执行）
  initPushService()

  sdkInitialized.value = true
}

// ===== 隐私政策（保持原有逻辑不变） =====
function onPrivacyAccepted() {
  console.log('用户同意隐私政策')
  privacyPolicyAccepted.value = true
  showPrivacyPolicy.value = false
  uni.setStorageSync('privacyPolicyShown', true)
  initializeApp()
}

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

// ===== WebSocket 实时通信 =====
/**
 * 获取 WebSocket 基础地址
 * 优先级：本地存储 API_WS_BASE_URL > baseUrl3 协议替换 > 默认域名
 */
function getWsBaseUrl(): string {
  try {
    const stored = uni.getStorageSync('API_WS_BASE_URL')
    if (typeof stored === 'string' && stored.trim()) {
      return stored.trim().replace(/\/$/, '')
    }
    // baseUrl3 为 IP 直连时，服务端可能不认 ws://IP，回退到默认域名
    if (/^https?:\/\/(\d{1,3}\.){3}\d{1,3}/.test(baseUrl3 || '')) {
      return WS_DEFAULT_URL
    }
    return (baseUrl3 || '')
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')
  } catch (e) {
    return WS_DEFAULT_URL
  }
}

/** 连接 WebSocket（仅登录后调用） */
function connectWebSocket(userUuid: string) {
  if (!userUuid) {
    console.warn('无法连接 WebSocket：缺少用户UUID')
    return
  }

  // 已连接则先关闭旧连接
  if (wsManager.isConnected()) {
    console.log('WebSocket 已连接，先关闭旧连接')
    wsManager.close()
  }

  const wsUrl = `${getWsBaseUrl() || WS_DEFAULT_URL}${WS_PATH}`
  console.log('准备连接 WebSocket:', wsUrl)
  console.log('用户UUID:', userUuid)

  wsManager.connect(wsUrl, userUuid, {
    onOpen: () => {
      console.log('WebSocket 连接成功')
    },
    onMessage: (message: WsMessage) => {
      console.log('收到 WebSocket 消息:', message)
      handleWebSocketMessage(message)
    },
    onError: (error: unknown) => {
      console.error('WebSocket 连接错误:', error)
    },
    onClose: (res: unknown) => {
      console.log('WebSocket 连接关闭:', res)
    },
  })
}

/** 断开 WebSocket 连接 */
function disconnectWebSocket() {
  console.log('断开 WebSocket 连接')
  wsManager.close()
}

/** 处理 WebSocket 消息：房间消息触发应用内推送弹窗 */
function handleWebSocketMessage(message: WsMessage) {
  try {
    if (message && message.event === 'room_message') {
      const title = '新消息'
      const content = (message.content as string) || '您收到一条新消息'
      const timestamp = message.timestamp
        ? new Date(message.timestamp).getTime()
        : Date.now()

      uni.$emit('showPushNotification', {
        title,
        content,
        timestamp,
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
    } else {
      console.log('收到其他类型消息:', message?.event || '未知')
    }
  } catch (error) {
    console.error('处理 WebSocket 消息失败:', error)
  }
}

// ===== 推送服务 =====
/**
 * 初始化推送服务
 * - APP 端：使用 uni-push（initPush 获取 clientId 并监听消息）
 * - 小程序端：订阅消息需在用户点击事件中调用 uni.requestSubscribeMessage，
 *   不允许在 onLaunch 自动申请，因此此处不自动调用，由业务场景触发。
 */
async function initPushService() {
  // #ifdef APP-PLUS
  try {
    const privacyPolicyShown = uni.getStorageSync('privacyPolicyShown')
    if (!privacyPolicyShown) {
      console.warn('用户未同意隐私政策，跳过推送服务初始化（避免读取OAID等设备信息）')
      return
    }

    console.log('开始初始化推送服务...')
    const pushClientId = (await initPush({
      onMessage: (res) => {
        console.log('收到推送消息:', res)
        if (res.type === 'click') {
          handlePushMessageClick(res.data as PushMessageData | string)
        }
        if (res.type === 'receive') {
          showPushNotificationFromData(res.data as PushMessageData | string)
        }
      },
      onClientId: (cid: string | null) => {
        if (cid) {
          console.log('获取到推送客户端ID:', cid)
          globalData.pushClientId = cid
          const userData = uni.getStorageSync('data') as UserData
          if (userData && userData.uuid) {
            savePushClientId(cid, userData.uuid)
          }
        } else {
          console.warn('uni-push 未启用，推送功能将不可用')
        }
      },
    })) as string | null

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

  // #ifdef MP-WEIXIN
  console.log('小程序端：订阅消息需在业务场景中通过 uni.requestSubscribeMessage 申请')
  // #endif
}

/** 保存推送客户端ID到服务器 */
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

/** 处理推送消息点击事件：根据 type 跳转页面或打开外链 */
function handlePushMessageClick(data: PushMessageData | string) {
  try {
    let messageData: PushMessageData
    if (typeof data === 'string') {
      try {
        messageData = JSON.parse(data) as PushMessageData
      } catch {
        messageData = { content: data }
      }
    } else {
      messageData = data
    }

    if (messageData.type === 'page' && messageData.url) {
      const url = messageData.url
      uni.navigateTo({
        url,
        fail: () => {
          uni.reLaunch({ url })
        },
      })
    } else if (messageData.type === 'url' && messageData.url) {
      // #ifdef APP-PLUS
      plus.runtime.openURL(messageData.url)
      // #endif
    }
  } catch (error) {
    console.error('处理推送消息点击失败:', error)
  }
}

/** 从推送数据中显示应用内弹窗通知 */
function showPushNotificationFromData(data: PushMessageData | string) {
  try {
    let messageData: PushMessageData
    if (typeof data === 'string') {
      try {
        messageData = JSON.parse(data) as PushMessageData
      } catch {
        messageData = { content: data }
      }
    } else {
      messageData = data
    }

    const title = messageData.title || '新消息'
    const content = messageData.content || messageData.body || '您收到一条新消息'

    uni.$emit('showPushNotification', {
      title,
      content,
      timestamp: messageData.timestamp || Date.now(),
      duration: 5000,
      onClick: () => {
        if (messageData.type === 'page' && messageData.url) {
          const url = messageData.url
          uni.navigateTo({
            url,
            fail: () => {
              uni.reLaunch({ url })
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

// ===== 全局错误处理 =====
/** 注册全局错误与未处理 Promise 拒绝监听 */
function setupGlobalErrorHandler() {
  uni.onError((error: unknown) => {
    console.error('全局错误:', error)
    logErrorToLocal('error', error)
  })

  uni.onUnhandledRejection((res: { promise: Promise<unknown>; reason: unknown }) => {
    console.error('未处理的 Promise 拒绝:', res.reason)
    logErrorToLocal('unhandledRejection', res.reason)
  })
}

/** 错误日志写入本地存储（保留最近 50 条） */
function logErrorToLocal(type: string, error: unknown) {
  try {
    const errorLog: ErrorLogItem = {
      type,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack || '' : '',
      timestamp: Date.now(),
    }
    const stored = uni.getStorageSync('appErrorLogs')
    const logs: ErrorLogItem[] = Array.isArray(stored) ? stored : []
    logs.push(errorLog)
    // 只保留最近 50 条
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50)
    }
    uni.setStorageSync('appErrorLogs', logs)
  } catch (e) {
    console.error('写入错误日志失败:', e)
  }
}

// ===== 网络状态监听 =====
/** 注册网络状态变化监听，离线提示、恢复重连 */
function setupNetworkListener() {
  // 初始化时获取一次当前网络状态
  uni.getNetworkType({
    success: (res) => {
      appState.isOffline = res.networkType === 'none'
    },
  })

  uni.onNetworkStatusChange((res) => {
    appState.isOffline = !res.isConnected
    if (!res.isConnected) {
      uni.showToast({
        title: '网络已断开，请检查网络连接',
        icon: 'none',
        duration: 2000,
      })
    } else {
      uni.showToast({
        title: '网络已恢复',
        icon: 'success',
        duration: 1500,
      })
      // 网络恢复后尝试重连 WebSocket
      if (privacyPolicyAccepted.value) {
        const userData = uni.getStorageSync('data') as UserData
        if (userData && userData.uuid && !wsManager.isConnected()) {
          connectWebSocket(userData.uuid)
        }
      }
    }
  })
}

// ===== 系统更新检测 =====
/** 检测小程序更新，有更新时提示用户重启 */
function checkForUpdate() {
  if (!uni.canIUse('getUpdateManager')) {
    return
  }
  try {
    const updateManager = uni.getUpdateManager()
    updateManager.onCheckForUpdate((res: { hasUpdate: boolean }) => {
      if (res.hasUpdate) {
        console.log('检测到新版本')
      }
    })
    updateManager.onUpdateReady(() => {
      uni.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success: (res) => {
          if (res.confirm) {
            updateManager.applyUpdate()
          }
        },
      })
    })
    updateManager.onUpdateFailed(() => {
      uni.showModal({
        title: '更新提示',
        content: '新版本下载失败，请检查网络后重试',
        showCancel: false,
      })
    })
  } catch (error) {
    console.error('检查更新失败:', error)
  }
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
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.privacy-mask {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
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
