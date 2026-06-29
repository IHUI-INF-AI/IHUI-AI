<!--
  Register.vue - 注册路由占位组件（极简版）
  原独立注册页已重构为弹窗形式（LoginDialog.vue 以 register 模式打开）。
  本组件仅在直接访问 /register 路由时生效：
    1. 若用户已登录 → 自动重定向回首页
    2. 若未登录 → 打开全局登录弹窗（register 模式）
-->
<template>
  <div class="register-route-placeholder" aria-hidden="true">
    <!-- 极简占位，实际注册交互由 LoginDialog 弹窗（register 模式）承载 -->
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLoginDialog } from '@/composables/useLoginDialog'
import { useAuthStore } from '@/stores/auth'
import { StorageManager, STORAGE_KEYS, TokenStorage } from '@/utils/storage'
import { isLoginExpired } from '@/utils/login-duration'
import { logger } from '@/utils/logger'

const route = useRoute()
const router = useRouter()
const { open } = useLoginDialog()
const authStore = useAuthStore()

/**
 * 检查是否已登录，已登录则重定向回首页
 * 复用 useLoginAuth 的核心判断逻辑（但不引入其 watch，避免重复跳转）
 */
const checkLoggedIn = (): boolean => {
  try {
    const token = TokenStorage.getToken()
    const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
    const isExpired = expiryTime !== null && isLoginExpired(expiryTime)
    const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
    const isStoreLoggedIn = authStore.isLoggedIn && !!authStore.token && !!authStore.user

    if (token && !isExpired && userData && isStoreLoggedIn) {
      void router.replace('/')
      return true
    }

    if (isExpired || !userData) {
      StorageManager.removeItem(STORAGE_KEYS.TOKEN)
      StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
      StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
      StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
      if (authStore.token) {
        void authStore.logout()
      }
    }

    return false
  } catch (err) {
    logger.error('[Register] Failed to check login status:', err)
    return false
  }
}

onMounted(() => {
  // 已登录则跳转首页；未登录则打开注册弹窗
  if (checkLoggedIn()) return
  requestAnimationFrame(() => {
    if (route.path === '/register') {
      open('register')
    }
  })
})
</script>

<style scoped>
.register-route-placeholder {
  position: fixed;
  inset: 0;
  background: var(--el-bg-color);
  z-index: -1;
  pointer-events: none;
}
</style>
