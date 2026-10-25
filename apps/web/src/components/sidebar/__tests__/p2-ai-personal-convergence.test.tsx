// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom

/**
 * P2 六大域收敛第二批 —— AI 域 + 个人域收敛锁(2026-10-23,票 L7241)
 *
 * 本批把 aiGroupLabel(顶层 15 项 / flatten 54(2026-10-24 个人号池入口入册))与 personalGroup(顶层 5 项 /
 * flatten 22)各收敛为 1 个域入口(/domains/ai、/domains/personal),条目整体移入
 * AI_HUB_ITEMS / PERSONAL_HUB_ITEMS 由新建的域入口页消费。六条判据各钉一件事:
 *  ① 顶层收敛读数:两域各只剩 1 枚入口,NAV_GROUPS 仍 9 组、顶层 30 项
 *     (入口条目数守恒搬进了域清单:15 项进 AI_HUB_ITEMS、5 项进 PERSONAL_HUB_ITEMS(2026-10-24 个人号池入口入册));
 *  ② href 多重集逐字守恒(53 / 22):收敛不丢项、不造新链接;
 *  ③ 零新增意外重复:重复 href 恰为收敛前既有的两对,且都是"父项+子菜单"设计形;
 *  ④ 三层可见性判据(adminOnly / permission / advancedOnly)未被合并:
 *     两域均无 adminOnly/permission;档位判据在域清单上照旧逐档生效;
 *     域入口父项**不得**带档位 —— 入口一旦被简洁模式藏掉,域内 13 项用户功能就一起锁死;
 *  ⑤ DomainHub(域入口页)与 Sidebar 引用组合对同一清单过滤结果一致
 *     —— 两消费方共用 useNavVisibilityFilter,谁也不许另抄一份过滤(AGENTS §4)。
 *  ⑥ 文案独立性(2026-10-23 补最后一格):两域入口页各取**本域命名空间**的
 *     title + subtitle(aiHub / personalHub,与 eduHub / contentHub / tradeHub 同族形态),
 *     五语言(zh-CN/zh-TW/en/ja/ko)键集齐备且值非空,标题不再等于侧边栏分组头那枚键的
 *     取值(首版直接复用 nav.aiGroupLabel / nav.user ⇒ 入口页与分组头同名、没有副标题)。
 *     同一维还钉住「改文案没碰条目」:页面渲染出的 href 集合与清单过滤结果逐字相同。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, cleanup } from '@testing-library/react'
import type * as ApiClientModule from '@ihui/api-client'

// ── Mock:next/link 渲染成真实 <a>(收集域入口页渲染出的 href 集合) ──
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children?: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// ── Mock:next-intl 取词按「命名空间.键」回显 ──
// ①~⑤ 判 href 集合与档位,与文案无关(改前只回显裸键,同样不参与断言);
// ⑥ 判的正是「页面取的是哪一枚键」⇒ 必须把命名空间一起露出来,否则
//   nav.aiGroupLabel 与 aiHub.title 在测试里长得一样,文案独立性那一维成了摆设。
vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
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

import {
  AI_HUB_ITEMS,
  NAV_GROUPS,
  PERSONAL_HUB_ITEMS,
  flattenNavItems,
} from '@/components/sidebar/nav-data'
import { filterNavItemsByRole, filterNavItemsByTier } from '@/components/sidebar/use-nav-visibility'
import { useNavVisibilityStore } from '@/stores/nav-visibility'
import { DomainHub } from '@/components/layout/DomainHub'
import type { NavAdvancedTier, NavItem } from '@/components/sidebar/types'
// 被测的两枚域入口页(app/(main)/ 不在 '@' 别名射程内,按相对路径引)
import AiHubPage from '../../../../app/(main)/domains/ai/page'
import PersonalHubPage from '../../../../app/(main)/domains/personal/page'

const aiGroup = NAV_GROUPS.find((g) => g.label === 'aiGroupLabel')!
const personalGroup = NAV_GROUPS.find((g) => g.label === 'personalGroup')!

/** 收敛前(2026-10-23 06:33 现读 aiGroupLabel flatten)href 多重集逐字快照,54 条(2026-10-24 b23f01cf219 个人号池入口 /account-pool 入册后 53→54)。
 *  其中 /memory 与 /knowledge-base 各以"父项+子菜单首子项"出现 2 次 —— 收敛后照原样带走。 */
const AI_PRE_CONVERGENCE_SNAPSHOT = [
  '/a2a',
  '/account-pool',
  '/agent-canvas',
  '/agent-teams',
  '/agent-workbench',
  '/agents',
  '/ai-world',
  '/ai-world/favorites',
  '/available-channels',
  '/chat/history',
  '/checkin',
  '/cloud-agent',
  '/computer-use',
  '/context',
  '/context-compaction',
  '/deep-research',
  '/figma-import',
  '/knowledge-base',
  '/knowledge-base',
  '/knowledge-cards',
  '/knowledge-graph',
  '/knowledge-rag',
  '/media-tasks',
  '/memory',
  '/memory',
  '/models',
  '/models/api-docs',
  '/models/billing',
  '/models/channels',
  '/models/chats',
  '/models/eval',
  '/models/groups',
  '/models/keys',
  '/models/logs',
  '/models/openclaw',
  '/models/overview',
  '/models/prompts',
  '/models/redeem',
  '/models/referral',
  '/models/skills',
  '/models/trajectory',
  '/models/usage',
  '/models/users',
  '/orchestration',
  '/personas',
  '/plan',
  '/registry',
  '/repo-wiki',
  '/spec',
  '/subagents',
  '/team-knowledge',
  '/voices',
  '/web-tools',
  '/workspace',
]

/** 收敛前(同一刻现读 personalGroup flatten)href 多重集逐字快照,22 条。
 *  /favorites 与 /user/profile 各以"父项+子菜单首子项"出现 2 次。 */
const PERSONAL_PRE_CONVERGENCE_SNAPSHOT = [
  '/favorites',
  '/favorites',
  '/feedback',
  '/following',
  '/help',
  '/notifications',
  '/student',
  '/subscriptions',
  '/user/ask',
  '/user/circle',
  '/user/comment',
  '/user/exam',
  '/user/fans',
  '/user/follow',
  '/user/learn-record',
  '/user/profile',
  '/user/profile',
  '/user/realname',
  '/user/resource',
  '/user/security',
  '/user/sign-up',
  '/user/subscription',
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

const duplicateCounts = (items: NavItem[]): Array<[string, number]> => {
  const counts = new Map<string, number>()
  for (const i of flattenNavItems(items)) counts.set(i.href, (counts.get(i.href) ?? 0) + 1)
  return [...counts.entries()].filter(([, n]) => n > 1).sort(([a], [b]) => a.localeCompare(b))
}

function setPersona(user: FakeUser | null, hiddenTiers: NavAdvancedTier[]) {
  fakeAuth.user = user
  useNavVisibilityStore.setState({ hydrated: true, hiddenTiers })
}

// ── ⑥ 专用:五语言词表现读(唯一真相 = packages/i18n/messages/web/<locale>.json) ──
const WEB_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
/** 域入口页命名空间的同族键形(2026-10-19 那三域 eduHub/contentHub/tradeHub 即此形) */
const HUB_TEXT_KEYS = ['subtitle', 'title'] as const

type MessageBag = Record<string, Record<string, string>>

/** 消息目录按测试文件自身位置推导(§15 不靠 cwd;与 src/i18n/__tests__/messages.test.ts 同一定法;
 *  不用 import.meta.url —— vitest 的模块面把它带成 `/@fs/…`,readFileSync 打不开)
 *  __tests__ → sidebar → components → src → apps/web → apps → 仓库根,六级 */
const MESSAGES_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'packages',
  'i18n',
  'messages',
  'web',
)

function readWebMessages(locale: string): MessageBag {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as MessageBag
}

const WEB_MESSAGES = WEB_LOCALES.map((locale) => ({ locale, bag: readWebMessages(locale) }))

/** 渲染一枚域入口页,量出页头标题/副标题文本与该页真实产出的 href 集合 */
function renderHubHeader(Page: React.ComponentType): {
  title: string
  subtitle: string
  hrefs: string[]
} {
  const { container } = render(<Page />)
  const header = container.querySelector('header')
  const hrefs = [
    ...new Set(
      Array.from(container.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href'))
        .filter((h): h is string => h !== null),
    ),
  ].sort()
  const out = {
    title: header?.querySelector('h1')?.textContent ?? '',
    subtitle: header?.querySelector('p')?.textContent ?? '',
    hrefs,
  }
  cleanup()
  return out
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

describe('P2 收敛第二批:AI 域 / 个人域结构', () => {
  it('① 两域顶层各只剩 1 枚域入口(14→1、5→1),NAV_GROUPS 仍 9 组', () => {
    expect(aiGroup.items.map((i) => i.href)).toEqual(['/domains/ai'])
    expect(personalGroup.items.map((i) => i.href)).toEqual(['/domains/personal'])
    expect(aiGroup.items[0]?.labelKey).toBe('aiGroupLabel')
    expect(personalGroup.items[0]?.labelKey).toBe('user')
    // 侧边栏顶层项逐组读数(2026-10-23 本批实跑,非估算):
    //  两域收敛前 aiGroupLabel 14 / personalGroup 5,收敛后各 1;其余分组本批一条未动。
    expect(
      Object.fromEntries(NAV_GROUPS.map((g) => [g.label || '(home)', g.items.length])),
    ).toEqual({
      '(home)': 1,
      hotGroupLabel: 1,
      aiGroupLabel: 1,
      adminGroupLabel: 20,
      eduGroup: 1,
      contentGroup: 1,
      tradeGroup: 1,
      personalGroup: 1,
      developerGroup: 3,
    })
    expect(NAV_GROUPS).toHaveLength(9)
    expect(NAV_GROUPS.reduce((n, g) => n + g.items.length, 0)).toBe(30)
    // 条目没被删,只是不再平铺:域清单顶层条目数 == 收敛前两分组顶层条目数
    expect(AI_HUB_ITEMS).toHaveLength(15) // 2026-10-24 b23f01cf219 个人号池入口入册(+1)
    expect(PERSONAL_HUB_ITEMS).toHaveLength(5)
  })

  it('② href 多重集逐字守恒(AI 54 条 / 个人 22 条,不丢项不造新)', () => {
    expect(
      flattenNavItems(AI_HUB_ITEMS)
        .map((i) => i.href)
        .sort(),
    ).toEqual(AI_PRE_CONVERGENCE_SNAPSHOT)
    expect(
      flattenNavItems(PERSONAL_HUB_ITEMS)
        .map((i) => i.href)
        .sort(),
    ).toEqual(PERSONAL_PRE_CONVERGENCE_SNAPSHOT)
  })

  it('③ 零新增重复 href:只剩收敛前既有那两对"父项+子菜单"', () => {
    // AI 域:/knowledge-base 与 /memory 各 2 次(父项 + 其子清单首项),2026-08-30 起的既有形状
    expect(duplicateCounts(AI_HUB_ITEMS)).toEqual([
      ['/knowledge-base', 2],
      ['/memory', 2],
    ])
    // 个人域:/favorites 与 /user/profile 同型
    expect(duplicateCounts(PERSONAL_HUB_ITEMS)).toEqual([
      ['/favorites', 2],
      ['/user/profile', 2],
    ])
    // 两枚域入口自身不与任何域清单条目撞 href(入口页不得指向自己)
    const hubAll = [...AI_HUB_ITEMS, ...PERSONAL_HUB_ITEMS]
    expect(hubAll.filter((i) => i.href.startsWith('/domains/'))).toHaveLength(0)
    // 重复对的取名不得撞成同一句话(/knowledge-base 那对是记档的既有同标签例外)
    const labelsOf = (href: string, items: NavItem[]) =>
      new Set(
        flattenNavItems(items)
          .filter((i) => i.href === href)
          .map((i) => i.labelKey),
      ).size
    expect(labelsOf('/memory', AI_HUB_ITEMS)).toBe(2)
    expect(labelsOf('/favorites', PERSONAL_HUB_ITEMS)).toBe(2)
    expect(labelsOf('/user/profile', PERSONAL_HUB_ITEMS)).toBe(2)
  })

  it('④ 三层可见性判据未合并:两域无 adminOnly/permission;档位逐档照旧生效;入口不被档位锁死', () => {
    const all = [...flattenNavItems(AI_HUB_ITEMS), ...flattenNavItems(PERSONAL_HUB_ITEMS)]
    // 权限层:两域全部条目都不带 adminOnly / permission(带了就是本次误改 —— 收敛不是加门)
    expect(all.some((i) => i.permission !== undefined)).toBe(false)
    expect(all.some((i) => i.adminOnly !== undefined)).toBe(false)
    expect(aiGroup.items[0]?.adminOnly).toBeUndefined()
    expect(personalGroup.items[0]?.adminOnly).toBeUndefined()

    // 档位层与入口正交:四档全藏,两枚域入口仍在侧边栏(否则简洁模式把用户功能锁死)
    const tree = sidebarStyleFilter(
      NAV_GROUPS.flatMap((g) => g.items),
      false,
      [],
      ['developer', 'relayOps', 'advancedAi', 'experimental'],
    )
    const visibleHrefs = collectHrefs(tree)
    expect(visibleHrefs).toContain('/domains/ai')
    expect(visibleHrefs).toContain('/domains/personal')

    // 档位判据在域清单上逐档生效(与侧边栏同一把尺子,只是消费方换成域入口页)
    const relayHidden = sidebarStyleFilter(AI_HUB_ITEMS, false, [], ['relayOps'])
    expect(collectHrefs(relayHidden)).not.toContain('/models/channels')
    expect(collectHrefs(relayHidden)).toContain('/models/overview')
    const expHidden = sidebarStyleFilter(AI_HUB_ITEMS, false, [], ['experimental'])
    expect(collectHrefs(expHidden)).not.toContain('/repo-wiki')
    expect(collectHrefs(expHidden)).toContain('/knowledge-base')
    const allHidden = sidebarStyleFilter(
      AI_HUB_ITEMS,
      false,
      [],
      ['developer', 'relayOps', 'advancedAi', 'experimental'],
    )
    expect(flattenNavItems(allHidden)).toHaveLength(13)
    // 正向对照:不藏时 54 项全在(2026-10-24 个人号池入口入册)—— 否则上面的 not.toContain 会因为"项压根不在"而空过
    expect(flattenNavItems(sidebarStyleFilter(AI_HUB_ITEMS, false, [], []))).toHaveLength(54)
    // role 层对两域无差别:admin 与普通用户看到的一样多(permission 层没被拿来当降噪用)
    expect(flattenNavItems(sidebarStyleFilter(AI_HUB_ITEMS, true, ['*:*:*'], [])).length).toBe(
      flattenNavItems(sidebarStyleFilter(AI_HUB_ITEMS, false, [], [])).length,
    )
  })

  it('⑤ DomainHub 与 Sidebar 对同一清单过滤结果一致(共用 useNavVisibilityFilter)', () => {
    const personas: Array<{ name: string; user: FakeUser | null; tiers: NavAdvancedTier[] }> = [
      { name: '普通用户·全档位显示', user: { id: 'u1', roleId: 0, permissions: [] }, tiers: [] },
      {
        name: '普通用户·简洁模式(藏三档)',
        user: { id: 'u1', roleId: 0, permissions: [] },
        tiers: ['relayOps', 'advancedAi', 'experimental'],
      },
      {
        name: '教师(持 edu:manage)',
        user: { id: 'u2', roleId: 0, permissions: ['edu:manage'] },
        tiers: ['developer'],
      },
      { name: '管理员', user: { id: 'u3', roleId: 1, permissions: ['*:*:*'] }, tiers: [] },
    ]
    for (const p of personas) {
      setPersona(p.user, p.tiers)
      const isAdmin = p.user !== null && p.user.roleId >= 1
      const perms = p.user?.permissions ?? []
      for (const [label, items] of [
        ['AI 域清单', AI_HUB_ITEMS],
        ['个人域清单', PERSONAL_HUB_ITEMS],
      ] as const) {
        expect({ persona: p.name, label, hrefs: domainHubHrefs(items) }).toEqual({
          persona: p.name,
          label,
          hrefs: collectHrefs(sidebarStyleFilter(items, isAdmin, perms, p.tiers)),
        })
      }
    }
    // 正向对照:简洁模式下域入口页确实要少东西,否则档位层在域页上是摆设
    setPersona({ id: 'u1', roleId: 0, permissions: [] }, [])
    const fullAi = domainHubHrefs(AI_HUB_ITEMS)
    setPersona({ id: 'u1', roleId: 0, permissions: [] }, ['relayOps', 'advancedAi', 'experimental'])
    const simpleAi = domainHubHrefs(AI_HUB_ITEMS)
    expect(simpleAi.length).toBeLessThan(fullAi.length)
    expect(fullAi).toHaveLength(52) // 2026-10-24:account-pool 标 experimental 档,全档全开 51→52
    // 个人域在任何档位组合下都不该掉项(本域一项都没标档)
    setPersona({ id: 'u1', roleId: 0, permissions: [] }, [
      'developer',
      'relayOps',
      'advancedAi',
      'experimental',
    ])
    expect(domainHubHrefs(PERSONAL_HUB_ITEMS)).toHaveLength(20)
  })

  it('⑥ 文案独立:两域入口页各取本域命名空间的 title+subtitle,五语言齐备且不与分组头同名', () => {
    // a) 页面从**本域命名空间**取词,不再复用侧边栏那两枚键(首版取 nav.aiGroupLabel /
    //    nav.user ⇒ 入口页标题与分组头同键、且没有副标题)。取词 mock 回显「ns.key」,
    //    所以这里量的就是「这一页到底问 i18n 要了哪一枚键」。
    setPersona({ id: 'u1', roleId: 0, permissions: [] }, [])
    const ai = renderHubHeader(AiHubPage)
    const personal = renderHubHeader(PersonalHubPage)
    expect(ai.title).toBe('aiHub.title')
    expect(ai.subtitle).toBe('aiHub.subtitle')
    expect(personal.title).toBe('personalHub.title')
    expect(personal.subtitle).toBe('personalHub.subtitle')

    // b) 只改文案取键,条目一格没动:页面渲染出的 href 集合 == 同一身份下清单的过滤结果
    expect(ai.hrefs).toEqual(collectHrefs(sidebarStyleFilter(AI_HUB_ITEMS, false, [], [])))
    expect(personal.hrefs).toEqual(
      collectHrefs(sidebarStyleFilter(PERSONAL_HUB_ITEMS, false, [], [])),
    )

    // c) 五语言同批:两枚命名空间的键集与既有三域逐字同族,值非空、副标题不是标题的复读
    for (const { locale, bag } of WEB_MESSAGES) {
      for (const ns of ['aiHub', 'personalHub'] as const) {
        expect(Object.keys(bag[ns] ?? {}).sort(), `${locale}/${ns} 键集须与 eduHub 同族`).toEqual(
          [...HUB_TEXT_KEYS].sort(),
        )
        for (const key of HUB_TEXT_KEYS) {
          const value = bag[ns]?.[key]
          expect(typeof value, `${locale}/${ns}.${key} 必须是字符串`).toBe('string')
          expect((value ?? '').trim().length, `${locale}/${ns}.${key} 不得为空`).toBeGreaterThan(0)
        }
        expect(bag[ns]!.subtitle, `${locale}/${ns} 副标题不得等于标题`).not.toBe(bag[ns]!.title)
      }
      // d) 值级独立:入口页标题 ≠ 侧边栏分组头取值;两域之间也互不同名
      expect(bag.aiHub!.title, `${locale} AI 域标题不得与分组头 nav.aiGroupLabel 同名`).not.toBe(
        bag.nav!.aiGroupLabel,
      )
      expect(
        bag.personalHub!.title,
        `${locale} 个人域标题不得与分组头 nav.personalGroup 同名`,
      ).not.toBe(bag.nav!.personalGroup)
      expect(bag.aiHub!.title).not.toBe(bag.personalHub!.title)
      expect(bag.aiHub!.subtitle).not.toBe(bag.personalHub!.subtitle)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
