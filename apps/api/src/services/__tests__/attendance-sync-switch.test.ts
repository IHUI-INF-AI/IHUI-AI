// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步总开关口径钉子(2026-11-17 立)。
 *
 * 修的是「注释/openapi 写 system_configs 的 sync:attendance:enabled,实现只读 env」这一口径矛盾:
 * - env 显式给出 ⇒ 以 env 为准(运维强制,含强制关);
 * - env 未设置 ⇒ 读 DB 键(改库即热生效,不必重启进程) —— 这正是「全自动」运维要的那条路;
 * - DB 读不到 / 读抛错 ⇒ 关(fail-closed,绝不默认开)。
 */

import { describe, expect, it, vi } from 'vitest'
import { runAttendanceSyncJob } from '../attendance-sync-job.js'
import type { AttendanceSyncRepo } from '../attendance-sync-store.js'
import type { AttendanceSyncProvider } from '../attendance-sync-providers.js'
import { ATTENDANCE_SYNC_SWITCH_KEY } from '../attendance-sync-types.js'

function makeRepo(dbValue: string | null | 'throw'): AttendanceSyncRepo {
  return {
    async findEmployeeByNo() {
      return null
    },
    async insertAttendanceIfAbsent() {
      return false
    },
    async readConfig(key) {
      if (key !== ATTENDANCE_SYNC_SWITCH_KEY) return null
      if (dbValue === 'throw') throw new Error('db down')
      return dbValue
    },
    async writeConfig() {
      /* no-op */
    },
  }
}

function provider(): AttendanceSyncProvider {
  return { id: 'dingtalk', isConfigured: () => true, pullAttendance: vi.fn(async () => []) }
}

describe('考勤同步总开关:env 与 DB 开关的优先级', () => {
  it('env 显式 true ⇒ 开(即使 DB 无值,进程强制开)', async () => {
    const r = await runAttendanceSyncJob({
      env: { HR_ATTENDANCE_SYNC_ENABLED: 'true' } as NodeJS.ProcessEnv,
      repo: makeRepo(null),
      providers: [provider()],
      loadEmployeeNos: async () => [],
      userIdMap: {},
      writeLastRun: async () => undefined,
      alert: async () => undefined,
    })
    expect(r.enabled).toBe(true)
  })

  it('env 未设置 + DB 键=true ⇒ 开(改库即热生效,不必重启进程)', async () => {
    const r = await runAttendanceSyncJob({
      env: {} as NodeJS.ProcessEnv,
      repo: makeRepo('true'),
      providers: [provider()],
      loadEmployeeNos: async () => [],
      userIdMap: {},
      writeLastRun: async () => undefined,
      alert: async () => undefined,
    })
    expect(r.enabled).toBe(true)
  })

  it('env 未设置 + DB 无该键 ⇒ 关(不猜)', async () => {
    const r = await runAttendanceSyncJob({
      env: {} as NodeJS.ProcessEnv,
      repo: makeRepo(null),
      providers: [provider()],
      loadEmployeeNos: async () => [],
      userIdMap: {},
      writeLastRun: async () => undefined,
      alert: async () => undefined,
    })
    expect(r.enabled).toBe(false)
  })

  it('env 显式 false 压过 DB=true ⇒ 关(运维强制关得住)', async () => {
    const r = await runAttendanceSyncJob({
      env: { HR_ATTENDANCE_SYNC_ENABLED: 'false' } as NodeJS.ProcessEnv,
      repo: makeRepo('true'),
      providers: [provider()],
      loadEmployeeNos: async () => [],
      userIdMap: {},
      writeLastRun: async () => undefined,
      alert: async () => undefined,
    })
    expect(r.enabled).toBe(false)
  })

  it('DB 读抛错 ⇒ 关(fail-closed,不把取不到当开)', async () => {
    const r = await runAttendanceSyncJob({
      env: {} as NodeJS.ProcessEnv,
      repo: makeRepo('throw'),
      providers: [provider()],
      loadEmployeeNos: async () => [],
      userIdMap: {},
      writeLastRun: async () => undefined,
      alert: async () => undefined,
    })
    expect(r.enabled).toBe(false)
  })

  it('DB 键写成非真值串(如 "on")⇒ 关(与 env 同一真值表,不另立口径)', async () => {
    const r = await runAttendanceSyncJob({
      env: {} as NodeJS.ProcessEnv,
      repo: makeRepo('on'),
      providers: [provider()],
      loadEmployeeNos: async () => [],
      userIdMap: {},
      writeLastRun: async () => undefined,
      alert: async () => undefined,
    })
    expect(r.enabled).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
