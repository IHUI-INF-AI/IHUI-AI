// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-511 回归锁(2026-11-13)。
 *
 * 病灶:notification-worker 的邮件出口失败被 catch 吞成 `log.warn`,job 仍记 completed
 * ⇒ 通知静默丢失、队列 attempts:3 完全空转。
 *
 * 本文件锁:
 *   ① 发送抛错 ⇒ processor 抛错(BullMQ 记 failed 可重试),且 error 日志含通知 id 与原因;
 *   ② 发送返回 sent:false(stub:false)⇒ 同样抛错,不再记 completed;
 *   ③ 发送成功 ⇒ 正常 completed,返回结构仍是 { notificationId };
 *   ④ 已发成功的同一 job 重投 ⇒ 跳过发送并记 info(不重复打扰收件人);
 *   ⑤ 附加边界:stub(收件路由无可用通道)保持不重试语义,不抛错。
 *
 * 不连 DB/Redis/BullMQ:队列、落库、邮件服务、模板全部 mock。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/plugins/queue.js', () => ({
  createWorker: vi.fn(),
  QUEUE_NAMES: { notification: 'notification' },
}))

vi.mock('../src/db/notification-queries.js', () => ({
  createNotification: vi.fn(),
}))

vi.mock('../src/services/email-service.js', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('../src/services/email-templates.js', () => ({
  renderNoticeEmail: vi.fn(() => ({ subject: '通知标题', html: '<p>正文</p>', text: '正文' })),
  renderSystemAlertEmail: vi.fn(() => ({ subject: '告警标题', html: '<p>告警</p>', text: '告警' })),
}))

import { createWorker } from '../src/plugins/queue.js'
import { createNotification } from '../src/db/notification-queries.js'
import { sendEmail } from '../src/services/email-service.js'
import { startNotificationWorker } from '../src/workers/notification-worker.js'

interface TestJob {
  id?: string
  data: {
    userId: string
    type: string
    title: string
    content: string
    email?: string
    userName?: string
  }
}

type Processor = (job: TestJob) => Promise<{ notificationId: string }>

function makeJob(jobId: string): TestJob {
  return {
    id: jobId,
    data: {
      userId: 'user-1',
      type: 'system',
      title: '系统通知',
      content: '通知正文',
      email: 'alice@example.com',
      userName: 'Alice',
    },
  }
}

function bootWorker(): {
  processor: Processor
  log: {
    info: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }
  pushNotification: ReturnType<typeof vi.fn>
} {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const pushNotification = vi.fn()
  const server = { log, pushNotification } as unknown as FastifyInstance
  const mockedCreateWorker = vi.mocked(createWorker)
  mockedCreateWorker.mockClear()
  startNotificationWorker(server)
  expect(mockedCreateWorker).toHaveBeenCalledTimes(1)
  const processor = mockedCreateWorker.mock.calls[0]![2] as unknown as Processor
  return { processor, log, pushNotification }
}

/** 发送结果构造器(判据只看 sent/stub/error,provider/reasons 仅为形状完整)。 */
function emailResult(overrides: Record<string, unknown>) {
  return { sent: false, stub: false, provider: 'smtp', ...overrides }
}

describe('F-511 notification-worker 邮件出口失败必须可重试', () => {
  let seq = 0

  beforeEach(() => {
    vi.clearAllMocks()
    seq = 0
    vi.mocked(createNotification).mockImplementation(async (input) => {
      seq += 1
      return { id: `notif-${seq}`, ...input } as never
    })
  })

  it('① 发送抛错 ⇒ processor 抛错(job 可重试),error 日志含通知 id 与原因', async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:587'))
    const { processor, log } = bootWorker()

    await expect(processor(makeJob('f511-throw-1'))).rejects.toThrow(
      /notification email failed.*channel=email/,
    )

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(log.error).toHaveBeenCalledTimes(1)
    const [fields, message] = log.error.mock.calls[0] as [Record<string, unknown>, string]
    expect(message).toBe('notification email failed')
    expect(fields).toMatchObject({
      channel: 'email',
      notificationId: 'notif-1',
      reason: 'connect ECONNREFUSED 127.0.0.1:587',
    })
    // 失败绝不能被记成 completed
    expect(log.info).not.toHaveBeenCalledWith(expect.anything(), 'notification job processed')
  })

  it('② 发送返回 sent:false(stub:false)⇒ 抛错,不记 completed', async () => {
    vi.mocked(sendEmail).mockResolvedValue(
      emailResult({ provider: 'resend', error: 'resend 502: bad gateway' }) as never,
    )
    const { processor, log } = bootWorker()

    await expect(processor(makeJob('f511-unsent-1'))).rejects.toThrow(/resend 502: bad gateway/)

    expect(log.error).toHaveBeenCalledTimes(1)
    const [fields] = log.error.mock.calls[0] as [Record<string, unknown>, string]
    expect(fields).toMatchObject({
      channel: 'email',
      notificationId: 'notif-1',
      provider: 'resend',
      reason: 'resend 502: bad gateway',
    })
    expect(log.info).not.toHaveBeenCalledWith(expect.anything(), 'notification job processed')
  })

  it('③ 发送成功 ⇒ completed,返回结构保持 { notificationId }', async () => {
    vi.mocked(sendEmail).mockResolvedValue(emailResult({ sent: true }) as never)
    const { processor, log, pushNotification } = bootWorker()

    await expect(processor(makeJob('f511-ok-1'))).resolves.toEqual({ notificationId: 'notif-1' })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(log.error).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'f511-ok-1', userId: 'user-1' }),
      'notification job processed',
    )
    expect(pushNotification).toHaveBeenCalledTimes(1)
  })

  it('④ 已发成功的同一 job 重投 ⇒ 不重复发送,并记 info', async () => {
    vi.mocked(sendEmail).mockResolvedValue(emailResult({ sent: true }) as never)
    const { processor, log } = bootWorker()
    const job = makeJob('f511-dup-1')

    await processor(job)
    await processor(job)

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email' }),
      'notification email already sent, skip',
    )
  })

  it('⑤ stub(该路由无可用通道)保持不重试:不抛错', async () => {
    vi.mocked(sendEmail).mockResolvedValue(
      emailResult({ stub: true, provider: 'stub', reasons: ['smtp_disabled'] }) as never,
    )
    const { processor, log } = bootWorker()

    await expect(processor(makeJob('f511-stub-1'))).resolves.toEqual({ notificationId: 'notif-1' })
    expect(log.error).not.toHaveBeenCalled()
  })
})
