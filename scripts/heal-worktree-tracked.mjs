// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/heal-worktree-tracked.mjs
/**
 * 工作区"已跟踪文件存续性"自愈(2026-09-23 立)。
 *
 * 成因:本机宿主清理层会**成批删除工作区里的目录**(实测同日三轮:137 个 → 27 个 → 1 个,
 * 命中 `tests/`、`__tests__/` 整目录、`installer-assets` 下 `assets-NNN` 的 bmp 资源、4 个在役守门脚本)。
 * `.git`/嵌套 ref 早有 `git-guardian` 分层自愈,但**工作区文件存续性无人管** ——
 * 缺失只体现为 `git status` 一片 ` D`,下一次提交就会把它们从版本树里删掉(等价静默回滚)。
 *
 * 判据(三条同时成立才恢复,任一不成立一律不碰):
 *   ① 工作区缺该文件(`git status` 的 ` D`);
 *   ② 索引里的 blob == HEAD 里的 blob —— 说明**没人对它做过任何暂存**(含 `git rm` 暂存删除),
 *      所以它是被外部清掉的,不是他人在制改动;
 *   ③ HEAD 中该路径确实存在。
 * 因此本脚本恢复的内容全部按定义零独有数据,不会覆盖任何人的未提交工作。
 *
 * 用法:
 *   node scripts/heal-worktree-tracked.mjs              # 检出即恢复
 *   node scripts/heal-worktree-tracked.mjs --dry-run    # 只报告不写盘
 *   node scripts/heal-worktree-tracked.mjs --self-test  # 独立临时仓端到端演练
 *   node scripts/heal-worktree-tracked.mjs --json       # 供 git-guardian 巡检读取
 *   node scripts/heal-worktree-tracked.mjs --check      # 只判不改 + 有可恢复项即 exit 1(CI/巡检口径)
 *   node scripts/heal-worktree-tracked.mjs --align-drift # 对齐"幻影漂移" + 恢复"旁路提交孤儿路径"(第四层)
 * 紧急跳过:IHUI_SKIP_WORKTREE_HEAL=1
 *
 * 分层:第一层 findOrphanedDeletions+heal(` D` 外部删除)、第二/三层 refreshStaleIndex+alignDrifts
 * (` M ` 落后索引与幻影漂移)、第四层 restoreBypassOrphans(2026-09-26 补:HEAD 有 / 索引无 / 盘无,
 * 前三层判据都从"索引里的 blob"出发,这一型索引里根本没有 blob,结构上永不成立 —— 只在 --align-drift 档执行)。
 *
 * 两条 2026-09-30 的收口(票面 G-794 / G-742,读这两段再改本文件):
 *  ① **锁不是崩溃的理由**。`index.lock` 由并行会话持有时,写索引那条路一律"本层跳过 + 一行原因"
 *     并按三态分档(被持有 / 疑似悬挂 / 此刻已解除 / 判不出),四种措辞的处置不同;非锁故障照旧上抛,
 *     **绝不伪装成让路**。旧行为是 refreshStaleIndex 末尾一条裸奔的 `update-index` 把异常冒到
 *     main() ⇒ exit 2 ⇒ 那一轮三层连带不执行,而守护"健康时不写行"把崩溃与平静写成同一件事。
 *     本层永不代删、也不抢别人的锁(§12 铁律);`--check`/`--dry-run` 结构上进不到写循环。
 *  ② **祖先窗口只许有一份**,住在守门 84(`windowFor`/`ancestorWindow`);本器原先自带 30 枚的浅窗口
 *     并且只给布尔,于是"窗外还有更早版本"与"不是回写"同形,账面写成"无需对齐"。现四态判定
 *     (proven / absent / beyond-window / undetermined),后两态一律**不动 + 逐条点名**。
 *     本层刻意**不**为补这一格跑无界遍历:现测真仓一次全深度 `git log -- <热档>` >120s
 *     (2026-09-30 现读:58 个可判定路径全深度问一遍约 4 分钟),而本层每 2 分钟一轮 —— 出口是
 *     逐条 `git log --find-object=<blob> -- <path>` 人工定性,不是把门弄绿。
 */
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// git 派生一律走共用层 scripts/lib/face-reader.mjs(2026-09-25 收口):绝对路径 git +
// `safe.directory` + `core.quotepath=false` + windowsHide + 显式接管 stdio(钩子/计划任务
// 派生下裸 'git' 依赖 PATH 会直接找不到二进制,而"自愈静默失效"正是本层要防的那一类)。
// 判据复用守门 84(§22d 已把 CLI 入口与导出分离,import 不会触发副作用)
// G-742(2026-09-30 接):祖先窗口**只许有一份**,住在守门 84。本器原先自带 `--max-count=30`,
// 比 84 的 40/活档 400 更浅 —— 两条尺子量同一件事却各留一个上限,于是 84 判得出"把历史版本写回
// 来了"而自愈层看不见,账面表现为"无需对齐"(实测 .github/workflows/ci.yml 与 apps/api/src/index.ts)。
// `ancestorWindow` 同时把"窗口确证用尽"这一维带回来,本器才可能把"没看到"与"没有"分成两件事说。
import { analyze, ancestorWindow, windowFor } from './check-stale-revert.mjs'
// ②′ 通道要读两面内容(索引 blob 与 HEAD blob)—— 一律走 face-reader 那一份取材层,
// 不在本器里自拼 `git show`(守门 118:引了层却自己读内容 = 半接线)。
import { catBatch, catBatchOids, catBatchSizes, gitRaw } from './lib/face-reader.mjs'
// §26:新增临时夹具唯一落点(mkScratch 不落 os.tmpdir、不落仓库树内)。第四层取证用。
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

export const SKIP_ENV = 'IHUI_SKIP_WORKTREE_HEAL'

/**
 * 本自愈的派生出口。**`timeout: 0` 是刻意的**:共用层默认为只读派生封顶 60s,而本脚本的
 * `g` 同时承载写操作(`update-index` / `read-tree` / `restore`)—— 写操作中途被 SIGTERM
 * 可能留下 `.git/index.lock`,把一次挂起换成全局阻塞(守门 80 的口径正是"只给只读动词加
 * timeout")。逐动词分流会在每个调用点上多一层"这是读还是写"的判断,漏一处就是引入新风险,
 * 故整条出口保持与本收口之前**逐字相同**的"无界"语义,不顺手改行为。
 * maxBuffer 同理保持原有 256MB(`git status --porcelain -z` / `ls-tree -r HEAD` 在滞后严重
 * 的工作区里都可能超出共用层默认的 64MB)。
 */
function makeGit(repoRoot) {
  return (args, opts = {}) => gitRaw(args, repoRoot, { timeout: 0, maxBuffer: 1 << 28, ...opts })
}

/* ------------------------------------------------------------------ *
 * G-794(2026-09-30 立)—— 索引锁三态与"本层跳过"出口。
 *
 * 立因是实测,不是假想:`node scripts/heal-worktree-tracked.mjs --align-drift` 在 2026-09-29
 * 05:2x/05:4x 两次以 **exit 2** 崩掉,栈为 `gitRaw ← makeGit ← refreshStaleIndex ← alignDrifts
 * ← main` —— 抛出点是 refreshStaleIndex 末尾那条**裸奔的** `update-index --cacheinfo` 写循环
 * (写索引需要 index.lock,而锁由并行会话持有)。后果不是一次没跑成,而是**那一轮里三层全部
 * 连带不执行**(工作区存续恢复 / 幻影漂移对齐 / 陈旧索引刷新),而 §5b 的守护"健康时不写行"
 * 让崩溃与平静在日志里长得一样 —— 判据失效的表现永远是安静。
 *
 * 三态必须分开,因为它们该做的事不同(题面第 3 条):
 *   ① 锁不存在(`absent`)而 git 报了锁文本 ⇒ 竞争**已解除**(取用与判读之间别人放锁了),
 *      或根本不是锁故障 ⇒ 本层跳过并如实说"此刻无锁",下一轮自动重试;绝不因此把故障说成"没故障";
 *   ② 锁在位且年轻/带内容(`held-live`)⇒ 正常竞争,本层跳过 + 一行原因,exit 0,不自旋不抢锁;
 *   ③ 锁在位但已超龄且空(`dangling-suspected`)⇒ 同样跳过,但措辞必须点出"**每一轮都会跳过**",
 *      因为悬挂锁意味着这一层被永久关闭而账面只是安静。
 *   ④ 问不到锁状态(`undetermined`)⇒ 按"少做一件事"处理并点名,绝不折进 ①/②/③。
 * 四种结论下本层都不写盘,也**都不代删别人的锁**(§12 铁律 + §5b:锁的处置属持有人)。
 *
 * 为什么不顺手加 `--no-optional-locks`:实测(git 2.55,临时仓造 stale index + 持锁)
 * `git status` / `git diff` / `git ls-files` 这些只读派生**并不因锁失败**(git 自己跳过可选回写),
 * 真正抛出的只有写动词 —— 所以这里修的是"写失败要归因并让路",不去给共用出口加一把
 * 当前无人需要的旗(那会同时改到写命令的语义,属于"顺手改行为",本文件头注已记过同一条纪律)。
 * ------------------------------------------------------------------ */

/** 锁龄超过这个值就判"疑似悬挂"(与 git-lock 的 staleMs 同量级)。只用于**判读与措辞**,不作为删锁依据。 */
const INDEX_LOCK_LIVE_MS = 300_000
const LOCK_PROBE_TIMEOUT_MS = 20_000
/** git 关于索引锁的两种措辞(builtin/lock.c):命中其一才有资格说"让路"。 */
const LOCK_TEXT_RE = /index\.lock|Another git process/i

/**
 * 问 git 要锁的真实落点。**不得自己拼 `<root>/.git/index.lock`** —— 本仓真 gitdir 在工作区外
 * (题面那次的报错原文就是 `D:/IHUI-AI-git-repo/index.lock`),linked worktree / `--separate-git-dir`
 * 两种形态拼出来的路径都不存在,那样探到的"absent"是一次假阴性(把有锁读成没锁 = 反过来骗人抢写)。
 */
export function indexLockPath(repoRoot, g = makeGit(repoRoot)) {
  let out = ''
  try {
    // 这是路径不是 blob 内容 ⇒ trim 安全(取内容才禁止 trim)
    out = g(['rev-parse', '--git-path', 'index.lock'], { timeout: LOCK_PROBE_TIMEOUT_MS }).trim()
  } catch (e) {
    return { ok: false, reason: `问不到 index.lock 落点:${String(e?.message ?? e).slice(0, 160)}` }
  }
  if (!out) return { ok: false, reason: 'git 没给出 index.lock 路径' }
  const abs = /^[A-Za-z]:[\\/]/.test(out) || out.startsWith('/') ? out : resolve(repoRoot, out)
  return { ok: true, path: abs }
}

/**
 * 锁的现读探针(只读:一次 rev-parse + 一次 lstat,不建不删不抢)。
 * @returns {{state:'absent'|'held-live'|'dangling-suspected'|'undetermined',lockPath:string,ageMs:number,sizeBytes:number,reason:string}}
 */
export function probeIndexLock(repoRoot, g = makeGit(repoRoot)) {
  const p = indexLockPath(repoRoot, g)
  if (!p.ok)
    return { state: 'undetermined', lockPath: '', ageMs: 0, sizeBytes: 0, reason: p.reason }
  let st = null
  try {
    st = lstatSync(p.path)
  } catch (e) {
    if (e?.code === 'ENOENT')
      return {
        state: 'absent',
        lockPath: p.path,
        ageMs: 0,
        sizeBytes: 0,
        reason: `此刻无 index.lock(${p.path})`,
      }
    // EPERM/EACCES/… 一律"判不出"——"量不到"与"没有"不并桶(本仓最高频失效型)
    return {
      state: 'undetermined',
      lockPath: p.path,
      ageMs: 0,
      sizeBytes: 0,
      reason: `量不到 index.lock(${p.path},${String(e?.code ?? e)} ⇒ 不判为无锁)`,
    }
  }
  const ageMs = Math.max(0, Date.now() - st.mtimeMs)
  const detail = `${Math.round(ageMs / 1000)}s/${st.size}B@${p.path}`
  if (ageMs <= INDEX_LOCK_LIVE_MS)
    return {
      state: 'held-live',
      lockPath: p.path,
      ageMs,
      sizeBytes: st.size,
      reason: `锁在位 ${detail}`,
    }
  return {
    state: 'dangling-suspected',
    lockPath: p.path,
    ageMs,
    sizeBytes: st.size,
    reason: `锁在位 ${detail},已超 ${Math.round(INDEX_LOCK_LIVE_MS / 1000)}s ⇒ 疑似悬挂`,
  }
}

/** 锁状态的投影(单一映射):探针状态 → 结论种类 + 该说什么。classify 与预探共用这一份。 */
function skipFromProbe(probe) {
  switch (probe?.state) {
    case 'held-live':
      return { kind: 'held', reason: `本层跳过(锁被持有)—— ${probe.reason}` }
    case 'dangling-suspected':
      return { kind: 'dangling', reason: `本层跳过(疑似悬挂锁)—— ${probe.reason}` }
    case 'absent':
      return {
        kind: 'cleared',
        reason: `本层跳过(报锁但此刻锁已不在位 ⇒ 竞争在取用与判读之间解除)—— ${probe.reason}`,
      }
    default:
      return {
        kind: 'undetermined',
        reason: `本层跳过(锁状态判不出,按"少做一件事"处理)—— ${probe?.reason ?? '未取到探针结论'}`,
      }
  }
}

/**
 * 一次派生失败的归因。四条结论,其中三条是"让路"、一条是"这跟锁无关,照旧抛":
 * **非锁故障绝不伪装成让路** —— 那等于把 exit 2 换成一句"没事",而真故障从此静默。
 */
export function classifyLockFailure(message, probe) {
  const msg = String(message ?? '')
  if (!LOCK_TEXT_RE.test(msg)) return { kind: 'not-lock', reason: msg.slice(0, 240) }
  return skipFromProbe(probe)
}

/** 让人类读者知道"跳过之后会发生什么":四种措辞各不同,不得合成一句"本轮没跑"。 */
export function lockSkipAdvice(kind) {
  switch (kind) {
    case 'held':
      return '并行会话正持有索引锁;本层每 2 分钟一轮,锁释放即自动补上,不代删、不自旋抢写(§12 铁律)。'
    case 'dangling':
      return '锁龄已超阈值 ⇒ **每一轮都会跳过**,直到有人确认无 git 写进程并处置该锁;本层不代删(处置属锁的持有人)。'
    case 'cleared':
      return '竞争已解除 ⇒ 下一轮自动重试;若反复出现这一行,查的是持锁方而不是本层。'
    case 'undetermined':
      return '锁状态判不出 ⇒ 本轮结论不算"已判定",也不写盘;先修取材(git 可执行/仓库可达)。'
    default:
      return ''
  }
}

/** 探针状态 → 建议档位(absent 与"未知"不给建议 —— 它们不是锁故障,不得跟着喊"等锁释放")。 */
export function adviceKindForState(state) {
  if (state === 'held-live') return 'held'
  if (state === 'dangling-suspected') return 'dangling'
  if (state === 'undetermined') return 'undetermined'
  return ''
}

/**
 * 逐路径 `update-index --cacheinfo`(写索引 ⇒ 需要 index.lock)。
 * 三条不可漂:① **动手前先探锁**,锁在位就一条都不试(省下 N 次注定失败的派生,也避免把
 * 同一把锁撞 N 遍);② 真撞上了按 `classifyLockFailure` 归因 —— 非锁文本原样上抛;
 * ③ 只把**写成的**计进 done,延后的逐路径点名(不得把没做的记成做过的)。
 */
export function writeIndexCacheInfos(g, repoRoot, entries) {
  const done = []
  const deferred = []
  if (!entries.length) return { done, deferred, lockSkip: null }
  const pre = probeIndexLock(repoRoot, g)
  if (pre.state === 'held-live' || pre.state === 'dangling-suspected') {
    return {
      done,
      deferred: entries.map(([p]) => p),
      lockSkip: skipFromProbe(pre),
    }
  }
  for (let i = 0; i < entries.length; i++) {
    const [p, hb] = entries[i]
    try {
      // 写动词:刻意不带 timeout(本文件头注 —— 写操作中途被 SIGTERM 可能留下 index.lock,
      // 把一次挂起换成全局阻塞)
      g(['update-index', '--cacheinfo', `100644,${hb},${p}`])
      done.push(p)
    } catch (e) {
      const verdict = classifyLockFailure(e?.message ?? e, probeIndexLock(repoRoot, g))
      if (verdict.kind === 'not-lock') throw e
      for (let k = i; k < entries.length; k++) deferred.push(entries[k][0])
      return { done, deferred, lockSkip: verdict }
    }
  }
  return { done, deferred, lockSkip: null }
}

/**
 * 分批把路径列表喂给 `git ls-files --stage --`。
 * 一次性传全部路径会撞 Windows 命令行长度上限(实测 5100 个滞后路径直接
 * `spawnSync git ENAMETOOLONG`,自愈层在"工作区滞后最严重"时恰好崩掉 —— 而它正是为这种场景写的)。
 * 150 个一批:按平均 60 字符/路径 ≈ 9KB,远低于 32767 上限。
 */
export function lsStageChunked(g, paths, chunkSize = 150) {
  const lines = []
  const seen = new Set()
  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch = paths.slice(i, i + chunkSize)
    if (!batch.length) continue
    for (const l of g(['ls-files', '--stage', '--', ...batch])
      .split('\n')
      .filter(Boolean)) {
      if (seen.has(l)) continue
      seen.add(l)
      lines.push(l)
    }
  }
  return lines
}

/**
 * 分批把绝对路径喂给 `git hash-object --`(每路径一行 oid,与 `--stdin-paths` 逐字同值,
 * 已实测五个真实路径两侧 oid 全等)。用**参数**而不是 stdin:共用层的 `gitRaw` 不接 input
 * (它把 stdio[0] 显式设成 'ignore',好让任何派生都不可能挂在 stdin 上),而分批同样是
 * 为了绕开 Windows 命令行长度上限 —— 与 `lsStageChunked` 同一个 150 个一批的量级。
 * 任一批失败或行数与路径数不等 ⇒ 整批判"取不到"(返回 null),绝不采信半截结果。
 */
function hashObjectsChunked(g, absPaths, chunkSize = 150) {
  const out = []
  for (let i = 0; i < absPaths.length; i += chunkSize) {
    const batch = absPaths.slice(i, i + chunkSize)
    if (!batch.length) continue
    const lines = g(['hash-object', '--', ...batch])
      .split('\n')
      .filter(Boolean)
    if (lines.length !== batch.length) return null
    out.push(...lines)
  }
  return out
}

/**
 * 降级通道的**前提复核**(只在 restore 已经失败时才跑,正常路径零额外开销):
 * 这批路径此刻仍满足「索引里有该路径 且 索引 blob == HEAD blob」吗?
 * 调用方的判据在**计算时刻**成立,而判据与写盘之间并行会话可能推进索引 —— 若不复核就
 * `checkout-index`,写出去的是别人刚暂存的内容(等于替他落盘),那不是恢复而是越权。
 * 两次调用都只读(ls-files / ls-tree),因此不受 index.lock 影响 —— 这正是本通道存在的前提。
 */
function stillIndexEqualsHead(g, batch) {
  const indexBlob = new Map()
  for (const l of lsStageChunked(g, batch)) {
    const tab = l.indexOf('\t')
    if (tab < 0) continue
    const meta = l.slice(0, tab).split(' ')
    if (meta.length >= 2) indexBlob.set(l.slice(tab + 1), meta[1])
  }
  const headBlob = new Map()
  for (let i = 0; i < batch.length; i += 150) {
    const chunk = batch.slice(i, i + 150)
    for (const l of g(['ls-tree', '-r', 'HEAD', '--format=%(objectname) %(path)', '--', ...chunk])
      .split('\n')
      .filter(Boolean)) {
      const sp = l.indexOf(' ')
      if (sp <= 0) continue
      headBlob.set(l.slice(sp + 1), l.slice(0, sp))
    }
  }
  return batch.filter((p) => {
    const ib = indexBlob.get(p)
    return !!ib && ib === headBlob.get(p)
  })
}

/**
 * 逐批把路径恢复到 HEAD。**一次锁竞争不该让整轮自愈崩掉**:
 * 共享工作区里并行会话的 commit 会瞬时持有 index.lock(实测本会话就撞上一次),
 * 原先三处 restore 循环都是直接 execFileSync —— 抛出即整 tick 失败,而这一层的意义正是
 * "下一轮自己补上"。故失败只记账、延到下一 tick,并把延后数如实返回。
 *
 * **但"延到下一 tick"在锁被长期持有时等于永不恢复**(2026-09-29 实测:一次宿主清理删掉
 * 22 个跟踪文件,而 `D:/IHUI-AI-git-repo/index.lock` 由并发会话反复重建,连跑 6 轮守护
 * 全部 deferred;线上构建因此一次落后 102 个提交)。`restore --worktree` 之所以要锁,
 * 只是因为它顺手刷新索引里的 stat 信息;真正需要的动作(把工作树副本写回来)**不需要写索引**,
 * 而 `git checkout-index --force` 正是该动作的 git 原生形态 —— 它只读索引、只写工作树。
 * 所以 restore 失败后降级走它,并逐批复核前提(见 `stillIndexEqualsHead`);两条都不成立才记延后。
 */
function restoreToHead(g, paths) {
  const done = []
  const deferred = []
  const viaIndex = []
  for (let i = 0; i < paths.length; i += 40) {
    const batch = paths.slice(i, i + 40)
    try {
      g(['restore', '--source=HEAD', '--worktree', '--', ...batch])
      done.push(...batch)
      continue
    } catch {
      // 落到降级通道
    }
    let ok = []
    try {
      ok = stillIndexEqualsHead(g, batch)
    } catch {
      ok = []
    }
    if (!ok.length) {
      deferred.push(...batch)
      continue
    }
    try {
      g(['checkout-index', '--force', '--', ...ok])
      done.push(...ok)
      viaIndex.push(...ok)
      const rest = batch.filter((p) => !ok.includes(p))
      if (rest.length) deferred.push(...rest)
    } catch {
      deferred.push(...batch)
    }
  }
  return { done, deferred, viaIndex }
}

/** 路径归一(与 safe-commit 的 `normalize` 同算式:统一正斜杠、去 ./ 前缀)。 */
const normRepoPath = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '')

/**
 * G-1018292:读 safe-commit 清空前留下的"删除意图丢失"账,返回**路径集合**。
 *
 * 账的落点:`<repo>/.workbuddy/staged-delete-intent-ledger.jsonl`(写入方是
 * `safe-commit.mjs` 的 `recordClearedStagedDeletions`;`.gitignore:377` 已忽略整个目录)。
 *
 * 三条判据纪律:
 *  - **取不到账 ⇒ 返回空集合,但调用方必须当成"判不出"而不是"没有删除"** ——
 *    调用点因此只把该路径移进报数档,**不做任何写动作**。
 *  - **只认 `actionTaken==='report-only'` 且 `clearedIntentLost` 非空的条目**:
 *    账是我们自己写的,读它时按"声明过没动过手"来验,免得账被改成"已恢复"而本层跟着信。
 *  - **读账失败(坏JSON / 权限 / 半截行)一律吞掉并按空集合走**:本层每 2 分钟被守护调一次,
 *    账坏了不该让整层崩掉(G-794 同一取向);而空集合的失效方向是"照原判据恢复",
 *    那正是改前的行为,不是新的破坏面。
 */
export function recentlyClearedStagedIntent(repoRoot) {
  const out = new Set()
  let raw
  try {
    raw = readFileSync(join(repoRoot, '.workbuddy', 'staged-delete-intent-ledger.jsonl'), 'utf8')
  } catch {
    return out // 账不存在 = 从没发生过清空 ⇒ 无证据(调用点按判不出处理,不做写动作)
  }
  for (const line of raw.split('\n')) {
    const s = line.trim()
    if (!s) continue
    let rec
    try {
      rec = JSON.parse(s)
    } catch {
      continue // 半截行(并发 append 撞上)不折进结论,也不让整层崩
    }
    if (!rec || rec.actionTaken !== 'report-only') continue
    for (const p of Array.isArray(rec.clearedIntentLost) ? rec.clearedIntentLost : []) {
      if (typeof p === 'string' && p) out.add(normRepoPath(p))
    }
  }
  return out
}

/** 工作区缺失但索引与 HEAD 完全一致的已跟踪文件 = 被外部删除 */
export function findOrphanedDeletions(repoRoot) {
  const g = makeGit(repoRoot)
  const st = g(['status', '--porcelain', '-z'])
  const safe = []
  const held = []
  /**
   * G-1018292 新增档:**只报数不代裁**。判据与理由见下面 `recentlyClearedStagedIntent` 调用处。
   * 它与 `held`(索引里也没有 = 他人已 `git rm`)是**两件不同的事**,不可折进同一格:
   * `held` 的证据在索引面(此刻仍读得到),`intentLost` 的证据在清空前留下的账
   * (索引面已被覆盖,标记已经不在了)——折进同一格会让账面读起来像"标记还在,只是没碰"。
   */
  const intentLost = []
  /**
   * **只报不修**的一类:`git status` 首列 `D ` —— 索引里没有、磁盘也没有,而 HEAD 有该路径。
   * 两种成因在机器上分不开:① 会话有意 `git rm`(暂存删除,尚未提交);② 旁路提交
   * (commit-tree/merge-tree)把路径**加进** HEAD 却没动共享索引 ⇒ 索引成了"缺该路径"的孤儿态。
   * ② 的真实代价是静默烂掉:本仓 2026-09-24 有 5 个测试文件因 `packages/shared/src/chat/voice-subtitles.ts`
   * 处于此态而**加载失败**(报的是 vite "Failed to resolve import",看不出与工作区存续有关),
   * 而当时的巡检口径把它整个漏掉、还回一句"存续正常"。故本分支**如实报数**(退出码非 0),
   * 恢复动作仍交归属会话 —— 与守门层"分不清就不动"的取向一致。
   * (2026-09-26 补:这一型在**默认恢复档**依旧只报不修;分离办法落在第四层 ——
   * `restoreBypassOrphans` 的父树签名判据④,只在 --align-drift 上下文执行。)
   */
  const orphanIndex = []
  for (const rec of st.split('\0')) {
    if (!rec) continue
    const xy = rec.slice(0, 2)
    const path = rec.slice(3).trim()
    if (xy === 'D ' && path) {
      try {
        g(['rev-parse', `HEAD:${path}`])
        if (!existsSync(resolve(repoRoot, path))) orphanIndex.push(path)
      } catch {
        /* HEAD 也没有 ⇒ 不是本类,忽略 */
      }
      continue
    }
    if (xy !== ' D' || !path) continue
    let indexBlob = ''
    try {
      indexBlob = (g(['ls-files', '-s', '--', path]).split('\t')[0] || '').split(' ')[1] || ''
    } catch {
      indexBlob = ''
    }
    let headBlob = ''
    try {
      // 路径可能不在 HEAD 里(新增文件);git 的 fatal 不得漏进结论面 —— 本脚本每 2 分钟被守护
      // 跑一次,stderr 噪音会淹掉真正的自愈审计行。接管 stdio 由共用层负责(gitRaw 把 stderr
      // 收进异常对象而不是透给父进程),这里只需把异常吞成"取不到"。
      headBlob = g(['rev-parse', `HEAD:${path}`]).trim()
    } catch {
      headBlob = ''
    }
    if (indexBlob && indexBlob === headBlob && !existsSync(resolve(repoRoot, path))) {
      // G-1018292(2026-10-04):**恢复前的最后一道问句** —— 这枚删除的意图是否刚被
      // 共享索引的整批清空摘掉过?是则**只报数,不代裁**。
      //
      // 为什么必须问:本层那三条判据(工作树缺 ∧ 索引 blob==HEAD blob ∧ HEAD 有)在
      // "有意`git rm` 的暂存删除"与"宿主清理层误删"两种成因上**同形** —— 两者都是
      // ` D`、三条全成立。而 `safe-commit.mjs` 的 Step① `git reset HEAD` 会把整个共享
      // 索引清空,于是他人那枚 `D ` 退化成 ` D`,保护标记被摘掉 ⇒ 本层把一枚可能有意的
      // 删除当成外部删除恢复(2026-09-28 实测链,票G-1018292)。
      //
      // 为什么答不出就**只报数**:实测 reflog / `reflog show --name-status` / `fsck`
      // 三条路结构上都答不了"曾否是暂存态"(索引不是对象库的一部分,reset 不留痕),
      // 唯一的证据面是 safe-commit 清空前落下的那份账。故取不到账 =判不出,
      // 而**判不出不等于可以恢复**:恢复一枚有意的删除比留下它更危险。
      //
      // ⚠️ 这一档**只把该路径从 safe 移到 intentLost(报数)**,不改任何既有判据:
      // 索引/HEAD/工作树三条的算法、其余分支、退出码面全部逐字未动。
      if (recentlyClearedStagedIntent(repoRoot).has(normRepoPath(path))) {
        intentLost.push(path)
        continue
      }
      safe.push(path)
    } else if (!indexBlob) held.push(path) // 索引里也没有:他人已暂存删除,不碰
  }
  return { safe, held, orphanIndex, intentLost }
}

/**
 * 该 blob 是否出现在此路径的历史版本里 —— **四态**,不再是一个布尔(G-742 收口)。
 *
 * 旧实现是 `git log --max-count=30` 的布尔版:窗口用尽而窗外还有更早版本时,它和"历史就到
 * 这里"给出同一个 `false`,于是自愈层的**深度上限就是它的失明上限**,而账面只写"无需对齐"。
 * 现窗口取自守门 84 的 `windowFor`/`ancestorWindow`(同一件事只许有一份实现:84 判得出的回写,
 * 本层必须同样看得见),并把"确证用尽"单独成一档:
 *   'proven'          窗内命中 ⇒ 可证零独有数据,允许动;
 *   'absent'          历史就到这里且没命中 ⇒ 那是真新内容,不动也**不必点名**;
 *   'beyond-window'   窗口用尽而没命中 ⇒ **判不出**(窗外可能有更早版本),不动 + 逐条点名;
 *   'undetermined'    祖先清单或正文取不到 ⇒ 不动 + 逐条点名(与"没有"不同形)。
 * 失效方向一致是"少做一件事 + 大声点名",绝不为把门弄绿去覆写别人的现场。
 */
export function blobInAncestry(repoRoot, path, blob) {
  const win = windowFor(path)
  if (!blob)
    return {
      verdict: 'undetermined',
      window: win,
      seen: 0,
      reason: '待判的 blob 取不到 ⇒ 不判为"不是祖先"',
    }
  let aw
  try {
    aw = ancestorWindow(repoRoot, path)
  } catch (e) {
    return {
      verdict: 'undetermined',
      window: win,
      seen: 0,
      reason: `祖先清单取不到:${String(e?.message ?? e).slice(0, 160)}`,
    }
  }
  if (!aw.shas.length)
    return aw.truncated
      ? {
          verdict: 'beyond-window',
          window: aw.window,
          seen: 0,
          reason: `窗口 ${aw.window} 内一枚"动过该路径"的提交都取不到`,
        }
      : { verdict: 'absent', window: aw.window, seen: 0 }
  let oids
  try {
    oids = catBatchOids(
      repoRoot,
      aw.shas.map((c) => `${c}:${path}`),
    )
  } catch (e) {
    return {
      verdict: 'undetermined',
      window: aw.window,
      seen: aw.shas.length,
      reason: `历史正文对象取不到:${String(e?.message ?? e).slice(0, 160)}`,
    }
  }
  for (const c of aw.shas)
    if (oids.get(`${c}:${path}`) === blob)
      return { verdict: 'proven', window: aw.window, seen: aw.shas.length, commit: c.slice(0, 9) }
  return aw.truncated
    ? {
        verdict: 'beyond-window',
        window: aw.window,
        seen: aw.shas.length,
        reason: `祖先窗口 ${aw.window} 确证用尽(窗外还有更早"动过它"的提交)而窗内未命中`,
      }
    : { verdict: 'absent', window: aw.window, seen: aw.shas.length }
}

/**
 * 覆盖前留退路:把工作区现场字节按 UTC 时间戳目录快照一份,返回快照落点。
 * 只给"需要被覆盖的那几个文件"用,故不做全仓扫描;单文件上限由调用方的 maxBytes 保证。
 */
export function snapshotWorktreeBytes(repoRoot, paths, destDir) {
  if (!paths.length) return []
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
  const dir = join(destDir || repoRoot, '.ihui-agent', 'tmp', 'worktree-align-snapshots', stamp)
  const done = []
  for (const p of paths) {
    try {
      const abs = resolve(repoRoot, p)
      const to = join(dir, p.replace(/[\\/]/g, '_'))
      mkdirSync(dirname(to), { recursive: true })
      copyFileSync(abs, to)
      done.push(to)
    } catch {
      /* 快照失败不阻断对齐:判据本身已保证不含独有内容 */
    }
  }
  return done
}

/**
 * 复合滞后判定(2026-09-24 补,`alignDrifts` 的第二条判据通道)。
 *
 * 整块 blob **不等于**任何祖先版本,但工作区相对 HEAD 的**每一个改动块**都是该路径自己在
 * 某个历史提交里逐字有过的文本 ⇒ 同样是"回潮",按定义不含任何独有内容。
 *
 * 为什么整块判据不够:并行会话的「索引层重建 / 旧基线回写」产出的是**拼合态**(迁移前的取色段
 * + 迁移前的圆角段拼进同一份文件),这个组合从未作为整体提交过 —— 于是它既躲过守门 84 的整块
 * 祖先判定,也躲过 alignDrifts,却会在任何一次不带 pathspec 的 commit 里把已入库的迁移整体回滚。
 * 本会话实测 8 个 mobile-rn/共享包文件 18 处已删键悬空引用即此态。
 *
 * 四条硬护栏(宁可漏,不可误覆盖他人现场):
 *   ① **形状限定**:diff 里每一行(增、删两侧都算)必须是"取用行本身" —— 单行样式属性赋值
 *      (`color` / `backgroundColor` / `borderColor` / `border*Radius`)、import/export 行或空行。
 *      这一条同时挡住三类误伤:改逻辑/改 JSX;删掉整段尾巴(git 会把删除并进相邻改动块,
 *      所以"只删不增"的 hunk 判据单独用会漏 —— 见 self-test ⑱);新增任何成段代码。
 *   ② 每个新增块都必须逐字见于该路径某个历史 blob(真新编辑必打破此条);
 *   ③ **纯重排不算**:同一批行只是换了位置(import 排序等)既不携带回退风险,写回 HEAD 又会和
 *      lint-staged 的格式化器来回打架 —— 实测本仓这种"假滞后"多达 184 个文件;
 *   ④ 覆盖前把现场字节快照到 `.ihui-agent/tmp/worktree-align-snapshots/<UTC>/` 并报出份数,
 *      判据再严也留一次可逆退路(整块通道命中时工作区内容本就 == 某历史版本,无需快照)。
 *
 * 代价说清楚:只有"批量取色/圆角迁移被回写成旧档名"这一种形态能被自动收口。而那恰是本仓两次
 * 批量迁移(圆角 309 文件、CTA 26 文件)真实留下的滞后形态;其余拼合滞后仍需人判,不留机器错觉。
 */
/** 取用行:单行样式属性赋值,或 import/export 行 —— 两者都不可能是"一段功能逻辑" */
const STYLE_TAKE_LINE =
  /^\s*(?:border(?:Top|Bottom)?(?:Left|Right)?Radius|backgroundColor|borderColor|color)\s*:\s*[A-Za-z_$][\w$]*(?:\.[\w$]+)*\s*,?\s*$/
const MODULE_TAKE_LINE = /^\s*(?:import|export)\b/

export function compositeDriftPaths(
  repoRoot,
  paths,
  { maxBytes = 512 * 1024, maxFiles = 80, windowLoss = null } = {},
) {
  const g = makeGit(repoRoot)
  const hits = []
  for (const p of paths.slice(0, maxFiles)) {
    let size = 0
    try {
      size = statSync(resolve(repoRoot, p)).size
    } catch {
      continue
    }
    if (!size || size > maxBytes) continue
    let diff = ''
    try {
      diff = g(['diff', '--no-color', '-U0', 'HEAD', '--', p])
    } catch {
      continue
    }
    const groups = []
    let cur = null
    let allTakeLines = true
    const shaped = (l) => !l.trim() || STYLE_TAKE_LINE.test(l) || MODULE_TAKE_LINE.test(l)
    for (const line of diff.split('\n')) {
      if (line.startsWith('@@')) {
        if (cur && cur.length) groups.push(cur)
        cur = []
        continue
      }
      if (!/^[-+]/.test(line) || /^(\+\+\+|---)/.test(line)) continue
      const body = line.slice(1).replace(/\r$/, '')
      if (!shaped(body)) allTakeLines = false
      if (line[0] === '+' && cur) cur.push(body)
    }
    if (cur && cur.length) groups.push(cur)
    if (!allTakeLines || !groups.length) continue
    const joined = groups.map((ls) => ls.join('\n'))
    // 窗口与整块通道**同源**(守门 84 的 ancestorWindow),不再自带第二个上限(G-742)。
    // 旧写法是 `--max-count=30` + 逐条 `git show`:同一件事两套深度 ⇒ 84 判得出的回写本层看不见,
    // 而"窗内没命中"与"窗外还有更早版本"在旧返回里都是 `continue`,账面同样安静。
    let aw
    try {
      aw = ancestorWindow(repoRoot, p)
    } catch (e) {
      if (windowLoss)
        windowLoss.push({
          path: p,
          window: windowFor(p),
          seen: 0,
          channel: 'composite',
          reason: `祖先清单取不到:${String(e?.message ?? e).slice(0, 120)}`,
        })
      continue
    }
    const texts = []
    if (aw.shas.length) {
      let got = null
      try {
        got = catBatch(
          repoRoot,
          aw.shas.map((c) => `${c}:${p}`),
        )
      } catch (e) {
        if (windowLoss)
          windowLoss.push({
            path: p,
            window: aw.window,
            seen: aw.shas.length,
            channel: 'composite',
            reason: `历史正文取不到:${String(e?.message ?? e).slice(0, 120)}`,
          })
        continue
      }
      // 该版本无此路径 ⇒ map 里没有这条规格(与旧 `git show` 抛错后跳过同义)
      for (const c of aw.shas) {
        const t = got.get(`${c}:${p}`)
        if (typeof t === 'string') texts.push(t)
      }
    }
    if (!texts.length) {
      if (aw.truncated && windowLoss)
        windowLoss.push({
          path: p,
          window: aw.window,
          seen: 0,
          channel: 'composite',
          reason: `窗口 ${aw.window} 用尽而窗内一条历史正文都没取到 ⇒ 判不出`,
        })
      continue
    }
    // 只做"内容回潮"的收口:**纯重排**(同一批行换了位置,典型是 import 排序)不在此列 ——
    // 它不携带任何回退风险,而把它写回 HEAD 会和 lint-staged 的格式化器来回打架。
    const norm = (s) =>
      s
        .split('\n')
        .map((l) => l.replace(/\r$/, '').trim())
        .filter(Boolean)
        .sort()
        .join('\n')
    if (norm(g(['show', `HEAD:${p}`])) === norm(readFileSync(resolve(repoRoot, p), 'utf8')))
      continue
    if (joined.every((grp) => texts.some((t) => t.includes(grp)))) hits.push(p)
    else if (aw.truncated && windowLoss)
      // 没命中 + 窗口确证用尽 ⇒ "没抓到"不等于"没有回写",必须点名(不得跟着旧写法安静地跳过)
      windowLoss.push({
        path: p,
        window: aw.window,
        seen: aw.shas.length,
        channel: 'composite',
        reason: `拼合通道窗口 ${aw.window} 确证用尽而未命中`,
      })
  }
  return hits
}

/**
 * 刷新"落后索引"(CAS / converge 用 commit-tree+update-ref 推进 HEAD 却不动主索引的后遗症)。
 * 危险在于:此时 `git status` 首列为 `M `,任何人一次不带 pathspec 的普通 commit
 * 就会把这批文件整体写回旧版 ⇒ 一次性静默回滚(实测本仓同一天出现 14 个这样的路径)。
 *
 * 判据(三条同时成立才刷新,且**逐路径 update-index**,绝不做全局 `git reset` —— 那会
 * 连带 unstage 他人真正的暂存):
 *   ① 索引 blob != HEAD blob;
 *   ② 索引 blob 确为该路径的某个**历史版本**(⇒ 不是新做的暂存);
 *      该"历史版本"判定自 2026-09-30 起走守门 84 的**同一份**窗口实现(`blobInAncestry`),
 *      并给出四态(命中/历史就到这里/窗口确证用尽/取不到)。后两态一律**不刷新**且逐条点名
 *      进 `ancestryUndetermined` —— 旧写法自带 `--max-count=30` 的布尔判据把"窗外还有更早版本"
 *      与"不是回写"读成同一个 false,那是把没判写成判过了(G-742 ①)。
 *      本层**刻意不去跑无界遍历**补这一格:现测真仓一次全深度 `git log -- <热档>` >120s,
 *      而这一层每 2 分钟一轮;出口写在报告里(逐条 `git log --find-object` 人工定性)。
 *   ③ 该路径上没有"现场":工作区 == 索引(无未暂存改动),**或**工作区 == HEAD
 *      (旁路提交后工作区已跟上 HEAD,刷索引只是把 index 补齐 —— 不覆盖任何东西)。
 *   ③ 的后一形态是 CAS/`commit-tree` 提交后最常见的残留(本仓 2026-09-23 实测 4 个路径),
 *   只写"工作区==索引"会把它永久漏掉:那些陈旧 index blob 会一直躺在暂存区里,
 *   等任何人一次不带 pathspec 的普通 commit 把文件写回旧版。
 *
 * **第二条通道(②′,2026-09-29 立)**:③ 不成立(工作树另有现场)时,若
 *   **索引内容逐行是 HEAD 该路径内容的子集(按行重数判)**,同样刷新。
 *   理由:刷新只写索引、从不写工作树 —— 别人真正在写的现场在盘上,一行都不动;
 *   而"索引里没有一行比 HEAD 更新"这件事是**可判的**,比"工作树恰好等于索引"强得多:
 *   前者直接证明"把 index 对齐到 HEAD 不会消失任何一行已暂存内容"。
 *   立因:同一台机一天内三次把外来旧快照 `git add` 进共享索引(实测 38 个路径的暂存内容
 *   等于其祖先版本),而 ①②③ 里 ③ 把这些路径全部 held ⇒ 守门 84 每轮判红、谁碰谁被拦,
 *   修的人只能逐路径手工作业(本会话已手工收过一次,下一拍又长回来)——
 *   **判据缺的不是严格,是"能证明无损时应当动手"**。
 *   两条护栏:① 暂存删除(diff-filter=D)**永不**走这条通道(删除可以是有意意图,
 *   "索引里没有"在多重集判据里天然成立,那是把意图读成无损);
 *   ② 单侧尺寸超过 `SUBSET_MAX_BYTES`(默认 2 MB)的路径不判 —— 巨型活文档的行级子集判定
 *   每 2 分钟跑一次不划算,而那一格恰恰最不该自动动(AGENTS §12 的活文档纪律要人工归并)。
 */
const SUBSET_MAX_BYTES = 2 * 1024 * 1024
export function refreshStaleIndex(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  const staged = g(['diff', '--name-only', 'HEAD', '--cached', '--no-renames'])
    .split('\n')
    .filter(Boolean)
  if (!staged.length)
    return {
      refreshed: 0,
      paths: [],
      deferred: [],
      held: 0,
      subsetRefreshed: 0,
      subsetPaths: [],
      lockSkip: null,
      ancestryUndetermined: [],
      subsetUndetermined: [],
    }
  const idxBlob = new Map()
  for (const l of lsStageChunked(g, staged)) {
    const meta = l.split('\t')[0].split(' ')
    if (meta.length >= 2) idxBlob.set(l.split('\t')[1], meta[1])
  }
  const headBlob = new Map(
    g(['ls-tree', '-r', 'HEAD', '--format=%(objectname) %(path)'])
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(' ')
        return [l.slice(i + 1), l.slice(0, i)]
      }),
  )
  const wtBlob = new Map()
  // 暂存删除(diff-filter=D)的路径在工作区里根本不存在,把它们一起喂给
  // `hash-object` 会让整条命令 fatal 退出 ⇒ 本自愈每轮都崩在同一处,
  // 工作区存续恢复通道等于停摆(2026-09-23 实测:scripts/tests/gitdir-archive-paths.test.mjs)。
  const present = staged.filter((p) => existsSync(resolve(repoRoot, p)))
  if (present.length) {
    try {
      const hashOut = hashObjectsChunked(
        g,
        present.map((p) => resolve(repoRoot, p)),
      )
      if (hashOut && hashOut.length === present.length)
        present.forEach((p, i) => wtBlob.set(p, hashOut[i]))
    } catch {
      // 取不到工作区 blob ⇒ 宁可不刷新(held),也不要在看不到现场时动索引
    }
  }

  const refreshable = []
  /** ②′ 通道的候选:③ 不成立,但索引内容逐行是 HEAD 的子集(证明见 subsetRefreshable 头注) */
  const subsetHeld = []
  /** 判据②"整块祖先"这一维**判不出**的路径(G-742):窗口用尽 / 取不到 ⇒ 逐条点名,不折进 held 也不折进"不是回写" */
  const ancestryUndetermined = []
  let held = 0
  for (const p of staged) {
    const ib = idxBlob.get(p)
    const hb = headBlob.get(p)
    if (!ib || !hb || ib === hb) {
      held++
      continue
    }
    // ③ 无现场:工作区==索引(无未暂存改动)或 工作区==HEAD(旁路提交后工作区已跟上)
    const wt = wtBlob.get(p)
    const noLocalState = !wtBlob.size || wt === ib || wt === hb
    if (noLocalState) {
      // 只在"确实没有现场"时才付那次祖先取材(旧写法靠 && 短路,这条懒求值保持不变)
      const anc = blobInAncestry(repoRoot, p, ib)
      if (anc.verdict === 'proven') {
        refreshable.push([p, hb])
        continue
      }
      if (anc.verdict !== 'absent')
        ancestryUndetermined.push({
          path: p,
          verdict: anc.verdict,
          window: anc.window,
          seen: anc.seen,
          reason: anc.reason,
        })
      // 整块判据给不出结论 ⇒ 仍让 ②′ 用"行子集"那一维再证一次(它是另一种无损证明)
    }
    subsetHeld.push(p) // 交给 ②′:能证明"索引没有一行比 HEAD 新"就刷新,否则才算 held
  }
  const subsetLoss = []
  const viaSubset = subsetRefreshable(repoRoot, subsetHeld, idxBlob, headBlob, subsetLoss)
  const refreshedPaths = [...refreshable, ...viaSubset]
  held += subsetHeld.length - viaSubset.length
  if (!refreshedPaths.length)
    return {
      refreshed: 0,
      paths: [],
      deferred: [],
      held,
      subsetRefreshed: 0,
      subsetPaths: [],
      lockSkip: null,
      ancestryUndetermined,
      subsetUndetermined: subsetLoss,
    }
  if (dryRun)
    return {
      refreshed: 0,
      paths: refreshable.map(([p]) => p),
      deferred: [],
      held,
      subsetRefreshed: 0,
      subsetPaths: viaSubset.map(([p]) => p),
      // 零副作用档结构上碰不到写循环 ⇒ G-794 那句"同一异常在 --check 口径下根本不该出现"
      // 在这里是**定义**而不是一句承诺:lockSkip 恒为 null,由镜像 T5 钉住。
      lockSkip: null,
      ancestryUndetermined,
      subsetUndetermined: subsetLoss,
      dryRun: true,
    }
  const { done, deferred, lockSkip } = writeIndexCacheInfos(g, repoRoot, refreshedPaths)
  return {
    // 只把**真写进去的**计成 refreshed;撞锁延后的逐路径点名(不得把没做的记成做过的)
    refreshed: done.length,
    paths: done,
    deferred,
    held,
    subsetRefreshed: viaSubset.length,
    subsetPaths: viaSubset.map(([p]) => p),
    lockSkip,
    ancestryUndetermined,
    subsetUndetermined: subsetLoss,
  }
}

/**
 * ②′ 通道:索引内容是否**逐行(按重数)是 HEAD 的子集**。成立 ⇒ 对齐索引不可能让任何一行
 * 已暂存的内容消失,故"工作树另有现场"不再构成 held 的理由(刷新从不写工作树)。
 *
 * 三条不做的事,每一条都是代价换正确性:
 *  - **不看暂存删除**:`ib` 取不到就不进候选 —— "索引里没有"在多重集判据里天然成立,
 *    那会把一次有意的 `git rm` 读成无损(AGENTS §7 删除安全)。
 *  - **不碰超过 SUBSET_MAX_BYTES 的路径**:巨型活文档(PROJECT_PLAN.md 实测 15 MB)每 2 分钟
 *    做一次全量行判定不划算,而那一格恰恰最该走人工归并(§12 的活文档纪律)。
 *  - **取不到内容一律不算通过**:任何一侧读不出来 ⇒ held(判不出 ≠ 无损),
 *    并把条数带进返回值,免得"这一族没判"被读成"这一族干净" —— 自 2026-09-30 起这些"没判"
 *    不再只是折进 held 一个总数:`loss` 收集口(第 5 参)逐批点名路径与原因,由
 *    `refreshStaleIndex` 带到 `subsetUndetermined` 输出面(G-742 的"不得把没判写成判过了")。
 */
export function subsetRefreshable(repoRoot, candidates, idxBlob, headBlob, loss = null) {
  if (!candidates.length) return []
  const specs = []
  const sized = []
  for (const p of candidates) {
    const ib = idxBlob.get(p)
    const hb = headBlob.get(p)
    if (!ib || !hb) continue // 暂存删除 / 一侧不存在 ⇒ 永不自动动
    specs.push(`:${p}`, `HEAD:${p}`)
    sized.push(p)
  }
  if (!specs.length) return []
  let sizes
  try {
    sizes = catBatchSizes(repoRoot, specs)
  } catch (e) {
    if (loss)
      loss.push({ paths: sized, reason: `尺寸问不到:${String(e?.message ?? e).slice(0, 120)}` })
    return [] // 问不到尺寸 ⇒ 一条都不动
  }
  const keep = sized.filter((p) => (sizes.get(`:${p}`) ?? 1 << 30) <= (sizes.get(`HEAD:${p}`) ?? 0))
  const readable = keep.filter(
    (p) =>
      (sizes.get(`:${p}`) ?? 1 << 30) <= SUBSET_MAX_BYTES &&
      (sizes.get(`HEAD:${p}`) ?? 1 << 30) <= SUBSET_MAX_BYTES,
  )
  // 超护栏的一族是**刻意不动**(活文档走人工归并),但它必须被点名 —— 否则"没判"与"判过"同形
  const oversized = sized.filter((p) => !readable.includes(p) && !keep.includes(p))
  const tooBig = keep.filter((p) => !readable.includes(p))
  if (loss && (oversized.length || tooBig.length))
    loss.push({
      paths: [...oversized, ...tooBig],
      reason: `超尺寸护栏(${SUBSET_MAX_BYTES} B)⇒ 本层刻意不判,交人工归并`,
      bucket: 'oversized',
    })
  if (!readable.length) return []
  const want = []
  for (const p of readable) want.push(`:${p}`, `HEAD:${p}`)
  let texts
  try {
    texts = catBatch(repoRoot, want)
  } catch (e) {
    if (loss)
      loss.push({ paths: readable, reason: `正文取不到:${String(e?.message ?? e).slice(0, 120)}` })
    return [] // 取不到 ⇒ held,不猜
  }
  const out = []
  for (const p of readable) {
    const a = texts.get(`:${p}`)
    const b = texts.get(`HEAD:${p}`)
    if (typeof a !== 'string' || typeof b !== 'string') {
      if (loss) loss.push({ paths: [p], reason: '索引侧或 HEAD 侧正文读不到 ⇒ 判不出(不算无损)' })
      continue
    }
    if (linesAreSubMultiset(a, b)) out.push([p, headBlob.get(p)])
  }
  return out
}

/** 行多重集包含:a 的每一行重数 ≤ b —— 尾部空行差异不计(两次 split 同形,故无需特判)。 */
function linesAreSubMultiset(a, b) {
  const m = new Map()
  for (const l of b.split('\n')) m.set(l, (m.get(l) || 0) + 1)
  for (const l of a.split('\n')) {
    const n = m.get(l) || 0
    if (n === 0) return false
    m.set(l, n - 1)
  }
  return true
}

/**
 * 幻影漂移对齐(比缺失恢复更严的判据,供 `--align-drift` 与 git-sync-converge 调用):
 * 只对齐**同时满足**三条的路径 —— ① 索引 blob == HEAD blob(该路径上无人暂存过任何东西);
 * ② 工作区内容 != HEAD;③ 内容属"回潮",两条通道任一成立即算:
 *    ③a 守门 84 判定工作区内容**字节级等于该路径某祖先提交版本**;
 *    ③b `compositeDriftPaths` 判定**每个改动块**逐字见于该路径某个历史版本,且**无纯删除块**
 *       (拼合旧基线形态:整块从未作为整体提交过,③a 看不见它)。
 * 会话真实未提交编辑必然打破 ① 或 ③,故不会被覆盖。
 *
 * 为什么需要它:§12d 的 converge 用 merge-tree/commit-tree 只推进 HEAD 与 index、从不 checkout,
 * HEAD 每前进一次,工作区就多一批落后文件(实测 503 个文件落后 486 个提交)。这些文件被
 * `git add` 提交出去就是静默回滚 —— 守门 84 会拦,但拦住之后仍要有人手工对齐,故在此自动化。
 *
 * 本函数同时是第四层 restoreBypassOrphans 的唯一执行面(2026-09-26):converge 成功出口调的就是
 * `--align-drift`,旁路孤儿恢复挂在这里等于"HEAD 每被旁路推进一次,下一拍就被补一次"。
 * 恢复层(heal 默认档)刻意**不**调用它 —— 新档只在显式的 --align-drift 下写盘。
 */
export function alignDrifts(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  /**
   * G-794:各层**独立让路**。任何一层撞上"索引锁被他人持有"都只关自己那一层,
   * 不得把异常冒到 main() —— 旧行为是一次抛穿让整轮三层(存续恢复 / 漂移对齐 / 索引刷新)
   * 连带不执行,而守护的"健康时不写行"把崩溃与平静写成同一件事。
   * 非锁故障照旧上抛:把真故障伪装成"本轮让路"比崩掉更糟(那才是真的安静)。
   */
  const layerSkips = []
  const noteSkip = (layer, e) => {
    const verdict = classifyLockFailure(e?.message ?? e, probeIndexLock(repoRoot, g))
    if (verdict.kind === 'not-lock') throw e
    layerSkips.push({ layer, ...verdict })
    return verdict
  }
  // 先刷新"落后索引"(CAS/converge 只推进 HEAD 的后遗症),否则下面判据①会把它们全部误挡掉
  let refreshed = {
    refreshed: 0,
    paths: [],
    deferred: [],
    held: 0,
    subsetPaths: [],
    lockSkip: null,
    ancestryUndetermined: [],
    subsetUndetermined: [],
  }
  try {
    refreshed = refreshStaleIndex(repoRoot, { dryRun })
  } catch (e) {
    noteSkip('陈旧索引刷新', e)
  }
  // 写循环内部已把撞锁折成 lockSkip(不抛穿)⇒ 这里把它并进本层的点名清单,
  // 否则"让了路"这件事只剩一个 refreshed:0,与"本来无事"同形(G-794 的正身)。
  if (refreshed.lockSkip) layerSkips.push({ layer: '陈旧索引刷新', ...refreshed.lockSkip })
  // 第四层:旁路提交孤儿路径(HEAD 有 / 索引无 / 盘无)。跑在 dirty 计算之前 —— 恢复完的
  // 路径已不再是"工作区 vs HEAD"的差集;若排在后面,它们会以"缺失"混进漂移判定并被
  // skippedStaged 错计。判据与恢复动作见 restoreBypassOrphans 头注(四判据全成立才动手)。
  const bypass = restoreBypassOrphans(repoRoot, { dryRun })
  if (bypass.lockSkip) layerSkips.push({ layer: '旁路孤儿恢复', ...bypass.lockSkip })
  const bp = {
    bypassRestored: bypass.restored,
    bypassPaths: bypass.paths,
    bypassHeldOnDisk: bypass.heldOnDisk,
    bypassHeldUnproven: bypass.heldUnproven,
    bypassUnprovenPaths: bypass.unprovenPaths,
    bypassSkippedNotBlob: bypass.skippedNotBlob,
    bypassDeferred: bypass.deferred,
    // no-bypass-orphans 是本层的常态,不占字段;其余态必须把原因带到输出里(静默与"无事发生"是两回事)
    ...(bypass.reason && bypass.reason !== 'no-bypass-orphans'
      ? { bypassReason: bypass.reason }
      : {}),
  }
  const head = () => ({
    refreshed: refreshed.refreshed,
    refreshDeferred: refreshed.deferred || [],
    ancestryUndetermined: refreshed.ancestryUndetermined || [],
    subsetUndetermined: refreshed.subsetUndetermined || [],
    layerSkips,
  })
  let dirty = []
  try {
    dirty = g(['diff', '--name-only', 'HEAD', '--no-renames']).split('\n').filter(Boolean)
  } catch (e) {
    noteSkip('幻影漂移判定', e)
    return { aligned: 0, paths: [], driftUndetermined: [], ...head(), ...bp }
  }
  if (!dirty.length) return { aligned: 0, paths: [], driftUndetermined: [], ...head(), ...bp }
  // ① 索引 == HEAD 的路径才可对齐
  const indexLines = lsStageChunked(g, dirty)
  const indexBlob = new Map()
  for (const l of indexLines) {
    const meta = l.split('\t')[0].split(' ')
    if (meta.length >= 2) indexBlob.set(l.split('\t')[1], meta[1])
  }
  const headBlob = new Map(
    g(['ls-tree', '-r', 'HEAD', '--format=%(objectname) %(path)'])
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf(' ')
        return [l.slice(i + 1), l.slice(0, i)]
      }),
  )
  const eligible = dirty.filter((p) => {
    const ib = indexBlob.get(p)
    return ib && ib === headBlob.get(p)
  })
  if (!eligible.length)
    return {
      aligned: 0,
      paths: [],
      skippedStaged: dirty.length,
      driftUndetermined: [],
      ...head(),
      ...bp,
    }
  // G-742:两条通道共用一个 windowLoss 收集口 —— "窗口用尽而没命中"必须逐条点名,
  // 不得和"真新工作"一起被读成"无需对齐"(旧账面就是这句)。
  const windowLoss = []
  const hits = analyze(repoRoot, eligible, { source: 'worktree', windowLoss })
  const whole = new Set(hits.map((h) => h.path))
  // 第二条通道:整块不等于任何祖先、但逐块都能对上(索引层重建的拼合旧基线)
  const composite = compositeDriftPaths(
    repoRoot,
    eligible.filter((p) => !whole.has(p)),
    { windowLoss },
  )
  // 同一路径可能由两条通道各点名一次 ⇒ 按路径只留第一条(计数与名单同源)
  const seenLoss = new Set()
  const driftUndetermined = windowLoss.filter((u) => {
    if (seenLoss.has(u.path)) return false
    seenLoss.add(u.path)
    return true
  })
  const paths = [...whole, ...composite]
  if (!paths.length || dryRun) {
    return {
      aligned: 0,
      paths,
      composite: composite.length,
      dryRun: true,
      skippedStaged: dirty.length - eligible.length,
      driftUndetermined,
      ...head(),
      ...bp,
    }
  }
  // 护栏④:拼合通道覆盖前留现场快照(整块通道命中的工作区内容本就 == 某历史版本,无独有数据)
  const snapshots = snapshotWorktreeBytes(repoRoot, composite)
  const { done, deferred } = restoreToHead(g, paths)
  if (deferred.length) {
    // "延后"要能说清是**哪一种**延后:锁在位 ⇒ 下一轮自动补;此刻无锁 ⇒ 是前提复核不成立
    // (别人刚暂存过该路径),不是锁问题 —— 两种措辞混成一句"本轮没跑"就是把没判写成判过了。
    const probe = probeIndexLock(repoRoot, g)
    const isLockState = probe.state === 'held-live' || probe.state === 'dangling-suspected'
    layerSkips.push({
      layer: '幻影漂移对齐',
      ...(isLockState
        ? skipFromProbe(probe)
        : probe.state === 'undetermined'
          ? skipFromProbe(probe)
          : {
              kind: 'deferred-no-lock',
              reason: `${deferred.length} 个延后与 index.lock 无关(此刻判不到锁 ⇒ 多为前提复核不成立)`,
            }),
      deferred,
    })
  }
  return {
    aligned: done.length,
    paths: done,
    composite: composite.length,
    snapshots: snapshots.length,
    deferred,
    skippedStaged: dirty.length - eligible.length,
    driftUndetermined,
    ...head(),
    ...bp,
  }
}

/**
 * 对齐"旁路提交没回写共享索引"留下的孤儿删除(2026-09-24 实测:本会话台账文件与另一会话
 * 9 个新文件都以 `D ` 躺在索引里,他人一次 `git add -A` + commit 就会把这些已入库的交付删掉)。
 *
 * 与 `git rm --cached`(有意删除)的区分**不看意图,看树**:
 *   索引当前树 == HEAD 某个祖先的树  ⇒ 索引是一份**陈旧快照**(里面没有任何人的暂存改动),
 *   那些 D 只是因为 HEAD 被 commit-tree 推进过而索引没跟着走 ⇒ 可安全整体对齐;
 *   有意删除会把索引变成"祖先树都不等于"的那棵(祖先树里该文件还在)⇒ 不碰。
 *
 * 动作两步且都只在上面成立时执行:`read-tree HEAD`(索引对齐) + `restore --source=HEAD --worktree`
 * (把只在提交里存在、磁盘上从未有过副本的新文件写回来)。逐路径不整体 reset 的顾虑在这里不适用,
 * 因为前提已经保证索引不含任何人的在飞暂存。
 */
export function reconcileStaleIndexOrphans(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  try {
    return reconcileStaleIndexOrphansInner(g, repoRoot, dryRun)
  } catch (e) {
    // 共享仓里 git 随时可能被别人的写操作占住索引;守护每 2 分钟跑一轮 ⇒ **让路**比报错正确,
    // 但必须把让路的原因如实带出来(静默 skip 与"无事发生"是两回事)。
    // G-794:原因按锁三态分档(被持有 / 疑似悬挂 / 此刻已解除 / 判不出),措辞不同 ⇒ 处置不同。
    const verdict = classifyLockFailure(e?.message ?? e, probeIndexLock(repoRoot, g))
    if (verdict.kind === 'not-lock') throw e
    return {
      reconciled: 0,
      paths: [],
      deferred: [],
      reason: 'git 索引被占用,本轮让路',
      lockSkip: verdict,
    }
  }
}
function reconcileStaleIndexOrphansInner(g, repoRoot, dryRun) {
  // ⚠️ 形态是 `D `(索引相对 HEAD 是删除),不是 ` D`(工作区删除)—— 两者检测命令不同,
  //    混用会一条都抓不到(本函数第一版就是这么被自测当场抓红的)。
  const staged = g(['diff', '--cached', '--diff-filter=D', '--name-only', '-z'])
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!staged.length) return { reconciled: 0, paths: [], reason: 'no-staged-deletions' }
  let idxTree = ''
  try {
    idxTree = g(['write-tree']).trim()
  } catch {
    return { reconciled: 0, paths: staged, reason: 'index-unmerged(有冲突条目,跳过)' }
  }
  // ⚠️ %T 展开的是**裸 sha**(行首没有 "tree " 前缀),按 "tree " 过滤会让祖先树集合恒为空,
  //    本判据于是永远走"属有意删除,不碰"这支(自测 ⑭ 抓出来的正是这个错)。旧实现之所以能用
  //    前缀过滤,是因为它把 `<c>^{tree}` 喂给 `cat-file --batch`、拿的是对象**头部**;改用
  //    `rev-list --pretty=format:%T` 后取法是"整行恰为 40 位十六进制",而 `commit <sha>` 那几行
  //    带前缀、天然不会被误收。两侧集合已实测逐字相等(真仓 60 棵、插入顺序同)。
  // 一次派生问结论(旧写法是 rev-list + cat-file 两次,共用层不接 stdin 的批量读由它自己兜)。
  const ancTrees = new Set(
    g(['rev-list', '--max-count=60', '--pretty=format:%T', 'HEAD'])
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^[0-9a-f]{40}$/.test(l)),
  )
  if (!ancTrees.has(idxTree))
    return {
      reconciled: 0,
      paths: staged,
      // 把两侧值带进 reason:这条判据一旦"恒不碰",没有这几个值就查不出是树没算出来还是真不同
      reason: `索引不是任何祖先树 ⇒ 属有意删除,不碰(idx=${idxTree.slice(0, 10)} 祖先树 ${ancTrees.size} 个${
        ancTrees.size
          ? ': ' +
            [...ancTrees]
              .slice(0, 2)
              .map((x) => x.slice(0, 10))
              .join(',')
          : ''
      })`,
    }
  if (dryRun)
    return {
      reconciled: staged.length,
      paths: staged,
      dryRun: true,
      reason: '陈旧索引,可对齐(未执行)',
    }
  g(['read-tree', 'HEAD'])
  const rec2 = restoreToHead(g, staged)
  return {
    reconciled: rec2.done.length,
    paths: rec2.done,
    deferred: rec2.deferred,
    reason: rec2.deferred.length
      ? `陈旧索引已对齐 ${rec2.done.length} 个,${rec2.deferred.length} 个因 git 写锁竞争延到下一轮`
      : '陈旧索引已对齐 HEAD',
  }
}

/**
 * 第四层:旁路提交孤儿路径恢复(2026-09-26 立,**只挂在 --align-drift 档**)。
 *
 * 补的是既有各层共同的结构盲区:converge / commit-tree 旁路把路径**加进** HEAD 却不写共享索引,
 * 于是这些路径 HEAD 有、索引没有、磁盘也没有 ⇒ `git status` 首列 `D `。第一层(缺失恢复)与
 * 第二/三层(refreshStaleIndex / alignDrifts)的判据都从"索引里的 blob"出发,这一型**索引里根本
 * 没有 blob**,条件结构上永不成立 ⇒ 层与层之间是空档而不是分工。立因(2026-09-26 实测):远端
 * `5f1d207b2` 新增 16 个文件,converge 推进 HEAD 后 `--align-drift` 只做了前几层,16 条 `D ` 长挂
 * —— 任何人一次不带 pathspec 的普通提交就会把刚上线的功能整批从版本树里删掉。
 *
 * 四条判据(全部成立才恢复;任一不成立 ⇒ 只报数,绝不代裁):
 *   ① 被审面 HEAD 里该路径以 **blob** 存在(gitlink/树条目不判 —— checkout 语义不同,交人工);
 *   ② 索引里没有该路径(`git diff --cached HEAD --diff-filter=D` 全集即此类);
 *   ③ 磁盘上没有该文件 —— **只要盘上存在(哪怕内容与 HEAD 不同)一律不碰**:那可能是别人
 *      正在写的现场(§16 越权红线),也是 `git rm --cached`/取消跟踪的可见形态,计入 heldOnDisk;
 *   ④ 与"有意 `git rm` 并等待提交"的显式区分 —— 不看意图,看父树:候选必须**缺席于 HEAD 至少
 *      一个直接父提交的树**,即它是"HEAD 前进时新带进来的路径",共享索引只是没跟上。人做
 *      `git rm <老文件>` 的前提是该文件在跟踪中 ⇒ 它存在于所有父树 ⇒ 本条不成立,只报数不修
 *      (失效方向 = 少修,不是多修)。①②③成立而 ④ 也成立的唯一残余误伤形态是"别人刚用旁路
 *      提交收下新文件、又立即连工作树副本一起 rm 并等待提交"—— 与本仓反复出现的"已入库交付
 *      被一次误提交整批抹掉"相比,选择修 + 在审计行点名,不静默。
 *
 * 恢复动作 = `git checkout HEAD -- <path>`(索引与工作树一次回写;"索引没有该路径"时
 * restore --worktree 无从落点,checkout 是唯一有既有语义的形态)。逐路径、分批、失败只延不抛
 * (与 restoreToHead 同一取向);**动手前逐批复读 ③** —— 判据计算与写盘之间并行会话可能刚落盘。
 */
const BYPASS_READ_TIMEOUT_MS = 60_000
/** 150 一批:同 lsStageChunked 的 ENAMETOOLONG 理由(Windows 命令行长度上限) */
const BYPASS_CHUNK = 150
/** 与 restoreToHead 同批宽:一次锁竞争只延一批,不炸整轮 */
const BYPASS_RESTORE_CHUNK = 40

/** 分批问 HEAD:"这些路径各是什么对象类型"(判据①只认 blob) */
function headEntryTypes(g, paths) {
  const types = new Map()
  for (let i = 0; i < paths.length; i += BYPASS_CHUNK) {
    const batch = paths.slice(i, i + BYPASS_CHUNK)
    for (const l of g(['ls-tree', '--format=%(objecttype) %(path)', 'HEAD', '--', ...batch], {
      timeout: BYPASS_READ_TIMEOUT_MS,
    })
      .split('\n')
      .filter(Boolean)) {
      const sp = l.indexOf(' ')
      if (sp <= 0) continue
      types.set(l.slice(sp + 1), l.slice(0, sp))
    }
  }
  return types
}

/** 某个提交(如 HEAD 的某父)的树里存在哪些候选路径;不存在的路径不会出现在输出里 */
function presentInTree(g, rev, paths) {
  const has = new Set()
  for (let i = 0; i < paths.length; i += BYPASS_CHUNK) {
    const batch = paths.slice(i, i + BYPASS_CHUNK)
    for (const p of g(['ls-tree', '--name-only', '-z', rev, '--', ...batch], {
      timeout: BYPASS_READ_TIMEOUT_MS,
    }).split('\0')) {
      if (p) has.add(p)
    }
  }
  return has
}

/**
 * 判据④的求值。HEAD 没有父(根提交)⇒ 无可证明,一律不修 —— "路径很新"本身不构成
 * "是旁路带进来的"的证据。
 */
function splitByParentSignature(g, candidates) {
  let parents = []
  try {
    // 用 rev-list 而不是 rev-parse:`--parents` 不是 rev-parse 的选项(实测 git 2.55 会把
    // 无法识别的参数**原样打印到 stdout**,于是 parents 数组里混进 HEAD 自己 ⇒ 候选被误判
    // "存在于每个父树" ⇒ 本层恒不修)。`--parents` 输出的第一个 token 是提交**自己**
    // (§12d 记过的同一陷阱),必须丢掉。
    const line = g(['rev-list', '--parents', '-n1', 'HEAD'], {
      timeout: BYPASS_READ_TIMEOUT_MS,
    }).trim()
    parents = line.split(/\s+/).slice(1).filter(Boolean)
  } catch {
    return { proven: [], unproven: candidates }
  }
  if (!parents.length) return { proven: [], unproven: candidates }
  const present = parents.map((rev) => presentInTree(g, rev, candidates))
  const proven = candidates.filter((p) => present.some((set) => !set.has(p)))
  const provenSet = new Set(proven)
  return { proven, unproven: candidates.filter((p) => !provenSet.has(p)) }
}

/**
 * 逐批 `git checkout HEAD -- <path>`(索引+工作树一次回写;绝不 read-tree/reset 整树 —— 那会
 * 连带吞掉别人真正的暂存,§12d"逐路径"纪律)。checkout 是写操作:刻意不加 timeout
 * (守门 80 的口径 —— 写操作中途被 SIGTERM 可能留下 index.lock,把挂起换成全局阻塞)。
 */
function restoreMissingFromHead(g, repoRoot, paths) {
  const done = []
  const deferred = []
  const appeared = []
  for (let i = 0; i < paths.length; i += BYPASS_RESTORE_CHUNK) {
    const batch = paths.slice(i, i + BYPASS_RESTORE_CHUNK).filter((p) => {
      if (existsSync(resolve(repoRoot, p))) {
        appeared.push(p) // 判据③与动手之间别人落了盘 ⇒ 让路,绝不覆盖现场
        return false
      }
      return true
    })
    if (!batch.length) continue
    try {
      g(['checkout', 'HEAD', '--', ...batch])
      done.push(...batch)
    } catch {
      deferred.push(...batch)
    }
  }
  return { done, deferred, appeared }
}

export function restoreBypassOrphans(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  try {
    return restoreBypassOrphansInner(g, repoRoot, dryRun)
  } catch (e) {
    // 与 reconcileStaleIndexOrphans 同一让路规矩:锁竞争延到下一轮,但原因必须带出来,
    // 不得静默成"无事发生"。G-794 起原因按锁三态分档,并带 `lockSkip` 供上层聚合点名。
    const verdict = classifyLockFailure(e?.message ?? e, probeIndexLock(repoRoot, g))
    if (verdict.kind === 'not-lock') throw e
    return {
      restored: 0,
      paths: [],
      heldOnDisk: 0,
      heldUnproven: 0,
      unprovenPaths: [],
      skippedNotBlob: 0,
      deferred: [],
      reason: 'git 索引被占用,本轮让路',
      lockSkip: verdict,
    }
  }
}

function restoreBypassOrphansInner(g, repoRoot, dryRun) {
  const base = {
    restored: 0,
    paths: [],
    heldOnDisk: 0,
    heldUnproven: 0,
    unprovenPaths: [],
    skippedNotBlob: 0,
    deferred: [],
  }
  // ② 索引没有该路径 = HEAD↔索引差集里"删除"那一类(`D ` 形态,与 reconcileStaleIndexOrphans 同源)
  let missing = []
  try {
    missing = g(['diff', '--cached', '--diff-filter=D', '--name-only', '-z'], {
      timeout: BYPASS_READ_TIMEOUT_MS,
    })
      .split('\0')
      .filter(Boolean)
  } catch {
    return { ...base, reason: '索引↔HEAD 差集取不到 ⇒ 本层不判(不记为通过)' }
  }
  if (!missing.length) return { ...base, reason: 'no-bypass-orphans' }
  // ① HEAD 面必须是 blob;gitlink 等只报数
  const types = headEntryTypes(g, missing)
  const inHead = missing.filter((p) => types.get(p) === 'blob')
  const skippedNotBlob = missing.length - inHead.length
  // ③ 磁盘上没有的才是候选;盘上有的(内容与 HEAD 是否相同都算)一律不碰
  const candidates = []
  let heldOnDisk = 0
  for (const p of inHead) {
    if (existsSync(resolve(repoRoot, p))) heldOnDisk++
    else candidates.push(p)
  }
  if (!candidates.length)
    return {
      ...base,
      heldOnDisk,
      skippedNotBlob,
      reason: heldOnDisk
        ? '候选全部有工作树副本(git rm --cached / 取消跟踪形态)⇒ 只报数不碰'
        : '差集全为 gitlink/非 blob ⇒ 不判',
    }
  // ④ 父树签名:与"有意 git rm 并等待提交"分开
  const { proven, unproven } = splitByParentSignature(g, candidates)
  if (!proven.length)
    return {
      ...base,
      heldOnDisk,
      heldUnproven: unproven.length,
      unprovenPaths: unproven,
      skippedNotBlob,
      reason: '候选存在于 HEAD 的每个父树 ⇒ 与有意 git rm 分不清,只报数不修',
    }
  if (dryRun)
    return {
      ...base,
      paths: proven,
      heldOnDisk,
      heldUnproven: unproven.length,
      unprovenPaths: unproven,
      skippedNotBlob,
      dryRun: true,
      reason: '旁路提交孤儿路径,四判据成立,可恢复(未执行)',
    }
  const { done, deferred, appeared } = restoreMissingFromHead(g, repoRoot, proven)
  return {
    restored: done.length,
    paths: done,
    heldOnDisk: heldOnDisk + appeared,
    heldUnproven: unproven.length,
    unprovenPaths: unproven,
    skippedNotBlob,
    deferred,
    reason: deferred.length
      ? `已恢复 ${done.length} 个,${deferred.length} 个因 git 写锁竞争延到下一轮`
      : `恢复 ${done.length} 个旁路提交孤儿路径(HEAD有blob/索引无/盘无/父树签名)`,
  }
}

export function heal(repoRoot, { dryRun = false } = {}) {
  const { safe, held, orphanIndex, intentLost } = findOrphanedDeletions(repoRoot)
  const rec = reconcileStaleIndexOrphans(repoRoot, { dryRun })
  // 让路原因必须随返回值走:reconcile 跳过 ≠ 无事发生(G-794 —— 旧形状里这一层的跳过只剩
  // 一个 reconciled:0,读报告的人无从知道它是"被锁挡了"还是"本来就没有"。)
  const layerSkips = rec.lockSkip ? [{ layer: '陈旧索引孤儿对齐', ...rec.lockSkip }] : []
  // G-1018292:这一档不进 restored,也不进 paths(那是"已恢复"的清单),单列一个字段 ——
  // 折进 paths 会让读日志的人以为这些文件已回到盘上,而它们**恰恰没有**(那正是本票的事故)。
  const intentLostPaths = [...intentLost]
  if (!safe.length)
    return {
      restored: 0,
      held: held.length,
      reconciled: rec.reconciled,
      orphanIndex: orphanIndex.length,
      paths: [],
      intentLost: intentLostPaths.length,
      intentLostPaths,
      layerSkips,
    }
  if (dryRun)
    return {
      restored: 0,
      held: held.length,
      reconciled: rec.reconciled,
      orphanIndex: orphanIndex.length,
      paths: safe,
      intentLost: intentLostPaths.length,
      intentLostPaths,
      dryRun: true,
      layerSkips,
    }
  const g = makeGit(repoRoot)
  const { done, deferred, viaIndex } = restoreToHead(g, safe)
  return {
    restored: done.length,
    held: held.length,
    reconciled: rec.reconciled,
    paths: done,
    deferred,
    restoreDeferred: deferred.length,
    // 降级通道恢复了多少条必须单独可见:它说明这一刻索引锁被占着,而"restore 一路成功"的
    // 常态下这个数是 0。只报总数会让下一次读日志的人以为锁是通的。
    restoreViaIndex: viaIndex.length,
    orphanIndex: orphanIndex.length,
    // G-1018292:报数档(删除意图被共享索引清空摘掉标记 ⇒ 分不清是宿主误删还是有意删除,不代裁)。
    intentLost: intentLostPaths.length,
    intentLostPaths,
    layerSkips,
    // 延后的原因不能只留一个数字:锁在位 / 疑似悬挂 / 此刻无锁(⇒ 前提复核不成立)是三种结论
    ...(deferred.length ? { lockStateAtReport: probeIndexLock(repoRoot, g) } : {}),
  }
}

/** 独立临时仓演练:①外部删除必被识别并恢复 ②他人 `git rm --cached` 的删除绝不碰 */
function selfTestRun() {
  const tmp = mkdtempSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '.ihui-agent', 'tmp', 'wt-heal-drill-'),
  )
  const g = makeGit(tmp)
  const out = []
  const check = (n, ok) => out.push({ n, ok })
  try {
    g(['init', '-q', '--initial-branch=main'])
    g(['config', 'core.autocrlf', 'false'])
    g(['config', 'user.email', 't@t'])
    g(['config', 'user.name', 't'])
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n')
    writeFileSync(join(tmp, 'sub-dir.ts'), 'v1\n')
    g(['add', '-A'])
    g(['commit', '-qm', 'A'])

    // ① 模拟宿主清理:只删工作区,索引不动
    rmSync(join(tmp, 'keep.ts'), { force: true })
    const f1 = findOrphanedDeletions(tmp)
    check('① 外部删除被识别为可恢复', f1.safe.includes('keep.ts') && !f1.held.includes('keep.ts'))
    const h1 = heal(tmp)
    check('② 恢复后文件回到工作区', h1.restored === 1 && existsSync(join(tmp, 'keep.ts')))

    // ③ 他人有意删除:同时暂存删除 ⇒ 不得恢复
    g(['rm', '-q', '--cached', 'sub-dir.ts'])
    rmSync(join(tmp, 'sub-dir.ts'), { force: true })
    const f2 = findOrphanedDeletions(tmp)
    check('③ 他人暂存的删除不被插手', !f2.safe.includes('sub-dir.ts'))
    heal(tmp)
    check('④ 恢复动作后该文件仍为删除态', !existsSync(join(tmp, 'sub-dir.ts')))

    // ⑤ 干净工作区 ⇒ 无事发生
    g(['commit', '-qm', 'B'])
    const h2 = heal(tmp)
    check('⑤ 无缺失时零动作', h2.restored === 0)

    // ⑥ 幻影漂移:工作区写回祖先版本(索引仍 == HEAD)⇒ 必须被对齐
    writeFileSync(join(tmp, 'keep.ts'), 'v2\n')
    g(['commit', '-qam', 'C: v2'])
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n') // == 提交 A 的版本,!= HEAD
    const d1 = alignDrifts(tmp)
    check(
      '⑥ 漂移被识别并对齐',
      d1.aligned === 1 && readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v2\n',
    )

    // ⑦ 真实未提交编辑 ⇒ 绝不覆盖
    writeFileSync(join(tmp, 'keep.ts'), 'v3 未提交的新工作\n')
    const d2 = alignDrifts(tmp)
    check(
      '⑦ 真编辑不被覆盖',
      d2.aligned === 0 && readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v3 未提交的新工作\n',
    )

    // ⑭ 拼合旧基线(取用行形态):整块从未作为整体提交过(整块通道看不见),
    //    但每一块逐字见于历史 ⇒ 复合通道判回潮并对齐。改动行一律写成真实的
    //    单行属性赋值(backgroundColor / color / borderColor),与 §4 取用形态同构。
    const P1 = Array.from({ length: 12 }, (_, i) => '  padA' + i + ': 0,').join('\n')
    const P2 = Array.from({ length: 12 }, (_, i) => '  padB' + i + ': 0,').join('\n')
    const mix = (x, y, z) =>
      'export const st = {\n  backgroundColor: tokens.brand.' +
      x +
      ',\n' +
      P1 +
      '\n  color: tokens.brand.' +
      y +
      ',\n' +
      P2 +
      '\n  borderColor: tokens.brand.' +
      z +
      ',\n}\n'
    writeFileSync(join(tmp, 'mix.ts'), mix('one', 'one', 'one'))
    g(['add', 'mix.ts'])
    g(['commit', '-qm', 'M1 one/one/one'])
    writeFileSync(join(tmp, 'mix.ts'), mix('two', 'one', 'one'))
    g(['commit', '-qam', 'M2 two/one/one'])
    writeFileSync(join(tmp, 'mix.ts'), mix('two', 'two', 'one'))
    g(['commit', '-qam', 'M3 two/two/one'])
    writeFileSync(join(tmp, 'mix.ts'), mix('two', 'two', 'two'))
    g(['commit', '-qam', 'M4(HEAD) two/two/two'])
    writeFileSync(join(tmp, 'mix.ts'), mix('one', 'one', 'two')) // 该组合从未整体提交过
    check(
      '⑭a 拼合态整块不等于任何祖先(整块通道失效)',
      analyze(tmp, ['mix.ts'], { source: 'worktree' }).length === 0,
    )
    check(
      '⑭b 取用行逐块可对上历史 ⇒ 判为回潮',
      compositeDriftPaths(tmp, ['mix.ts']).includes('mix.ts'),
    )
    const d14 = alignDrifts(tmp)
    check(
      '⑭c 对齐后工作区回到 HEAD',
      d14.composite === 1 && readFileSync(join(tmp, 'mix.ts'), 'utf8') === mix('two', 'two', 'two'),
    )
    check(
      '⑭d 覆盖前留了现场快照(护栏③)',
      d14.snapshots === 1 && existsSync(join(tmp, '.ihui-agent/tmp/worktree-align-snapshots')),
    )

    // ⑮ 单块回潮:本仓 8 个滞后文件的真实形态就是"一条取用行换回旧档名" ⇒ 不受块数限制
    writeFileSync(join(tmp, 'mix.ts'), mix('one', 'two', 'two'))
    check('⑮ 单块取用行回潮同样判拼合', compositeDriftPaths(tmp, ['mix.ts']).includes('mix.ts'))
    alignDrifts(tmp)
    check(
      '⑮b 已复位到 HEAD',
      readFileSync(join(tmp, 'mix.ts'), 'utf8') === mix('two', 'two', 'two'),
    )

    // ⑯ 逻辑行被改回旧写法(逐字见于历史,但不是取用行)⇒ 形状护栏不认领本通道;
    //    该文件整块恰等于 M5,故由**既有整块通道**收口 —— 两条通道的分工在这里钉死。
    const lg = (v) => 'export function run() {\n' + P1 + '\n  return ' + v + '\n}\n'
    writeFileSync(join(tmp, 'mix2.ts'), lg('a1'))
    g(['add', 'mix2.ts'])
    g(['commit', '-qm', 'M5 mix2=a1'])
    writeFileSync(join(tmp, 'mix2.ts'), lg('a2'))
    g(['commit', '-qam', 'M6(HEAD) mix2=a2'])
    writeFileSync(join(tmp, 'mix2.ts'), lg('a1'))
    check('⑯ 非取用行 ⇒ 本通道不认领(护栏①)', compositeDriftPaths(tmp, ['mix2.ts']).length === 0)
    const d16 = alignDrifts(tmp)
    check(
      '⑯b 整块等于祖先 ⇒ 由既有整块通道收口(composite=0/aligned=1)',
      d16.composite === 0 && d16.aligned === 1,
    )

    // ⑰ 取用行形态、但该写法从未出现在任何历史版本 ⇒ 判据②挡下
    writeFileSync(join(tmp, 'mix.ts'), mix('zz9', 'two', 'two'))
    check('⑰ 未见过的取用行 ⇒ 不判拼合(护栏②)', compositeDriftPaths(tmp, ['mix.ts']).length === 0)
    alignDrifts(tmp)
    check(
      '⑰b 该文件未被覆盖',
      readFileSync(join(tmp, 'mix.ts'), 'utf8') === mix('zz9', 'two', 'two'),
    )

    // ⑱ 删掉整段尾巴:git 会把删除并进相邻改动块,"只删不增"的 hunk 判据单独用会漏 —— 靠形状护栏兜住
    const cut = mix('one', 'one', 'two').replace(P2 + '\n', '')
    writeFileSync(join(tmp, 'mix.ts'), cut)
    check('⑱ 含非取用行的删除 ⇒ 不判拼合', compositeDriftPaths(tmp, ['mix.ts']).length === 0)
    alignDrifts(tmp)
    check('⑱b 删除现场保留', readFileSync(join(tmp, 'mix.ts'), 'utf8') === cut)
    g(['restore', '--source=HEAD', '--worktree', '--', 'mix.ts'])

    // ⑲ 纯重排(同一批行只是换位置)⇒ 护栏③不认领:写回 HEAD 只会和 lint-staged 的格式化器互踩
    //    (实测本仓这种"假滞后"184 个文件,若不排除会让守护与格式化器永久对打)
    const headTxt = mix('two', 'two', 'two')
    const hl = headTxt.replace(/\n$/, '').split('\n')
    const reorderTxt = [hl[0], ...hl.slice(2), hl[1], hl[hl.length - 1]].join('\n') + '\n'
    writeFileSync(join(tmp, 'mix.ts'), reorderTxt)
    check('⑲ 纯重排 ⇒ 本通道不认领(护栏③)', compositeDriftPaths(tmp, ['mix.ts']).length === 0)
    alignDrifts(tmp)
    check('⑲b 重排现场保留', readFileSync(join(tmp, 'mix.ts'), 'utf8') === reorderTxt)
    g(['restore', '--source=HEAD', '--worktree', '--', 'mix.ts'])

    // ⑳ 一次 git 写锁竞争不得让整轮自愈崩掉:失败批次只记账、延到下一 tick(实测本会话就撞上过)
    const boom = () => {
      throw new Error('index.lock: File exists')
    }
    const r20 = restoreToHead(boom, ['a.ts', 'b.ts'])
    check('⑳ 锁竞争降级为延后而非抛出', r20.done.length === 0 && r20.deferred.length === 2)
    const r20b = restoreToHead(boom, [])
    check('⑳b 空清单不产生假延后', r20b.done.length === 0 && r20b.deferred.length === 0)
    /**
     * ㉑ 源码级反向锁:打印"✅ …存续正常"的那个分支必须把 deferred 一起判掉。
     * 2026-09-26 实测缺陷就是这条:10 个跟踪文件因 native index.lock 长期被占而全部延后,
     * 而普通档照样回一句"存续正常"。这类失效无法用行为断言长期守住(要造真锁竞争),
     * 但"判据的分支条件里有没有 deferred"是形状,形状锁不会被重构悄悄改掉。
     */
    const selfSrc = readFileSync(fileURLToPath(import.meta.url), 'utf8')
    const allClear = selfSrc.match(
      /if \(([^)]*?)\) \{\s*\n\s*console\.log\('✅ 工作区已跟踪文件存续正常'/,
    )
    check(
      '㉑ "存续正常"判据必须含 deferred 守卫(反向锁:延后≠正常)',
      !!allClear && /deferred/.test(allClear[1]),
    )
    check(
      '㉑b 延后必须有名册与出口(不得只报数不指路)',
      selfSrc.includes('本轮未恢复') && selfSrc.includes('cat-file blob HEAD:'),
    )
    /**
     * ㉘ 真锁竞争下降级通道必须真把文件写回来(2026-09-29 的根因修复)。
     * 立因:「失败就延到下一 tick」在锁被**长期**持有时等于永不恢复 —— 实测本仓 22 个
     * 被宿主删掉的跟踪文件连跑 6 轮守护全部 deferred,线上构建因此一次落后 102 个提交,
     * 而账面只多一行"⚠️ 本轮未恢复"。这里造一份真实 `.git/index.lock`(不是模拟抛错:
     * 模拟只能证明"不崩",证明不了"仍能恢复"),然后要求 restore 那条路确实失败、
     * 降级那条路确实把内容写回。用独立小仓,理由同 ⑭⑮:累积的索引状态会让判据互踩。
     * ㉘b 是同一条判据的反面:索引 blob 已不等于 HEAD(别人刚暂存)时降级通道**不得**动手,
     * 否则它写出去的是别人的在飞内容,那比不修更糟。
     */
    {
      const t5 = mkScratch('wt-heal-lock-')
      try {
        const q = makeGit(t5)
        q(['init', '-q', '--initial-branch=main'])
        q(['config', 'user.email', 't@t'])
        q(['config', 'user.name', 't'])
        q(['config', 'core.autocrlf', 'false'])
        writeFileSync(join(t5, 'fall.ts'), 'fall-back\n')
        writeFileSync(join(t5, 'other.ts'), 'head\n')
        q(['add', '-A'])
        q(['commit', '-qm', 'root'])
        writeFileSync(join(t5, 'other.ts'), 'staged-by-someone-else\n')
        q(['add', 'other.ts']) // 索引 != HEAD
        writeFileSync(join(t5, '.git', 'index.lock'), '') // 并发会话持锁
        rmSync(join(t5, 'fall.ts'), { force: true })
        rmSync(join(t5, 'other.ts'), { force: true })
        const r22 = restoreToHead(q, ['fall.ts', 'other.ts'])
        check(
          '㉘ 索引锁在位时降级通道仍恢复(index==HEAD 那一条)',
          existsSync(join(t5, 'fall.ts')) &&
            readFileSync(join(t5, 'fall.ts'), 'utf8') === 'fall-back\n',
        )
        check(
          '㉘b 索引已偏离 HEAD 的那条不得被降级通道写回(protect 他人在飞)',
          !existsSync(join(t5, 'other.ts')) && r22.deferred.includes('other.ts'),
        )
        check('㉘c 降级数量必须单独如实上报(不得与正常通道混计)', r22.viaIndex.length === 1)
        rmSync(join(t5, '.git', 'index.lock'), { force: true })
      } finally {
        rmScratch(t5)
      }
    }
    // ⑧ 暂存后工作区又有新改动(判据③不成立)⇒ 绝不刷新、绝不对齐(protect 现场)
    writeFileSync(join(tmp, 'keep.ts'), 'v1\n')
    g(['add', 'keep.ts']) // index = v1(祖先版本)
    writeFileSync(join(tmp, 'keep.ts'), 'v4 暂存后又改了\n') // worktree != index ⇒ 有现场
    const r0 = refreshStaleIndex(tmp)
    check('⑧ 暂存后又有改动 ⇒ 不刷新', r0.refreshed === 0)
    alignDrifts(tmp)
    check(
      '⑧b 该文件工作区改动未被覆盖',
      readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v4 暂存后又改了\n',
    )
    g(['restore', '--staged', '--worktree', '--', 'keep.ts'])

    // ⑧′ 第二条通道(②′):索引内容**逐行是 HEAD 的子集**但不是任何历史版本(拼合旧档),
    //     而工作树另有现场 ⇒ ①②③ 挡下、②′ 放行。刷的只是索引,盘上那行新写必须一字不动。
    writeFileSync(join(tmp, 'sub.ts'), 'k1\n')
    g(['add', 'sub.ts'])
    g(['commit', '-qm', 'S1 k1'])
    writeFileSync(join(tmp, 'sub.ts'), 'k1\nk2\nk3\n')
    g(['commit', '-qam', 'S2(HEAD) k1/k2/k3'])
    const subBlob = g(['hash-object', '-w', '--stdin'], { input: 'k1\nk3\n' }) // 从未整体提交过 ⇒ ② 挡下
    g(['update-index', '--cacheinfo', `100644,${subBlob.trim()},sub.ts`])
    writeFileSync(join(tmp, 'sub.ts'), 'k1\nk2\nk3\nX 别人正在写的一行\n')
    const rSub = refreshStaleIndex(tmp)
    check(
      '⑧′ 索引是 HEAD 的行子集(非祖先版本)而工作树有现场 ⇒ 走 ②′ 刷新,且不动盘上内容',
      rSub.refreshed === 1 &&
        rSub.subsetRefreshed === 1 &&
        rSub.paths.join() === 'sub.ts' &&
        g(['ls-files', '-s', '--', 'sub.ts']).split(/\s+/)[1] ===
          g(['rev-parse', 'HEAD:sub.ts']).trim() &&
        readFileSync(join(tmp, 'sub.ts'), 'utf8') === 'k1\nk2\nk3\nX 别人正在写的一行\n',
    )
    // ⑧″ 反向对照:索引里有**一行 HEAD 没有**(= 别人真暂存的新工作)⇒ 两条通道都不许动
    writeFileSync(join(tmp, 'sub2.ts'), 'c1\nc2\n')
    g(['add', 'sub2.ts'])
    g(['commit', '-qm', 'T1 c1/c2'])
    const newWork = g(['hash-object', '-w', '--stdin'], { input: 'c1\nc2\n别人新加的字段\n' })
    g(['update-index', '--cacheinfo', `100644,${newWork.trim()},sub2.ts`])
    writeFileSync(join(tmp, 'sub2.ts'), 'c1\nc2\n别人新加的字段\n再改一行\n')
    const rKeep = refreshStaleIndex(tmp)
    check(
      '⑧″ 索引含 HEAD 没有的行 ⇒ held(新通道不得把"真新暂存"读成无损)',
      !rKeep.subsetPaths.includes('sub2.ts') &&
        !rKeep.paths.includes('sub2.ts') &&
        g(['ls-files', '-s', '--', 'sub2.ts']).split(/\s+/)[1] === newWork.trim() &&
        readFileSync(join(tmp, 'sub2.ts'), 'utf8') === 'c1\nc2\n别人新加的字段\n再改一行\n',
    )
    // ⑧‖ 删除护栏:暂存删除在多重集判据里"天然无损"(索引里没有该行),但它**可以**是有意的
    //    `git rm` ⇒ 新通道必须完全不碰删除路径(AGENTS §7 删除安全)。
    g(['rm', '-q', '--cached', '--', 'sub.ts'])
    const rDel = refreshStaleIndex(tmp)
    check(
      '⑧‖ 暂存删除永不走 ②′(删除可能是有意意图,不是"没有行")',
      !rDel.paths.includes('sub.ts') && !rDel.subsetPaths.includes('sub.ts'),
    )
    g([
      'update-index',
      '--add',
      '--cacheinfo',
      `100644,${g(['rev-parse', 'HEAD:sub.ts']).trim()},sub.ts`,
    ])
    writeFileSync(join(tmp, 'sub.ts'), 'k1\nk2\nk3\n')
    writeFileSync(join(tmp, 'sub2.ts'), 'c1\nc2\n')
    g(['add', 'sub2.ts']) // 复位到 HEAD 形态即止(不额外造提交,`commit -a` 在无差异时会直接失败)

    // ⑨ 落后索引(CAS/converge 只推进 HEAD 的后遗症)⇒ 逐路径刷新,并随之对齐工作区
    writeFileSync(join(tmp, 'keep.ts'), 'v9\n')
    g(['commit', '-qam', 'D: v9'])
    writeFileSync(join(tmp, 'keep.ts'), 'v2\n')
    g(['add', 'keep.ts']) // index==v2(祖先版本)、worktree==v2 ⇒ 典型"HEAD 前移而索引留在原地"
    const r1 = refreshStaleIndex(tmp)
    check('⑨ 落后索引被逐路径刷新', r1.refreshed === 1)
    alignDrifts(tmp)
    check('⑩ 刷新后工作区随之对齐到 HEAD', readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v9\n')

    // ⑫ 旁路提交(commit-tree + update-ref)后的真实残留形态:HEAD 与工作区都已前进,
    //    **只有索引停在祖先版本**(本仓 2026-09-23 实测 4 个路径即此态,原判据③漏掉它)。
    writeFileSync(join(tmp, 'keep.ts'), 'v11\n')
    g(['commit', '-qam', 'E: v11'])
    const ancestorBlob = g(['rev-parse', 'HEAD~1:keep.ts']).trim()
    g(['update-index', '--cacheinfo', `100644,${ancestorBlob},keep.ts`]) // 人为把 index 退回祖先版本
    const r1b = refreshStaleIndex(tmp)
    const indexAfter = g(['ls-files', '-s', '--', 'keep.ts']).split(/\s+/)[1]
    check(
      '⑫ 工作区==HEAD 而索引停在祖先版本 ⇒ 刷新 index 且不动工作区',
      r1b.refreshed === 1 &&
        indexAfter === g(['rev-parse', 'HEAD:keep.ts']).trim() &&
        readFileSync(join(tmp, 'keep.ts'), 'utf8') === 'v11\n',
    )

    // ⑴ HEAD 有、索引与磁盘都没有(旁路提交把路径加进 HEAD 却不动共享索引,或有意 git rm)
    //    ⇒ 默认恢复档必须**报数**(本仓 5 个测试文件因此静默加载失败),但 heal 不自动恢复;
    //    第四层(restoreBypassOrphans,仅 --align-drift)用父树签名把两种成因分开后才动手 ——
    //    本例的 orphan.ts 是"HEAD tip 新增"(父树没有它),在第四层会被判为旁路签名并恢复,
    //    这正是 ㉖(老文件的完整 git rm ⇒ 不修)成对的另一侧。
    writeFileSync(join(tmp, 'orphan.ts'), 'export const orphan = 1' + String.fromCharCode(10))
    g(['add', 'orphan.ts'])
    g(['commit', '-qm', 'G: 新增 orphan.ts'])
    g(['rm', '--cached', '-q', 'orphan.ts'])
    rmSync(join(tmp, 'orphan.ts'), { force: true })
    const o1 = findOrphanedDeletions(tmp)
    check('⑴ 索引孤儿被如实报数', o1.orphanIndex.includes('orphan.ts'))
    check(
      '⑴b 索引孤儿绝不自动恢复',
      !o1.safe.includes('orphan.ts') && !existsSync(join(tmp, 'orphan.ts')),
    )
    // ⑬ 暂存删除(工作区根本没有该文件)不得把刷新整条打崩
    //     —— hash-object --stdin-paths 遇到缺失文件会 fatal 退出,曾使本自愈每轮必崩。
    writeFileSync(join(tmp, 'gone.ts'), 'to be deleted\n')
    g(['add', 'gone.ts'])
    g(['commit', '-qm', 'F: 新增 gone.ts'])
    g(['rm', '-q', 'gone.ts']) // 索引=删除态,工作区无文件
    // ⑭⑮ 旁路提交新增文件的残留形态 —— 用**独立小仓**造现场,不复用上面 17 例累积的索引状态
    //     (第一版复用同一仓库时,祖先树判据被前序用例留下的改动污染,⑭b 恒红 ⇒ 假故障)。
    {
      const t3 = mkdtempSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', '.ihui-agent', 'tmp', 'wt-heal-idx-'),
      )
      const q = makeGit(t3)
      q(['init', '-q', '--initial-branch=main'])
      q(['config', 'user.email', 't@t'])
      q(['config', 'user.name', 't'])
      writeFileSync(join(t3, 'a.ts'), 'a1\n')
      q(['add', '-A'])
      q(['commit', '-qm', 'root'])
      // 旁路提交的**同形现场**:该路径 HEAD 有、索引无、磁盘也没有。
      // 旧写法是 `hash-object -w --stdin` + `mktree` + `commit-tree` + `update-ref` 四连
      // (前两条要喂 stdin,而共用层刻意不接 stdin —— 它在层里会变成"读到空输入、静默生成
      // 空树"那一类假结论)。改用真实命令造出**逐字相同的终态**(HEAD 多一个路径、索引停在
      // 它的祖先树、磁盘没有该文件),既不再需要门内自拼派生,⑭ 的牙齿也没变松:
      // `existsSync` 在 restore 之前仍是 false —— 因为写完就先删掉。
      writeFileSync(join(t3, 'born-by-bypass.ts'), 'born by commit-tree\n')
      q(['add', 'born-by-bypass.ts'])
      q(['commit', '-qm', 'bypass: HEAD 里多一个路径(索引随后退回祖先树)'])
      rmSync(join(t3, 'born-by-bypass.ts'), { force: true })
      q(['read-tree', 'HEAD~1']) // 索引原地停在旁路提交之前 ⇒ 与 commit-tree+update-ref 同形
      const rec = reconcileStaleIndexOrphans(t3)
      check(
        '⑭ 旁路新增文件以"暂存删除"形态被识别并回写(reason=' + rec.reason + ')',
        rec.reconciled === 1 &&
          rec.paths.includes('born-by-bypass.ts') &&
          existsSync(join(t3, 'born-by-bypass.ts')),
      )
      q(['rm', '-q', '--cached', 'a.ts']) // 这次是**有意**删除:索引不再是任何祖先树
      rmSync(join(t3, 'a.ts'), { force: true })
      const rec2 = reconcileStaleIndexOrphans(t3, { dryRun: true })
      check(
        '⑮ 有意 rm --cached(索引非祖先树)绝不插手',
        rec2.reconciled === 0 && /不碰/.test(rec2.reason),
      )
      rmSync(t3, { recursive: true, force: true })
    }

    // ㉒–㉗ 第四层(旁路提交孤儿路径恢复,2026-09-26)—— 全部用独立小仓,理由同 ⑭⑮:
    //     父树签名判据对累积的索引状态敏感,复用主演练仓必然互踩。
    {
      const t4 = mkScratch('wt-heal-bypass-')
      try {
        const q = makeGit(t4)
        q(['init', '-q', '--initial-branch=main'])
        q(['config', 'user.email', 't@t'])
        q(['config', 'user.name', 't'])
        q(['config', 'core.autocrlf', 'false'])
        writeFileSync(join(t4, 'a.ts'), 'a1\n')
        writeFileSync(join(t4, 'old.ts'), 'old content\n')
        q(['add', '-A'])
        q(['commit', '-qm', 'base'])
        // ㉒ 旁路提交推进 HEAD 后的典型残留:HEAD 有 born.ts、索引停在父树、磁盘也没有
        writeFileSync(join(t4, 'born.ts'), 'born by commit-tree\n')
        q(['add', 'born.ts'])
        q(['commit', '-qm', 'advance: HEAD 多一个 born.ts'])
        rmSync(join(t4, 'born.ts'), { force: true })
        q(['read-tree', 'HEAD~1']) // 索引停在旁路提交之前 ⇒ 与 commit-tree+update-ref 同形
        const b1 = restoreBypassOrphans(t4)
        check(
          '㉒ 四判据齐备 ⇒ 索引+工作树同时恢复(checkout 语义,恢复后 status 干净)',
          b1.restored === 1 &&
            b1.paths.includes('born.ts') &&
            existsSync(join(t4, 'born.ts')) &&
            readFileSync(join(t4, 'born.ts'), 'utf8') === 'born by commit-tree\n' &&
            q(['ls-files', '-s', '--', 'born.ts']).trim() !== '' &&
            q(['status', '--porcelain']).trim() === '',
        )
        // ㉓ 幂等:第二次跑必须 no-op
        const b2 = restoreBypassOrphans(t4)
        check('㉓ 第二次跑幂等 no-op', b2.restored === 0 && b2.paths.length === 0)
        // ㉔ 反向回归锁:同型路径只要**磁盘存在文件**(git rm --cached 那一型)就一律不碰 ——
        //     这一例真拦住,判据就不能被简化成"看盘上没有就补"(任务书点名的失效方向)
        writeFileSync(join(t4, 'kept.ts'), 'export const v = 1\n')
        q(['add', 'kept.ts'])
        q(['commit', '-qm', 'add kept.ts'])
        q(['rm', '-q', '--cached', 'kept.ts'])
        writeFileSync(join(t4, 'kept.ts'), '别人正在写的现场\n')
        const b3 = restoreBypassOrphans(t4)
        check(
          '㉔ 盘上有副本 ⇒ 计数不碰,且现场内容一字不改',
          b3.restored === 0 &&
            b3.heldOnDisk === 1 &&
            readFileSync(join(t4, 'kept.ts'), 'utf8') === '别人正在写的现场\n',
        )
        // ㉕ 索引里有该路径(仅工作树缺失 ` D`)⇒ 本层不判,边界交给第一层
        rmSync(join(t4, 'a.ts'), { force: true })
        const b4 = restoreBypassOrphans(t4)
        check(
          '㉕ 索引里有该路径 ⇒ 本层不碰(边界:第一层负责)',
          b4.restored === 0 && !b4.paths.includes('a.ts') && !existsSync(join(t4, 'a.ts')),
        )
        // ㉖ 他人对**老文件**做完整 git rm 等待提交:该路径存在于每个父树 ⇒ 判据④不成立 ⇒ 只报数不修
        q(['rm', '-q', 'old.ts']) // 索引与磁盘一起删 —— 与旁路残留在单路径面上同形,靠父树签名分开
        const b5 = restoreBypassOrphans(t4)
        check(
          '㉖ 老文件的完整 git rm ⇒ 父树签名分判为分不清,只报数不修',
          b5.restored === 0 &&
            b5.heldUnproven === 1 &&
            b5.unprovenPaths.includes('old.ts') &&
            !existsSync(join(t4, 'old.ts')),
        )
      } finally {
        rmScratch(t4)
      }
    }
    // ㉗ 事故真实形态(converge 合并:路径来自**第二父**,第一父没有)+ 装车证明 ——
    //    走 alignDrifts(converge 成功出口调的就是它)而不是直调本层函数,防"函数在、自检过,
    //    但 alignDrifts 没接线"那一型(守门 70/76/81/102 同型盲区)。
    {
      const t5 = mkScratch('wt-heal-merge-')
      try {
        const q = makeGit(t5)
        q(['init', '-q', '--initial-branch=main'])
        q(['config', 'user.email', 't@t'])
        q(['config', 'user.name', 't'])
        q(['config', 'core.autocrlf', 'false'])
        writeFileSync(join(t5, 'a.ts'), 'a1\n')
        q(['add', '-A'])
        q(['commit', '-qm', 'root'])
        q(['checkout', '-q', '-b', 'feature'])
        writeFileSync(join(t5, 'fborn.ts'), 'from remote\n')
        q(['add', 'fborn.ts'])
        q(['commit', '-qm', 'feature: 新增 fborn.ts'])
        q(['checkout', '-q', 'main'])
        writeFileSync(join(t5, 'a.ts'), 'a2\n')
        q(['commit', '-qam', 'main 前进'])
        q(['merge', '-q', '--no-ff', 'feature', '-m', 'merge']) // HEAD 两父:HEAD^1 无 fborn、HEAD^2 有
        rmSync(join(t5, 'fborn.ts'), { force: true })
        q(['read-tree', 'HEAD^1']) // 索引停在收敛前位置 ⇒ 与 commit-tree+update-ref 同形
        const m1 = alignDrifts(t5)
        check(
          '㉗ 合并形态(路径来自第二父)经 alignDrifts 装车被恢复',
          m1.bypassRestored === 1 &&
            m1.bypassPaths.includes('fborn.ts') &&
            existsSync(join(t5, 'fborn.ts')),
        )
      } finally {
        rmScratch(t5)
      }
    }

    /* ------------------------------------------------------------------ *
     * G-794 ㉚/㉛ —— 锁被他人持有时的正确结论是"本层跳过 + 一行原因",不是把异常冒到 main()。
     * 造**真** index.lock(不是模拟抛错):模拟只能证明"不崩",证明不了"三层照跑、一条都没写成"。
     * 实测崩点(2026-09-29 05:2x/05:4x,exit 2)就是 refreshStaleIndex 末尾那条裸奔的
     * `update-index --cacheinfo` 写循环。
     * ------------------------------------------------------------------ */
    {
      const t6 = mkScratch('wt-heal-g794-')
      try {
        const q = makeGit(t6)
        q(['init', '-q', '--initial-branch=main'])
        q(['config', 'user.email', 't@t'])
        q(['config', 'user.name', 't'])
        q(['config', 'core.autocrlf', 'false'])
        writeFileSync(join(t6, 'r.ts'), 'v1\n')
        q(['add', '-A'])
        q(['commit', '-qm', 'R1 v1'])
        writeFileSync(join(t6, 'r.ts'), 'v2\n')
        q(['add', '-A'])
        q(['commit', '-qm', 'R2(HEAD) v2'])
        const v1oid = q(['rev-parse', 'HEAD~1:r.ts']).trim()
        const headOid = q(['rev-parse', 'HEAD:r.ts']).trim()
        // 落后索引现场:索引停在祖先 v1、工作区==HEAD ⇒ 判据①②③全成立,正要走那条写循环
        q(['update-index', '--cacheinfo', `100644,${v1oid},r.ts`])
        writeFileSync(join(t6, '.git', 'index.lock'), '')
        const pre = probeIndexLock(t6, q)
        check(
          '㉚a 锁在位 ⇒ 探针判 held-live(绝不读成"无锁")',
          pre.state === 'held-live' && pre.lockPath.includes('index.lock'),
        )
        let threw = false
        let d30 = null
        try {
          d30 = alignDrifts(t6)
        } catch {
          threw = true
        }
        check('㉚b 锁被持有时 alignDrifts 不抛穿(旧行为 exit 2 ⇒ 三层连带不执行)', !threw && !!d30)
        check(
          '㉚c 报告点名"本层跳过(锁被持有)"',
          !!d30 &&
            d30.layerSkips.some((s) => s.kind === 'held' && /本层跳过\(锁被持有\)/.test(s.reason)),
        )
        check(
          '㉚d 一条都没写成:refreshed=0 且延后逐路径点名',
          !!d30 && d30.refreshed === 0 && d30.refreshDeferred.includes('r.ts'),
        )
        check(
          '㉚e 让路 = 少做一件事,不是做一半(索引仍是祖先 blob)',
          q(['ls-files', '-s', '--', 'r.ts']).split(/\s+/)[1] === v1oid,
        )
        // ㉚f 反向对照:锁没了就真补上 —— "跳过"不得变成一句永久托辞
        rmSync(join(t6, '.git', 'index.lock'))
        const d30b = alignDrifts(t6)
        check(
          '㉚f 锁释放后同一现场被刷新(跳过 ≠ 永久 no-op)',
          d30b.refreshed === 1 &&
            q(['ls-files', '-s', '--', 'r.ts']).split(/\s+/)[1] === headOid &&
            d30b.layerSkips.length === 0,
        )
        // ㉚g --check(零副作用档)结构上进不到写循环 ⇒ "同一异常在 --check 口径下根本不该出现"
        q(['update-index', '--cacheinfo', `100644,${v1oid},r.ts`])
        writeFileSync(join(t6, '.git', 'index.lock'), '')
        const chk = refreshStaleIndex(t6, { dryRun: true })
        check(
          '㉚g --check 档带锁:不抛、lockSkip 恒 null、索引未动',
          chk.dryRun === true &&
            chk.refreshed === 0 &&
            chk.lockSkip === null &&
            q(['ls-files', '-s', '--', 'r.ts']).split(/\s+/)[1] === v1oid,
        )
        rmSync(join(t6, '.git', 'index.lock'))
      } finally {
        rmScratch(t6)
      }
    }
    // ㉛ 锁归因四态(纯构造面,不依赖仓库瞬时状态):非锁故障**绝不**伪装成"让路"
    {
      const mkProbe = (state) => ({
        state,
        lockPath: '/x/.git/index.lock',
        ageMs: 10,
        sizeBytes: 0,
        reason: `r(${state})`,
      })
      const LOCKMSG = "fatal: Unable to create '/x/.git/index.lock': File exists."
      const a = classifyLockFailure(LOCKMSG, mkProbe('held-live'))
      const b = classifyLockFailure(LOCKMSG, mkProbe('absent'))
      const c = classifyLockFailure(LOCKMSG, mkProbe('dangling-suspected'))
      const d = classifyLockFailure(LOCKMSG, mkProbe('undetermined'))
      const e = classifyLockFailure('fatal: bad object deadbeefdeadbeef', mkProbe('held-live'))
      check('㉛a 锁文本 + 锁在位 ⇒ held', a.kind === 'held' && /锁被持有/.test(a.reason))
      check(
        '㉛b 锁文本 + 此刻无锁 ⇒ cleared(既不读成"有锁",也不读成"没故障")',
        b.kind === 'cleared',
      )
      check(
        '㉛c 锁文本 + 超龄空锁 ⇒ dangling,建议必须点出"每一轮都会跳过"',
        c.kind === 'dangling' && /每一轮都会跳过/.test(lockSkipAdvice('dangling')),
      )
      check(
        '㉛d 锁文本 + 判不出 ⇒ undetermined(按"少做一件事"处理)',
        d.kind === 'undetermined' && /判不出/.test(d.reason),
      )
      check('㉛e 非锁故障 ⇒ not-lock(照旧上抛,不换措辞)', e.kind === 'not-lock')
      check(
        '㉛f held-live 的建议不得教人去删锁(§12 铁律)',
        !/rm .*index\.lock|删除.*index\.lock/.test(lockSkipAdvice('held')),
      )
    }
    /* ------------------------------------------------------------------ *
     * G-742 ㉜/㉝ —— 祖先窗口用尽必须**点名"判不出"**,不得写成"无需对齐"。
     * 本层刻意不跑无界遍历补这一格:现测真仓一次全深度 `git log -- <热档>` >120s,
     * 而这一层每 2 分钟一轮(2026-09-30 现读:58 个可判定路径全深度问一遍跑了 ~4 分钟)。
     * ------------------------------------------------------------------ */
    {
      const t7 = mkScratch('wt-heal-window-')
      try {
        const q = makeGit(t7)
        q(['init', '-q', '--initial-branch=main'])
        q(['config', 'user.email', 't@t'])
        q(['config', 'user.name', 't'])
        q(['config', 'core.autocrlf', 'false'])
        writeFileSync(join(t7, 'deep.ts'), 'L0\n')
        q(['add', '-A'])
        q(['commit', '-qm', 'D0'])
        const firstOid = q(['rev-parse', 'HEAD:deep.ts']).trim()
        for (let i = 1; i <= 45; i++) {
          writeFileSync(join(t7, 'deep.ts'), `L${i}\n`)
          q(['commit', '-qam', 'D' + i])
        }
        const win = windowFor('deep.ts')
        const depth = q(['log', '--format=%H', 'HEAD', '--', 'deep.ts'])
          .split('\n')
          .filter(Boolean).length
        check(`㉜0 夹具确实把该路径历史做深到窗口之外(共 ${depth} 枚 > 窗口 ${win})`, depth > win)
        // 工作树回到**最老**那一版(深度 46,窗内取不到)
        writeFileSync(join(t7, 'deep.ts'), 'L0\n')
        const d32 = alignDrifts(t7)
        check(
          '㉜a 窗外祖先复归 ⇒ 保守不动(不覆写别人的现场优先于把门弄绿)',
          d32.aligned === 0 && readFileSync(join(t7, 'deep.ts'), 'utf8') === 'L0\n',
        )
        check(
          `㉜b 但必须点名"窗口 ${win} 用尽未判定"(旧账面在这里只写"无需对齐")`,
          d32.driftUndetermined.some(
            (u) => u.path === 'deep.ts' && u.window === win && u.seen >= win,
          ),
        )
        // ㉜c 反例(点名不是放过):窗内祖先版本 ⇒ 照旧被识别并回到 HEAD
        writeFileSync(join(t7, 'deep.ts'), 'L40\n') // 深度 6,窗内
        const d32c = alignDrifts(t7)
        check(
          '㉜c 窗内祖先复归 ⇒ 仍被对齐,且不进未判定名单',
          d32c.aligned === 1 &&
            readFileSync(join(t7, 'deep.ts'), 'utf8') === 'L45\n' &&
            !d32c.driftUndetermined.some((u) => u.path === 'deep.ts'),
        )
        // ㉜d 第三态:既不是滞后也谈不上"已判定"——真新内容同样落在窗内没命中,而窗口用尽时
        //    本层无从区分它和窗外复归 ⇒ 一律点名(把"没抓到"写成"没有回写"才是原缺陷)
        writeFileSync(join(t7, 'deep.ts'), 'X 从未在任何版本出现过的一行\n')
        const d32d = alignDrifts(t7)
        check(
          '㉜d 真新内容 ⇒ 不动,且同样按"未判定"点名(不冒红也不记绿)',
          d32d.aligned === 0 &&
            readFileSync(join(t7, 'deep.ts'), 'utf8') === 'X 从未在任何版本出现过的一行\n' &&
            d32d.driftUndetermined.some((u) => u.path === 'deep.ts'),
        )
        // ㉝ 同一件事在 refreshStaleIndex 那一维:索引停在**窗外**祖先 ⇒ 不刷新 + 点名 verdict
        writeFileSync(join(t7, 'deep.ts'), 'L45\n') // 工作树 == HEAD,排除别的通道
        q(['update-index', '--cacheinfo', `100644,${firstOid},deep.ts`])
        const r33 = refreshStaleIndex(t7)
        check(
          '㉝a 索引停在窗外祖先 ⇒ 不刷新(旧布尔判据在这里静默读成"不是祖先")',
          r33.refreshed === 0 &&
            q(['ls-files', '-s', '--', 'deep.ts']).split(/\s+/)[1] === firstOid,
        )
        check(
          '㉝b 且逐条点名 verdict=beyond-window 带窗口与已见枚数',
          r33.ancestryUndetermined.some(
            (u) => u.path === 'deep.ts' && u.verdict === 'beyond-window' && u.window === win,
          ),
        )
        // ㉝c 反例:窗内祖先(HEAD~3)⇒ proven ⇒ 照旧刷新
        const inWindow = q(['rev-parse', 'HEAD~3:deep.ts']).trim()
        q(['update-index', '--cacheinfo', `100644,${inWindow},deep.ts`])
        const r33c = refreshStaleIndex(t7)
        check(
          '㉝c 窗内祖先 ⇒ 照旧刷新且不点名(收口不是放过)',
          r33c.refreshed === 1 &&
            !r33c.ancestryUndetermined.some((u) => u.path === 'deep.ts') &&
            q(['ls-files', '-s', '--', 'deep.ts']).split(/\s+/)[1] ===
              q(['rev-parse', 'HEAD:deep.ts']).trim(),
        )
        // ㉝d 窗口只许有一份实现:取自守门 84,而那个"只给布尔、把判不出折成 false"的旧helper
        //     不得回来(形状锁按**函数名**判,不写含 `--max-count=30` 的整串 —— 那会让断言匹配到
        //     自己的源码,AGENTS §117 记过的"说明性文字也带执行性字符"同型)
        const srcText = readFileSync(fileURLToPath(import.meta.url), 'utf8')
        check(
          '㉝d 祖先窗口取自守门 84,单一布尔判据不得回来(形状锁)',
          /from '\.\/check-stale-revert\.mjs'/.test(srcText) &&
            /ancestorWindow\(/.test(srcText) &&
            /blobInAncestry\(/.test(srcText) &&
            // 用 \s+ 而不是空格写这个正则:整串"函数名 + 空格 + 旧 helper 名"若原样出现在
            // 本文件任何位置(包括注释),这条断言就会匹配到自己的源码而恒红
            // (说明性文字也带执行性字符,AGENTS 记过同型)
            !/function\s+isAncestorBlob\b/.test(srcText),
        )
      } finally {
        rmScratch(t7)
      }
    }

    let threw = false
    try {
      refreshStaleIndex(tmp)
    } catch {
      threw = true
    }
    check('⑬ 暂存删除不使刷新崩溃', !threw)

    // ⑪ 他人真暂存的新内容(blob 不是任何历史版本)⇒ 绝不刷新
    writeFileSync(join(tmp, 'keep.ts'), '他人暂存的新工作\n')
    g(['add', 'keep.ts'])
    const r2 = refreshStaleIndex(tmp)
    check(
      '⑪ 他人真暂存不被刷新',
      r2.refreshed === 0 && readFileSync(join(tmp, 'keep.ts'), 'utf8') === '他人暂存的新工作\n',
    )

    let fail = 0
    for (const r of out) {
      console.log(`${r.ok ? '✅' : '❌'} ${r.n}`)
      if (!r.ok) fail++
    }
    console.log(
      fail
        ? `self-test FAILED ${fail}/${out.length}`
        : `✅ check heal-worktree-tracked self-test 全部通过(${out.length} 例)`,
    )
    return fail ? 1 : 0
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/**
 * 人类档共用出口:把"哪一层因什么跳过"与"哪一格判不出"逐条点名。
 * 立规理由:§5b 明写守护"健康时不写行",所以**安静不是绿的同义词** —— 一次跳过或一格判不出
 * 若在账面上与"无事发生"长得一样,它就是本仓记过最多次的那一型(判据失效的表现永远是安静)。
 */
function printSkipsAndLoss(o) {
  for (const s of o.layerSkips || []) {
    const more = s.deferred?.length
      ? `|本层延后 ${s.deferred.length} 个:${s.deferred.slice(0, 10).join(', ')}`
      : ''
    const advice = lockSkipAdvice(s.kind)
    console.log(`⚠️ [${s.layer}] ${s.reason}${advice ? ' —— ' + advice : ''}${more}`)
  }
  const lost = o.driftUndetermined || []
  if (lost.length) {
    console.log(
      `⚠️ ${lost.length} 个路径工作树内容与 HEAD 不等、祖先窗口**确证用尽**而窗内未命中 ⇒ 本轮判不出是否陈旧回写(既不覆写别人的现场,也不得被读成"无需对齐"):`,
    )
    for (const u of lost.slice(0, 10))
      console.log(
        `   ⚠ 未判定 ${u.path}(窗口 ${u.window},窗内已取 ${u.seen} 枚${u.channel ? ',通道 ' + u.channel : ''})`,
      )
    console.log(
      '   出口:逐条 `git log --format=%H --find-object=<工作树 blob> -- <path>` 问全深度后人工定性(本层刻意不跑无界遍历 —— 现测真仓热档一次全深度 log >120s,而本层每 2 分钟一轮);确属回写由归属会话 `git checkout HEAD -- <path>`',
    )
  }
  const anc = o.ancestryUndetermined || []
  if (anc.length) {
    console.log(
      `⚠️ ${anc.length} 个路径的索引 blob 落在祖先窗口之外或取不到 ⇒ 不刷新(单独一档,不折进 held 总数):`,
    )
    for (const u of anc.slice(0, 10))
      console.log(`   ⚠ 未判定 ${u.path}(${u.verdict},窗口 ${u.window}/已看 ${u.seen})`)
    console.log(
      '   出口:同上 `git log --find-object=<索引 blob> -- <path>`;确属落后索引则由归属会话逐路径 update-index',
    )
  }
  for (const s of o.subsetUndetermined || []) {
    const n = (s.paths || []).length
    console.log(
      `⚠️ ${n} 个路径的 ②′ 行子集判据**未判定**(${s.reason}${s.bucket ? ',档位 ' + s.bucket : ''}):` +
        (s.paths || []).slice(0, 10).join(', '),
    )
  }
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTestRun()
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  if (process.env[SKIP_ENV]) return 0
  // `--check` 必须是**只判不改**的巡检口径(AGENTS.md §5b 承诺"零副作用"):
  // 旧实现只认 `--dry-run`,`--check` 会一路落到真恢复分支,把他人**有意**的未暂存删除
  // 直接 `git restore` 复活(2026-09-24 差点咬掉并发会话正在收口的 4 个分类栏文件)。
  const checkOnly = argv.includes('--check')
  const dryRun = argv.includes('--dry-run') || checkOnly
  // --align-drift:幻影漂移对齐 + 落后索引刷新 + 第四层旁路孤儿恢复(git-sync-converge 推进 HEAD 后调用)
  if (argv.includes('--align-drift')) {
    const d = alignDrifts(repoRoot, { dryRun })
    if (argv.includes('--json')) console.log(JSON.stringify(d))
    else {
      // 审计行只在非 --json 档打印:守护/converge 都是"取 stdout 最后一行 JSON.parse",
      // 任何一行跟在 JSON 之后都会把整轮记成"自愈失败"(§22c 记过的静默失效形态)。
      if (d.bypassRestored) {
        console.log(
          `✅ 旁路提交孤儿路径已恢复 ${d.bypassRestored} 个(四判据齐备:HEAD 有 blob / 索引无 / 磁盘无 / 缺席于至少一个父树 ⇒ 陈旧索引遗留,非人为 git rm;checkout 语义索引+工作树同回写,零独有数据)`,
        )
        for (const p of (d.bypassPaths || []).slice(0, 10)) console.log('   - 已恢复 ' + p)
      }
      if (dryRun && d.bypassPaths?.length)
        console.log(
          `[check] ${d.bypassPaths.length} 个旁路提交孤儿路径可恢复(HEAD有/索引无/盘无/父树签名;未执行)`,
        )
      if (d.bypassHeldOnDisk)
        console.log(
          `ℹ️ ${d.bypassHeldOnDisk} 个路径 HEAD 有而索引无,但磁盘存在文件(git rm --cached / 别人现场)⇒ 不碰,只报数`,
        )
      if (d.bypassHeldUnproven)
        console.log(
          `⚠️ ${d.bypassHeldUnproven} 个路径 HEAD 有而索引+磁盘都无,但存在于 HEAD 每个父树 ⇒ 与有意 git rm 分不清,只报数不修(处置出口:归属会话提交其删除,或人工 git checkout HEAD -- <path>)`,
        )
      for (const p of (d.bypassUnprovenPaths || []).slice(0, 10)) console.log('   ⚠ 未判定 ' + p)
      if (d.bypassDeferred?.length)
        console.log(
          `⚠️ ${d.bypassDeferred.length} 个旁路孤儿本轮未恢复(已延后,原因见下面 [旁路孤儿恢复] 那一行的锁状态归因):` +
            (d.bypassDeferred || []).slice(0, 10).join(', '),
        )
      // G-794 / G-742:跳过与判不出必须在人类档点名(守护 --json 档由字段带,converge 读末行)
      printSkipsAndLoss(d)
      if (d.aligned)
        console.log(
          `${dryRun ? '[check] 可对齐' : '✅ 幻影漂移对齐'} ${d.aligned} 个文件(索引==HEAD 且内容==祖先版本)` +
            (d.refreshed ? `;落后索引已刷新 ${d.refreshed} 个路径(工作树未动)` : ''),
        )
      else {
        // "无需对齐"这句必须自带它**没**判到的部分,否则读起来像"全部判过且干净"(G-742 账面)
        const caveats = []
        if (d.layerSkips?.length) caveats.push(`${d.layerSkips.length} 层本轮因锁跳过`)
        if (d.driftUndetermined?.length)
          caveats.push(`${d.driftUndetermined.length} 处窗口用尽未判定`)
        if (d.ancestryUndetermined?.length)
          caveats.push(`${d.ancestryUndetermined.length} 处索引祖先判不出`)
        if (d.refreshDeferred?.length) caveats.push(`${d.refreshDeferred.length} 个索引刷新延后`)
        console.log(
          `✅ 无需对齐(可判定 ${d.paths ? d.paths.length : 0} 个,已跳过有暂存的 ${d.skippedStaged || 0} 个)` +
            (caveats.length ? ` —— ⚠️ 这句不等于"全部判过且干净":${caveats.join(';')}` : ''),
        )
      }
    }
    return d.aligned && checkOnly ? 1 : 0
  }
  const res = heal(repoRoot, { dryRun })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res))
    return checkOnly && (res.paths.length || res.orphanIndex) ? 1 : 0
  }
  if (
    !res.restored &&
    !res.paths.length &&
    !res.held &&
    !res.intentLost &&
    !res.orphanIndex &&
    !res.deferred?.length &&
    !res.layerSkips?.length
  ) {
    console.log('✅ 工作区已跟踪文件存续正常')
    return 0
  }
  // G-794:默认档的让路也要点名(旧形状里 reconcile 被锁挡下只剩 reconciled:0,读不出原因)
  printSkipsAndLoss(res)
  /**
   * 延后 ≠ 正常。2026-09-26 实测:10 个跟踪文件(含 8 张 tabbar 位图 + 两份测试)被外部删除,
   * `restoreToHead()` 因 native `index.lock` 被并发会话长期持有而把它们记成 deferred,
   * 而普通档那句"✅ 工作区已跟踪文件存续正常"照样打印 —— 判据失效的表现又是安静,与 §22c
   * 记过的"门报 0 而其实没跑"同型。故此处必须点名"未恢复"并给出出口,不得回平安。
   * 退出码仍取 0:持锁不是本脚本的故障,而非零退出会让 git-guardian 每 2 分钟对同一件事重复喊人。
   * **原因按锁三态现读给出**(G-794),不再把"索引写锁失败"当既定事实写死 —— 此刻无锁时它是
   * 前提复核不成立(别人刚暂存),措辞错了会把人带去修一个不存在的东西。
   */
  if (!res.restored && !res.paths.length && res.deferred?.length) {
    const why = res.lockStateAtReport
      ? `此刻锁判读:${res.lockStateAtReport.state} —— ${res.lockStateAtReport.reason}`
      : '此刻未探锁(降级通道成功过,原因不在锁)'
    console.log(
      `⚠️ ${res.deferred.length} 个被外部删除的跟踪文件**本轮未恢复**:` +
        'restore 未成功,降级通道(checkout-index,不需要锁)也没走通 —— ' +
        '要么这些路径此刻索引 blob 已不等于 HEAD(别人刚暂存过,本层按纪律不碰),' +
        '要么 git 本身不可用。下一次不带 pathspec 的普通提交就会把它们从版本树里抹掉。',
    )
    console.log(`   ${why} ${lockSkipAdvice(adviceKindForState(res.lockStateAtReport?.state))}`)
    for (const p of res.deferred.slice(0, 10)) console.log('   - 待恢复 ' + p)
    console.log(
      '   出口:等锁释放后重跑本脚本,或直接 `git cat-file blob HEAD:<path> > <path>`(回写工作树不需要索引)',
    )
    return 0
  }
  console.log(
    `${dryRun ? '[check] 可恢复' : '已恢复'} ${res.restored || res.paths.length} 个被外部删除的跟踪文件` +
      (res.restoreViaIndex
        ? `(其中 ${res.restoreViaIndex} 个经 checkout-index 降级写回 —— 此刻索引锁被占用)`
        : '') +
      (res.held ? `;另有 ${res.held} 个他人已暂存的删除(不碰)` : '') +
      // G-1018292:报数档必须在这里出声。折进 held 会让读日志的人以为"标记还在、只是没碰",
      // 而这一档的标记**已经**被共享索引的整批清空摘掉了 —— 那正是本票的事故本身。
      (res.intentLost
        ? `;⚠️ ${res.intentLost} 个删除意图已丢失(暂存标记被共享索引清空摘掉,分不清是宿主误删还是有意删除 ⇒ 不代裁恢复)`
        : '') +
      (res.orphanIndex
        ? `;⚠️ ${res.orphanIndex} 个路径 HEAD 有而索引+磁盘都无(旁路提交孤儿或有意 git rm;恢复走 --align-drift 第四层,四判据可证才修,其余只报数)`
        : ''),
  )
  for (const p of res.paths.slice(0, 20)) console.log('   - ' + p)
  if (res.intentLostPaths?.length) {
    for (const p of res.intentLostPaths.slice(0, 20))
      console.log(
        '   ⚠ 删除意图丢失 ' +
          p +
          ' —— 清空前它是暂存删除(`D `),标记已被一次 `git reset HEAD` 摘掉;' +
          '出口:归属会话确认意图(要删就重新 `git rm --cached -- <路径>`,要留就 checkout 回来)',
      )
  }
  if (res.orphanIndex) {
    const { orphanIndex } = findOrphanedDeletions(repoRoot)
    for (const p of orphanIndex.slice(0, 10))
      console.log(
        '   ⚠ 索引孤儿 ' +
          p +
          ' —— 出口:node scripts/heal-worktree-tracked.mjs --align-drift(第四层按四判据可证才恢复);确属删除则由归属会话提交',
      )
  }
  return checkOnly && (res.paths.length || res.orphanIndex) ? 1 : 0
}

export const healTrackedFiles = heal

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
    .then((code) => {
      if (code) process.exit(code)
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  findOrphanedDeletions,
  heal,
  alignDrifts,
  refreshStaleIndex,
  compositeDriftPaths,
  restoreToHead,
  restoreBypassOrphans,
  // G-794 的三态出口与写索引出口(镜像测按行为断言,不在测试里重抄判据 —— §22c)
  probeIndexLock,
  indexLockPath,
  classifyLockFailure,
  lockSkipAdvice,
  adviceKindForState,
  writeIndexCacheInfos,
  // G-742 的四态祖先判定
  blobInAncestry,
  INDEX_LOCK_LIVE_MS,
  SKIP_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
