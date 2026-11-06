// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A 方案回归锁:RN TeamScreen 必须**真消费**共享屏 team/TeamScreen 的 4 组 props。
 *
 * 背景:批 5 曾把 sortBar/dateOptions/onSelectDate/memberMetrics/showRankBadge 只给小程序传,
 * 等于把小程序代码搬进共享包。本套件钉死「RN 也传真值」:
 *  ① 成员映射带 transactionVolume / orderNum / createdAtLabel(RN 接口本来就返回这些字段);
 *  ② sortBar.active 真值 + dateOptions 由成员 createdAtLabel 去重升序;
 *  ③ showRankBadge 真为 true;
 *  ④ memberMetrics 五个 label 取 mobile-rn 词包真文案。
 * 阴性对照:摘掉 RN 的 showRankBadge ⇒ 本套件必红(现场验证,命令与结果见提交说明)。
 *
 * mock 说明:RN 源文件按 barrel `@ihui/rn-app` 取共享屏,故内联工厂直接替换 barrel
 * (`@ihui/rn-app/features/team/TeamScreen` 深路径不会被源文件解析,替身拦不到)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { render, waitFor, act } from '@testing-library/react'
import type * as I18nModule from '../src/i18n'

const captured = vi.hoisted(() => ({
  team: null as Record<string, unknown> | null,
}))

const apiMocks = vi.hoisted(() => ({
  getTeamStats: vi.fn(),
  getTeamMembers: vi.fn(),
  getDistributionTree: vi.fn(),
}))

const navMocks = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))

/** 稳定引用:真实 useI18n/useAuth 的返回值跨渲染稳定,替身若每次新建会触发 effect 死循环 */
const stableMocks = vi.hoisted(() => ({
  user: { id: 'u1', nickname: '测试用户' },
}))

vi.mock('@ihui/rn-app', () => ({
  TeamScreen: (props: Record<string, unknown>) => {
    captured.team = props
    return createElement('div', { 'data-testid': 'shared-team-screen' })
  },
}))

vi.mock('@ihui/api-client', () => ({
  getTeamStats: apiMocks.getTeamStats,
  getTeamMembers: apiMocks.getTeamMembers,
  getDistributionTree: apiMocks.getDistributionTree,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: navMocks.navigate, goBack: navMocks.goBack }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: stableMocks.user }),
}))

// 只替 useI18n 出口;messages / getValueByPath 保留,断言的 label 才有真词包可对照
vi.mock('../src/i18n', async (importOriginal) => {
  const mod = await importOriginal<typeof I18nModule>()
  const t = (key: string) => (mod.getValueByPath(mod.messages['zh-CN'], key) as string) ?? key
  return {
    ...mod,
    useI18n: () => ({ locale: 'zh-CN', t }),
  }
})

import { TeamScreen } from '../src/screens/TeamScreen'
import { messages, getValueByPath } from '../src/i18n'

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (k: string) => getValueByPath(zh, k) as string

const rawMembers = [
  {
    id: 'm1',
    nickname: '甲',
    avatar: null,
    level: 1,
    joinDate: '2026-03-02',
    contribution: 10,
    status: 'active' as const,
    relation: 'direct' as const,
    transactionVolume: 1200,
    commission: 10,
    orderNum: 3,
    phone: null,
  },
  {
    id: 'm2',
    nickname: '乙',
    avatar: null,
    level: 2,
    joinDate: '2026-05-09',
    contribution: 20,
    status: 'active' as const,
    relation: 'direct' as const,
    transactionVolume: 800,
    commission: 20,
    orderNum: 7,
    phone: null,
  },
]

const renderScreen = () => render(createElement(TeamScreen))
const props = () => captured.team as Record<string, unknown>

describe('RN TeamScreen 真消费共享屏 team/TeamScreen props(A 方案)', () => {
  beforeEach(() => {
    captured.team = null
    apiMocks.getTeamStats.mockResolvedValue({
      success: true,
      data: {
        totalMembers: 2,
        monthNew: 1,
        activeMembers: 2,
        directCount: 2,
        indirectCount: 0,
        totalContribution: 30,
      },
    })
    apiMocks.getTeamMembers.mockResolvedValue({
      success: true,
      data: { list: rawMembers, total: 2 },
    })
    apiMocks.getDistributionTree.mockResolvedValue({
      success: true,
      data: { tree: [], totalLevels: 0 },
    })
  })

  it('成员映射带 transactionVolume / orderNum / createdAtLabel', async () => {
    renderScreen()
    await waitFor(() => expect(captured.team).not.toBeNull())
    const members = props().members as Array<Record<string, unknown>>
    expect(members.length).toBe(2)
    const mapped = members.find((m) => m.id === 'm1')
    expect(mapped).toMatchObject({ transactionVolume: 1200, orderNum: 3 })
    expect(typeof mapped?.createdAtLabel).toBe('string')
    expect((mapped?.createdAtLabel as string).length).toBeGreaterThan(0)
    // 排序生效:orderNum 降序 ⇒ 乙(7)在甲(3)之前
    expect((members[0] as Record<string, unknown>).id).toBe('m2')
  })

  it('sortBar.active 真值 + dateOptions 非空(成员日期去重升序)', async () => {
    renderScreen()
    await waitFor(() => expect(captured.team).not.toBeNull())
    expect(props().sortBar).toMatchObject({ active: 'orderNum', dateValue: '' })
    const options = props().dateOptions as string[]
    expect(options.length).toBeGreaterThan(0)
    expect([...options].sort()).toEqual(options)
    expect(typeof (props().sortBar as Record<string, unknown>).onSelectOrder).toBe('function')
    expect(typeof props().onSelectDate).toBe('function')
  })

  it('showRankBadge 真为 true', async () => {
    renderScreen()
    await waitFor(() => expect(captured.team).not.toBeNull())
    expect(props().showRankBadge).toBe(true)
  })

  it('memberMetrics 五个 label 取词包真文案', async () => {
    renderScreen()
    await waitFor(() => expect(captured.team).not.toBeNull())
    expect(props().memberMetrics).toEqual({
      transactionVolume: val('teamDetail.transactionVolume'),
      commission: val('teamDetail.commission'),
      orderNum: val('teamDetail.orderNum'),
      joinTime: val('team.joinDate'),
      viewSubordinates: val('distributionCompany.subordinates'),
    })
  })

  /**
   * 分页接线锁(阳):onEndReached 必须是真函数,触底后真请求 page 2 并追加;
   * hasMore 由 total 决定。阴性对照:摘掉 onEndReached/loadingMore/hasMore 任一接线,
   * 首条 typeof 断言或 page 2 调用断言即红。
   */
  it('onEndReached 真接线:触发后 page+1 并追加成员,hasMore 依 total', async () => {
    apiMocks.getTeamMembers.mockImplementation(async ({ page }: { page: number }) =>
      page === 1
        ? { success: true, data: { list: [rawMembers[0]], total: 21 } }
        : { success: true, data: { list: [rawMembers[1]], total: 21 } },
    )
    renderScreen()
    await waitFor(() => expect(captured.team).not.toBeNull())
    await waitFor(() => expect((props().members as unknown[]).length).toBe(1))
    expect(typeof props().onEndReached).toBe('function')
    expect(props().loadingMore).toBe(false)
    expect(props().hasMore).toBe(true)

    await act(async () => {
      ;(props().onEndReached as () => void)()
    })
    await waitFor(() =>
      expect(apiMocks.getTeamMembers).toHaveBeenCalledWith({ page: 2, pageSize: 20 }),
    )
    await waitFor(() => expect((props().members as unknown[]).length).toBe(2))
    // 追加后仍按 orderNum 降序:乙(7)在前,甲(3)在后
    expect((props().members as Array<Record<string, unknown>>).map((m) => m.id)).toEqual([
      'm2',
      'm1',
    ])
    // 2 × PAGE_SIZE(20)= 40 不小于 total 21 ⇒ 没有更多
    expect(props().hasMore).toBe(false)
  })

  /** onRetry 真接线:首次失败后重试重新拉取 page 1 并清错 */
  it('onRetry 真接线:失败后重试重新拉取并清错', async () => {
    apiMocks.getTeamStats.mockResolvedValueOnce({ success: false })
    renderScreen()
    await waitFor(() => expect(props().error).toBe(val('team.loadFailed')))
    expect(typeof props().onRetry).toBe('function')
    const callsBefore = apiMocks.getTeamMembers.mock.calls.length

    await act(async () => {
      ;(props().onRetry as () => void)()
    })
    await waitFor(() => expect(props().error).toBe(''))
    await waitFor(() => expect(apiMocks.getTeamMembers.mock.calls.length).toBe(callsBefore + 1))
  })

  /** loadingMore 防重入:同一帧连续两次触底,page 2 只发一次 */
  it('loadingMore 期间重复触底不重复请求 page 2', async () => {
    let resolvePage2: (value: unknown) => void = () => {}
    const pendingPage2 = new Promise((resolve) => {
      resolvePage2 = resolve
    })
    apiMocks.getTeamMembers.mockImplementation(({ page }: { page: number }) =>
      page === 1
        ? Promise.resolve({ success: true, data: { list: [rawMembers[0]], total: 40 } })
        : pendingPage2,
    )
    renderScreen()
    await waitFor(() => expect(captured.team).not.toBeNull())
    await waitFor(() => expect((props().members as unknown[]).length).toBe(1))

    await act(async () => {
      const more = props().onEndReached as () => void
      more()
      more()
    })
    const page2Calls = apiMocks.getTeamMembers.mock.calls.filter(
      (call) => (call[0] as { page?: number } | undefined)?.page === 2,
    )
    expect(page2Calls).toHaveLength(1)

    await act(async () => {
      resolvePage2({ success: true, data: { list: [rawMembers[1]], total: 40 } })
      await pendingPage2
    })
    await waitFor(() => expect((props().members as unknown[]).length).toBe(2))
  })
})
