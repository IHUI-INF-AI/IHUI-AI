// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { VipBenefitEntry, VipBenefitHeaderInfo, VipBenefitMatrixRow } from '../../types'

/** i18n 取词:key 缺失时用 fallback(与小程序 useTt 同签名) */
export type VipBenefitTt = (key: string, fallback: string) => string

type ValueSpec = { key?: string; fallback?: string; text?: string }

const MATRIX_COLUMNS: ReadonlyArray<{ key: string; fallback: string }> = [
  { key: 'vip.privilege.matrixBenefit', fallback: '权益' },
  { key: 'vip.privilege.levelNormal', fallback: '普通' },
  { key: 'vip.privilege.levelMonth', fallback: '月度' },
  { key: 'vip.privilege.levelQuarter', fallback: '季度' },
  { key: 'vip.privilege.levelYear', fallback: '年度' },
]

const MATRIX_ROWS: ReadonlyArray<{
  id: string
  labelKey: string
  labelFallback: string
  values: ReadonlyArray<ValueSpec>
}> = [
  {
    id: 'chats',
    labelKey: 'vip.privilege.matrixDailyChats',
    labelFallback: '每日对话次数',
    values: [{ text: '10' }, { text: '100' }, { text: '300' }, { text: '∞' }],
  },
  {
    id: 'model',
    labelKey: 'vip.privilege.matrixModelAccess',
    labelFallback: '模型访问',
    values: [
      { key: 'vip.privilege.matrixBasic', fallback: '基础' },
      { key: 'vip.privilege.matrixAdvanced', fallback: '进阶' },
      { key: 'vip.privilege.matrixAdvanced', fallback: '进阶' },
      { key: 'vip.privilege.matrixAll', fallback: '全部' },
    ],
  },
  {
    id: 'service',
    labelKey: 'vip.privilege.matrixExclusiveService',
    labelFallback: '专属客服',
    values: [{ text: '×' }, { text: '×' }, { text: '✓' }, { text: '✓' }],
  },
  {
    id: 'discount',
    labelKey: 'vip.privilege.matrixCourseDiscount',
    labelFallback: '课程折扣(折)',
    values: [
      { key: 'vip.privilege.matrixNone', fallback: '无' },
      { text: '9' },
      { text: '8' },
      { text: '7' },
    ],
  },
  {
    id: 'agents',
    labelKey: 'vip.privilege.matrixAgentCount',
    labelFallback: '智能体数量',
    values: [{ text: '3' }, { text: '10' }, { text: '30' }, { text: '∞' }],
  },
  {
    id: 'price',
    labelKey: 'vip.privilege.matrixPrice',
    labelFallback: '价格',
    values: [
      { key: 'vip.privilege.matrixFree', fallback: '免费' },
      { text: '¥30' },
      { text: '¥88' },
      { text: '¥299' },
    ],
  },
]

const TRADER_BENEFITS: ReadonlyArray<{ key: string; fallback: string }> = [
  { key: 'vip.privilege.traderBenefit1', fallback: '专属市场数据分析工具' },
  { key: 'vip.privilege.traderBenefit2', fallback: '一对一专业指导服务' },
  { key: 'vip.privilege.traderBenefit3', fallback: '实时行情预警推送' },
  { key: 'vip.privilege.traderBenefit4', fallback: '操盘策略专属课程' },
  { key: 'vip.privilege.traderBenefit5', fallback: '优先参与平台活动' },
]

const PRIVATE_BENEFITS: ReadonlyArray<{ key: string; fallback: string }> = [
  { key: 'vip.privilege.privateBenefit1', fallback: '一对一专属顾问' },
  { key: 'vip.privilege.privateBenefit2', fallback: '闭门沙龙参与权' },
  { key: 'vip.privilege.privateBenefit3', fallback: '行业大咖私密交流' },
  { key: 'vip.privilege.privateBenefit4', fallback: '高端资源对接' },
  { key: 'vip.privilege.privateBenefit5', fallback: '定制化解决方案' },
]

function resolveValue(value: ValueSpec, tt: VipBenefitTt): string {
  if (value.text !== undefined) return value.text
  return tt(value.key ?? '', value.fallback ?? '')
}

/** 等级对比矩阵(4 档 × 6 行) */
export function resolveVipBenefitMatrix(tt: VipBenefitTt): {
  columns: string[]
  rows: VipBenefitMatrixRow[]
} {
  return {
    columns: MATRIX_COLUMNS.map((column) => tt(column.key, column.fallback)),
    rows: MATRIX_ROWS.map((row) => ({
      id: row.id,
      label: tt(row.labelKey, row.labelFallback),
      values: row.values.map((value) => resolveValue(value, tt)),
    })),
  }
}

/** 3 个入口卡片(回调由壳页注入) */
export function resolveVipBenefitEntries(tt: VipBenefitTt): Omit<VipBenefitEntry, 'onPress'>[] {
  return [
    { id: 'level', label: tt('vip.privilege.levelIntro', '会员等级介绍') },
    { id: 'trader', label: tt('vip.privilege.traderIntro', '操盘手介绍') },
    { id: 'privateAdvisory', label: tt('vip.privilege.privateAdvisory', '私董会权益') },
  ]
}

/** 头部等级信息:name 优先,其次按 level 映射,最后未开通 */
export function resolveVipBenefitHeader(
  info: { level?: number; name?: string; expireTime?: string } | null,
  tt: VipBenefitTt,
): VipBenefitHeaderInfo {
  const level = info?.level ?? 0
  const isOpened = level > 0
  const name = info?.name?.trim()
  const levelMap: Record<number, string> = {
    1: tt('vip.privilege.levelMonth', '月度会员'),
    2: tt('vip.privilege.levelQuarter', '季度会员'),
    3: tt('vip.privilege.levelYear', '年度会员'),
  }
  const levelName = isOpened
    ? name || levelMap[level] || tt('vip.privilege.levelNormal', '普通会员')
    : tt('vip.privilege.notOpened', '未开通会员')
  return {
    levelName,
    isOpened,
    title: tt('vip.privilege.title', '会员权益'),
    expireText:
      isOpened && info?.expireTime
        ? `${tt('vip.privilege.expireTime', '到期时间')}：${info.expireTime}`
        : undefined,
    activateHint: tt('vip.privilege.openHint', '开通会员享受全部权益'),
  }
}

/** 弹层内容(不含回调);kind 与入口 id 一一对应 */
export function resolveVipBenefitPopup(
  kind: VipBenefitEntry['id'],
  tt: VipBenefitTt,
):
  | {
      kind: 'matrix'
      title: string
      primaryLabel: string
      columns: string[]
      rows: VipBenefitMatrixRow[]
      desc: string
      highlightColumn: number
    }
  | {
      kind: 'benefits'
      title: string
      primaryLabel: string
      intro: string
      items: string[]
    } {
  const primaryLabel = tt('vip.privilege.goOpen', '去开通')
  if (kind === 'level') {
    const matrix = resolveVipBenefitMatrix(tt)
    return {
      kind: 'matrix',
      title: tt('vip.privilege.levelIntro', '会员等级介绍'),
      primaryLabel,
      columns: matrix.columns,
      rows: matrix.rows,
      desc: tt(
        'vip.privilege.matrixDesc',
        '1元=1点成长值，升级会员享受更高权益。全部课程/算力/自动化智能体/知识库/定制服务等，持续增加功能。',
      ),
      highlightColumn: 3,
    }
  }
  if (kind === 'trader') {
    return {
      kind: 'benefits',
      title: tt('vip.privilege.traderIntro', '操盘手介绍'),
      primaryLabel,
      intro: tt(
        'vip.privilege.traderDesc',
        '操盘手是平台认证的专业市场分析角色，享有专属数据工具与一对一指导服务。',
      ),
      items: TRADER_BENEFITS.map((item) => tt(item.key, item.fallback)),
    }
  }
  return {
    kind: 'benefits',
    title: tt('vip.privilege.privateAdvisory', '私董会权益'),
    primaryLabel,
    intro: tt(
      'vip.privilege.privateAdvisoryDesc',
      '私董会是平台最高端会员圈层，汇聚行业大咖，享有一对一顾问与闭门沙龙参与权。',
    ),
    items: PRIVATE_BENEFITS.map((item) => tt(item.key, item.fallback)),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
