// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 遗留支付账段组装(原 apps/api/src/routes/edu-ai-management.ts 内联实现,门 103 C1 收口时下沉)。
 *  行为的形状约定与调用点契约见路由里的转出口注释。 */
/**
 * 遗留表历史账段组装(G-816106 ⑤,拍板 2026-10-07)。抽成纯函数的理由与缴费契约同:
 * 「legacy 段每行必带 source:'legacy' + 自己的操作日志;没日志的行给空数组而不是 undefined」
 * 这条形状约定,翻坏时 typecheck 不响(web 端 `p.logs.map` 直接炸),必须有一条不连库
 * 就能钉住的断言(测试见 apps/api/tests/edu-legacy-paylog-contract.test.ts)。
 * 口径边界:遗留行只读展示、不参与欠费/汇总;分组保持入参顺序(SQL 侧已按 createTime 升序)。
 */
export interface LegacyPayRow {
  payId: number
  userUuid: string
  courseId: number
  orderNo: string | null
  amount: number
  status: number
  createTime: Date | null
}
export interface LegacyPayLogRow {
  payId: number
  action: string
  detail: string | null
  createTime: Date | null
}
export function buildLegacySegment(
  pays: LegacyPayRow[],
  logs: LegacyPayLogRow[],
  total: number,
): {
  source: 'legacy'
  total: number
  list: Array<LegacyPayRow & { source: 'legacy'; logs: Array<Omit<LegacyPayLogRow, 'payId'>> }>
} {
  const logsByPay = new Map<
    number,
    { action: string; detail: string | null; createTime: Date | null }[]
  >()
  for (const l of logs) {
    const arr = logsByPay.get(l.payId)
    if (arr) arr.push({ action: l.action, detail: l.detail, createTime: l.createTime })
    else logsByPay.set(l.payId, [{ action: l.action, detail: l.detail, createTime: l.createTime }])
  }
  return {
    source: 'legacy' as const,
    total,
    list: pays.map((p) => ({
      ...p,
      source: 'legacy' as const,
      logs: logsByPay.get(p.payId) ?? [],
    })),
  }
}

/**
 * F-699:汇总各学习计划完成率。
 * pg 的 `count()` 走 int8,驱动按字符串返回;直接 `sum + completedItems`
 * 会变成字符串拼接(两个计划 5/6、3/6 → "053" → 53/12 = 442%)。
 * 这里统一 Number() 归一化,与 SQL 侧 `::int` 双保险。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
