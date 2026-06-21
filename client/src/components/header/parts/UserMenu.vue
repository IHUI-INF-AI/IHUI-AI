<!--
  用户区:未登录显示登录按钮;已登录显示通知 + 反馈按钮
  从原 HeaderActions.vue 抽出
-->
<template>
  <div class="user-menu">
    <Notification v-if="isLoggedIn" :is-dark-mode="isDark" />

    <button
      v-if="!isLoggedIn"
      type="button"
      class="login-button"
      @click.stop="handleLogin"
    >
      {{ t('auth.login_register') }}
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
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDarkModeStore } from '@/stores/darkMode'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const darkStore = useDarkModeStore()

const isLoggedIn = computed(() => authStore.isLoggedIn)
const isDark = computed(() => darkStore.isDarkMode ?? darkStore.themeMode === 'dark')

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

const handleLogin = async () => {
  if (isLoggedIn.value) return
  if (route.path === '/login') {
    emit('show-login-popup')
    return
  }
  try {
    await router.push('/login')
    emit('show-login-popup')
  } catch (err: any) {
    if (err?.name !== 'NavigationDuplicated' && err?.name !== 'NavigationRedirected') {
      ElMessage.error(t('common.errors.actionFailed'))
    }
  }
}

const Notification = defineAsyncComponent(() => import('@/components/Notification.vue'))
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
    padding: 0;
    font-size: 13px;
    height: 40px;
    min-height: 40px;
    max-height: 40px;
    line-height: 40px;
  }
}
</style>
