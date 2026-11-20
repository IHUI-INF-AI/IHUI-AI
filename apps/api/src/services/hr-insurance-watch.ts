// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 社保基数"一更新就知道"(2026-11-21 立)。
 *
 * 背景与判断:
 *   各地社保缴费基数由地方人社局每年公布(多数地区 7 月调基),全国没有统一 API,
 *   系统无法自动抓到"官方最新值"。所以"马上知道"必须落在两条可控事实上:
 *     ① **别人改了配置,相关人立刻收到消息**(变更事件 + 变更明细 + 站内信);
 *     ② **该更新却没更新,系统主动发现并反复提醒**(每日巡检 + 到期/陈旧判定)。
 *   两条合起来的效果:基数被录入当刻相关人就知道;外部已调整而我们没录,最多滞后
 *   到次日 08:00 的巡检就会被点名,且算薪在那之前也会直接拒绝(不产生错单)。
 *
 * 刻意不做的事:**不自动把巡检结论写成费率**。没有权威源时任何"自动填数"都可能
 * 把工资算错,人工确认这一步不能省。
 */
import { and, eq, gte, or } from 'drizzle-orm'
import { users } from '@ihui/database'
import { db } from '../db/index.js'
import { createNotification } from '../db/notification-queries.js'
import { logger } from '../utils/logger.js'
import { bizDayKey } from '../utils/biz-day.js'
import { recordAuditLog } from './audit-log-service.js'

/** 站点通知类型(前端按 type 归类,新增须同步前端文案) */
export const HR_INSURANCE_NOTIFY_TYPE = 'hr_insurance_config'

/** 一条费率配置的最小形状(纯判定只需这些字段,便于单测不连库) */
export interface InsuranceConfigLike {
  regionName: string
  effectiveYear: number
  enabled: boolean
  updatedAt: Date | string
  pensionPersonal: unknown
  medicalPersonal: unknown
  unemploymentPersonal: unknown
  housingFundRate: unknown
  insuranceBaseMin: unknown
  insuranceBaseMax: unknown
  fundBaseMin: unknown
  fundBaseMax: unknown
}

/** 巡检结论:alert 会推站内信,advisory 只进留痕与体检接口 */
export interface InsuranceWatchFinding {
  level: 'alert' | 'advisory'
  code: 'NO_CURRENT_CONFIG' | 'INCOMPLETE_CONFIG' | 'STALE_RECORD' | 'NEXT_YEAR_CONFIG_MISSING'
  message: string
  regionName: string | null
  effectiveYear: number | null
}

/** 费率字段清单(单源:diff 文案与体检共用) */
const RATE_FIELDS: Array<[keyof InsuranceConfigLike, string]> = [
  ['pensionPersonal', '养老个人费率'],
  ['medicalPersonal', '医疗个人费率'],
  ['unemploymentPersonal', '失业个人费率'],
  ['housingFundRate', '公积金费率'],
  ['insuranceBaseMin', '社保基数下限'],
  ['insuranceBaseMax', '社保基数上限'],
  ['fundBaseMin', '公积金基数下限'],
  ['fundBaseMax', '公积金基数上限'],
]

/** 把 numeric 字符串/null 归一成可读文本,便于人读 diff */
function show(v: unknown): string {
  if (v === null || v === undefined) return '未填'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : String(v)
}

/**
 * 算一条费率配置的变更明细。
 *
 * `old` 为 null 表示"首次建档",此时每一项都记成 未填 → 新值,便于一眼看出这次录了哪些口径。
 */
export function diffInsuranceConfig(
  old: InsuranceConfigLike | null,
  next: {
    regionName: string
    effectiveYear: number
    enabled: boolean
    [k: string]: unknown
  },
): Array<{ field: string; label: string; from: string; to: string }> {
  const changes: Array<{ field: string; label: string; from: string; to: string }> = []
  for (const [field, label] of RATE_FIELDS) {
    const before = old ? show(old[field]) : '未填'
    const after = show(next[field])
    if (before !== after) changes.push({ field: String(field), label, from: before, to: after })
  }
  if (old) {
    if (old.enabled !== next.enabled) {
      changes.push({
        field: 'enabled',
        label: '是否启用',
        from: old.enabled ? '启用' : '停用',
        to: next.enabled ? '启用' : '停用',
      })
    }
  }
  return changes
}

/**
 * 判断当前费率配置的"新鲜度"(纯函数,不连库)。
 *
 * 判据与"该知道什么"一一对应:
 *   · 当年没有任何启用配置 ⇒ alert(算薪会直接拒绝,必须马上处理);
 *   · 当年某地区上下限缺失 ⇒ alert(算薪会拒绝,且这通常是录入漏项);
 *   · 配置记录时间早于生效年度 ⇒ advisory(疑似沿用旧年度,可能已滞后);
 *   · 已过调基期(默认 7 月)而次年配置缺失 ⇒ advisory;到 12 月仍缺 ⇒ alert。
 *
 * 次年判定下限 7 月是经验值:全国多数地区在 7 月起执行新基数,12 月必须录完,
 * 才赶得上次年 1 月工资。该阈值可通过参数调整,不写死在判据里。
 */
export function judgeInsuranceRows(
  rows: InsuranceConfigLike[],
  now: Date,
  opts: { nextYearWarnMonth?: number; nextYearAlertMonth?: number } = {},
): InsuranceWatchFinding[] {
  const warnMonth = opts.nextYearWarnMonth ?? 7
  const alertMonth = opts.nextYearAlertMonth ?? 12
  // 业务时区取上海口径,避免服务器 UTC 下"12 月 31 日 23:00"被判成次年
  const dayKey = bizDayKey(now)
  const year = Number(dayKey.slice(0, 4))
  const month = Number(dayKey.slice(5, 7))

  const findings: InsuranceWatchFinding[] = []
  const enabledRows = rows.filter((r) => r.enabled)

  const currentYearRows = enabledRows.filter((r) => r.effectiveYear === year)
  if (currentYearRows.length === 0) {
    findings.push({
      level: 'alert',
      code: 'NO_CURRENT_CONFIG',
      regionName: null,
      effectiveYear: year,
      message:
        `${year} 年没有任何启用的社保费率配置:本月算薪会被直接拒绝。` +
        '请到「薪资配置-社保费率」录入当年各地的个人费率与缴费基数上下限。',
    })
  }

  for (const row of currentYearRows) {
    const missing: string[] = []
    if (row.insuranceBaseMin === null || row.insuranceBaseMax === null)
      missing.push('社保基数上下限')
    if (
      row.pensionPersonal === null ||
      row.medicalPersonal === null ||
      row.unemploymentPersonal === null
    ) {
      missing.push('个人三险费率')
    }
    if (row.housingFundRate === null) missing.push('公积金费率')
    if (missing.length > 0) {
      findings.push({
        level: 'alert',
        code: 'INCOMPLETE_CONFIG',
        regionName: row.regionName,
        effectiveYear: row.effectiveYear,
        message:
          `${row.effectiveYear} 年「${row.regionName}」配置缺少 ${missing.join('、')},` +
          '算薪会被拒绝,请补齐后重算。',
      })
    }

    const updatedYear = new Date(row.updatedAt).getFullYear()
    if (Number.isFinite(updatedYear) && updatedYear < row.effectiveYear) {
      findings.push({
        level: 'advisory',
        code: 'STALE_RECORD',
        regionName: row.regionName,
        effectiveYear: row.effectiveYear,
        message:
          `${row.effectiveYear} 年「${row.regionName}」费率记录时间仍是 ${updatedYear} 年,` +
          '疑似沿用旧年度数据 —— 请核对当地人社最新公布的费率与基数上下限。',
      })
    }
  }

  const nextYear = year + 1
  const hasNextYear = enabledRows.some((r) => r.effectiveYear === nextYear)
  if (!hasNextYear && month >= warnMonth) {
    const isUrgent = month >= alertMonth
    findings.push({
      level: isUrgent ? 'alert' : 'advisory',
      code: 'NEXT_YEAR_CONFIG_MISSING',
      regionName: null,
      effectiveYear: nextYear,
      message:
        `${nextYear} 年社保费率配置尚未录入(当前月份 ${month} 月)。` +
        `各地调基多在 7 月后陆续公布,请拿到官方值后录入,否则 ${nextYear} 年 1 月算薪会被拒绝` +
        `${isUrgent ? ';已进入必须补齐窗口。' : '。'}`,
    })
  }

  return findings
}

/** 收件人:启用状态的管理员级账号(roleId ≥ 1 或系统管理员),排除本次操作人自己 */
async function resolveHrAdminRecipients(excludeUserId?: string): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.status, 1), or(gte(users.roleId, 1), eq(users.isSystemAdmin, true))))
    .limit(200)
  return rows.map((r) => String(r.id)).filter((id) => id !== excludeUserId)
}

/**
 * 给管理员级账号发站内信(尽力而为:失败只 warn,绝不打断主流程)。
 * @returns 成功落库的条数
 */
export async function notifyHrAdmins(params: {
  title: string
  content: string
  data?: Record<string, unknown>
  excludeUserId?: string
}): Promise<number> {
  let sent = 0
  try {
    const recipients = await resolveHrAdminRecipients(params.excludeUserId)
    for (const userId of recipients) {
      try {
        await createNotification({
          userId,
          type: HR_INSURANCE_NOTIFY_TYPE,
          title: params.title,
          content: params.content,
          data: params.data ?? {},
        })
        sent += 1
      } catch (err) {
        logger.warn('社保配置站内信单条发送失败', {
          userId,
          err: err instanceof Error ? err.message : String(err),
        })
      }
    }
  } catch (err) {
    logger.warn('社保配置站内信收件人解析失败(不阻断主流程)', {
      err: err instanceof Error ? err.message : String(err),
    })
  }
  return sent
}

/**
 * 费率配置被写入后:留审计 + 通知。
 *
 * 只在"确有字段变化"时触发;重复提交同样值不打扰人(否则每次保存都发一条,很快被无视)。
 */
export async function onInsuranceConfigWritten(params: {
  before: InsuranceConfigLike | null
  after: InsuranceConfigLike
  operatedBy?: string | undefined
  resourceId?: string | undefined
}): Promise<{ changed: boolean; notified: number }> {
  const changes = diffInsuranceConfig(params.before, {
    regionName: params.after.regionName,
    effectiveYear: params.after.effectiveYear,
    enabled: params.after.enabled,
    ...(params.after as unknown as Record<string, unknown>),
  })

  if (changes.length === 0) return { changed: false, notified: 0 }

  const head = `${params.after.effectiveYear} 年「${params.after.regionName}」社保费率已更新`
  const detail = changes.map((c) => `${c.label}:${c.from} → ${c.to}`).join(';')

  try {
    await recordAuditLog({
      userId: params.operatedBy ?? undefined,
      action: 'hr.insurance_rate.write',
      resourceType: 'hr_insurance_rate_config',
      resourceId: params.resourceId ?? undefined,
      result: 'success',
      metadata: {
        regionName: params.after.regionName,
        effectiveYear: params.after.effectiveYear,
        changes,
      },
    })
  } catch (err) {
    logger.warn('社保费率变更审计写入失败(不阻断主流程)', {
      err: err instanceof Error ? err.message : String(err),
    })
  }

  const notified = await notifyHrAdmins({
    title: head,
    content:
      `${detail}\n\n本次更新由 ${params.operatedBy ? `用户 ${params.operatedBy}` : '系统'} 提交;` +
      '已在算薪口径中生效,若数值有误请立即在「薪资配置-社保费率」修正。',
    data: {
      regionName: params.after.regionName,
      effectiveYear: params.after.effectiveYear,
      changes,
    },
    excludeUserId: params.operatedBy,
  })

  return { changed: true, notified }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
