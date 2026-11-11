// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-36 回归:email worker 必须把 sendEmail 的 `sent:false`(非 stub)抛成 job 失败,
 * 让 BullMQ 按既有 attempts/backoff 重试并最终进 dead-letter;
 * `stub:true`(该收件人路由无任何可用通道,本地/测试的预期状态)必须保持成功,
 * 不得让本地开发队列对每封邮件无限重试。
 *
 * mock createWorker + sendEmail,不连 Redis、不真发信。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/plugins/queue.js', () => ({
  createWorker: vi.fn(),
  QUEUE_NAMES: { email: 'email' },
}))

vi.mock('../src/services/email-service.js', () => ({
  sendEmail: vi.fn(),
}))

import { startEmailWorker } from '../src/workers/email-worker.js'
import { createWorker, type EmailJobData } from '../src/plugins/queue.js'
import { sendEmail, type SendEmailResult } from '../src/services/email-service.js'

const mockedCreateWorker = vi.mocked(createWorker)
const mockedSendEmail = vi.mocked(sendEmail)

function makeServer(): FastifyInstance {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance
}

type Processor = (job: { id?: string; data: EmailJobData }) => Promise<unknown>

function getProcessor(): Processor {
  mockedCreateWorker.mockClear()
  startEmailWorker(makeServer())
  expect(mockedCreateWorker.mock.calls.length).toBe(1)
  // 队列名仍是 email
  expect(mockedCreateWorker.mock.calls[0]![1]).toBe('email')
  return mockedCreateWorker.mock.calls[0]![2] as unknown as Processor
}

const job = {
  id: 'job-42',
  data: { to: 'alice@example.com', subject: '欢迎', html: '<p>正文内容</p>' },
}

async function catchProcessorError(processor: Processor): Promise<Error | undefined> {
  try {
    await processor(job)
    return undefined
  } catch (e) {
    return e as Error
  }
}

describe('F-36 email worker 对 sent:false 的失败语义', () => {
  beforeEach(() => {
    mockedSendEmail.mockReset()
  })

  it('smtp 发送失败(sent:false, stub:false)时抛错,让 BullMQ 重试并进 dead-letter', async () => {
    mockedSendEmail.mockResolvedValue({
      sent: false,
      stub: false,
      provider: 'smtp',
      error: 'ECONNREFUSED',
    })
    const err = await catchProcessorError(getProcessor())

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toContain('jobId=job-42')
    // 收件人脱敏:只留前 2 位本地名 + 域名
    expect(err!.message).toContain('al***@example.com')
    // 完整地址与正文不得出现在错误信息里
    expect(err!.message).not.toContain('alice@example.com')
    expect(err!.message).not.toContain('<p>正文内容</p>')
  })

  it('resend 发送失败(sent:false, stub:false)同样抛错', async () => {
    mockedSendEmail.mockResolvedValue({
      sent: false,
      stub: false,
      provider: 'resend',
      error: 'resend 502: bad gateway',
    })
    const err = await catchProcessorError(getProcessor())

    expect(err).toBeInstanceOf(Error)
    expect(err!.message).toContain('provider=resend')
  })

  it('stub 模式(sent:false, stub:true)必须保持成功,不得让本地队列无限重试', async () => {
    const stubResult: SendEmailResult = {
      sent: false,
      stub: true,
      provider: 'stub',
      reasons: ['smtp_disabled'],
    }
    mockedSendEmail.mockResolvedValue(stubResult)

    await expect(getProcessor()(job)).resolves.toEqual(stubResult)
  })

  it('发送成功(sent:true)正常返回结果', async () => {
    const okResult: SendEmailResult = { sent: true, stub: false, provider: 'smtp' }
    mockedSendEmail.mockResolvedValue(okResult)

    await expect(getProcessor()(job)).resolves.toEqual(okResult)
  })
})
