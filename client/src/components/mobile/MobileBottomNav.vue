<template>
  <div
    v-if="isMobile"
    class="mobile-bottom-nav"
    role="navigation"
    :aria-label="t('mobileNav.bottomNavAriaLabel')"
  >
    <template v-for="item in navItems" :key="item.path">
      <router-link
        v-if="item.path !== '/chat'"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
        :aria-label="item.label"
      >
        <div class="nav-icon">
          <img v-if="!isActive(item.path)" :src="item.icon" :alt="item.label" />
          <img v-if="isActive(item.path)" :src="item.activeIcon" :alt="item.label" />
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
      <div
        v-else
        class="nav-item"
        :aria-label="item.label"
        @click="openAIChat"
      >
        <div class="nav-icon">
          <img :src="item.icon" :alt="item.label" />
        </div>
        <span class="nav-label">{{ item.label }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWindowSize } from '@vueuse/core'
import { defaultResponsiveConfig } from '@/utils/responsiveEnhancement'
import { getProxiedImageUrl } from '@/utils/imageProxy'

const { t } = useI18n()
const router = useRouter()
const route = computed(() => router.currentRoute.value)
const { width } = useWindowSize()

const mobileBreakpoint = defaultResponsiveConfig.breakpoints.md

const isMobile = computed(() => width.value < mobileBreakpoint)

const openAIChat = () => {
  ;(window as unknown as { openFloatingChat?: () => void }).openFloatingChat?.()
}

// 导航项 - 整合Ai-WXMiniVue的导航结构；图标经代理加载避免 CORB
const tabbarBase = 'https://file.aizhs.top/sys-mini/tabbar'
const navItems = computed(() => {
  const items = [
    {
      path: '/tools',
      label: t('data.mobile_bottom_nav.AI应用商店'),
      icon: getProxiedImageUrl(`${tabbarBase}/tabbar_1.png`, true),
      activeIcon: getProxiedImageUrl(`${tabbarBase}/tabbar_1_act.png`, true)
    },
    {
      path: '/plaza',
      label: t('data.mobile_bottom_nav.广场1'),
      icon: getProxiedImageUrl(`${tabbarBase}/tabbar_2.png`, true),
      activeIcon: getProxiedImageUrl(`${tabbarBase}/tabbar_2_act.png`, true)
    },
    {
      path: '/chat',
      label: t('data.mobile_bottom_nav.智汇AI2'),
      icon: getProxiedImageUrl(`${tabbarBase}/tabbar_3.png`, true),
      activeIcon: getProxiedImageUrl(`${tabbarBase}/tabbar_3_act.png`, true)
    },
    {
      path: '/share',
      label: t('data.mobile_bottom_nav.动态3'),
      icon: getProxiedImageUrl(`${tabbarBase}/tabbar_4.png`, true),
      activeIcon: getProxiedImageUrl(`${tabbarBase}/tabbar_4_act.png`, true)
    },
    {
      path: '/user',
      label: t('data.mobile_bottom_nav.我的4'),
      icon: getProxiedImageUrl(`${tabbarBase}/tabbar_5.png`, true),
      activeIcon: getProxiedImageUrl(`${tabbarBase}/tabbar_5_act.png`, true)
    }
  ]
  // 2026-06-24: 后端模块缺失, 临时隐藏入口避免用户 404
  // 隐藏工具 v2 (后端工具在 /api/v1/tools/* 且仅3个端点, 非 /api/v2/tools/*)
  const HIDDEN_PATHS = ['/tools']
  return items.filter(item => !HIDDEN_PATHS.includes(item.path))
})

// 判断路由是否激活
const isActive = (path: string): boolean => {
  return route.value.path === path || route.value.path.startsWith(path + '/')
}
</script>

<style scoped lang="scss">
:where(.mobile-bottom-nav) {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
  display: none;
  background-color: var(--el-bg-color);
  border-top: var(--unified-border);
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom);

  @media (width <= 767px) {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 8px 0;
    color: var(--el-text-color-regular);
    text-decoration: none;
    transition: opacity 0.3s ease;
    position: relative;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;

    &:active {
      opacity: 0.7;
    }

    &.active {
      .nav-label {
        color: var(--el-text-color-primary);
        font-weight: 700;
      }
    }

    .nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin-bottom: 2px;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }

    .nav-label {
      font-size: 12px;
      color: var(--el-text-color-regular);
      text-align: center;
      white-space: nowrap;
    }
  }
}

// 暗色模式支持
:where(html.dark) {
  .mobile-bottom-nav {
    background-color: var(--el-bg-color);
    border-top-color: var(--el-border-color-lighter);
    }
}
</style>
