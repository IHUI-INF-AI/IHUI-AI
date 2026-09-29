// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D159(2026-09-30 立):规则面板的「网络目标」分节 + 单条撤销。
 *
 * 票第 3 条不可漂:**与 D158 已有的 exec_prefix 规则共面板共 API**。所以这里的判据
 * 全部围绕"同一张组件、同一组请求"三件事:
 *  ① 网络行与命令行**同一次** listApprovalGrants 拿回(不得为网络目标再发一个请求);
 *  ② 撤销网络行走 revokeApprovalGrant(cacheKey, 'network') —— kind 必须原样带过去,
 *     缺省成 exec_prefix 就是拿错把手去删别的规则;
 *  ③ 网络行的确认文案走 revokeConfirmContentNetwork(target),不得套用"前缀「…」"
 *     —— 让用户以为撤销的是命令规则,就是把两个动作混进一句话(同"两套撤销语义
 *     不得共用一个标签",AGENTS §30 一型)。
 *
 * 断言风格沿用本目录既有约定:项目未引入 @testing-library/jest-dom,只用原生
 * toBeTruthy()/toBeNull()(见 tool-call-card.test.tsx 头注)。
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, act, waitFor } from '@testing-library/react'

const listCalls: number[] = []
const revokeCalls: Array<[string, string | undefined]> = []

let rows: Array<Record<string, unknown>> = []
vi.mock('@ihui/api-client', () => ({
  listApprovalGrants: vi.fn(async () => {
    listCalls.push(1)
    return rows
  }),
  revokeApprovalGrant: vi.fn(async (cacheKey: string, kind?: string) => {
    revokeCalls.push([cacheKey, kind])
    // 撤销成功后服务端即删;面板随后 refresh 看到空表(库里真没了的界面侧对应物)
    rows = rows.filter((g) => g.cacheKey !== cacheKey)
  }),
}))

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const pack: Record<string, string> = {
        title: '已保存的放行规则',
        description: '这里列出审批时生成的持久放行规则,撤销后下一轮会重新询问。',
        refresh: '刷新',
        loadFailed: '加载失败',
        empty: '暂无放行规则',
        revoke: '撤销',
        revokeConfirmTitle: '撤销这条放行规则?',
        revokeConfirmContent: '前缀「{prefix}」的放行规则将被删除。',
        revokeConfirmContentNetwork: '网络目标「{target}」的放行规则将被删除,之后会重新询问。',
        sectionCommands: '命令前缀',
        sectionNetwork: '网络目标',
        createdAtHeader: '创建于',
        expiresAtHeader: '过期于',
        neverExpires: '永不过期',
      }
      let out = pack[key] ?? key
      if (values) {
        for (const [k, v] of Object.entries(values)) out = out.replace(`{${k}}`, String(v))
      }
      return out
    },
}))

const confirmMock = vi.fn(async (_opts: Record<string, unknown>) => true)
vi.mock('@/components/feedback', () => ({
  // 参数必须转记:面板按 kind 选哪句确认文案,是本文件的判据之一 —— 吞掉参数等于
  // 把"问错了话"这一型缺陷从断言面上抹掉(守门 22c"镜像只复读实现"同型反例)。
  confirmDialog: (opts: Record<string, unknown>) => confirmMock(opts),
}))

import { ApprovedRulesPanel } from '../approved-rules-panel'

const NET_KEY = '11111111-1111-4111-8111-111111111111\x1enet\x1fapi.example.com\x1f8443\x1fhttps'
const CMD_KEY = '11111111-1111-4111-8111-111111111111\x1egit\x1fpush'

beforeEach(() => {
  listCalls.length = 0
  revokeCalls.length = 0
  confirmMock.mockClear()
  rows = [
    {
      cacheKey: NET_KEY,
      prefix: 'api.example.com:8443',
      tokenCount: 3,
      kind: 'network',
      scopes: ['always'],
      createdAt: '2026-09-30T01:00:00+00:00',
      expiresAt: '2026-12-29T01:00:00+00:00',
    },
    {
      cacheKey: CMD_KEY,
      prefix: 'git push',
      tokenCount: 2,
      kind: 'exec_prefix',
      scopes: ['always'],
      createdAt: '2026-09-28T01:00:00+00:00',
      expiresAt: null,
    },
  ]
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('D159 面板:网络目标分节 + 单条撤销(共面板共 API)', () => {
  it('一次列表请求同时拿到两种 kind,并按 kind 分节', async () => {
    render(<ApprovedRulesPanel />)
    await waitFor(() => expect(screen.getByTestId('approved-rules-groups')).toBeTruthy())
    // ① 共 API:两种 kind 来自**同一次** listApprovalGrants,没有第二个请求
    expect(listCalls).toHaveLength(1)
    const netSection = screen.getByTestId('approved-rules-section-network')
    const cmdSection = screen.getByTestId('approved-rules-section-commands')
    expect(netSection.textContent).toContain('api.example.com:8443')
    expect(netSection.textContent).toContain('网络目标')
    expect(cmdSection.textContent).toContain('git push')
    // 行落在各自节里:网络行**不得**混进命令节(混节 = 新规则穿旧标签)
    expect(netSection.textContent).not.toContain('git push')
    expect(cmdSection.textContent).not.toContain('api.example.com:8443')
    // 票面"弹窗/面板把键原样显示成 host:port,不显示哈希":屏上只见可读形态
    expect(document.body.textContent).not.toContain('\x1e')
    expect(document.body.textContent).not.toContain('\x1f')
  })

  it('撤销网络行走同一把手,revoke 带 kind=network,撤完该行从界面消失', async () => {
    render(<ApprovedRulesPanel />)
    await waitFor(() => expect(screen.getByTestId('approved-rules-section-network')).toBeTruthy())
    const btn = screen.getByTestId(`approved-rules-revoke-${NET_KEY}`)
    await act(async () => {
      fireEvent.click(btn)
    })
    // ② kind 原样透传:缺省成 exec_prefix 就是拿错把手删错规则
    expect(revokeCalls).toEqual([[NET_KEY, 'network']])
    // ③ 确认文案用网络那一键,不套"前缀「…」"
    expect(confirmMock).toHaveBeenCalledTimes(1)
    const firstCallArg = confirmMock.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined
    expect(String(firstCallArg?.content ?? '')).toContain('网络目标「api.example.com:8443」')
    // 撤销后库/内存真没了的界面侧对应物:refresh 回来的列表不再含该行
    await waitFor(() =>
      expect(screen.queryByTestId(`approved-rules-revoke-${NET_KEY}`)).toBeNull(),
    )
    expect(screen.getByTestId(`approved-rules-revoke-${CMD_KEY}`)).toBeTruthy()
  })

  it('未登记的 kind 单独成节(并进旧节 = 让新规则穿旧标签)', async () => {
    rows = [
      {
        cacheKey: 'k-weird',
        prefix: 'whatever',
        tokenCount: 1,
        kind: 'something_future',
        scopes: ['session'],
        createdAt: null,
        expiresAt: null,
      },
      ...rows,
    ]
    render(<ApprovedRulesPanel />)
    await waitFor(() => expect(screen.getByTestId('approved-rules-section-something_future')).toBeTruthy())
    const net = screen.getByTestId('approved-rules-section-network')
    expect(net.textContent).not.toContain('whatever')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
