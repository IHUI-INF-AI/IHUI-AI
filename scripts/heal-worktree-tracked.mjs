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
 *   node scripts/heal-worktree-tracked.mjs --align-drift # 额外对齐"幻影漂移"(索引==HEAD 且内容==祖先版本)
 * 紧急跳过:IHUI_SKIP_WORKTREE_HEAL=1
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 判据复用守门 84(§22d 已把 CLI 入口与导出分离,import 不会触发副作用)
import { analyze } from './check-stale-revert.mjs'

const GIT = process.env.IHUI_GIT_BIN || 'git'
export const SKIP_ENV = 'IHUI_SKIP_WORKTREE_HEAL'

function makeGit(repoRoot) {
  return (args, opts = {}) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 28,
      ...opts,
    })
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
 * 逐批把路径恢复到 HEAD。**一次锁竞争不该让整轮自愈崩掉**:
 * 共享工作区里并行会话的 commit 会瞬时持有 index.lock(实测本会话就撞上一次),
 * 原先三处 restore 循环都是直接 execFileSync —— 抛出即整 tick 失败,而这一层的意义正是
 * "下一轮自己补上"。故失败只记账、延到下一 tick,并把延后数如实返回。
 */
function restoreToHead(g, paths) {
  const done = []
  const deferred = []
  for (let i = 0; i < paths.length; i += 40) {
    const batch = paths.slice(i, i + 40)
    try {
      g(['restore', '--source=HEAD', '--worktree', '--', ...batch], { stdio: ['ignore', 'pipe', 'pipe'] })
      done.push(...batch)
    } catch {
      deferred.push(...batch)
    }
  }
  return { done, deferred }
}

/** 工作区缺失但索引与 HEAD 完全一致的已跟踪文件 = 被外部删除 */
export function findOrphanedDeletions(repoRoot) {
  const g = makeGit(repoRoot)
  const st = execFileSync(
    GIT,
    [
      '-c',
      'safe.directory=*',
      '-c',
      'core.quotepath=false',
      '-C',
      repoRoot,
      'status',
      '--porcelain',
      '-z',
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 28,
    },
  )
  const safe = []
  const held = []
  /**
   * **只报不修**的一类:`git status` 首列 `D ` —— 索引里没有、磁盘也没有,而 HEAD 有该路径。
   * 两种成因在机器上分不开:① 会话有意 `git rm`(暂存删除,尚未提交);② 旁路提交
   * (commit-tree/merge-tree)把路径**加进** HEAD 却没动共享索引 ⇒ 索引成了"缺该路径"的孤儿态。
   * ② 的真实代价是静默烂掉:本仓 2026-09-24 有 5 个测试文件因 `packages/shared/src/chat/voice-subtitles.ts`
   * 处于此态而**加载失败**(报的是 vite "Failed to resolve import",看不出与工作区存续有关),
   * 而当时的巡检口径把它整个漏掉、还回一句"存续正常"。故本分支**如实报数**(退出码非 0),
   * 恢复动作仍交归属会话 —— 与守门层"分不清就不动"的取向一致。
   */
  const orphanIndex = []
  for (const rec of st.split('\0')) {
    if (!rec) continue
    const xy = rec.slice(0, 2)
    const path = rec.slice(3).trim()
    if (xy === 'D ' && path) {
      try {
        g(['rev-parse', `HEAD:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] })
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
      // 路径可能不在 HEAD 里(新增文件);git 的 fatal 要静默 —— 本脚本每 2 分钟被守护跑一次,
      // stderr 噪音会淹掉真正的自愈审计行
      headBlob = g(['rev-parse', `HEAD:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      headBlob = ''
    }
    if (indexBlob && indexBlob === headBlob && !existsSync(resolve(repoRoot, path))) safe.push(path)
    else if (!indexBlob) held.push(path) // 索引里也没有:他人已暂存删除,不碰
  }
  return { safe, held, orphanIndex }
}

/** 该 blob 是否出现在此路径的历史版本里(祖先判定) */
function isAncestorBlob(g, path, blob) {
  if (!blob) return false
  try {
    const anc = g(['log', '--max-count=30', '--format=%H', 'HEAD', '--', path])
      .split('\n')
      .filter(Boolean)
    for (const c of anc) {
      let v = ''
      try {
        v = g(['rev-parse', `${c}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      } catch {
        v = ''
      }
      if (v === blob) return true
    }
  } catch {
    return false
  }
  return false
}

/**
 * 覆盖前留退路:把工作区现场字节按 UTC 时间戳目录快照一份,返回快照落点。
 * 只给"需要被覆盖的那几个文件"用,故不做全仓扫描;单文件上限由调用方的 maxBytes 保证。
 */
export function snapshotWorktreeBytes(repoRoot, paths, destDir) {
  if (!paths.length) return []
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
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
  { lookback = 30, maxBytes = 512 * 1024, maxFiles = 80 } = {},
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
    let anc = []
    try {
      anc = g(['log', `--max-count=${lookback}`, '--format=%H', 'HEAD', '--', p]).split('\n').filter(Boolean)
    } catch {
      continue
    }
    const texts = []
    for (const c of anc) {
      try {
        texts.push(g(['show', `${c}:${p}`]))
      } catch {
        /* 该版本无此路径:跳过 */
      }
    }
    if (!texts.length) continue
    // 只做"内容回潮"的收口:**纯重排**(同一批行换了位置,典型是 import 排序)不在此列 ——
    // 它不携带任何回退风险,而把它写回 HEAD 会和 lint-staged 的格式化器来回打架。
    const norm = (s) =>
      s
        .split('\n')
        .map((l) => l.replace(/\r$/, '').trim())
        .filter(Boolean)
        .sort()
        .join('\n')
    if (norm(g(['show', `HEAD:${p}`])) === norm(readFileSync(resolve(repoRoot, p), 'utf8'))) continue
    if (joined.every((grp) => texts.some((t) => t.includes(grp)))) hits.push(p)
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
 *   ③ 该路径上没有"现场":工作区 == 索引(无未暂存改动),**或**工作区 == HEAD
 *      (旁路提交后工作区已跟上 HEAD,刷索引只是把 index 补齐 —— 不覆盖任何东西)。
 *   ③ 的后一形态是 CAS/`commit-tree` 提交后最常见的残留(本仓 2026-09-23 实测 4 个路径),
 *   只写"工作区==索引"会把它永久漏掉:那些陈旧 index blob 会一直躺在暂存区里,
 *   等任何人一次不带 pathspec 的普通 commit 把文件写回旧版。
 */
export function refreshStaleIndex(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  const staged = g(['diff', '--name-only', 'HEAD', '--cached', '--no-renames'])
    .split('\n')
    .filter(Boolean)
  if (!staged.length) return { refreshed: 0, paths: [], held: 0 }
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
  // `hash-object --stdin-paths` 会让整条命令 fatal 退出 ⇒ 本自愈每轮都崩在同一处,
  // 工作区存续恢复通道等于停摆(2026-09-23 实测:scripts/tests/gitdir-archive-paths.test.mjs)。
  const present = staged.filter((p) => existsSync(resolve(repoRoot, p)))
  if (present.length) {
    try {
      const hashOut = g(['hash-object', '--stdin-paths'], {
        input: present.map((p) => resolve(repoRoot, p)).join('\n') + '\n',
      })
        .split('\n')
        .filter(Boolean)
      if (hashOut.length === present.length) present.forEach((p, i) => wtBlob.set(p, hashOut[i]))
    } catch {
      // 取不到工作区 blob ⇒ 宁可不刷新(held),也不要在看不到现场时动索引
    }
  }

  const refreshable = []
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
    if (noLocalState && isAncestorBlob(g, p, ib)) refreshable.push([p, hb])
    else held++
  }
  if (!refreshable.length) return { refreshed: 0, paths: [], held }
  if (dryRun) return { refreshed: 0, paths: refreshable.map(([p]) => p), held, dryRun: true }
  for (const [p, hb] of refreshable) {
    g(['update-index', '--cacheinfo', `100644,${hb},${p}`])
  }
  return { refreshed: refreshable.length, paths: refreshable.map(([p]) => p), held }
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
 */
export function alignDrifts(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  // 先刷新"落后索引"(CAS/converge 只推进 HEAD 的后遗症),否则下面判据①会把它们全部误挡掉
  const refreshed = refreshStaleIndex(repoRoot, { dryRun })
  const dirty = g(['diff', '--name-only', 'HEAD', '--no-renames']).split('\n').filter(Boolean)
  if (!dirty.length) return { aligned: 0, paths: [], refreshed: refreshed.refreshed }
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
  if (!eligible.length) return { aligned: 0, paths: [], skippedStaged: dirty.length }
  const hits = analyze(repoRoot, eligible, { source: 'worktree' })
  const whole = new Set(hits.map((h) => h.path))
  // 第二条通道:整块不等于任何祖先、但逐块都能对上(索引层重建的拼合旧基线)
  const composite = compositeDriftPaths(
    repoRoot,
    eligible.filter((p) => !whole.has(p)),
  )
  const paths = [...whole, ...composite]
  if (!paths.length || dryRun) {
    return { aligned: 0, paths, composite: composite.length, dryRun: true, skippedStaged: dirty.length - eligible.length }
  }
  // 护栏④:拼合通道覆盖前留现场快照(整块通道命中的工作区内容本就 == 某历史版本,无独有数据)
  const snapshots = snapshotWorktreeBytes(repoRoot, composite)
  const { done, deferred } = restoreToHead(g, paths)
  return {
    aligned: done.length,
    paths: done,
    composite: composite.length,
    snapshots: snapshots.length,
    deferred,
    skippedStaged: dirty.length - eligible.length,
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
    const msg = String(e?.message ?? e)
    if (/lock|Another git process/i.test(msg))
      return { reconciled: 0, paths: [], reason: 'git 索引被占用,本轮让路' }
    throw e
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
  // ⚠️ 别用 `rev-list --format=%T` 再按 "tree " 前缀过滤 —— %T 展开的是**裸 sha**(没有前缀),
  //    那样祖先树集合恒为空,本判据会永远走"属有意删除,不碰"这支(自测 ⑭ 就是这么抓出来的)。
  // 一次子进程问结论:把每个祖先 commit 的 ^{tree} 喂给 cat-file --batch。
  const anc = g(['rev-list', '--max-count=60', 'HEAD']).split('\n').filter(Boolean)
  const ancTrees = new Set(
    g(['cat-file', '--batch'], { input: anc.map((c) => `${c}^{tree}`).join('\n') + '\n' })
      .split('\n')
      .filter((l) => /^\w{40} tree /.test(l))
      .map((l) => l.split(' ')[0]),
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

export function heal(repoRoot, { dryRun = false } = {}) {
  const { safe, held, orphanIndex } = findOrphanedDeletions(repoRoot)
  const rec = reconcileStaleIndexOrphans(repoRoot, { dryRun })
  if (!safe.length)
    return { restored: 0, held: held.length, reconciled: rec.reconciled, orphanIndex: orphanIndex.length, paths: [] }
  if (dryRun)
    return { restored: 0, held: held.length, reconciled: rec.reconciled, orphanIndex: orphanIndex.length, paths: safe, dryRun: true }
  const g = makeGit(repoRoot)
  const { done, deferred } = restoreToHead(g, safe)
  return {
    restored: done.length,
    held: held.length,
    reconciled: rec.reconciled,
    paths: done,
    deferred,
    restoreDeferred: deferred.length,
    orphanIndex: orphanIndex.length,
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
      'export const st = {\n  backgroundColor: tokens.brand.' + x + ',\n' +
      P1 + '\n  color: tokens.brand.' + y + ',\n' + P2 + '\n  borderColor: tokens.brand.' + z + ',\n}\n'
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
    check('⑭a 拼合态整块不等于任何祖先(整块通道失效)', analyze(tmp, ['mix.ts'], { source: 'worktree' }).length === 0)
    check('⑭b 取用行逐块可对上历史 ⇒ 判为回潮', compositeDriftPaths(tmp, ['mix.ts']).includes('mix.ts'))
    const d14 = alignDrifts(tmp)
    check('⑭c 对齐后工作区回到 HEAD', d14.composite === 1 && readFileSync(join(tmp, 'mix.ts'), 'utf8') === mix('two', 'two', 'two'))
    check('⑭d 覆盖前留了现场快照(护栏③)', d14.snapshots === 1 && existsSync(join(tmp, '.ihui-agent/tmp/worktree-align-snapshots')))

    // ⑮ 单块回潮:本仓 8 个滞后文件的真实形态就是"一条取用行换回旧档名" ⇒ 不受块数限制
    writeFileSync(join(tmp, 'mix.ts'), mix('one', 'two', 'two'))
    check('⑮ 单块取用行回潮同样判拼合', compositeDriftPaths(tmp, ['mix.ts']).includes('mix.ts'))
    alignDrifts(tmp)
    check('⑮b 已复位到 HEAD', readFileSync(join(tmp, 'mix.ts'), 'utf8') === mix('two', 'two', 'two'))

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
    check('⑯b 整块等于祖先 ⇒ 由既有整块通道收口(composite=0/aligned=1)', d16.composite === 0 && d16.aligned === 1)

    // ⑰ 取用行形态、但该写法从未出现在任何历史版本 ⇒ 判据②挡下
    writeFileSync(join(tmp, 'mix.ts'), mix('zz9', 'two', 'two'))
    check('⑰ 未见过的取用行 ⇒ 不判拼合(护栏②)', compositeDriftPaths(tmp, ['mix.ts']).length === 0)
    alignDrifts(tmp)
    check('⑰b 该文件未被覆盖', readFileSync(join(tmp, 'mix.ts'), 'utf8') === mix('zz9', 'two', 'two'))

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
    //    ⇒ 必须**报数**(本仓 5 个测试文件因此静默加载失败),但不得自动恢复(与有意删除分不清)
    writeFileSync(join(tmp, 'orphan.ts'), 'export const orphan = 1' + String.fromCharCode(10))
    g(['add', 'orphan.ts'])
    g(['commit', '-qm', 'G: 新增 orphan.ts'])
    g(['rm', '--cached', '-q', 'orphan.ts'])
    rmSync(join(tmp, 'orphan.ts'), { force: true })
    const o1 = findOrphanedDeletions(tmp)
    check('⑴ 索引孤儿被如实报数', o1.orphanIndex.includes('orphan.ts'))
    check('⑴b 索引孤儿绝不自动恢复', !o1.safe.includes('orphan.ts') && !existsSync(join(tmp, 'orphan.ts')))
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
      const bornBlob = q(['hash-object', '-w', '--stdin'], {
        input: 'born by commit-tree\n',
      }).trim()
      const aBlob = q(['rev-parse', 'HEAD:a.ts']).trim()
      // mktree 的清单走 stdin(注意:makeGit 第二参是 options,不是内容 —— 传错会静默生成空树)
      const t2 = q(['mktree'], {
        input: `100644 blob ${aBlob}\ta.ts\n100644 blob ${bornBlob}\tborn-by-bypass.ts\n`,
      }).trim()
      const c2 = q(['commit-tree', t2, '-p', 'HEAD']).trim()
      q(['update-ref', 'refs/heads/main', c2]) // 索引原地不动 ⇒ 与真实现场同形
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
  // --align-drift:跳过缺失恢复,只做幻影漂移对齐(git-sync-converge 推进 HEAD 后调用)
  if (argv.includes('--align-drift')) {
    const d = alignDrifts(repoRoot, { dryRun })
    if (argv.includes('--json')) console.log(JSON.stringify(d))
    else if (d.aligned)
      console.log(
        `${dryRun ? '[check] 可对齐' : '✅ 幻影漂移对齐'} ${d.aligned} 个文件(索引==HEAD 且内容==祖先版本)`,
      )
    else
      console.log(
        `✅ 无需对齐(可判定 ${d.paths ? d.paths.length : 0} 个,已跳过有暂存的 ${d.skippedStaged || 0} 个)`,
      )
    return d.aligned && checkOnly ? 1 : 0
  }
  const res = heal(repoRoot, { dryRun })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res))
    return checkOnly && (res.paths.length || res.orphanIndex) ? 1 : 0
  }
  if (!res.restored && !res.paths.length && !res.held && !res.orphanIndex) {
    console.log('✅ 工作区已跟踪文件存续正常')
    return 0
  }
  console.log(
    `${dryRun ? '[check] 可恢复' : '已恢复'} ${res.restored || res.paths.length} 个被外部删除的跟踪文件` +
      (res.held ? `;另有 ${res.held} 个他人已暂存的删除(不碰)` : '') +
      (res.orphanIndex ? `;⚠️ ${res.orphanIndex} 个路径 HEAD 有而索引+磁盘都无(旁路提交孤儿或有意 git rm,只报不修)` : ''),
  )
  for (const p of res.paths.slice(0, 20)) console.log('   - ' + p)
  if (res.orphanIndex) {
    const { orphanIndex } = findOrphanedDeletions(repoRoot)
    for (const p of orphanIndex.slice(0, 10)) console.log('   ⚠ 索引孤儿 ' + p + ' —— 归属会话提交或 git rm --cached 后方可判清')
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
  SKIP_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
