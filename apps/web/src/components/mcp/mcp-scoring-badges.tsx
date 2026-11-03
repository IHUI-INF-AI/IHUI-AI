// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * MCP 市场评分徽章(P1 1-4 / P2-5,2026-09-12 抽出为独立组件)
 *
 * - ScoringBadges:质量分徽章(等级 A/B/C/D 色标 + 数值分)+ 权限风险等级徽章;
 *   hover 提示用 @/components/feedback 的 Tooltip(禁原生 title)。
 * - ReviewBadge:市场审核状态徽章(pending/approved/rejected)。
 * 被 mcp-store PageClient 与质量看板共用。
 */
import { useTranslations } from 'next-intl'

import type {
  McpQualityGrade,
  McpReviewStatus,
  McpSecurityLevel,
} from '@ihui/api-client/endpoints/mcp'

import { Badge } from '@/components/data'
import { Tooltip } from '@/components/feedback'

/** 安全风险等级 → 徽章变体 / i18n key */
const RISK_BADGE_VARIANT: Record<McpSecurityLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
}
const RISK_LABEL_KEY: Record<McpSecurityLevel, string> = {
  low: 'riskLow',
  medium: 'riskMedium',
  high: 'riskHigh',
  critical: 'riskCritical',
}

/** 质量等级 → 徽章变体 */
const GRADE_BADGE_VARIANT: Record<McpQualityGrade, 'success' | 'primary' | 'warning' | 'danger'> = {
  A: 'success',
  B: 'primary',
  C: 'warning',
  D: 'danger',
}

/** 审核状态 → 徽章变体 / i18n key */
const REVIEW_BADGE_VARIANT: Record<McpReviewStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}
const REVIEW_LABEL_KEY: Record<McpReviewStatus, string> = {
  pending: 'reviewPending',
  approved: 'reviewApproved',
  rejected: 'reviewRejected',
}

/**
 * 评分徽章对:质量分(等级色标 + 数值分)+ 权限风险等级。
 * Tooltip 展示完整分数(质量分/安全分 0-100);flat props 使商店摘要与
 * 质量看板明细两种数据源(字段名不同)都能直接喂入。
 */
export function ScoringBadges({
  score,
  grade,
  securityScore,
  securityLevel,
}: {
  score: number
  grade: McpQualityGrade
  securityScore: number
  securityLevel: McpSecurityLevel
}) {
  const t = useTranslations('mcpStore')
  return (
    <>
      <Tooltip content={t('qualityScore', { score })}>
        <Badge variant={GRADE_BADGE_VARIANT[grade]}>
          {t('quality')} {grade} {score}
        </Badge>
      </Tooltip>
      <Tooltip content={t('securityScore', { score: securityScore })}>
        <Badge variant={RISK_BADGE_VARIANT[securityLevel]}>
          {t(RISK_LABEL_KEY[securityLevel])}
        </Badge>
      </Tooltip>
    </>
  )
}

/** 审核状态徽章:待审核 / 已通过 / 已驳回 */
export function ReviewBadge({ status }: { status: McpReviewStatus }) {
  const t = useTranslations('mcpStore')
  return <Badge variant={REVIEW_BADGE_VARIANT[status]}>{t(REVIEW_LABEL_KEY[status])}</Badge>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
