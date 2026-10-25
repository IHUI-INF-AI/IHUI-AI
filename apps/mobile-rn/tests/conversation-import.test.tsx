// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 外部会话导入(RN 端)测试 — D28 多端同步补齐(2026-09-21)
 *
 * 覆盖:
 * - 初始:拉取导入历史 + 渲染 5 个来源(不自动解析)
 * - 微信来源:zip 走 RN multipart 解析 → commit 带 source=wechat;.txt 放行 / 别家后缀本地拦截
 * - 平台 adapter:expo-document-picker 选文件 → fetchApi 拼 RN multipart(source 字段 + {uri,type,name} 文件部分)
 * - 隐私:预览只渲染会话元信息,消息正文不进 DOM
 * - 串行提交:逐会话 commit,单个失败不中断其余,完成后重拉历史
 * - 取消选择:不触发解析请求
 *
 * 等待口径(2026-10-25 收口,同 e4989cbb9e 先例):每条异步链**只等终点一次**,前序各步降级为
 * 带理由的同步断言。立因:RTL 的 waitFor 每段默认预算量的是机器负载不是被测件 —— 本机并发
 * 200+ 道守门时事件循环被同步占死,实测 fireEvent→首跳 1201ms > 默认 1000ms;而 setup 已把
 * asyncUtilTimeout 抬到 4s,四段串行就是 16s,超出 vitest.config 的 testTimeout 10s(换个死法
 * 继续假红)。故每枚用例存活的 waitFor 预算显式写死,且合计 < 10s。
 *
 * 说明:@ihui/rn-app 由 vitest.config.ts alias 到 tests/__mocks__/ihui-rn-app.ts,
 * 该 mock 对 ConversationImportScreen 走真实共享实现(与 SettingsScreen/OrderScreen 同款),
 * 因此本测试同时验证 wrapper 注入与共享 UI 的联动。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { rnMocks } = vi.hoisted(() => ({
  rnMocks: {
    getDocumentAsync: vi.fn(),
    fetchApi: vi.fn(),
    commitConversationImport: vi.fn(),
    getConversationImportHistory: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: rnMocks.getDocumentAsync,
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: rnMocks.fetchApi,
  commitConversationImport: rnMocks.commitConversationImport,
  getConversationImportHistory: rnMocks.getConversationImportHistory,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: rnMocks.goBack, navigate: vi.fn() }),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../src/components/NavBar', async () => {
  const { createElement } = await import('react')
  return {
    NavBar: ({ title, onBack }: { title?: string; onBack?: () => void }) =>
      createElement(
        'div',
        null,
        createElement('button', { onClick: onBack }, 'back'),
        createElement('span', null, title ?? ''),
      ),
  }
})

import { ConversationImportScreen } from '../src/screens/ConversationImportScreen'

/** 解析端点响应(ai-service 裸 JSON,fetchApi 直出 data) */
const PARSE_RESULT = {
  success: true as const,
  data: {
    conversations: [
      {
        title: '重构计费模块',
        source: 'claude_code' as const,
        model: 'claude-sonnet-4-5',
        sourceCreatedAt: '2026-09-20T10:00:00.000Z',
        messages: [
          { role: 'user' as const, content: 'PRIVATE-BODY-ALPHA' },
          { role: 'assistant' as const, content: 'PRIVATE-BODY-BETA' },
        ],
      },
      {
        title: '联调支付回调',
        source: 'claude_code' as const,
        messages: [{ role: 'user' as const, content: 'PRIVATE-BODY-GAMMA' }],
      },
      {
        // 正文全空白:过滤后无消息 → 不发 commit 请求,直接计失败
        title: '空消息会话',
        source: 'claude_code' as const,
        messages: [{ role: 'user' as const, content: '   ' }],
      },
    ],
    truncated: false,
    warnings: ['缺少模型信息'],
  },
}

const HISTORY_RESULT = {
  success: true as const,
  data: {
    list: [
      {
        id: 'b1',
        source: 'claude_code',
        conversationId: 'c1',
        fileName: 'export.jsonl',
        parsedCount: 2,
        importedCount: 1,
        failedCount: 1,
        status: 'partial',
        errorMessage: null,
        importedAt: '2026-09-18T12:00:00.000Z',
      },
    ],
    total: 1,
  },
}

function mockPickedFile(): void {
  rnMocks.getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///cache/export.jsonl',
        name: 'export.jsonl',
        mimeType: 'application/jsonl',
        size: 2048,
      },
    ],
  })
}

/** commit 请求体(仅取断言所需字段,避免依赖 api-client 内部类型) */
interface CommitPayload {
  source: string
  fileName?: string
  title?: string
  model?: string
  createdAt?: string
  messages: Array<{ role: string; content: string }>
}

function commitPayloadAt(index: number): CommitPayload {
  const call = rnMocks.commitConversationImport.mock.calls[index]?.[0]
  if (!call) throw new Error(`commitConversationImport 第 ${index} 次调用缺失`)
  return call as CommitPayload
}

beforeEach(() => {
  rnMocks.getConversationImportHistory.mockResolvedValue(HISTORY_RESULT)
})

describe('ConversationImportScreen(RN)', () => {
  it('初始只拉导入历史并渲染 5 个来源', async () => {
    render(<ConversationImportScreen />)

    // 链终点 = 历史行落进 DOM。原先这段等的是"mock 被调用过",而请求在挂载那一刻就已同步发出
    // (useEffect → loadHistory → onLoadHistory 首个 await 之前就把请求发出去了),所以那段等待
    // 恒定立刻成立,下面读 DOM 的断言实际判的是"还没轮到水合"—— 负载一高就是假红。
    await waitFor(() => expect(screen.getByText('export.jsonl')).toBeTruthy(), {
      timeout: 8_000,
    })
    expect(
      rnMocks.getConversationImportHistory,
      '历史行画出来了却没调过历史接口 = 数据从别处冒出来',
    ).toHaveBeenCalledTimes(1)

    expect(screen.getByText('conversationImport.sourceClaudeCode')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceCodex')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceCursor')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceAider')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceWechat')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceWechatHint')).toBeTruthy()
    // 历史渲染:批次文件名 + 计数
    expect(screen.getByText('export.jsonl')).toBeTruthy()
    expect(screen.getByText(/2026-09-18/)).toBeTruthy()
    // 未选来源就点解析 → 只做本地校验,不发请求
    fireEvent.click(screen.getByText('conversationImport.pickFile'))
    expect(rnMocks.getDocumentAsync).not.toHaveBeenCalled()
    expect(rnMocks.fetchApi).not.toHaveBeenCalled()
    expect(screen.getByText('conversationImport.errorNoSource')).toBeTruthy()
  })

  it('微信来源:选 zip 走 RN multipart 解析,commit 带 source=wechat', async () => {
    rnMocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/chat.zip',
          name: 'chat.zip',
          mimeType: 'application/zip',
          size: 4096,
        },
      ],
    })
    rnMocks.fetchApi.mockResolvedValue({
      success: true as const,
      data: {
        conversations: [
          {
            title: '张三',
            source: 'wechat' as const,
            sourceCreatedAt: '2026-09-19T08:00:00.000Z',
            messages: [
              { role: 'user' as const, content: 'WECHAT-BODY-ALPHA' },
              { role: 'assistant' as const, content: 'WECHAT-BODY-BETA' },
            ],
          },
        ],
        truncated: false,
        warnings: [],
      },
    })
    rnMocks.commitConversationImport.mockResolvedValue({
      success: true,
      data: { importId: 'iw1', conversationId: 'cw1', importedMessages: 2 },
    })
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    render(<ConversationImportScreen />)

    fireEvent.click(screen.getByText('conversationImport.sourceWechat'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))

    // 链一(选文件 → 解析 → 预览)终点 = 预览标题出现。pickAndParse 里 onPickFile / onParse
    // 都是 await 的,预览画得出来即证明 picker 调过、multipart 请求已按微信来源发出
    // ⇒ 原先"等 fetchApi 被调"与"等预览"两段并成一段(4s + 5s = 9s < testTimeout 10s)。
    await waitFor(() => expect(screen.getByText('张三')).toBeTruthy(), { timeout: 4_000 })
    expect(rnMocks.getConversationImportHistory, '挂载时必须先拉导入历史').toHaveBeenCalledTimes(1)
    expect(rnMocks.getDocumentAsync, '没调 picker 就没有文件可解析').toHaveBeenCalledTimes(1)
    expect(rnMocks.fetchApi, '预览不是从 /parse 端点来的').toHaveBeenCalledTimes(1)
    expect(appendSpy.mock.calls.filter(([field]) => field === 'source')).toEqual([
      ['source', 'wechat'],
    ])
    expect(appendSpy.mock.calls.find(([field]) => field === 'file')?.[1]).toEqual({
      uri: 'file:///cache/chat.zip',
      type: 'application/zip',
      name: 'chat.zip',
    })
    appendSpy.mockRestore()

    // 隐私口径与其它来源一致:正文不进 DOM
    expect(screen.queryByText(/WECHAT-BODY-ALPHA/)).toBeNull()

    fireEvent.click(screen.getByText('conversationImport.commit'))
    // 链二(逐会话落库)终点 = 完成回执出现:commit() 里 await onCommit 之后才 setDoneMessage,
    // 回执来了即证明落库请求已经发出并按 wechat 带上文件名 ⇒ 中间那段"等 commit 被调"降级同步。
    await waitFor(() => expect(screen.getByText('conversationImport.commitDone')).toBeTruthy(), {
      timeout: 5_000,
    })
    expect(
      rnMocks.commitConversationImport,
      '回执来了却没有落库请求 = 回执是假的',
    ).toHaveBeenCalledTimes(1)
    expect(commitPayloadAt(0).source).toBe('wechat')
    expect(commitPayloadAt(0).fileName).toBe('chat.zip')
    expect(commitPayloadAt(0).messages).toHaveLength(2)
  })

  it('微信来源:.txt 放行,zip 家族以外的后缀本地拦截', async () => {
    rnMocks.fetchApi.mockResolvedValue(PARSE_RESULT)

    // .txt 属微信白名单 → 允许发出请求
    rnMocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///cache/chat.txt', name: 'chat.txt', mimeType: 'text/plain', size: 64 },
      ],
    })
    render(<ConversationImportScreen />)
    fireEvent.click(screen.getByText('conversationImport.sourceWechat'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))
    // 链一(.txt 属微信白名单 → 放行到端点)终点 = 预览出现。等"预览"而不是等"fetchApi 被调"
    // 还多兜住一格:picking 落回 false 才点得动第二下按钮(原先只等到请求发出就重点击,
    // 两次链在 fireEvent 无视 disabled 的替身上会叠着跑)。
    await waitFor(() => expect(screen.getByText('重构计费模块')).toBeTruthy(), { timeout: 4_000 })
    expect(rnMocks.getConversationImportHistory, '挂载时必须先拉导入历史').toHaveBeenCalledTimes(1)
    expect(rnMocks.fetchApi, '.txt 被白名单误拦就根本没有这次请求').toHaveBeenCalledTimes(1)

    // .jsonl 是别家来源的后缀,对微信必须本地拦下
    rnMocks.fetchApi.mockClear()
    rnMocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///cache/export.jsonl',
          name: 'export.jsonl',
          mimeType: 'application/jsonl',
          size: 64,
        },
      ],
    })
    fireEvent.click(screen.getByText('conversationImport.pickFile'))
    // 链二(本地拦截)终点 = 拦截文案出现;它排在 picker 之后,出现即证明这次确实选了文件
    await waitFor(() => expect(screen.getByText('conversationImport.errorFileType')).toBeTruthy(), {
      timeout: 5_000,
    })
    expect(rnMocks.getDocumentAsync, '拦在本地前没调 picker = 无从判断后缀').toHaveBeenCalledTimes(
      2,
    )
    expect(rnMocks.fetchApi).not.toHaveBeenCalled()
  })

  it('选文件后以 RN multipart 形态调 parse 端点,预览不含消息正文', async () => {
    mockPickedFile()
    rnMocks.fetchApi.mockResolvedValue(PARSE_RESULT)
    // jsdom 的 FormData 会把非 Blob 值字符串化,故在 append 处断言 RN 文件对象原样传入
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    render(<ConversationImportScreen />)

    fireEvent.click(screen.getByText('conversationImport.sourceClaudeCode'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))

    // 一条链(挂载拉历史 + 选文件 → 解析 → 预览)只等终点一次:预览标题出现即证明
    // picker 调过、/parse 请求发过、rows 落进界面 ⇒ 原先三段串行等待收成一段。
    await waitFor(() => expect(screen.getByText('重构计费模块')).toBeTruthy(), {
      timeout: 8_000,
    })
    expect(rnMocks.getConversationImportHistory, '挂载时必须先拉导入历史').toHaveBeenCalledTimes(1)
    expect(rnMocks.fetchApi, '预览画出来了却没请求过端点 = 预览是本地幻觉').toHaveBeenCalledTimes(1)

    const fetchCall = rnMocks.fetchApi.mock.calls[0]
    if (!fetchCall) throw new Error('fetchApi 未被调用')
    const [url, options] = fetchCall as [string, { method: string; body: FormData }]
    expect(url).toBe('/api/user/conversation-import/parse')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(appendSpy.mock.calls.filter(([field]) => field === 'source')).toEqual([
      ['source', 'claude_code'],
    ])
    // RN 文件部分为 { uri, type, name } 对象(非 Blob/File)
    expect(appendSpy.mock.calls.find(([field]) => field === 'file')?.[1]).toEqual({
      uri: 'file:///cache/export.jsonl',
      type: 'application/jsonl',
      name: 'export.jsonl',
    })
    appendSpy.mockRestore()

    // 元信息可见:消息数 / 模型 / 日期(标题已是上面的等待终点,不重复断)
    expect(screen.getAllByText(/conversationImport\.messagesCount/)).toHaveLength(3)
    expect(screen.getByText(/claude-sonnet-4-5/)).toBeTruthy()
    expect(screen.getByText(/2026-09-20/)).toBeTruthy()
    expect(screen.getByText('缺少模型信息')).toBeTruthy()
    // 隐私:正文绝不进 DOM
    expect(screen.queryByText(/PRIVATE-BODY-ALPHA/)).toBeNull()
    expect(screen.queryByText(/PRIVATE-BODY-BETA/)).toBeNull()
  })

  it('选到来源白名单外的文件时本地拦截,不发请求也不误报成功', async () => {
    rnMocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: 'file:///cache/notes.txt', name: 'notes.txt', mimeType: 'text/plain', size: 12 },
      ],
    })
    rnMocks.fetchApi.mockResolvedValue(PARSE_RESULT)

    render(<ConversationImportScreen />)

    fireEvent.click(screen.getByText('conversationImport.sourceClaudeCode'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))

    // 一条链(选文件 → 白名单本地校验 → 报错)只等终点一次:拦截文案出现。
    await waitFor(() => expect(screen.getByText('conversationImport.errorFileType')).toBeTruthy(), {
      timeout: 8_000,
    })
    expect(rnMocks.getConversationImportHistory, '挂载时必须先拉导入历史').toHaveBeenCalledTimes(1)
    expect(rnMocks.getDocumentAsync, '拦在本地前没调 picker = 无从判断后缀').toHaveBeenCalledTimes(
      1,
    )
    expect(rnMocks.fetchApi).not.toHaveBeenCalled()
  })

  it('串行提交:单会话失败不中断,正文空白会话不发请求,完成后重拉历史', async () => {
    mockPickedFile()
    rnMocks.fetchApi.mockResolvedValue(PARSE_RESULT)
    rnMocks.commitConversationImport
      .mockResolvedValueOnce({
        success: true,
        data: { importId: 'i1', conversationId: 'c1', importedMessages: 2 },
      })
      .mockResolvedValueOnce({ success: false, error: '服务暂不可用' })

    render(<ConversationImportScreen />)

    fireEvent.click(screen.getByText('conversationImport.sourceClaudeCode'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))
    // 链一(解析)终点 = 预览出现,它同时是"点得动 commit"的前提(selected 全选取决于 rows)
    await waitFor(() => expect(screen.getByText('重构计费模块')).toBeTruthy(), { timeout: 4_000 })
    expect(rnMocks.getConversationImportHistory, '挂载时必须先拉导入历史').toHaveBeenCalledTimes(1)

    // 默认全选 3 条(其中 1 条正文空白)
    fireEvent.click(screen.getByText('conversationImport.commit'))

    // 链二终点 = 完成后重拉历史 —— 它在 commit() 里排在 `await onCommit` 之后,而 onCommit 的
    // for 循环对每条会话各自 await 一次落库,所以"历史被重拉"这一件事已经整串地证明了:
    // 循环走完、单个失败没中断、空白会话没发请求。原先"等 commit 被调 2 次"那一段是链中间的
    // 一跳,降级为下面的同步断言(计数本身一条没减,见报告)。
    await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalledTimes(2), {
      timeout: 5_000,
    })
    expect(
      rnMocks.commitConversationImport,
      '3 条会话里正文空白那条不该发请求,只许 2 次',
    ).toHaveBeenCalledTimes(2)
    const firstPayload = commitPayloadAt(0)
    expect(firstPayload.source).toBe('claude_code')
    expect(firstPayload.fileName).toBe('export.jsonl')
    expect(firstPayload.title).toBe('重构计费模块')
    // 外部工具的模型 id 不进 model 列 —— 该列会直接进 LLM 网关,陌生 id 会让导入会话
    // 首次续聊报错(与 web/CLI 同口径)。预览展示模型不受影响。
    expect(firstPayload.model).toBeUndefined()
    expect(firstPayload.messages).toHaveLength(2)
    // 第二条失败后仍继续处理第三条;第三条无有效消息 → 不发请求
    const secondPayload = commitPayloadAt(1)
    expect(secondPayload.title).toBe('联调支付回调')
    // t 为恒等 mock,故完成文案只呈现 key(计数已插入)
    expect(screen.getByText('conversationImport.commitDone')).toBeTruthy()
  })

  it('取消文件选择不触发解析', async () => {
    rnMocks.getDocumentAsync.mockResolvedValue({ canceled: true, assets: [] })

    render(<ConversationImportScreen />)

    fireEvent.click(screen.getByText('conversationImport.sourceCursor'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))

    // 取消分支在 `if (!picked) return` 处直接退出,界面上没有任何"结果"可等 ⇒ 这条链唯一的
    // 可观测终点就是 picking 落回 false(按钮文案从 parsing 回到 pickFile)。
    // 等它一次就够:文案回来即证明 picker 调过、流程走完了。
    await waitFor(() => expect(screen.getByText('conversationImport.pickFile')).toBeTruthy(), {
      timeout: 8_000,
    })
    expect(rnMocks.getConversationImportHistory, '挂载时必须先拉导入历史').toHaveBeenCalledTimes(1)
    expect(rnMocks.getDocumentAsync, '没调 picker 就谈不上"取消选择"').toHaveBeenCalledTimes(1)
    expect(rnMocks.fetchApi).not.toHaveBeenCalled()
    expect(screen.queryByText('conversationImport.previewTitle')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
