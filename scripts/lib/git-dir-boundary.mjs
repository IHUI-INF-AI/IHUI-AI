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
 *
 * ── 2026-11-17 separate-git-dir 误杀根治:落点闸 ──────────────────────────────
 * 本仓是合法 separate-git-dir(`.git` 指针→仓外 D:\IHUI-AI-git-repo),gitDir 天然在树外,
 * 旧闸按"gitDir 在树内"一刀切 ⇒ 两把全局写锁(safe-commit/post-commit)全建不起来 ⇒
 * 多会话失串行、抢共享索引、失败重试、反复全量跑门。护栏真正要防的是「锁/pending 落点
 * 外流到项目盘根」,不是 gitdir 的物理位置。故新增 assertLockDirInsideRepoTree:判据对象
 * 从 gitDir 换成**锁落点**,锁落点固定到仓内 .ihui-agent/state/ ⇒ 本意(不外流)更彻底满足,
 * 且仓外 gitDir 不再被误杀。两闸共用同一"在不在树内"算法,判据仍单一真相源(§0.6)。
 * 旧 assertGitDirInsideRepoTree 一字不改(16a/b/c 三组镜像测试钉死它,且盘根克隆仍要拒)。
 */
import { existsSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** 唯一"target 是否在 repoRoot 树内"算法,两闸共用(§0.6 判据单源)。 */
function pathInsideRepoTree(target, repoRoot) {
  const abs = resolve(target)
  const rel = relative(resolve(repoRoot), abs)
  // rel === '' ⇒ target 就是仓根本身(非法);不以 sep 开头/是绝对 ⇒ 树外。
  return !(rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
}

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
  if (!pathInsideRepoTree(gitDir, repoRoot)) {
    const abs = resolve(gitDir)
    throw new Error(
      `拒绝建写锁:gitDir 落在仓库树之外 ⇒ 写锁/pending 会外流到项目盘根(` +
        `gitDir=${abs},仓根=${resolve(repoRoot)})。本通道只服务本仓工作树内的 gitdir;` +
        `盘根克隆或别处的 gitdir 请用各自的通道,不要借本通道建锁。` +
        `判据单一真相源 = scripts/lib/git-dir-boundary.mjs::assertGitDirInsideRepoTree`,
    )
  }
}

/**
 * 写锁落点越界闸 —— 护栏本意的正确判据(2026-11-17 立)。
 *
 * separate-git-dir 的仓外 gitDir 合法,但**锁落点必须固定在仓内**,这样 pending 兄弟
 * (落点同级父目录)也在树内可回收,绝不可能外流到项目盘根 —— 比旧闸更彻底地实现
 * 11-14 立的"锁不外流"本意,同时解除对合法仓外 gitDir 的误杀。
 *
 * 与旧闸同款失效方向:取不到落点不静默放行;落点/仓根为空或未判定一律拒。
 * 注入 repoRoot 让镜像测试用构造面证明,不赌本机盘符。
 */
export function assertLockDirInsideRepoTree(
  lockDir,
  { repoRoot = resolve(process.cwd()) } = {},
) {
  if (!lockDir || typeof lockDir !== 'string') {
    throw new Error('拒绝建写锁:取不到锁落点(未判定绝不冒充合规)')
  }
  if (!repoRoot || typeof repoRoot !== 'string') {
    throw new Error('拒绝建写锁:取不到仓根(未判定绝不冒充合规)')
  }
  if (!pathInsideRepoTree(lockDir, repoRoot)) {
    throw new Error(
      `拒绝建写锁:锁落点落在仓库树之外 ⇒ pending 会外流到项目盘根(` +
        `lockDir=${resolve(lockDir)},仓根=${resolve(repoRoot)})。` +
        `写锁落点必须固定在本仓工作树内(本仓 = .ihui-agent/state/ihui-git-write.lock);` +
        `判据单一真相源 = scripts/lib/git-dir-boundary.mjs::assertLockDirInsideRepoTree`,
    )
  }
}
