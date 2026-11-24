// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤 IM 同步(RP-15/16/17)的命门回归:
 * 1) 未知平台枚举不猜,原样保留;
 * 2) 同一批重复拉取幂等(第二次全记 duplicates);
 * 3) 凭证/scope 缺失时 provider 跳过,不发请求、不抛错、不告警;
 * 4) 未知枚举在列宽允许时原样落库。
 */
import { describe, expect, it, vi } from 'vitest'
import {
  classifyApprovalKind,
  isAttendanceSyncEnabled,
  mapAttendanceStatus,
  mapLeaveType,
  type AttendanceSyncRunResult,
  type NormalizedAttendanceRecord,
} from '../attendance-sync-types.js'
import {
  persistAttendanceRecords,
  resolveAttendanceStatus,
  type AttendanceInsertRow,
  type AttendanceSyncRepo,
} from '../attendance-sync-store.js'
import { runAttendanceSyncJob } from '../attendance-sync-job.js'
import type { AttendanceSyncProvider } from '../attendance-sync-providers.js'

function makeRepo(): AttendanceSyncRepo & { rows: Map<string, AttendanceInsertRow> } {
  const rows = new Map<string, AttendanceInsertRow>()
  return {
    rows,
    async findEmployeeByNo(employeeNo) {
      return employeeNo === 'E001' ? { id: 'emp-1', departmentId: 'dept-1' } : null
    },
    async insertAttendanceIfAbsent(row) {
      const key = `${row.employeeId}|${row.departmentId}|${row.date}`
      if (rows.has(key)) return false
      rows.set(key, row)
      return true
    },
    async readConfig() {
      return null
    },
    async writeConfig() {
      /* no-op */
    },
  }
}

function record(overrides: Partial<NormalizedAttendanceRecord> = {}): NormalizedAttendanceRecord {
  return {
    provider: 'dingtalk',
    employeeNo: 'E001',
    date: '2026-11-13',
    checkInTime: new Date('2026-11-13T01:00:00.000Z'),
    checkOutTime: new Date('2026-11-13T10:00:00.000Z'),
    statusRaw: 'Normal',
    externalId: 'u1:2026-11-13',
    ...overrides,
  }
}

function fakeProvider(
  id: 'feishu' | 'dingtalk',
  configured: boolean,
  records: NormalizedAttendanceRecord[],
): AttendanceSyncProvider & { pullAttendance: ReturnType<typeof vi.fn> } {
  return {
    id,
    isConfigured: () => configured,
    pullAttendance: vi.fn(async () => records),
  }
}

const noop = async (): Promise<void> => undefined

describe('考勤同步枚举映射(未知值不猜)', () => {
  it('钉钉已核实值正常映射', () => {
    expect(mapAttendanceStatus('dingtalk', 'Normal')).toMatchObject({
      system: 'present',
      known: true,
    })
    expect(mapAttendanceStatus('dingtalk', 'Late')).toMatchObject({ system: 'late', known: true })
    expect(mapAttendanceStatus('dingtalk', 'Early')).toMatchObject({ system: 'early', known: true })
    expect(mapAttendanceStatus('dingtalk', 'NotSigned')).toMatchObject({
      system: 'absent',
      known: true,
    })
  })

  it('未知打卡状态保留原始枚举,不猜成 present', () => {
    const mapped = mapAttendanceStatus('feishu', 'VacationLeave')
    expect(mapped.system).toBeNull()
    expect(mapped.raw).toBe('VacationLeave')
    expect(mapped.known).toBe(false)
  })

  it('未知假别/审批类型保留原始枚举', () => {
    expect(mapLeaveType('育儿假')).toEqual({ system: null, raw: '育儿假', known: false })
    expect(mapLeaveType('annual')).toMatchObject({ system: 'annual', known: true })
    expect(classifyApprovalKind('自定义审批')).toEqual({
      kind: null,
      raw: '自定义审批',
      known: false,
    })
  })
})

describe('落库幂等与未知枚举原样落库', () => {
  it('同一批重复落库不产生重复行', async () => {
    const repo = makeRepo()
    const first = await persistAttendanceRecords([record()], repo)
    const second = await persistAttendanceRecords([record()], repo)

    expect(first).toMatchObject({ inserted: 1, duplicates: 0, employeeNotFound: 0 })
    expect(second).toMatchObject({ inserted: 0, duplicates: 1, employeeNotFound: 0 })
    expect(repo.rows.size).toBe(1)
  })

  it('未知枚举在列宽允许时原样写入 status 并保留在 remark', async () => {
    const repo = makeRepo()
    const unknown = record({ statusRaw: 'VacationLeave' })
    expect(resolveAttendanceStatus(unknown)).toEqual({ status: 'VacationLeave', reason: null })

    const result = await persistAttendanceRecords([unknown], repo)
    expect(result.inserted).toBe(1)
    const saved = [...repo.rows.values()][0]
    expect(saved?.status).toBe('VacationLeave')
    expect(saved?.remark).toContain('statusRaw=VacationLeave')
  })

  it('未知枚举超出 varchar(20) 时判 invalid,不截断冒充', async () => {
    const repo = makeRepo()
    const longRaw = 'X'.repeat(21)
    const result = await persistAttendanceRecords([record({ statusRaw: longRaw })], repo)
    expect(result).toMatchObject({ inserted: 0, invalidRows: 1 })
  })

  it('未知枚举恰好 20 字符(列宽上限)仍原样落库', async () => {
    const repo = makeRepo()
    const raw = 'X'.repeat(20)
    const result = await persistAttendanceRecords([record({ statusRaw: raw })], repo)
    expect(result).toMatchObject({ inserted: 1, invalidRows: 0 })
    expect([...repo.rows.values()][0]?.status).toBe(raw)
  })
})

describe('job 的降级与告警', () => {
  it('凭证/scope 缺失:provider 跳过,不发请求、不报错、不告警', async () => {
    const provider = fakeProvider('feishu', false, [record({ provider: 'feishu' })])
    const alert = vi.fn(noop)
    const result = await runAttendanceSyncJob({
      enabled: true,
      date: '2026-11-13',
      env: {},
      providers: [provider],
      repo: makeRepo(),
      loadEmployeeNos: async () => ['E001'],
      writeLastRun: noop,
      alert,
    })

    expect(provider.pullAttendance).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      enabled: true,
      attempted: 0,
      skippedNotConfigured: 1,
      errors: [],
    })
    expect(alert).not.toHaveBeenCalled()
  })

  it('总开关关闭时空跑,不发起任何请求', async () => {
    const provider = fakeProvider('feishu', true, [])
    const result = await runAttendanceSyncJob({
      enabled: false,
      env: {},
      providers: [provider],
      repo: makeRepo(),
      writeLastRun: noop,
      alert: noop,
    })

    expect(provider.pullAttendance).not.toHaveBeenCalled()
    expect(result.enabled).toBe(false)
    expect(result.attempted).toBe(0)
  })

  it('未设 HR_ATTENDANCE_SYNC_ENABLED 时默认关闭,即便已配置 provider 也不外呼', async () => {
    const provider = fakeProvider('feishu', true, [])
    const result = await runAttendanceSyncJob({
      env: {},
      providers: [provider],
      repo: makeRepo(),
      writeLastRun: noop,
      alert: noop,
    })

    expect(isAttendanceSyncEnabled({})).toBe(false)
    expect(result.enabled).toBe(false)
    expect(provider.pullAttendance).not.toHaveBeenCalled()
    expect(result.errors).toEqual([])
  })

  it('仅显式 1/true/yes 才开启总开关', () => {
    expect(isAttendanceSyncEnabled({ HR_ATTENDANCE_SYNC_ENABLED: ' TRUE ' })).toBe(true)
    expect(isAttendanceSyncEnabled({ HR_ATTENDANCE_SYNC_ENABLED: '1' })).toBe(true)
    expect(isAttendanceSyncEnabled({ HR_ATTENDANCE_SYNC_ENABLED: 'yes' })).toBe(true)
    expect(isAttendanceSyncEnabled({ HR_ATTENDANCE_SYNC_ENABLED: 'on' })).toBe(false)
  })

  it('开启且已配置:拉取并幂等落库,重复运行不新增', async () => {
    const repo = makeRepo()
    const provider = fakeProvider('dingtalk', true, [record()])
    const options = {
      enabled: true,
      date: '2026-11-13',
      env: {},
      providers: [provider],
      repo,
      loadEmployeeNos: async () => ['E001'],
      userIdMap: { E001: 'u1' },
      writeLastRun: noop,
      alert: noop,
    }

    const first: AttendanceSyncRunResult = await runAttendanceSyncJob(options)
    const second = await runAttendanceSyncJob(options)

    expect(first).toMatchObject({ attempted: 1, syncedRows: 1, duplicates: 0, errors: [] })
    expect(second).toMatchObject({ attempted: 1, syncedRows: 0, duplicates: 1, errors: [] })
    expect(repo.rows.size).toBe(1)
  })

  it('provider 抛错进 errors 并触发告警', async () => {
    const provider: AttendanceSyncProvider = {
      id: 'feishu',
      isConfigured: () => true,
      pullAttendance: async () => {
        throw new Error('scope missing: attendance:read')
      },
    }
    const alert = vi.fn(noop)
    const result = await runAttendanceSyncJob({
      enabled: true,
      date: '2026-11-13',
      env: {},
      providers: [provider],
      repo: makeRepo(),
      loadEmployeeNos: async () => ['E001'],
      writeLastRun: noop,
      alert,
    })

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.provider).toBe('feishu')
    expect(alert).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
