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
      <!-- 新建任务按钮：打开 AI 助手面板 (2026-07-05 v2: 所有屏幕尺寸都显示, 包括移动端) -->
      <div class="nav-item-wrapper nav-new-chat-wrapper">
        <el-tooltip
          :content="t('aiChat.newTask')"
          placement="right"
          :disabled="!isCollapsed"
          :show-after="300"
          :offset="4"
        >
          <button
            class="nav-item nav-new-chat"
            :class="{ active: aiPanelIsOpen }"
            :aria-label="t('aiChat.newTask')"
            :aria-pressed="aiPanelIsOpen"
            @click="handleNewChat"
            type="button"
          >
            <component :is="MessageCircleIcon" class="nav-item-icon" />
            <span v-if="!isCollapsed" class="nav-item-label">{{ t('aiChat.newTask') }}</span>
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
              <el-tooltip
                v-for="child in item.children"
                :key="child.key"
                :content="child.label"
                placement="right"
                :show-after="300"
                :offset="6"
                popper-class="nav-subitem-tooltip-popper"
              >
                <button
                  class="nav-subitem"
                  :class="{ active: activeKey === child.key }"
                  @click="handleSubnavClick(child)"
                  type="button"
                >
                  <component v-if="child.icon" :is="child.icon" class="nav-subitem-icon" />
                  <span class="nav-subitem-label">{{ child.label }}</span>
                </button>
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <!-- 底部: 用户信息 / 操作区 / 版权 -->
    <div class="sidebar-footer">
      <!-- 操作图标条: 搜索 / 语言 / 主题 / 下载
           role=group + aria-label 让屏幕阅读器识别为一组相关操作
           (消息中心铃铛已移至 sidebar-user-row 用户信息右侧, 2026-07-06) -->
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
      </div>

      <!-- 用户区: 同一位置互斥显示
           - 已登录: 显示头像+用户名, 点击进入个人中心 (2026-07-05 从顶部移到底部, 替换原登录按钮位置)
           - 未登录: 显示登录/注册按钮 (UserMenu 内部 v-if=!isLoggedIn 进一步保护) -->
      <div
        v-if="!isLoggedIn"
        class="sidebar-login-row"
        :class="{ 'is-collapsed': isCollapsed }"
      >
        <UserMenu
          @show-login-popup="emit('show-login-popup')"
          @feedback-click="emit('feedback-click')"
        />
      </div>
      <div v-else class="sidebar-user-row">
        <el-dropdown
          ref="userDropdownRef"
          class="sidebar-user-dropdown"
          placement="top-start"
          trigger="click"
          popper-class="sidebar-user-dropdown-popper"
          :teleported="true"
          :hide-on-click="true"
          :popper-options="{
            modifiers: [
              { name: 'offset', options: { offset: [0, 8] } }
            ]
          }"
          @command="handleUserCommand"
          @visible-change="handleUserDropdownVisibleChange"
        >
        <div
          class="sidebar-user"
          :class="{ 'is-collapsed': isCollapsed, 'is-open': userDropdownVisible }"
          tabindex="0"
          role="button"
          :aria-haspopup="true"
          :aria-expanded="userDropdownVisible"
          :aria-label="userDropdownLabel"
        >
          <div
            class="sidebar-user-avatar"
            role="img"
            :aria-label="userName"
          >
            <img
              v-if="hasCustomAvatar"
              :src="userAvatar"
              :alt="userName"
              class="sidebar-user-avatar-image"
              loading="lazy"
            />
            <svg
              v-else
              class="sidebar-user-avatar-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span v-if="!isCollapsed" class="sidebar-user-name">{{ userName }}</span>
          <div v-if="!isCollapsed" class="sidebar-user-notification" @click.stop>
            <Notification :is-dark-mode="isDark" @visible-change="handleNotificationVisibleChange" />
          </div>
        </div>
        <template #dropdown>
          <el-dropdown-menu class="sidebar-user-dropdown-menu">
            <div class="sidebar-user-dropdown-header">
              <img :src="userAvatar" :alt="userName" class="sidebar-user-dropdown-avatar" loading="lazy" />
              <div class="sidebar-user-dropdown-info">
                <div class="sidebar-user-dropdown-name">{{ userName }}</div>
                <div class="sidebar-user-dropdown-meta">{{ t('auth.loggedInAs') }}</div>
              </div>
            </div>
            <el-dropdown-item command="profile" :icon="UserIcon" class="sidebar-user-dropdown-item">
              <span class="sidebar-user-dropdown-item-label">{{ profileLabel }}</span>
            </el-dropdown-item>
            <el-dropdown-item command="settings" :icon="SettingsIcon" class="sidebar-user-dropdown-item">
              <span class="sidebar-user-dropdown-item-label">{{ settingsLabel }}</span>
            </el-dropdown-item>
            <div class="sidebar-user-dropdown-divider" />
            <el-dropdown-item command="logout" :icon="LogOutIcon" class="sidebar-user-dropdown-item sidebar-user-dropdown-item--danger">
              <span class="sidebar-user-dropdown-item-label">{{ logoutLabel }}</span>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
        </el-dropdown>
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
import { ref, computed, h, markRaw, onMounted, watch, nextTick, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElDropdown } from 'element-plus'
import { useDarkModeStore } from '@/stores/darkMode'
import { useAuthStore } from '@/stores/auth'
import { useSidebar } from '@/composables/useSidebar'
import { useAiPanel } from '@/composables/useAiPanel'
import { useCleanup } from '@/composables/useCleanup'
import { loadModule, getCurrentLocale } from '@/locales'
import type { Language } from '@/composables/useLang'
import SearchActions from '@/components/header/parts/SearchActions.vue'
import LanguageSwitcher from '@/components/header/parts/LanguageSwitcher.vue'
import ThemeToggle from '@/components/header/parts/ThemeToggle.vue'
import AppDownload from '@/components/header/parts/AppDownload.vue'
import UserMenu from '@/components/header/parts/UserMenu.vue'
import SidebarChatHistory from '@/components/SidebarChatHistory.vue'
// 2026-07-06: Notification 同步导入, 避免异步加载导致铃铛延迟渲染
import Notification from '@/components/Notification.vue'

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

/* ── 教育中心 (eduCenter) 顶级入口图标 — Lucide Building2 风格，区别于 learnAI 的 GraduationCap ── */
const EduCenterIcon = markRaw({
  name: 'EduCenterIcon',
  render() {
    return h('svg', svgBase, [
      // 主楼体
      h('path', { d: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z' }),
      // 底线
      h('path', { d: 'M6 22h12' }),
      // 左附楼
      h('path', { d: 'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2' }),
      // 右附楼
      h('path', { d: 'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2' }),
      // 大门
      h('path', { d: 'M11 22v-4h2v4' }),
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

// 2026-07-08: "联系我们" 子项用 MailIcon (envelope)
const MailIcon = markRaw({
  name: 'MailIcon',
  render() {
    return h('svg', svgBase, [
      h('rect', { x: '2', y: '4', width: '20', height: '16', rx: '2' }),
      h('path', { d: 'm22 7-10 5L2 7' }),
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

const BellIcon = markRaw({
  name: 'BellIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M10.268 21a2 2 0 0 0 3.464 0' }),
      h('path', { d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8a6 6 0 0 0-12 0c0 4.499-1.411 5.956-2.738 7.326' }),
    ])
  },
})

/* ── 侧边栏用户菜单图标 (2026-07-05 新增, 用于 sidebar-user 下拉菜单) ── */
const UserIcon = markRaw({
  name: 'UserIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
      h('circle', { cx: '12', cy: '7', r: '4' }),
    ])
  },
})

const SettingsIcon = markRaw({
  name: 'SettingsIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }),
      h('circle', { cx: '12', cy: '12', r: '3' }),
    ])
  },
})

const LogOutIcon = markRaw({
  name: 'LogOutIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
      h('polyline', { points: '16 17 21 12 16 7' }),
      h('line', { x1: '21', y1: '12', x2: '9', y2: '12' }),
    ])
  },
})

const SearchIcon = markRaw({
  name: 'SearchIcon',
  render() {
    return h('svg', svgBase, [
      h('circle', { cx: '11', cy: '11', r: '8' }),
      h('path', { d: 'm21 21-4.3-4.3' }),
    ])
  },
})

/* ── 教育中心新增分类图标 (首页/资讯/文章/公告) ── */
const EduHomeIcon = markRaw({
  name: 'EduHomeIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'm3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
      h('polyline', { points: '9 22 9 12 15 12 15 22' }),
    ])
  },
})

const FileTextIcon = markRaw({
  name: 'FileTextIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }),
      h('path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }),
      h('path', { d: 'M10 9H8' }),
      h('path', { d: 'M16 13H8' }),
      h('path', { d: 'M16 17H8' }),
    ])
  },
})

const MegaphoneIcon = markRaw({
  name: 'MegaphoneIcon',
  render() {
    return h('svg', svgBase, [
      h('path', { d: 'm3 11 18-5v12L3 14v-3z' }),
      h('path', { d: 'M11.6 16.8a3 3 0 1 1-5.8-1.6' }),
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

// ── AI 面板状态（来自单例 composable，与 App.vue 共享） ──
// 用于"新建对话"按钮：点击切换 AI 助手面板
const {
  isOpen: aiPanelIsOpen,
  // 2026-07-05 v2: 移除 aiPanelIsMobile 引用（改为所有屏幕尺寸都显示新建对话按钮），
  // useAiPanel 的 isMobile 仍保留供其他调用方使用, 此处只取需要的字段
  toggle: aiPanelToggle,
} = useAiPanel()

// ── 拖拽调整侧边栏宽度 ──
// 手柄位于侧边栏右侧，向右拖 delta 正 → 宽度增加
// 拖拽过程禁用过渡（is-resizing 类）+ 禁止文本选中，保证流畅
// 折叠态下也可拖拽：从折叠宽度(60px)起算，向右拖超过阈值(60px)自动展开
// 展开态范围：60-136px（MIN_WIDTH=60, MAX_WIDTH=136, DEFAULT_WIDTH=136, v11-max-ext-2）
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

// 头像渲染策略 (2026-07-05 v3): 改用 inline <svg> 渲染默认图标
// 原因: v2 用的 <div> + mask-image 在 SVG 缺少 width/height 属性时,
// mask-size: contain 不可靠缩放 (浏览器把 SVG 渲染在默认 300x150 画布上),
// 导致头像"突然变大". inline <svg> 由 CSS width/height 精确控制尺寸,
// 颜色仍由 color + stroke="currentColor" 自动随主题切换.
// 自定义头像 (jpg/png) 仍用 <img> 渲染, 走 object-fit: cover 填满容器.
const hasCustomAvatar = computed(() => {
  const a = authStore.avatar
  return !!a && !a.endsWith('/userIcon.svg') && !a.endsWith('userIcon.svg')
})

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
  // 使用 getBoundingClientRect 获取活动元素的可视位置 (border box),
  // 避免 offsetTop 链式累加的复杂性:
  //   - .nav-item-wrapper / .nav-group-items 上有 `contain: layout style`,
  //     会创建新的定位上下文, 让它们成为 offsetParent
  //   - 中间节点的 offsetTop 累加需要精确遍历, 容易因 DOM 结构变化
  //     (如 SidebarChatHistory 异步加载) 而计算出过时值
  // getBoundingClientRect 直接返回元素的视口坐标, 不依赖 offsetParent 链,
  // 减去 nav 的位置后即为活动元素相对 nav 的位置, 再加 scrollTop
  // 转换为 content 坐标 (position:absolute 相对滚动内容)
  const navRect = navRef.value.getBoundingClientRect()
  const activeRect = activeEl.getBoundingClientRect()
  const top = activeRect.top - navRect.top + navRef.value.scrollTop
  const height = activeRect.height
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
// 文档子项 docId → sidebar key 映射 (/docs/:docId 单 name 多 path 场景)
const DOC_ID_TO_SIDEBAR_KEY: Record<string, string> = {
  'project-readme': 'docEducation',
  'user-introduction': 'docUserQuickStart',
  'user-ai-chat': 'docUserFeatures',
  'user-video-generation': 'docUserGuide',
  'user-faq': 'docUserFaq',
  'dev-incentive-overview': 'docDevIncentive',
  'dev-introduction': 'docDevQuickStart',
  'dev-api-overview': 'docDevApi',
  'dev-sdk-javascript': 'docDevSdk',
  'dev-integration-webhook': 'docDevIntegration',
  'dev-best-practices': 'docDevOther',
  'terms-of-service': 'docTermsPolicy',
  'privacy-policy': 'docTermsPolicy',
  'user-agreement': 'docTermsPolicy',
  'payment-terms': 'docTermsPolicy',
  'enterprise-whitepaper': 'docEnterprise',
}

const activeKey = computed<string>(() => {
  const routeName = (route as { name?: string | symbol }).name as string
  const routePath = route.path

  // 0. /docs/:docId 文档子项 → 优先匹配 docId 映射
  if (routeName === 'eduDocumentation' && routePath.startsWith('/docs/')) {
    const docId = (route.params.docId as string) || ''
    if (DOC_ID_TO_SIDEBAR_KEY[docId]) return DOC_ID_TO_SIDEBAR_KEY[docId]
    // 未知 docId → 高亮父项 documentCenter
    if (docId) return 'documentCenter'
  }

  // 0.5 2026-07-08: /about/about-us 同路由 hash 区分 (关于我们/联系我们/加入我们)
  // 此前 onMounted 只读一次, 用户从侧边栏切换 hash 时不会自动滚动 (Step 2 watch 已修)
  if (routeName === 'aboutUs') {
    const h = route.hash.replace(/^#/, '')
    if (h === 'contact') return 'aboutUsContact'
    if (h === 'supplier') return 'aboutUsSupplier'
    return 'aboutUsAbout'
  }

  // 1. 精确路由名匹配（优先，用于无规律路径的页面）
  const nameMap: Record<string, string> = {
    home: 'home',
    xuqiu: 'xuqiu',
    xuqiuDetail: 'xuqiu',
    plaza: 'xuqiu',
    openPlatform: 'openPlatform',
    openPlatformProxy: 'openPlatform',
    openDashboard: 'openPlatform',
    learnAI: 'eduLearnAI',
    learnAIProxy: 'eduLearnAI',
    EduLearnAI: 'eduLearnAI',
    learnHome: 'eduCourses',
    learnList: 'eduCourses',
    learnDetail: 'eduCourses',
    learnPlay: 'eduCourses',
    learnTopic: 'eduCourses',
    learnTopicDetail: 'eduCourses',
    learnBuyConfirm: 'eduCourses',
    learnPayment: 'eduCourses',
    learnPaymentConfirm: 'eduCourses',
    learnRate: 'eduCourses',
    courses: 'eduCourses',
    courseDetail: 'eduCourses',
    EduCourses: 'eduCourses',
    EduCourseDetail: 'eduCourses',
    EduCoursePlay: 'eduCourses',
    EduCourseTopic: 'eduCourses',
    EduCourseTopicDetail: 'eduCourses',
    EduCourseBuyConfirm: 'eduCourses',
    EduCoursePayment: 'eduCourses',
    EduCoursePaymentConfirm: 'eduCourses',
    EduCourseRate: 'eduCourses',
    learnMap: 'eduLearnMap',
    EduLearnMap: 'eduLearnMap',
    liveList: 'eduLiveClass',
    liveDetail: 'eduLiveClass',
    livePlay: 'eduLiveClass',
    EduLiveDetail: 'eduLiveClass',
    EduLivePlay: 'eduLiveClass',
    learnHomework: 'eduMyLearning',
    learnCertificate: 'eduMyLearning',
    learnCertificateDownload: 'eduMyLearning',
    memberLearnRecord: 'eduMyLearning',
    memberHomework: 'eduMyLearning',
    memberCertificate: 'eduMyLearning',
    EduHomework: 'eduMyLearning',
    EduCourseCertificateDownload: 'eduMyLearning',
    EduMemberHomework: 'eduMyLearning',
    EduMemberCertificate: 'eduMyLearning',
    // 2026-07-08: Phase C edu 路由名统一归入 eduCenter 顶级菜单 (check-edu-route-consistency 守门要求)
    // 注意: Edu* 路由可能同时映射到具体子菜单 (eduLiveClass/eduMyLearning 等), 这里重复映射到 eduCenter 顶级高亮
    EduLive: 'eduCenter',
    EduLiveRoom: 'eduCenter',
    EduMember: 'eduCenter',
    EduMemberReport: 'eduCenter',
    EduMemberNotes: 'eduCenter',
    EduMemberOfflineRecords: 'eduCenter',
    EduMemberCertUpload: 'eduCenter',
    EduMemberPapers: 'eduCenter',
    EduMemberPaperUpload: 'eduCenter',
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
    // 2026-07-08: aboutUs 整合 — 3 子项对应 hash, 旧路由名仍可高亮到对应子项
    about: 'aboutUs',
    aboutUs: 'aboutUs',
    aboutUsAbout: 'aboutUsAbout',
    contactUs: 'aboutUsContact',
    becomeSupplier: 'aboutUsSupplier',
    feedback: 'aboutUs',
    // ── 教育中心 (eduCenter) — /edu/* 全部子路由统一映射到顶级 eduCenter 项 ──
    // EduLayout 自带内部侧边栏(12 模块), 主侧边栏只高亮顶级入口, 子项定位由 EduLayout 内部处理
    // 守门约束: check-edu-route-consistency.mjs 要求全部 32 个 Edu* → 'eduCenter' 映射
    EduHome: 'eduCenter',
    EduLearn: 'eduCenter',
    EduLearnDetail: 'eduCenter',
    EduLearnChapter: 'eduCenter',
    EduLearnCertificate: 'eduCenter',
    EduExam: 'eduCenter',
    EduExamPaper: 'eduCenter',
    EduExamRecord: 'eduCenter',
    EduExamWrongBook: 'eduCenter',
    EduAsk: 'eduCenter',
    EduAskDetail: 'eduCenter',
    EduAskCreate: 'eduCenter',
    EduCircle: 'eduCenter',
    EduCircleDetail: 'eduCenter',
    EduCirclePost: 'eduCenter',
    EduPoint: 'eduCenter',
    EduOrder: 'eduCenter',
    EduOrderDetail: 'eduCenter',
    EduMessage: 'eduCenter',
    EduNotification: 'eduCenter',
    EduResource: 'eduCenter',
    EduSearch: 'eduCenter',
    EduAdminHome: 'eduCenter',
  }
  if (routeName && nameMap[routeName]) return nameMap[routeName]

  // 2. 路径前缀匹配（兜底，覆盖所有子路由）
  const prefixMap: Array<[string, string]> = [
    // 教育中心二级菜单（更具体的前缀必须放在 /edu 兜底前）
    ['/edu/learn-ai', 'eduLearnAI'],
    ['/edu/courses/detail', 'eduCourses'],
    ['/edu/courses/topic', 'eduCourses'],
    ['/edu/courses/buyconfirm', 'eduCourses'],
    ['/edu/courses/payment', 'eduCourses'],
    ['/edu/courses/rate', 'eduCourses'],
    ['/edu/courses', 'eduCourses'],
    ['/edu/learn-map', 'eduLearnMap'],
    ['/edu/learn/detail', 'eduLearnHome'],
    ['/edu/learn/chapter', 'eduLearnHome'],
    ['/edu/learn/certificate', 'eduMyLearning'],
    ['/edu/learn/list', 'eduLearnList'],
    ['/edu/learn/topic', 'eduLearnTopic'],
    ['/edu/learn', 'eduLearnHome'],
    ['/edu/live', 'eduLiveClass'],
    ['/edu/member', 'eduMyLearning'],
    ['/edu/homework', 'eduMyLearning'],
    ['/edu/exam', 'eduExam'],
    ['/edu/news', 'eduNews'],
    ['/edu/article', 'eduArticle'],
    ['/edu/ask', 'eduAsk'],
    ['/edu/circle', 'eduCircle'],
    ['/edu/point', 'eduPoint'],
    ['/edu/order', 'eduOrder'],
    ['/edu/message', 'eduMessage'],
    ['/edu/notification', 'eduNotification'],
    ['/edu/resource', 'eduResource'],
    ['/edu/announcement', 'eduAnnouncement'],
    ['/edu/search', 'eduSearch'],
    ['/admin/edu', 'eduAdmin'],
    ['/edu/', 'eduCenter'],
    ['/edu', 'eduCenter'],
    // 旧学习/直播/学习型会员入口统一归入教育中心二级菜单
    ['/learn/list', 'eduCourses'],
    ['/learn/detail', 'eduCourses'],
    ['/learn/topic', 'eduCourses'],
    ['/learn/buyconfirm', 'eduCourses'],
    ['/learn/payment', 'eduCourses'],
    ['/learn/rate', 'eduCourses'],
    ['/learn/map', 'eduLearnMap'],
    ['/learn/homework', 'eduMyLearning'],
    ['/learn/certificate', 'eduMyLearning'],
    ['/live/', 'eduLiveClass'],
    ['/live', 'eduLiveClass'],
    ['/member/learn-record', 'eduMyLearning'],
    ['/member/homework', 'eduMyLearning'],
    ['/member/certificate', 'eduMyLearning'],
    ['/learn/', 'eduCourses'],
    ['/learn', 'eduCourses'],
    ['/learn-ai', 'eduLearnAI'],
    ['/courses/', 'eduCourses'],
    ['/courses', 'eduCourses'],
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
  // 2026-07-08: hash 锚点跳转 (侧边栏同路由不同 section 切换)
  hash?: string
  children?: NavItem[]
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const navGroups = computed<NavGroup[]>(() => {
  const goToPath = (path: string, query?: Record<string, string>, hash?: string) => {
  const route = query ? { path, query } : path
  if (hash) {
    router.push(typeof route === 'string' ? { path: route, hash } : { ...route, hash })
  } else {
    router.push(route)
  }
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
          key: 'openPlatform',
          label: t('routes.openPlatform'),
          path: '/open',
          icon: GlobeIcon,
          handler: () => goToPath('/open'),
        },
        {
          key: 'newsCenter',
          label: t('navigation.newsCenter'),
          path: '/about/news-center',
          icon: NewspaperIcon,
          handler: () => goToPath('/about/news-center'),
        },
        {
          key: 'aiCommunity',
          label: t('routes.aiCommunity'),
          path: '/ai-community',
          icon: UsersIcon,
          handler: () => goToPath('/ai-community'),
        },
        {
          key: 'eduCenter',
          label: t('navigation.eduCenter'),
          path: '/edu',
          icon: EduCenterIcon,
          handler: () => goToPath('/edu'),
          children: [
            { key: 'eduHome', label: t('edu.nav.eduHome'), path: '/edu', icon: EduHomeIcon, handler: () => goToPath('/edu') },
            { key: 'eduLearnAI', label: t('edu.nav.learnAI'), path: '/edu/learn-ai', icon: GraduationCapIcon, handler: () => goToPath('/edu/learn-ai') },
            { key: 'eduCourses', label: t('edu.nav.courses'), path: '/edu/courses', icon: BookOpenIcon, handler: () => goToPath('/edu/courses') },
            { key: 'eduLearnHome', label: t('edu.nav.learnHome'), path: '/edu/learn', icon: BookOpenIcon, handler: () => goToPath('/edu/learn') },
            { key: 'eduLearnList', label: t('edu.nav.learnList'), path: '/edu/learn/list', icon: BookOpenIcon, handler: () => goToPath('/edu/learn/list') },
            { key: 'eduLearnTopic', label: t('edu.nav.learnTopic'), path: '/edu/learn/topic', icon: BookOpenIcon, handler: () => goToPath('/edu/learn/topic') },
            { key: 'eduLearnMap', label: t('edu.nav.learnMap'), path: '/edu/learn-map', icon: MapIcon, handler: () => goToPath('/edu/learn-map') },
            { key: 'eduLiveClass', label: t('edu.nav.live'), path: '/edu/live', icon: VideoIcon, handler: () => goToPath('/edu/live') },
            { key: 'eduMyLearning', label: t('edu.nav.member'), path: '/edu/member', icon: ClockIcon, handler: () => goToPath('/edu/member') },
            { key: 'eduExam', label: t('edu.nav.exam'), path: '/edu/exam', icon: BookOpenIcon, handler: () => goToPath('/edu/exam') },
            { key: 'eduNews', label: t('edu.nav.news'), path: '/edu/news', icon: NewspaperIcon, handler: () => goToPath('/edu/news') },
            { key: 'eduArticle', label: t('edu.nav.article'), path: '/edu/article', icon: FileTextIcon, handler: () => goToPath('/edu/article') },
            { key: 'eduAsk', label: t('edu.nav.ask'), path: '/edu/ask', icon: MessageCircleIcon, handler: () => goToPath('/edu/ask') },
            { key: 'eduCircle', label: t('edu.nav.circle'), path: '/edu/circle', icon: UsersIcon, handler: () => goToPath('/edu/circle') },
            { key: 'eduPoint', label: t('edu.nav.point'), path: '/edu/point', icon: SparklesIcon, handler: () => goToPath('/edu/point') },
            { key: 'eduOrder', label: t('edu.nav.order'), path: '/edu/order', icon: FilesIcon, handler: () => goToPath('/edu/order') },
            { key: 'eduMessage', label: t('edu.nav.message'), path: '/edu/message', icon: MessageCircleIcon, handler: () => goToPath('/edu/message') },
            { key: 'eduNotification', label: t('edu.nav.notification'), path: '/edu/notification', icon: BellIcon, handler: () => goToPath('/edu/notification') },
            { key: 'eduResource', label: t('edu.nav.resource'), path: '/edu/resource', icon: FilesIcon, handler: () => goToPath('/edu/resource') },
            { key: 'eduAnnouncement', label: t('edu.nav.announcement'), path: '/edu/announcement', icon: MegaphoneIcon, handler: () => goToPath('/edu/announcement') },
            { key: 'eduSearch', label: t('edu.nav.search'), path: '/edu/search', icon: SearchIcon, handler: () => goToPath('/edu/search') },
            ...(authStore.hasRole('admin') ? [{ key: 'eduAdmin', label: t('edu.nav.admin'), path: '/admin/edu', icon: BriefcaseIcon, handler: () => goToPath('/admin/edu') }] : []),
          ],
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
          path: '/docs',
          icon: FilesIcon,
          handler: () => router.push({ path: '/docs/project-readme' }),
          children: [
            { key: 'docEducation', label: t('eduDoc.category.education'), path: '/docs/project-readme', icon: GraduationCapIcon, handler: () => router.push({ path: '/docs/project-readme' }) },
            { key: 'docUserQuickStart', label: t('eduDoc.category.userQuickStart'), path: '/docs/user-introduction', icon: SparklesIcon, handler: () => router.push({ path: '/docs/user-introduction' }) },
            { key: 'docUserFeatures', label: t('eduDoc.category.userFeatures'), path: '/docs/user-ai-chat', icon: BookOpenIcon, handler: () => router.push({ path: '/docs/user-ai-chat' }) },
            { key: 'docUserGuide', label: t('eduDoc.category.userGuide'), path: '/docs/user-video-generation', icon: MapIcon, handler: () => router.push({ path: '/docs/user-video-generation' }) },
            { key: 'docUserFaq', label: t('eduDoc.category.userFaq'), path: '/docs/user-faq', icon: MessageCircleIcon, handler: () => router.push({ path: '/docs/user-faq' }) },
            { key: 'docDevIncentive', label: t('eduDoc.category.devIncentive'), path: '/docs/dev-incentive-overview', icon: SparklesIcon, handler: () => router.push({ path: '/docs/dev-incentive-overview' }) },
            { key: 'docDevQuickStart', label: t('eduDoc.category.devQuickStart'), path: '/docs/dev-introduction', icon: BookOpenIcon, handler: () => router.push({ path: '/docs/dev-introduction' }) },
            { key: 'docDevApi', label: t('eduDoc.category.devApi'), path: '/docs/dev-api-overview', icon: BookOpenIcon, handler: () => router.push({ path: '/docs/dev-api-overview' }) },
            { key: 'docDevSdk', label: t('eduDoc.category.devSdk'), path: '/docs/dev-sdk-javascript', icon: BookOpenIcon, handler: () => router.push({ path: '/docs/dev-sdk-javascript' }) },
            { key: 'docDevIntegration', label: t('eduDoc.category.devIntegration'), path: '/docs/dev-integration-webhook', icon: BriefcaseIcon, handler: () => router.push({ path: '/docs/dev-integration-webhook' }) },
            { key: 'docDevOther', label: t('eduDoc.category.devOther'), path: '/docs/dev-best-practices', icon: InfoIcon, handler: () => router.push({ path: '/docs/dev-best-practices' }) },
            { key: 'docTermsPolicy', label: t('eduDoc.category.termsPolicy'), path: '/docs/terms-of-service', icon: FilesIcon, handler: () => router.push({ path: '/docs/terms-of-service' }) },
            { key: 'docEnterprise', label: t('eduDoc.category.enterprise'), path: '/docs/enterprise-whitepaper', icon: BriefcaseIcon, handler: () => router.push({ path: '/docs/enterprise-whitepaper' }) },
          ],
        },
        {
          key: 'aboutUs',
          label: t('navigation.aboutUs'),
          path: '/about/about-us',
          icon: InfoIcon,
          handler: () => goToPath('/about/about-us'),
          // 2026-07-08: 整合关于我们/联系我们/加入我们为统一页面的 hash 子项
          // 3 项共用 /about/about-us 路由, 通过 hash 锚点切换显示 section
          children: [
            {
              key: 'aboutUsAbout',
              label: t('navigation.aboutUs'),
              path: '/about/about-us',
              icon: InfoIcon,
              hash: '#about',
              handler: () => goToPath('/about/about-us', undefined, '#about'),
            },
            {
              key: 'aboutUsContact',
              label: t('navigation.contactUs'),
              path: '/about/about-us',
              icon: MailIcon,
              hash: '#contact',
              handler: () => goToPath('/about/about-us', undefined, '#contact'),
            },
            {
              key: 'aboutUsSupplier',
              label: t('navigation.becomeSupplier'),
              path: '/about/about-us',
              icon: BriefcaseIcon,
              hash: '#supplier',
              handler: () => goToPath('/about/about-us', undefined, '#supplier'),
            },
          ],
        },
      ],
    },
  ]
})

// ── 导航点击 ──
const handleNavClick = (item: NavItem) => {
  // documentCenter 例外: 用户要求"点击后直接显示具体文档",不走 toggle,跳首个子项
  if (item.key === 'documentCenter' && item.children && item.children.length > 0) {
    const firstChild = item.children[0]
    if (firstChild.handler) firstChild.handler()
    else router.push({ path: firstChild.path })
    closeMobile()
    return
  }
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

// ── 新建对话：打开 AI 助手面板 ──
const handleNewChat = () => {
  aiPanelToggle()
}

// ── 跳转用户中心 (sidebar-user 点击行为, 与 Notification 下拉菜单内"用户中心"按钮一致) ──
const goToProfile = () => {
  router.push('/user')
  closeMobile()
}

// ── 侧边栏用户下拉菜单 ──
// 状态: 用于 aria-expanded + chevron 旋转
const userDropdownVisible = ref(false)

const handleUserDropdownVisibleChange = (visible: boolean) => {
  userDropdownVisible.value = visible
}

// 2026-07-06: 通知下拉框打开时关闭用户菜单, 避免两个弹窗重叠
// 只声明需要的最小接口, 不引用 ElDropdown 类型避免引入全量 element-plus 导入
interface ElDropdownLike { handleClose?: () => void }
const userDropdownRef = ref<ElDropdownLike | null>(null)
const handleNotificationVisibleChange = (visible: boolean) => {
  if (visible && userDropdownVisible.value) {
    userDropdownVisible.value = false
    // 通过 ref 手动关闭 el-dropdown
    userDropdownRef.value?.handleClose?.()
  }
}

const userDropdownLabel = computed(() => {
  return isCollapsed.value
    ? t('navigation.profile')
    : `${t('navigation.profile')} · ${userName.value}`
})

// 2026-07-05 fix: 下拉菜单 slot 内的 t() 在某些版本/配置下可能返回 key 字面量,
// 改用计算属性包装, 确保 menu item 文本一定走 setup 顶层 t() 上下文.
const profileLabel = computed(() => t('navigation.profile'))
const settingsLabel = computed(() => t('navigation.settings'))
const logoutLabel = computed(() => t('auth.logout'))

const handleUserCommand = (command: string | number | null) => {
  userDropdownVisible.value = false
  switch (command) {
    case 'profile':
      goToProfile()
      break
    case 'settings':
      // 设置页: 跳转到 /settings 路由 (项目实际设置页)
      router.push('/settings')
      closeMobile()
      break
    case 'logout':
      void handleLogout()
      break
    default:
      break
  }
}

const handleLogout = async () => {
  try {
    await authStore.logout()
    await nextTick()
    try {
      await router.replace('/login')
      sessionStorage.removeItem('__logout_flag__')
    } catch (routeError) {
      const error = routeError as { name?: string }
      if (error.name !== 'NavigationDuplicated' && error.name !== 'NavigationRedirected') {
        window.location.replace('/login')
      } else {
        sessionStorage.removeItem('__logout_flag__')
      }
    }
  } catch (error) {
    console.error('[Sidebar] Logout failed:', error)
    window.location.replace('/login')
  }
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
  // 预加载 documentCenter 13 个 children 用到的 i18n 模块,
  // 否则 navGroups computed 在 setup 阶段首次执行 t('eduDoc.category.*')
  // 时模块未加载, t() fallback 返回 key 字符串 'eduDoc.category.education'
  void loadModule(getCurrentLocale(), 'eduDoc').then(() => {
    // i18n 合并后 navGroups computed 自动重算, t() 拿到真实翻译
  })

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

// nav 内容高度变化时重新计算（SidebarChatHistory 异步加载完成、
// 子菜单展开/收起、对话历史增删等场景）
// ResizeObserver 比逐个监听子组件更健壮，覆盖所有高度变化场景
//
// ⚠️ 关键陷阱：nav 本身是 flex: 1 1 0% 占满 sidebar 剩余高度（固定 ~1090px），
// 子元素（如 chat history 从 0 异步加载到 ~165px、nav-group-items 展开/收起）
// 高度变化时 nav 自身的 offsetHeight/scrollHeight 都不会变，
// 只观察 nav 永远不会触发回调 → 指示条卡在旧位置错位。
// 必须同时观察所有"高度会变"的子元素。
//
// ResizeObserver 实例需跨 onMounted/watch 共享，存为模块级 ref
const navResizeObserver = ref<ResizeObserver | null>(null)
const observeNavChildren = () => {
  if (!navRef.value || !navResizeObserver.value) return
  const observer = navResizeObserver.value
  const navEl = navRef.value
  // 2) 观察 chat history 元素（异步加载导致高度从 0 → ~165px）
  navEl.querySelectorAll('.sidebar-chat-history').forEach(el => observer.observe(el))
  // 3) 观察所有 nav-group-items（展开/收起时高度变化）
  navEl.querySelectorAll('.nav-group-items').forEach(el => observer.observe(el))
  // 4) 观察 nav-submenu（学习 AI 项的展开/收起二级菜单）
  navEl.querySelectorAll('.nav-submenu').forEach(el => observer.observe(el))
}

onMounted(() => {
  if (!navRef.value || typeof ResizeObserver === 'undefined') return
  const navEl = navRef.value
  const resizeObserver = new ResizeObserver(() => {
    updateActiveIndicator()
  })
  navResizeObserver.value = resizeObserver
  // 1) 观察 nav 本身（兜底，应对 nav 高度真变化的情况，如 sidebar resize）
  resizeObserver.observe(navEl)
  observeNavChildren()
  cleanup.add(() => resizeObserver.disconnect())
})

// isCollapsed / collapsedGroups 变化后, v-if 切换可能让新元素（chat history
// / nav-group-items）需要重新观察。用 nextTick 等 DOM 更新后再 observe
watch([isCollapsed, collapsedGroups], () => {
  nextTick(observeNavChildren)
})
</script>

<style scoped lang="scss">
/* 组件级补充样式（全局布局样式在 _sidebar-layout.scss 中定义） */

/* ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ HMR 缓存警告 (2026-07-04 立)
 *
 * 修改本组件 <style scoped> 块的样式后, 必须硬刷新浏览器 (Ctrl+Shift+R) 才能看到效果.
 * 原因:
 *   - 全局样式 _sidebar-layout.scss 中的规则用 :where() 包裹, 特异性 = 0,
 *     写在 @layer components 内, 优先级低于本组件的 unlayered scoped 规则.
 *   - Vite HMR 在 scoped 块更新时只重渲染组件 DOM, 但 :where() 全局规则的
 *     旧版本可能被浏览器缓存/拼接在 CSSOM 中, 偶发出现"代码改了样式没变"的情况.
 *   - 硬刷新会清空 CSSOM 重新加载所有 stylesheet, 一次性解决.
 *
 * 如果硬刷新后样式仍不生效, 检查顺序:
 *   1. DevTools → Elements → Computed → 确认选择器命中的具体规则
 *   2. DevTools → Network → 确认 sidebar CSS 资源 fresh load (200, 非 304)
 *   3. DevTools → Console → 确认无 CSS 解析错误
 *
 * 守门: e2e/sidebar-header-alignment.spec.ts (4 用例 × 2 viewport = 8 测试)
 *
 * ── 2026-07-06: 对话历史上下间距统一为 4px (跟下面菜单按钮一致) ──
 * 用户反馈"对话历史 / 核心功能 / 智能体 之间的间距应该跟下面菜单按钮一致"
 * (即 button-button 之间的 4px). 三段间距:
 *   - 新建任务 → 对话历史: 新建任务 margin-bottom 2px + chat-history margin-top 2px = 4px
 *   - 对话历史 → 核心功能: chat-history margin-bottom 2px + 此处 margin-top 2px = 4px
 *   - 核心功能 → 智能体:   核心功能 margin-bottom 4px + 智能体 margin-top 2px = 6px
 *                         (label 跟第一个 menu item 之间保留稍大间距作为视觉分组)
 * 用相邻兄弟选择器 .sidebar-chat-history + .nav-group .nav-group-label 只覆盖
 * 跟在 chat-history 后面的那个 label (核心功能), 不影响后续组间距.
 *
 * 改前 (2026-07-04): chat-history margin 0 → 顶部 2px / 底部 2px (用户反馈 2px 太紧)
 * 改后 (2026-07-06): chat-history margin 2px (在 SidebarChatHistory.vue) +
 *                    此处 margin-top 2px → 顶部 4px / 底部 4px ✓ */
.sidebar-chat-history + .nav-group .nav-group-label {
  margin-top: 2px;
}

/* ── 2026-07-06: 核心功能 ↔ 服务支持 (button ↔ button) 间距统一为 4px ──
 * 跟 .nav-new-chat ↔ .sidebar-chat-history (4px) 一致:
 *   - 核心功能 margin-bottom 4px (label → first item 凑出 6px 视觉分组, 保留不变)
 *   - 服务支持 margin-top 0 (override 默认 10px)
 *   - 总间距: 4 + 0 = 4px ✓
 * 用相邻兄弟选择器 .nav-group + .nav-group .nav-group-label 只覆盖跟在
 * 另一个 nav-group 后面的 label (服务支持), 不影响首个 label (核心功能).
 *
 * 改前: 服务支持 margin-top 10px (沿用 .nav-group-label 基础值) →
 *       核心功能 4 + 服务支持 10 = 14px (用户反馈"两个 button 间距太大,
 *       应该跟 button-div 间距统一"). */
.nav-group + .nav-group .nav-group-label {
  margin-top: 0;
}

.app-sidebar {
  height: 100vh;
}

/* header 水平 padding 设为 0，让 logo 左缘贴齐 .sidebar-header 左缘 (= sidebar 左缘 + 4px margin = 4),
 * collapse-btn 右缘贴齐 .sidebar-header 右缘 (= sidebar 右缘 - 4px margin = 112),
 * 与下方 .nav-item / .nav-group-label / .sidebar-chat-history 等容器 (left=4, right=112) 完全对齐
 * 旧实现 padding 0 10px 把 logo/button 推到 x=14/x=102, 比容器边缘各缩进 10px——用户反馈"图片左侧没跟下面容器左侧对齐, 按钮右侧没跟容器右侧对齐".
 *
 * 关键：必须用 scoped 样式（unlayered）声明，避开 @layer components 的 :where() 优先级陷阱 */
.sidebar-header {
  margin: 0 var(--nav-item-margin-x);
  padding: 0;
}

/* logo 大小与对齐 (unlayered, 覆盖 fixes.scss 全局 img { height: auto } + @layer components 的 :where())
 *
 * 高度 32px (旧 26px, 用户反馈"logo 这么小了")；
 * width: auto + object-fit: contain 保留 SVG 自然宽高比 (1527/493 ≈ 3.1)；
 * max-width: 100% 让 logo 在 flex 容器内自适应收缩, 不会撑破 header；
 * flex-shrink: 1 配合 .sidebar-collapse-btn 的 flex-shrink: 0,
 *   保证按钮永远 28×28 完整显示, logo 在剩余空间内按 3.1:1 比例缩放 */
.sidebar-logo {
  height: 32px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  cursor: pointer;
  flex-shrink: 1;
  min-width: 0;
  margin-left: 0;
}

/* 用户信息区域 */
.sidebar-user {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  margin: 2px var(--nav-item-margin-x, 6px);
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: var(--global-border-radius, 6px);
  transition: background-color 0.2s var(--sidebar-easing);
  outline: none;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &:focus-visible {
    /* stylelint-disable color-no-hex -- 主题色 light-5 兜底, 暗色模式下 var() 失效时需 fallback */
    box-shadow: 0 0 0 2px var(--el-color-primary-light-5, #d6e4ff);
    /* stylelint-enable color-no-hex */
  }

  /* 下拉菜单打开态: 与 hover 同样的填充色作为视觉反馈 */
  &.is-open {
    background-color: var(--el-fill-color-light);
  }
}

/* 折叠态隐藏文字 + 居中显示头像 (chevron 元素已移除, 无需再隐藏) */
.app-sidebar.collapsed .sidebar-user {
  justify-content: center;
  padding: 6px 0;
}

/* 头像 (2026-07-05 v3 改造: 改用 inline <svg>, 解决 mask-image 缩放不可靠问题)
 * 设计要点:
 *   1. 渲染方式: 默认头像用 inline <svg>, 颜色由 stroke="currentColor" + CSS color 控制;
 *      自定义头像 (jpg/png) 走 <img> + object-fit: cover.
 *      解决 v2 方案 (<div> + mask-image + SVG 缺 width/height) 导致的"图标突然变大"问题
 *      (mask-size: contain 在 SVG 缺 width/height 时不可靠缩放, 浏览器用 300x150 默认画布).
 *   2. 容器 28x28, border-radius 8px (项目统一 token), 满足用户"正方形的小圆角"要求
 *   3. 浅色: color 走 --el-text-color-primary (深灰); 暗色: color #fff (白) 跟亮色相反
 *   4. inline <svg> 用 flex 居中, 18x18 (留 5px 内边距让 SVG 视觉上跟原来 <img> 一致) */
.sidebar-user-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--global-border-radius, 8px);
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  /* 浅色: 图标颜色 = el-text-color-primary (深灰) */
  color: var(--el-text-color-primary);
  box-sizing: border-box;
  transition: color 0.2s var(--sidebar-easing), border-color 0.2s var(--sidebar-easing);
}

.sidebar-user-avatar-icon {
  width: 18px;
  height: 18px;
  display: block;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sidebar-user-avatar-image {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

/* 暗色模式: 图标颜色反转为白色, 边框更深 */
html.dark .sidebar-user-avatar {
  /* stylelint-disable color-no-hex -- 暗色反相配对 (白文字 + 暗卡片), 无 token 表达 */
  color: #fff;
  border-color: var(--app-sidebar-color-card, #1a1a1a);
  /* stylelint-enable color-no-hex */
}

.sidebar-user-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
  flex: 1;
  min-width: 0;
}

/* ── 用户信息行: 铃铛已移入 sidebar-user 容器内部 (2026-07-06 v2) ──
 * 登录后 sidebar-actions 仅保留 4 个工具图标 (搜索/语言/主题/下载),
 * 消息中心铃铛从 sidebar-actions 移到 sidebar-user 容器内部右侧,
 * 与头像+用户名在同一个可点击区域内, 避免单独一行突兀.
 * 折叠态: 铃铛隐藏 (仅显示头像居中). */
.sidebar-user-row {
  display: flex;
  align-items: center;
  margin: 2px var(--nav-item-margin-x, 6px);
}

/* el-dropdown 触发器及其内部包装层撑满行宽 */
.sidebar-user-row :deep(.sidebar-user-dropdown) {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  width: 100%;
}

.sidebar-user-row :deep(.sidebar-user-dropdown > *) {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  width: 100%;
}

/* sidebar-user 在行内: 去掉自身 margin (由 row 统一), 撑满 el-dropdown */
.sidebar-user-row .sidebar-user {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
}

/* 消息中心铃铛容器: 在 sidebar-user 内部右侧, 不压缩 */
.sidebar-user-notification {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-left: 2px;
}

/* 在 sidebar-user 内部缩小铃铛按钮 (从 28px 缩至 20px, 给用户名留空间) */
.sidebar-user-notification :deep(.button-message) {
  width: 20px;
  min-width: 20px;
  max-width: 20px;
  height: 20px;
  min-height: 20px;
  max-height: 20px;
}

.sidebar-user-notification :deep(.notification-icon) {
  font-size: 14px;
}

/* 折叠态: 铃铛隐藏 (v-if="!isCollapsed" 已控制 DOM, 此处兜底) */
.app-sidebar.collapsed .sidebar-user-row {
  margin: 2px 0;
}

.app-sidebar.collapsed .sidebar-user-row :deep(.sidebar-user-dropdown),
.app-sidebar.collapsed .sidebar-user-row :deep(.sidebar-user-dropdown > *) {
  flex: 0 0 auto;
}

/* ── 折叠态专用 (与上方 collapsed 块合用) ── */

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

  /* 折叠态 sidebar-user 复用上面 .app-sidebar.collapsed .sidebar-user 块
   * (justify-content: center + padding: 6px 0) */
}

/* ── 操作图标条: 搜索 / 语言 / 主题 / 用户菜单 ──
 * 展开态: 水平排列, 宽度不够时自动换行 (flex-wrap)
 * 折叠态: 垂直堆叠
 * 拉伸过程中: 按钮根据可用宽度自动换行, 不会被裁切;
 *   宽度足够时一行水平排列, 宽度不够时自动换到下一行, 极窄时自然变为竖排
 * 设计遵循扁平化规范: 无 text-shadow / box-shadow / !important / 高特异性选择器
 * 选择器深度均为 2 层 (.sidebar-actions + 子类), 特异性 (0,3,0) 高于子组件 scoped 样式 */
.sidebar-actions {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-around;
  padding: 6px var(--nav-item-pad-x, 14px);
  margin: 0 var(--nav-item-margin-x, 6px);
  gap: 4px;
  flex-shrink: 0;
  border-radius: var(--global-border-radius, 6px);
}

/* 子按钮不压缩: 宽度不够时换行而非缩小 (保持 28×28 图标完整) */
.sidebar-actions :deep(*) {
  flex-shrink: 0;
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
 *
 * 水平对齐: 与 .nav-item 一致 (margin-x: var(--nav-item-margin-x) = 4px,
 *   padding-x: 0), 让 .login-button (width:100%) 实际宽度 = sidebar - 8 = 108px ≡
 *   nav-item 宽度. 旧 padding-x: 12px 让按钮比 nav-item 窄 16px (每边 8px),
 *   用户反馈"距离侧边栏左右间距有点大, 应该跟上面的所有菜单按钮容器相同"
 *   (实测 login-btn x=12 right=104 vs nav-item x=4 right=112, 差 8px/边).
 *
 * 折叠态 (.sidebar-login-row.is-collapsed):
 *   强制 .login-button 28×28 + 仅图标 + 居中,
 *   与 sidebar-actions 内 4 个图标中心 x 对齐
 *   (e2e/sidebar-collapsed-bottom-alignment.spec.ts:99 守门).
 *
 * 用户要求"不要动登录注册按钮的位置": 按钮 y=674 / 底 y=710 / 顶 y=684 保持不变.
 * "上面那排 (sidebar-actions) 下移 + 4 图标水平居中" 通过:
 *   - .sidebar-footer gap 8px → 2px (覆盖全局)
 *   - .sidebar-actions margin-top 6 → 16 (容器下移 10px, 明显靠近登录按钮)
 *   - .sidebar-actions padding 6/10/6/10 → 0 (释放 16px 给 margin-top 10px + 图标居中)
 *   - .sidebar-actions justify-content space-around → center (修图标未居中 bug)
 *   - .sidebar-actions margin-x 6 → 0 (去掉, 让 actions 容器撑满 sidebar 全宽, justify-content center 才有空间居中)
 *   - .sidebar-login-row padding-top 10 → 6 (释放 4px 给 margin-top, 按钮 y=674 保持不变)
 *   - footer 总高仍 98, 登录按钮底 y=710 不变. */
:where(.sidebar-footer) {
  gap: 2px;
}

.sidebar-actions {
  margin: 16px 0 0;
  padding: 0;
  justify-content: center;
}

.sidebar-login-row {
  display: flex;
  justify-content: center;

  /* 2026-07-04: 水平间距对齐 nav-item 容器
   *   - margin-x = var(--nav-item-margin-x) (4px) 与 nav-item 完全一致
   *   - padding-x = 0 让 .login-button (width:100%) 撑满 = nav-item 同宽 (sidebar-8 = 108px)
   *   - 旧 padding-x: 12px 让按钮比 nav-item 窄 16px (每边 8px), 用户反馈"间距大"
   * padding-top 6 (替代 10) 释放 4px 给 actions margin-top 16,
   *   配合 actions margin 16 + actions h 28 + gap 2 + loginRow h 50 = 98
   * 按钮 y = loginRow.y + padding-top = 668 + 6 = 674 (不变) */
  margin: 0 var(--nav-item-margin-x);
  padding: 6px 0 10px;
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

<!--
  sidebar-user-dropdown popper 全局样式块
  el-dropdown 通过 Teleport 将 #dropdown slot 内容渲染到 body,
  scoped 样式无法匹配 Teleport 内容, 必须用不带 scoped 的全局块
-->
<style lang="scss">
/* ── popper 容器 (Teleport 到 body, unlayered 块) ──
 * 设计要点:
 *   1. 边框 + 阴影: 与 notification-dropdown 保持一致风格
 *   2. 圆角 8px (项目统一 border-radius token)
 *   3. 内边距 0: 由内层 .el-dropdown-menu 控制
 *   4. 暗色模式: 背景色 --el-bg-color, 边框稍深 */
body .sidebar-user-dropdown-popper.el-popper {
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--global-border-radius, 8px);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  padding: 0;
  background-color: var(--el-bg-color);
  min-width: 200px;

  // 覆盖 Element Plus 默认白底, 暗色模式跟随主题
  .el-dropdown-menu {
    background-color: transparent;
    border: none;
    padding: 6px;
    box-shadow: none;
  }
}

:where(html.dark) body .sidebar-user-dropdown-popper.el-popper {
  /* stylelint-disable color-no-hex -- 暗色卡片边框 fallback */
  border-color: var(--app-sidebar-color-card, #1a1a1a);
  /* stylelint-enable color-no-hex */
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
}

/* ── 头部用户信息区 ──
 * 设计: 顶部用户卡片式信息, 头像 + 昵称 + "已登录" 副标题 */
.sidebar-user-dropdown-popper .sidebar-user-dropdown-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 4px;
}

.sidebar-user-dropdown-popper .sidebar-user-dropdown-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--global-border-radius, 8px);
  flex-shrink: 0;
  object-fit: contain;
  border: 1px solid var(--el-border-color-lighter);
  background-color: var(--app-sidebar-color-card, var(--el-fill-color-blank));
  padding: 2px;
  color: var(--el-text-color-primary);
  box-sizing: border-box;
}

:where(html.dark) .sidebar-user-dropdown-popper .sidebar-user-dropdown-avatar {
  /* stylelint-disable color-no-hex -- 暗色反相配对 (白文字 + 暗卡片背景), 无 token 表达 */
  color: #fff;
  border-color: var(--app-sidebar-color-card, #1a1a1a);
  background-color: var(--app-sidebar-color-new-chat, #1f1f1f);
  /* stylelint-enable color-no-hex */
}

.sidebar-user-dropdown-popper .sidebar-user-dropdown-info {
  flex: 1;
  min-width: 0;
}

.sidebar-user-dropdown-popper .sidebar-user-dropdown-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.sidebar-user-dropdown-popper .sidebar-user-dropdown-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  line-height: 1.3;
  margin-top: 2px;
}

/* ── 菜单项 ── */
.sidebar-user-dropdown-popper .sidebar-user-dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.3;
  border-radius: var(--global-border-radius, 6px);
  margin: 2px 0;
  color: var(--el-text-color-regular);
  transition: background-color 0.15s ease, color 0.15s ease;

  /* el-dropdown-item 自带 :hover 蓝底, 浅色下是 #ecf5ff,
   * 暗色下跟背景 #1d1e1f 几乎同色不可见, 覆盖为统一 hover 填充 */
  &:hover {
    background-color: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
  }

  &.is-disabled {
    cursor: not-allowed;
    color: var(--el-text-color-placeholder);
  }
}

/* 菜单项内 el-icon / svg 颜色跟随 */
.sidebar-user-dropdown-popper .sidebar-user-dropdown-item :deep(svg),
.sidebar-user-dropdown-popper .sidebar-user-dropdown-item :deep(.el-icon) {
  width: 16px;
  height: 16px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.sidebar-user-dropdown-popper .sidebar-user-dropdown-item:hover :deep(svg),
.sidebar-user-dropdown-popper .sidebar-user-dropdown-item:hover :deep(.el-icon) {
  color: var(--el-text-color-primary);
}

.sidebar-user-dropdown-popper .sidebar-user-dropdown-item-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 危险项 (退出登录) 文字色: 浅色 danger / 暗色 danger-light */
.sidebar-user-dropdown-popper .sidebar-user-dropdown-item--danger {
  color: var(--el-color-danger);

  :deep(svg),
  :deep(.el-icon) {
    color: var(--el-color-danger);
  }

  &:hover {
    background-color: var(--el-color-danger-light-9);
    color: var(--el-color-danger);

    :deep(svg),
    :deep(.el-icon) {
      color: var(--el-color-danger);
    }
  }
}

/* 暗色模式: 危险项 hover 用更深红底 */
:where(html.dark) .sidebar-user-dropdown-popper .sidebar-user-dropdown-item--danger {
  /* stylelint-disable color-no-hex -- 暗色危险项用浅红 #fca5a5 (ep 主题 light-3) 提升可读性, 暗色背景对比 */
  color: #fca5a5;

  :deep(svg),
  :deep(.el-icon) {
    color: #fca5a5;
  }

  &:hover {
    background-color: rgb(220 38 38 / 0.25);
    color: #fca5a5;

    :deep(svg),
    :deep(.el-icon) {
      color: #fca5a5;
    }
  }
  /* stylelint-enable color-no-hex */
}

/* 分隔线 (退出登录与上方菜单项分组) */
.sidebar-user-dropdown-popper .sidebar-user-dropdown-divider {
  height: 1px;
  background-color: var(--el-border-color-lighter);
  margin: 4px 0;
}
</style>
