// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-BYPASS 2026-11-01

/**
 * scripts/lib/conflict-marker-landing-gate.mjs —— 旁路落地源头的冲突标记判据(L33560)。
 *
 * 立因(票面原文,2026-11-01 实测两轮):`check-no-conflict-markers.mjs`(守门 79)已经在,但它只在
 * pre-commit / `--rev` / 全量审计这三种**事后**面上跑;旁路通道(`union-converge` 的活文档行级 union、
 * `object-space-land` 的 `commit-tree` 落地)**一次都没调用它** —— `grep -rn "no-conflict-markers" scripts/*.mjs`
 * 除自身只有 `guardian-runner`。于是「标记被摘掉 → 下一枚并集按'对侧在场即补回'捞回」这个循环
 * 可以无限重复:门只在捞回之后喊,喊完还是同一枚提交形状。
 *
 * 本文件只做一件新事:**在落地之前,对'将要落地的那份内容'问一次同一套 P1/P2 判据**,并且按票面要求
 * 把「区域内两侧皆空 ⇒ 摘标记不丢内容」与「两侧真内容被静默丢掉」**分成两档**判:
 *   - `empty-region`(两侧都没有任何非空内容行,或只有空白行)⇒ `strippable`:摘掉三行不丢内容。
 *     这一档**不拦落地**,只报"建议摘除"。把它一律判红 = 票面明令禁止的"一律禁止手删";
 *   - `content-loss`(任一侧有非空内容行)⇒ `must-block`:落地就等于把 git 写给机器看的分节线
 *     当正文带进 HEAD,或逼人二选一而静默丢一侧。这一档**拦落地**并点名行号原文。
 *
 * 判据单一真相源(§0.6/§22c):
 *   "什么算成对标记"**不在这里定义** —— 一律 import `lib/conflict-marker-triples.mjs` 的
 *   `findMarkerPairs`。本文件一个新正则都没有,只回答"这一对的区域内有没有正文"。
 *   模块级私有正则只有"空白行"这一条(`NON_BLANK` 的取反),它不是冲突标记判据。
 *   由此**自动继承**两条既有边界,不再各写一遍:
 *     ① `=======` 单行不判(P2):它不在 `pairs` 里;
 *     ② `<<<<<<< SEARCH` / `>>>>>>> REPLACE` 是 CLI patch 语法,归 `exempt` 不进 `pairs`(E1)⇒ 不判。
 *        这正解释了大盘 HEAD 上 `apps/cli/tests/file-edit.test.ts` 那一处**不误报**的原因。
 *
 * 失效方向(§0.10):
 *   `content-loss` 这一档宁可多要一次定向说明,绝不"顺手放行";`empty-region` 这一档只报告不拦,
 *   是为**不让它退化成一门与提交内容无关的恒红门**(§12e/§12f)。两档不许合并 —— 合并成"一律拦"
 *   会让空区永远只能靠人工摘(那就回到本票的立项现场),合并成"一律放"就是静默丢内容。
 *
 * 输入面:文本由调用方取(守门 118 的取材面纪律)。本文件不派生 git、不读盘、不写盘 —— 纯函数。
 * 取不到输入(调用方拿不到 text)由调用方判"未判定",不得传 `null` 冒充"干净"。
 */

import { findMarkerPairs } from './conflict-marker-triples.mjs'

/** 逃生口(与 `IHUI_LAND_SKIP_AFFECTED_GATES` 同族命名,跳过必须出声)。 */
export const LANDING_MARKER_SKIP_ENV = 'IHUI_LAND_SKIP_CONFLICT_MARKER_GATE'

/** 空白行判定:只有这一条是本文件自有的;它不是"什么算冲突标记"的判据。 */
const isBlank = (line) => String(line ?? '').trim() === ''

/**
 * 把一份内容里的**成对标记区块**分型(纯函数,零副作用)。
 *
 * 输入:`text` 任意文本。输出:数组,每项
 *   {
 *     type: 'empty-region' | 'content-loss',
 *     verdict: 'strippable' | 'must-block',
 *     startLine, sepLine, endLine,        // 1 基行号(sepLine 可能为 null:成对但缺分隔行)
 *     startText, endText,                 // 标记行原文(点名用)
 *     oneSideLines, otherSideLines,       // 两侧的非空内容行(报告用,不截断)
 *     reason,                             // 一句话判据依据
 *   }
 *
 * 分型口径:
 *   - `empty-region`:成对 ∧ 有 `=======` 分隔行 ∧ 分隔行两侧**所有行都是空白** ⇒ `strippable`。
 *     注意比 `lib/conflict-marker-triples.mjs` 的 `classifyMarkerTriples`(要求三行**逐行相邻**)
 *     略宽:这里允许两侧各夹若干空行 —— 那些行不是内容,摘标记同样不丢东西;方向偏"不拦",
 *     代价只是"少要一次人工确认",而恒红门(票面已明令禁止的另一端)的代价是整个旁路停摆。
 *   - `content-loss`:其余一切成对形态(任一侧有非空内容行,或成对但缺 `=======` = 形态不可辩护)
 *     ⇒ `must-block`。**两侧内容逐行相同也归这一档**:机器判不出"这一对本来就是同一行的两份",
 *     而误判成 strippable 的代价是静默丢一侧 —— 两害相权,归严。
 *
 * 继承边界(不重写):`=======` 单行不判、SEARCH/REPLACE 补丁对不判 —— 二者都进不到 `pairs`。
 */
export function classifyMarkerRegions(text) {
  const src = String(text ?? '')
  const lines = src.split(/\r?\n/)
  const { pairs } = findMarkerPairs(src)
  const out = []
  for (const p of pairs) {
    const hasSep = p.sepLine !== null && p.sepLine !== undefined
    const oneSide = hasSep ? lines.slice(p.startLine, p.sepLine - 1) : lines.slice(p.startLine, p.endLine - 1)
    const otherSide = hasSep ? lines.slice(p.sepLine, p.endLine - 1) : []
    const oneContent = oneSide.filter((l) => !isBlank(l))
    const otherContent = otherSide.filter((l) => !isBlank(l))
    const isEmpty = hasSep && oneContent.length === 0 && otherContent.length === 0
    out.push({
      type: isEmpty ? 'empty-region' : 'content-loss',
      verdict: isEmpty ? 'strippable' : 'must-block',
      startLine: p.startLine,
      sepLine: hasSep ? p.sepLine : null,
      endLine: p.endLine,
      startText: p.startText,
      endText: p.endText,
      oneSideLines: oneContent,
      otherSideLines: otherContent,
      reason: isEmpty
        ? '区域内两侧零非空内容行 ⇒ 摘掉三行标记不丢任何一侧内容'
        : hasSep
          ? '任一侧有非空内容行 ⇒ 落地即把分节线当正文,或逼人二选一而静默丢一侧'
          : '成对但缺整行 ======= 分隔 ⇒ 形态不可辩护,保守归严',
    })
  }
  return out
}

/**
 * 单文件判定(纯函数):把 `classifyMarkerRegions` 的结果汇成一份结论。
 * `verdict`:'clean' | 'strippable' | 'must-block'(有任一 must-block 即 must-block,优先于建议)。
 */
export function judgeLandingText(relPath, text) {
  const regions = classifyMarkerRegions(text)
  const mustBlock = regions.filter((r) => r.verdict === 'must-block')
  const strippable = regions.filter((r) => r.verdict === 'strippable')
  return {
    path: String(relPath ?? ''),
    verdict: mustBlock.length ? 'must-block' : strippable.length ? 'strippable' : 'clean',
    regions,
    mustBlock,
    strippable,
  }
}

/** 一条 must-block 的可读点名(文件 + 行号区间 + 标记原文)。 */
export function formatBlockRow(relPath, r) {
  const where = r.sepLine ? `${r.startLine}–${r.endLine}(分隔行 ${r.sepLine})` : `${r.startLine}–${r.endLine}`
  return (
    `${relPath}:${where} 冲突标记区(${r.type}) ⇒ 拒绝落地 —— ` +
    `开头 ${JSON.stringify(String(r.startText).slice(0, 60))} / 结尾 ${JSON.stringify(String(r.endText).slice(0, 60))}` +
    `${r.oneSideLines.length + r.otherSideLines.length ? ` / 区内正文 ${r.oneSideLines.length}+${r.otherSideLines.length} 行` : ''}`
  )
}

/** 一条 strippable 的建议行(建议摘除,不拦)。 */
export function formatStripAdvice(relPath, r) {
  return (
    `${relPath}:${r.startLine}–${r.endLine} 空冲突区(两侧零正文)⇒ 建议摘除三行标记` +
    `(摘掉不丢内容);本判据不拦落地`
  )
}

/**
 * 落地前自检的**总入口**(纯函数 + 可注入 env/log,便于单测直接打)。
 *
 * @param {Array<{path: string, text: string|null}>} entries 将要落地的活文档内容;
 *        `text === null` = 调用方取不到输入 ⇒ 记 `undetermined`(**不记通过**)。
 * @param {{env?: Record<string,string|undefined>, log?: (s:string)=>void}} opts
 * @returns {{verdict: 0|1|2, skipped: boolean, violations: string[], advices: string[], undetermined: string[], judged: number}}
 *   verdict 0 = 干净(或全为空区,只建议);1 = 有 must-block(判红档,与 union-converge 的 bad 同档);
 *   2 = 有格取不到输入(未判定,不冒充通过)。
 *
 * 逃生口:`IHUI_LAND_SKIP_CONFLICT_MARKER_GATE=1` ⇒ 整档跳过并**打一行留痕**(跳过必须出声)。
 * ⚠️ 该逃生口会让本判据完全失效:设了它,旁路落地可以再次把冲突标记三行带进 HEAD。
 */
export function gateLandingMarkers(entries, opts = {}) {
  const env = opts.env || process.env
  const log = opts.log || (() => {})
  const violations = []
  const advices = []
  const undetermined = []
  let judged = 0
  if (env[LANDING_MARKER_SKIP_ENV] === '1') {
    log(
      `⚠️ ${LANDING_MARKER_SKIP_ENV}=1 ⇒ 本次**跳过**落地前冲突标记自检(该行输出即留痕;` +
        `设此变量期间本判据失效,旁路落地可再次把冲突标记带进 HEAD)`,
    )
    return { verdict: 0, skipped: true, violations, advices, undetermined, judged }
  }
  for (const e of entries || []) {
    const path = String(e?.path ?? '')
    if (e?.text === null || e?.text === undefined) {
      undetermined.push(`${path} 取不到内容 ⇒ 未判定(不记通过)`)
      continue
    }
    judged += 1
    const j = judgeLandingText(path, e.text)
    for (const r of j.mustBlock) violations.push(formatBlockRow(path, r))
    for (const r of j.strippable) advices.push(formatStripAdvice(path, r))
  }
  const verdict = violations.length ? 1 : undetermined.length ? 2 : 0
  return { verdict, skipped: false, violations, advices, undetermined, judged }
}

/** 供 §22c 镜像测试与调用方使用的导出锚点。 */
export const __test__ = {
  LANDING_MARKER_SKIP_ENV,
  classifyMarkerRegions,
  judgeLandingText,
  formatBlockRow,
  formatStripAdvice,
  gateLandingMarkers,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
