// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D111 / D49① 接线取证(mobile-rn):
//  ① PermissionTierRow —— ChatScreen 与 N8n 屏共用的权限档交代行(档名 + 后果),
//     mode 缺失必须整行隐藏(取数失败 ≠ 知道是默认档);
//  ② ToolApprovalRow —— 审批三键把决策回传到 @ihui/api-client 的既有通道
//     sendToolApprovalResponse(web 审批弹窗同一函数),拒绝一律不带 scope(不落授权)。
// 口径:渲染走 tests/__mocks__/react-native.ts 的 DOM 桩 + 真实词包(zh-CN),
// 这样"取词键是否真解析得出"也被钉住(缺键会渲染成 raw key,断言③会红)。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mocks = vi.hoisted(() => ({
  sendToolApprovalResponse: vi.fn(
    async (_params: {
      approvalId: string
      decision: string
      scope?: string
    }): Promise<{ ok: boolean }> => ({ ok: true }),
  ),
}))

vi.mock('@ihui/api-client', () => ({
  sendToolApprovalResponse: mocks.sendToolApprovalResponse,
}))

// ChatDisclosure 静态引了 Linking(全局桩没导出)⇒ 这里在原型上补齐,不改他人桩。
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...(actual as object), Linking: { openURL: vi.fn(async () => true) } }
})

import { PermissionTierRow, ToolApprovalRow, APPROVAL_ACTION_WIRE } from '../src/components/ChatDisclosure'
import { I18nProvider } from '../src/i18n'

const wrap = (node: ReactNode) => render(<I18nProvider>{node}</I18nProvider>)

const REQUEST = {
  approvalId: 'ap-1',
  toolName: 'write_file',
  toolCallId: 'tc-1',
  argsPreview: '{"path":"a.ts"}',
  dangerLevel: 'high' as const,
  sessionId: 's-1',
}

describe('PermissionTierRow(D111:档名 + 后果说明,两屏同一实现)', () => {
  it('mode=null / undefined → 整行不渲染,不假装知道档位', () => {
    const { rerender, container } = wrap(<PermissionTierRow mode={null} />)
    expect(container.textContent).toBe('')
    rerender(
      <I18nProvider>
        <PermissionTierRow mode={undefined} />
      </I18nProvider>,
    )
    expect(container.textContent).toBe('')
  })

  it("wire 'acceptEdits' 解析成中文档名与后果,不喷 raw key", () => {
    const { container } = wrap(<PermissionTierRow mode={'acceptEdits'} />)
    expect(container.textContent).toContain('权限档')
    expect(container.textContent).toContain('接受编辑')
    expect(container.textContent).toContain('白名单内的操作自动放行')
    expect(container.textContent).not.toContain('permissionTier.mode.')
  })

  it('认不出的档位落 unknown(与 default 互异),绝不静默显示成默认档', () => {
    const unknown = wrap(<PermissionTierRow mode={'garbage-mode'} />)
    expect(unknown.container.textContent).toContain('未知模式')
    expect(unknown.container.textContent).not.toContain('默认模式')
  })
})

describe('ToolApprovalRow(D111 残余:审批三键动作落点)', () => {
  beforeEach(() => {
    mocks.sendToolApprovalResponse.mockClear()
  })

  it('无请求 → 不渲染空壳', () => {
    const { container } = wrap(<ToolApprovalRow request={null} />)
    expect(container.textContent).toBe('')
  })

  it('三键齐备且全部走本地化文案(无 raw i18n key 泄漏)', () => {
    const { getByText } = wrap(<ToolApprovalRow request={REQUEST} />)
    expect(getByText('允许一次')).toBeTruthy()
    expect(getByText('始终允许')).toBeTruthy()
    expect(getByText('取消')).toBeTruthy()
    expect(document.body.textContent).not.toContain('editor.toolApproval.')
  })

  it('「允许一次」→ decision=approve + scope=once', async () => {
    const { getByText } = wrap(<ToolApprovalRow request={REQUEST} />)
    fireEvent.click(getByText('允许一次'))
    await waitFor(() => expect(mocks.sendToolApprovalResponse).toHaveBeenCalledTimes(1))
    expect(mocks.sendToolApprovalResponse.mock.calls[0]?.[0]).toEqual({
      approvalId: 'ap-1',
      decision: 'approve',
      scope: 'once',
    })
  })

  it('「始终允许」→ decision=approve + scope=always', async () => {
    const { getByText } = wrap(<ToolApprovalRow request={REQUEST} />)
    fireEvent.click(getByText('始终允许'))
    await waitFor(() => expect(mocks.sendToolApprovalResponse).toHaveBeenCalledTimes(1))
    expect(mocks.sendToolApprovalResponse.mock.calls[0]?.[0]).toEqual({
      approvalId: 'ap-1',
      decision: 'approve',
      scope: 'always',
    })
  })

  it('拒绝 → decision=reject 且**不得**携带 scope 键(拒绝不落任何授权)', async () => {
    const { getByText } = wrap(<ToolApprovalRow request={REQUEST} />)
    fireEvent.click(getByText('取消'))
    await waitFor(() => expect(mocks.sendToolApprovalResponse).toHaveBeenCalledTimes(1))
    const payload = mocks.sendToolApprovalResponse.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).toEqual({ approvalId: 'ap-1', decision: 'reject' })
    expect('scope' in payload).toBe(false)
  })

  it('回传成功后整行收起并通知上层(不给重复提交的机会)', async () => {
    const onResolved = vi.fn()
    const { getByText, container } = wrap(
      <ToolApprovalRow request={REQUEST} onResolved={onResolved} />,
    )
    fireEvent.click(getByText('允许一次'))
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith('ap-1'))
    expect(container.textContent).toBe('')
  })

  it('wire 映射表与按钮一一对应(三键 => once/always/reject,防日后改文案时把语义改掉)', () => {
    expect(APPROVAL_ACTION_WIRE['allowOnce']).toEqual({ decision: 'approve', scope: 'once' })
    expect(APPROVAL_ACTION_WIRE['alwaysAllow']).toEqual({ decision: 'approve', scope: 'always' })
    expect(APPROVAL_ACTION_WIRE['reject']).toEqual({ decision: 'reject' })
  })
})

// 两个大屏(3.5k / 2.1k 行)在本端没有渲染级用例(挂 FullList + 十余 provider,挂载即
// TypeError),因此"接线是否真在屏上"用源码级断言钉住 —— 组件造好没装车正是本仓反复出事
// 的那一类(守门 64 / 70 的成因)。
describe('屏侧接线自证(源码级)', () => {
  const read = (rel: string): string => readFileSync(join(__dirname, '..', rel), 'utf8')
  const chatSrc = read('src/screens/ChatScreen.tsx')
  const n8nSrc = read('src/screens/AiAssistantN8nScreen.tsx')

  it('ChatScreen 走 @ihui/api-client 的 rateChatMessage,并真发出调用', () => {
    expect(chatSrc).toMatch(/import \{[\s\S]*?rateChatMessage,[\s\S]*?\} from '@ihui\/api-client'/)
    expect(chatSrc).toContain('await rateChatMessage({ messageId, rating: next })')
    expect(chatSrc).not.toMatch(/\bfetch\(/)
  })

  it('ChatScreen 的消息操作区挂了点赞/点踩两个钮(不是只有 handler)', () => {
    expect(chatSrc).toContain("onPress={() => void rateMessage(item.id, 'like')}")
    expect(chatSrc).toContain("onPress={() => void rateMessage(item.id, 'dislike')}")
  })

  it('档位行两屏同一实现:D111 要求 ChatScreen 接上,且 N8n 不再留第二套文案', () => {
    expect(chatSrc).toContain('<PermissionTierRow key="permission-tier-row" mode={workspaceTier} />')
    expect(n8nSrc).toContain('<PermissionTierRow mode={stampedTier ?? workspaceTier} />')
    // 原 N8n 内联 IIFE(第二份取词)必须消失,否则两屏会各自漂移
    expect(n8nSrc).not.toContain("t('permissionTier.label')")
  })

  it('本端不新增中文字面量文案(守门 70 棘轮),全部走 t() 既有键', () => {
    const added = chatSrc
      .split('\n')
      .filter((l) => /ThumbsUp|ThumbsDown|rateMessage\(|PermissionTierRow/.test(l))
      .join('\n')
    expect(added).not.toMatch(/'[^']*[\u4e00-\u9fa5][^']*'/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
