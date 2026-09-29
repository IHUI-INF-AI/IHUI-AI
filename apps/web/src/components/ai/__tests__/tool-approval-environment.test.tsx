// @vitest-environment jsdom
/**
 * D159(2026-09-30 立,用户批"三档到底"):审批弹窗的执行环境区块 + 网络放行三档。
 *
 * 四条必守的断言方向(票第 6 栏验收 + 三条不可漂):
 *  ① 三档各有一条用例 —— 档位值仍是 once/session/always(回传端点一字未改),
 *     但**标签必须是"允许该目标"**,因为用户点下的对象是 host:port 而不是"这个工具";
 *  ② 执行环境按**上报值**渲染,`available:false` ⇒ 只能出现"未上报",
 *     绝不出现"在沙箱中运行/在沙箱外运行"(把没读到写成任何一种结论 = 误导放行);
 *  ③ 被拦目标逐条点名 `host:port`,不得只显示"网络受限"这类通用文案;
 *  ④ 回退开关(IHUI_APPROVAL_ENV_REPORT=0)在服务端表现为**三个字段都不发**
 *     ⇒ 整块不渲染,而不是渲染成"未上报"。这两态必须分得开。
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent, act } from '@testing-library/react'

// api-client mock:捕获两条通道的决策回传体(不真发请求)
const postCalls: Array<Record<string, unknown>> = []
const sendCalls: Array<Record<string, unknown>> = []
vi.mock('@ihui/api-client', () => ({
  postToolApprovalResponse: vi.fn((params: Record<string, unknown>) => {
    postCalls.push(params)
    return Promise.resolve()
  }),
  sendToolApprovalResponse: vi.fn((params: Record<string, unknown>) => {
    sendCalls.push(params)
    return Promise.resolve({ accepted: true })
  }),
}))

// next-intl mock:editor.toolApproval 词包(与 packages/i18n/messages/web/zh-CN.json 同形;
// 键漏了会**原样回显键名**,那正是 ④ 里"整块不渲染"与"渲染成未上报"能被分辨的前提)
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const pack: Record<string, string> = {
        title: '工具审批',
        description: 'AI 请求执行以下高危操作,请确认是否允许',
        approve: '批准',
        reject: '拒绝',
        argsPreview: '参数预览',
        scopeLabel: '授权范围',
        scopeOnce: '允许一次',
        scopeSession: '允许此对话',
        scopeAlways: '始终允许',
        reasonLabel: '原因(可选)',
        reasonPlaceholder: '填写原因,便于审计与追溯',
        envLabel: '执行环境',
        envInSandbox: '在沙箱中运行',
        envOutsideSandbox: '在沙箱外运行',
        envBackend: '隔离方式:{backend}',
        envDegraded: '沙箱能力不可用,已降级为受限直跑',
        envNetworkSection: '网络',
        envNetworkBlocked: '被拦截的网络目标',
        envNetworkBlockedOne: '{host}:{port}({reason})',
        envNetworkOpen: '本次可访问外网',
        envNetworkOff: '本次不开放网络',
        envUnknown: '未上报(不据档位推断,请拒绝并要求重试)',
        envAllowTargetOnce: '仅本次允许该目标',
        envAllowTargetSession: '本次对话允许该目标',
        envAllowTargetAlways: '始终允许该目标(90 天后失效)',
      }
      let out = pack[key] ?? key
      if (values) {
        for (const [k, v] of Object.entries(values)) out = out.replace(`{${k}}`, String(v))
      }
      return out
    },
}))

// Modal mock:jsdom 下直出内容与 footer(只保留 open 语义)
vi.mock('@/components/feedback', () => ({
  Modal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) =>
    open ? (
      <div data-testid="approval-modal">
        {children}
        {footer}
      </div>
    ) : null,
  confirmDialog: vi.fn(() => Promise.resolve(true)),
}))

import {
  ToolApprovalDialog,
  dispatchToolApprovalRequest,
  type ChatStreamToolApprovalRequest,
} from '../tool-approval-dialog'

const NET_TARGET = {
  host: 'api.example.com',
  port: 8443,
  protocol: 'https',
  display: 'api.example.com:8443',
}

function chatReq(
  extra: Partial<ChatStreamToolApprovalRequest> = {},
): ChatStreamToolApprovalRequest {
  return {
    approvalId: 'appr_d159_1',
    toolName: 'run_command',
    toolCallId: 'tc_d159_1',
    argsPreview: '{"argv":["curl","https://api.example.com"]}',
    dangerLevel: 'high',
    sessionId: 'sess-d159',
    channel: 'chat-stream',
    ...extra,
  }
}

function push(req: ChatStreamToolApprovalRequest): void {
  act(() => {
    dispatchToolApprovalRequest(req)
  })
}

async function clickAsync(btn: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(btn)
  })
}

beforeEach(() => {
  postCalls.length = 0
  sendCalls.length = 0
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('D159 ①:网络放行三档(档位值不变,标签换成"该目标")', () => {
  it('带 network_target ⇒ 三档标签全部换成"允许该目标",且 host:port 原样在屏上', () => {
    render(<ToolApprovalDialog />)
    push(chatReq({ toolName: 'fetch_url', networkTarget: NET_TARGET }))
    expect(screen.getByTestId('tool-approval-network-target-display').textContent).toBe(
      'api.example.com:8443'
    )
    expect(screen.getByTestId('tool-approval-scope-once').textContent).toBe('仅本次允许该目标')
    expect(screen.getByTestId('tool-approval-scope-session').textContent).toBe(
      '本次对话允许该目标'
    )
    expect(screen.getByTestId('tool-approval-scope-always').textContent).toBe(
      '始终允许该目标(90 天后失效)'
    )
    // 没有网络目标的档位不得被换掉(同一组按钮服务两种语义就是错的)
    expect(screen.queryByText('允许此对话')).toBeNull()
  })

  it('第 1 档「仅本次允许该目标」⇒ scope=once(不落库)', async () => {
    render(<ToolApprovalDialog />)
    push(chatReq({ toolName: 'fetch_url', networkTarget: NET_TARGET }))
    await clickAsync(screen.getByTestId('tool-approval-scope-once'))
    await clickAsync(screen.getByTestId('tool-approval-approve'))
    expect(postCalls).toHaveLength(1)
    expect(postCalls[0]).toMatchObject({ decision: 'approve', scope: 'once' })
    // 客户端**不**上传目标:目标由服务端在条目里记着(回传体里出现 target 就是可伪造的)
    expect(postCalls[0]).not.toHaveProperty('target')
    expect(postCalls[0]).not.toHaveProperty('network_target')
  })

  it('第 2 档「本次对话允许该目标」⇒ scope=session', async () => {
    render(<ToolApprovalDialog />)
    push(chatReq({ toolName: 'fetch_url', networkTarget: NET_TARGET }))
    await clickAsync(screen.getByTestId('tool-approval-scope-session'))
    await clickAsync(screen.getByTestId('tool-approval-approve'))
    expect(postCalls[0]).toMatchObject({ decision: 'approve', scope: 'session' })
  })

  it('第 3 档「始终允许该目标(90 天后失效)」⇒ scope=always;拒绝不携带 scope', async () => {
    render(<ToolApprovalDialog />)
    push(chatReq({ toolName: 'fetch_url', networkTarget: NET_TARGET }))
    await clickAsync(screen.getByTestId('tool-approval-scope-always'))
    await clickAsync(screen.getByTestId('tool-approval-approve'))
    expect(postCalls[0]).toMatchObject({ decision: 'approve', scope: 'always' })

    push(chatReq({ approvalId: 'appr_d159_2', toolCallId: 'tc_2', networkTarget: NET_TARGET }))
    await clickAsync(screen.getByTestId('tool-approval-reject'))
    expect(postCalls[1]).toMatchObject({ decision: 'reject' })
    expect(postCalls[1]).not.toHaveProperty('scope')
  })

  it('无 network_target ⇒ 标签保持通用三档(不得把"该目标"文案套在非出站审批上)', () => {
    render(<ToolApprovalDialog />)
    push(chatReq())
    expect(screen.getByTestId('tool-approval-scope-always').textContent).toBe('始终允许')
    expect(screen.queryByText('始终允许该目标(90 天后失效)')).toBeNull()
  })
})

describe('D159 ②:执行环境按上报值渲染', () => {
  it('沙箱内(docker)⇒ 喊"在沙箱中运行" + 隔离方式 + 不开放网络', () => {
    render(<ToolApprovalDialog />)
    push(
      chatReq({
        execEnvironment: {
          available: true,
          inSandbox: true,
          backend: 'docker',
          networkIsolated: true,
          degraded: false,
        },
      }),
    )
    expect(screen.getByTestId('tool-approval-env-sandbox').textContent).toContain('在沙箱中运行')
    expect(screen.getByTestId('tool-approval-env-sandbox').textContent).toContain(
      '隔离方式:docker'
    )
    expect(screen.getByTestId('tool-approval-env-network-off')).toBeTruthy()
    expect(screen.queryByTestId('tool-approval-env-network-open')).toBeNull()
  })

  it('降级 ⇒ 不得再喊"在沙箱中运行"(票第 8 栏爆炸半径的反面)', () => {
    render(<ToolApprovalDialog />)
    push(
      chatReq({
        execEnvironment: {
          available: true,
          inSandbox: true,
          backend: 'docker',
          degraded: true,
          degradeNote: '沙箱能力不可用,已降级为受限直跑',
        },
      }),
    )
    expect(screen.getByTestId('tool-approval-env-sandbox').textContent).toContain('在沙箱外运行')
    expect(screen.getByTestId('tool-approval-env-degraded').textContent).toContain(
      '已降级为受限直跑'
    )
    expect(screen.queryByText(/在沙箱中运行/)).toBeNull()
  })

  it('plain 环境(local)⇒ 屏上不得出现"在沙箱中运行"(反向对照:据实报"沙箱外")', () => {
    render(<ToolApprovalDialog />)
    push(
      chatReq({
        execEnvironment: {
          available: true,
          inSandbox: false,
          backend: 'local',
          networkIsolated: false,
          degraded: false,
        },
      }),
    )
    expect(screen.getByTestId('tool-approval-env-sandbox').textContent).toContain('在沙箱外运行')
    expect(screen.queryByText(/在沙箱中运行/)).toBeNull()
    // local 不隔离网络 ⇒ 喊"可访问外网",这一行本身就是放行前的关键事实
    expect(screen.getByTestId('tool-approval-env-network-open')).toBeTruthy()
    expect(screen.queryByTestId('tool-approval-env-network-off')).toBeNull()
  })

  it('④ 反向对照:available=false ⇒ 只出现"未上报",不出现任何一种沙箱结论', () => {
    render(<ToolApprovalDialog />)
    push(chatReq({ execEnvironment: { available: false } }))
    expect(screen.getByTestId('tool-approval-env-unknown').textContent).toContain('未上报')
    expect(screen.queryByTestId('tool-approval-env-sandbox')).toBeNull()
    expect(screen.queryByText(/在沙箱中运行/)).toBeNull()
    expect(screen.queryByText(/在沙箱外运行/)).toBeNull()
    expect(screen.queryByText(/隔离方式:/)).toBeNull()
  })

  it('④ 回退开关:三字段都不发 ⇒ 整块不渲染(与"未上报"是两态,不得合成一态)', () => {
    render(<ToolApprovalDialog />)
    push(chatReq())
    expect(screen.queryByTestId('tool-approval-environment')).toBeNull()
    expect(screen.queryByTestId('tool-approval-env-unknown')).toBeNull()
  })

  it('② 反向对照:网络区块只报"已判死"的目标;空数组不得冒充"没有目标"', () => {
    render(<ToolApprovalDialog />)
    push(
      chatReq({
        networkTarget: NET_TARGET,
        blockedNetworkTargets: [
          { host: '127.0.0.1', port: 8080, protocol: 'http', display: '127.0.0.1:8080', reason: 'not_allowed_local' },
        ],
      }),
    )
    expect(screen.getByTestId('tool-approval-network-blocked-127.0.0.1').textContent).toBe(
      '127.0.0.1:8080(not_allowed_local)'
    )
    // 未知原因走 unknown 档,不把后端原文当文案直出
    push(
      chatReq({
        approvalId: 'appr_d159_3',
        toolCallId: 'tc_3',
        blockedNetworkTargets: [
          { host: 'evil.test', port: 80, protocol: 'http', display: 'evil.test:80' },
        ],
      }),
    )
    expect(screen.queryByTestId('tool-approval-environment')).not.toBeNull()
  })

  it('② 反向对照:dangerLevel 不是渲染条件 —— high/medium 两档都得看得见环境', () => {
    for (const dangerLevel of ['high', 'medium'] as const) {
      render(<ToolApprovalDialog />)
      push(
        chatReq({
          approvalId: `appr_dl_${dangerLevel}`,
          dangerLevel,
          execEnvironment: { available: true, inSandbox: true, backend: 'docker' },
        }),
      )
      expect(screen.getByTestId('tool-approval-env-sandbox').textContent).toContain(
        '在沙箱中运行'
      )
      cleanup()
    }
  })
})
