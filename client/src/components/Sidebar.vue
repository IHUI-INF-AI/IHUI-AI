<!--
  Sidebar - 用户端侧边栏组件
  Trae/VS Code 风格左侧导航，支持折叠/展开、移动端抽屉、分组导航
  复用 HeaderNavigation.vue 的菜单项数据与 activeIndex 逻辑
-->
<template>
  <aside
    class="app-sidebar"
    :class="{ collapsed: isCollapsed, open: isMobileOpen, 'is-resizing': isResizing }"
    :style="{ '--sidebar-user-width': sidebarWidth + 'px' }"
  >
    <!-- 顶部: Logo + 折叠按钮 -->
    <div class="sidebar-header">
      <img :src="logoSrc" class="sidebar-logo" @click="goHome" :alt="t('common.siteName')" tabindex="0" @keydown.enter="goHome" />
      <button
        class="sidebar-collapse-btn"
        @click="toggleCollapse"
        :aria-label="collapseLabel"
        :title="collapseLabel"
      >
        <!-- PanelLeftClose / PanelLeftOpen 图标 (inline SVG) -->
        <svg
          v-if="isCollapsed"
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        <svg
          v-else
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <polyline points="16 15 13 12 16 9" />
        </svg>
      </button>
    </div>

    <!-- 导航列表 -->
    <nav ref="navRef" class="sidebar-nav" role="navigation" :aria-label="t('navigation.sidebar')">
      <!-- 活跃指示条（独立元素，随路由切换滑动过渡） -->
      <div class="nav-active-indicator" :style="indicatorStyle" aria-hidden="true" />
      <!-- 新建对话按钮：打开 AI 助手面板（与 WorkspaceHeader 的 ws-ai-toggle 行为一致） -->
      <div v-if="!aiPanelIsMobile" class="nav-item-wrapper nav-new-chat-wrapper">
        <el-tooltip
          :content="t('aiChat.newConversation')"
          placement="right"
          :disabled="!isCollapsed"
          :show-after="300"
          :offset="4"
        >
          <button
            class="nav-item nav-new-chat"
            :class="{ active: aiPanelIsOpen }"
            :aria-label="t('aiChat.newConversation')"
            :aria-pressed="aiPanelIsOpen"
            @click="handleNewChat"
            type="button"
          >
            <component :is="MessageCircleIcon" class="nav-item-icon" />
            <span v-if="!isCollapsed" class="nav-item-label">{{ t('aiChat.newConversation') }}</span>
          </button>
        </el-tooltip>
      </div>
      <!-- 对话历史模块：展开态渲染，折叠态完全隐藏（100px 紧凑态放不下列表） -->
      <SidebarChatHistory :is-collapsed="isCollapsed" @new-chat="handleNewChat" />
      <div v-for="group in navGroups" :key="group.key" class="nav-group">
        <button
          v-if="group.label && !isCollapsed"
          class="nav-group-label"
          type="button"
          :aria-expanded="isGroupExpanded(group.key) ? 'true' : 'false'"
          :aria-controls="`nav-group-${group.key}-content`"
          @click="toggleGroup(group.key)"
        >
          <span class="nav-group-label-text">{{ group.label }}</span>
          <svg
            class="nav-group-chevron"
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div
          :id="`nav-group-${group.key}-content`"
          class="nav-group-items"
          role="group"
          :aria-label="group.label"
          v-show="isCollapsed || isGroupExpanded(group.key)"
        >
          <div v-for="item in group.items" :key="item.key" class="nav-item-wrapper">
            <!-- 折叠态 + 有 children: el-popover hover 显示子菜单浮层（VS Code 风格） -->
            <el-popover
              v-if="isCollapsed && item.children && item.children.length > 0"
              placement="right-start"
              :width="220"
              trigger="hover"
              :show-after="200"
              :hide-after="150"
              popper-class="nav-collapsed-submenu-popper"
            >
              <template #reference>
                <button
                  class="nav-item"
                  :class="{
                    active: activeKey === item.key || isChildActive(item),
                    'has-children': true,
                  }"
                  :tabindex="itemTabindex(group.key)"
                  :aria-label="item.label"
                  @click="handleNavClick(item)"
                  type="button"
                >
                  <component v-if="item.icon" :is="item.icon" class="nav-item-icon" />
                </button>
              </template>
              <div class="nav-collapsed-submenu">
                <div class="nav-collapsed-submenu-title">{{ item.label }}</div>
                <button
                  v-for="child in item.children"
                  :key="child.key"
                  class="nav-collapsed-submenu-item"
                  :class="{ active: activeKey === child.key }"
                  @click="handleSubnavClick(child)"
                  type="button"
                >
                  <component v-if="child.icon" :is="child.icon" class="nav-collapsed-submenu-item-icon" />
                  <span class="nav-collapsed-submenu-item-label">{{ child.label }}</span>
                </button>
              </div>
            </el-popover>
            <!-- 其他情况: el-tooltip（无 children 或展开态）-->
            <el-tooltip
              v-else
              :content="item.label"
              placement="right"
              :disabled="!isCollapsed"
              :show-after="300"
              :offset="4"
            >
              <button
                class="nav-item"
                :class="{
                  active: activeKey === item.key || isChildActive(item),
                  expanded: item.children && item.children.length > 0 && expandedKey === item.key,
                  'has-children': item.children && item.children.length > 0,
                }"
                :tabindex="itemTabindex(group.key)"
                :aria-expanded="item.children && item.children.length > 0 ? (expandedKey === item.key ? 'true' : 'false') : undefined"
                :aria-label="isCollapsed ? item.label : undefined"
                @click="handleNavClick(item)"
                type="button"
              >
                <component v-if="item.icon" :is="item.icon" class="nav-item-icon" />
                <span v-if="!isCollapsed" class="nav-item-label">{{ item.label }}</span>
                <svg
                  v-if="item.children && item.children.length > 0 && !isCollapsed"
                  class="nav-item-chevron"
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </el-tooltip>
            <!-- 展开态二级菜单（带高度过渡动画，v-if 仅在折叠态移除） -->
            <div
              v-if="!isCollapsed && item.children && item.children.length > 0"
              class="nav-submenu"
              :class="{ 'is-expanded': expandedKey === item.key }"
              role="group"
              :aria-label="item.label"
            >
              <button
                v-for="child in item.children"
                :key="child.key"
                class="nav-subitem"
                :class="{ active: activeKey === child.key }"
                @click="handleSubnavClick(child)"
                type="button"
              >
                <component v-if="child.icon" :is="child.icon" class="nav-subitem-icon" />
                <span class="nav-subitem-label">{{ child.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- 底部: 用户信息 / 操作区 / 版权 -->
    <div class="sidebar-footer">
      <!-- 用户区: 已登录显示头像+用户名, 点击进入个人中心 -->
      <div v-if="isLoggedIn" class="sidebar-user" @click="goToProfile">
        <img :src="userAvatar" :alt="userName" class="sidebar-user-avatar" loading="lazy" />
        <span v-if="!isCollapsed" class="sidebar-user-name">{{ userName }}</span>
      </div>

      <!-- 操作图标条: 搜索 / 语言 / 主题 / 下载 / 通知
           role=group + aria-label 让屏幕阅读器识别为一组相关操作 -->
      <div
        class="sidebar-actions"
        :class="{ 'is-collapsed': isCollapsed }"
        role="group"
        :aria-label="t('navigation.sidebar')"
      >
        <SearchActions />
        <LanguageSwitcher @change="emit('language-change', $event)" />
        <ThemeToggle />
        <AppDownload />
        <Notification v-if="isLoggedIn" :is-dark-mode="isDark" />
      </div>

      <!-- 登录按钮: 单独一排, Trae Work 风格 (临时调试: 强制显示) -->
      <div
        v-if="true"
        class="sidebar-login-row"
        :class="{ 'is-collapsed': isCollapsed }"
      >
        <UserMenu
          @show-login-popup="emit('show-login-popup')"
          @feedback-click="emit('feedback-click')"
        />
      </div>

    </div>

    <!-- 右侧拖拽手柄（调整侧边栏宽度，桌面端始终显示：折叠态可向右拖展开） -->
    <div
      v-if="!isMobile"
      class="app-sidebar-resize-handle"
      @mousedown.prevent="startResize"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="isCollapsed ? sidebarCollapsedWidth : sidebarWidth"
      :aria-valuemin="sidebarCollapsedWidth"
      :aria-valuemax="sidebarMaxWidth"
      tabindex="0"
    />
  </aside>
  <div v-if="isMobileOpen" class="sidebar-overlay" @click="closeMobile" />
</template>

<script setup lang="ts">
import { ref, computed, h, markRaw, onMounted, watch, nextTick, defineAsyncComponent, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDarkModeStore } from '@/stores/darkMode'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'
import { useAiPanel } from '@/composables/useAiPanel'
import { useCleanup } from '@/composables/useCleanup'
import type { Language } from '@/composables/useLang'
import SearchActions from '@/components/header/parts/SearchActions.vue'
import LanguageSwitcher from '@/components/header/parts/LanguageSwitcher.vue'
import ThemeToggle from '@/components/header/parts/ThemeToggle.vue'
import AppDownload from '@/components/header/parts/AppDownload.vue'
import UserMenu from '@/components/header/parts/UserMenu.vue'
import SidebarChatHistory from '@/components/SidebarChatHistory.vue'
const Notification = defineAsyncComponent(() => import('@/components/Notification.vue'))

// ── 向父组件透传事件 (与原 WorkspaceHeader 事件签名保持一致) ──
const emit = defineEmits<{
  (e: 'language-change', lang: Language): void
  (e: 'show-login-popup'): void
  (e: 'feedback-click'): void
}>()

const cleanup = useCleanup()

/* ═══════════════════════════════════════════════════════════════════════════
 * 侧边栏图标 — 全部使用 Lucide 24×24 stroke 风格 inline SVG，
 * 与 el-icon 解耦，保证视觉统一。
 * ═══════════════════════════════════════════════════════════════════════════ */

const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg' as const,
  width: '1em',
  height: '1em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
}

const HomeIcon = markRaw({
  name: 'HomeIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' }),
      h('path', { d: 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
    ])
  },
})

const BotIcon = markRaw({
  name: 'BotIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M12 8V4H8' }),
      h('rect', { width: '16', height: '12', x: '4', y: '8', rx: '2' }),
      h('path', { d: 'M2 14h2' }),
      h('path', { d: 'M20 14h2' }),
      h('path', { d: 'M15 13v2' }),
      h('path', { d: 'M9 13v2' }),
    ])
  },
})

const GlobeIcon = markRaw({
  name: 'GlobeIcon',
  render() {
    return h('svg', svgBase, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('line', { x1: '2', x2: '22', y1: '12', y2: '12' }),
      h('path', { d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' }),
    ])
  },
})

const GraduationCapIcon = markRaw({
  name: 'GraduationCapIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z' }),
      h('path', { d: 'M22 10v6' }),
      h('path', { d: 'M6 12.5V16a6 3 0 0 0 12 0v-3.5' }),
    ])
  },
})

const UsersIcon = markRaw({
  name: 'UsersIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '9', cy: '7', r: '4' }),
      h('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }),
      h('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }),
    ])
  },
})

const SparklesIcon = markRaw({
  name: 'SparklesIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' }),
      h('path', { d: 'M5 3v4' }),
      h('path', { d: 'M19 17v4' }),
      h('path', { d: 'M3 5h4' }),
      h('path', { d: 'M17 19h4' }),
    ])
  },
})

const FilesIcon = markRaw({
  name: 'FilesIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }),
      h('path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }),
      h('path', { d: 'M10 18v-4' }),
      h('path', { d: 'M14 18v-2' }),
      h('path', { d: 'M14 12H6' }),
    ])
  },
})

const NewspaperIcon = markRaw({
  name: 'NewspaperIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2' }),
      h('path', { d: 'M18 14h-8' }),
      h('path', { d: 'M15 18h-5' }),
      h('path', { d: 'M10 6h8v4h-8V6Z' }),
    ])
  },
})

const InfoIcon = markRaw({
  name: 'InfoIcon',
  render() {
    return h('svg', svgBase, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('path', { d: 'M12 16v-4' }),
      h('path', { d: 'M12 8h.01' }),
    ])
  },
})

const BriefcaseIcon = markRaw({
  name: 'BriefcaseIcon',
  render() {
    return h('svg', svgBase, [
      h('rect', { width: '20', height: '14', x: '2', y: '7', rx: '2', ry: '2' }),
      h('path', { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }),
    ])
  },
})

const MessageCircleIcon = markRaw({
  name: 'MessageCircleIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' }),
    ])
  },
})

/* ── 教育平台子菜单图标 ── */
const BookOpenIcon = markRaw({
  name: 'BookOpenIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M12 7v14' }),
      h('path', { d: 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z' }),
    ])
  },
})

const MapIcon = markRaw({
  name: 'MapIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z' }),
      h('path', { d: 'M15 5.764v15' }),
      h('path', { d: 'M9 3.236v15' }),
    ])
  },
})

const VideoIcon = markRaw({
  name: 'VideoIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'm22 8-6 4 6 4V8Z' }),
      h('rect', { width: '14', height: '12', x: '2', y: '6', rx: '2', ry: '2' }),
    ])
  },
})

const ClockIcon = markRaw({
  name: 'ClockIcon',
  render() {
    return h('svg', svgBase, [
      h('circle', { cx: '12', cy: '12', r: '10' }),
      h('polyline', { points: '12 6 12 12 16 14' }),
    ])
  },
})

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const darkModeStore = useDarkModeStore()
const authStore = useAuthStore()

// ── 侧边栏状态（来自单例 composable，与 WorkspaceHeader/App.vue 共享） ──
// isMobile 用于 Ctrl/Cmd+B 快捷键的"桌面端限定"判断（移动端无折叠概念）
// width/setWidth: 展开态宽度（默认 140，可向左拖到 80 紧凑 / 60 折叠，持久化）
const {
  isCollapsed,
  isMobile,
  isMobileOpen,
  width: sidebarWidth,
  maxWidth: sidebarMaxWidth,
  setWidth: setSidebarWidth,
  toggleCollapse,
  closeMobile,
} = useSidebar()

// ── AI 面板状态（来自单例 composable，与 WorkspaceHeader/App.vue 共享） ──
// 用于"新建对话"按钮：点击切换 AI 助手面板，与 ws-ai-toggle 行为一致
const {
  isOpen: aiPanelIsOpen,
  isMobile: aiPanelIsMobile,
  toggle: aiPanelToggle,
} = useAiPanel()

// ── 拖拽调整侧边栏宽度 ──
// 手柄位于侧边栏右侧，向右拖 delta 正 → 宽度增加
// 拖拽过程禁用过渡（is-resizing 类）+ 禁止文本选中，保证流畅
// 折叠态下也可拖拽：从折叠宽度(60px)起算，向右拖超过阈值(80px)自动展开
// 展开态范围：80-140px（MIN_WIDTH=80, MAX_WIDTH=140）
const sidebarCollapsedWidth = 60
const isResizing = ref(false)
const startResize = (e: MouseEvent): void => {
  if (isMobile.value) return
  e.preventDefault()
  isResizing.value = true
  const startX = e.clientX
  // 折叠态从折叠宽度起算；展开态从用户拖拽宽度起算
  const startWidth = isCollapsed.value ? sidebarCollapsedWidth : sidebarWidth.value
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'

  const onMove = (ev: MouseEvent): void => {
    const delta = ev.clientX - startX
    setSidebarWidth(startWidth + delta)
  }
  const onUp = (): void => {
    isResizing.value = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// ── 用户信息 ──
const userAvatar = computed(() => authStore.avatar || '/images/common/userIcon.svg')
const userName = computed(() => authStore.nickname || authStore.userUuid || '')
const isLoggedIn = computed(() => authStore.isLoggedIn)
// 深色模式状态（传给 Notification 组件）
const isDark = computed(() => darkModeStore.isDarkMode ?? darkModeStore.themeMode === 'dark')

// ── Logo ──
const logoSrc = computed(() => {
  const baseUrl = import.meta.env.BASE_URL || '/'
  return darkModeStore.isDarkMode ? `${baseUrl}images/bailogo.svg` : `${baseUrl}images/logo.svg`
})

// ── 平台检测：Mac 显示 ⌘B，其他平台显示 Ctrl+B（与快捷键监听逻辑对应）──
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
const shortcutHint = isMac ? '⌘B' : 'Ctrl+B'

// ── 折叠按钮 aria-label/title（含快捷键提示，便于用户发现 Ctrl/Cmd+B）──
const collapseLabel = computed(() => {
  const key = isCollapsed.value ? 'navigation.expandSidebar' : 'navigation.collapseSidebar'
  return `${t(key)} (${shortcutHint})`
})

// ── 导航容器 ref（用于自动滚动） ──
const navRef = ref<HTMLElement | null>(null)

// ── 自动滚动到活跃导航项 ──
const scrollToActiveNav = () => {
  if (!navRef.value) return
  const activeEl = navRef.value.querySelector('.nav-group .nav-item.active') as HTMLElement | null
  if (!activeEl) return
  activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// ── 活跃指示条位置（独立元素，随路由切换滑动过渡） ──
const indicatorStyle = ref<Record<string, string>>({})

const updateActiveIndicator = () => {
  if (!navRef.value) {
    indicatorStyle.value = { opacity: '0' }
    return
  }
  const activeEl = navRef.value.querySelector('.nav-group .nav-item.active') as HTMLElement | null
  if (!activeEl) {
    indicatorStyle.value = { opacity: '0' }
    return
  }
  // active 项位于已被 v-show 隐藏的分组（display:none 自身或祖先）时，
  // offsetParent 为 null、offsetTop/offsetHeight 均为 0，指示条会跑偏到 (0,0) 位置
  // 此时应直接隐藏，避免在分组收起后仍残留小黑条
  if (activeEl.offsetParent === null) {
    indicatorStyle.value = { opacity: '0' }
    return
  }
  // 累加 offsetTop 链，计算相对于 nav 的位置（不受滚动影响）
  let top = 0
  let current: HTMLElement | null = activeEl
  while (current && current !== navRef.value) {
    top += current.offsetTop
    current = current.offsetParent as HTMLElement | null
  }
  const height = activeEl.offsetHeight
  // 指示条高度为 nav-item 高度的 70%，垂直居中（增强活跃状态视觉反馈）
  const indicatorHeight = Math.round(height * 0.7)
  const indicatorTop = top + Math.round((height - indicatorHeight) / 2)
  indicatorStyle.value = {
    transform: `translateY(${indicatorTop}px)`,
    height: `${indicatorHeight}px`,
    opacity: '1',
  }
}

// ── activeKey - 基于路径前缀匹配表的路由映射 ──
const activeKey = computed<string>(() => {
  const routeName = (route as { name?: string | symbol }).name as string
  const routePath = route.path

  // 1. 精确路由名匹配（优先，用于无规律路径的页面）
  const nameMap: Record<string, string> = {
    home: 'home',
    xuqiu: 'xuqiu',
    xuqiuDetail: 'xuqiu',
    plaza: 'xuqiu',
    agents: 'agents',
    agentDetail: 'agents',
    agentsCategory: 'agents',
    agentsCreate: 'agents',
    openPlatform: 'openPlatform',
    openPlatformProxy: 'openPlatform',
    openDashboard: 'openPlatform',
    learnAI: 'learnAI',
    learnAIProxy: 'learnAI',
    learnHome: 'learnAI',
    // 课程中心
    learnList: 'learnCourses',
    learnDetail: 'learnCourses',
    learnPlay: 'learnCourses',
    learnTopic: 'learnCourses',
    learnTopicDetail: 'learnCourses',
    learnBuyConfirm: 'learnCourses',
    learnPayment: 'learnCourses',
    learnPaymentConfirm: 'learnCourses',
    learnRate: 'learnCourses',
    courses: 'learnCourses',
    courseDetail: 'learnCourses',
    // 学习地图
    learnMap: 'learnMapNav',
    // 直播课堂
    liveList: 'liveClass',
    liveDetail: 'liveClass',
    livePlay: 'liveClass',
    // 我的学习
    learnHomework: 'myLearning',
    learnCertificate: 'myLearning',
    learnCertificateDownload: 'myLearning',
    memberLearnRecord: 'myLearning',
    memberHomework: 'myLearning',
    memberCertificate: 'myLearning',
    aiCommunity: 'aiCommunity',
    share: 'aiCommunity',
    shareDetail: 'aiCommunity',
    askList: 'aiCommunity',
    askDetail: 'aiCommunity',
    circleList: 'aiCommunity',
    circleDetail: 'aiCommunity',
    examList: 'aiCommunity',
    examDo: 'aiCommunity',
    ranking: 'aiCommunity',
    aiWorld: 'aiWorld',
    aiWorldDetail: 'aiWorld',
    aiWorldBannerDetail: 'aiWorld',
    documentCenter: 'documentCenter',
    newsCenter: 'newsCenter',
    about: 'aboutUs',
    aboutUs: 'aboutUs',
    contactUs: 'aboutUs',
    feedback: 'aboutUs',
    becomeSupplier: 'becomeSupplier',
  }
  if (routeName && nameMap[routeName]) return nameMap[routeName]

  // 2. 路径前缀匹配（兜底，覆盖所有子路由）
  const prefixMap: Array<[string, string]> = [
    // 教育平台子菜单（更具体的前缀放前面，确保优先匹配）
    ['/learn/list', 'learnCourses'],
    ['/learn/detail', 'learnCourses'],
    ['/learn/topic', 'learnCourses'],
    ['/learn/buyconfirm', 'learnCourses'],
    ['/learn/payment', 'learnCourses'],
    ['/learn/rate', 'learnCourses'],
    ['/learn/map', 'learnMapNav'],
    ['/learn/homework', 'myLearning'],
    ['/learn/certificate', 'myLearning'],
    ['/live/', 'liveClass'],
    ['/live', 'liveClass'],
    ['/member/learn-record', 'myLearning'],
    ['/member/homework', 'myLearning'],
    ['/member/certificate', 'myLearning'],
    // 教育平台父级（兜底）
    ['/learn/', 'learnAI'],
    ['/learn', 'learnAI'],
    ['/learn-ai', 'learnAI'],
    ['/courses/', 'learnCourses'],
    ['/courses', 'learnCourses'],
    ['/agents/', 'agents'],
    ['/agents', 'agents'],
    ['/ai-world/', 'aiWorld'],
    ['/ai-world', 'aiWorld'],
    ['/ai-community/', 'aiCommunity'],
    ['/ai-community', 'aiCommunity'],
    ['/share/', 'aiCommunity'],
    ['/share', 'aiCommunity'],
    ['/ask/', 'aiCommunity'],
    ['/ask', 'aiCommunity'],
    ['/circle/', 'aiCommunity'],
    ['/circle', 'aiCommunity'],
    ['/exam/', 'aiCommunity'],
    ['/exam', 'aiCommunity'],
    ['/ranking', 'aiCommunity'],
    ['/about/', 'aboutUs'],
    ['/feedback', 'aboutUs'],
    ['/contact-us', 'aboutUs'],
    ['/open/', 'openPlatform'],
    ['/open', 'openPlatform'],
    ['/docs', 'documentCenter'],
    ['/support/', 'documentCenter'],
    ['/news-center', 'newsCenter'],
    ['/xuqiu', 'xuqiu'],
    ['/plaza', 'xuqiu'],
  ]
  for (const [prefix, key] of prefixMap) {
    if (routePath === prefix || routePath.startsWith(prefix)) return key
  }

  // 3. 首页兜底
  if (routePath === '/' || routePath === '/home') return 'home'

  return ''
})

// ── 子菜单展开状态 ──
const expandedKey = ref<string | null>(null)

// ── 分组折叠状态（默认全部展开，记录被用户手动收起的分组）──
const collapsedGroups = ref<Set<string>>(new Set())
const isGroupExpanded = (key: string) => !collapsedGroups.value.has(key)
const toggleGroup = (key: string) => {
  const next = new Set(collapsedGroups.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  collapsedGroups.value = next
}

// ── Tab 焦点顺序：展开态下收起分组的 nav-item 从 Tab 顺序移除 ──
// ARIA 最佳实践：被 v-show 隐藏的内容仍留在 DOM 中，默认仍可 Tab 聚焦，
// 此处通过 tabindex=-1 让收起分组的项退出 Tab 顺序，避免焦点跳到不可见项。
// 折叠态下所有分组都显示（v-show=true），故全部保留 Tab 可达。
const itemTabindex = (groupKey: string): 0 | -1 => {
  if (isCollapsed.value) return 0
  return isGroupExpanded(groupKey) ? 0 : -1
}

// ── 导航分组 ──
interface NavItem {
  key: string
  label: string
  path: string
  icon?: Component | Record<string, unknown>
  handler?: () => void
  children?: NavItem[]
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const navGroups = computed<NavGroup[]>(() => {
  const goToPath = (path: string) => {
    router.push(path)
    closeMobile()
  }

  return [
    {
      key: 'core',
      label: t('navigation.coreFeatures'),
      items: [
        {
          key: 'home',
          label: t('common.home'),
          path: '/',
          icon: HomeIcon,
          handler: () => goToPath('/'),
        },
        {
          key: 'agents',
          label: t('navigation.aiStore'),
          path: '/agents',
          icon: BotIcon,
          handler: () => goToPath('/agents'),
        },
        {
          key: 'openPlatform',
          label: t('routes.openPlatform'),
          path: '/open',
          icon: GlobeIcon,
          handler: () => goToPath('/open'),
        },
        {
          key: 'learnAI',
          label: t('common.learnAI'),
          path: '/learn-ai',
          icon: GraduationCapIcon,
          handler: () => goToPath('/learn-ai'),
          children: [
            {
              key: 'learnCourses',
              label: t('navigation.learnCourses'),
              path: '/learn/list',
              icon: BookOpenIcon,
              handler: () => goToPath('/learn/list'),
            },
            {
              key: 'learnMapNav',
              label: t('navigation.learnMap'),
              path: '/learn/map',
              icon: MapIcon,
              handler: () => goToPath('/learn/map'),
            },
            {
              key: 'liveClass',
              label: t('navigation.liveClass'),
              path: '/live',
              icon: VideoIcon,
              handler: () => goToPath('/live'),
            },
            {
              key: 'myLearning',
              label: t('navigation.myLearning'),
              path: '/member/learn-record',
              icon: ClockIcon,
              handler: () => goToPath('/member/learn-record'),
            },
          ],
        },
        {
          key: 'aiCommunity',
          label: t('routes.aiCommunity'),
          path: '/ai-community',
          icon: UsersIcon,
          handler: () => goToPath('/ai-community'),
        },
        {
          key: 'aiWorld',
          label: t('common.aiWorld'),
          path: '/ai-world',
          icon: SparklesIcon,
          handler: () => goToPath('/ai-world'),
        },
      ],
    },
    {
      key: 'support',
      label: t('navigation.serviceSupport'),
      items: [
        {
          key: 'documentCenter',
          label: t('navigation.documentCenter'),
          path: '/support/document-center',
          icon: FilesIcon,
          handler: () => goToPath('/support/document-center'),
        },
        {
          key: 'newsCenter',
          label: t('navigation.newsCenter'),
          path: '/about/news-center',
          icon: NewspaperIcon,
          handler: () => goToPath('/about/news-center'),
        },
        {
          key: 'aboutUs',
          label: t('navigation.aboutUs'),
          path: '/about/about-us',
          icon: InfoIcon,
          handler: () => goToPath('/about/about-us'),
        },
        {
          key: 'becomeSupplier',
          label: t('navigation.becomeSupplier'),
          path: '/about/become-supplier',
          icon: BriefcaseIcon,
          handler: () => goToPath('/about/become-supplier'),
        },
      ],
    },
  ]
})

// ── 导航点击 ──
const handleNavClick = (item: NavItem) => {
  // 如果有子菜单且侧边栏展开，切换展开状态
  if (item.children && item.children.length > 0 && !isCollapsed.value) {
    expandedKey.value = expandedKey.value === item.key ? null : item.key
    return
  }
  // 关闭已展开的子菜单
  expandedKey.value = null
  // 执行导航（折叠态下有 children 的项跳转到父级 path）
  if (item.handler) {
    item.handler()
  } else if (item.path) {
    router.push(item.path)
    closeMobile()
  }
}

// ── 子菜单项点击 ──
const handleSubnavClick = (child: NavItem) => {
  if (child.handler) {
    child.handler()
  } else if (child.path) {
    router.push(child.path)
    closeMobile()
  }
}

// ── 判断子菜单是否有活跃项（用于父级高亮）──
const isChildActive = (item: NavItem): boolean => {
  if (!item.children || item.children.length === 0) return false
  return item.children.some(child => activeKey.value === child.key)
}

// ── 快捷导航 ──
const goHome = () => {
  router.push('/')
  closeMobile()
}

// ── 新建对话：打开 AI 助手面板（与 WorkspaceHeader 的 ws-ai-toggle 一致） ──
const handleNewChat = () => {
  aiPanelToggle()
}

// ── 跳转用户中心 (sidebar-user 点击行为, 与 Notification 下拉菜单内"用户中心"按钮一致) ──
const goToProfile = () => {
  router.push('/user')
  closeMobile()
}

// ── Ctrl/Cmd+B 快捷键：切换侧边栏折叠（与 VS Code 习惯一致） ──
// 规则：
//   1. 仅桌面端生效（移动端无折叠概念，由 isMobile 排除）
//   2. 排除输入框聚焦场景（input/textarea/contenteditable/select），避免与编辑冲突
//   3. 阻止默认行为（浏览器部分平台 Cmd+B 有"加粗"等其他绑定）
const handleToggleShortcut = (e: KeyboardEvent) => {
  // 移动端不响应
  if (isMobile.value) return
  // 仅响应 Ctrl+B（Win/Linux）或 Cmd+B（Mac）
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key !== 'b') return
  // 排除输入框聚焦场景
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    ) {
      return
    }
  }
  e.preventDefault()
  toggleCollapse()
}

// ── "/" 键聚焦搜索快捷键 ──
// 与 GitHub/VS Code 等开发工具一致, 按 / 键快速打开搜索
// 规则:
//   1. 排除输入框聚焦场景（input/textarea/contenteditable/select），避免与编辑冲突
//   2. 阻止默认行为（部分浏览器 / 键有"快速查找"等绑定）
//   3. 优先调用 window.openSearchModal(), 回退 window.openCommandPalette()
const handleSearchShortcut = (e: KeyboardEvent) => {
  // 仅响应 / 键 (无修饰键)
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  if (e.key !== '/') return
  // 排除输入框聚焦场景
  const target = e.target as HTMLElement | null
  if (target) {
    const tag = target.tagName
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    ) {
      return
    }
  }
  e.preventDefault()
  const w = window as Window & { openSearchModal?: () => void; openCommandPalette?: () => void }
  if (w.openSearchModal) w.openSearchModal()
  else if (w.openCommandPalette) w.openCommandPalette()
}

// ── Esc 键关闭移动端抽屉 ──
// 移动端抽屉打开时, 按 Esc 键关闭, 提升键盘用户操作效率
// 规则:
//   1. 仅在移动端抽屉打开时响应（桌面端 Esc 无效）
//   2. 阻止默认行为（避免影响其他 Esc 绑定）
const handleEscShortcut = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  if (!isMobileOpen.value) return
  e.preventDefault()
  closeMobile()
}

// ── 生命周期 ──
// 折叠状态 / 移动端检测 / resize 监听由 useSidebar 单例管理，组件无需重复
onMounted(() => {
  cleanup.addEventListener(window, 'keydown', handleToggleShortcut)
  cleanup.addEventListener(window, 'keydown', handleSearchShortcut)
  cleanup.addEventListener(window, 'keydown', handleEscShortcut)
  nextTick(() => {
    scrollToActiveNav()
    updateActiveIndicator()
  })
})

// 路由变化时自动滚动到活跃项 + 更新指示条位置
watch(() => route.path, () => {
  nextTick(() => {
    scrollToActiveNav()
    updateActiveIndicator()
  })
})

// 子菜单项 active 时自动展开父级（仅展开态，折叠态不展开）
// 注: navGroups.value 显式断言为 NavGroup[] 避免 Vue 响应式 unwrap 将 key 推断为 ref 类型
watch(() => activeKey.value, (newKey: string) => {
  if (!newKey || isCollapsed.value) return
  const groups = navGroups.value as NavGroup[]
  for (const group of groups) {
    for (const item of group.items) {
      if (item.children?.some(child => child.key === newKey)) {
        if (expandedKey.value !== item.key) {
          expandedKey.value = item.key
        }
        return
      }
    }
  }
}, { immediate: true })

// 折叠状态变化时重新计算指示条位置（nav-group-label 显隐导致 offsetTop 变化）
watch(isCollapsed, () => {
  nextTick(() => updateActiveIndicator())
})

// 分组收起/展开状态变化时重新计算指示条位置（active 项可能位于被 v-show 隐藏的 group 中）
// Set 类型需 deep 监听才能感知 add/delete
watch(collapsedGroups, () => {
  nextTick(() => updateActiveIndicator())
}, { deep: true })

// 窗口尺寸变化时重新计算（移动端↔桌面端切换）
watch(isMobileOpen, () => {
  nextTick(() => updateActiveIndicator())
})
</script>

<style scoped lang="scss">
/* 组件级补充样式（全局布局样式在 _sidebar-layout.scss 中定义） */

.app-sidebar {
  height: 100vh;
}

/* header 水平 margin 与 .nav-item 一致，让 logo 左缘与导航项图标对齐
 * 在 scoped 中定义以提升优先级，覆盖全局 :where(.sidebar-header) 的 0 优先级
 * padding-left 在全局 16px 基础上增至 22px，因 logo.svg 图标从 viewBox x=0 起绘无内部留白，
 * 需更多视觉边距避免贴边感；nav-item 图标在 20px 容器内居中自带视觉缓冲，不受影响 */
.sidebar-header {
  margin: 0 var(--nav-item-margin-x, 6px);
  padding-left: 22px;
}

/* logo 高度：必须在 scoped 中显式设置，以覆盖 fixes.scss 全局 img { height: auto } */
.sidebar-logo {
  height: 26px;
  /* 位置微调：让 logo 左缘与 nav-item 图标(22px)对齐基础上再向左 4px，补偿 logo.svg 内部留白
   * 关键：必须用 scoped 样式（unlayered）声明，避开 @layer components 的 :where() 优先级陷阱
   * （_sidebar-layout.scss 的 @layer components + :where() 会被 Tailwind base 的 `* { margin: 0 }` 覆盖） */
  margin-left: -4px;
}

/* 用户信息区域 */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: var(--nav-item-gap, 12px);
  padding: 8px var(--nav-item-pad-x, 14px);
  margin: 2px var(--nav-item-margin-x, 6px);
  cursor: pointer;
  /* 不设 width: 100%，让 flex 子项默认 align-self: stretch 拉伸占满；
   * 配合 margin-x 才不会超出父容器 */
  overflow: hidden;
  border-radius: var(--global-border-radius, 6px);
  transition: background-color 0.2s var(--sidebar-easing);

  &:hover {
    background-color: var(--el-fill-color-light);
  }
}

.sidebar-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  border: 1px solid var(--el-border-color-lighter, #e4e7ed);
}

.sidebar-user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* 折叠态下隐藏文字，仅图标居中 */
.app-sidebar.collapsed {
  /* 折叠态 header: 隐藏 logo（10px 几乎不可见），collapse-btn 居中
   * 用 .sidebar-header（非 :where）覆盖展开态的 padding-left: 22px，确保按钮居中 */
  .sidebar-header {
    justify-content: center;
    padding: 0;
    margin: 0;
  }

  :where(.sidebar-logo) {
    display: none;
  }

  :where(.sidebar-nav) {
    padding: 8px 0;
  }

  :where(.nav-item) {
    justify-content: center;
    padding: 0;
  }

  /* 折叠态 footer 不设水平 padding，与展开态一致；
   * sidebar-user 通过 margin-x 与 nav-item 对齐 */
  :where(.sidebar-footer) {
    align-items: center;
    padding: 8px 0;
  }

  :where(.sidebar-user) {
    justify-content: center;
    padding: 6px 0;
  }
}

/* ── 操作图标条: 搜索 / 语言 / 主题 / 用户菜单 ──
 * 展开态: 水平排列, 4 个图标均匀分布
 * 折叠态: 垂直堆叠
 * 设计遵循扁平化规范: 无 text-shadow / box-shadow / !important / 高特异性选择器
 * 选择器深度均为 2 层 (.sidebar-actions + 子类), 特异性 (0,3,0) 高于子组件 scoped 样式 */
.sidebar-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  padding: 6px var(--nav-item-pad-x, 14px);
  margin: 0 var(--nav-item-margin-x, 6px);
  gap: 4px;
  flex-shrink: 0;
  border-radius: var(--global-border-radius, 6px);
}

/* 折叠态: 垂直堆叠, 居中对齐, 间距比展开态略大避免图标挤在一起 */
.app-sidebar.collapsed .sidebar-actions {
  flex-direction: column;
  padding: 8px 0;
  margin: 0;
  gap: 6px;
  justify-content: center;
}

/* ── SearchActions: 隐藏 ⌘K 提示, 按钮变为 28×28 图标 ── */
.sidebar-actions :deep(.cmd-k-hint) {
  display: none;
}

.sidebar-actions :deep(.search-trigger-inline) {
  display: inline-flex;
}

.sidebar-actions :deep(.search-trigger-button) {
  height: 28px;
  min-height: 28px;
  width: 28px;
  min-width: 28px;
  padding: 0;
  gap: 0;
}

.sidebar-actions :deep(.search-trigger-button:hover) {
  transform: none;
  background: var(--el-fill-color-light);
}

/* ── LanguageSwitcher: 隐藏文字和箭头, 只显示国旗 ── */
.sidebar-actions :deep(.language-text),
.sidebar-actions :deep(.el-icon-arrow-down) {
  display: none;
}

.sidebar-actions :deep(.language-selector) {
  height: 28px;
  min-height: 28px;
  width: 28px;
  min-width: 28px;
  justify-content: center;
  padding: 0;
  font-size: 14px;
}

.sidebar-actions :deep(.language-selector:hover) {
  transform: none;
  background: var(--el-fill-color-light);
}

.sidebar-actions :deep(.flag-icon) {
  width: 18px;
  height: 12px;
}

/* ── ThemeToggle: 统一为 28×28 透明背景图标 ── */
.sidebar-actions :deep(.theme-toggle-wrapper) {
  height: 28px;
  min-height: 28px;
  width: 28px;
  min-width: 28px;
  max-width: 28px;
}

.sidebar-actions :deep(.theme-toggle-fallback) {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  font-size: 16px;
}

.sidebar-actions :deep(.theme-toggle-fallback:hover) {
  background: var(--el-fill-color-light);
  border-color: transparent;
}

/* ── AppDownload: 隐藏文字, 只显示下载图标(箭头已由全局 .el-icon-arrow-down 规则隐藏) ── */
.sidebar-actions :deep(.download-text) {
  display: none;
}

.sidebar-actions :deep(.app-download-selector) {
  height: 28px;
  min-height: 28px;
  width: 28px;
  min-width: 28px;
  padding: 0;
  justify-content: center;
  gap: 0;
  font-size: 16px;
}

.sidebar-actions :deep(.app-download-selector:hover) {
  background: var(--el-fill-color-light);
}

/* ── UserMenu: 隐藏登录文字, 只显示图标（通知已移至 sidebar-actions 直接渲染）── */
.sidebar-actions :deep(.user-menu) {
  gap: 0;
}

.sidebar-actions :deep(.login-button) {
  width: 28px;
  min-width: 28px;
  max-width: 28px;
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  padding: 0;
  font-size: 0;
  line-height: 1;
}

.sidebar-actions :deep(.login-icon) {
  display: inline-flex;
  font-size: 16px;
}

.sidebar-actions :deep(.login-text) {
  display: none;
}

.sidebar-actions :deep(.login-button:hover) {
  background-color: var(--el-fill-color-light);
}

/* ── 登录按钮行: 容器居中 + 折叠态强制 28×28 ──
 *
 * 默认态 (.sidebar-login-row):
 *   flex 居中让子 UserMenu 在容器内居中,
 *   内部 .login-button width:100% 会撑满 UserMenu.
 *   三向 padding (10px/12px/10px/12px) 让按钮与侧边栏左/右/底边缘
 *   有视觉呼吸, 不贴边, 也不悬空, 平衡"卡片式"独立感.
 *
 * 折叠态 (.sidebar-login-row.is-collapsed):
 *   强制 .login-button 28×28 + 仅图标 + 居中,
 *   与 sidebar-actions 内 4 个图标中心 x 对齐
 *   (e2e/sidebar-collapsed-bottom-alignment.spec.ts:99 守门). */
.sidebar-login-row {
  display: flex;
  justify-content: center;
  padding: 10px 12px;
}

.sidebar-login-row.is-collapsed {
  padding: 10px 0;

  :deep(.login-button) {
    width: 28px;
    min-width: 28px;
    max-width: 28px;
    height: 28px;
    min-height: 28px;
    max-height: 28px;
    padding: 0;
    font-size: 0;
    line-height: 1;
    box-shadow: none;

    .login-icon {
      display: inline-flex;
      font-size: 16px;
    }

    .login-text {
      display: none;
    }
  }

  :deep(.login-icon) {
    display: inline-flex;
    font-size: 16px;
  }

  :deep(.login-text) {
    display: none;
  }
}

/* 移动端遮罩过渡 */
.sidebar-overlay {
  transition: opacity var(--sidebar-transition-duration, 0.2s) var(--sidebar-easing, cubic-bezier(0.4, 0, 0.2, 1));
}
</style>
