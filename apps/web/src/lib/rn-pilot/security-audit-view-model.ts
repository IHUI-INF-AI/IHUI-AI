// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 安全审计页 → 共享 SecurityAuditScreen 视图模型的适配层。
 *
 * 取数契约保持改造前 web 现读:`GET /api/security/audit` 的 `SecurityLog` 行只有
 * `action / ip / userAgent / createdAt` 四列。共享屏负责 `action → type` 归类,
 * web 这里只做 CLI 同口径的日期格式化,以及把共享词条键映射到 web 既有
 * `securityAuditPage` 词表,不改共享屏、不给共享屏加单端 prop。
 */

import type { TFunction } from '@ihui/types'
import type { SecurityAuditItem } from '@ihui/rn-app/pilot'

/** `GET /api/security/audit` 响应中的 `SecurityLog` 行(web 侧既有契约)。 */
export interface SecurityLogRow {
  id: string
  action: string
  ip: string | null
  userAgent: string | null
  createdAt: string
}

/** 共享词条全键 → web `securityAuditPage` 相对键。 */
const SHARED_KEY_TO_PAGE: Record<string, string> = {
  'securityAudit.title': 'title',
  'securityAudit.empty': 'empty',
  'securityAudit.type.login': 'type.login',
  'securityAudit.type.permission': 'type.permission',
  'securityAudit.type.sensitive': 'type.sensitive',
  'securityAudit.type.other': 'type.other',
}

/**
 * 共享 TFunction 的文案注入:业务词条走 web 既有 `securityAuditPage` 词表,
 * `common.back` 是共享屏通用返回文案(web 词表没有该键,沿用中文口径)。
 */
export function createSecurityAuditT(t: (key: string) => string): TFunction {
  return (key) => {
    if (key === 'common.back') return '返回'
    const mapped = SHARED_KEY_TO_PAGE[key]
    return mapped ? t(mapped) : key
  }
}

/**
 * 请求行 → 共享屏条目。
 *
 * `userAgent` 显式置 null:改造前 web 页面只展示 `ip / action / 时间`,不展示 UA;
 * 共享屏支持 UA 但本页不注入,保持 web 既有展示语义不变。
 */
export function toSecurityAuditItems(
  rows: SecurityLogRow[],
  format: (value: string) => string,
): SecurityAuditItem[] {
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    ip: row.ip ?? null,
    userAgent: null,
    createdAt: format(row.createdAt),
  }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
