// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * distribution/team 薄壳形制锁(批 5)。
 *
 *  ① 共享屏真被渲染、主题根在壳外层;
 *  ② 端内零布局:只允许「团队总人数」行(1 View + 2 Text),不得出现 Image/Picker/SearchBar/LineIcon 与圆角档;
 *  ③ 4 组变体 props 真到共享屏(阴性对照:摘掉 showRankBadge 即红);团队总人数行留在页内;
 *  ④ 共享屏确有这些全可选承接分支(删分支即红);
 *  ⑤ 无新 i18n key(页面只用已有 distribution.team.* 或 fallback 参数);
 *  ⑥ RN 真消费点同样传这 4 组 props(A 方案:不再只有小程序消费);
 *  ⑦ 数据层/分页/日期选项推导保留;
 *  ⑧ useReachBottom 已换成共享屏 onEndReached。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const captured = vi.hoisted(() => ({
  team: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/team/TeamScreen', () => ({
  TeamScreen: (props: Record<string, unknown>) => {
    captured.team = props
    return createElement('div', { 'data-shell': 'team-screen' })
  },
}))

// 页内团队总人数行用 Taro 的 View/Text;node 环境不加载真实 @tarojs/components(其 hammerjs 依赖 window)
vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => createElement('div', props),
  Text: (props: Record<string, unknown>) => createElement('span', props),
}))

vi.mock('@tarojs/taro', () => {
  const Taro = { navigateBack: vi.fn(), navigateTo: vi.fn(), stopPullDownRefresh: vi.fn() }
  return { default: Taro, useDidShow: vi.fn(), ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/api', () => ({
  getDistributionTeam: vi.fn(async () => ({ list: [], total: 0 })),
}))

// 不触发数据腿:本册只判壳→共享屏的 props 契约
vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ waitUntilReady: () => () => {} }),
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import DistributionTeam from '../src/pages/distribution/team'

const PAGE_SOURCE = readFileSync(resolve('src/pages/distribution/team.tsx'), 'utf8')
const TEAM_SHARED = readFileSync(
  resolve('../../packages/app/src/features/team/TeamScreen.tsx'),
  'utf8',
)
const RN_TEAM = readFileSync(resolve('../../apps/mobile-rn/src/screens/TeamScreen.tsx'), 'utf8')
const MESSAGES = JSON.parse(
  readFileSync(resolve('../../packages/i18n/messages/miniapp-taro/zh-CN.json'), 'utf8'),
) as Record<string, unknown>

const lookup = (path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, MESSAGES)

describe('distribution/team 薄壳(直载 team/TeamScreen + 小程序独有变体)', () => {
  const html = renderToStaticMarkup(createElement(DistributionTeam))
  const props = () => captured.team as Record<string, unknown>

  it('① 共享屏真被渲染,主题根在壳外层', () => {
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/team/TeamScreen'")
    expect(html).toContain('data-shell="team-screen"')
    expect(html.indexOf('data-theme-root')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-shell="team-screen"')).toBeGreaterThan(
      html.indexOf('data-theme-root'),
    )
  })

  it('② 端内零布局:只留团队总人数行(1 View + 2 Text),不得回潮第二份实现', () => {
    expect(PAGE_SOURCE.match(/<View\b/g) ?? []).toHaveLength(1)
    expect(PAGE_SOURCE.match(/<Text\b/g) ?? []).toHaveLength(2)
    expect(PAGE_SOURCE).not.toMatch(/<Image\b|<Picker\b|<SearchBar\b|<LineIcon\b/)
    expect(PAGE_SOURCE).not.toMatch(/rounded-/)
  })

  it('③ 4 组变体 props 真到共享屏(摘掉任一即红),团队总人数行留在页内', () => {
    expect(props().stats).toBeUndefined()
    expect(props().members).toEqual([])
    expect(props().activeTab).toBe('all')
    expect(props().showHeader).toBe(false)
    expect(props().showTabs).toBe(false)
    expect(props().colorScheme).toBe('light')
    expect(props().error).toBe('')
    expect(props().totalCountRow).toBeUndefined()
    // 团队总人数行回退页内:View + Text 承载,文案来自 tt(已有 key)
    expect(PAGE_SOURCE).toMatch(
      /<View[^>]*>\s*<Text[\s\S]*?tt\('distribution\.team\.totalMembers', '团队总人数'\)[\s\S]*?teamTotal/,
    )
    expect(props().sortBar).toMatchObject({
      orderLabel: '成交订单数',
      dateLabel: '邀请时间',
      active: 'orderNum',
      dateValue: '',
    })
    expect(typeof (props().sortBar as Record<string, unknown>).onSelectOrder).toBe('function')
    expect(props().dateOptions).toEqual([])
    expect(typeof props().onSelectDate).toBe('function')
    expect(props().memberMetrics).toMatchObject({
      transactionVolume: '成交额',
      commission: '获取佣金',
      orderNum: '成交订单数',
      joinTime: '邀请时间',
      viewSubordinates: '查看下级',
    })
    expect(props().showRankBadge).toBe(true)
    expect(typeof props().onEndReached).toBe('function')
    expect(typeof props().onPressMember).toBe('function')

    // 源码字面锁:这些 prop 是壳与共享屏的契约,不得被悄悄摘掉
    expect(PAGE_SOURCE).toContain('stats={undefined}')
    expect(PAGE_SOURCE).not.toContain('totalCountRow')
    expect(PAGE_SOURCE).toContain('sortBar={{')
    expect(PAGE_SOURCE).toContain('dateOptions={dateOptions}')
    expect(PAGE_SOURCE).toContain('memberMetrics={{')
    expect(PAGE_SOURCE).toContain('showRankBadge')
    expect(PAGE_SOURCE).toContain('activeTab="all"')
    expect(PAGE_SOURCE).toContain('showHeader={false}')
    expect(PAGE_SOURCE).toContain('showTabs={false}')
    expect(PAGE_SOURCE).toContain('onPressMember={')
  })

  it('④ 共享屏确有全可选承接分支(删分支即红)', () => {
    expect(TEAM_SHARED).not.toContain('totalCountRow')
    expect(TEAM_SHARED).toContain('{sortBar ? (')
    // sortBar 是叠加而非替代:tabs 分支仍在,且排在 sortBar 之前
    expect(TEAM_SHARED).toContain('{showTabs ? (')
    expect(TEAM_SHARED.indexOf('{showTabs ? (')).toBeLessThan(TEAM_SHARED.indexOf('{sortBar ? ('))
    expect(TEAM_SHARED).toContain('sortBar.dateValue || sortBar.dateLabel')
    expect(TEAM_SHARED).toContain('<Modal')
    expect(TEAM_SHARED).toContain('dateOptions ?? []')
    expect(TEAM_SHARED).toContain("onSelectDate?.('')")
    expect(TEAM_SHARED).toContain('{memberMetrics ? (')
    expect(TEAM_SHARED).toContain('String(item.transactionVolume ?? 0)')
    expect(TEAM_SHARED).toContain('String(item.orderNum ?? 0)')
    expect(TEAM_SHARED).toContain("item.createdAtLabel ?? ''")
    expect(TEAM_SHARED).toContain('{showRankBadge ? (')
    expect(TEAM_SHARED).toContain('rnCssLight.rankGold')
    expect(TEAM_SHARED).toContain('rnCssLight.rankSilver')
    expect(TEAM_SHARED).toContain('rnCssLight.rankBronze')
    expect(TEAM_SHARED).toContain('No.${rank}')
    expect(TEAM_SHARED).toContain('viewSubordinates')
  })

  it('⑤ 无新 i18n key:页面只用已有 distribution.team.* 或 fallback 参数', () => {
    const keys = Array.from(PAGE_SOURCE.matchAll(/\btt\('([^']+)'/g)).map((m) => m[1]!)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.every((key) => key.startsWith('distribution.team.'))).toBe(true)
    for (const key of keys) {
      expect(lookup(key), `缺少 i18n key: ${key}`).toBeTypeOf('string')
    }
    // 日期弹层标题/清除文案是共享屏可选 props,页面不新造 key 也不传
    expect(PAGE_SOURCE).not.toContain('dateSheetTitle')
    expect(PAGE_SOURCE).not.toContain('clearDateLabel')
  })

  it('⑥ RN 真消费点同样传这 4 组 props(A 方案:不再只有小程序消费)', () => {
    expect(RN_TEAM).toContain('TeamScreen')
    for (const prop of [
      'sortBar',
      'dateOptions',
      'onSelectDate',
      'memberMetrics',
      'showRankBadge',
    ]) {
      expect(RN_TEAM).toContain(prop)
    }
    expect(RN_TEAM).not.toContain('totalCountRow')
    expect(RN_TEAM).toContain('transactionVolume: m.transactionVolume')
    expect(RN_TEAM).toContain('orderNum: m.orderNum')
    expect(RN_TEAM).toContain('createdAtLabel: formatDateOnly(m.joinDate)')
    expect(TEAM_SHARED).toContain('showRankBadge = false')
  })

  it('⑦ 数据层/分页/日期选项推导保留', () => {
    expect(PAGE_SOURCE).toContain('getDistributionTeam')
    expect(PAGE_SOURCE).toContain('const toMs')
    expect(PAGE_SOURCE).toContain('useAuthReadyGate')
    expect(PAGE_SOURCE).toContain('useDidShow')
    expect(PAGE_SOURCE).toContain('pageRef')
    expect(PAGE_SOURCE).toContain('hasMoreRef')
    expect(PAGE_SOURCE).toContain('m.createdAtLabel')
    expect(PAGE_SOURCE).toContain('.sort()')
    expect(PAGE_SOURCE).toContain('formatDateByTemplate')
  })

  it('⑧ 触底翻页已换成共享屏 onEndReached,不再自己挂 useReachBottom', () => {
    expect(PAGE_SOURCE).not.toContain('useReachBottom')
    expect(PAGE_SOURCE).toContain('onEndReached={() => void load()}')
    expect(PAGE_SOURCE).toContain('loadingMore=')
    expect(PAGE_SOURCE).toContain('hasMore=')
  })
})
