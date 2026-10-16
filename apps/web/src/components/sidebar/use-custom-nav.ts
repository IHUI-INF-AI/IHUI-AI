// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { ALL_NAV_HREFS } from './nav-data'

/**
 * 自定义侧边栏功能键(2026-10-16 立)
 *
 * 需求:登录态下,用户在侧边栏「自定义」栏中添加自己常用的侧边栏功能键,
 * 数据按用户 id 隔离、持久化在 localStorage(登录态专属,切换账号互不影响)。
 *
 * 设计要点:
 * - 仅存储 href 字符串,图标/文案/翻译全部在渲染期从 nav-data 的 FLAT_NAV_ITEMS 解析,
 *   保证与现有导航项视觉、active 高亮、预取行为完全一致,且后续改导航文案零维护成本。
 * - 载入时按 ALL_NAV_HREFS 过滤,剔除已被删除/改路由的失效项,避免死链。
 * - SSR 安全:首帧 userId 为空(无 cookie),组件不渲染;客户端 auth 水合后再决定显隐。
 */

const STORAGE_PREFIX = 'sidebar-custom-nav-'

function readUserHrefs(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // 仅保留仍是合法导航项的 href,剔除失效项(保持插入顺序)
    const valid = new Set(ALL_NAV_HREFS)
    return parsed.filter((h): h is string => typeof h === 'string' && valid.has(h))
  } catch {
    return []
  }
}

export interface CustomNavApi {
  /** 当前登录用户 id;null 表示未登录 */
  userId: string | null
  /** 是否已从 localStorage 水合(用于避免 SSR/client 闪烁) */
  hydrated: boolean
  /** 当前用户的自定义 href 列表(已按 ALL_NAV_HREFS 过滤) */
  customHrefs: string[]
  /** 添加一个 href(已存在则幂等) */
  addHref: (href: string) => void
  /** 移除一个 href */
  removeHref: (href: string) => void
  /** 判断某 href 是否已被收藏 */
  isCustom: (href: string) => boolean
}

export function useCustomNav(): CustomNavApi {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [hrefs, setHrefs] = React.useState<string[]>([])
  const [hydrated, setHydrated] = React.useState(false)

  // 登录态变化 / 首次挂载:按用户 id 从 localStorage 载入该用户的自定义项
  React.useEffect(() => {
    if (!userId) {
      setHrefs([])
      setHydrated(true)
      return
    }
    setHrefs(readUserHrefs(userId))
    setHydrated(true)
  }, [userId])

  // 仅当用户已登录且已水合后才持久化(未登录不写、不残留)
  React.useEffect(() => {
    if (!userId || !hydrated) return
    try {
      window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(hrefs))
    } catch {
      // localStorage 不可用(隐私模式等),静默降级为内存态
    }
  }, [userId, hydrated, hrefs])

  const addHref = React.useCallback((href: string) => {
    setHrefs((prev) => (prev.includes(href) ? prev : [...prev, href]))
  }, [])

  const removeHref = React.useCallback((href: string) => {
    setHrefs((prev) => prev.filter((h) => h !== href))
  }, [])

  const isCustom = React.useCallback((href: string) => hrefs.includes(href), [hrefs])

  return { userId, hydrated, customHrefs: hrefs, addHref, removeHref, isCustom }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
