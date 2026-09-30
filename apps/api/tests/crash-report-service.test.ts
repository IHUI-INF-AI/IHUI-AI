// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * crash-report-service 测试(2026-08-06 新增功能)。
 *
 * 覆盖:
 *  - recordCrash 成功:insert → values → returning,返回 { id }
 *  - 静默失败:db 抛错不 rethrow,返回 { id: '' } 且记 warn 日志
 *  - 字段截断:errorMessage ≤ 4000 / stack ≤ 20000 / route ≤ 512
 *  - 缺省字段 → null / 'unknown'
 *  - **落库前脱敏(2026-09-27)**:凭据/用户路径形状必被遮、普通消息与合法堆栈逐字不改坏、
 *    先脱敏再截断(跨边界的凭据不得留半截)、幂等
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockLoggerWarn, mockInsert } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: mockInsert },
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  crashReports: { id: 'crash_reports_id' },
}))

import { recordCrash } from '../src/services/crash-report-service'

describe('recordCrash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功写入返回落库 id', async () => {
    mockInsert.mockReturnValue({
      values: vi
        .fn()
        .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'crash-1' }]) }),
    })
    const result = await recordCrash({
      platform: 'ios',
      errorMessage: 'boom',
    })
    expect(result).toEqual({ id: 'crash-1' })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('db 抛错时静默失败:返回 { id: "" } 不 rethrow,记 warn 日志', async () => {
    mockInsert.mockImplementation(() => {
      throw new Error('db connection lost')
    })
    const result = await recordCrash({
      platform: 'web',
      errorMessage: 'will-fail',
    })
    expect(result).toEqual({ id: '' })
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
  })

  it('returning 无行时返回 { id: "" }', async () => {
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    })
    const result = await recordCrash({ platform: 'android', errorMessage: 'no-row' })
    expect(result).toEqual({ id: '' })
  })

  it('缺省字段落为 null,errorMessage 缺失时兜底 unknown', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-2' }]) }
      }),
    })
    await recordCrash({ platform: 'cli' } as unknown as Parameters<typeof recordCrash>[0])
    expect(captured).toMatchObject({
      version: null,
      userId: null,
      stack: null,
      route: null,
      errorMessage: 'unknown',
    })
  })

  it('字段截断:errorMessage>4000 截断、stack>20000 截断、route>512 截断', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-3' }]) }
      }),
    })
    // 填充字符刻意选 **非十六进制字母**(y/s/r,而不是旧版写的 'e'):
    // `e`.repeat(5000) 是一串 5000 个合法十六进制字符,会先被 D94 的"24 位以上十六进制串"
    // 规则整段遮成 `[REDACTED_SECRET]`(17 字符)—— 那这条断言量的就不是"截断"而是"脱敏"了。
    // 这是落库前脱敏接上后暴露的一条真实交互,记在这里免得下一个人当成 flaky 改回去。
    await recordCrash({
      platform: 'ios',
      errorMessage: 'y'.repeat(5000),
      stack: 's'.repeat(30000),
      route: 'r'.repeat(1000),
    })
    expect((captured.errorMessage as string).length).toBe(4000)
    expect((captured.stack as string).length).toBe(20000)
    expect((captured.route as string).length).toBe(512)
  })

  it('userId 与 version 显式传值时原样落库', async () => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-4' }]) }
      }),
    })
    await recordCrash({ userId: 'u-1', platform: 'desktop', version: '9.9.9', errorMessage: 'x' })
    expect(captured).toMatchObject({ userId: 'u-1', version: '9.9.9' })
  })
})

/**
 * 落库前脱敏(2026-09-27 立,凭据外泄面收口)。
 *
 * 病灶:`POST /crash-reports` 匿名可写,而它此前只有限长没有脱敏 ⇒ 错误消息/堆栈里内嵌的
 * API key、Bearer/JWT、用户机器绝对路径会明文进 `crash_reports`(保留 90 天并进 admin 面板)。
 * 权威防线只能在服务端(不可信任客户端),落点是本函数 —— 它是该表唯一写入口。
 *
 * 两臂成对(缺一臂就是"把没判写成判过了"):
 *  ① 含凭据形状必须被遮(遮的是**共享层唯一出口** redactCrashText 的既有标记形态);
 *  ② 普通业务错误消息与合法堆栈必须**逐字不被改坏**(否则崩溃排障失去价值)。
 */
describe('recordCrash / 落库前脱敏(唯一出口 redactCrashText)', () => {
  const captureValues = (): Record<string, unknown> => {
    let captured: Record<string, unknown> = {}
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((v: Record<string, unknown>) => {
        captured = v
        return { returning: vi.fn().mockResolvedValue([{ id: 'crash-r' }]) }
      }),
    })
    return {
      get: () => captured,
    }
  }

  it('① 含凭据的 message/stack 落库前被遮(明文整体消失,不是"另外加了标记")', async () => {
    const sink = captureValues()
    const secretKey = 'sk-proj-' + 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
    await recordCrash({
      platform: 'web',
      errorMessage: `上游鉴权失败 Authorization: Bearer ${secretKey}`,
      stack: [
        'Error: 上游鉴权失败',
        '    at requestVendor (/app/dist/services/vendor.js:88:15)',
        '    at readCache (C:\\Users\\Administrator\\AppData\\Local\\ihui\\chat.js:12:3)',
        '    at readCache (/c/Users/Administrator/AppData/Local/ihui/chat.js:12:3)',
      ].join('\n'),
      route: '/workspace/42',
    })
    const v = sink.get()
    const msg = String(v.errorMessage)
    const stack = String(v.stack)
    // 凭据明文整体不残留(两处都查:message 与 stack)
    expect(msg).not.toContain(secretKey)
    expect(stack).not.toContain(secretKey)
    expect(msg).toContain('[REDACTED_SECRET]')
    // 用户机器绝对路径里的用户名不残留,但路径其余部分保留(堆栈仍要能定位文件)
    expect(stack).not.toContain('Administrator')
    expect(stack).toContain('<user>')
    expect(stack).toContain('AppData/Local/ihui/chat.js')
    // 与脱敏无关的部分原样:合法栈帧 + 业务路由
    expect(stack).toContain('/app/dist/services/vendor.js:88:15')
    expect(v.route).toBe('/workspace/42')
  })

  it('①b 顺序必须是"先脱敏、再截断":跨 4000 边界的凭据不得留下半截', async () => {
    const sink = captureValues()
    // 凭据落在截断点**附近**:若先截 4000 再遮,尾巴只剩 `password=Sup`,
    // 而两条值长度门(≥8 / ≥6)都再也匹配不上半截值 ⇒ 明文前缀直接落库。
    // 前置一个空格是必须的:\b 在 `xxxpassword` 这种粘连处不成立 —— 那会让"漏"看起来像判据坏了。
    const raw = `${'y'.repeat(3985)} password=Sup3rSecretValue123`
    await recordCrash({ platform: 'web', errorMessage: raw })
    const msg = String(sink.get().errorMessage)
    expect(msg.length).toBe(4000)
    expect(msg).not.toContain('Sup3rSecretValue123')
    // 判别力:值的首字符绝不出现在 `password=` 之后(先截后遮的必然产物是 `password=Sup`)
    expect(msg).not.toMatch(/password=S/)
    // 截断点正好落在标记内部,也只能是"先遮后截"的证据(标记前缀已在 payload 里)
    expect(msg).toMatch(/password=\[REDA/)
  })

  it('② 普通业务错误消息与合法堆栈逐字不被改坏', async () => {
    const sink = captureValues()
    const message = '无法保存草稿,请检查网络后重试(共 12 项,已跳过 3 项)'
    const stack = [
      'Error: 无法保存草稿',
      '    at handleSubmit (http://localhost:8801/_next/static/chunks/app/page.js:412:19)',
      '    at HTMLDivElement.onClick (G:\\IHUI-AI\\apps\\web\\src\\components\\editor\\index.tsx:33:5)',
      '    at Array.forEach (<anonymous>)',
      '    at /app/src/pages/home/index.tsx:10:5',
    ].join('\n')
    await recordCrash({
      platform: 'web',
      errorMessage: message,
      stack,
      route: '/articles/draft',
    })
    const v = sink.get()
    expect(v.errorMessage).toBe(message)
    expect(v.stack).toBe(stack)
    expect(v.route).toBe('/articles/draft')
  })

  it('②b 脱敏是幂等的:同一份原文两次落库结果一致(不叠标记)', async () => {
    const a = captureValues()
    await recordCrash({ platform: 'web', errorMessage: 'token=abcdef123456' })
    const first = String(a.get().errorMessage)
    const b = captureValues()
    await recordCrash({ platform: 'web', errorMessage: first })
    expect(String(b.get().errorMessage)).toBe(first)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
