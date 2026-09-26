#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/lib/knip-ratchet-face.mjs — Knip 棘轮的"口径可比性"判据(纯函数,不含派生)。
 *
 * 为什么单拆一层:`knip --reporter json` 读的是**磁盘**,而基线锚点是**内容**上的历史读数。
 * 共享工作区常年带着并发会话的未提交改动(本机实测几十个路径),此时量到的数与
 * CI 的干净检出**结构上不可比** —— 拿它判红会误伤,拿它 `--update` 写基线更糟:
 * 数会被永久记偏(偏高=从此看不见真新增,偏低=之后每次 CI 都红)。
 * 本仓对"判据必须与被审面同形"已有多次教训(守门 77/83/118),这一层是同一规矩的落地。
 *
 * 判定只认两个输入:是否 CI 环境、脏路径条数(问不到时由调用方传 null ⇒ 判"无法判定")。
 */

/**
 * @param {{ ci: boolean, dirtyCount: number | null, insideRepo?: boolean | null }} input
 *   `insideRepo` = `git rev-parse --is-inside-work-tree` 是否成功。**必须是三态**:
 *   `null` 表示 git 本身问不到(锁/超时/坏配置),那才是"无法判定";
 *   `false` 表示这里根本不是一个 git 检出 —— 本仓做 HEAD 干净检出验证用的就是
 *   `git archive` 出去的隔离树(见 AGENTS §"隔离 HEAD 检出"那条实测),那棵树的内容
 *   就是被量面,把它判成"不可比/无法判定"会让这道闸门恰好挡住唯一正确的记录方式。
 * @returns {{ verdict: 'comparable'|'incomparable'|'undetermined', reason: string }}
 */
export function classifyFace({ ci, dirtyCount, insideRepo = true }) {
  if (insideRepo === false) {
    return {
      verdict: 'comparable',
      reason: '非 git 检出(git archive 出的隔离 HEAD 树)⇒ 树内容即被量面,与 CI 同形',
    }
  }
  if (dirtyCount === null || dirtyCount === undefined) {
    return {
      verdict: 'undetermined',
      reason: 'git status 问不到脏路径条数 ⇒ 无法判定口径,不冒判可比也不冒判不可比',
    }
  }
  if (ci) {
    // CI 上 checkout 干净是前提;若真脏,那是 CI 配置故障,照旧如实报出来
    return dirtyCount > 0
      ? { verdict: 'incomparable', reason: `CI 环境却有 ${dirtyCount} 个未提交改动 —— checkout/缓存配置异常` }
      : { verdict: 'comparable', reason: 'CI 干净检出,与问责面同形' }
  }
  return dirtyCount > 0
    ? {
        verdict: 'incomparable',
        reason: `工作树有 ${dirtyCount} 个未提交改动,knip 量的是磁盘 ⇒ 与 CI(干净检出)不可比`,
      }
    : { verdict: 'comparable', reason: '工作树与 HEAD 同形,读数可比' }
}

/**
 * 写基线时的出处标注 —— 人工在脏树上下意识要放行,那就**把这件事写进文件**,
 * 让下一个读基线的人知道这个数是从哪份内容量出来的(禁静默)。
 * @param {{ comparable: boolean, dirtyCount: number | null, forced: boolean, isolated?: boolean }} input
 */
export function provenanceNote({ comparable, dirtyCount, forced, isolated = false }) {
  if (isolated) return 'recordedFrom: isolated HEAD checkout(git archive 出的干净树,无 .git)—— 与 CI 同形'
  if (comparable) return 'recordedFrom: clean face (工作树 == HEAD 或 CI 干净检出)'
  const n = dirtyCount === null ? '?' : dirtyCount
  return forced
    ? `recordedFrom: ⚠️ DIRTY worktree(${n} 个未提交改动) —— 经 --allow-dirty 人工放行,该数与 CI 不可比,须复核`
    : `recordedFrom: DIRTY worktree(${n})`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
