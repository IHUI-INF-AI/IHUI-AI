// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { ABSENT, alignSharedIndex, git, headBlobOf, indexBlobOf } from './bypass-git.mjs'

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
  const list = [...new Set((paths ?? []).filter(Boolean))]
  const align = alignSharedIndex({ root, paths: list, parentRef })
  const failed = []
  const checkedOut = []
  if (align.lockAbandoned)
    failed.push({ path: '(.git/index.lock)', reason: '锁龄超上限:不代删别人的锁' })
  if (align.failed) failed.push({ path: '(.git/index)', reason: align.error ?? '索引对齐未完成' })
  if (!align.failed && !align.lockAbandoned) {
    for (const p of list) {
      const want = headBlobOf(ref, p, { root })
      if (want === ABSENT) continue // 本次提交把它删了:索引残留已由 alignSharedIndex 清掉
      const cur = indexBlobOf(p, { root })
      if (existsSync(resolve(root, p))) continue
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
        failed.push({ path: p, reason: `checkout ${ref} 失败:${String(e?.message ?? e).slice(0, 160)}` })
      }
    }
  }
  return {
    aligned: [...(align.moved ?? []), ...(align.already ?? [])],
    checkedOut,
    skipped: align.skipped ?? [],
    undetermined: align.undetermined ?? [],
    failed,
    lockAbandoned: !!align.lockAbandoned,
    alignFailed: !!align.failed,
  }
}

export const __test__ = { alignLandingPaths }
