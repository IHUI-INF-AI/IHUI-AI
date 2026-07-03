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
      :class="{ 'dark-mode': isDarkMode, 'has-unread': unreadCount > 0 }"
      :title="t('notification.center')"
      style="cursor: pointer"
    >
      <el-icon class="notification-icon" aria-hidden="true">
        <Bell />
      </el-icon>
      <span v-if="unreadCount > 0" class="notification-count">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
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
import { Bell } from '@element-plus/icons-vue'

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
    } catch (routeError: unknown) {
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
  // --notif- 前缀的组件变量（仅保留下拉菜单仍需要的）
  --notif-dropdown-bg: var(--el-bg-color-page);
  --notif-dropdown-border: var(--border-unified-color);
  --notif-btn-color: var(--el-text-color-regular);
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

// 通知图标按钮（28×28，与 sidebar-actions 内其他图标按钮风格统一）
.button-message {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  background-color: transparent;
  border-radius: var(--global-border-radius-sm, 4px);
  cursor: pointer;
  padding: 0;
  width: 28px;
  min-width: 28px;
  max-width: 28px;
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  border: none;
  position: relative;
  transition: background-color 0.2s ease, transform 0.15s ease;
  box-sizing: border-box;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  // 深色模式样式（与浅色保持一致，依赖 el-fill-color-light 自动适配）
  &.dark-mode {
    background-color: transparent;

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  &:active {
    transform: scale(0.96);
  }
}

// 通知铃铛图标
.notification-icon {
  font-size: 16px;
  color: var(--el-text-color-regular);
  transition: color 0.2s ease;
}

// 有未读时图标高亮为主题色，引导用户点击
.button-message.has-unread .notification-icon {
  color: var(--el-color-primary);
}

.button-message:hover .notification-icon {
  color: var(--el-color-primary);
}

// 未读数角标（绝对定位右上角，扁平化红点）
.notification-count {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  /* stylelint-disable color-no-hex -- 红点角标文字在红色背景上必须为白色，无对应 token */
  color: #fff;
  /* stylelint-enable color-no-hex */
  background-color: var(--el-color-danger);
  border-radius: 8px;
  box-sizing: border-box;
  pointer-events: none;
  white-space: nowrap;
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
  .notification-footer.el-button-stack {
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

// 暗色模式 - 使用 html.dark 提升特异性 (避免被 :root 击败)
html.dark .notification-dropdown-popper .notification-dropdown,
html.dark .notification-dropdown.el-dropdown-menu {
  --notif-dropdown-bg: var(--el-bg-color);
  --notif-dropdown-border: var(--border-unified-color);

  background: var(--notif-dropdown-bg);
  border-color: var(--notif-dropdown-border);
}

</style>
