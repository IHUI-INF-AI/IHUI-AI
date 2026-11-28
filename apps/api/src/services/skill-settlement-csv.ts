// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { SkillMarketSettlementResponse } from '@ihui/shared/skills/market'

function yuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

/**
 * CSV 单元格转义 + 公式注入防护。
 * 文本以 = + - @ 开头时前补单引号；数字传 number，避免负号被误判。
 */
function csvCell(value: string | number | null): string {
  const raw = value === null ? '' : String(value)
  const guarded = typeof value === 'string' && /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

function row(values: Array<string | number | null>): string {
  return values.map(csvCell).join(',')
}

/** 生成带 BOM 的 UTF-8 CSV，Excel 直接打开中文不乱码。 */
export function buildSkillMarketSettlementCsv(
  data: SkillMarketSettlementResponse,
  options?: { exportedAt?: Date },
): string {
  const s = data.summary
  const periodLabel = data.period.month ?? '全部账期'
  const exportedAt = (options?.exportedAt ?? new Date()).toISOString()
  const lines: string[] = [
    row(['技能市场结算单']),
    row(['账期', periodLabel]),
    row(['统计口径', data.period.month ? '按下单时间归期（Asia/Shanghai 自然月）' : '全部账期']),
    row(['导出时间', exportedAt]),
    '',
    row(['汇总项', '值']),
    row(['在购笔数', s.paidCount]),
    row(['退款笔数', s.refundedCount]),
    row(['累计成交(元)', yuan(s.grossSalesCents)]),
    row(['退款成交(元)', yuan(s.refundedGrossCents)]),
    row(['净成交(元)', yuan(s.netGmvCents)]),
    row(['作者应得(元)', yuan(s.authorShareEarnedCents)]),
    row(['作者应冲正(元)', yuan(s.authorShareOnRefundedCents)]),
    row(['卖家实扣回(元)', yuan(s.sellerClawbackCents)]),
    row(['平台承担(元)', yuan(s.platformBorneCents)]),
    row(['作者净分成(元)', yuan(s.authorNetCents)]),
    row(['平台净收益(元)', yuan(s.platformNetCents)]),
    row(['历史退款缺扣回记录', s.clawbackMissingCount]),
    '',
    row([
      '技能',
      '卖家ID',
      '卖家昵称',
      '在购笔数',
      '退款笔数',
      '累计成交(元)',
      '退款成交(元)',
      '净成交(元)',
      '作者应得(元)',
      '作者应冲正(元)',
      '卖家实扣回(元)',
      '平台承担(元)',
      '作者净分成(元)',
      '平台净收益(元)',
      '缺扣回记录数',
    ]),
  ]

  for (const item of data.items) {
    lines.push(
      row([
        item.skillName,
        item.sellerUserId ?? '',
        item.sellerNickname ?? '',
        item.paidCount,
        item.refundedCount,
        yuan(item.grossSalesCents),
        yuan(item.refundedGrossCents),
        yuan(item.netGmvCents),
        yuan(item.authorShareEarnedCents),
        yuan(item.authorShareOnRefundedCents),
        yuan(item.sellerClawbackCents),
        yuan(item.platformBorneCents),
        yuan(item.authorNetCents),
        yuan(item.platformNetCents),
        item.clawbackMissingCount,
      ]),
    )
  }

  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function settlementCsvFilename(periodMonth: string | null, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  return periodMonth
    ? `skill-market-settlement-${periodMonth}.csv`
    : `skill-market-settlement-all-${stamp}.csv`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
