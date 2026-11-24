// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hook-git-env.js — pre-commit 钩子的 GIT_* 环境去污(**唯一判据源**)
 *
 * 为什么拆成模块:同一份判据有两个真身入口 —— `.husky/pre-commit`(shell 入口,
 * 供 wscript 派生的子进程继承)与 `scripts/lib/pre-commit-hook.js`(node 入口,
 * 也允许被 `node scripts/lib/pre-commit-hook.js` 直接启动)。回归测试必须跑**真身**
 * 而不是在测试里复刻一份判据(§0.6:同一判据不写两遍)。
 *
 * 两类变量,判据不同:
 *
 * ① GIT_DIR / GIT_WORK_TREE / GIT_OBJECT_DIRECTORY / GIT_ALTERNATE_OBJECT_DIRECTORIES /
 *    GIT_QUARANTINE_PATH —— **无条件清**。IDE(Trae)git 扩展向会话注入
 *    GIT_DIR=D:/IHUI-AI-git-repo(worktree 之外的 gitdir 指针);守门子进程以 scratch
 *    物化目录为 cwd 跑 git init/add、或对 gitdir 跑 work-tree 型命令(rev-parse
 *    --show-toplevel)时全部报 "fatal: this operation must be run in a work tree"
 *    ([152]/[164]/[167]/[168]/[172] 链内全灭、单跑全绿的根因)。清掉后 git 从 cwd
 *    (worktree 根)经 ./.git 指针文件发现同一仓库,语义不变。
 *
 * ② GIT_INDEX_FILE —— **只在指针确实指向现存文件时保留**,否则清掉。判据一条:
 *    `git commit --only/--amend -- <路径>` 期间,git 会把「只含本次路径的临时索引」
 *    (<gitdir>/next-index-<pid>.lock,绝对路径)经 GIT_INDEX_FILE 交给钩子 —— 这正是
 *    该次提交要写的那一份索引。旧实现无条件 unset/delete 它 ⇒ 钩子内所有 git 命令
 *    (尤其 lint-staged 的 `git add` / `git restore --worktree`)落到**共享真实索引**上,
 *    而 --only 提交期间父 git 正持着 `.git/index.lock` ⇒ 必然 exit 128
 *    "Unable to create '.../index.lock': File exists"(2026-11-03 实证,并发会话互相堵死)。
 *    反向的旧场景只有「陈旧指针」:文件不存在(上游崩溃/会话退出遗留),此时 git 会把它
 *    读成**空索引** ⇒ 全仓文件都像已暂存。故按「文件存在」判,而不是按变量名判。
 *
 * 同款判据在 `.husky/pre-commit` 的 shell 段逐字复述(两处都必须,原因见该文件注释)。
 */

const fs = require('node:fs')

/** 无条件清掉的一组(判据只有"IDE 注入的 gitdir/worktree 指针必须消失")。 */
const ALWAYS_DROP_GIT_ENV_KEYS = Object.freeze([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_QUARANTINE_PATH',
])

/**
 * GIT_INDEX_FILE 指针是否可用:非空且指向一个现存文件。
 * @param {string|undefined} pointer
 * @returns {boolean}
 */
function indexPointerIsUsable(pointer) {
  if (!pointer) return false
  try {
    return fs.statSync(pointer).isFile()
  } catch {
    return false
  }
}

/**
 * 就地清洗 env(默认 process.env)。返回同一对象,便于调用方链式使用。
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {NodeJS.ProcessEnv}
 */
function sanitizeGitEnv(env = process.env) {
  for (const key of ALWAYS_DROP_GIT_ENV_KEYS) delete env[key]
  if (env.GIT_INDEX_FILE !== undefined && !indexPointerIsUsable(env.GIT_INDEX_FILE)) {
    delete env.GIT_INDEX_FILE
  }
  return env
}

module.exports = { sanitizeGitEnv, indexPointerIsUsable, ALWAYS_DROP_GIT_ENV_KEYS }
