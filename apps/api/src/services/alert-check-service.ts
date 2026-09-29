// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 告警噪音检查服务（backing service for alert-check-daily 定时任务）。
 * 迁移自旧架构 app/tasks/alert_check_task.py。
 *
 * 每日 04:00 扫描系统告警表，清理已恢复告警的噪音，
 * 并检查是否有未处理的严重告警需要升级通知。
 */

import { sql, and, gt, lt, ilike } from 'drizzle-orm'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../db/index.js'
import { auditLogs } from '@ihui/database'

export interface AlertCheckResult {
  checked: number
  resolved: number
  escalated: number
  /** 备份链文件系统的问题(每条一个描述,已判定:缺失 / 空文件 / 过期) */
  backupIssues: string[]
  /**
   * 备份链"看不了"的那些目标(目录不可读 / 文件信息取不到)。
   * 与 backupIssues 分开计,因为处置动作不同:一条是"备份没了",一条是"我这轮没看见备份目录"。
   * 两者都进 escalated —— **未判定不得被读成 OK**(把没判写成判过了是本仓最高频失效型)。
   */
  backupUndetermined: string[]
  /**
   * 按**备份目标(库)**拆开的告警单元:标题含库名 ⇒ 下游去重身份(PagerDuty dedup_key
   * 与 alertbridge 的 alertname 指纹)按库分开。合成一条标题时,keycloak 的缺失会被
   * ihui_dev 的告警去重掉,即"两个库共用一个身份 = 只报得出一个库的账"。
   */
  backupAlerts: BackupAlert[]
  errors: string[]
}

// ---------------------------------------------------------------------------
// 文件系统备份新鲜度检查(2026-09-06 加固;2026-09-06 收敛单一拥有者;
// 2026-09-29 补第二座库 keycloak —— 同日实测:它由同一条 runner 每天产出
// keycloak_*.dump 却**不在本清单里**,即"备份缺失/空/过期"对它一条都不判)
// 补盲区: NSSM 链最近文件若 早于 24h 或 为 0 字节 → 判定备份缺失/空备份。
//   Chain1(NSSM): D:\DevEnv\backups\pg\<库名>_*.dump  ← 唯一权威备份(含百度异地)
//   清单以 runner 为准:deploy/win/ihui-pg-backup.ps1 的 $backupDatabases
//   (ihui_dev + keycloak);新增库必须同批改这里,否则新库的档在监控面外静默累积。
//   (已废弃: 应用内 BullMQ d:\IHUI-AI\backups\pg\*.sql.gz 经 2026-09-06 收口下线,
//    因其调度静默失败/不累积,与 NSSM 重复,不再作为备份链纳入监控)
// ---------------------------------------------------------------------------

export interface BackupTarget {
  /**
   * 库名 = 告警身份的一部分(见 BackupAlert.title)。
   * 刻意与 label 分开:label 是给人看的落点描述(含绝对路径),会随目录搬迁变;
   * 身份必须稳定,否则每次改路径都等于换了一条告警、去重窗口形同重置。
   */
  name: string
  dir: string
  label: string
  /**
   * 该库文件的归属前缀。**2026-09-29 由可选改为必填**:原先两处库共用同一个目录,
   * 少写这一格就等于"目录里有档 ⇒ 本库一切正常" —— 第二个库拿别人的档替自己作证,
   * 永远绿且没有任何门会红(与下方 namePrefix 为空的未判定 guard 是同一件事的两道栅栏)。
   */
  namePrefix: string
  suffix: string
}

export interface BackupAlert {
  /** 库名(与 BackupTarget.name 同值) */
  target: string
  /** 含库名的告警标题 ⇒ 每个库各自一条去重身份 */
  title: string
  /** 该库的问题行(已判定 + 未判定),逐条寄进邮件正文 */
  lines: string[]
}

export interface BackupFilesystemCheck {
  issues: string[]
  undetermined: string[]
  alerts: BackupAlert[]
}

const BACKUP_STALE_HOURS = 24

const BACKUP_TARGETS: BackupTarget[] = [
  {
    name: 'ihui_dev',
    dir: 'D:\\DevEnv\\backups\\pg',
    label: 'NSSM服务备份(D:\\DevEnv\\backups\\pg\\ihui_dev_*.dump)',
    namePrefix: 'ihui_dev_',
    suffix: '.dump',
  },
  {
    // 2026-09-29 补:同一条 runner(ihui-pg-backup.ps1)自 09-28 起每天产 keycloak_*.dump,
    // 而监控面只有 ihui_dev ⇒ keycloak 的档缺失/0 字节/停更至今**一条都不判**。
    // 它是 SSO 身份提供方 realm `ihui` 的唯一落盘处(无 realm-export、无 compose 服务),
    // 丢了就是登录入口,爆炸半径不小于主库。
    name: 'keycloak',
    dir: 'D:\\DevEnv\\backups\\pg',
    label: 'NSSM服务备份(D:\\DevEnv\\backups\\pg\\keycloak_*.dump)',
    namePrefix: 'keycloak_',
    suffix: '.dump',
  },
]

/**
 * 在册备份目标的身份清单(唯一源 = BACKUP_TARGETS 那一张表)。
 * 测试与审计按它现读,不得在别处再抄一份库名(清单过期 = 新库在监控面外静默累积)。
 */
export function listBackupTargets(): ReadonlyArray<{ name: string; dir: string; prefix: string }> {
  return BACKUP_TARGETS.map((t) => ({ name: t.name, dir: t.dir, prefix: t.namePrefix }))
}

function isBackupFile(name: string, t: BackupTarget): boolean {
  if (!name.toLowerCase().endsWith(t.suffix.toLowerCase())) return false
  // 归属判断不设"没给前缀就全收"的兜底:兜底那一支就是 keycloak 永远绿的成因
  if (!name.startsWith(t.namePrefix)) return false
  return true
}

/**
 * 单个备份目标的一轮结论。
 * 两态**不得并桶**:`issues` 是"看清了、确实有问题",`undetermined` 是"没看清"。
 * 合成一列就会把"备份目录读不到"写成"备份没问题"(本仓最高频失效型),或反过来造赝红。
 */
export interface BackupTargetOutcome {
  issues: string[]
  undetermined: string[]
}

/**
 * 把一库的结论折成一条告警单元:标题含库名 ⇒ 去重身份按库分开。
 * 导出是为了让"标题怎么拼"只有一份实现 —— 调度侧与测试都读它,不再各拼一遍。
 * 返回 null = 这一库本轮无事可报(既不冒领一条空告警,也不静默吞掉问题)。
 */
export function buildBackupAlert(name: string, outcome: BackupTargetOutcome): BackupAlert | null {
  const lines = [...outcome.issues, ...outcome.undetermined]
  if (lines.length === 0) return null
  const kinds: string[] = []
  if (outcome.issues.length > 0) kinds.push('缺失/空备份/过期')
  // 「无法判定」必须出现在标题里:否则收件人看到一条写着"缺失"的邮件去查备份,
  // 而真实状态是监控器压根没看见目录 —— 那是把人指去另一个方向。
  if (outcome.undetermined.length > 0) kinds.push('无法判定')
  return { target: name, title: `数据库备份监控告警(${name} — ${kinds.join(' + ')})`, lines }
}

export async function checkBackupTarget(t: BackupTarget, now: Date): Promise<BackupTargetOutcome> {
  const issues: string[] = []
  const undetermined: string[] = []
  const staleCutoff = new Date(now.getTime() - BACKUP_STALE_HOURS * 60 * 60 * 1000)

  // 前缀为空 = 这一条没有"归属"可言(它会把同目录里任何库的档算成自己的)。
  // 这不是"检查通过",是"这条检查没被定义" ⇒ 归未判定、照样进 escalated。
  if (!t.namePrefix) {
    return {
      issues,
      undetermined: [`${t.label}: 未给出文件名前缀 —— 无法判定归属,本轮未采用任何结论`],
    }
  }

  let names: string[]
  try {
    names = await readdir(t.dir)
  } catch {
    // 目录读不到 ≠ 没有备份问题:它可能是盘没挂上 / 权限被改 / 目录被挪走。
    // 判成"无问题"就是这台机最容易复发的那一型静默(备份链整条断了而账面全绿),
    // 所以归入未判定并**照样进 escalated** —— 看不了必须比看漏更响。
    return {
      issues,
      undetermined: [
        `${t.label}: 备份目录读取失败(目录不存在或无权限)—— 无法判定,本轮未检查到任何文件`,
      ],
    }
  }

  const matched = names.filter((n) => isBackupFile(n, t))
  if (matched.length === 0) {
    issues.push(`${t.label}: 无任何备份文件`)
    return { issues, undetermined }
  }

  // 取 mtime 最新的备份文件
  let latest: { name: string; size: number; mtimeMs: number } | null = null
  for (const name of matched) {
    try {
      const st = await stat(join(t.dir, name))
      if (!latest || st.mtimeMs > latest.mtimeMs) {
        latest = { name, size: st.size, mtimeMs: st.mtimeMs }
      }
    } catch {
      /* 单个文件 stat 失败跳过 */
    }
  }

  if (!latest) {
    // 文件名列出来了却一个都 stat 不到 = 看不见新鲜度,不是"新鲜度没问题"
    undetermined.push(`${t.label}: 无法读取备份文件信息 —— 无法判定`)
    return { issues, undetermined }
  }

  if (latest.size === 0) {
    issues.push(`${t.label}: 最新备份为空文件(${latest.name}, 0 字节)`)
  }
  if (latest.mtimeMs < staleCutoff.getTime()) {
    issues.push(
      `${t.label}: 最新备份已超 ${BACKUP_STALE_HOURS}h 未更新(${latest.name}, ${new Date(latest.mtimeMs).toISOString()})`,
    )
  }
  return { issues, undetermined }
}

/**
 * 逐目标检查备份链目录,并把结论**按库**分成独立告警单元。
 *
 * 为什么单列一个出口而不是只返回字符串数组:标题里的库名就是去重身份 —— 两个库共用一条
 * 标题时,keycloak 的缺失会在 ihui_dev 那条告警的窗口里被吞掉(§5e:去重只许按身份)。
 * 为什么导出:调度侧与测试都只看这个函数给的结构,不再各自拼第二份标题(两处算同一件事必漂移)。
 */
export async function checkBackupFilesystemFreshness(now: Date): Promise<BackupFilesystemCheck> {
  const issues: string[] = []
  const undetermined: string[] = []
  const alerts: BackupAlert[] = []
  for (const t of BACKUP_TARGETS) {
    let res: BackupTargetOutcome
    try {
      res = await checkBackupTarget(t, now)
    } catch (err) {
      // 同上:检查动作本身抛异常是"没看清",不是"看清了没问题"
      res = {
        issues: [],
        undetermined: [
          `${t.label}: 检查异常 ${err instanceof Error ? err.message : String(err)} —— 无法判定`,
        ],
      }
    }
    issues.push(...res.issues)
    undetermined.push(...res.undetermined)
    const alert = buildBackupAlert(t.name, res)
    if (alert) alerts.push(alert)
  }
  return { issues, undetermined, alerts }
}

/**
 * 执行每日告警检查。
 *
 * 策略：
 * 1. 扫描 audit_logs 中 action 含 error/denied/blocked 的最近 24h 记录
 * 2. 统计未处理的严重告警数量
 * 3. 超过阈值的标记为需要升级
 * 4. 24 小时前的旧告警视为已恢复的噪音
 * 5. 巡检备份链目录的**每一个**在册库(现读:ihui_dev + keycloak),
 *    检测 备份缺失 / 空备份(0 字节)/ 超 24h 未更新;读不到目录按"无法判定"同样升级
 */
export async function checkDailyAlerts(): Promise<AlertCheckResult> {
  const errors: string[] = []
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  let checked = 0
  let resolved = 0

  try {
    // 统计最近 24h 内含错误关键字的审计日志（告警源）
    const recentAlerts = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(and(ilike(auditLogs.action, '%error%'), gt(auditLogs.createdAt, twentyFourHoursAgo)))

    checked = recentAlerts[0]?.count ?? 0

    // 统计 24h 前的旧告警（可视为已恢复的噪音）
    const oldAlerts = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(and(ilike(auditLogs.action, '%error%'), lt(auditLogs.createdAt, twentyFourHoursAgo)))

    resolved = oldAlerts[0]?.count ?? 0
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  // 文件系统备份新鲜度检查(不带入 DB 异常, 独立捕获, 保证 DB 出问题时备份监控仍生效)
  const backupCheck = await checkBackupFilesystemFreshness(now)
  const {
    issues: backupIssues,
    undetermined: backupUndetermined,
    alerts: backupAlerts,
  } = backupCheck

  // 升级逻辑：最近 24h 错误数超过 50,或有备份缺失/空备份/过期/**无法判定** → 需升级通知
  const escalated = checked > 50 || backupIssues.length > 0 || backupUndetermined.length > 0 ? 1 : 0

  return {
    checked,
    resolved,
    escalated,
    backupIssues,
    backupUndetermined,
    backupAlerts,
    errors,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
