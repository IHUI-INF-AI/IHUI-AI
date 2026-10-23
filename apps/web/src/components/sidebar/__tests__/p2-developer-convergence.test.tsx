// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom

/**
 * P2 六大域收敛第一批 —— 开发者域收敛锁(2026-10-23,票 L7241)
 *
 * 本批把 developerGroup 顶层 7 项收敛为 1 个域入口「开发者工具」(/developer,
 * 工作台顶页即域落点,无需新增 /domains/developer)。四条判据各钉一件事:
 *  ① 顶层只剩 1 枚非 admin 域入口 + 2 枚 adminOnly 原位项(收敛本体);
 *  ② href 多重集 23 条逐字守恒(收敛不丢项、不造新链接);
 *  ③ 重复 href 只剩"父项+子菜单"设计意图那一对,且两个 labelKey 互不相同
 *     (React key=href 双条目是 P1 记档的同型病);
 *  ④ 三层可见性判据(adminOnly / permission / advancedOnly)未被合并:
 *     本域无 permission;adminOnly 只随 role 动;tier 只随档位动;
 *  ⑤ DomainHub(域入口消费方)与 Sidebar(引用组合)对同一清单过滤结果一致
 *     —— 两消费方共用 useNavVisibilityFilter,这一格是"谁也不许另抄一份过滤"
 *     (AGENTS §4 侧边栏可见性三层分治 + §0.6 单一真相源)的实跑旁证。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type * as ApiClientModule from '@ihui/api-client'

// ── Mock:next/link 渲染成真实 <a>(收集域入口页渲染出的 href 集合) ──
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children?: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ── Mock:next-intl 取词直接回显 key(本测试判 href 集合,不判文案) ──
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// ── Mock:鉴权面用可切换的快照(不触真实登录态;use-nav-visibility 只按选择器读字段) ──
interface FakeUser {
  id: string
  roleId: number
  permissions: string[]
}
const fakeAuth: { user: FakeUser | null } = { user: null }
vi.mock('@/stores/auth', () => ({
  __esModule: true,
  // 选择器形态与真 store 一致;getState 兜住 transitive import(src/lib/api 的
  // token provider 在调用时读 getState().token,本测试从不发真请求)
  useAuthStore: Object.assign(
    (selector: (s: { user: FakeUser | null; token: null }) => unknown) =>
      selector({ user: fakeAuth.user, token: null }),
    { getState: () => ({ user: fakeAuth.user, token: null }) },
  ),
}))

// ── Mock:api-client 只换偏好端点(其余导出保留真实,transitive 的 setTokenProvider
//    / fetchApi 等必须存在,否则 src/lib/api.ts 模块顶层即报缺导出) ──
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>()
  return {
    ...actual,
    getPreferences: vi.fn(async () => ({ success: false, data: { settings: {} } })),
    updatePreferences: vi.fn(async () => ({ success: false })),
  }
})

import { NAV_GROUPS, EDU_HUB_ITEMS, flattenNavItems } from '@/components/sidebar/nav-data'
import { filterNavItemsByRole, filterNavItemsByTier } from '@/components/sidebar/use-nav-visibility'
import { useNavVisibilityStore } from '@/stores/nav-visibility'
import { DomainHub } from '@/components/layout/DomainHub'
import type { NavAdvancedTier, NavItem } from '@/components/sidebar/types'

const developerGroup = NAV_GROUPS.find((g) => g.label === 'developerGroup')!

/** 收敛前(2026-10-22 HEAD)实测的 developerGroup flatten href 多重集,逐字快照。
 *  其中 /developer/webhooks 原以"父项+子项"出现 2 次,收敛后只剩子项 1 次;
 *  /developer 以"域入口父项+子项"出现 2 次 —— 总数 23 不变。 */
const PRE_CONVERGENCE_SNAPSHOT = [
  '/admin/meta-learner',
  '/developer',
  '/developer',
  '/developer/api-docs',
  '/developer/billing',
  '/developer/error-codes',
  '/developer/limits',
  '/developer/logs',
  '/developer/notifications',
  '/developer/relay',
  '/developer/relay/benefits',
  '/developer/relay/keys',
  '/developer/relay/subscriptions',
  '/developer/relay/usage',
  '/developer/sandbox',
  '/developer/settings',
  '/developer/subscription',
  '/developer/team',
  '/developer/versions',
  '/developer/webhooks',
  '/edu-ai/tbox',
  '/playground',
  '/purchase',
]

/** Sidebar 侧引用组合:与 useNavVisibilityFilter 回调体逐字同序(先 role 后 tier) */
const sidebarStyleFilter = (
  items: NavItem[],
  isAdmin: boolean,
  perms: string[],
  hiddenTiers: NavAdvancedTier[],
): NavItem[] => filterNavItemsByTier(filterNavItemsByRole(items, isAdmin, perms), hiddenTiers)

const collectHrefs = (items: NavItem[]): string[] =>
  [...new Set(flattenNavItems(items).map((i) => i.href))].sort()

function setPersona(user: FakeUser | null, hiddenTiers: NavAdvancedTier[]) {
  fakeAuth.user = user
  useNavVisibilityStore.setState({ hydrated: true, hiddenTiers })
}

/** 渲染 DomainHub 并收集其真实产出的 <a href> 集合(消费方②) */
function domainHubHrefs(items: NavItem[]): string[] {
  const { container } = render(<DomainHub title="hub" sections={[{ items }]} />)
  const hrefs = Array.from(container.querySelectorAll('a[href]'))
    .map((a) => a.getAttribute('href'))
    .filter((h): h is string => h !== null)
  cleanup()
  return [...new Set(hrefs)].sort()
}

beforeEach(() => {
  useNavVisibilityStore.setState({ hydrated: true, hiddenTiers: [] })
})

afterEach(() => {
  cleanup()
})

describe('P2 收敛第一批:开发者域结构', () => {
  it('① 顶层只剩 1 枚非 admin 域入口 + 2 枚 adminOnly 原位项', () => {
    expect(developerGroup.items.map((i) => i.href)).toEqual([
      '/developer',
      '/edu-ai/tbox',
      '/admin/meta-learner',
    ])
    const hub = developerGroup.items[0]
    if (!hub) throw new Error('developerGroup 顶层首位必须是域入口')
    expect(hub.labelKey).toBe('developerTools')
    expect(hub.advancedOnly).toBe('developer')
    expect(hub.children?.length).toBe(20)
  })

  it('② href 多重集逐字守恒(23 条,不丢项不造新)', () => {
    const hrefs = flattenNavItems(developerGroup.items)
      .map((i) => i.href)
      .sort()
    expect(hrefs).toEqual(PRE_CONVERGENCE_SNAPSHOT)
  })

  it('③ 零意外重复 href:唯一重复是"父项+子菜单"设计意图且 labelKey 互异', () => {
    const counts = new Map<string, number>()
    for (const i of flattenNavItems(developerGroup.items)) {
      counts.set(i.href, (counts.get(i.href) ?? 0) + 1)
    }
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1)
    expect(duplicated).toEqual([['/developer', 2]])
    const pair = flattenNavItems(developerGroup.items).filter((i) => i.href === '/developer')
    expect(new Set(pair.map((i) => i.labelKey)).size).toBe(2)
  })

  it('④ 三层可见性判据未合并:本域无 permission;role/tier 各管一头', () => {
    // permission 层:开发者域全部条目都不带权限点(它不该有,带了就是本次误改)
    expect(flattenNavItems(developerGroup.items).some((i) => i.permission !== undefined)).toBe(
      false,
    )
    // adminOnly 只随 role 动:tier 全藏也不影响两枚 admin 项
    const adminAllTiers = sidebarStyleFilter(
      developerGroup.items,
      true,
      [],
      ['developer', 'relayOps', 'advancedAi', 'experimental'],
    )
    expect(collectHrefs(adminAllTiers)).toEqual(['/admin/meta-learner', '/edu-ai/tbox'])
    // tier 只随档位动:'developer' 档一藏,整域对普通用户归零(admin 项被 role 挡)
    const normalHidden = sidebarStyleFilter(developerGroup.items, false, [], ['developer'])
    expect(normalHidden).toHaveLength(0)
    // 档位不藏时普通用户可见全 21 项(role 挡掉的只有 2 枚 adminOnly)
    const normalShown = sidebarStyleFilter(developerGroup.items, false, [], [])
    expect(flattenNavItems(normalShown)).toHaveLength(21)
    expect(collectHrefs(normalShown)).toEqual(
      collectHrefs(developerGroup.items).filter(
        (h) => h !== '/edu-ai/tbox' && h !== '/admin/meta-learner',
      ),
    )
  })

  it('⑤ DomainHub 与 Sidebar 对同一清单过滤结果一致(共用 useNavVisibilityFilter)', () => {
    const personas: Array<{
      name: string
      user: FakeUser | null
      tiers: NavAdvancedTier[]
    }> = [
      { name: '普通用户·全档位显示', user: { id: 'u1', roleId: 0, permissions: [] }, tiers: [] },
      {
        name: '普通用户·简洁模式',
        user: { id: 'u1', roleId: 0, permissions: [] },
        tiers: ['developer'],
      },
      {
        name: '教师(持 edu:manage)',
        user: { id: 'u2', roleId: 0, permissions: ['edu:manage'] },
        tiers: ['developer', 'relayOps', 'advancedAi', 'experimental'],
      },
      { name: '管理员', user: { id: 'u3', roleId: 1, permissions: ['*:*:*'] }, tiers: [] },
    ]
    for (const p of personas) {
      setPersona(p.user, p.tiers)
      const isAdmin = p.user !== null && p.user.roleId >= 1
      const perms = p.user?.permissions ?? []
      for (const [label, items] of [
        ['开发者域', developerGroup.items],
        ['教育域清单', EDU_HUB_ITEMS],
      ] as const) {
        expect({ persona: p.name, label, hrefs: domainHubHrefs(items) }).toEqual({
          persona: p.name,
          label,
          hrefs: collectHrefs(sidebarStyleFilter(items, isAdmin, perms, p.tiers)),
        })
      }
    }
    // 教师视角必须有东西被滤掉,否则 permission 层是摆设(正向对照)
    setPersona({ id: 'u2', roleId: 0, permissions: ['edu:manage'] }, [])
    const teacherEdu = domainHubHrefs(EDU_HUB_ITEMS)
    setPersona({ id: 'u1', roleId: 0, permissions: [] }, [])
    const normalEdu = domainHubHrefs(EDU_HUB_ITEMS)
    expect(teacherEdu.length).toBeGreaterThan(normalEdu.length)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
