// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/lib/readme-prose-sync.mjs
// ─────────────────────────────────────────────────────────────────────────
// sync-readme-numbers 的散文覆盖面:与门 173 / 清偿器 173 同一套判据与替换(不另写正则)。
//   · 只处置「最后一枚 END RECENT UPDATES」之前的活性区;历史快照区不批量改写(防跑步机);
//   · 生成块重建只换 BEGIN/END 之间,块前/块后逐字不动;
//   · 两者均幂等:无可处置行时原样返回。
// ─────────────────────────────────────────────────────────────────────────
import { findStaleClaims } from '../check-doc-numbers.mjs'
import { applyPlan, planDoc, scopeLines } from '../scrub-doc-numbers.mjs'

/** 刷活性区散文数字。@returns {{text: string, edits: number}} */
export function syncProseText(rel, text, numbers) {
  const violations = findStaleClaims(text, numbers).violations
  const onlyLines = scopeLines(text, 'active', violations)
  if (!onlyLines || onlyLines.size === 0) return { text, edits: 0 }
  const plan = planDoc(rel, text, numbers, { onlyLines })
  if (plan.edits.length === 0) return { text, edits: 0 }
  return { text: applyPlan(text, plan.edits), edits: plan.edits.length }
}

/** 重建生成块:块前/块后原文不动;freshFull 尾部换行去掉,避免 END 后多出空行。 */
export function rebuildBlock(text, freshFull, begin, end) {
  const bi = text.indexOf(begin)
  const ei = text.indexOf(end)
  if (bi === -1 || ei === -1 || ei < bi) return text
  return text.slice(0, bi) + freshFull.replace(/\n+$/, '') + text.slice(ei + end.length)
}

export const __test__ = { syncProseText, rebuildBlock }
