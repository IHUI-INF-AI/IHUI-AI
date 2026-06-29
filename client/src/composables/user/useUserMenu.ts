/**
 * User 菜单管理 Composable
 *
 * 负责用户中心菜单的配置、导航和状态管理
 *
 * @packageDocumentation
 */

import { ref, computed, watch, type Component } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import { User, Lock, Bell, Settings, Wrench, FileText, BarChart3, Key, Trophy, BookOpen } from '@/lib/lucide-fallback'
import { nextTick } from 'vue'

/**
 * 菜单类型定义
 */
export type MenuType =
  | 'profile'
  | 'security'
  | 'messages'
  | 'privacy'
  | 'settings'
  | 'orders'
  | 'upload'
  | 'favorites'
  | 'purchases'
  | 'examine'
  | 'statistics'
  | 'developer'
  | 'purchases-records'
  | 'api-service'
  | 'benefits'
  | 'study'

/**
 * 菜单项配置接口
 */
export interface MenuItem {
  index: MenuType
  label: string
  icon: Component
  badge: number
}

/**
 * useUserMenu 配置选项
 */
export interface UseUserMenuOptions {
  /** 初始菜单项 */
  initialMenu?: MenuType
}

/**
 * User 菜单管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回菜单状态和方法
 */
export function useUserMenu(options: UseUserMenuOptions = {}) {
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const { initialMenu } = options

  // 当前激活的菜单
  const activeMenu = ref<MenuType>(
    (route.query.tab as MenuType | undefined) || initialMenu || 'profile'
  )

  // 菜单项配置
  const menuItems = computed<MenuItem[]>(() => [
    { index: 'profile', label: t('user.menu.profile'), icon: markIcon(User), badge: 0 },
    { index: 'security', label: t('user.menu.security'), icon: markIcon(Lock), badge: 0 },
    { index: 'messages', label: t('user.menu.messages'), icon: markIcon(Bell), badge: 0 },
    { index: 'privacy', label: t('user.menu.privacy'), icon: markIcon(Settings), badge: 0 },
    { index: 'settings', label: t('user.menu.settings'), icon: markIcon(Wrench), badge: 0 },
    { index: 'orders', label: t('user.menu.orders'), icon: markIcon(FileText), badge: 0 },
    { index: 'upload', label: t('user.menu.uploadAgent'), icon: markIcon(FileText), badge: 0 },
    { index: 'favorites', label: t('user.menu.favorites'), icon: markIcon(FileText), badge: 0 },
    { index: 'purchases', label: t('user.menu.purchases'), icon: markIcon(FileText), badge: 0 },
    { index: 'examine', label: t('user.menu.examine'), icon: markIcon(FileText), badge: 0 },
    { index: 'statistics', label: t('user.menu.statistics'), icon: markIcon(BarChart3), badge: 0 },
    { index: 'developer', label: t('user.menu.developer'), icon: markIcon(FileText), badge: 0 },
    { index: 'purchases-records', label: t('user.menu.purchaseRecords'), icon: markIcon(FileText), badge: 0 },
    { index: 'api-service', label: t('user.menu.apiService'), icon: markIcon(Key), badge: 0 },
    { index: 'benefits', label: t('user.menu.benefits', '会员权益'), icon: markIcon(Trophy), badge: 0 },
    { index: 'study', label: t('user.menu.study', '学习'), icon: markIcon(BookOpen), badge: 0 },
  ])

  // 页面标题和描述配置
  const PAGE_TITLES: Record<MenuType, string> = {
    profile: t('user.sections.profile.title'),
    security: t('user.sections.security.title'),
    messages: t('user.messages.title'),
    privacy: t('user.privacy.title'),
    settings: t('user.settings.title'),
    orders: t('user.menu.orders'),
    upload: t('user.sections.upload.title'),
    favorites: t('user.favorites.title'),
    purchases: t('user.purchases.title'),
    examine: t('user.examine.title'),
    statistics: t('user.statistics.title'),
    developer: t('user.menu.developer'),
    'purchases-records': t('user.menu.purchaseRecords'),
    'api-service': t('user.apiService.title'),
    benefits: t('user.benefits.title', '会员权益'),
    study: t('user.study.title', '学习中心'),
  }

  const PAGE_DESCRIPTIONS: Record<MenuType, string> = {
    profile: t('user.sections.profile.description'),
    security: t('user.sections.security.description'),
    messages: t('user.sections.messages.description'),
    privacy: t('user.sections.privacy.description'),
    settings: t('user.sections.settings.description'),
    orders: t('user.sections.orders.description'),
    upload: t('user.sections.upload.description'),
    favorites: t('user.sections.favorites.description'),
    purchases: t('user.sections.purchases.description'),
    examine: t('user.sections.examine.description'),
    statistics: t('user.sections.statistics.description'),
    developer: t('user.sections.developer.description'),
    'purchases-records': t('user.sections.purchaseRecords.description'),
    'api-service': t('user.apiService.description'),
    benefits: t('user.benefits.description', '查看会员权益对比，了解不同会员等级的特权'),
    study: t('user.study.description', '浏览学习资源，提升AI技能'),
  }

  // 计算属性：当前页面标题
  const pageTitle = computed((): string => {
    return PAGE_TITLES[activeMenu.value] || PAGE_TITLES.profile
  })

  // 计算属性：当前页面描述
  const pageDescription = computed((): string => {
    return PAGE_DESCRIPTIONS[activeMenu.value] || ''
  })

  // 有效的菜单类型列表
  const VALID_MENU_TYPES: MenuType[] = [
    'profile',
    'security',
    'messages',
    'privacy',
    'settings',
    'orders',
    'upload',
    'favorites',
    'purchases',
    'examine',
    'statistics',
    'developer',
    'purchases-records',
    'api-service',
    'benefits',
    'study',
  ]

  /**
   * 需要跳转到独立页面的菜单项
   */
  const EXTERNAL_ROUTES: Partial<Record<MenuType, string>> = {
    settings: '/settings',
  }

  /**
   * 处理菜单选择
   */
  const handleMenuSelect = (index: string): void => {
    const menuIndex = index as MenuType

    // 检查是否需要跳转到独立页面
    const externalRoute = EXTERNAL_ROUTES[menuIndex]
    if (externalRoute) {
      router.push(externalRoute).catch((error: unknown) => {
        // 忽略导航重复错误
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          ((error as { name?: string }).name === 'NavigationDuplicated' || (error as { name?: string }).name === 'NavigationRedirected')
        ) {
          return
        }
        logger.error('[UserMenu] Page navigation failed:', error)
      })
      return
    }

    // 防止重复点击
    if (activeMenu.value === menuIndex) return

    activeMenu.value = menuIndex

    // 更新URL参数，但不刷新页面
    router
      .replace({
        path: route.path,
        query: {
          ...(route.query as Record<string, string | string[] | null | undefined>),
          tab: menuIndex,
        },
      } as Parameters<typeof router.replace>[0])
      .catch((error: unknown) => {
        // 忽略导航重复错误
        if (
          error &&
          typeof error === 'object' &&
          'name' in error &&
          ((error as { name?: string }).name === 'NavigationDuplicated' || (error as { name?: string }).name === 'NavigationRedirected')
        ) {
          return
        }
        logger.error('[UserMenu] Menu switch failed:', error)
      })

    // 滚动到顶部
    void nextTick(() => {
      const contentCard = document.querySelector('.content-card')
      if (contentCard) {
        contentCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  /**
   * 键盘导航支持
   */
  const handleNavKeydown = (event: KeyboardEvent, currentIndex: number): void => {
    const items = menuItems.value
    let targetIndex = currentIndex

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        targetIndex = (currentIndex + 1) % items.length
        break
      case 'ArrowUp':
        event.preventDefault()
        targetIndex = (currentIndex - 1 + items.length) % items.length
        break
      case 'Home':
        event.preventDefault()
        targetIndex = 0
        break
      case 'End':
        event.preventDefault()
        targetIndex = items.length - 1
        break
      default:
        return
    }

    if (targetIndex !== currentIndex) {
      handleMenuSelect(items[targetIndex].index)
      // 更新焦点
      void nextTick(() => {
        const navItems = document.querySelectorAll('.nav-item')
        if (navItems[targetIndex]) {
          ;(navItems[targetIndex] as HTMLElement).focus()
        }
      })
    }
  }

  // 监听URL参数变化
  watch(
    () => route.query.tab as string | undefined,
    (tab: string | undefined): void => {
      if (tab && VALID_MENU_TYPES.includes(tab as MenuType)) {
        const menuTab = tab as MenuType
        // 防止重复设置
        if (activeMenu.value !== menuTab) {
          handleMenuSelect(menuTab)
        }
      }
    },
    { immediate: false }
  )

  return {
    // 状态
    activeMenu,
    menuItems,
    pageTitle,
    pageDescription,

    // 方法
    handleMenuSelect,
    handleNavKeydown,
  }
}
