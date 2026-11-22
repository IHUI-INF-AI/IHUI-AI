// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * staged-ownership.mjs — 「索引里已暂存但不在本票声明集」的只读点名判据(票 O67,2026-10-31)。
 *
 * 立因(现读实测两起后果):执行席违规 `git add` 把 `packages/i18n` 与
 * `apps/api/src/services/relay-task-center.ts` 放进共享索引 → 被别席**不带 pathspec 的普通提交**
 * 卷走 → HEAD 面生产码与用例的版本形状分家(测试现读 `1 failed | 8 passed`)。而 O43② 的基线
 * 刻意取「此刻全量索引」,只拦钩子窗口期**新进**的件 ⇒「发令前索引里已混着别人的件」这一型
 * 结构上无人喊。
 *
 * 纪律:这一层**只判"哪些不是本票的",绝不拒发** —— 多会话共写同一索引是本仓常态,拒发即造
 * 与提交内容无关的恒堵门(§12e);真正的拦截归 §22c 的 Step 3(暂存集必须精确等于声明集)。
 *
 * 纯函数,零 IO:调用方给路径清单,本层只做归一化与差集;输出面按 `normalize` 同一把尺算,
 * 避免 Windows 反斜杠/`./` 前缀造成假阳性。
 */

/** 与 safe-commit 的 normalize 同一口径(反斜杠 → 正斜杠、去 `./` 前缀)。 */
export function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * 差集:`staged ⊖ declared`,保序去重(按归一路径)。
 * @param {string[]} stagedPaths 当前索引里的全部路径
 * @param {string[]} declaredFiles 本票声明的路径
 * @returns {string[]} 未声明的已暂存路径(原样形态,保序)
 */
export function partitionUndeclaredStaged(stagedPaths, declaredFiles) {
  const declared = new Set((declaredFiles ?? []).map(normalizePath))
  const seen = new Set()
  const extra = []
  for (const raw of stagedPaths ?? []) {
    const key = normalizePath(raw)
    if (declared.has(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    extra.push(String(raw))
  }
  return extra
}

/**
 * 渲染点名行。零条 ⇒ `null`(调用方据此打"全部属于本票"的通过行,而不是空警告)。
 * @param {string[]} extra
 * @param {{limit?: number}} [opts]
 */
export function formatUndeclaredLine(extra, { limit = 8 } = {}) {
  if (!Array.isArray(extra) || extra.length === 0) return null
  const head = extra.slice(0, limit).join(', ')
  const rest = extra.length > limit ? ` …另 ${extra.length - limit} 条` : ''
  return `索引归属对账:${extra.length} 个已暂存件**不在本票声明集**(只点名,不拒发 —— 多会话共写索引是常态): ${head}${rest}`
}

export const __test__ = { normalizePath, partitionUndeclaredStaged, formatUndeclaredLine }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
