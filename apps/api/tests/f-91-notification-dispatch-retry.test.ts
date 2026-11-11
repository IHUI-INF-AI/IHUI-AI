// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-91 回归:notification-dispatch-worker 曾把邮件/短信失败吞成 `status='failed'` 后
 * 正常 return ⇒ BullMQ 记 job 成功,队列默认的 attempts=3 + exponential backoff
 * 形同虚设,故障期通知永久丢失且不进 failed 集。
 *
 * 本文件钉死修后的处置口径:
 * - 可重试错误(网络/超时/限流/5xx)必须 throw,且 throw 前已完成 notification_logs 落库;
 * - 不可重试错误(配置缺失、401/403、收件人非法、模板错误)落终态、正常 return;
 * - 判不出来的文本按最坏情况 retry(保守)。
 *
 * 不连 DB/Redis/BullMQ:db、queue、email-service、sms 全部 mock;核心逻辑走
 * `processDispatchJob` 的依赖注入,默认路径另有一条冒烟用例(createWorker 捕获 processor)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/plugins/queue.js', () => ({
  createWorker: vi.fn(),
  QUEUE_NAMES: { notificationDispatch: 'notification-dispatch' },
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
}))

vi.mock('../src/services/email-service.js', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('../src/services/sms.js', () => ({
  sendSmsMessage: vi.fn(),
}))

vi.mock('../src/services/email-templates.js', () => ({
  renderNoticeEmail: vi.fn(() => ({ subject: '通知标题', html: '<p>正文</p>', text: '正文' })),
}))

import {
  classifyDispatchError,
  processDispatchJob,
  startNotificationDispatchWorker,
  type DispatchDeps,
  type DispatchLogRow,
} from '../src/workers/notification-dispatch-worker.js'
import { createWorker } from '../src/plugins/queue.js'
import { sendEmail } from '../src/services/email-service.js'
import { db } from '../src/db/index.js'

interface JobData {
  userId: string
  channel: 'email' | 'sms'
  email: string | null
  phone: string | null
  nickname: string | null
  title: string
  content: string
  msgType: string
}

const emailJob: { id: string; data: JobData } = {
  id: 'job-email-1',
  data: {
    userId: '11111111-1111-1111-1111-111111111111',
    channel: 'email',
    email: 'alice@example.com',
    phone: null,
    nickname: 'Alice',
    title: '通知标题',
    content: '通知正文',
    msgType: 'system',
  },
}

const smsJob: { id: string; data: JobData } = {
  id: 'job-sms-1',
  data: {
    userId: '22222222-2222-2222-2222-222222222222',
    channel: 'sms',
    email: null,
    phone: '13800000000',
    nickname: null,
    title: '通知标题',
    content: '通知正文',
    msgType: 'system',
  },
}

type SendEmailImpl = DispatchDeps['sendEmail']
type SendSmsImpl = DispatchDeps['sendSmsMessage']

function emailResult(overrides: Record<string, unknown>): Awaited<ReturnType<SendEmailImpl>> {
  return { sent: false, stub: false, provider: 'smtp', ...overrides } as Awaited<
    ReturnType<SendEmailImpl>
  >
}

function smsResult(overrides: Record<string, unknown>): Awaited<ReturnType<SendSmsImpl>> {
  return { success: false, ...overrides } as Awaited<ReturnType<SendSmsImpl>>
}

interface TestDeps extends DispatchDeps {
  rows: DispatchLogRow[]
}

function makeDeps(options: {
  email?: SendEmailImpl
  sms?: SendSmsImpl
  insertLog?: (row: DispatchLogRow) => Promise<void>
  onLogError?: DispatchDeps['onLogError']
}): TestDeps {
  const rows: DispatchLogRow[] = []
  return {
    rows,
    sendEmail: options.email ?? (vi.fn() as unknown as SendEmailImpl),
    sendSmsMessage: options.sms ?? (vi.fn() as unknown as SendSmsImpl),
    insertLog:
      options.insertLog ??
      (async (row) => {
        rows.push(row)
      }),
    onLogError: options.onLogError,
  }
}

describe('F-91 classifyDispatchError:可重试 vs 终态', () => {
  it.each([
    ['connect ECONNREFUSED 127.0.0.1:587'],
    ['ETIMEDOUT'],
    ['socket hang up'],
    ['resend 502: bad gateway'],
    ['429 Too Many Requests'],
    ['proxy_http_503'],
    ['aliyun_call_failed:RequestTimeout'],
    ['rate_limited'],
  ])('可重试错误 %s ⇒ retry', (message) => {
    expect(classifyDispatchError(message)).toBe('retry')
  })

  it.each([
    ['invalid email: alice@example.com'],
    ['invalid phone'],
    ['401 Unauthorized'],
    ['403 Forbidden'],
    ['resend 403: domain not verified'],
    ['缺少 SMTP 配置'],
    ['smtp not configured'],
    ['not_configured: 未配置 ALI_SMS_NOTIFY_TEMPLATE_CODE'],
    ['invalid template key: notice/foo'],
  ])('不可重试错误 %s ⇒ fatal', (message) => {
    expect(classifyDispatchError(message)).toBe('fatal')
  })

  it('未知文本 / 空文本按最坏情况 retry(保守)', () => {
    expect(classifyDispatchError('something weird happened')).toBe('retry')
    expect(classifyDispatchError('')).toBe('retry')
    expect(classifyDispatchError(null)).toBe('retry')
    expect(classifyDispatchError(undefined)).toBe('retry')
  })
})

describe('F-91 processDispatchJob:失败分类与日志落库', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('邮件成功 ⇒ 正常返回 sent,日志为 sent 且无 error', async () => {
    const deps = makeDeps({ email: async () => emailResult({ sent: true, provider: 'smtp' }) })

    const result = await processDispatchJob(emailJob, deps)

    expect(result).toEqual({
      userId: emailJob.data.userId,
      channel: 'email',
      status: 'sent',
    })
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ status: 'sent', errorMessage: null, channel: 'email' })
  })

  it('邮件可重试失败(ECONNREFUSED)⇒ 先落 failed 日志再抛错', async () => {
    const events: string[] = []
    const deps = makeDeps({
      email: async () => {
        events.push('send')
        return emailResult({ error: 'connect ECONNREFUSED 127.0.0.1:587' })
      },
      insertLog: async (row) => {
        events.push('log')
        deps.rows.push(row)
      },
    })

    await expect(processDispatchJob(emailJob, deps)).rejects.toThrow(/retryable/)

    expect(events).toEqual(['send', 'log'])
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ status: 'failed', channel: 'email' })
    expect(deps.rows[0]!.errorMessage).toBe('retry: connect ECONNREFUSED 127.0.0.1:587')
  })

  it('邮件不可重试失败(invalid email)⇒ 落终态 failed,不抛错', async () => {
    const deps = makeDeps({
      email: async () => emailResult({ error: 'invalid email: alice@example.com' }),
    })

    const result = await processDispatchJob(emailJob, deps)

    expect(result.status).toBe('failed')
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ status: 'failed' })
    expect(deps.rows[0]!.errorMessage).toBe('fatal: invalid email: alice@example.com')
  })

  it('stub(该路由无可用通道)保持成功语义:不重试、不抛错', async () => {
    const deps = makeDeps({
      email: async () =>
        emailResult({ sent: false, stub: true, provider: 'stub', reasons: ['smtp_disabled'] }),
    })

    const result = await processDispatchJob(emailJob, deps)

    expect(result.status).toBe('stub')
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ status: 'stub', errorMessage: null })
  })

  it('sendEmail 抛异常(ETIMEDOUT)⇒ 落 failed 日志后仍抛错', async () => {
    const deps = makeDeps({
      email: async () => {
        throw new Error('ETIMEDOUT')
      },
    })

    await expect(processDispatchJob(emailJob, deps)).rejects.toThrow(/retryable/)

    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ status: 'failed' })
    expect(deps.rows[0]!.errorMessage).toBe('retry: ETIMEDOUT')
  })

  it('短信可重试失败(proxy_http_502)⇒ 抛错交给 BullMQ 重试', async () => {
    const deps = makeDeps({ sms: async () => smsResult({ error: 'proxy_http_502' }) })

    await expect(processDispatchJob(smsJob, deps)).rejects.toThrow(/channel=sms/)

    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ status: 'failed', channel: 'sms' })
    expect(deps.rows[0]!.errorMessage).toBe('retry: proxy_http_502')
  })

  it('短信不可重试失败(invalid phone)⇒ 落终态,不抛错', async () => {
    const deps = makeDeps({ sms: async () => smsResult({ error: 'invalid phone' }) })

    const result = await processDispatchJob(smsJob, deps)

    expect(result.status).toBe('failed')
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]!.errorMessage).toBe('fatal: invalid phone')
  })

  it('日志写失败不影响处置:可重试失败仍然抛错,并回调 onLogError', async () => {
    const onLogError = vi.fn()
    const deps = makeDeps({
      email: async () => emailResult({ error: 'socket hang up' }),
      insertLog: async () => {
        throw new Error('db down')
      },
      onLogError,
    })

    await expect(processDispatchJob(emailJob, deps)).rejects.toThrow(/retryable/)

    expect(onLogError).toHaveBeenCalledTimes(1)
  })

  it('日志写失败 + 终态失败 ⇒ 不抛错(不把 DB 抖动升级成队列重试)', async () => {
    const onLogError = vi.fn()
    const deps = makeDeps({
      email: async () => emailResult({ error: 'invalid email' }),
      insertLog: async () => {
        throw new Error('db down')
      },
      onLogError,
    })

    await expect(processDispatchJob(emailJob, deps)).resolves.toMatchObject({ status: 'failed' })
    expect(onLogError).toHaveBeenCalledTimes(1)
  })
})

describe('F-91 默认 worker 路径使用同一套分类判据', () => {
  it('createWorker 的 processor 对可重试失败抛错,并写入 notification_logs', async () => {
    const mockedCreateWorker = vi.mocked(createWorker)
    const mockedSendEmail = vi.mocked(sendEmail)
    mockedCreateWorker.mockClear()
    mockedSendEmail.mockReset()
    mockedSendEmail.mockResolvedValue(
      emailResult({ error: 'connect ECONNREFUSED 127.0.0.1:587' }) as never,
    )
    const executeMock = db.execute as unknown as { mockResolvedValue: (v: unknown) => void }
    executeMock.mockResolvedValue(undefined)

    const server = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as unknown as FastifyInstance

    startNotificationDispatchWorker(server)

    expect(mockedCreateWorker).toHaveBeenCalledTimes(1)
    const processor = mockedCreateWorker.mock.calls[0]![2] as (
      job: typeof emailJob,
    ) => Promise<unknown>

    await expect(processor(emailJob)).rejects.toThrow(/retryable/)
    expect(db.execute).toHaveBeenCalledTimes(1)
    expect(depsLogInsertedViaSql()).toBe(true)
  })
})

/** 只断言 INSERT 曾执行(真实 SQL 文本由 db.execute 接住,mock 不解析)。 */
function depsLogInsertedViaSql(): boolean {
  return vi.mocked(db.execute).mock.calls.length === 1
}
