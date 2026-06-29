<!--
  Login.vue - 登录路由占位组件（极简版）
  原独立登录页已重构为弹窗形式（LoginDialog.vue）。
  本组件仅在直接访问 /login 路由时生效：
    1. 若用户已登录 → useLoginAuth 自动重定向回首页或 savedReturnPath
    2. 若未登录 → 打开全局登录弹窗
  弹窗由 App.vue 全局挂载，所有页面共享。
-->
<template>
  <div class="login-route-placeholder" aria-hidden="true">
    <!-- 极简占位，实际登录交互由 LoginDialog 弹窗承载 -->
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useLoginAuth } from '@/composables/login/useLoginAuth'
import { useLoginDialog } from '@/composables/useLoginDialog'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'

const route = useRoute()
const authStore = useAuthStore()
const { showSuccess } = useOperationFeedback()
const { open } = useLoginDialog()

// 复用原登录页的认证状态检查：
// - 已登录则自动跳转到 savedReturnPath 或首页
// - 处理登录成功后的消息提示（query.message）
useLoginAuth({
  onLoginSuccess: () => {
    try {
      const message = route.query.message as string
      if (message) {
        showSuccess(decodeURIComponent(message))
      }
    } catch (err) {
      logger.error('Failed to process login message:', err)
    }
  },
})

onMounted(() => {
  // 延迟一帧以让 useLoginAuth 的 onMounted 先执行（处理已登录跳转）
  // 若仍在 /login 页面（未登录），打开全局登录弹窗
  // URL 保持 /login 以保留 query.source（跨项目登录）/ query.redirect 等参数
  // 用户登录成功后由 useLoginAuth 自动跳转
  requestAnimationFrame(() => {
    if (route.path !== '/login') return
    // 兜底：已登录（且非跨项目 source 场景）由 useLoginAuth 处理跳转，避免重复弹窗
    const hasSource = route.query.source !== undefined
    if (!hasSource && authStore.isLoggedIn) {
      return
    }
    open('login')
  })
})
</script>

<style scoped>
.login-route-placeholder {
  position: fixed;
  inset: 0;
  background: var(--el-bg-color);
  z-index: -1;
  pointer-events: none;
}
</style>
