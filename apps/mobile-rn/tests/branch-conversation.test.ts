// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级分叉宿主逻辑测试(消息 → 新会话)。
 *
 * 测的是**真模块**:
 * - 被测对象 `branchConversationFromMessage` / `isBranchableTarget` 直接 import 真实实现
 *   (`src/utils/branch-conversation.ts` 运行时零依赖,不经 vitest 的 @ihui mock 别名)。
 * - 词表用**真**的 `src/i18n` 合并后的消息包 + **真** `@ihui/i18n/loader` 的 translate,
 *   断言里刻意用 `not.toBe(KEY)` —— 否则键缺失时 t() 回显键名,断言"有文案"会假绿。
 * - 提示用本地 spy(它是宿主边界,不是判据)。
 * - **不** mock 判据本身。注入的 `branch` 边界在"网络调用被拒"这组用例里是桩,
 *   这是被测函数的入参,测的是"服务返回失败时是否给出带状态码的文案";桩不能替代被测逻辑。
 *   而"接线是否正确"这一层另有用例:**真 import** `@ihui/api-client` 的
 *   `branchConversation` 跑通一次(注入假 transport,不 mock 任何 api-client 模块),
 *   并断言它的**真实返回信封形状** —— 出口被改名/移除、或信封换形,那一条会红。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
// 反向对照:只 import 真实 api-client 的这一个出口,若被改名/移除,本文件加载即失败。
import { branchConversation } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { translate } from '@ihui/i18n/loader'
import { messages } from '../src/i18n'
// 被测模块(真身,非 mock)
import {
  branchConversationFromMessage,
  isBranchableTarget,
  type BranchConversationCall,
  type BranchConversationDeps,
  type BranchConversationResponse,
  type OpenConversationResult,
} from '../src/utils/branch-conversation'

const KEYS = {
  ariaLabel: 'ai.pane.branch.ariaLabel',
  notPersisted: 'ai.pane.branch.notPersisted',
  success: 'ai.pane.branch.success',
  switchFailure: 'ai.pane.branch.switchFailure',
  loadFailure: 'ai.pane.branch.loadFailure',
  failure: 'ai.pane.branch.failure',
  noReason: 'ai.pane.branch.noReason',
  unknownStatus: 'ai.pane.branch.unknownStatus',
} as const
const ALL_KEYS = Object.values(KEYS)

/** 被测模块眼里的成功信封 —— 即它自己的 `ApiResult<BranchConversationResponse>` 契约。 */
function ok(id: string): ApiResult<BranchConversationResponse> {
  return { success: true, data: { conversation: { id } } }
}
function fail(error: string, status?: number): ApiResult<BranchConversationResponse> {
  return status === undefined ? { success: false, error } : { success: false, error, status }
}

/** 真词包驱动的取词器,与 src/i18n 的 Provider 内部实现同一条路径。 */
function realT(locale: 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko') {
  return (key: string, params?: Record<string, string | number>): string =>
    translate(messages[locale], key, params ? { params } : undefined)
}

/**
 * 取词并**当场证明它解析了** —— 这是本文件唯一的反同义反复装置。
 *
 * `t()` 对缺键的行为是回显键名,于是 `expect(notify).toHaveBeenCalledWith('warning', t(KEY))`
 * 在词包没这个键时两边都是键名,断言恒真(它绿着通过过整整一轮)。凡拿 `t(KEY)` 当期望值
 * 的用例都必须经这里,让"词包缺键"表现为红而不是绿。
 */
function resolvedText(t: (key: string) => string, key: string): string {
  const value = t(key)
  expect(value, `ai.pane.branch 词包缺键:${key} 未解析(t() 回显了键名)`).not.toBe(key)
  expect(value.trim().length).toBeGreaterThan(0)
  return value
}

function makeDeps(overrides: Partial<BranchConversationDeps> = {}) {
  const notify = vi.fn<BranchConversationDeps['notify']>()
  const openConversation = vi.fn<BranchConversationDeps['openConversation']>()
  const branch = vi.fn<BranchConversationCall>()
  openConversation.mockResolvedValue({ switched: true, loaded: true })
  return {
    notify,
    openConversation,
    branch,
    deps: {
      branch,
      notify,
      openConversation,
      t: realT('zh-CN'),
      ...overrides,
    } satisfies BranchConversationDeps,
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('ai.pane.branch 词包(5 语言齐全)', () => {
  for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const) {
    it(`${locale}: 8 个键都能取到非空文案(不回显键名)`, () => {
      const t = realT(locale)
      for (const key of ALL_KEYS) {
        const value = t(key)
        expect(value, `${locale} 缺键 ${key}`).not.toBe(key)
        expect(value.trim().length).toBeGreaterThan(0)
      }
    })
  }

  it('failure 带 {reason}/{status} 占位符,5 语言都真完成插值', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const) {
      const text = realT(locale)(KEYS.failure, { reason: 'quota exceeded', status: '429' })
      expect(text).toContain('quota exceeded')
      expect(text).toContain('429')
      expect(text).not.toContain('{reason}')
      expect(text).not.toContain('{status}')
    }
  })
})

describe('isBranchableTarget', () => {
  it('会话与消息都落库才可分叉', () => {
    expect(isBranchableTarget({ conversationId: 'c1', messageId: 'm1' })).toBe(true)
  })
  it('缺任一项即不可分叉(乐观消息 / 新对话)', () => {
    expect(isBranchableTarget({ conversationId: 'c1', messageId: undefined })).toBe(false)
    expect(isBranchableTarget({ conversationId: undefined, messageId: 'm1' })).toBe(false)
    expect(isBranchableTarget({ conversationId: undefined, messageId: undefined })).toBe(false)
  })
})

describe('接线:真 api-client 的 branchConversation 跑通一次', () => {
  it('假 transport 下真模块真调用,且返回信封与实现契约一致', async () => {
    // 只替全局 fetch(传输层),@ihui/api-client 与 src/i18n 都是真身。
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, message: 'ok', data: { conversation: { id: 'srv-1' } } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await branchConversation('conv-src', 'msg-anchor')

    expect(res.success).toBe(true)
    if (!res.success) return
    // 信封形状断言:换形(例如多包一层 / 改字段名)即红,而不是让 ok() 桩悄悄跑绿。
    expect(typeof res.data.conversation.id).toBe('string')
    expect(res.data.conversation.id.length).toBeGreaterThan(0)
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toContain('/api/chat/conversations/conv-src/branch')
    expect(String(init?.method)).toBe('POST')
    expect(JSON.parse(String(init?.body))).toMatchObject({ messageId: 'msg-anchor' })
  })
})

describe('branchConversationFromMessage', () => {
  it('成功:用真信封的 id 切会话并提示成功', async () => {
    const { deps, branch, openConversation, notify } = makeDeps()
    branch.mockResolvedValue(ok('srv-new'))

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: 'msg-anchor',
    })

    expect(branch).toHaveBeenCalledWith('conv-src', 'msg-anchor')
    expect(openConversation).toHaveBeenCalledWith('srv-new')
    expect(outcome).toEqual({ outcome: 'switched', conversationId: 'srv-new' })
    expect(notify).toHaveBeenCalledWith('success', resolvedText(deps.t, KEYS.success))
    // 未切换时不得连带改源会话:只有 openConversation 被要求切,且切的是新 id
    expect(openConversation.mock.calls.length).toBe(1)
    expect(openConversation).not.toHaveBeenCalledWith('conv-src')
  })

  it('服务端拒绝:文案必须同时带原因与状态码', async () => {
    const { deps, branch, openConversation, notify } = makeDeps()
    branch.mockResolvedValue(fail('会话不存在', 404))

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: 'msg-anchor',
    })

    expect(outcome).toEqual({ outcome: 'request-failed' })
    expect(openConversation).not.toHaveBeenCalled()
    const [level, message] = notify.mock.calls[0] ?? []
    expect(level).toBe('error')
    expect(message).toContain('404')
    expect(message).toContain('会话不存在')
    expect(message).not.toBe(deps.t(KEYS.failure))
  })

  it('服务端拒绝但没给原因:仍显式提示,不吐空串', async () => {
    const { deps, branch, notify } = makeDeps()
    branch.mockResolvedValue(fail('   ', 500))

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: 'msg-anchor',
    })

    expect(outcome).toEqual({ outcome: 'request-failed' })
    const [, message] = notify.mock.calls[0] ?? []
    expect(message).toContain('500')
    expect(message).toContain(resolvedText(deps.t, KEYS.noReason))
  })

  it('无原因**且**无状态码(网络层失败):状态位降级为"未知",文案不残坑', async () => {
    const { deps, branch, notify } = makeDeps()
    branch.mockResolvedValue(fail('Network request failed'))

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: 'msg-anchor',
    })

    expect(outcome).toEqual({ outcome: 'request-failed' })
    const [level, message] = notify.mock.calls[0] ?? []
    expect(level).toBe('error')
    expect(message).toContain(resolvedText(deps.t, KEYS.unknownStatus))
    expect(message).toContain('Network request failed')
    expect(message).not.toContain('{status}')
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('锚点未落库(无 messageId):不动网络、不切会话,并给出解释', async () => {
    const { deps, branch, openConversation, notify } = makeDeps()

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: undefined,
    })

    expect(outcome).toEqual({ outcome: 'blocked' })
    expect(branch).not.toHaveBeenCalled()
    expect(openConversation).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('warning', resolvedText(deps.t, KEYS.notPersisted))
  })

  it('会话未落库(无 conversationId):同上,绝不发分支请求', async () => {
    const { deps, branch, openConversation, notify } = makeDeps()

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: undefined,
      messageId: 'msg-anchor',
    })

    expect(outcome).toEqual({ outcome: 'blocked' })
    expect(branch).not.toHaveBeenCalled()
    expect(openConversation).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('warning', resolvedText(deps.t, KEYS.notPersisted))
  })

  it('会话已建成但界面没切过去:说"未能切换",**不得**说成"内容加载失败"', async () => {
    const { deps, branch, notify } = makeDeps()
    branch.mockResolvedValue(ok('srv-new'))
    // 宿主的 openConversation 自己吞掉了 setState / 读回不一致,只能报 false
    deps.openConversation = async (): Promise<OpenConversationResult> => ({
      switched: false,
      loaded: false,
    })

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: 'msg-anchor',
    })

    expect(outcome).toEqual({ outcome: 'created-not-switched', conversationId: 'srv-new' })
    const [, message] = notify.mock.calls[0] ?? []
    expect(message).toBe(resolvedText(deps.t, KEYS.switchFailure))
    expect(message).not.toBe(resolvedText(deps.t, KEYS.loadFailure))
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('已切过去但消息没读回来:说"内容加载失败",与上一条文案不同', async () => {
    const { deps, branch, notify } = makeDeps()
    branch.mockResolvedValue(ok('srv-new'))
    deps.openConversation = async (): Promise<OpenConversationResult> => ({
      switched: true,
      loaded: false,
    })

    const outcome = await branchConversationFromMessage(deps, {
      conversationId: 'conv-src',
      messageId: 'msg-anchor',
    })

    expect(outcome).toEqual({ outcome: 'switched-not-loaded', conversationId: 'srv-new' })
    expect(deps.notify).toHaveBeenCalledTimes(1)
    const [, message] = notify.mock.calls[0] ?? []
    expect(message).toBe(resolvedText(deps.t, KEYS.loadFailure))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
