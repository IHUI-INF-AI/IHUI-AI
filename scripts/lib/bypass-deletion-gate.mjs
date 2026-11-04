// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * bypass-deletion-gate.mjs —— **旁路合并不许顺手删掉 `apps/**`、`packages/**`** 的硬门(2026-11-05)。
 *
 * 立因(结构缺陷票):`union-converge --apply` 的删除传播分支把"对侧相对基底删除 ∧ 本侧未改动"
 * 直接写进合并树。这条规则本身有零丢失证明(逐字同一 blob),但它证明的是**基底那一份字节**
 * 没被改过,证明不了"没人还在引用它"。一次错误的传播删除会让构建在干净检出上直接失败,
 * 而旁路落地不跑钩子 ⇒ 提交链上的悬空导入门对该提交从未执行。
 *
 * 删除必须**同时**满足两条,否则拒绝落地并逐条点名:
 *  (a) 在**即将落地的树**里 0 引用(判据 = 守门 99 的 `collectHits`,经 lib/rev-reference-graph);
 *  (b) `scripts/data/intentional-file-deletions.jsonl` 有该路径的**有效通知书**(reason ≥10 字)。
 *
 * 为什么判"即将落地的树"而不是当前 HEAD:删除是从合并结果里消失,引用图要问的是"合并之后还有谁
 * 指着它"。当前 HEAD 仍含该文件时,拿 HEAD 判会把一次真删除读成 0 引用(假绿)。
 *
 * 未判定(引用面取不到 / 台账坏档)**一律拒绝**:§0.3 —— 判不出不是放行的许可证。
 * 未受保护的前缀(文档、脚本等)不在此门射程内,照样由 `--apply` 的既有落地闸处置。
 */
import { readFileDeletionNotices, isDeletionDeclared } from './intentional-file-deletion.mjs'
import { findReferencersInRev } from './rev-reference-graph.mjs'

/** 只有生产代码/包产物才值得把"删了会不会打断构建"抬成硬门。 */
export const GUARDED_DELETE_RE = /^(?:apps|packages)\//

/**
 * @param {{root:string, rev:string, deletedPaths:string[], notices?:object, timeout?:number}} a
 * @returns {{ok:boolean, guarded:number, blocked:Array<{path:string,reasons:string[]}>, unguarded:string[], hits:Map, undetermined:string[]}}
 */
export function judgeBypassDeletions({
  root,
  rev,
  deletedPaths,
  notices = readFileDeletionNotices(root),
  timeout,
}) {
  const list = [...new Set((deletedPaths ?? []).filter(Boolean))]
  const guarded = list.filter((p) => GUARDED_DELETE_RE.test(p))
  const unguarded = list.filter((p) => !GUARDED_DELETE_RE.test(p))
  if (!guarded.length) return { ok: true, guarded: 0, blocked: [], unguarded, hits: new Map(), undetermined: [] }
  const ref = findReferencersInRev({ root, rev, paths: guarded, ...(timeout ? { timeout } : {}) })
  const blocked = []
  for (const p of guarded) {
    const reasons = []
    const hits = ref.hits.get(p) || []
    if (hits.length)
      reasons.push(
        `落地的树里仍有 ${hits.length} 处引用(${hits
          .slice(0, 3)
          .map((h) => `${h.file}:${h.line}`)
          .join(', ')}${hits.length > 3 ? ' …' : ''})`,
      )
    if (ref.undetermined.length) reasons.push(`引用面未判定:${ref.undetermined.join('; ')}`)
    const decl = isDeletionDeclared(notices, p)
    if (decl.verdict === 'undetermined') reasons.push(`删除意图台账坏档:${decl.why}`)
    else if (!decl.declared) reasons.push('无有效删除意图台账(reason ≥10 字)')
    if (reasons.length) blocked.push({ path: p, reasons })
  }
  return { ok: blocked.length === 0, guarded: guarded.length, blocked, unguarded, hits: ref.hits, undetermined: ref.undetermined }
}

export const __test__ = { GUARDED_DELETE_RE, judgeBypassDeletions }
