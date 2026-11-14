// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 飞书目标员工工号来源(2026-11-13 立)。
 *
 * 飞书 user_tasks/query 用工号(employee_no)直接拉取,故需先定「拉哪些工号」。
 * 「两者结合」口径(机主 2026-11-13 拍板):
 *   · 默认读名册表 user_profiles.employee_no(所有非空工号)→ 免人工维护。
 *   · 若 system_configs 配了白名单(key=sync:feishu:employee-nos:{userId},
 *     JSON 字符串数组),则取「名册 ∩ 白名单」收窄范围 —— 白名单只收窄不扩张,
 *     同步只读、范围越小越安全,且免额外模式开关。
 *
 * 钉钉不用本模块:钉钉 attendance/list 只认平台 userid,走 dingtalk-provider.ts
 * 自己的「工号↔userid」人工映射,与本文件口径不同,勿混。
 */

import { eq, isNotNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { userProfiles, systemConfigs } from '@ihui/database'

/** 白名单 KV 键(system_configs,JSON 字符串数组如 ["E001","E002"]) */
export function feishuEmployeeNosKey(userId: string): string {
  return `sync:feishu:employee-nos:${userId}`
}

/** 读白名单;未配置/非法/空数组 → null(表示不收窄) */
async function loadWhitelist(userId: string): Promise<Set<string> | null> {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, feishuEmployeeNosKey(userId)))
    .limit(1)
  if (!row?.value) return null
  try {
    const parsed = JSON.parse(row.value) as unknown
    if (!Array.isArray(parsed)) return null
    const set = new Set(parsed.filter((v): v is string => typeof v === 'string' && v !== ''))
    return set.size > 0 ? set : null
  } catch {
    // 配置非法 → 视为不收窄(诊断由 cron 侧记日志),不静默崩溃
    return null
  }
}

/** 读名册表所有非空工号(去重、去空白) */
async function loadRosterEmployeeNos(): Promise<string[]> {
  const rows = await db
    .select({ employeeNo: userProfiles.employeeNo })
    .from(userProfiles)
    .where(isNotNull(userProfiles.employeeNo))
  const set = new Set<string>()
  for (const r of rows) {
    const no = r.employeeNo?.trim()
    if (no) set.add(no)
  }
  return [...set]
}

/**
 * 解析本次飞书打卡应拉取的目标工号列表。
 *
 * 名册为空 → [](provider 据此返回 0 行空批次);
 * 配了白名单 → 取名册∩白名单(白名单里不在名册的工号忽略,只拉系统已知员工)。
 */
export async function resolveFeishuEmployeeNos(userId: string): Promise<string[]> {
  const roster = await loadRosterEmployeeNos()
  if (roster.length === 0) return []

  const whitelist = await loadWhitelist(userId)
  if (!whitelist) return roster

  return roster.filter((no) => whitelist.has(no))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
