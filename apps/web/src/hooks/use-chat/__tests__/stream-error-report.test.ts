// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-248 / G-916415 R1 web 腿(2026-10-17 立):流失败错误上报体带帧级 traceId 的装车证明。
//
// 钉三件事:
//   ① 行为:info.traceId 存在 ⇒ 上报体 frameTraceId 带原值(逐字节相同);
//      不存在 ⇒ 上报体**没有** frameTraceId 键(缺席 = 无键,不写 undefined 污染,
//      对齐 packages/api-client/src/client.ts:2436 的纪律与镜像锁);
//   ② 白名单:SSEErrorInfo 结构化键原样携带、不整包展开原始 Error(stack 等不得出浏览器);
//   ③ 接线:send-message.ts / send-answer.ts 的 streamChat onError 必须是**代码行**真调
//      reportStreamError(buildStreamErrorReport({ message, info })) —— 只测纯函数证不出
//      "帧真的有人接"(与 d155-stream-alerts 的接线自证同一姿势)。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi, afterEach } from 'vitest'
import type { SSEErrorInfo } from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import { buildStreamErrorReport, reportStreamError } from '../stream-error-report'

// 发射面必须走端内 sanctioned 包装 @/lib/api 的 fetchApi(守门 73 禁端内裸 fetch 直连后端),
// 故这里 mock 该包装、断言它被调用(与 use-chat 其余测试同姿势)。
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (name: string): string => readFileSync(join(here, '..', name), 'utf8')

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736'

afterEach(() => {
  vi.clearAllMocks()
})

describe('G-248 R1 web 腿 ①:帧级 traceId 进错误上报体', () => {
  it('正例:流失败且 info.traceId 存在 ⇒ 上报体 frameTraceId 带该值(逐字节相同)', () => {
    const info: SSEErrorInfo = { code: 502, errorCode: 'UPSTREAM_DOWN', traceId: TRACE }
    const report = buildStreamErrorReport({ message: '上游服务异常(502)', info, route: '/chat' })
    expect(report.frameTraceId).toBe(TRACE)
    // 序列化面也要带(出网点是 JSON.stringify,不是对象引用)
    expect(JSON.stringify(report)).toContain(TRACE)
  })

  it('反例:info 无 traceId ⇒ 上报体没有 frameTraceId 键(不写 undefined 顶掉"无键")', () => {
    const info: SSEErrorInfo = { code: 429, errorCode: 'RATE_LIMITED' }
    const report = buildStreamErrorReport({ message: '请求过于频繁', info, route: '/chat' })
    expect('frameTraceId' in report).toBe(false)
    expect(report).not.toHaveProperty('frameTraceId')
    expect(JSON.stringify(report)).not.toContain('frameTraceId')
    // undefined 值键在 JSON.stringify 时也会消失,但对象面上仍算"写了键"——两条都钉
    expect(Object.keys(report)).not.toContain('frameTraceId')
  })

  it('info 缺席(旧错误路径)⇒ 只有平台三键,零可选键', () => {
    const report = buildStreamErrorReport({ message: 'boom', route: '/chat' })
    expect(Object.keys(report).sort()).toEqual(['errorMessage', 'platform', 'route'])
    expect('frameTraceId' in report).toBe(false)
  })

  it('空串 message 兜底 unknown error(服务端 zod min(1),空串会被 400 静默拒收)', () => {
    const report = buildStreamErrorReport({ message: '', route: '/chat' })
    expect(report.errorMessage).toBe('unknown error')
  })

  it('普通 message 原样保留(脱敏只动凭据/路径面,不吞正文)', () => {
    const report = buildStreamErrorReport({ message: '上游服务异常(502)', route: '/chat' })
    expect(report.errorMessage).toBe('上游服务异常(502)')
  })
})

describe('G-248 R1 web 腿 ②:SSEErrorInfo 白名单原样携带、不整包展开', () => {
  it('结构化键(code/errorCode/retryAfter/recoverable)逐键携带', () => {
    const info: SSEErrorInfo = {
      code: 429,
      errorCode: 'RATE_LIMITED',
      retryAfter: 60,
      recoverable: true,
      traceId: TRACE,
    }
    const report = buildStreamErrorReport({ message: 'rate limited', info, route: '/chat' })
    expect(report.code).toBe(429)
    expect(report.errorCode).toBe('RATE_LIMITED')
    expect(report.retryAfter).toBe(60)
    expect(report.recoverable).toBe(true)
    expect(report.frameTraceId).toBe(TRACE)
    // 白名单外的键一个都不许出现(防把原始 Error 的 stack/路径整包带出去)
    expect(Object.keys(report).sort()).toEqual([
      'code',
      'errorCode',
      'errorMessage',
      'frameTraceId',
      'platform',
      'recoverable',
      'retryAfter',
      'route',
    ])
  })

  it('可选键缺席 ⇒ 逐键省略(0 值数字也原样保留,不被 ?? 吃掉)', () => {
    const info: SSEErrorInfo = { code: 0 }
    const report = buildStreamErrorReport({ message: 'x', info, route: '/chat' })
    expect(report.code).toBe(0)
    expect('errorCode' in report).toBe(false)
    expect('retryAfter' in report).toBe(false)
    expect('recoverable' in report).toBe(false)
    expect('frameTraceId' in report).toBe(false)
  })
})

describe('G-248 R1 web 腿 ③:发射纪律(reportStreamError)', () => {
  it('浏览器态:经 fetchApi POST /api/crash-reports,body 含 frameTraceId;失败静默不抛', async () => {
    const fetchMock = vi.mocked(fetchApi)
    fetchMock.mockRejectedValue(new Error('offline'))
    const report = buildStreamErrorReport({
      message: 'upstream down',
      info: { traceId: TRACE },
      route: '/chat',
    })
    expect(() => reportStreamError(report)).not.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/crash-reports')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toContain(TRACE)
    // 让 rejected promise 的 catch 跑完,证"静默"不漏 unhandled rejection
    await Promise.resolve()
  })
})

describe('G-248 R1 web 腿 ④:消费链接线自证(任一环摘线即红)', () => {
  it('send-message.ts 的 streamChat onError 以代码行调用上报(带 info 透传)', () => {
    const src = readSrc('send-message.ts')
    expect(src).toMatch(
      /reportStreamError\(buildStreamErrorReport\(\{ message: errMsg, info \}\)\)/,
    )
    expect(src).toMatch(/onError: \(errMsg, info\) => \{/)
  })

  it('send-answer.ts 与主流对称同形', () => {
    const src = readSrc('send-answer.ts')
    expect(src).toMatch(
      /reportStreamError\(buildStreamErrorReport\(\{ message: errMsg, info \}\)\)/,
    )
    expect(src).toMatch(/onError: \(errMsg, info\) => \{/)
  })

  it('投影键名 = frameTraceId,且缺席纪律为 spread 省略(不是写 undefined)', () => {
    const src = readSrc('stream-error-report.ts')
    expect(src).toMatch(/info\?\.traceId !== undefined \? \{ frameTraceId: info\.traceId \} : \{\}/)
    // 禁止回潮成 `frameTraceId: info?.traceId`(缺席时键在、值 undefined,污染上报体)
    expect(src).not.toMatch(/frameTraceId: info\?\.traceId[,}]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
