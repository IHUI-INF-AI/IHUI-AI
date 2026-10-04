// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * staged-delete-intent.mjs — **"删除意图丢失"判据**(票 G-1018292,2026-10-04)。
 *
 * ## 要判的是哪一件事
 *
 * 共享索引被整批清空后,一枚**他人已暂存的删除**(索引里没有该路径、HEAD 有、工作树也没有,
 * `git status --porcelain` 呈 `D ` 形态)会退化成 ` D`(索引 blob == HEAD blob,只是工作树缺)。
 * 退化之后,存续自愈(`heal-worktree-tracked.mjs` 的 `findOrphanedDeletions`)那三条判据
 * 全部成立 ⇒ 它把文件恢复回盘上。**净结果那次是好的**(恢复字节与 HEAD 同值),但机制是反的:
 * 一枚有意的删除会被任何一次与它无关的第三方提交复活,而两边账面都绿。
 *
 * ## 判据:为什么不能用 reflog,只能在"清空前"取样
 *
 * 票面②建议"问一句 reflog/索引事件"。**实测这条路在本机结构上答不了**(2026-10-04,
 * 临时仓逐条试过,见报告证据):
 *   - `git reflog --all` 只记 ref 移动,那枚暂存删除**不产生任何 reflog 条目**;
 *   - `git reflog show --name-status HEAD` 给出的是**提交树之间**的差异,
 *     而"索引里少了这个路径"这件事既不是提交、也不改任何 tree ⇒ 查不到;
 *   - `git fsck` 无输出(暂存删除不产生对象,索引不是对象库的一部分)。
 * `git reset HEAD` 之后,索引面被整体覆盖回 HEAD,**没有任何事后痕迹**可证明
 * "这批删除在清空前曾经是暂存态"。所以判据只能在**清空之前**那一瞬取样 ——
 * 这正是本模块存在的理由:它是那唯一的时间窗。
 *
 * ## 判据本体(纯函数,可构造面证明)
 *
 * `judgeStagedDeleteIntent({ before, after, ownPaths })`
 *   - `before` / `after`:索引面在两个时刻的 `git diff --cached --name-status -z` 取材结果,
 *     每项形如 `{ status, path }`;取不到时传 `null`。
 *   - `ownPaths`:本次提交**自己声明**的路径清单(Step 2 的 `git add -A -- <这些>` 会重新暂存它们,
 *     所以它们清空后"不再是 D"是**设计内**的,不是丢失)。
 *   - **"意图删除"=清空前索引面确实是 `D`,清空后不再是,且该路径不属本票声明面**。
 *   - **"宿主误删"=清空前索引面就**不是 `D`(从未被暂存过)——那不是本票要管的那一类,
 *     它的处置权归存续自愈,本模块不代裁。
 *   - **`null` 一律判 `undetermined`**:取不到就是取不到,不折进"无删除"也不折进"有删除"。
 *
 * 四态(与仓内 `blobInAncestry` 的四态同规):判定只依赖**观测到的事实**,不依赖推测。
 */

import { spawnSync } from 'node:child_process'

import { resolveGitBin } from './gitdir.mjs'

const GIT_BIN = resolveGitBin() || 'git'
const DEFAULT_TIMEOUT_MS = 60_000
const GIT_MAX_BUFFER = 64 << 20

/**
 * `git diff --cached --name-status --no-renames -z` 的原始输出 → `[{status, path}]`。
 *
 * `-z` 形态下字段是 **status 与 path 交替的 NUL 分帧**(实测:
 * `"D\0a.txt\0M\0b.txt\0A\0c.txt\0D\0中文名.txt\0"`),不是 TAB 分隔 ——
 * 非 `-z` 形态还会把中文名按 core.quotePath 八进制转写(实测 `D\t"\344\270\255..."`),
 * 与 `git-paths.mjs` 头注记的是同一个病灶,故这里同样只认 `-z`。
 *
 * 纯函数:输入全部显式给出,故"字段数必须成对"这条硬约束可用构造面证明。
 * **奇数个字段 ⇒ 返回 `null`(取不到),不返回半截结果**:截断的清单会让调用方
 * 少看见一枚删除,正是本票要防的那类静默。
 */
export function parseNameStatusZ(raw) {
  const fields = String(raw ?? '').split('\0').filter(Boolean)
  if (fields.length % 2 !== 0) return null
  const out = []
  for (let i = 0; i < fields.length; i += 2) {
    const status = fields[i]
    const path = fields[i + 1]
    // 状态码只认单字母形态。--no-renames 下 git 只会给 A/D/M/R/C/T/U/X/B 单字母,
    // 出现多字母(合并的 `MM` 之列不算 name-status 的 status 位)时判"看不懂"⇒ null。
    if (!/^[A-Z]$/.test(status)) return null
    out.push({ status, path })
  }
  return out
}

/**
 * 取索引面的 name-status 清单。**取不到返回 `null`**(而不是 `[]`):
 * `[]` 的含义是"清空前索引面确实是空的"即"没有暂存删除",而取不到时我们并不知道这件事 ——
 * 两者混同就是"把判不出报成没问题"(本票三条不许漂的第 1 条)。
 */
export function readCachedNameStatus({ root, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!root) throw new Error('readCachedNameStatus() 必须显式传 root')
  const full = ['-c', 'safe.directory=*', '-C', root, 'diff', '--cached', '--name-status', '--no-renames', '-z']
  let r
  try {
    r = spawnSync(GIT_BIN, full, {
      encoding: 'utf8',
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: GIT_MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
  if (r.error || r.status !== 0) return null
  return parseNameStatusZ(r.stdout)
}

/** 清点各状态码的路径数(报告用:让人一眼看出"那 N 项暂存删除"而不是一坨路径)。 */
export function countByStatus(entries) {
  const m = new Map()
  for (const e of entries ?? []) m.set(e.status, (m.get(e.status) ?? 0) + 1)
  return m
}

/**
 * **判据本体**。`before` = 清空前那一瞬的索引面,`after` = 清空后的索引面。
 *
 * 返回 `{ kind, lost, kept, selfStaged, reason }`,四态:
 *   - `'intent-lost'`  至少有一枚路径清空前是 `D`、清空后不是、且**不属本票声明面**
 *                       ⇒ **删除意图丢失**。只**报数与点名**,绝不代裁
 *                       (不恢复、不删除、不改工作树、不动他人那枚删除本身)。
 *   - `'no-intent'`    清空前索引面里没有一枚 `D` ⇒ 本次清空没有摘掉任何删除意图。
 *   - `'undetermined'` 任一侧取不到(传了 `null` / 解析不出)⇒ **判不出**,报未判定。
 *
 * ⚠️ **为什么 `undetermined` 不能降级成 `no-intent`**:那正是票面那个事故的形态 ——
 * 取不到就"看起来没丢",于是每一次清空都把"可能丢了"读成"没事"。
 * 三条不许漂的第 1 条在这里是硬约束,不是措辞偏好。
 *
 * ⚠️ **为什么 `ownPaths` 里的 D 不算丢失**:它们会在调用方 Step 2 的
 * `git add -A -- <ownPaths>` 里被**重新暂存**,标记随即回来。这与"被摘掉且没人补回"
 * 是两件不同的事,把前者算成后者会让本判据在"本会话自删"这一档恒红(反例②)。
 *
 * @param {{before: Array<{status:string,path:string}>|null,
 *          after: Array<{status:string,path:string}>|null,
 *          ownPaths?: string[]}} input
 */
export function judgeStagedDeleteIntent({ before, after, ownPaths = [] } = {}) {
  if (!Array.isArray(before) || !Array.isArray(after)) {
    return {
      kind: 'undetermined',
      lost: [],
      kept: [],
      selfStaged: [],
      reason: !Array.isArray(before)
        ? '清空前索引面取不到 ⇒ 判不出"这批删除是否曾经是暂存态"(不冒红也不记绿)'
        : '清空后索引面取不到 ⇒ 判不出标记是否被摘掉(不冒红也不记绿)',
    }
  }
  const norm = (f) => String(f).replace(/\\/g, '/').replace(/^\.\//, '')
  const own = new Set(ownPaths.map(norm))
  const beforeD = new Map(
    before.filter((e) => e.status === 'D').map((e) => [norm(e.path), e]),
  )
  const afterD = new Set(after.filter((e) => e.status === 'D').map((e) => norm(e.path)))
  const gone = [...beforeD.keys()].filter((p) => !afterD.has(p)).sort()
  const selfStaged = gone.filter((p) => own.has(p))
  const lost = gone.filter((p) => !own.has(p))
  if (lost.length === 0) {
    return {
      kind: 'no-intent',
      lost: [],
      kept: [...beforeD.keys()].filter((p) => afterD.has(p)).sort(),
      selfStaged,
      reason:
        beforeD.size === 0
          ? '清空前索引面没有暂存删除 ⇒ 本次清空未摘掉任何删除意图'
          : selfStaged.length > 0
            ? `${selfStaged.length} 枚暂存删除属本票声明面(将由 Step 2 重新暂存),无他人删除意图丢失`
            : `${beforeD.size} 枚暂存删除在清空后仍是暂存态 ⇒ 未丢失`,
    }
  }
  return {
    kind: 'intent-lost',
    lost,
    kept: [...beforeD.keys()].filter((p) => afterD.has(p)).sort(),
    selfStaged,
    reason: `${lost.length} 枚路径在清空前是暂存删除(索引面 D)、清空后不再是、且不属本票声明面 ⇒ 删除意图丢失`,
  }
}

/**
 * safe-commit Step ① 的接线用:**清空之前**先把索引面的 `D` 清单取下来留底。
 *
 * 为什么必须在这一瞬取:实测(2026-10-04,临时仓逐条试过)`git reflog --all` /
 * `git reflog show --name-status HEAD` / `git fsck` 三条路**都答不了**这题 ——
 * 索引不是对象库的一部分,`reset HEAD` 不产生任何 reflog 条目,`fsck` 无输出。
 * 也就是说清空之后**没有任何事后痕迹**能证明"这批删除曾经是暂存态"。
 * 判据的唯一合法取样窗就是清空前这一刻,故本函数必须在 reset 之前调。
 *
 * 返回 `{ ok, before }`:取不到时 `ok:false`,调用方须按"判不出"走(不得当成"没有删除")。
 */
export function snapshotStagedDeleteIntent({ root, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const before = readCachedNameStatus({ root, timeoutMs })
  return { ok: Array.isArray(before), before }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
