// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * landing-worktree-align.mjs —— 旁路落地(CAS 成功)**之后就地对齐共享索引与工作树**的唯一出口。
 *
 * ## 立因(2026-11-05 结构缺陷票,已取证)
 *
 * `union-converge --apply` 与 `object-space-land` 用 `commit-tree + update-ref CAS` 推进 HEAD,
 * **从不回写共享主索引、从不 checkout 工作树**。于是新 HEAD 里新增的路径"索引里没有、磁盘上也没有",
 * `git status` 恒显 `D `;任何一次不带 pathspec 的 `git add -A` / 普通提交都会把"文件缺席"固化成
 * 暂存删除。历史从未删过那些文件(`git log --all --diff-filter=D` 为空),而
 * `safe-commit-attestation.jsonl` 的 declaredFiles 里正列着它们 —— 这是落地器留下的账,不是删除。
 *
 * ## 两条判据(顺序不能反)
 *
 *  ① **索引**:复用 `lib/bypass-git.mjs` 的 `alignSharedIndex`。它只在"索引 blob == 父提交 blob
 *     或索引里没有该路径"时动,别人真暂存过的一律不动并点名 —— 绝不覆盖他人未提交改动。
 *  ② **工作树**:索引对齐后,若磁盘仍没有该路径,再从新 HEAD checkout 到工作树。只对齐索引而不落盘
 *     会留下"索引有、磁盘无"的同类残局;而构建读的是磁盘,缺文件就是编译失败。
 *
 * 失败/让路**逐条点名**,不做静默跳过:调用方必须把返回值里的 `failed` / `skipped` / `undetermined`
 * 原样打印。删除路径(want=ABSENT)由 `alignSharedIndex` 清掉索引残留,本层不碰磁盘
 * (不删别人的工作树副本)。
 *
 * ## 崩因(Z42 实测 → Z63 修,2026-11-06)
 *
 * `alignSharedIndex` 有**两条把桶写成数字而不是数组**的出口(见 `lib/bypass-git.mjs` 的
 * `lockAbandoned` 档与"轮次耗尽"档:`{ moved: 0, already: 0, … }`)。本层旧写法
 * `[...(align.moved ?? [])]` 里 `0 ?? []` 仍是 `0`(`??` 只对 null/undefined 回落),
 * `...0` ⇒ **TypeError: 0 is not iterable**。崩点正落在 CAS 之后、打印点名之前,于是:
 *   ① 索引/工作树一个字都没对齐(HEAD 已推进 ⇒ 每次都欠一条"落地欠回写"债,靠 §5b-④ 事后兜);
 *   ② 连"锁龄超上限"那句点名和 exit 1 都丢了,现场只剩一条裸栈。
 * 并发会话持有 `.git/index.lock` 超 120s 是本仓常态 ⇒ 这条崩不是偶发,是**每次旁路落地的地雷**。
 *
 * 同轮补齐的两格(§0.3「没判」绝不写成「判过」):
 *  - `headBlobOf` 把「路径不在新树」与「ref 本身解析不到/git 问不到」**都压成 ABSENT**,
 *    旧写法一律 `continue` ⇒ 后者被当成前者静默放过;现多问一次 ref 可达性,不可达即逐条未判定。
 *  - `indexBlobOf` 返回 UNKNOWN(索引问不到)旧写法进 `failed` 并说成"他人已暂存"——
 *    那是**编造归因**;现归 `undetermined` 并如实说"问不到"。
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { ABSENT, UNKNOWN, alignSharedIndex, git, headBlobOf, indexBlobOf } from './bypass-git.mjs'

/**
 * 把下层某个桶归一成数组。**非数组 ⇒ 返回 null**,由调用方落「未判定」并点名形态,
 * 绝不把 `0` 当「0 条都对齐了」用(那正是旧崩溃 + 静默假绿的两条根)。
 */
function bucketList(value) {
  return Array.isArray(value) ? value : null
}

/** 非字符串条目的可 grep 描述(不含可能超长/含凭据的内容)。 */
function describeEntry(value, index) {
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  return `(paths[${index}]:${kind})`
}

/** paths 入参归一:非字符串条目不静默丢,逐条带回(留痕记录缺字段那一型)。 */
function normalizePaths(paths) {
  const list = []
  const malformed = []
  if (Array.isArray(paths)) {
    paths.forEach((p, i) => {
      if (typeof p === 'string' && p.trim() !== '') {
        if (!list.includes(p)) list.push(p)
      } else malformed.push({ value: p, index: i })
    })
  }
  return { list, malformed }
}

/**
 * ref 是否解析得到(每次调用只问一次 git)。必须有这一把,是因为 `headBlobOf` 拿
 * `rev-parse --verify --quiet <ref>:<path>` 的 null 同时表达「不在树」与「ref 不可达 / git 问不到」,
 * 本层要分清才能决定该 `continue`(真删除)还是该点名(未判定)。
 */
function makeRefProbe(ref, root) {
  let probed = null
  return () => {
    if (probed === null) {
      probed =
        git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { root, allowFail: true }) !==
        null
    }
    return probed
  }
}

/**
 * @param {{root:string, paths:string[], parentRef:string, ref?:string}} a
 * @returns {{
 *   aligned:string[], checkedOut:string[],
 *   skipped:Array<{path:string,reason:string}>,
 *   undetermined:Array<{path:string,reason:string}>,
 *   failed:Array<{path:string,reason:string}>,
 *   lockAbandoned:boolean, alignFailed:boolean
 * }}
 */
export function alignLandingPaths({ root, paths, parentRef, ref = 'HEAD' }) {
  const { list, malformed } = normalizePaths(paths)
  const align = alignSharedIndex({ root, paths: list, parentRef }) ?? {}
  const failed = []
  const checkedOut = []
  const undetermined = malformed.map((m) => ({
    path: describeEntry(m.value, m.index),
    reason: 'paths 入参该条不是非空字符串(留痕记录缺字段/形态坏)⇒ 不进对齐射程,不静默丢',
  }))

  // 四个桶都先归一再消费:非数组形态一律点名,不冒充「0 条」(崩因修复的正身)。
  const shapeAnomalies = []
  const pick = (key) => {
    const v = align[key]
    const asList = bucketList(v)
    if (asList === null) shapeAnomalies.push({ key, value: v })
    return asList ?? []
  }
  const moved = pick('moved')
  const already = pick('already')
  const skipped = pick('skipped')
  const undetFromAlign = pick('undetermined')

  if (align.lockAbandoned)
    failed.push({ path: '(.git/index.lock)', reason: '锁龄超上限:不代删别人的锁' })
  if (align.failed) failed.push({ path: '(.git/index)', reason: align.error ?? '索引对齐未完成' })
  if (!align.failed && !align.lockAbandoned) {
    const refResolvable = makeRefProbe(ref, root)
    for (const p of list) {
      const want = headBlobOf(ref, p, { root })
      if (want === ABSENT) {
        // 两种截然不同的含义都长这样,必须先分清再决定放过还是点名:
        //   ref 解析不到 ⇒ 未判定(不 checkout、不报绿);ref 解析得到 ⇒ 本次真删,索引残留已由下层清掉。
        if (!refResolvable()) {
          undetermined.push({
            path: p,
            reason: `新 ${ref} 里问不到该路径,且 ${ref} 本身解析不到 ⇒ 分不清「本次删除」还是「HEAD 断言取空」,不猜`,
          })
          continue
        }
        continue // 本次提交把它删了:索引残留已由 alignSharedIndex 清掉
      }
      const cur = indexBlobOf(p, { root })
      if (existsSync(resolve(root, p))) continue
      if (cur === UNKNOWN) {
        // 归属问不到 ⇒ 未判定;不得写成「他人已暂存」(那是编造归因)。
        undetermined.push({
          path: p,
          reason: '索引问不到(git 不可达)⇒ 无法判定该路径归属,不 checkout 也不报绿',
        })
        continue
      }
      // 索引里是别人暂存的第三个 blob ⇒ 不回写(§12:不覆盖他人未提交改动),点名。
      if (cur !== ABSENT && cur !== want) {
        failed.push({
          path: p,
          reason: `索引=${String(cur).slice(0, 9)} ≠ 新 ${ref}=${String(want).slice(0, 9)} ⇒ 他人已暂存,不覆盖`,
        })
        continue
      }
      try {
        git(['checkout', ref, '--', p], { root })
        if (existsSync(resolve(root, p))) checkedOut.push(p)
        else failed.push({ path: p, reason: `checkout ${ref} 后磁盘仍无该文件` })
      } catch (e) {
        failed.push({
          path: p,
          reason: `checkout ${ref} 失败:${String(e?.message ?? e).slice(0, 160)}`,
        })
      }
    }
  }
  for (const a of shapeAnomalies) {
    undetermined.push({
      path: `(.git/index:${a.key})`,
      reason:
        `下层 alignSharedIndex 的 ${a.key} 桶形态不是数组(收到 ${JSON.stringify(a.value) ?? String(a.value)} · typeof ${typeof a.value})` +
        ' ⇒ 本轮逐路径对齐结果未判定,不冒充 0 条(2026-11-06 Z42 崩溃型)',
    })
  }
  return {
    aligned: [...moved, ...already],
    checkedOut,
    skipped,
    undetermined: [...undetFromAlign, ...undetermined],
    failed,
    lockAbandoned: !!align.lockAbandoned,
    alignFailed: !!align.failed,
  }
}

export const __test__ = { alignLandingPaths, bucketList, normalizePaths, describeEntry }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
