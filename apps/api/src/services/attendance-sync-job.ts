// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 飞书/钉钉考勤同步 job(2026-11-14 立,RP-15/16/17)。
 *
 * 安全闸:
 * - 默认关闭,只有 env `HR_ATTENDANCE_SYNC_ENABLED=true|1|yes` 才发起平台请求;
 * - 凭证/scope 缺失时 provider 直接跳过,不抛错、不阻断进程启动;
 * - 落库为幂等插入(不覆盖已有考勤),未知枚举原样落库;
 * - 任何 HTTP/DB 失败进 errors,并通过 pushAlert 告警。
 */

import { capAlertMessage, flattenUntrustedText } from '../utils/alert-text.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import type { SchedulerRegisterLog, SchedulerUpsertQueue } from '../plugins/scheduler.js'
import { pushAlert } from './alert-notification-service.js'
import {
  HR_ATTENDANCE_SYNC_CRON,
  HR_ATTENDANCE_SYNC_JOB_NAME,
  isAttendanceSyncEnabled,
  type AttendanceSyncError,
  type AttendanceSyncRunResult,
  type NormalizedAttendanceRecord,
} from './attendance-sync-types.js'
import {
  createAttendanceSyncProviders,
  attendanceSyncErrorSummary,
  type AttendanceSyncProvider,
} from './attendance-sync-providers.js'
import {
  drizzleAttendanceSyncRepo,
  loadDingTalkUserIdMap,
  loadEmployeeNumbers,
  persistAttendanceRecords,
  writeAttendanceSyncCursor,
  writeAttendanceSyncLastRun,
  type AttendanceSyncRepo,
} from './attendance-sync-store.js'

export interface AttendanceSyncJobOptions {
  enabled?: boolean
  now?: Date
  /** 显式指定拉取业务日(测试/补跑);缺省=上海昨日。 */
  date?: string
  env?: NodeJS.ProcessEnv
  providers?: AttendanceSyncProvider[]
  repo?: AttendanceSyncRepo
  userIdMap?: Record<string, string>
  loadEmployeeNos?: (repo: AttendanceSyncRepo) => Promise<string[]>
  loadUserIdMap?: (repo: AttendanceSyncRepo) => Promise<Record<string, string>>
  /** 缺省写 system_configs;测试可注入空实现。 */
  writeLastRun?: (result: AttendanceSyncRunResult) => Promise<void>
  /** 缺省 pushAlert;测试可注入 spy。 */
  alert?: (result: AttendanceSyncRunResult) => Promise<void>
}

async function sendSyncFailureAlert(result: AttendanceSyncRunResult): Promise<void> {
  if (result.errors.length === 0) return
  const lines = result.errors
    .slice(0, 20)
    .map(
      (e) =>
        `- ${flattenUntrustedText(e.provider)}/${flattenUntrustedText(e.kind)}: ${flattenUntrustedText(e.message)}`,
    )
  await pushAlert({
    title: `考勤同步失败 ${result.errors.length} 项`,
    message: capAlertMessage(
      [
        `拉取窗口 ${result.windowDate},尝试 ${result.attempted} 次,新增 ${result.syncedRows} 行。失败明细:`,
        ...lines,
        result.errors.length > lines.length
          ? `(仅列前 ${lines.length} 条,共 ${result.errors.length} 条)`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    severity: 'warning',
    source: 'hr-attendance-sync',
    metadata: {
      windowDate: result.windowDate,
      attempted: result.attempted,
      syncedRows: result.syncedRows,
      errors: result.errors.length,
    },
  })
}

/**
 * 一轮同步。默认关闭时空跑并写快照(设计稿 §11:禁用分支也要可见)。
 * 绝不向外抛错:所有 provider 失败折进 errors,由告警通道响。
 */
export async function runAttendanceSyncJob(
  options: AttendanceSyncJobOptions = {},
): Promise<AttendanceSyncRunResult> {
  const env = options.env ?? process.env
  const enabled = options.enabled ?? isAttendanceSyncEnabled(env)
  const windowDate = options.date ?? shiftBizDayKey(bizDayKey(options.now), -1)
  const repo = options.repo ?? drizzleAttendanceSyncRepo
  const result: AttendanceSyncRunResult = {
    enabled,
    windowDate,
    scannedUsers: 0,
    attempted: 0,
    syncedRows: 0,
    duplicates: 0,
    employeeNotFound: 0,
    invalidRows: 0,
    skippedNotConfigured: 0,
    skippedNotImplemented: 0,
    errors: [],
    finishedAt: new Date().toISOString(),
  }

  const writeLastRun =
    options.writeLastRun ?? ((r: AttendanceSyncRunResult) => writeAttendanceSyncLastRun(repo, r))
  const alert = options.alert ?? sendSyncFailureAlert

  const finish = async (): Promise<AttendanceSyncRunResult> => {
    result.finishedAt = new Date().toISOString()
    await writeLastRun(result).catch(() => undefined)
    if (result.errors.length > 0) await alert(result).catch(() => undefined)
    return result
  }

  if (!enabled) return finish()

  const providers = options.providers ?? createAttendanceSyncProviders(env)
  const activeProviders = providers.filter((p) => p.isConfigured(env))
  result.skippedNotConfigured = providers.length - activeProviders.length
  // 没有可用凭证:不连库、不发请求,直接留一份「未配置」快照。
  if (activeProviders.length === 0) return finish()

  // 审批三类(leave/overtime/outgoing):端点已核实但平台枚举未核实(设计稿 §7.4),
  // 本 runner 不发起拉取;按 provider × 3 记「未实现跳过」,让快照能看出缺口。
  result.skippedNotImplemented = activeProviders.length * 3

  let employeeNos: string[] = []
  try {
    const loadEmployees = options.loadEmployeeNos ?? loadEmployeeNumbers
    employeeNos = await loadEmployees(repo)
    result.scannedUsers = employeeNos.length
  } catch (err) {
    result.errors.push({
      provider: 'roster',
      kind: 'employee-source',
      message: attendanceSyncErrorSummary(err),
    })
  }

  let userIdMap = options.userIdMap ?? {}
  if (options.userIdMap === undefined && activeProviders.some((p) => p.id === 'dingtalk')) {
    try {
      const loadMap = options.loadUserIdMap ?? loadDingTalkUserIdMap
      userIdMap = await loadMap(repo)
    } catch (err) {
      result.errors.push({
        provider: 'dingtalk',
        kind: 'userid-map',
        message: attendanceSyncErrorSummary(err),
      })
    }
  }

  for (const provider of activeProviders) {
    result.attempted += 1
    try {
      const records: NormalizedAttendanceRecord[] = await provider.pullAttendance({
        date: windowDate,
        employeeNos,
        userIdMap,
      })
      const persisted = await persistAttendanceRecords(records, repo)
      result.syncedRows += persisted.inserted
      result.duplicates += persisted.duplicates
      result.employeeNotFound += persisted.employeeNotFound
      result.invalidRows += persisted.invalidRows
      await writeAttendanceSyncCursor(repo, provider.id, windowDate).catch(() => undefined)
    } catch (err) {
      result.errors.push({
        provider: provider.id,
        kind: 'attendance',
        message: attendanceSyncErrorSummary(err),
      })
    }
  }

  return finish()
}

/**
 * 补注册定时 job。原 `SCHEDULED_JOBS` 中的定义已从工作树移除,
 * 这里在 worker 启动时用同一 BullMQ repeat key 幂等登记,避免改动调度插件以外的文件。
 * 仅登记不执行;真正是否拉取由 env 总开关决定。
 */
export async function ensureAttendanceSyncScheduled(
  queue: SchedulerUpsertQueue,
  log: SchedulerRegisterLog,
): Promise<void> {
  try {
    await queue.upsertJobScheduler(
      HR_ATTENDANCE_SYNC_JOB_NAME,
      { pattern: HR_ATTENDANCE_SYNC_CRON },
      {
        name: HR_ATTENDANCE_SYNC_JOB_NAME,
        data: { description: '考勤 IM 同步(每日北京时间02:00,默认关)' },
        opts: {
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 500 },
        },
      },
    )
  } catch (err) {
    log.warn({ err }, 'attendance sync schedule registration failed (non-fatal)')
  }
}

export type { AttendanceSyncError }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
