// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * git 路径清单的 **-z 唯一出口**(票 D171,2026-09-30 立)。
 *
 * 根因(票面要求写死在头注):
 *   git 对非 ASCII 路径默认按 core.quotePath 八进制转写并加引号(形如
 *   `"docs/.../reconcile-10/345/274/225....md"`)。safe-commit Step 3 把
 *   `git diff --cached --name-only` 的输出按换行 split 后与声明清单逐字比对,
 *   5 个中文名文件全被判「暂存区出现非预期文件 ⇒ 中止提交」;Step 5 的
 *   `git show --name-only` 同型,把已干净落地的提交误报成污染。
 *
 * 修法唯一:比对前把两侧都归一到**真路径**。取值走 `-z` 形态(NUL 分帧,
 * git 对 -z 不做 quotePath 转写),与仓内主流用法一致
 * (`gitRaw([...,'-z'])` 的守门族、check-bypass-landing-scope.mjs 的
 * `diff-tree --name-only -z` 先例)。**不得**放宽成"未匹配项忽略不计",
 * 也不得把中文名一律排除 —— 本出口只改"取"的方式,不改"比"的严格度。
 *
 * 纪律(与 lib/bypass-git.mjs 同规):
 *  - git 二进制走 scripts/lib/gitdir.mjs 的 resolveGitBin(不依赖环境 PATH);
 *  - 派生带 -c safe.directory=* + windowsHide + 数字 timeout + 64MB maxBuffer;
 *  - stdio ['ignore','pipe','pipe'](EBUSY 病窗纪律,严禁喂 stdin);
 *  - 只读枚举,零 git 写操作。
 */

import { spawnSync } from 'node:child_process'

import { resolveGitBin } from './gitdir.mjs'

const GIT_BIN = resolveGitBin() || 'git'
const DEFAULT_TIMEOUT_MS = 60_000
const GIT_MAX_BUFFER = 64 << 20

/** `git -z` 输出(NUL 分帧)→ 路径数组(纯函数,可构造面证明)。 */
export function splitNulPaths(raw) {
  return String(raw ?? '').split('\0').filter(Boolean)
}

/**
 * 共派生出口。allowFail(缺省 true)= git 跑不动时返回 [](调用方按"取不到"走缺失判红,
 * 与改前 run(..., {allowFail:true}) 的语义逐字同形);传 false 时抛错,由调用方分诊。
 */
function gitPaths(args, { root, timeoutMs = DEFAULT_TIMEOUT_MS, allowFail = true } = {}) {
  if (!root) throw new Error('gitPaths() 必须显式传 root(不猜调用方位置)')
  const full = ['-c', 'safe.directory=*']
  if (process.platform === 'win32') full.push('-c', 'core.protectNTFS=false')
  full.push('-C', root, ...args)
  let r
  try {
    r = spawnSync(GIT_BIN, full, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: GIT_MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    if (allowFail) return []
    throw e
  }
  if (r.error || r.status !== 0) {
    if (allowFail) return []
    throw new Error(
      `git ${args.join(' ')} 失败: ${r.error?.message ?? (String(r.stderr ?? '').split('\n')[0] || `exit ${r.status}`)}`,
    )
  }
  return splitNulPaths(r.stdout)
}

/** 暂存区清单(与 safe-commit Step 3 改前同一命令面,+ -z 取真路径)。 */
export function gitStagedPaths(opts = {}) {
  return gitPaths(['diff', '--cached', '--name-only', '--no-renames', '-z'], opts)
}

/** 未跟踪清单(排除 .gitignore 命中项;safe-commit 归因面用)。 */
export function gitUntrackedPaths(opts = {}) {
  return gitPaths(['ls-files', '--others', '--exclude-standard', '-z'], opts)
}

/**
 * **工作树面**清单:已跟踪且工作树内容与索引不一致的路径(2026-10-03 立,票 G-1018220)。
 *
 * 立因是归因层"他人现场"取材面漏了一路,而门 47 正是按这一面判红:
 *   - 门 47(`check-watermark-coverage.mjs`)的判红面 = `git ls-files`(**跟踪面全集**)
 *     ∩ 工作树**磁盘字节**(水印横幅在不在文件里),**它不读 `git diff --cached`**;
 *   - 而 `foreignStaged` 改前只有 `diff --cached` ∪ `ls-files --others` 两路。
 * 于是"别人已跟踪、已改、**但还没 staged**"这一档(并发会话最常见的中途态)结构上
 * 既不在 staged 面也不在 untracked 面 ⇒ 态①c 的"他人挂在共享索引里"永不触发
 * ⇒ 落进差分档,而基线面(HEAD 隔离检出)读的是**旧字节**、必然绿 ⇒ 差分把
 * "别人在飞的那半截"判成本枚引入 ⇒ `mine` ⇒ 拒绝 `--no-verify`。
 * 而本仓提交一律带 pathspec,那个路径进不了本次提交 —— 死锁的出口只剩"去改别人的文件",
 * 那是 §12 明令的事故。**实测**:零风险探针文件 + 一个被整文件重写冲掉水印的
 * `packages/types/src/agent-control.ts`,私有索引下门 47 exit 1,归因层判 `mine`,
 * 措辞还写"差分证明这枚提交引入了红" —— 提交里只有一个常量。
 *
 * 为什么必须三路齐全而不是把 `--cached` 换成整面:三路各自是**不同的现场形态**
 * (别人的暂存 / 别人的未跟踪新文件 / 别人未暂存的已跟踪改动),少任何一路,
 * 那一路引发的红就会被差分错记到本枚提交者头上(差分只看"基线面 vs 我的面",
 * 看不见"这一格归谁")。**取不到时返回 `[]`**(与其他两路同规:调用方按"取不到"处理,
 * 不得据此断言"没有他人现场")。
 */
export function gitWorktreePaths(opts = {}) {
  return gitPaths(['diff', '--name-only', '--no-renames', '-z'], opts)
}

/**
 * 一枚提交的改动路径清单(diff-tree 对非合并提交 = 对第一父的差;--root 兼容首枚提交)。
 * object-space-land 的混提辅助清单与 safe-commit Step 5 共用这一份实现(两处算同一件事必漂移)。
 */
export function gitCommitPaths({ sha, ...opts } = {}) {
  if (!sha) throw new Error('gitCommitPaths() 必须显式传 sha')
  return gitPaths(
    ['diff-tree', '-r', '--root', '--no-commit-id', '--name-only', '--no-renames', '-z', sha],
    opts,
  )
}
