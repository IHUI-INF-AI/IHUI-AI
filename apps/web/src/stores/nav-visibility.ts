// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { create } from 'zustand'
import { getPreferences, updatePreferences } from '@ihui/api-client'
import type { NavAdvancedTier } from '@/components/sidebar/types'

/**
 * 侧边栏简洁模式 store(2026-10-20 立)
 *
 * 立因:侧边栏里「开发者 / 中转站运营后台 / Agent 框架内部 / 实验性」这四类入口,
 * 权限上用户能进、产品上他不该看见 —— roleId / permission 两层硬过滤挡不住这种,
 * 缺的正是这个**用户自选层**。
 * 计量口径(勿手改数字,按 `__tests__/nav-tier-visibility.test.ts` 现读同步):
 * 侧边栏树 28 项里 21 项带档;AI 域清单 54 项里 41 项带档(2026-10-23 起 AI 域
 * 那批条目搬到域入口页面,不在侧边栏树这一面,所以是两面各自计量)。
 *
 * 为什么必须是 store 而不是组件 state:设置页改开关要**当场**反映到侧边栏,
 * 两者不是父子关系(侧栏挂在 GlobalShell,设置页是路由 children),
 * 用 context 会把整棵 doc tree 包起来;zustand 选择器订阅是最省的一条路
 * (与 useNavigationStore / useAiPanelStore 同 patterns)。
 *
 * 三处形变必须同步改(单一真相源,AGENTS.md §0.6):
 *   1. `ALL_NAV_TIERS` 本文件
 *   2. `NavAdvancedTier` 类型 @/components/sidebar/types
 *   3. 设置页开关组 @/app/(main)/settings/preferences
 */

/** 四档全量清单。**顺序即设置页开关的排列顺序**,改动要跟着改 UI 分组标题。 */
export const ALL_NAV_TIERS: readonly NavAdvancedTier[] = [
  'developer',
  'relayOps',
  'advancedAi',
  'experimental',
]

const STORAGE_KEY = 'nav-tiers'
/** 服务端偏好 key(落 user_preferences.group='preferences') */
const PREF_KEY = 'navTiers'

/**
 * 解析为合法档位数组。三重防御:
 *  - 非数组 ⇒ 空
 *  - 未知字符串 ⇒ 丢弃(删档位/改名后旧数据不能让过滤静默失效)
 *  - 输出按 ALL_NAV_TIERS 固定序重排 ⇒ 序列化值稳定,
 *    上推判等才有意义(否则同集合不同顺序会被误判成"变了",每次都推)
 */
function parseTiers(raw: unknown): NavAdvancedTier[] {
  if (!Array.isArray(raw)) return []
  return ALL_NAV_TIERS.filter((t) => raw.includes(t))
}

function readLocal(): NavAdvancedTier[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null // 从未设置过,与"设置过但为空"必须区分
    return parseTiers(JSON.parse(raw))
  } catch {
    return null
  }
}

interface NavVisibilityState {
  /** 是否已水合(SSR 首帧恒 false,渲染默认态) */
  hydrated: boolean
  /** 当前被隐藏的档位;空数组 = 四档全部显示 */
  hiddenTiers: NavAdvancedTier[]
  /** 单档开关 */
  setTier: (tier: NavAdvancedTier, hidden: boolean) => void
  /** 总闸:true = 四档全隐藏(简洁模式) */
  setAllTiers: (hidden: boolean) => void
  /** 水合入口:幂等,重复调用只生效一次。userId 为空则只走本地 */
  hydrate: (userId: string | null) => Promise<void>
}

export const useNavVisibilityStore = create<NavVisibilityState>((set, get) => {
  /** 变更出口:set + 本地持久化 + 服务端上推(失败不影响本地,已是单边可接受态) */
  const commit = (next: NavAdvancedTier[]) => {
    const prev = get().hiddenTiers
    const same = next.length === prev.length && next.every((t, i) => t === prev[i])
    if (same) return // 返回同一引用的语义:不通知订阅者,不产生无意义重渲染与远端写
    set({ hiddenTiers: next })
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 隐私模式下 localStorage 不可用,降级为内存态
    }
    void updatePreferences({ [PREF_KEY]: JSON.stringify(next) })
  }

  return {
    hydrated: false,
    // SSR 首帧:什么都不藏。与 sidebar-collapsed 同一策略(SSR 输出默认态,
    // hydrate 后一帧内切到用户偏好),避免服务端/客户端不一致。
    hiddenTiers: [],
    setTier: (tier, hidden) => {
      const cur = get().hiddenTiers
      commit(hidden ? (cur.includes(tier) ? cur : [...cur, tier]) : cur.filter((t) => t !== tier))
    },
    setAllTiers: (hidden) => commit(hidden ? [...ALL_NAV_TIERS] : []),
    hydrate: async (userId) => {
      if (get().hydrated) return
      const local = readLocal()
      // 从未设置过 ⇒ 默认全隐藏(简洁模式默认开)。
      // 这是产品判断:那批研发向条目对绝大多数用户一次都用不上,默认展示是纯粹的噪声。
      const firstFrame = local ?? [...ALL_NAV_TIERS]
      set({ hydrated: true, hiddenTiers: firstFrame })
      if (!userId) return
      // 远端为准(服务端是唯一真相源),本地只用作首帧渲染与离线降级。
      // 之所以不做双向并集:并集会让"我在 B 设备删掉的项"被 A 设备的陈旧缓存复活
      // (同 use-custom-nav.ts 的归并规则,与它保持一致,不要两套判据)。
      let res
      try {
        res = await getPreferences()
      } catch {
        return
      }
      if (!res.success) return
      const raw = res.data.settings[PREF_KEY]
      if (typeof raw !== 'string' || raw === '') return
      // try 是必需的,不是洁癖:value 是 text 列,历史脏数据/手工写入都可能不是合法 JSON
      // (后端 GET 侧对 preferences 不做结构化校验)。未兜住时 hydrate 会 reject 成
      // unhandledrejection,并在 await 之前那行 `set(hydrated:true)` 之后留下"已水合但偏好没生效"的半态。
      let remote: NavAdvancedTier[]
      try {
        remote = parseTiers(JSON.parse(raw))
      } catch {
        return
      }
      // 「以远端为准」盖住的只能是**水合那一帧**的状态(2026-10-25 补)。侧栏首帧就按本地
      // 渲染出来了,设置页的开关当场可拨;GET 在飞期间用户拨过 ⇒ 这帧远端是他改动**之前**
      // 的快照,照盖就是"我拨了它又弹回来",而他那一次的 PUT 已经发出去了 ⇒ 屏幕与云端背离。
      // 引用判据够用:commit 每次真变更都换一个新数组(值没变时它当场 return,不动引用)。
      if (get().hiddenTiers !== firstFrame) return
      set({ hiddenTiers: remote })
    },
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
