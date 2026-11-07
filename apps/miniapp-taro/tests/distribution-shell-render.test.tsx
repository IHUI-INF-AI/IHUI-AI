// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * distribution 薄壳形制锁(批 4:member-detail + rank)。
 *
 * 判的是「端内壳有没有把共享屏接上并用显式 props 注入变体」,不是壳内部实现:
 *  ① 共享屏真被渲染、主题根在壳外层;
 *  ② 端内零布局(不得回潮 View/Text/Image 与圆角档);
 *  ③ 变体 props 真到共享屏(阴性对照:摘掉任一 prop 即红);
 *  ④ 共享屏确有承接分支(删分支即红);
 *  ⑤ RN 侧真消费点存在。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const captured = vi.hoisted(() => ({
  team: null as Record<string, unknown> | null,
  rank: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/team/TeamScreen', () => ({
  TeamScreen: (props: Record<string, unknown>) => {
    captured.team = props
    return createElement('div', { 'data-shell': 'team-screen' })
  },
}))

vi.mock('@ihui/rn-app/features/ranking/RankingScreen', () => ({
  RankingScreen: (props: Record<string, unknown>) => {
    captured.rank = props
    return createElement('div', { 'data-shell': 'ranking-screen' })
  },
}))

vi.mock('@tarojs/taro', () => {
  const Taro = { navigateBack: vi.fn(), stopPullDownRefresh: vi.fn() }
  return { default: Taro, useDidShow: vi.fn(), usePullDownRefresh: vi.fn(), ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/api', () => ({
  getDistributionInfo: vi.fn(async () => ({ teamCount: 3, monthNew: 2, totalCommission: 12.5 })),
  getDistributionTeam: vi.fn(async () => ({ list: [], total: 0 })),
  getDistributionRank: vi.fn(async () => ({ list: [] })),
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

import MemberDetail from '../src/pages/distribution/member-detail/index'
import DistributionRank from '../src/pages/distribution/rank'

const MEMBER_SOURCE = readFileSync(
  resolve('src/pages/distribution/member-detail/index.tsx'),
  'utf8',
)
const RANK_SOURCE = readFileSync(resolve('src/pages/distribution/rank.tsx'), 'utf8')
const TEAM_SHARED = readFileSync(
  resolve('../../packages/app/src/features/team/TeamScreen.tsx'),
  'utf8',
)
const RANK_SHARED = readFileSync(
  resolve('../../packages/app/src/features/ranking/RankingScreen.tsx'),
  'utf8',
)
const RN_TEAM = readFileSync(resolve('../../apps/mobile-rn/src/screens/TeamScreen.tsx'), 'utf8')
const RN_RANK = readFileSync(resolve('../../apps/mobile-rn/src/screens/RankingScreen.tsx'), 'utf8')

describe('member-detail 薄壳(直载 team/TeamScreen 的 compact 变体)', () => {
  const html = renderToStaticMarkup(createElement(MemberDetail))
  const props = () => captured.team as Record<string, unknown>

  it('① 共享屏真被渲染,主题根在壳外层', () => {
    expect(MEMBER_SOURCE).toContain("from '@ihui/rn-app/features/team/TeamScreen'")
    expect(html).toContain('data-shell="team-screen"')
    expect(html.indexOf('data-theme-root')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-shell="team-screen"')).toBeGreaterThan(
      html.indexOf('data-theme-root'),
    )
  })

  it('② 端内零布局,不得回潮第二份实现', () => {
    expect(MEMBER_SOURCE).not.toMatch(/<View\b|<Text\b|<Image\b/)
    expect(MEMBER_SOURCE).not.toMatch(/rounded-/)
  })

  it('③ 显式 props 真到共享屏(摘掉任一即红)', () => {
    expect(props().statsLayout).toBe('compact')
    expect(props().showHeader).toBe(false)
    expect(props().showTabs).toBe(false)
    expect(props().listTitle).toBe('成员列表')
    expect(props().compactStatsLabels).toMatchObject({ monthNew: '本月新增' })
    expect(typeof props().onEndReached).toBe('function')
    expect(MEMBER_SOURCE).toContain('statsLayout="compact"')
    expect(MEMBER_SOURCE).toContain('showHeader={false}')
    expect(MEMBER_SOURCE).toContain('showTabs={false}')
    expect(MEMBER_SOURCE).toContain('listTitle={')
    expect(MEMBER_SOURCE).toContain('onEndReached={')
  })

  it('④ 共享屏确有 compact/分页尾承接分支(删分支即红)', () => {
    expect(TEAM_SHARED).toContain("statsLayout === 'compact'")
    expect(TEAM_SHARED).toContain('compactStatsLabels?.monthNew')
    expect(TEAM_SHARED).toContain('ListFooterComponent=')
    expect(TEAM_SHARED).toContain('footerNoMoreText')
    expect(TEAM_SHARED).toContain('onEndReached={onEndReached}')
  })

  it('⑤ RN 真消费点', () => {
    expect(RN_TEAM).toContain('monthNew: raw.monthNew')
    expect(RN_TEAM).toContain('statsLayout="full"')
  })
})

describe('rank 薄壳(直载 ranking/RankingScreen 的佣金变体)', () => {
  const html = renderToStaticMarkup(createElement(DistributionRank))
  const props = () => captured.rank as Record<string, unknown>

  it('① 共享屏真被渲染,主题根在壳外层', () => {
    expect(RANK_SOURCE).toContain("from '@ihui/rn-app/features/ranking/RankingScreen'")
    expect(html).toContain('data-shell="ranking-screen"')
    expect(html.indexOf('data-theme-root')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-shell="ranking-screen"')).toBeGreaterThan(
      html.indexOf('data-theme-root'),
    )
  })

  it('② 端内零布局,不得回潮第二份实现', () => {
    expect(RANK_SOURCE).not.toMatch(/<View\b|<Text\b|<Image\b/)
    expect(RANK_SOURCE).not.toMatch(/rounded-/)
    expect(RANK_SOURCE).not.toContain('PODIUM')
  })

  it('③ 显式 props 真到共享屏(摘掉任一即红)', () => {
    const fmt = props().amountFormatter as (v: number) => string
    expect(typeof fmt).toBe('function')
    expect(fmt(12)).toBe('¥12')
    expect(props().showRanges).toBe(false)
    expect(props().showStudyHours).toBe(false)
    expect(props().title).toBe('推广排行')
    expect(RANK_SOURCE).toContain('amountFormatter={AMOUNT}')
    expect(RANK_SOURCE).toContain('showRanges={false}')
    expect(RANK_SOURCE).toContain('showStudyHours={false}')
    expect(RANK_SOURCE).toContain('title={')
  })

  it('④ 共享屏确有金额/标题/开关承接分支(删分支即红)', () => {
    expect(RANK_SHARED).toContain('amountFormatter ??')
    expect(RANK_SHARED).toContain('{showRanges ? (')
    expect(RANK_SHARED).toContain('showStudyHours ?')
    expect(RANK_SHARED).toContain("title ?? t('ranking.title')")
  })

  it('⑤ RN 真消费点', () => {
    expect(RN_RANK).toContain('amountFormatter={formatRankingValue}')
    expect(RN_RANK).toContain("title={t('ranking.title')}")
  })
})
