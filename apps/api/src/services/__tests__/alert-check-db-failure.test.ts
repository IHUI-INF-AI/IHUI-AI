// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-43:告警检查自身的 DB 查询失败必须让任务判失败(不能记 success)。
 *
 * 立因(2026-11-08 静态取证):两处 audit_logs 聚合一抛错,旧实现只塞进 `errors`,
 * `escalated` 不读它、worker 也从不读 `result.errors` ⇒「没判到」被写成「判过且 0 条」。
 *
 * 夹具:备份链目录用 fresh 文件打桩(保证 escalated 的唯一触发源就是 DB 异常),
 * DB select 直接抛错 → 断言 errors 非空、escalated=1、任务状态 failed。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn(() => {
      throw new Error('audit_logs 查询失败')
    }),
  },
}))

// 备份链改为「新鲜且非空」:issues / undetermined 都为空,排除它们对 escalated 的干扰。
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(async () => ['ihui_dev_20261108.dump', 'keycloak_20261108.dump']),
  stat: vi.fn(async () => ({ size: 1024, mtimeMs: Date.now() })),
}))

import { checkDailyAlerts, alertCheckJobStatus } from '../alert-check-service.js'

describe('SDB-43 告警检查自身 DB 失败', () => {
  it('DB 抛错 ⇒ errors 非空、escalated=1、任务判 failed', async () => {
    const result = await checkDailyAlerts()

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.join('\n')).toContain('audit_logs 查询失败')
    expect(result.checked).toBe(0)
    expect(result.resolved).toBe(0)
    // 前置判据:备份链本身没有报问题,escalated 只能由 DB 异常触发
    expect(result.backupIssues).toHaveLength(0)
    expect(result.backupUndetermined).toHaveLength(0)
    expect(result.escalated).toBe(1)
    expect(alertCheckJobStatus(result)).toBe('failed')
  })

  it('无 errors 时任务仍记 success(不把正常巡检误判为失败)', async () => {
    expect(alertCheckJobStatus({ errors: [] })).toBe('success')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
