// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会计科目模板(账套初始化唯一来源)。
 *
 * 覆盖:小企业会计准则常用科目 + 企业会计准则的常见资产/成本类科目。
 * 目的:让"新建账套"一步得到可直接做账的科目表,不需要人工从零录 80 个科目。
 *
 * 编码层级:4 位一级 / 6 位二级 / 8 位三级;父级编码 = 上级前缀。
 * direction 表示**余额方向**(不是发生方向):"应交增值税—进项税额"余额在借方,
 * 所以 direction=debit 而 category=liability —— 报表按方向取数列示。
 */

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cost'
export type BalanceDirection = 'debit' | 'credit'

export interface AccountSeed {
  code: string
  name: string
  category: AccountCategory
  direction: BalanceDirection
  /** 辅助核算开关(客户/项目/部门/员工) */
  aux?: Record<string, boolean>
  /** 父级科目编码;一级科目不填 */
  parentCode?: string
}

/** 常用科目模板(小企业会计准则为主体,补齐成本类与税费明细)。 */
export const DEFAULT_CHART: readonly AccountSeed[] = [
  // ===== 资产 =====
  { code: '1001', name: '库存现金', category: 'asset', direction: 'debit' },
  { code: '1002', name: '银行存款', category: 'asset', direction: 'debit' },
  { code: '1012', name: '其他货币资金', category: 'asset', direction: 'debit' },
  {
    code: '1121',
    name: '应收票据',
    category: 'asset',
    direction: 'debit',
    aux: { customer: true },
  },
  {
    code: '1122',
    name: '应收账款',
    category: 'asset',
    direction: 'debit',
    aux: { customer: true },
  },
  {
    code: '1123',
    name: '预付账款',
    category: 'asset',
    direction: 'debit',
    aux: { customer: true },
  },
  {
    code: '1221',
    name: '其他应收款',
    category: 'asset',
    direction: 'debit',
    aux: { employee: true },
  },
  { code: '1401', name: '材料采购', category: 'asset', direction: 'debit' },
  { code: '1402', name: '在途物资', category: 'asset', direction: 'debit' },
  { code: '1403', name: '原材料', category: 'asset', direction: 'debit' },
  { code: '1405', name: '库存商品', category: 'asset', direction: 'debit' },
  { code: '1408', name: '委托加工物资', category: 'asset', direction: 'debit' },
  { code: '1411', name: '周转材料', category: 'asset', direction: 'debit' },
  {
    code: '1601',
    name: '固定资产',
    category: 'asset',
    direction: 'debit',
    aux: { department: true },
  },
  { code: '1602', name: '累计折旧', category: 'asset', direction: 'credit' },
  { code: '1604', name: '在建工程', category: 'asset', direction: 'debit' },
  { code: '1606', name: '固定资产清理', category: 'asset', direction: 'debit' },
  { code: '1701', name: '无形资产', category: 'asset', direction: 'debit' },
  { code: '1702', name: '累计摊销', category: 'asset', direction: 'credit' },
  { code: '1801', name: '长期待摊费用', category: 'asset', direction: 'debit' },

  // ===== 负债 =====
  { code: '2001', name: '短期借款', category: 'liability', direction: 'credit' },
  {
    code: '2201',
    name: '应付票据',
    category: 'liability',
    direction: 'credit',
    aux: { customer: true },
  },
  {
    code: '2202',
    name: '应付账款',
    category: 'liability',
    direction: 'credit',
    aux: { customer: true },
  },
  {
    code: '2203',
    name: '预收账款',
    category: 'liability',
    direction: 'credit',
    aux: { customer: true },
  },
  { code: '2211', name: '应付职工薪酬', category: 'liability', direction: 'credit' },
  { code: '2221', name: '应交税费', category: 'liability', direction: 'credit' },
  {
    code: '222101',
    name: '应交增值税—进项税额',
    category: 'liability',
    direction: 'debit',
    parentCode: '2221',
  },
  {
    code: '222102',
    name: '应交增值税—销项税额',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222103',
    name: '应交增值税—进项税额转出',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222104',
    name: '应交增值税—已交税金',
    category: 'liability',
    direction: 'debit',
    parentCode: '2221',
  },
  {
    code: '222105',
    name: '应交增值税—转出未交增值税',
    category: 'liability',
    direction: 'debit',
    parentCode: '2221',
  },
  {
    code: '222106',
    name: '未交增值税',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222107',
    name: '应交城市维护建设税',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222108',
    name: '应交教育费附加',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222109',
    name: '应交地方教育附加',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222110',
    name: '应交印花税',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222111',
    name: '应交企业所得税',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  {
    code: '222112',
    name: '应交个人所得税',
    category: 'liability',
    direction: 'credit',
    parentCode: '2221',
  },
  { code: '2241', name: '其他应付款', category: 'liability', direction: 'credit' },
  { code: '2501', name: '长期借款', category: 'liability', direction: 'credit' },
  { code: '2701', name: '长期应付款', category: 'liability', direction: 'credit' },

  // ===== 所有者权益 =====
  { code: '3001', name: '实收资本', category: 'equity', direction: 'credit' },
  { code: '3002', name: '资本公积', category: 'equity', direction: 'credit' },
  { code: '3101', name: '盈余公积', category: 'equity', direction: 'credit' },
  { code: '3103', name: '本年利润', category: 'equity', direction: 'credit' },
  { code: '3104', name: '利润分配', category: 'equity', direction: 'credit' },

  // ===== 成本 =====
  { code: '4001', name: '生产成本', category: 'cost', direction: 'debit', aux: { project: true } },
  {
    code: '4002',
    name: '制造费用',
    category: 'cost',
    direction: 'debit',
    aux: { department: true },
  },
  { code: '4101', name: '劳务成本', category: 'cost', direction: 'debit' },
  { code: '4301', name: '研发支出', category: 'cost', direction: 'debit', aux: { project: true } },

  // ===== 损益 =====
  {
    code: '5001',
    name: '主营业务收入',
    category: 'revenue',
    direction: 'credit',
    aux: { customer: true },
  },
  { code: '5051', name: '其他业务收入', category: 'revenue', direction: 'credit' },
  { code: '5111', name: '投资收益', category: 'revenue', direction: 'credit' },
  { code: '5301', name: '营业外收入', category: 'revenue', direction: 'credit' },
  { code: '5401', name: '主营业务成本', category: 'expense', direction: 'debit' },
  { code: '5402', name: '其他业务成本', category: 'expense', direction: 'debit' },
  { code: '5403', name: '税金及附加', category: 'expense', direction: 'debit' },
  {
    code: '5501',
    name: '销售费用',
    category: 'expense',
    direction: 'debit',
    aux: { department: true },
  },
  {
    code: '5502',
    name: '管理费用',
    category: 'expense',
    direction: 'debit',
    aux: { department: true },
  },
  { code: '5503', name: '财务费用', category: 'expense', direction: 'debit' },
  { code: '5504', name: '研发费用', category: 'expense', direction: 'debit' },
  { code: '5601', name: '营业外支出', category: 'expense', direction: 'debit' },
  { code: '5701', name: '所得税费用', category: 'expense', direction: 'debit' },
] as const

export interface ResolvedAccount extends AccountSeed {
  level: number
  isLeaf: boolean
}

/**
 * 把扁平模板补全成带层级/末级标记的科目表。
 *
 * 规则:
 *   · level = 父链深度(一级 1);
 *   · isLeaf = 没有任何科目的 parentCode 指向它;
 *   · 父级编码必须在同一份模板里存在,否则抛错(防"悬空父级"让报表汇总穿透不到)。
 */
export function resolveChart(seed: readonly AccountSeed[] = DEFAULT_CHART): ResolvedAccount[] {
  const byCode = new Map(seed.map((a) => [a.code, a]))
  const parents = new Set<string>()
  for (const a of seed) {
    if (a.parentCode) {
      if (!byCode.has(a.parentCode)) {
        throw new Error(`科目模板父级缺失:${a.code} 的 parentCode=${a.parentCode} 不在模板内`)
      }
      parents.add(a.parentCode)
    }
  }
  const levelOf = (code: string, seen = new Set<string>()): number => {
    if (seen.has(code)) throw new Error(`科目模板存在环:${code}`)
    seen.add(code)
    const node = byCode.get(code)
    if (!node?.parentCode) return 1
    return levelOf(node.parentCode, seen) + 1
  }
  return seed.map((a) => ({ ...a, level: levelOf(a.code), isLeaf: !parents.has(a.code) }))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
