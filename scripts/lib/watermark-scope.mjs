// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 水印口径的**文件集合**(G-253,2026-09-27 立)。
 *
 * 为什么要有这个 lib:`watermark.mjs` 与 `check-watermark-coverage.mjs` 此前各自跑一次
 * `git ls-files`,两把尺子共用一条口径却没有共用一份实现(本仓最常被记的失败型就是
 * "两处算同一件事必漂移");而且那条口径把一格真实缺口挡在分母之外 —— **未跟踪但已被
 * 写在盘上的源文件**。它此刻不阻塞任何提交,却会被**旁路落地**(commit-tree,不跑钩子)
 * 带进仓库,而那正是缺口唯一真正进仓的路径。
 *
 * 两层集合,处置方式不同(这是本票最要紧的设计,不是收尾修饰):
 *  - `indexFiles`(`git ls-files`)是**可阻塞**的那一层:pre-commit 的退出码只由它决定。
 *  - `untrackedFiles`(未跟踪、未被 .gitignore 忽略)只**报数不判红**。实测理由:
 *    共享工作区里这一层常年挂着别人在飞的源文件,把它们判成 blocking 就是一台"与本次
 *    提交无关的恒红门" —— 唯一结局是各会话走 `--no-verify`,连带废掉全部守门
 *    (AGENTS §12e 同型);而**自动给它们注入横幅**等于往别人的未提交文件里写字并
 *    `git add` 别人的东西,那是污染 + 越权两型。这一格的出口在落地器
 *    `scripts/object-space-land.mjs`(它拒绝落地无有效横幅的声明路径)。
 *
 * `--exclude-standard` 让 .gitignore 继续把构建产物与本机临时面挡在分母外 —— 这正是
 * 当初从"全树遍历"改成"按 git 清单"的理由(否则本机恒报 2000+ 假缺口,把每个本地核验
 * 的人引向"仓库有几千个水印问题"的错觉)。取不到清单 **≠** 空集合:返回 `error`,
 * 由调用方 exit 1,绝不"看起来全绿"。
 */

// 2026-10-08(gitRaw 型 B 收尾批)git 出口收口:本文件唯一自拼派生 `lsFiles()` 迁取材层
// scripts/lib/face-reader.mjs 的 `gitRaw`,`const GIT = 'git'` 随之删除。行为面对照:
//  · 二进制:旧裸 'git'(依赖 PATH)→ 层内 `resolveGitBin() || 'git'` 绝对路径兜底链
//    (净收益,§5b"git 调用不得依赖环境"同规);`-c safe.directory=*` 同;`-C <root>`
//    与旧 `cwd: root` 同效(路径解析面一致)。
//  · 层另带 `-c core.quotepath=false`:本文件头注自述的 quotePath 八进制转义痛点(非
//    ASCII 文件名对不上真实文件)由层内直接消除,清单可对回真实文件 —— 与本文件意图
//    同向,两份清单(跟踪/未跟踪)的判定面只宽不窄。
//  · stdio:旧 ['ignore','pipe','pipe'](stdin 置 ignore 防 pipe-stdin spawn git 确定性
//    EBUSY)→ 层无 input 态同形(gitRaw 两态规则),EBUSY 兜底由层承担;
//    maxBuffer 旧 64MB → 层 64MB 同值;timeout 旧无 → 层默认 60s(净收益,ls-files 本地即时)。
//  · 失败折值一字未动:catch 仍返 {lines:null, error:首行},error 文案换源(execFileSync
//    原始错误消息 → 层 Undetermined 消息,含 git stderr 首行),coverageFileSet 的
//    "取不到 ≠ 空集合"分档与上层 exit 1 路径不受影响。
import { gitRaw } from './face-reader.mjs'

/**
 * 一次 `-z` 取清单。层的 `-c core.quotepath=false` 让非 ASCII 文件名原样返回,
 * 不再被 core.quotePath 转义成八进制串(那种路径永远对不上真实文件)。
 */
function lsFiles(args, root) {
  try {
    const out = gitRaw(['ls-files', '-z', ...args], root)
    return { lines: out.split('\0').map((s) => s.trim()).filter(Boolean), error: null }
  } catch (e) {
    return { lines: null, error: String(e?.message ?? e).split('\n')[0] }
  }
}

/**
 * @param {{ root: string }} opts
 * @returns {{ indexFiles: string[], untrackedFiles: string[], files: string[], error: string|null }}
 */
export function coverageFileSet({ root }) {
  const tracked = lsFiles([], root)
  if (tracked.error) {
    return { indexFiles: [], untrackedFiles: [], files: [], error: `取不到 git 跟踪清单:${tracked.error}` }
  }
  const others = lsFiles(['--others', '--exclude-standard'], root)
  if (others.error) {
    return { indexFiles: [], untrackedFiles: [], files: [], error: `取不到未跟踪清单:${others.error}` }
  }
  if (tracked.lines.length === 0) {
    // 空跟踪清单 = git 不可用或在错的目录上跑;按"判据失明"处理,不按"没有缺口"放行。
    return {
      indexFiles: [],
      untrackedFiles: [],
      files: [],
      error: '跟踪清单为空(一个文件都没枚举到)⇒ 判据失明,不按"已覆盖"放行',
    }
  }
  return {
    indexFiles: tracked.lines,
    untrackedFiles: others.lines,
    files: [...new Set([...tracked.lines, ...others.lines])].sort(),
    error: null,
  }
}

/**
 * 判定面清单(门 118 取材面纪律,2026-10-15 换面)。
 *
 * 清单必须与**内容同面同轮** —— 旧口径通篇用 `ls-files`(索引面清单)去配磁盘内容,
 * 于是"HEAD blob 缺载荷、盘上副本已补齐"的文件对两把尺子都不存在:悬留把红遮住了
 * (2026-10-14 实测三枚文件即此型)。现分档:
 *  - `head`     ⇒ `git ls-tree -r --name-only HEAD`(全量档:HEAD 面清单 ∩ HEAD blob);
 *  - `staged`   ⇒ `git ls-files`(提交档:索引面清单 ∩ 索引 blob);
 *  - `worktree` ⇒ 旧口径 `ls-files ∪ --others`(仅人工逃生舱,未跟踪面只在这档存在)。
 * 取不到 ⇒ 返回 error(调用方判「无法判定」exit 2),**绝不回落另一个面、绝不按空集合放行**。
 * `indexFiles` 字段名沿用旧契约 = "可阻塞面"(head 档里它就是 HEAD 树清单)。
 * @param {{ root: string, face: 'head'|'staged'|'worktree' }} opts
 * @returns {{ indexFiles: string[], untrackedFiles: string[], files: string[], error: string|null }}
 */
export function coverageFileSetForFace({ root, face }) {
  if (face === 'worktree') return coverageFileSet({ root })
  const dead = (error) => ({ indexFiles: [], untrackedFiles: [], files: [], error })
  if (face === 'staged') {
    const tracked = lsFiles([], root)
    if (tracked.error) return dead(`取不到索引(staged 面)清单:${tracked.error}`)
    if (tracked.lines.length === 0) {
      return dead('staged 面枚举到 0 个跟踪路径 ⇒ 判据失明,不按"已覆盖"放行')
    }
    return { indexFiles: tracked.lines, untrackedFiles: [], files: [...tracked.lines].sort(), error: null }
  }
  if (face === 'head') {
    try {
      const lines = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], root)
        .split('\0')
        .map((s) => s.trim())
        .filter(Boolean)
      if (lines.length === 0) {
        return dead('HEAD 面枚举到 0 个跟踪路径 ⇒ 判据失明,不按"已覆盖"放行')
      }
      return { indexFiles: lines, untrackedFiles: [], files: [...lines].sort(), error: null }
    } catch (e) {
      return dead(`取不到 HEAD 面清单:${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  return dead(`未知判定面 "${String(face)}"(允许:head/staged/worktree)`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
