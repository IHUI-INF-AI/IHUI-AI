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
function gitRawOutput(args, { root, timeoutMs = DEFAULT_TIMEOUT_MS, allowFail = true } = {}) {
  if (!root) throw new Error('gitRawOutput() 必须显式传 root(不猜调用方位置)')
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
    if (allowFail) return ''
    throw e
  }
  if (r.error || r.status !== 0) {
    if (allowFail) return ''
    throw new Error(
      `git ${args.join(' ')} 失败: ${r.error?.message ?? (String(r.stderr ?? '').split('\n')[0] || `exit ${r.status}`)}`,
    )
  }
  return String(r.stdout ?? '')
}

function gitPaths(args, opts) {
  return splitNulPaths(gitRawOutput(args, opts))
}

/**
 * 暂存区**带状态**清单(G-920 前置护栏"点名路径与归属"用,2026-10-15 立)。
 *
 * 为什么另立一路、不许调用方自己拼 `--name-status`:`-z` 下 name-status 的帧形是
 * `<status>NUL<path>NUL` —— 状态码与路径在**同一帧流里交替**,与 `--name-only -z`
 * 的 `<path>NUL` 不同形。直接喂 `splitNulPaths` 会把 `M` / `A` 读成一**条路径**,
 * 于是"外来件清单"里凭空多出一堆单字母幽灵路径(本仓中文路径多,这类错读最难自查)。
 * 解析只此一份,调用方不再各自拆帧(§0.6)。
 *
 * 取不到 ⇒ 返回 `[]`(与其余三路同规:调用方按"取不到"处理,不得据此断言"没有外来件")。
 */
export function gitStagedStatusEntries(opts = {}) {
  const parts = gitRawOutput(['diff', '--cached', '--name-status', '--no-renames', '-z'], opts)
    .split('\0')
    .filter(Boolean)
  const out = []
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ status: parts[i], path: parts[i + 1] })
  return out
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

/**
 * 暂存区**改名对**清单(HEAD ↔ 索引,`diff --cached -M --name-status -z`,2026-10-19 立)。
 *
 * 为什么单独一路,不复用上面的 `gitStagedStatusEntries`:那一路刻意带 `--no-renames`,
 * 因为对"有没有外来件"而言改名就该算「旧路径消失 + 新路径出现」。而**棘轮锚点**要的恰好
 * 相反:同一枚文件换了地址,内容一个字没动,锚点必须跟着走。2026-10-19 panel 系改名契约
 * 就是这一格:整棵面板树改名后,HEAD 面按新地址枚举到 0 个文件、锚点查不到 ⇒ 现读 30 处
 * 存量幽灵被读成"本次新加" ⇒ 改名那一枚提交被自己的门拦死(§12e 恒红门形态)。
 *
 * 帧形(实测 `-z` + rename 的 R 条目):`R<score>NUL<旧路径>NUL<新路径>NUL` —— 一条状态带
 * **两条**路径,与 `gitStagedStatusEntries` 的一状态一路径不同形,混用会把新路径读成状态码。
 * 拆帧只此一份(§0.6),调用方不得再各自 split。
 *
 * 取不到 ⇒ 返回 `[]`(与其余四路同规:调用方按"没有改名"处理,不得据此断言"没有存量")。
 */
export function gitStagedRenamePairs(opts = {}) {
  const parts = gitRawOutput(['diff', '--cached', '-M', '--name-status', '-z'], opts)
    .split('\0')
    .filter((s) => s !== '')
  const out = []
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i]
    if (!/^R\d+$/.test(status)) {
      i += 1 // A/M/D 形态:状态后跟一条路径,跳过它继续找下一条状态
      continue
    }
    const from = parts[i + 1]
    const to = parts[i + 2]
    if (from === undefined || to === undefined) break
    out.push({ from, to })
    i += 2
  }
  return out
}

/**
 * 由改名对折出「文件身份」索引(纯函数,零 IO —— 判据可被构造夹具双向证明)。
 *
 * 三条出口各自钉一件事:
 *  - `identityOf(p)`:把任一地址折到**改名后**的地址(改名链成环也必须终止,不得死循环);
 *  - `legacyDirsFor(dir)`:哪些旧目录被改名进了 `dir`(供在旧地址还挂在被审面上的那一枚提交里
 *    枚举到文件 —— 枚举不到的后果不是放行,是整棵树"未判定");
 *  - `legacyPathsFor(target)`:某个目标文件的旧地址(台账/配置类单文件同理)。
 * 落地之后没有待提交的改名 ⇒ 三个出口分别回到"原样/空/空",行为与改名前逐字相同。
 */
export function buildRenameIndex(pairs) {
  const toIdentity = new Map((pairs || []).map(({ from, to }) => [from, to]))
  const identityOf = (p) => {
    let cur = String(p)
    const seen = new Set()
    while (toIdentity.has(cur) && !seen.has(cur)) {
      seen.add(cur)
      cur = toIdentity.get(cur)
    }
    return cur
  }
  return {
    identityOf,
    legacyDirsFor(dir) {
      const prefix = `${String(dir).replace(/\/+$/, '')}/`
      const out = []
      for (const [from, to] of toIdentity) {
        if (!to.startsWith(prefix)) continue
        const oldDir = from.slice(0, from.lastIndexOf('/') + 1)
        if (!oldDir || oldDir === `${prefix}`) continue
        const asDir = oldDir.replace(/\/+$/, '')
        if (!out.includes(asDir)) out.push(asDir)
      }
      return out
    },
    legacyPathsFor(target) {
      const out = []
      for (const [from, to] of toIdentity) if (to === target && !out.includes(from)) out.push(from)
      return out
    },
  }
}

/**
 * `git status --porcelain -z` 帧流 → **归属脏路径集合**(纯函数,零 IO —— 判据只此一份,§0.6)。
 *
 * 立因(2026-11-03 提库):同一条"工作树脏 ⇒ 归属未知 ⇒ 不许写"的避让判据,仓内已有**三份**
 * 就地实现 —— `land-rn-style-tiers.mjs` 的 `isCleanOwned`(逐路径 `status -- <file>`)、
 * `land-web-style-tiers.mjs` 与 `land-miniapp-style-tiers.mjs` 的 `dirtySet()`(整树一次取回)。
 * 两枚落档器(`gen-ui-mirror.mjs` / `fix-rn-color-literals.mjs`)即将挂守护周期腿,若再各写一份
 * 就是第四份(§22c 镜像判据 / 门 191)。四枚一起 import 本出口。
 *
 * 帧形(本机 2026-11-03 实测,不是从文档抄的):
 *  · 普通条目 = `XY␠<path>` 一帧一 NUL;未跟踪同形(`??␠<path>`)⇒ **未跟踪也算"有主"之外**;
 *  · 改名/复制条目 = `R␠␠<新路径>NUL<旧路径>NUL` —— 旧路径**单独占一帧且不带状态前缀**,
 *    与非 -z 的 `R  old -> new` 不同形;把第二帧按"XY␠path"切会啃掉真路径头三个字符;
 *  · `-z` 下 git 不做 core.quotePath 八进制转写(实测中文带空格路径逐字为真路径)——
 *    这正是本票沿用文件头注 D171 那条纪律的原因。
 * 改名/复制的**两帧都进集合**:避让判据的失效方向恒为"少写一次",多包一条只可能多跳一枚,
 * 绝不会把"别人在飞的"读成"干净的"。
 */
export function parseOwnershipDirtyPaths(raw) {
  const out = new Set()
  const frames = String(raw ?? '').split('\0')
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i]
    if (frame === '') continue
    const status = frame.slice(0, 2)
    if (/^[ MARCD?!UT][ MARCD?!UT]$/.test(status) && frame.charAt(2) === ' ') {
      const p = frame.slice(3)
      if (p) out.add(p)
      // R/C:下一帧是**旧路径**,原样入集(不剥前缀、不当状态行)
      if (/^[RC]/.test(status) && i + 1 < frames.length) {
        const old = frames[i + 1]
        if (old) out.add(old)
        i += 1
      }
      continue
    }
    // 认不得的帧形:整帧当路径收下(过拦不过放),并保留原文可被调用方逐字复现
    out.add(frame)
  }
  return out
}

/** 相对路径归一(反斜杠 → 正斜杠、去掉 `./` 前缀):git 面恒用正斜杠,调用方不一定。 */
export function normalizeRelPath(p) {
  return String(p ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

/**
 * 工作树**归属脏集**的带原因出口(唯一实现):一次 `git status --porcelain -z`(可带 pathspec 收窄)。
 *
 * @returns {{ok:boolean, paths:Set<string>, reason:string|null}}
 *  · `ok:true` ∧ 空集 = 全干净(可以写);
 *  · `ok:false` = **取不到输入** ⇒ 调用方必须按"未判定"处理:一条都不写、逐条点名(§0.3),
 *    绝不把取不到当成空集冒绿。
 */
export function ownershipDirtyPathsDetailed({ root, pathspec = null } = {}) {
  if (!root) throw new Error('ownershipDirtyPathsDetailed() 必须显式传 root(不猜调用方位置)')
  const args = ['status', '--porcelain', '-z']
  const spec = (Array.isArray(pathspec) ? pathspec : pathspec ? [pathspec] : []).map(normalizeRelPath).filter(Boolean)
  if (spec.length) args.push('--', ...spec)
  let raw
  try {
    raw = gitRawOutput(args, { root, allowFail: false })
  } catch (e) {
    return { ok: false, paths: new Set(), reason: `git status 取不到:${String(e?.message ?? e).split('\n')[0].slice(0, 120)}` }
  }
  return { ok: true, paths: parseOwnershipDirtyPaths(raw), reason: null }
}

/** 三枚 lander 沿用的既有形态(Set | null,null = 未判定):上面那一份的薄适配,不另立判据。 */
export function ownershipDirtyPaths(opts = {}) {
  const r = ownershipDirtyPathsDetailed(opts)
  return r.ok ? r.paths : null
}

/**
 * 单路径归属闸:`file` 在脏集里 ⇒ 归属未知 ⇒ 不许写。
 *
 * `dirty` 传 null / 非 Set(取不到输入)时**一律判未通过** —— 失效方向必须是"少写一次",
 * 绝不能是"多写一次"(§0.3 / §12)。调用方若要区分"真脏"与"取不到",必须先问
 * `ownershipDirtyPathsDetailed` 的 `ok`,并像两枚落档器那样把整轮 held 逐条点名。
 */
export function isCleanOwned(file, dirty) {
  if (!(dirty instanceof Set)) return false
  const rel = normalizeRelPath(file)
  if (!rel) return false
  return !dirty.has(rel)
}

/**
 * 落档器写盘前的**归属闸**(带逐条点名文案;判据仍只有上面那一份,本出口只加"怎么点名")。
 *
 * 为什么挂周期腿前必须有它:多会话共享工作区里,自动腿写他席正在编辑的文件 = 覆盖别人的未提交
 * 工作(AGENTS.md §12 / §16 的明令事故型)。`gen-ui-mirror` 与 `fix-rn-color-literals` 是同一条闸
 * 的两个消费方 —— 闸住在本库,两枚只 import(§0.6:第二份实现必然漂移)。
 *
 * 失效方向恒为"少写一次":`ok:false`(脏集取不到 —— 根不存在 / 不在仓内 / git 问不动)时
 * `blocked()` 对**每一条**都返回点名文案 ⇒ 调用方一条都不写,并把 `ownership=unjudged` 如实报出。
 *
 * @returns {{ok:boolean, reason:string|null, dirty:Set<string>|null, blocked:(file:string)=>string|null}}
 *   `blocked(file)`:`null` = 归属干净可写;字符串 = 不写并点名(取不到时把原因一并带上)。
 */
export function ownershipGate({ root } = {}) {
  const g = ownershipDirtyPathsDetailed({ root })
  const dirty = g.ok ? g.paths : null
  const blocked = (file) => {
    if (isCleanOwned(file, dirty)) return null
    return g.ok ? normalizeRelPath(file) : `${normalizeRelPath(file)}(归属集取不到:${String(g.reason ?? '未知').slice(0, 60)})`
  }
  return { ok: g.ok, reason: g.reason, dirty, blocked }
}
