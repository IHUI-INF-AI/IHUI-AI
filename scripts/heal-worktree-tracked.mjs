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
 */
import {
  copyFileSync,
  existsSync,
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
import { analyze } from './check-stale-revert.mjs'
import { gitRaw } from './lib/face-reader.mjs'
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
      g(['restore', '--source=HEAD', '--worktree', '--', ...batch])
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
  const st = g(['status', '--porcelain', '-z'])
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
        v = g(['rev-parse', `${c}:${path}`]).trim()
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
      anc = g(['log', `--max-count=${lookback}`, '--format=%H', 'HEAD', '--', p])
        .split('\n')
        .filter(Boolean)
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
    if (norm(g(['show', `HEAD:${p}`])) === norm(readFileSync(resolve(repoRoot, p), 'utf8')))
      continue
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
 *
 * 本函数同时是第四层 restoreBypassOrphans 的唯一执行面(2026-09-26):converge 成功出口调的就是
 * `--align-drift`,旁路孤儿恢复挂在这里等于"HEAD 每被旁路推进一次,下一拍就被补一次"。
 * 恢复层(heal 默认档)刻意**不**调用它 —— 新档只在显式的 --align-drift 下写盘。
 */
export function alignDrifts(repoRoot, { dryRun = false } = {}) {
  const g = makeGit(repoRoot)
  // 先刷新"落后索引"(CAS/converge 只推进 HEAD 的后遗症),否则下面判据①会把它们全部误挡掉
  const refreshed = refreshStaleIndex(repoRoot, { dryRun })
  // 第四层:旁路提交孤儿路径(HEAD 有 / 索引无 / 盘无)。跑在 dirty 计算之前 —— 恢复完的
  // 路径已不再是"工作区 vs HEAD"的差集;若排在后面,它们会以"缺失"混进漂移判定并被
  // skippedStaged 错计。判据与恢复动作见 restoreBypassOrphans 头注(四判据全成立才动手)。
  const bypass = restoreBypassOrphans(repoRoot, { dryRun })
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
  const dirty = g(['diff', '--name-only', 'HEAD', '--no-renames']).split('\n').filter(Boolean)
  if (!dirty.length) return { aligned: 0, paths: [], refreshed: refreshed.refreshed, ...bp }
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
  if (!eligible.length) return { aligned: 0, paths: [], skippedStaged: dirty.length, ...bp }
  const hits = analyze(repoRoot, eligible, { source: 'worktree' })
  const whole = new Set(hits.map((h) => h.path))
  // 第二条通道:整块不等于任何祖先、但逐块都能对上(索引层重建的拼合旧基线)
  const composite = compositeDriftPaths(
    repoRoot,
    eligible.filter((p) => !whole.has(p)),
  )
  const paths = [...whole, ...composite]
  if (!paths.length || dryRun) {
    return {
      aligned: 0,
      paths,
      composite: composite.length,
      dryRun: true,
      skippedStaged: dirty.length - eligible.length,
      ...bp,
    }
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
    // 不得静默成"无事发生"。
    const msg = String(e?.message ?? e)
    if (/lock|Another git process/i.test(msg))
      return {
        restored: 0,
        paths: [],
        heldOnDisk: 0,
        heldUnproven: 0,
        unprovenPaths: [],
        skippedNotBlob: 0,
        deferred: [],
        reason: 'git 索引被占用,本轮让路',
      }
    throw e
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
  const { safe, held, orphanIndex } = findOrphanedDeletions(repoRoot)
  const rec = reconcileStaleIndexOrphans(repoRoot, { dryRun })
  if (!safe.length)
    return {
      restored: 0,
      held: held.length,
      reconciled: rec.reconciled,
      orphanIndex: orphanIndex.length,
      paths: [],
    }
  if (dryRun)
    return {
      restored: 0,
      held: held.length,
      reconciled: rec.reconciled,
      orphanIndex: orphanIndex.length,
      paths: safe,
      dryRun: true,
    }
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
          `⚠️ ${d.bypassDeferred.length} 个旁路孤儿本轮未恢复(git 写锁竞争,已延后):` +
            (d.bypassDeferred || []).slice(0, 10).join(', '),
        )
      if (d.aligned)
        console.log(
          `${dryRun ? '[check] 可对齐' : '✅ 幻影漂移对齐'} ${d.aligned} 个文件(索引==HEAD 且内容==祖先版本)`,
        )
      else
        console.log(
          `✅ 无需对齐(可判定 ${d.paths ? d.paths.length : 0} 个,已跳过有暂存的 ${d.skippedStaged || 0} 个)`,
        )
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
    !res.orphanIndex &&
    !res.deferred?.length
  ) {
    console.log('✅ 工作区已跟踪文件存续正常')
    return 0
  }
  /**
   * 延后 ≠ 正常。2026-09-26 实测:10 个跟踪文件(含 8 张 tabbar 位图 + 两份测试)被外部删除,
   * `restoreToHead()` 因 native `index.lock` 被并发会话长期持有而把它们记成 deferred,
   * 而普通档那句"✅ 工作区已跟踪文件存续正常"照样打印 —— 判据失效的表现又是安静,与 §22c
   * 记过的"门报 0 而其实没跑"同型。故此处必须点名"未恢复"并给出出口,不得回平安。
   * 退出码仍取 0:持锁不是本脚本的故障,而非零退出会让 git-guardian 每 2 分钟对同一件事重复喊人。
   */
  if (!res.restored && !res.paths.length && res.deferred?.length) {
    console.log(
      `⚠️ ${res.deferred.length} 个被外部删除的跟踪文件**本轮未恢复**(git 写锁竞争,已延后):` +
        '下一次不带 pathspec 的普通提交就会把它们从版本树里抹掉。',
    )
    for (const p of res.deferred.slice(0, 10)) console.log('   - 待恢复 ' + p)
    console.log(
      '   出口:等锁释放后重跑本脚本,或直接 `git cat-file blob HEAD:<path> > <path>`(回写工作树不需要索引)',
    )
    return 0
  }
  console.log(
    `${dryRun ? '[check] 可恢复' : '已恢复'} ${res.restored || res.paths.length} 个被外部删除的跟踪文件` +
      (res.held ? `;另有 ${res.held} 个他人已暂存的删除(不碰)` : '') +
      (res.orphanIndex
        ? `;⚠️ ${res.orphanIndex} 个路径 HEAD 有而索引+磁盘都无(旁路提交孤儿或有意 git rm;恢复走 --align-drift 第四层,四判据可证才修,其余只报数)`
        : ''),
  )
  for (const p of res.paths.slice(0, 20)) console.log('   - ' + p)
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
  SKIP_ENV,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
