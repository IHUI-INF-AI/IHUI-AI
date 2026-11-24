// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-163 回归锁(2026-11-13)。
 *
 * 病灶:PUT /admin/job/run 只查存在性便返回 200 {message:'任务已触发执行'},
 * 而仓库内 sys_job 没有任何执行器订阅(sys_job 的 cron/invokeTarget 不参与调度,
 * 定时器在 src/index.ts 按固定表达式硬编码),前端据此误判任务真的跑了;
 * 且 invokeTarget / cronExpression 仅 min(1),任意串都能落库。
 *
 * 本文件锁:
 *   ① run 端点如实返回 501(执行器未接入),响应体不得出现「已触发执行 / 已触发」;
 *   ② 非法 cron(格式错 / 字段越界 / 段数不足)⇒ 400 且不写库(POST 与 PUT 同闸);
 *   ③ 白名单外 invokeTarget ⇒ 400 且不写库;
 *   ④ 合法 cron + 白名单 target ⇒ 保存路径仍正常(收紧不误伤正常写入)。
 *
 * 只 mock db 查询层,不触达真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/db/admin-sys-queries.js', () => ({
  findJobList: vi.fn(),
  findJobById: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  updateJobStatus: vi.fn(),
  deleteJobsBatch: vi.fn(),
}))

import { findJobById, createJob, updateJob } from '../src/db/admin-sys-queries.js'
import { jobRoutes, JOB_INVOKE_TARGETS } from '../src/routes/admin-sys/job-routes.js'

const VALID_TARGET = 'ops-retention-cleanup'
const VALID_CRON = '30 5 * * *'

describe('F-163 定时任务:run 如实报错 + cron/invokeTarget 入口收紧', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(jobRoutes, { prefix: '/job' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.mocked(findJobById).mockReset()
    vi.mocked(createJob).mockReset()
    vi.mocked(updateJob).mockReset()
  })

  it('① run 返回 501,且不出现「已触发执行」假成功文案', async () => {
    // 只要任务存在,旧代码就会回 200 + 「任务已触发执行」;新口径必须如实 501
    vi.mocked(findJobById).mockResolvedValue({
      jobId: 7,
      jobName: '夜间清理',
      invokeTarget: VALID_TARGET,
      cronExpression: VALID_CRON,
    } as never)

    const res = await app.inject({ method: 'PUT', url: '/job/run', payload: { jobId: 7 } })

    expect(res.statusCode).toBe(501)
    expect(res.body).not.toContain('已触发')
    expect(res.body).not.toContain('已执行')
    const body = res.json() as { message?: string }
    expect(body.message).toContain('执行器尚未接入')
    expect(vi.mocked(findJobById)).toHaveBeenCalledWith(7)
  })

  it('② 非法 cron ⇒ 400 且不写库(POST 不 insert、PUT 不 update)', async () => {
    // 格式错 / 分钟越界(61)/ 段数不足(* * *)
    for (const bad of ['not-a-cron', '61 * * * *', '* * *']) {
      const res = await app.inject({
        method: 'POST',
        url: '/job',
        payload: { jobName: '坏 cron', invokeTarget: VALID_TARGET, cronExpression: bad },
      })
      expect(res.statusCode).toBe(400)
    }
    expect(vi.mocked(createJob)).not.toHaveBeenCalled()

    const putRes = await app.inject({
      method: 'PUT',
      url: '/job',
      payload: {
        jobId: 7,
        jobName: '坏 cron',
        invokeTarget: VALID_TARGET,
        cronExpression: 'not-a-cron',
      },
    })
    expect(putRes.statusCode).toBe(400)
    expect(vi.mocked(updateJob)).not.toHaveBeenCalled()
  })

  it('③ 白名单外 invokeTarget ⇒ 400 且不写库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/job',
      payload: {
        jobName: '任意调用面',
        invokeTarget: 'evil.target(1)',
        cronExpression: VALID_CRON,
      },
    })
    expect(res.statusCode).toBe(400)
    expect(vi.mocked(createJob)).not.toHaveBeenCalled()

    const putRes = await app.inject({
      method: 'PUT',
      url: '/job',
      payload: {
        jobId: 7,
        jobName: '任意调用面',
        invokeTarget: 'evil.target(1)',
        cronExpression: VALID_CRON,
      },
    })
    expect(putRes.statusCode).toBe(400)
    expect(vi.mocked(updateJob)).not.toHaveBeenCalled()
  })

  it('④ 合法 cron + 白名单 target 仍可正常保存', async () => {
    expect(JOB_INVOKE_TARGETS).toContain(VALID_TARGET)
    vi.mocked(createJob).mockResolvedValue({ jobId: 9 } as never)

    const res = await app.inject({
      method: 'POST',
      url: '/job',
      payload: { jobName: '夜间清理', invokeTarget: VALID_TARGET, cronExpression: VALID_CRON },
    })

    expect(res.statusCode).toBe(200)
    expect(vi.mocked(createJob)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createJob).mock.calls[0]?.[0]).toMatchObject({
      jobName: '夜间清理',
      invokeTarget: VALID_TARGET,
      cronExpression: VALID_CRON,
    })
  })
})
