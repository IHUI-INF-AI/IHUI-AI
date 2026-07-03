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
/* 侧边栏底部登录按钮 — 极简黑 mini 主题
 * 设计意图: 与全局 miniapp 按钮"极简黑白"哲学一致
 * (AGENTS.md 双层级: 主操作用蓝色, 次操作/未登录态用黑白)
 *
 * 高度 36px (介于 nav-item 40px 与 sidebar-actions 28×28 之间),
 * 圆角 10px 复用 token, 无阴影 + 黑底白字克制风格.
 * 颜色消费 _login-tokens.scss 的 $login-mini-* (light=#000 / dark=#fff 自动跟随). */
@use '../../login/_login-tokens.scss' as lt;

.user-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.login-button {
  /* 默认 (桌面端) — 极简黑, 宽度撑满父容器 (居中) */
  width: 100%;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  /* stylelint-disable color-no-hex -- 登录按钮主色白字，无对应 token */
  color: #fff;
  /* stylelint-enable color-no-hex */
  background-color: lt.$login-mini-primary;
  border: none;
  border-radius: lt.$login-btn-radius;
  cursor: pointer;
  height: 36px;
  min-height: 36px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;

  .login-icon {
    display: none;
    font-size: 16px;
    /* stylelint-disable color-no-hex -- 登录图标白字 */
    color: #fff;
    /* stylelint-enable color-no-hex */
  }

  .login-text {
    display: inline;
    /* stylelint-disable color-no-hex -- 登录按钮文字白 */
    color: #fff;
    /* stylelint-enable color-no-hex */
  }

  &:hover:not(.is-disabled) {
    background-color: lt.$login-mini-primary-hover;
  }

  &:active:not(.is-disabled) {
    background-color: lt.$login-mini-primary-active;
  }

  &:focus-visible {
    outline: 2px solid lt.$login-mini-primary;
    outline-offset: 2px;
  }
}

/* 暗色模式: $login-mini-* 自动跟随 --el-text-color-primary 变白 */

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
