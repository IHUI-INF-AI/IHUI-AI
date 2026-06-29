<!--
  用户区:未登录显示登录按钮;已登录显示反馈按钮(白名单)
  通知中心已移至 Sidebar.vue sidebar-actions 直接渲染
  从原 HeaderActions.vue 抽出
-->
<template>
  <div class="user-menu">
    <button
      v-if="showLoginBtn"
      type="button"
      class="login-button"
      :aria-label="t('auth.login_register')"
      @click.stop="handleLogin"
    >
      <el-icon class="login-icon" aria-hidden="true">
        <User />
      </el-icon>
      <span class="login-text">{{ t('auth.login_register') }}</span>
    </button>

    <div
      v-if="isLoggedIn && showFeedback"
      class="feedback-button"
      role="button"
      tabindex="0"
      @click="emit('feedback-click')"
      @keydown.enter.prevent="emit('feedback-click')"
    >
      <span>{{ t('common.feedback') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { User } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialog } from '@/composables/useLoginDialog'

const { t } = useI18n()
const authStore = useAuthStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)

const showLoginBtn = computed(() => true)

// 反馈按钮白名单手机号(沿用原逻辑)
const FEEDBACK_PHONES = new Set(['19944894487', '18643389808', '19944895160', '17549549976'])

const showFeedback = computed(() => {
  if (!isLoggedIn.value) return false
  let phone = (authStore.user as { phone?: string } | null)?.phone
  if (!phone && typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem('data')
    if (cached) {
      try {
        const userData = JSON.parse(cached)
        phone = userData.authInfo?.phone || userData.phone
      } catch {
        // 解析失败忽略
      }
    }
  }
  return FEEDBACK_PHONES.has(String(phone || '').trim())
})

const emit = defineEmits<{
  (e: 'show-login-popup'): void
  (e: 'feedback-click'): void
}>()

const handleLogin = () => {
  if (isLoggedIn.value) return
  // 弹窗形式：直接打开登录弹窗，不再跳转 /login 路由
  useLoginDialog().open('login')
  emit('show-login-popup')
}
</script>

<style scoped lang="scss">
.user-menu {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.login-button {
  padding: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  background: transparent;
  border: none;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s ease;
  height: 40px;
  min-height: 40px;
  max-height: 40px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  .login-icon {
    display: none;
    font-size: 18px;
  }

  .login-text {
    display: inline;
  }

  &:hover {
    background-color: var(--el-bg-color-hover);
    color: var(--el-text-color-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }
}

@media (width <= 767px) {
  .login-button {
    width: 40px;
    min-width: 40px;
    max-width: 40px;
    padding: 0;
    font-size: 0;
    height: 40px;
    min-height: 40px;
    max-height: 40px;
    line-height: 40px;

    .login-icon {
      display: inline-flex;
      font-size: 18px;
    }

    .login-text {
      display: none;
    }
  }
}
</style>
