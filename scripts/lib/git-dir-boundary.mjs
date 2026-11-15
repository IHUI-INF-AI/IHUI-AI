// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 写锁 gitDir 越界闸 —— 判据**唯一真相源**(§0.6)。
 *
 * 立因(2026-11-14 git 写锁外流根治):`D:\IHUI-AI-git-repo` 盘根一份手工隔离 clone,
 * gitDir 被指到**项目盘根、仓根树之外**,git 钩子据此把全仓写锁算到那里,而
 * `lib/lock-atomic-init.mjs` 的 pending 兄弟目录落在正式锁的同级父目录 ⇒ 32 个
 * `.pending` 散在**仓库树之外的项目盘根**(11/04~06 产出,9.6 天后才被发现回收)。
 * 缺口 = 两条锁消费方(`isolated-git.mjs` / `git-lock.mjs`)的 `gitDir()` 都直接返回
 * `rev-parse` 结果、无任何越界判据。
 *
 * 为什么抽成独立 lib:两条消费方共用同一判据,而 `isolated-git.mjs` → `git-lock.mjs`
 * 已存在一条 import(§0.6「同类判据全仓只许一份,第二份必漂移」)。若 git-lock 反向
 * import isolated-git 就是循环;抽到这里,两条入口各自 import 本模块,无环、单一真相源。
 *
 * 判据:正式 gitDir **必须落在仓根目录树之内**。盘根克隆/别的盘/上级目录/兄弟目录一律拒
 * —— 不是本仓工作树的 gitdir 没有资格在本通道建写锁(建了就外流、回收归谁立刻变含糊)。
 * 注入 repoRoot/exists 让镜像测试用构造面证明,不赌本机盘符(§15/§22c)。
 * 失效方向恒为「多拒一次」:取不到 gitDir 不静默放行,交调用方按未判定处置。
 */
import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export function assertGitDirInsideRepoTree(
  gitDir,
  { repoRoot = resolve(process.cwd()), exists = existsSync } = {},
) {
  if (!gitDir || typeof gitDir !== 'string') {
    throw new Error('拒绝建写锁:取不到 gitDir(未判定绝不冒充合规)')
  }
  if (!exists(gitDir)) {
    throw new Error(`拒绝建写锁:gitDir 不存在:${gitDir}`)
  }
  const abs = resolve(gitDir)
  const rel = relative(resolve(repoRoot), abs)
  // rel === '' ⇒ gitDir 就是仓根本身(非法,gitDir 应是 .git);不以 sep 开头/是绝对 ⇒ 树外。
  const outside = rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
  if (outside) {
    throw new Error(
      `拒绝建写锁:gitDir 落在仓库树之外 ⇒ 写锁/pending 会外流到项目盘根(` +
        `gitDir=${abs},仓根=${resolve(repoRoot)})。本通道只服务本仓工作树内的 gitdir;` +
        `盘根克隆或别处的 gitdir 请用各自的通道,不要借本通道建锁。` +
        `判据单一真相源 = scripts/lib/git-dir-boundary.mjs::assertGitDirInsideRepoTree`,
    )
  }
}
