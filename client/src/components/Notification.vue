<template>
  <el-dropdown
    v-if="authStore.isLoggedIn"
    placement="bottom-end"
    :visible="isVisible"
    @visible-change="handleVisibleChange"
    trigger="click"
    popper-class="notification-dropdown-popper"
    ref="notificationContainer"
  >
    <div
      class="button-message user-info-button"
      :class="{ 'dark-mode': isDarkMode }"
      @click.stop="goToUserCenter"
      :title="t('notification.viewUserCenter')"
      style="cursor: pointer"
    >
        <div class="content-avatar">
          <div class="status-user"></div>
          <div class="avatar">
            <div v-if="currentUser?.avatar" class="user-avatar-img">
              <img :src="currentUser.avatar" alt="user avatar" />
            </div>
            <svg v-else class="user-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M12,12.5c-3.04,0-5.5,1.73-5.5,3.5s2.46,3.5,5.5,3.5,5.5-1.73,5.5-3.5-2.46-3.5-5.5-3.5Zm0-.5c1.66,0,3-1.34,3-3s-1.34-3-3-3-3,1.34-3,3,1.34,3,3,3Z"
              ></path>
            </svg>
          </div>
        </div>
        <div class="notice-content">
          <div class="username">{{ username }}</div>
          <div class="lable-message">
            <span>
              {{ unreadCount > 0 ? t('notification.messages') : t('notification.center') }}
            </span>
            <span v-if="unreadCount > 0" class="number-message">
              {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
          </div>
          <div class="user-id">℡{{ userId }}</div>
        </div>
      </div>
      <template #dropdown>
        <el-dropdown-menu class="notification-dropdown">
          <div class="notification-header">
            <span>{{ t('notification.title') }}</span>
            <el-button v-if="unreadCount > 0" link size="small" @click.stop="markAllAsRead">
              {{ t('notification.allRead') }}
            </el-button>
          </div>

          <el-scrollbar max-height="300px" v-loading="loading">
            <template v-if="loading">
              <div class="loading-state">
                <el-icon class="is-loading"><Loader2 /></el-icon>
                <span>{{ t('common.loading') }}</span>
              </div>
            </template>
            <template v-else-if="notifications.length === 0">
              <div class="no-notifications">{{ t('notification.empty') }}</div>
            </template>
            <template v-else>
              <el-dropdown-item
                v-for="notification in notifications"
                :key="notification.id"
                :class="{ unread: !notification.read }"
                @click="handleNotificationClick(notification)"
              >
                <div class="notification-item">
                  <div class="notification-content">
                    <div class="notification-title">
                      {{ notification.title }}
                    </div>
                    <div class="notification-message">
                      {{ notification.message }}
                    </div>
                  </div>
                  <div class="notification-time">
                    {{ formatTime(notification.time) }}
                  </div>
                </div>
              </el-dropdown-item>
            </template>
          </el-scrollbar>

          <div class="notification-footer">
            <el-button
              v-if="notifications.length > 0"
              link
              @click.stop="viewAllNotifications"
            >
              {{ t('notification.viewAll') }}
            </el-button>
            <el-divider v-if="notifications.length > 0" />
            <!-- 用户操作按钮行 -->
            <div class="footer-actions">
              <el-button class="btn-user" @click.stop="goToUserCenter">
                <el-icon><User /></el-icon>
                {{ t('routes.user') }}
              </el-button>
              <el-button class="btn-logout" @click.stop="handleLogout">
                <el-icon><LogOut /></el-icon>
                {{ t('auth.logout') }}
              </el-button>
            </div>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { logger } from '../utils/logger'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCleanup } from '@/composables/useCleanup'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import {
  getMessages,
  getMessageStats,
  markMessageAsRead,
  markAllAsRead as apiMarkAllAsRead,
  type Message,
  MessageStatus,
  MessageType,
} from '@/api/message'
import { useAuthStore } from '@/stores/auth'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { User, Loader2, LogOut } from '@/lib/lucide-fallback'
import type { UserInfoData } from '@/api/user'

interface Props {
  isDarkMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDarkMode: false,
})

interface NotificationItem {
  id: string
  title: string
  message: string
  time: Date
  read: boolean
  type: 'system' | 'message' | 'alert'
  link?: string
}

const router = useRouter()
const authStore = useAuthStore()
const cleanup = useCleanup()

// 从 props 获取深色模式状态
const isDarkMode = computed(() => props.isDarkMode)

const isVisible = ref(false)
const notificationContainer = ref<HTMLElement | null>(null)
const notifications = ref<NotificationItem[]>([])
const messageStats = ref({ unread: 0 })
const loading = ref(false)

const { t } = useI18n()
const { showSuccess, showError } = useOperationFeedback()

// 类型断言辅助函数
const getUser = () => authStore.user as UserInfoData | null

const username = computed(() => {
  const user = getUser()
  const nickname = user?.nickname
  const usernameValue = user?.username || ''
  
  if (nickname === '最高管理员' || nickname === 'superAdmin') {
    return t('common.superAdmin')
  }
  
  return nickname || usernameValue || t('common.user')
})

const currentUser = computed(() => {
  const user = getUser()

  return {
    avatar:
      user?.avatar ||
      localStorage.getItem('avatarPic') ||
      '',
    nickname: user?.nickname,
    username: user?.username || ''
  }
})

const userId = computed(() => {
  // 优先显示手机号，如果没有则显示用户名
  const user = getUser()
  const phone = user?.phone
  if (phone && phone !== '138****8888') {
    // 如果手机号已经是脱敏格式（包含****），直接返回
    if (phone.includes('****')) {
      return phone
    }
    // 格式化手机号：显示前3位和后4位，中间用****隐藏
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  }
  return user?.username || user?.nickname || 'user'
})

// 未读数量
const unreadCount = computed(() => messageStats.value.unread)

// 加载消息列表
const loadNotifications = async () => {
  if (!authStore.isLoggedIn) return

  // 如果连续错误次数过多，暂停请求
  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    logger.debug('[Notification] Too many consecutive errors, pausing polling')
    return
  }

  loading.value = true
  try {
    // 获取最新6条消息（包括已读和未读）
    const response = await getMessages({
      page: 1,
      pageSize: 6,
    })

    if (response.code === 200 || response.success) {
      // 成功时重置错误计数
      resetErrorBackoff()
      
      const messageList = response.data?.list || response.data || []
      notifications.value = Array.isArray(messageList)
        ? messageList.map((msg: Message) => ({
            id: msg.id,
            title: msg.title || t('common.noTitle'),
            message: msg.content || '',
            time: new Date(msg.createTime || Date.now()),
            read: msg.status === MessageStatus.READ,
            type:
              msg.type === MessageType.SYSTEM
                ? 'system'
                : msg.type === MessageType.NOTIFICATION
                  ? 'message'
                  : 'alert',
            link: msg.actionUrl,
          }))
        : []

      // 调试日志
      logger.info('Notification data loaded:', {
        responseCode: response.code,
        messageList: messageList,
        notificationsCount: notifications.value.length,
      })
    } else {
      logger.warn(t('notification.loadAbnormal'), response)
      notifications.value = []
    }

    // 获取消息统计（静默失败，不影响用户体验）
    try {
      const statsResponse = await getMessageStats()
      if (statsResponse.code === 200 || statsResponse.success) {
        messageStats.value = {
          unread: statsResponse.data?.unread || 0,
        }
      } else {
        messageStats.value = { unread: 0 }
      }
    } catch (statsError) {
      // 消息统计失败不影响主功能，静默处理
      logger.warn(t('common.errors.fetchFailed'), statsError)
      messageStats.value = { unread: 0 }
    }
  } catch (error) {
    // 增加错误计数
    consecutiveErrors++
    // 指数退避：每次错误后延迟翻倍，最大 5 分钟
    backoffMultiplier = Math.min(backoffMultiplier * 2, 10)
    
    logger.warn(`[Notification] Failed to load messages (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`, error)
    
    // 静默处理错误，不影响用户体验
    notifications.value = []
    messageStats.value = { unread: 0 }
    
    // 如果达到最大错误次数，重新设置轮询间隔
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      setupRefreshInterval()
    }
  } finally {
    loading.value = false
  }
}

// 下拉菜单显示/隐藏时加载数据
const handleVisibleChange = (visible: boolean) => {
  if (visible && authStore.isLoggedIn) {
    loadNotifications()
  }
}

const formatTime = (time: Date) => {
  return dayjs(time).locale('zh-cn').format('MM-DD HH:mm')
}

// 标记全部为已读
const markAllAsRead = async (event: Event) => {
  event.stopPropagation()
  if (!authStore.isLoggedIn) return

  try {
    const response = await apiMarkAllAsRead()
    if (response.code === 200 || response.success) {
      showSuccess(t('notification.markAllReadSuccess'))
      // 更新本地状态
      notifications.value.forEach((notification: NotificationItem | Message) => {
        if ('read' in notification) {
          ;(notification as NotificationItem).read = true
        }
      })
      messageStats.value.unread = 0
      // 重新加载
      loadNotifications()
    }
  } catch (error) {
    import('@/utils/logger')
      .then(({ logger }) => {
        logger.error(
          t('notification.markAllReadFailed'),
          error instanceof Error ? error : new Error(String(error))
        )
      })
      .catch(() => { /* logger 加载失败，静默处理 */ })
    showError(t('notification.operationFailed'))
  }
}

// 跳转到用户中心
const goToUserCenter = (event?: Event) => {
  if (event) {
    event.stopPropagation()
  }
  isVisible.value = false
  router.push('/user')
}

// 点击通知项
const handleNotificationClick = async (notification: NotificationItem) => {
  if (!authStore.isLoggedIn) return

  // 如果未读，标记为已读
  if (!notification.read) {
    try {
      await markMessageAsRead(notification.id)
      notification.read = true
      messageStats.value.unread = Math.max(0, messageStats.value.unread - 1)
    } catch (error) {
      import('@/utils/logger')
        .then(({ logger }) => {
          logger.error(
            t('notification.markReadFailed'),
            error instanceof Error ? error : new Error(String(error))
          )
        })
        .catch((e) => { console.warn('[Notification] logger 加载失败', e) })
    }
  }

  isVisible.value = false

  // 如果有链接，跳转
  if (notification.link) {
    router.push(notification.link)
  }
}

// 查看全部通知 - 跳转到用户中心消息中心
const viewAllNotifications = () => {
  isVisible.value = false
  // 跳转到用户中心，并自动切换到消息中心标签
  router.push('/user?tab=messages')
}

// 退出登录
const handleLogout = async (event: Event) => {
  event.stopPropagation()
  try {
    isVisible.value = false
    await authStore.logout()
    
    // 等待状态更新完成
    await nextTick()
    
    // 使用 replace 避免在历史记录中留下之前的页面
    try {
      await router.replace('/login')
      // 成功跳转到登录页后，清除退出登录标志
      sessionStorage.removeItem('__logout_flag__')
    } catch (routeError: any) {
      // 如果路由跳转失败（比如已经在登录页），使用 window.location 强制跳转
      const error = routeError as { name?: string }
      if (error.name !== 'NavigationDuplicated' && error.name !== 'NavigationRedirected') {
        logger.warn('[Notification] Route navigation failed, using window.location for forced redirect:', routeError)
        window.location.replace('/login')
        // 使用 window.location 跳转后，标志会在页面加载时清除
      } else {
        // 如果已经在登录页，清除退出登录标志
        sessionStorage.removeItem('__logout_flag__')
      }
    }
    
    showSuccess(t('auth.logoutSuccess'))
  } catch (error) {
    logger.error('[Notification] Logout failed:', error)
    showError(t('auth.logoutFailed'))
    // 即使失败也尝试跳转到登录页
    try {
      await router.replace('/login').catch(() => {
        window.location.replace('/login')
      })
    } catch (_e) {
      // 静默处理
    }
  }
}

// 点击其他地方关闭下拉菜单
const handleClickOutside = (event: MouseEvent) => {
  try {
    const target = event.target
    // 确保 target 是 Element 类型
    if (!target || !(target instanceof Element)) {
      return
    }
    if (notificationContainer.value && !notificationContainer.value.contains(target)) {
      isVisible.value = false
    }
  } catch (error) {
    // 静默处理错误，避免影响其他功能
    logger.warn('handleClickOutside error:', error)
  }
}

// 定时器引用
let refreshInterval: ReturnType<typeof setInterval> | null = null
cleanup.add(() => { if (refreshInterval) clearInterval(refreshInterval) })
let hasInitialLoaded = false
// 错误退避机制
let consecutiveErrors = 0
const MAX_CONSECUTIVE_ERRORS = 3
const BASE_RETRY_DELAY = 30000 // 基础重试延迟 30 秒
let backoffMultiplier = 1

// 确保只进行一次「首次加载」，避免页面初始化时重复请求
const ensureInitialLoad = () => {
  if (hasInitialLoaded) return
  if (authStore.isLoggedIn && authStore.token) {
    hasInitialLoaded = true
    loadNotifications()
  }
}

// 重置错误计数（登录成功或手动刷新时调用）
const resetErrorBackoff = () => {
  consecutiveErrors = 0
  backoffMultiplier = 1
}

// 启动/重置轮询定时器
const setupRefreshInterval = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
  if (!(authStore.isLoggedIn && authStore.token)) return

  // 使用退避延迟
  const delay = BASE_RETRY_DELAY * backoffMultiplier
  refreshInterval = setInterval(() => {
    if (authStore.isLoggedIn && authStore.token) {
      loadNotifications()
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }, delay)
}

// 监听登录状态变化，自动加载消息（仅在登录完成后触发一次）
watch(
  () => authStore.isLoggedIn,
  (isLoggedIn: boolean) => {
    if (!isLoggedIn) {
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
      // 登出时重置错误计数
      resetErrorBackoff()
      return
    }
    // 登录成功时重置错误计数
    resetErrorBackoff()
    // 刚登录成功时触发一次首屏加载 + 启动轮询
    ensureInitialLoad()
    setupRefreshInterval()
  }
)

onMounted(() => {
  cleanup.addEventListener(document, 'click', handleClickOutside as EventListener)
  // 如果已登录且有token，进行一次首屏加载并启动轮询
  ensureInitialLoad()
  setupRefreshInterval()
})
</script>

<style scoped lang="scss">
// 组件级 CSS 变量定义 - 现在根元素是 el-dropdown
.el-dropdown {
  // --notif- 前缀的组件变量
  --notif-text-color: var(--el-text-color-primary);
  --notif-bg-color-sup: var(--el-border-color);
  --notif-bg-color: transparent;
  --notif-bg-hover-color: transparent;
  --notif-online-status: var(--el-color-success);
  --notif-font-size: 16px;
  --notif-btn-transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --notif-dropdown-bg: var(--el-bg-color-page);
  --notif-dropdown-border: var(--border-unified-color);
  --notif-btn-color: var(--el-text-color-regular);
  --notif-btn-padding: 10px 15px;
  --notif-item-padding: 0;

  position: relative;
  display: inline-flex;
  align-items: center;
  height: auto;
  flex-shrink: 1;
  flex-grow: 0;
  width: auto;
  min-width: 0;
  max-width: fit-content;
}

// 新的通知按钮样式
.button-message {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  font:
    400 var(--notif-font-size) "Helvetica Neue",
    sans-serif;
  box-shadow: none;
  background-color: var(--notif-bg-color);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  padding: 6px 10px 6px 6px;
  width: auto;
  min-width: 0;
  max-width: fit-content;
  height: auto;
  min-height: 36px;
  border: none;
  position: relative;
  transition: var(--notif-btn-transition);
  box-sizing: border-box;

  &.user-info-button:hover {
    background-color: var(--notif-bg-hover-color);
    border-radius: var(--global-border-radius);
    transform: scale(1.02);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &:hover {
    min-height: 36px;
    max-height: 100px;
    padding: 8px 20px 8px 8px;
    background-color: var(--notif-bg-hover-color);
    transition: var(--notif-btn-transition);
  }

  // 深色模式样式
  &.dark-mode {
    box-shadow: none;
    background-color: var(--notif-bg-color);

    &:hover {
      background-color: var(--notif-bg-hover-color);
    }
  }

  &:active {
    transform: scale(0.99);
  }
}

.content-avatar {
  width: 30px;
  height: 30px;
  margin: 0;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  flex-shrink: 0;
}

.button-message:hover .content-avatar {
  width: 36px;
  height: 36px;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);
  background-color: var(--el-bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.user-avatar-img {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--global-border-radius);
  position: relative;
  
  img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    object-position: center;
    border-radius: var(--global-border-radius);
    display: block;
    position: relative;
    z-index: var(--z-base);
  }
}

.user-img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  object-position: center;
  border-radius: var(--global-border-radius);
}

.status-user {
  position: absolute;
  width: 6px;
  height: 6px;
  right: 1px;
  bottom: 1px;
  border-radius: var(--global-border-radius);
  border: 2px solid var(--notif-bg-color);
  outline: none;
  background-color: var(--notif-online-status);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: active-status 2s ease-in-out infinite;
}

.button-message:hover .status-user {
  width: 10px;
  height: 10px;
  right: 1px;
  bottom: 1px;
  border-width: 3px;
  border-color: var(--notif-bg-hover-color);
  outline: none;
}

.notice-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding-left: 8px;
  text-align: initial;
  color: var(--notif-text-color);
  width: auto;
  min-width: 0;
  max-width: 100%;
  overflow: visible;
  flex-shrink: 1;
  flex-grow: 0;
  box-sizing: border-box;
}

.username {
  letter-spacing: -6px;
  height: 0;
  min-height: 0;
  max-height: 0;
  opacity: 0;
  transform: translateY(-20px);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), letter-spacing 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  width: auto;
  margin: 0;
  padding: 0;
  line-height: 0;
  font-size: 14px;
  font-weight: 600;
}

.user-id {
  font-size: 12px;
  letter-spacing: -6px;
  height: 0;
  min-height: 0;
  max-height: 0;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), letter-spacing 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  width: auto;
  margin: 0;
  padding: 0;
  line-height: 0;
}

.lable-message {
  display: flex;
  align-items: center;
  opacity: 1;
  transform: scaleY(1);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
  width: auto;
  flex-shrink: 1;
  height: auto;
  min-height: auto;
  line-height: normal;
  font-size: 14px;
  font-weight: 600;
}

.button-message:hover .username {
  height: auto;
  min-height: auto;
  max-height: 100px;
  letter-spacing: normal;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), letter-spacing 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: visible;
  line-height: 1.2;
  display: block;
  margin-bottom: 2px;
}

.button-message:hover .user-id {
  height: auto;
  min-height: auto;
  max-height: 100px;
  letter-spacing: normal;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), letter-spacing 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  overflow: visible;
  line-height: 1.2;
  display: block;
  margin-top: 2px;
}

.button-message:hover .lable-message {
  height: 0;
  min-height: 0;
  max-height: 0;
  opacity: 0;
  transform: scaleY(0);
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.number-message {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  margin-left: 8px;
  font-size: 12px;
  width: 16px;
  height: 16px;
  background-color: var(--notif-bg-color-sup);
  border-radius: var(--global-border-radius);
}

@keyframes active-status {
  0% {
    background-color: var(--notif-online-status);
  }

  33.33% {
    background-color: var(--el-bg-color);
  }

  66.33% {
    background-color: var(--el-bg-color);
  }

  100% {
    background-color: var(--notif-online-status);
  }
}

// 注意：通知下拉菜单的样式已移至全局样式块（文件末尾）
// 因为 el-dropdown-menu 被 Teleport 到 body 下的 popper 容器
// scoped 样式无法匹配 Teleport 内容
</style>

<style lang="scss">
// 全局样式：Teleport 内容的样式（下拉菜单被渲染到 body 下的 popper 容器）
// 使用完整的 BEM 类名避免冲突

// 通知下拉菜单 popper 容器样式
body .notification-dropdown-popper.el-dropdown__popper {
  border: var(--unified-border);
  padding: 0;
  border-radius: var(--global-border-radius);
  
  .el-popper {
    border: none;
    box-shadow: none;
  }
}

// 通知下拉菜单主样式（Teleport 内容）
.notification-dropdown-popper .notification-dropdown,
.notification-dropdown.el-dropdown-menu {
  width: 320px;
  padding: 0;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  border: var(--unified-border);
  background: var(--notif-dropdown-bg);

  .notification-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: none;
    background: var(--el-bg-color-page);

    span {
      font-weight: bold;
      font-size: 16px;
      color: var(--el-text-color-primary);
    }

    .el-button {
      color: var(--notif-btn-color);
      font-weight: 500;
    }
  }

  .no-notifications {
    text-align: center;
    padding: 30px;
    color: var(--el-text-color-secondary);
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    color: var(--el-text-color-secondary);
    gap: 10px;
    min-height: 100px;

    .el-icon {
      font-size: 24px;
    }

    span {
      font-size: 14px;
    }
  }

  .el-scrollbar {
    min-height: 100px;
  }

  .el-scrollbar__wrap {
    max-height: 300px;
  }

  .el-dropdown-menu__item {
    padding: var(--notif-item-padding);
    line-height: normal;
    display: block;
    transition: background-color 0.3s ease;

    &:not(.is-disabled):hover {
      background-color: var(--el-bg-color-page);
    }

    &.unread {
      background-color: var(--el-bg-color-page);
      border-left: none;
    }
  }

  .notification-item {
    padding: 12px 15px;
    width: 100%;

    .notification-content {
      .notification-title {
        font-weight: 500;
        color: var(--el-text-color-primary);
        margin-bottom: 4px;
        font-size: 14px;
        display: flex;
        align-items: center;

        &::before {
          content: '';
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: var(--global-border-radius);
          background: var(--el-border-color);
          margin-right: 8px;
          opacity: 0.7;
        }
      }

      .notification-message {
        font-size: 13px;
        color: var(--el-text-color-regular);
        line-height: 1.4;
        margin-bottom: 4px;
        padding-left: 14px;
      }
    }

    .notification-time {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      text-align: right;
      padding-right: 5px;
    }
  }

  // 通知底部操作区域
  .notification-footer {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    box-sizing: border-box;

    // 查看全部按钮
    > .el-button {
      width: 100%;
      color: var(--el-text-color-regular);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 8px 12px;
      font-size: 13px;
    }

    // 分割线
    .el-divider {
      margin: 0;
    }
  }

  // 用户操作按钮行容器
  .footer-actions {
    display: flex;
    gap: 10px;
    width: 100%;
  }
}

// 按钮样式 - :where() 包裹祖先层级，特异性恒为 0
:where(body .notification-dropdown-popper .notification-dropdown .footer-actions) .el-button.btn-user {
  flex: 1;
  background-color: var(--el-fill-color-light);
  border: var(--unified-border);
  color: var(--el-text-color-regular);
}

:where(body .notification-dropdown-popper .notification-dropdown .footer-actions) .el-button.btn-user:hover {
  background-color: var(--el-fill-color);
  border: 2px solid var(--border-unified-color-hover);
  color: var(--el-color-primary);
}

:where(body .notification-dropdown-popper .notification-dropdown .footer-actions) .el-button.btn-logout {
  flex: 1;
  background-color: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger-light-7);
  color: var(--el-color-danger);
}

:where(body .notification-dropdown-popper .notification-dropdown .footer-actions) .el-button.btn-logout:hover {
  background-color: var(--el-color-danger-light-8);
  border-color: var(--el-color-danger-light-5);
}

// 暗色模式 - 使用 :where(html.dark) 降低特异性
:where(html.dark) .notification-dropdown-popper .notification-dropdown,
:where(html.dark) .notification-dropdown.el-dropdown-menu {
  --notif-dropdown-bg: var(--el-bg-color);
  --notif-dropdown-border: var(--border-unified-color);

  background: var(--notif-dropdown-bg);
  border-color: var(--notif-dropdown-border);
}

</style>
