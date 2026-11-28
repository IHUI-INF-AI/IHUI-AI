// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  SkillPayoutManifestFlag,
  SkillPayoutManifestResponse,
  SkillPayoutManifestStatus,
} from '@ihui/shared/skills/market'

function yuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? '' : String(value)
  const guarded = typeof value === 'string' && /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

function row(values: Array<string | number | null>): string {
  return values.map(csvCell).join(',')
}

const STATUS_LABEL: Record<SkillPayoutManifestStatus, string> = {
  ready: '可进入人工复核',
  no_net: '本月无正净额',
  not_withdrawable: '当前无可提现',
  needs_review: '需先核查',
}

const FLAG_LABEL: Record<SkillPayoutManifestFlag, string> = {
  platform_borne: '平台承担',
  clawback_missing: '扣回未记录',
  negative_wallet: '余额为负',
  commission_mismatch: '佣金缺口',
  month_negative: '本月净额为负',
  capped_by_withdrawable: '被可提现余额截断',
}

/** 生成带 BOM 的 UTF-8 CSV；所有金额列用“元”，ID/状态/标记保持原文。 */
export function buildSkillPayoutManifestCsv(
  data: SkillPayoutManifestResponse,
  options?: { exportedAt?: Date },
): string {
  const s = data.summary
  const periodLabel = data.period.month ?? '全部账期'
  const exportedAt = (options?.exportedAt ?? new Date()).toISOString()
  const lines: string[] = [
    row(['技能市场人工出款参考清单']),
    row(['账期', periodLabel]),
    row(['说明', data.disclaimer]),
    row(['导出时间', exportedAt]),
    '',
    row(['汇总项', '值']),
    row(['卖家数', s.sellers]),
    row(['本月作者净分成(元)', yuan(s.monthAuthorNetCents)]),
    row(['参考出款上限(元)', yuan(s.suggestedPayoutCents)]),
    row(['可进入人工复核', s.readyCount]),
    row(['需先核查', s.needsReviewCount]),
    row(['当前无可提现', s.notWithdrawableCount]),
    '',
    row([
      '卖家ID',
      '卖家昵称',
      '本月作者净分成(元)',
      '当前可提现(元)',
      '在途提现(元)',
      '已提现(元)',
      '参考出款上限(元)',
      '状态',
      '标记',
    ]),
  ]

  for (const item of data.items) {
    lines.push(
      row([
        item.sellerUserId,
        item.sellerNickname ?? '',
        yuan(item.monthAuthorNetCents),
        yuan(item.withdrawableCents),
        yuan(item.pendingWithdrawalCents),
        yuan(item.completedWithdrawalCents),
        yuan(item.suggestedPayoutCents),
        STATUS_LABEL[item.status],
        item.flags.map((flag) => FLAG_LABEL[flag]).join(' / '),
      ]),
    )
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function payoutManifestCsvFilename(periodMonth: string | null, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  return periodMonth
    ? `skill-market-payout-manifest-${periodMonth}.csv`
    : `skill-market-payout-manifest-all-${stamp}.csv`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
