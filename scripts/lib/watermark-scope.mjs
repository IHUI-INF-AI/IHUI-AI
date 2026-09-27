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

import { execFileSync } from 'node:child_process'

const GIT = 'git'

/**
 * 一次 `-z` 取清单。默认输出会按 core.quotePath 把非 ASCII 文件名转义成八进制串,
 * 那种路径永远对不上真实文件。
 */
function lsFiles(args, root) {
  try {
    const out = execFileSync(GIT, ['-c', 'safe.directory=*', 'ls-files', '-z', ...args], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
