<!--
  WorkspaceHeader - 工作区顶部栏组件
  包含移动端侧边栏汉堡按钮、面包屑/页面标题
  搜索/语言/主题/用户菜单已迁移至 Sidebar.vue 底部 sidebar-actions
  左侧 AI 面板切换按钮（Trae Work 风格，Ctrl/Cmd+I 快捷键）
-->
<template>
  <header class="workspace-header">
    <!-- 移动端：hamburger 按钮 -->
    <button
      v-if="isMobile"
      class="ws-sidebar-toggle"
      @click="$emit('open-mobile-sidebar')"
      :aria-label="t('hardcoded.header_logo.展开或收起移动端')"
      :title="t('hardcoded.header_logo.展开或收起移动端')"
      type="button"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>

    <!-- 面包屑 / 页面标题 -->
    <div class="ws-breadcrumb">
      <span class="ws-page-title">{{ pageTitle }}</span>
    </div>

    <!-- 右侧操作区：AI 面板切换按钮 -->
    <div class="ws-actions">
      <button
        v-if="!aiPanelIsMobile && showAiToggle"
        class="ws-ai-toggle"
        :class="{ active: aiPanelIsOpen }"
        @click="aiPanelToggle"
        :aria-label="aiToggleLabel"
        :title="aiToggleLabel"
        :aria-pressed="aiPanelIsOpen"
        type="button"
      >
        <!-- MessageCircle 图标（Lucide 24x24 stroke） -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSidebar } from '@/composables/useSidebar'
import { useAiPanel } from '@/composables/useAiPanel'

defineEmits(['open-mobile-sidebar'])

const route = useRoute()
const { t } = useI18n()

// ── 移动端检测（来自 useSidebar 单例，与 Sidebar/App.vue 共享） ──
const { isMobile } = useSidebar()

// ── AI 面板状态（来自 useAiPanel 单例，与 App.vue 共享） ──
const {
  isOpen: aiPanelIsOpen,
  isMobile: aiPanelIsMobile,
  toggle: aiPanelToggle,
} = useAiPanel()

// ── AI 切换按钮可见性：与 App.vue 的 showGlobalChat 逻辑保持一致 ──
// 在 AIManagement / login / register / admin 路由下不显示按钮
// （login/register 是 bare page 不会渲染 WorkspaceHeader，此处仅防御 AIManagement）
const showAiToggle = computed(
  () =>
    route.name !== 'AIManagement' &&
    route.name !== 'login' &&
    route.name !== 'register' &&
    !route.path.startsWith('/admin-classic') &&
    !route.path.startsWith('/m/admin'),
)

// ── 平台检测：Mac 显示 ⌘I，其他平台显示 Ctrl+I ──
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

const aiToggleLabel = computed(() => {
  const key = aiPanelIsOpen.value
    ? 'navigation.closeAiPanel'
    : 'navigation.openAiPanel'
  // 未配置 i18n 时回退到中文文案
  const translated = t(key)
  const fallback = aiPanelIsOpen.value ? '关闭 AI 助手' : '打开 AI 助手'
  const label = translated === key ? fallback : translated
  return `${label} (${isMac ? '⌘I' : 'Ctrl+I'})`
})

// ── 页面标题 ──
// meta.title 可能是 i18n key（如 'routes.home'），需要翻译
const pageTitle = computed(() => {
  const meta = route.meta as Record<string, unknown>
  const metaTitle = typeof meta?.title === 'string' ? meta.title : undefined
  if (metaTitle) {
    const raw = metaTitle
    // 如果值是 i18n key 格式（如 'routes.home'），尝试翻译
    if (raw.startsWith('routes.') || raw.startsWith('seo.') || raw.startsWith('common.')) {
      const translated = t(raw)
      if (translated !== raw) return translated
    }
    return raw
  }

  const routeName = route.name as string | symbol | undefined
  if (routeName && typeof routeName === 'string') {
    const i18nKey = `routes.${routeName}`
    const translated = t(i18nKey)
    if (translated !== i18nKey) return translated
    return routeName.replace(/([A-Z])/g, ' $1').trim()
  }

  const segments = route.path.split('/').filter(Boolean)
  if (segments.length > 0) {
    return segments[segments.length - 1]
  }

  return t('common.home')
})
</script>
