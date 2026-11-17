// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 飞书/钉钉考勤同步 job(2026-11-14 立,RP-15/16/17)。
 *
 * 安全闸:
 * - 默认关闭;env `HR_ATTENDANCE_SYNC_ENABLED=true|1|yes` 显式给出时以它为准,
 *   未设置时读 system_configs 的 `sync:attendance:enabled`(改库即热生效,不必重启进程);
 * - 凭证/scope 缺失时 provider 直接跳过,不抛错、不阻断进程启动;
 * - 落库为幂等插入(不覆盖已有考勤),未知枚举原样落库;
 * - 任何 HTTP/DB 失败进 errors,并通过 pushAlert 告警。
 */

import { capAlertMessage, flattenUntrustedText } from '../utils/alert-text.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { pushAlert } from './alert-notification-service.js'
import {
  ATTENDANCE_SYNC_PLATFORMS_KEY,
  ATTENDANCE_SYNC_SWITCH_KEY,
  attendanceSyncEnvOverride,
  parseAttendanceSyncPlatforms,
  parseAttendanceSyncSwitch,
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
  /** 缺省用全局 fetch;测试注入可保证不触网。 */
  fetchImpl?: typeof fetch
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

export type AttendanceSyncJobResult = AttendanceSyncRunResult

/**
 * 一轮同步。默认关闭时空跑并写快照(设计稿 §11:禁用分支也要可见)。
 * 绝不向外抛错:所有 provider 失败折进 errors,由告警通道响。
 */
export async function runAttendanceSyncJob(
  options: AttendanceSyncJobOptions = {},
): Promise<AttendanceSyncRunResult> {
  const env = options.env ?? process.env
  const windowDate = options.date ?? shiftBizDayKey(bizDayKey(options.now), -1)
  const repo = options.repo ?? drizzleAttendanceSyncRepo

  // 开关口径(单一真相源):env 显式给出 ⇒ 以 env 为准(运维强制,含强制关);
  // env 未设置 ⇒ 读 system_configs 的 DB 键(改库即热生效,不必重启进程);
  // 读库抛错 ⇒ 按关(fail-closed)。
  let enabled: boolean
  if (options.enabled !== undefined) {
    enabled = options.enabled
  } else {
    const envOverride = attendanceSyncEnvOverride(env)
    enabled =
      envOverride ??
      (await repo.readConfig(ATTENDANCE_SYNC_SWITCH_KEY).then(
        (v) => parseAttendanceSyncSwitch(v),
        () => false,
      ))
  }
  const result: AttendanceSyncRunResult = {
    enabled,
    windowDate,
    scannedUsers: 0,
    attempted: 0,
    syncedRows: 0,
    syncedBatches: 0,
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
    result.syncedBatches = result.syncedRows
    result.finishedAt = new Date().toISOString()
    await writeLastRun(result).catch(() => undefined)
    if (result.errors.length > 0) await alert(result).catch(() => undefined)
    return result
  }

  if (!enabled) return finish()

  let providers = options.providers ?? createAttendanceSyncProviders(env, options.fetchImpl)
  // 平台白名单(DB 键,改库即热生效):缺省=全部平台;配置了=只跑列出的平台。
  // 同一 employee_no 同时喂两个平台会必然失败(飞书对钉钉 userid 回 1220001),
  // 故企业只接一个平台时必须能把射程收窄,而不是每天白跑一趟再发一封噪声告警。
  if (options.providers === undefined) {
    try {
      const only = parseAttendanceSyncPlatforms(
        await repo.readConfig(ATTENDANCE_SYNC_PLATFORMS_KEY),
      )
      if (only) providers = providers.filter((p) => only.has(p.id))
    } catch {
      // 取不到名单 ⇒ 不筛(失效方向恒为「多跑一次」,绝不静默少跑一个平台)
    }
  }
  const activeProviders = providers.filter((p) => p.isConfigured(env))
  result.skippedNotConfigured = providers.length - activeProviders.length
  // 没有可用凭证:不连库、不发请求,直接留一份「未配置」快照。
  if (activeProviders.length === 0) return finish()

  // 四类(打卡 / leave / overtime / outgoing)均已实现:飞书走 user_approvals 聚合接口,
  // 钉钉走考勤报表列 + 请假状态接口(见 dingtalk-provider.ts,设计稿 §7.4「替代实现」)。
  // 因此这里不再记「未实现跳过」;字段保留,兼容既有 lastRun 快照读取方。

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

export type { AttendanceSyncError }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
