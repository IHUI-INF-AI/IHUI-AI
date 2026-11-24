// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * bypass-deletion-gate.mjs —— **旁路合并不许顺手删掉 `apps/**`、`packages/**`、`config/**`** 的硬门
 * (2026-11-05;`config/**` 于 2026-11-15 补入射程,立因见文末「射程补入」)。
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
 *
 * ## 射程补入 `config/**`(2026-11-15,本轮合并实测咬出)
 *
 * 旧射程只有 `apps|packages`。实测:`69ce958a9b2`「全量同步工作区并交付 AI 浮窗八向拉伸缩放」
 * 删掉 `config/relay-irreversible-verdicts.json`,而它的两处消费方在 origin/main **都还在** ——
 * `apps/api/src/services/relay-account-pool-scheduler.ts:415` 用
 * `new URL('../../../../config/relay-irreversible-verdicts.json', import.meta.url)` 后
 * `readFileSync`,`scripts/relay-account-keepalive.mjs:95` 用
 * `require('../config/relay-irreversible-verdicts.json')`。文件缺席时两端在**模块加载期**抛
 * ENOENT:号池调度器整条链起不来、6h 保活脚本同理。而本次合并把它按「对侧相对基底删除 ∧
 * 本侧相对基底未改动」**静默传播**了 —— 引用图一次都没有被问过,因为该路径压根不在射程内。
 *
 * 判据不新增第二条:`config/` 装的是运行时配置,被生产代码用**硬编码相对路径**直接读,
 * 与 `apps/**` / `packages/**` 同属「删了构建或运行即断」的一类。故只是把既有两条判据
 * (落地树 0 引用 ∧ 台账有效通知书)的射程扩到它,阈值与出口一字未动。
 * 失效方向仍是拦:config 内一次**真**删除要么写通知书,要么先摘引用。
 */
import { readFileDeletionNotices, isDeletionDeclared } from './intentional-file-deletion.mjs'
import { findReferencersInRev } from './rev-reference-graph.mjs'

/** 只有生产代码/包产物/运行时配置才值得把"删了会不会打断构建"抬成硬门。 */
export const GUARDED_DELETE_RE = /^(?:apps|packages|config)\//

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
    // 2026-11-05:门 99 的 collectHits 把 `"path":"x"` 这类**路径字面量**(form=path-literal)也算引用,
    // 那是它 E1 的取证口径;本门问的是"删了会不会让构建在干净检出上直接失败"。`scripts/**` 里指向
    // 被删路径的字面量(删除意图台账、回归夹具)不是 import/require,删掉后构建不受影响 —— 远端本批
    // 删除 model-edit-save 孤儿层时把台账条目与夹具写进 scripts/**,于是下一次 union 合并恒红死锁。
    // 故只把 scripts/** 下的 path-literal 移出本门的引用面;relative/alias 形态与 apps/**、packages/**
    // 内的任何形态照旧判红(门的阈值与判据不变)。
    //
    // 2026-11-15:**二进制资产(图片/字体/音视频)的 alias 形态命中一律不作证据**。alias 是按
    // basename 撞名收的,而 `logo.png` / `icon.png` / `logo-dark.png` 这类名字在 web public、
    // 各端 assets、邮件模板里到处都是,且形态全是以 `/` 开头的 web URL 或 `${SITE_URL}/...`
    // 模板串。实测要删 `apps/miniapp-taro/mobile-rn/assets/images/logo.png` 时收到 29 条命中:
    // 28 条是 `/images/logo.png?v=...`(web public 目录 URL,与被删的嵌套副本同名不同物),
    // 1 条是 `apps/mobile-rn/scripts/regen-app-icons.py` 里指向 RN 自己那份资产的相对路径;
    // 连 `logo-dark.png` 的命中都是 `theme-logo.tsx:53` 的 `/images/logo-dark.svg` —— 扩展名都不同。
    // 这类条目证明不了"删了会断链",却让每一次跨越「c33dd54e9b 批量退役 mobile-rn 资产副本」的
    // 合并恒红(fail-closed 到无路可走)。真引用(`import x from './logo.png'`)走 relative 形态,
    // 仍然照旧判红,门的阈值不变。
    const isBinaryAsset = /\.(?:png|jpe?g|gif|webp|svg|ico|bmp|avif|woff2?|ttf|otf|mp3|mp4|wav|webm)$/i.test(p)
    const hits = (ref.hits.get(p) || []).filter(
      (h) =>
        !(h.form === 'path-literal' && /^scripts\//.test(h.file)) &&
        !(h.form === 'alias' && isBinaryAsset),
    )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
