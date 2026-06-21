<!--
  顶部导航栏 右侧功能区
  原 HeaderActions.vue 1785 行,重构后只做编排,各子功能抽到 parts/:
    - SearchActions    搜索触发 + 搜索面板
    - LanguageSwitcher 语言切换(完整下拉逻辑)
    - ThemeToggle      明暗模式切换
    - AppDownload      应用下载 + 微信小程序扫码
    - UserMenu         登录/通知/反馈

  全局样式(下拉面板、扫码弹窗)已抽到 styles/_header-actions.scss。
-->
<template>
  <div class="header-right">
    <SearchActions />
    <LanguageSwitcher @change="emit('language-change', $event)" />
    <ThemeToggle />
    <AppDownload />
    <UserMenu @show-login-popup="emit('show-login-popup')" @feedback-click="emit('feedback-click')" />
  </div>
</template>

<script setup lang="ts">
import SearchActions from './parts/SearchActions.vue'
import LanguageSwitcher from './parts/LanguageSwitcher.vue'
import ThemeToggle from './parts/ThemeToggle.vue'
import AppDownload from './parts/AppDownload.vue'
import UserMenu from './parts/UserMenu.vue'
import type { Language } from '@/composables/useLang'

const emit = defineEmits<{
  (e: 'language-change', lang: Language): void
  (e: 'show-login-popup'): void
  (e: 'feedback-click'): void
}>()
</script>

<style scoped lang="scss">
.header-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  border: none;
  outline: none;
  background: transparent;
  padding: 0;
  margin: 0;
  overflow: visible;
  position: static;
  color: var(--el-text-color-primary);
  flex-wrap: nowrap;
  min-width: min-content;
  flex-shrink: 0;
  box-sizing: border-box;
  flex-grow: 0;
  max-width: fit-content;

  > * {
    margin: 0;
    padding: 0;
  }

  @media (width <= 767px) {
    flex-wrap: nowrap;
    justify-content: flex-end;
    padding-right: 0;
  }
}

:global(.glass-header.dark-mode) .header-right {
  color: var(--el-text-color-secondary);
}
</style>
