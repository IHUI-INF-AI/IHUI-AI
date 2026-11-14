// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 共享类型与 provider 接口(2026-11-13 立)。
 *
 * 定位:把飞书/钉钉 IM 平台的打卡/请假/加班/外出数据,规范化成与
 * hr-import 链路「已解析行」同形的结构,交给暂存→裁决→确认流程。
 *
 * 安全边界(不可违背):
 *   · 同步器只产「暂存行」,绝不直接写正式考勤;裁决/确认仍走人工闸。
 *   · 只读拉取,不申请平台写权限。
 *   · 外部平台 HTTP 端点属未核实事实(见 docs/attendance-sync-api-design.md §7),
 *     本文件只定义契约,端点实现在各 provider 内,未核实前显式 TODO,不写死。
 */

import type { ImportKind } from '../hr-import-entry.js'

/** 同步来源平台(本轮 M-ATT-SYNC 先落飞书/钉钉,企微 P2) */
export type SyncSource = 'feishu' | 'dingtalk' | 'wecom'

/** 支持同步的记录类型(对齐 hr-import 四类) */
export type SyncKind = Extract<ImportKind, 'attendance' | 'leave' | 'overtime' | 'outgoing'>

/**
 * 规范化后的同步行 — 与 hr-import 解析产物对齐。
 *
 * 字段一律 string|null:平台原始值可能是数字/日期对象,provider 负责转字符串,
 * 后续裁决/落库由 hr-import 现有逻辑处理,这里不做二次推断。
 */
export interface SyncRow {
  employeeNo: string | null
  employeeName: string | null
  /** attendance:日期;leave/outgoing:开始日期;overtime:日期 */
  date: string | null
  startDate: string | null
  endDate: string | null
  checkInTime: string | null
  checkOutTime: string | null
  /** leave 假别 / overtime 加班类型 */
  typeText: string | null
  /** 加班/外出时长 */
  durationText: string | null
  /** 请假天数 */
  totalDays: string | null
  destination: string | null
  reason: string | null
  statusText: string | null
  /** 平台审批单号/打卡记录 ID — 天然幂等键 */
  externalId: string | null
}

/**
 * Provider 拉取契约。
 *
 * 返回结构化 SyncRow[],由 sync-runner 交给「已解析行」暂存入口。
 * 端点/token 细节在各 provider 实现,本接口不感知平台差异。
 */
export interface AttendanceProvider {
  readonly source: SyncSource
  /**
   * 拉取一批记录。
   * @param userId 归属用户(provider 可能需读该用户侧配置,如钉钉工号↔userid 映射)
   * @param creds  从 IM 适配器配置读出的凭证(单源,见 im-adapter-credentials.ts)
   * @param importKind 拉取的记录类型(打卡/请假/加班/外出),provider 据此选端点
   * @param cursor 上次同步游标(增量拉取起点);首次为 null 走全量窗口
   * @returns 规范化行 + 本次新游标
   */
  fetchBatch(params: {
    userId: string
    creds: PlatformCredentials
    importKind: SyncKind
    cursor: string | null
    periodMonth: string
  }): Promise<{ rows: SyncRow[]; nextCursor: string | null }>
}

/**
 * 平台凭证 — 从 IM 适配器 credentialsJson 读出(单源,不复制明文)。
 *
 * appId/appSecret 三平台通用;agentId 仅钉钉部分考勤 API 需要(待核实)。
 */
export interface PlatformCredentials {
  appId: string
  appSecret: string
  /** 钉钉企业内部应用 agentId(部分考勤 API 必填,待核实) */
  agentId?: string | undefined
}

export function isSyncKind(value: string): value is SyncKind {
  return value === 'attendance' || value === 'leave' || value === 'overtime' || value === 'outgoing'
}

export function isSyncSource(value: string): value is SyncSource {
  return value === 'feishu' || value === 'dingtalk' || value === 'wecom'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
