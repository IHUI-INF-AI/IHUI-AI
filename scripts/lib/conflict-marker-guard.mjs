// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * conflict-marker-guard.mjs — 落地器共用的"冲突标记不得进树"闸(2026-10-25 立)。
 *
 * 立项实测:11:18 一枚"对象空间手工收敛"把**带成对冲突标记**的 wallboard 页写进 origin/main;
 * 13:04 的 union 合并又按"对侧自身改动"整份照单收下。症状链:标记行对 .tsx 是语法错误
 * ⇒ 下一次 web build/typecheck 必挂 ⇒ 部署环换不出新版本,而账面两枚提交都"成功"。
 * 守门 79 只盯提交链(暂存面),旁路落地器**不跑钩子** ⇒ 79 结构上看不到这些提交。
 * 于是把判据装到旁路自己的收口写点:凡**完整三元组**(`<<<<<<< … ======= … >>>>>>>`,
 * git merge-file 的产物形态)即拒绝。只认完整三元组而非孤立一行:孤立的 `<`×7 是文档/patch
 * 语法的合法内容(与守门 79「孤立标记只报数不判红」同一保守向),真事故里 merge 吐出的必是成套。
 */

const LT = '<'.repeat(7)
const GT = '>'.repeat(7)
const EQ = '='.repeat(7)

const markerHead = (line, tok) => line === tok || (line.startsWith(tok) && /\s/.test(line[tok.length]))

/**
 * 纯判据:完整三元组冲突块的起始行号数组(空 = 干净)。
 * 扫描态:`<<<<<<<` 开 → 其间须遇 `=======` → 再遇 `>>>>>>>` 才记一次;三者缺一不记
 * (宁可漏判一个畸形块,也不给合法文本造假红)。
 */
export function findConflictMarkerRuns(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const hits = []
  let open = -1
  let sawEq = false
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (open < 0) {
      if (markerHead(l, LT)) {
        open = i
        sawEq = false
      }
      continue
    }
    if (l === EQ) {
      sawEq = true
      continue
    }
    if (markerHead(l, GT)) {
      if (sawEq) hits.push(open + 1)
      open = -1
      sawEq = false
      continue
    }
    if (markerHead(l, LT)) open = i // 未闭合再开一段:改锚到新起点(保守取最近,不双计)
  }
  return hits
}

/** 这些文件的工作就是持有/断言这些字面量 ⇒ 不做本闸射程(与 79 的自豁免/patch 语法豁免同构)。 */
const SELF_EXEMPT = /(check-no-conflict-markers|conflict-marker-guard|file-edit)/i

/**
 * 落地口断言:含完整冲突三元组 ⇒ throw(调用方失败路径负责不落地并报人)。
 * `source` 只进消息帮助归因;非字符串/二进制(含 NUL)/无 path 一律不瞎判。
 */
export function assertNoConflictMarkers(path, content, { source = '' } = {}) {
  if (typeof content !== 'string') return
  if (SELF_EXEMPT.test(String(path ?? ''))) return
  if (content.includes('\u0000')) return
  const hits = findConflictMarkerRuns(content)
  if (hits.length > 0) {
    throw new Error(
      `❌ 冲突标记拒绝进树${source ? `(${source})` : ''}:${path} 起始行 ${hits.slice(0, 8).join(', ')} ` +
        `(完整 <<<<====>>>> 三元组)。旁路落地不跑提交链守门 79 ⇒ 本闸是它唯一的牙;` +
        `要解冲突请先逐区取真实内容,union 绝不"取一侧顺手入库"。2026-10-25 wallboard 实况。`,
    )
  }
}

export const __test__ = { findConflictMarkerRuns, assertNoConflictMarkers }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
