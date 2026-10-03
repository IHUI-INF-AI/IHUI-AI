// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 会话导入(D28)小程序端的判序测试。
 *
 * 六个"错法"各自的判据:
 *   ① 来源目录:5 源齐备、微信源后缀是 .zip/.txt(与其余四源的 jsonl/sqlite 家族不同);
 *      未知来源字符串必须收窄成 undefined(不得当默认源放行)。
 *   ② 文件校验:后缀白名单按来源分派、大小写不敏感、缺文件名判否、超 20MB 判否。
 *   ③ /parse 归一化:裸 JSON 缺字段一律兜底、truncated 只认严格 true、
 *      warnings 非数组当空 —— 结构不对时**不编造会话**。
 *   ④ commit 编排:串行、单条失败不中断其余、进度逐条回吐、
 *      空消息会话不发请求(计失败)、失败原因原样带回。
 *   ⑤ 五语言包:词条齐备、占位符与代码调用点对得上(漏一个占位符 = 界面上出现裸 {name})。
 *   ⑥ 源码反向锁:/parse 必须走 Taro.uploadFile(不得退回 FormData —— 本端 transport
 *      对 body 做 JSON.parse,FormData 会直接抛)、不得裸拼域名。
 *
 * 夹具里的 mock 只用于切断平台依赖(Taro / 组件),不改变被测判序本身。
 */

vi.mock('@tarojs/taro', () => {
  const Taro = {
    uploadFile: vi.fn(),
    chooseMessageFile: vi.fn(),
    showToast: vi.fn(),
    navigateBack: vi.fn(),
    useDidShow: vi.fn(),
  }
  return { default: Taro, ...Taro }
})

vi.mock('@/utils/auth', () => ({ getToken: () => 'test-token' }))
vi.mock('@/utils/api-config', () => ({ BASE_URL: 'https://api.example.com/api' }))

import {
  COMMIT_FAILURE_REASON_LIMIT,
  IMPORT_SOURCES,
  MAX_IMPORT_FILE_SIZE,
  buildCommitPayload,
  findImportSource,
  hasAllowedExtension,
  normalizeParseResult,
  runImportCommit,
  summarizeFailureReasons,
  toDateLabel,
  toHistoryStatus,
  toImportSource,
  toPreviewRows,
} from '../src/pkg-ai/ai/conversation-import-core'
import {
  PARSE_TIMEOUT_MS,
  PARSE_URL,
  fileNameFromPath,
  pickImportFile,
  readParseResponse,
  uploadAndParse,
} from '../src/pkg-ai/ai/conversation-import-transport'
import Taro from '@tarojs/taro'
import type { ApiResult } from '@ihui/types'
import type { ParsedImportConversation } from '@ihui/api-client'

/* ================================================================== *
 * ① 来源目录
 * ================================================================== */

describe('① IMPORT_SOURCES —— 5 源齐备且微信源独立', () => {
  it('恰好 5 个来源,值域与后端 z.enum 一致', () => {
    expect(IMPORT_SOURCES.map((s) => s.value)).toEqual([
      'claude_code',
      'codex',
      'cursor',
      'aider',
      'wechat',
    ])
  })

  it('微信源后缀是 .zip/.txt,与其余四源的 jsonl/sqlite 家族完全不同', () => {
    expect(findImportSource('wechat')?.extensions).toEqual(['.zip', '.txt'])
  })

  it('每个来源都有 labelKey / hintKey(端内不硬编码文案,一律走 i18n)', () => {
    for (const s of IMPORT_SOURCES) {
      expect(s.labelKey).toMatch(/^conversationImport\.source/)
      expect(s.hintKey).toMatch(/^conversationImport\.source/)
    }
  })

  it('toImportSource 穷举收窄:5 个合法值收进来,未知值一律 undefined', () => {
    for (const v of ['claude_code', 'codex', 'cursor', 'aider', 'wechat']) {
      expect(toImportSource(v)).toBe(v)
    }
    // 未知来源必须判否 —— 放行就等于把用户选的文件打成一个必被 400 的请求
    for (const v of ['', 'openai', 'WECHAT', 'chatgpt', 'gemini']) {
      expect(toImportSource(v)).toBeUndefined()
    }
  })
})

/* ================================================================== *
 * ② 文件校验
 * ================================================================== */

describe('② 文件校验 —— 后缀白名单按来源分派', () => {
  it('微信源接受 .zip / .txt(大小写不敏感)', () => {
    expect(hasAllowedExtension('chat.zip', 'wechat')).toBe(true)
    expect(hasAllowedExtension('chat.ZIP', 'wechat')).toBe(true)
    expect(hasAllowedExtension('chat.txt', 'wechat')).toBe(true)
  })

  it('微信源拒绝 jsonl/sqlite —— 那是其余四源的家族,微信导出物不长那样', () => {
    expect(hasAllowedExtension('chat.jsonl', 'wechat')).toBe(false)
    expect(hasAllowedExtension('state.vscdb', 'wechat')).toBe(false)
  })

  it('cursor 源接受 .vscdb/.db/.sqlite(web accept 与 RN 白名单同口径)', () => {
    for (const n of ['state.vscdb', 'state.db', 'state.sqlite', 'a.json']) {
      expect(hasAllowedExtension(n, 'cursor')).toBe(true)
    }
  })

  it('缺文件名判否(无后缀名会被服务端以"无后缀"400 拒掉)', () => {
    expect(hasAllowedExtension(undefined, 'wechat')).toBe(false)
    expect(hasAllowedExtension('', 'wechat')).toBe(false)
  })

  it('MAX_IMPORT_FILE_SIZE = 20MiB(与 api PARSE_UPLOAD_MAX_BYTES 同档)', () => {
    expect(MAX_IMPORT_FILE_SIZE).toBe(20 * 1024 * 1024)
  })
})

/* ================================================================== *
 * ③ /parse 归一化
 * ================================================================== */

describe('③ normalizeParseResult —— 裸 JSON 兜底,不编造会话', () => {
  const conv = (title: string, n: number): ParsedImportConversation => ({
    title,
    messages: Array.from({ length: n }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    })),
  })

  it('正常响应:行数/消息数/truncated/warnings 逐项对上', () => {
    const out = normalizeParseResult({
      conversations: [conv('A', 3), conv('B', 7)],
      truncated: true,
      warnings: ['第 2 个会话有 2 条消息为空'],
    })
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0]).toMatchObject({ id: 0, title: 'A', messageCount: 3 })
    expect(out.rows[1]).toMatchObject({ id: 1, title: 'B', messageCount: 7 })
    expect(out.truncated).toBe(true)
    expect(out.warnings).toEqual(['第 2 个会话有 2 条消息为空'])
  })

  it('truncated 只认严格 true —— "truncated":"false" 这种脏值不得渲染成截断告警', () => {
    expect(normalizeParseResult({ conversations: [], truncated: 'true' }).truncated).toBe(false)
    expect(normalizeParseResult({ conversations: [], truncated: 1 }).truncated).toBe(false)
    expect(normalizeParseResult({ conversations: [], truncated: true }).truncated).toBe(true)
  })

  it('conversations 非数组(结构不对)⇒ 0 行,不编造会话', () => {
    expect(normalizeParseResult({ conversations: null }).rows).toEqual([])
    expect(normalizeParseResult({ conversations: 'nope' }).rows).toEqual([])
    expect(normalizeParseResult(null).rows).toEqual([])
    expect(normalizeParseResult(undefined).rows).toEqual([])
  })

  it('warnings 非数组 ⇒ 空数组(不得把对象渲染成 [object Object])', () => {
    expect(normalizeParseResult({ conversations: [], warnings: 'x' }).warnings).toEqual([])
  })

  it('缺 title 当空串、messages 非数组当 0 条 —— 交给 commit 侧判失败而不是在这里崩', () => {
    const rows = toPreviewRows([{ messages: [] }, { title: 'X' } as ParsedImportConversation])
    expect(rows[0]).toMatchObject({ title: '', messageCount: 0 })
    expect(rows[1]).toMatchObject({ title: 'X', messageCount: 0 })
  })

  it('id 就是数组下标 —— 提交时按它取回原始会话', () => {
    const rows = toPreviewRows([conv('A', 1), conv('B', 1), conv('C', 1)])
    expect(rows.map((r) => r.id)).toEqual([0, 1, 2])
  })
})

describe('③ toDateLabel —— 不可解析时退化而非抛 Invalid Date', () => {
  it('合法 ISO → YYYY-MM-DD', () => {
    expect(toDateLabel('2026-09-20T10:00:00.000Z')).toBe('2026-09-20')
  })
  it('脏串退化为前 10 位,空值退化为空串', () => {
    expect(toDateLabel('not-a-date-xxxxx')).toBe('not-a-date')
    expect(toDateLabel(null)).toBe('')
    expect(toDateLabel(undefined)).toBe('')
  })
})

/* ================================================================== *
 * ④ commit 编排
 * ================================================================== */

describe('④ buildCommitPayload —— 空会话不发请求', () => {
  const base = { source: 'wechat' as const, fileName: 'chat.zip' }

  it('空会话(无消息 / 全空白 content)⇒ null,交给编排层计失败', () => {
    expect(buildCommitPayload(undefined, base)).toBeNull()
    expect(buildCommitPayload({ messages: [] }, base)).toBeNull()
    expect(
      buildCommitPayload({ messages: [{ role: 'user', content: '   ' }] }, base),
    ).toBeNull()
  })

  it('过滤空消息后仍有内容 ⇒ 正常产出,并带上 fileName 与截断后的 title', () => {
    const payload = buildCommitPayload(
      {
        title: 'x'.repeat(300),
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: '  ' },
        ],
      },
      base,
    )
    expect(payload?.messages).toHaveLength(1)
    expect(payload?.title).toHaveLength(255)
    expect(payload?.fileName).toBe('chat.zip')
    expect(payload?.source).toBe('wechat')
  })

  it('不透传 model —— 该列会直接进 LLM 网关,外部工具模型 id 未必在用户目录内', () => {
    const payload = buildCommitPayload(
      { title: 'A', model: 'claude-3-opus', messages: [{ role: 'user', content: 'hi' }] },
      base,
    )
    expect(payload).not.toHaveProperty('model')
  })
})

describe('④ runImportCommit —— 失败不中断 + 进度回吐', () => {
  const convs: ParsedImportConversation[] = [
    { title: 'A', messages: [{ role: 'user', content: 'a' }] },
    { title: 'B', messages: [{ role: 'user', content: 'b' }] },
    { title: 'C', messages: [{ role: 'user', content: 'c' }] },
  ]
  const ok = (): Promise<ApiResult<unknown>> =>
    Promise.resolve({ success: true, data: { conversationId: 'x' } } as ApiResult<unknown>)

  it('全成 ⇒ imported=N、failed=0、失败原因为空', async () => {
    const out = await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [0, 1, 2],
      commit: ok,
      emptyContentReason: '空',
    })
    expect(out).toEqual({ imported: 3, failed: 0, failureReasons: [] })
  })

  it('单条 success:false 只计数,其余照常导入(不整批中止)', async () => {
    const out = await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [0, 1, 2],
      commit: async () => ({ success: false, error: '落库失败' } as ApiResult<unknown>),
      emptyContentReason: '空',
    })
    expect(out.imported).toBe(0)
    expect(out.failed).toBe(3)
    expect(out.failureReasons).toHaveLength(3)
  })

  it('抛错(网络故障)⇒ 计失败且不冒泡中断其余条目', async () => {
    const out = await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [0, 1, 2],
      commit: async () => {
        throw new Error('offline')
      },
      emptyContentReason: '空',
    })
    expect(out).toMatchObject({ imported: 0, failed: 3 })
    expect(out.failureReasons).toContain('offline')
  })

  it('混合批次:成功/失败各落各桶', async () => {
    const out = await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [0, 1, 2],
      commit: async () =>
        Math.random() < 0.5
          ? ok()
          : ({ success: false, error: 'conflict' } as ApiResult<unknown>),
      emptyContentReason: '空',
    })
    expect(out.imported + out.failed).toBe(3)
  })

  it('空消息会话不发请求,直接计失败并带上"无有效内容"原因', async () => {
    let called = 0
    const out = await runImportCommit({
      source: 'wechat',
      conversations: [{ title: '空会话', messages: [] }],
      rowIds: [0],
      commit: async () => {
        called += 1
        return ok()
      },
      emptyContentReason: '会话内没有有效内容',
    })
    expect(called).toBe(0)
    expect(out).toEqual({ imported: 0, failed: 1, failureReasons: ['会话内没有有效内容'] })
  })

  it('进度逐条回吐:先回 (0,total),再逐条 +1 收在 (total,total)', async () => {
    const calls: Array<[number, number]> = []
    await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [0, 1, 2],
      commit: ok,
      emptyContentReason: '空',
      onProgress: ({ done, total }) => calls.push([done, total]),
    })
    expect(calls).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('只提交勾选的 rowIds(不越权把未勾选的会话也落库)', async () => {
    const seen: number[] = []
    await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [1],
      commit: async (payload) => {
        seen.push(payload.title === 'B' ? 1 : 0)
        return ok()
      },
      emptyContentReason: '空',
    })
    expect(seen).toEqual([1])
  })

  it('空选择 ⇒ 不打任何请求', async () => {
    let called = 0
    const out = await runImportCommit({
      source: 'wechat',
      conversations: convs,
      rowIds: [],
      commit: async () => {
        called += 1
        return ok()
      },
      emptyContentReason: '空',
    })
    expect(called).toBe(0)
    expect(out).toEqual({ imported: 0, failed: 0, failureReasons: [] })
  })
})

describe('④ 失败原因去重 —— 不让一屏被同一条刷满', () => {
  it('同因去重并截断到 3 条,总数仍在 failed 计数里', () => {
    const reasons = summarizeFailureReasons(['a', 'a', 'a', 'b', 'c', 'd'])
    expect(reasons).toEqual(['a', 'b', 'c'])
    expect(COMMIT_FAILURE_REASON_LIMIT).toBe(3)
  })
  it('空串被剔除(不得渲染出空的 "导入失败:" 尾巴)', () => {
    expect(summarizeFailureReasons(['', 'x'])).toEqual(['x'])
  })
})

describe('④ toHistoryStatus —— 未知状态保留 unknown,不猜', () => {
  it('三态收进来,其余一律 unknown(页面据此显示服务端原文)', () => {
    expect(toHistoryStatus('success')).toBe('success')
    expect(toHistoryStatus('partial')).toBe('partial')
    expect(toHistoryStatus('failed')).toBe('failed')
    expect(toHistoryStatus('weird_status')).toBe('unknown')
    expect(toHistoryStatus('')).toBe('unknown')
  })
})

/* ================================================================== *
 * ⑥ 传输层反向锁
 * ================================================================== */

describe('⑥ readParseResponse —— 错误必须带原文,2xx 非 JSON 也不编造', () => {
  it('2xx + 合法 JSON ⇒ 原样返回裸对象', () => {
    const body = { conversations: [], truncated: false, warnings: [] }
    expect(readParseResponse({ statusCode: 200, data: JSON.stringify(body) })).toEqual(body)
  })

  it('非 2xx 且错误体是 { code, message } ⇒ 抛服务端 message 原文', () => {
    expect(() =>
      readParseResponse({
        statusCode: 413,
        data: JSON.stringify({ code: 413, message: '会话导出文件超过 20MiB 上限' }),
      }),
    ).toThrow('会话导出文件超过 20MiB 上限')
  })

  it('非 2xx 且错误体是 HTML ⇒ 退状态码(不把 HTML 糊到界面上)', () => {
    expect(() => readParseResponse({ statusCode: 502, data: '<html>bad gateway</html>' })).toThrow(
      'HTTP 502',
    )
  })

  it('2xx 但响应不是 JSON ⇒ 抛错(不得静默当空预览)', () => {
    expect(() => readParseResponse({ statusCode: 200, data: 'not json' })).toThrow(
      'parse-response-invalid',
    )
  })
})

describe('⑥ pickImportFile —— 用户取消不是错误', () => {
  it('正常返回:取第一个文件,名字/大小齐备', async () => {
    const got = await pickImportFile({
      extensions: ['.zip'],
      choose: () =>
        Promise.resolve({ tempFiles: [{ path: 'wxfile://tmp_a.zip', name: 'chat.zip', size: 12 }] }),
    })
    expect(got.error).toBeNull()
    expect(got.file).toEqual({ path: 'wxfile://tmp_a.zip', name: 'chat.zip', size: 12 })
  })

  it('无 name 时从路径末段取(必须带后缀才能过后端白名单)', async () => {
    const got = await pickImportFile({
      extensions: ['.zip'],
      choose: () => Promise.resolve({ tempFiles: [{ path: 'wxfile://tmp_abc.zip' }] }),
    })
    expect(got.file?.name).toBe('tmp_abc.zip')
  })

  it('用户取消 ⇒ error 为 null(静默返回,页面不改状态)', async () => {
    const got = await pickImportFile({
      extensions: ['.zip'],
      choose: () => Promise.reject({ errMsg: 'chooseMessageFile:fail cancel' }),
    })
    expect(got).toEqual({ file: null, error: null })
  })

  it('白名单过滤后一个都没选到 ⇒ no-file(如实报错,不冒充用户取消)', async () => {
    const got = await pickImportFile({
      extensions: ['.zip'],
      choose: () => Promise.resolve({ tempFiles: [] }),
    })
    expect(got).toEqual({ file: null, error: 'no-file' })
  })

  it('真失败(非 cancel)⇒ 带 errMsg 原文上屏(不吞、不改写成通用文案)', async () => {
    const got = await pickImportFile({
      extensions: [],
      choose: () => Promise.reject({ errMsg: 'chooseMessageFile:fail auth deny' }),
    })
    // 原样带回:用户能区分「没授权」与「文件读不到」,抹成一句"选择失败"就都没了
    expect(got.error).toBe('chooseMessageFile:fail auth deny')
  })

  it('失败且 errMsg 也缺失 ⇒ 兜一个可展示的串(不得返回 undefined 让界面渲染空白)', async () => {
    const got = await pickImportFile({
      extensions: [],
      choose: () => Promise.reject({}),
    })
    expect(got.error).toBe('choose-failed')
  })
})

describe('⑥ fileNameFromPath', () => {
  it('取末段;路径无有效段时兜一个带得住的名字', () => {
    expect(fileNameFromPath('wxfile://tmp_abc.zip')).toBe('tmp_abc.zip')
    expect(fileNameFromPath('/a/b/c.jsonl')).toBe('c.jsonl')
    expect(fileNameFromPath('')).toBe('conversation-export')
  })
})

describe('⑥ uploadAndParse —— /parse 走 uploadFile 且沿用现成 URL/鉴权方式', () => {
  it('URL 由 BASE_URL + joinUrl 拼出(合法域名白名单按 BASE_URL 配,不自己拼)', () => {
    expect(PARSE_URL).toBe('https://api.example.com/api/user/conversation-import/parse')
  })

  it('上传超时 120s —— 解析是逐行读文件的同步阻塞调用,不能套默认 30s', () => {
    expect(PARSE_TIMEOUT_MS).toBe(120_000)
  })

  it('走 Taro.uploadFile:带 Bearer 头、multipart 字段名 file、source 走 formData', async () => {
    const spy = vi
      .spyOn(Taro, 'uploadFile')
      .mockImplementation((opts: Record<string, unknown>) => {
        ;(opts.success as (r: unknown) => void)({
          statusCode: 200,
          data: JSON.stringify({ conversations: [], truncated: false, warnings: [] }),
        })
        return {} as never
      })

    await uploadAndParse({
      file: { path: 'wxfile://tmp_a.zip', name: 'chat.zip', size: 1 },
      source: 'wechat',
      networkErrorText: '加载失败',
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const arg = spy.mock.calls[0]?.[0] as Record<string, unknown>
    expect(arg.url).toBe(PARSE_URL)
    expect(arg.filePath).toBe('wxfile://tmp_a.zip')
    expect(arg.name).toBe('file')
    expect(arg.formData).toEqual({ source: 'wechat' })
    expect(arg.header).toEqual({ Authorization: 'Bearer test-token' })
    // 不手设 Content-Type:带 boundary 的头由 uploadFile 自己生成,手设会破坏分片
    expect(arg.header).not.toHaveProperty('Content-Type')
    spy.mockRestore()
  })

  it('传输失败(fail)⇒ 抛出 errMsg,不当成空预览', async () => {
    const spy = vi.spyOn(Taro, 'uploadFile').mockImplementation((opts: Record<string, unknown>) => {
      ;(opts.fail as (r: unknown) => void)({ errMsg: 'uploadFile:fail exceed max' })
      return {} as never
    })
    await expect(
      uploadAndParse({
        file: { path: 'p', name: 'a.zip', size: 1 },
        source: 'wechat',
        networkErrorText: '加载失败',
      }),
    ).rejects.toThrow('uploadFile:fail exceed max')
    spy.mockRestore()
  })
})

/* ================================================================== *
 * ⑤ 五语言包 + 源码接线反向锁
 * ================================================================== */

const LANGS = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const
const packOf = (lang: string) =>
  JSON.parse(
    readFileSync(resolve(__dirname, `../../../packages/i18n/messages/miniapp-taro/${lang}.json`), 'utf8'),
  ) as { conversationImport: Record<string, string> }

describe('⑤ 五语言包:词条齐备', () => {
  const REQUIRED = [
    'pageTitle',
    'desc',
    'sourcesTitle',
    'sourceClaudeCode',
    'sourceClaudeCodeHint',
    'sourceCodex',
    'sourceCodexHint',
    'sourceCursor',
    'sourceCursorHint',
    'sourceAider',
    'sourceAiderHint',
    'sourceWechat',
    'sourceWechatHint',
    'pickFile',
    'parse',
    'uploadHint',
    'fileSelected',
    'parsing',
    'parseFailed',
    'parseEmpty',
    'errorNoSource',
    'errorNoFile',
    'errorFileType',
    'fileTooLarge',
    'previewTitle',
    'selectAll',
    'deselectAll',
    'selected',
    'messagesCount',
    'conversationUntitled',
    'truncatedWarning',
    'commit',
    'committing',
    'commitDone',
    'commitFailed',
    'noValidContent',
    'historyTitle',
    'historyEmpty',
    'historyParsed',
    'historyImported',
    'historyFailed',
    'statusSuccess',
    'statusPartial',
    'statusFailed',
  ]

  for (const lang of LANGS) {
    it(`${lang}: 44 条词条齐备且无空值`, () => {
      const ci = packOf(lang).conversationImport
      expect(Object.keys(ci).sort()).toEqual([...REQUIRED].sort())
      for (const k of REQUIRED) {
        expect(typeof ci[k], `${lang}.${k}`).toBe('string')
        expect(ci[k]?.length, `${lang}.${k} 为空`).toBeGreaterThan(0)
      }
    })

    it(`${lang}: 带插值的词条占位符与代码调用点一致`, () => {
      const ci = packOf(lang).conversationImport
      // 占位符齐 ⇒ 界面上不会出现裸的 {name} / {count}
      expect(ci.fileSelected).toContain('{name}')
      expect(ci.selected).toContain('{count}')
      expect(ci.selected).toContain('{total}')
      expect(ci.messagesCount).toContain('{count}')
      expect(ci.committing).toContain('{done}')
      expect(ci.committing).toContain('{total}')
      expect(ci.commitDone).toContain('{imported}')
      expect(ci.commitDone).toContain('{failed}')
      expect(ci.parseFailed).toContain('{error}')
      expect(ci.commitFailed).toContain('{error}')
    })
  }

  it('微信源在每种语言里都被点名(不是只在中文里译出来)', () => {
    for (const lang of LANGS) {
      const ci = packOf(lang).conversationImport
      expect(ci.sourceWechat.length).toBeGreaterThan(0)
      expect(ci.sourceWechatHint).toMatch(/zip/i)
    }
  })
})

describe('⑥ 源码反向锁', () => {
  const src = (rel: string) => readFileSync(resolve(__dirname, '../' + rel), 'utf8')
  // 反向锁只认代码不认注释:剥离块注释与行注释,免得 JSDoc 里的说明被当成接线证据
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

  it('/parse 走 Taro.uploadFile,不得改回 FormData(本端 transport 对 body 做 JSON.parse)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import-transport.ts'))
    expect(body).toContain('Taro.uploadFile(')
    expect(body).not.toContain('new FormData')
    expect(body).not.toContain('parseConversationImport')
  })

  it('上传 URL 用 joinUrl(BASE_URL, ...) —— 不自己拼域名(合法域名白名单按 BASE_URL 配)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import-transport.ts'))
    expect(body).toContain("joinUrl(BASE_URL, '/user/conversation-import/parse')")
  })

  it('鉴权头沿用 getToken() + Bearer(与 upload-image.ts 同口径)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import-transport.ts'))
    expect(body).toContain('getToken()')
    expect(body).toContain('Authorization: `Bearer ${token}`')
  })

  it('文件选择走 chooseMessageFile(微信原生「从会话中选择文件」)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import.tsx'))
    expect(body).toContain('Taro.chooseMessageFile(')
    expect(body).toContain("type: 'file'")
    // 按来源把后缀白名单交给微信侧过滤
    expect(body).toContain('extension: [...(spec?.extensions ?? [])]')
  })

  it('commit 与 history 仍走 api-client 唯一出口(不得裸 Taro.request)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import.tsx'))
    expect(body).toContain('commitConversationImport(')
    expect(body).toContain('getConversationImportHistory(')
    expect(body).not.toContain('Taro.request')
  })

  it('截断与 warnings 必须真的渲染出来(不许只留 state 不上屏)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import-parts.tsx'))
    expect(body).toContain('truncatedWarning')
    expect(body).toContain('warnings.map(')
  })

  it('失败必须响:commit 有失败时 setError 而非只弹 toast', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import.tsx'))
    expect(body).toContain('if (outcome.failed > 0)')
    expect(body).toContain("tt('conversationImport.commitFailed'")
    expect(body).toContain('summarizeFailureReasons(outcome.failureReasons)')
  })

  it('导入完成后刷新历史列表(不刷新 = 用户看不到自己刚导的记录)', () => {
    const body = strip(src('src/pkg-ai/ai/conversation-import.tsx'))
    const start = body.indexOf('const onCommit')
    expect(start).toBeGreaterThan(0)
    expect(body.slice(start)).toContain('await loadHistory()')
  })

  it('历史页有入口,且路由与 app.config.ts 注册的一致', () => {
    const history = strip(src('src/pkg-ai/ai/history.tsx'))
    expect(history).toContain("Taro.navigateTo({ url: '/pkg-ai/ai/conversation-import' })")
    const appConfig = src('src/app.config.ts')
    expect(appConfig).toContain("'ai/conversation-import'")
  })
})
// PLACEHOLDER-TAIL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
