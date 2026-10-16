// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useAuthStore } from '@/stores/auth'
import { getSidebarNavPreference, updateSidebarNavPreference } from '@ihui/api-client'
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

/** 过滤掉已不存在的导航项(保持顺序)。载入/合并/远端解析三处共用,只有一份实现。 */
function filterValid(hrefs: unknown): string[] {
  if (!Array.isArray(hrefs)) return []
  const valid = new Set(ALL_NAV_HREFS)
  return hrefs.filter((h): h is string => typeof h === 'string' && valid.has(h))
}

function readUserHrefs(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId)
    if (!raw) return []
    return filterValid(JSON.parse(raw))
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
  /** 拖拽排序:把 from 位置的项移到 to 位置 */
  reorderHref: (from: number, to: number) => void
  /** 判断某 href 是否已被收藏 */
  isCustom: (href: string) => boolean
}

export function useCustomNav(): CustomNavApi {
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const [hrefs, setHrefs] = React.useState<string[]>([])
  const [hydrated, setHydrated] = React.useState(false)
  // 服务端已确认过状态的用户 id:同步只做一次,避免每次重渲染都打接口。
  // 用 ref 而非 state —— 它不参与渲染,变化不该触发重渲染。
  const syncedUserRef = React.useRef<string | null>(null)

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

  // 服务端同步(2026-10-16 立):登录后拉一次远端,与本地归并。
  //
  // 归并规则(必须是可判定的,不能靠"哪边新"猜):
  //  - 远端从未设置过(exists=false)⇒ 以本地为准,并把本地推上去。
  //    这是老用户升级路径:他以前只在 localStorage 存过,第一次上云时不能丢。
  //  - 远端设置过 ⇒ **以远端为准**(服务端是唯一真相源),本地差异直接丢弃。
  //    不做双向并集:并集会让"我在 B 设备删掉的项"被 A 设备的陈旧缓存复活。
  //  - 网络失败 ⇒ 保持本地态,不打标记,下次挂载重试(静默降级,不弹错)。
  React.useEffect(() => {
    if (!userId || !hydrated) return
    if (syncedUserRef.current === userId) return
    let cancelled = false
    void (async () => {
      const res = await getSidebarNavPreference()
      if (cancelled) return
      if (!res.success) return // 失败不标记,留给下次
      syncedUserRef.current = userId
      const remote = filterValid(res.data.hrefs)
      if (res.data.exists) {
        setHrefs(remote)
        return
      }
      // 远端从未设置过:把本地(已过滤)推上去。本地也空则无需写。
      const local = readUserHrefs(userId)
      if (local.length > 0) {
        setHrefs(local)
        void updateSidebarNavPreference(local)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, hydrated])

  // 仅当用户已登录且已水合后才持久化(未登录不写、不残留)
  React.useEffect(() => {
    if (!userId || !hydrated) return
    try {
      window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(hrefs))
    } catch {
      // localStorage 不可用(隐私模式等),静默降级为内存态
    }
  }, [userId, hydrated, hrefs])

  // 变更上推(2026-10-16 立):本地即时生效(乐观),远端异步写、失败不影响本地。
  // 首次同步完成的那个瞬间不推 —— 那次 hrefs 是"归并结果"本身,推上去等于自己写回自己。
  // 判据:以同步完成时的 hrefs 序列化为基线,之后只有序列化值变了才推。
  const lastSyncedRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!userId || !hydrated) return
    // 同步未完成期间不写:那时 hrefs 还是"载入中"的中间态,推上去会污染远端。
    if (syncedUserRef.current !== userId) return
    const serialized = JSON.stringify(hrefs)
    if (lastSyncedRef.current === null) {
      lastSyncedRef.current = serialized // 立基线,不推
      return
    }
    if (lastSyncedRef.current === serialized) return
    lastSyncedRef.current = serialized
    void updateSidebarNavPreference(hrefs)
  }, [userId, hydrated, hrefs])

  const addHref = React.useCallback((href: string) => {
    setHrefs((prev) => (prev.includes(href) ? prev : [...prev, href]))
  }, [])

  const removeHref = React.useCallback((href: string) => {
    setHrefs((prev) => prev.filter((h) => h !== href))
  }, [])

  const isCustom = React.useCallback((href: string) => hrefs.includes(href), [hrefs])

  /**
   * 把 from 位置的项移动到 to 位置(拖拽排序)。
   * 索引越界或原地不动 ⇒ 返回原数组引用,不触发无意义的重渲染与远端写。
   */
  const reorderHref = React.useCallback((from: number, to: number) => {
    setHrefs((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = [...prev]
      // splice 的返回类型是 string[](索引访问在 noUncheckedIndexedAccess 下为 string|undefined),
      // 长度已在上面判过、取值必然存在;仍显式兜一层,避免未来改动把这里变成 undefined 注入点 —
      // 往 hrefs 里塞 undefined 会一路传到 NavLink 的 href 上,症状离病灶很远。
      const [moved] = next.splice(from, 1)
      if (moved === undefined) return prev
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  return { userId, hydrated, customHrefs: hrefs, addHref, removeHref, reorderHref, isCustom }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
