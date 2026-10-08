#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件面零丢失收敛合并(守门 100 的**修复出口**)
 *
 * 为什么要有它:`git-sync-converge` 在 merge-tree 冲突时只能报"需人工介入",而人工接手时
 * 最容易犯的错是**选边**。2026-09-24 实测:远端一枚合并把对侧独有的 **35 个新增路径整批抹掉**、
 * 72 个文件回退成旧基线(相对共同祖先净 −12014 行),它的提交信息还写着"双方每一行均存活" ——
 * 因为它检查的是**行**,事故发生在**文件**上。本会话手工做了两次 union 收敛,把这套配方固化成工具:
 * **不存在"哪一侧优先",只存在"谁独有的谁拿走"**。
 *
 * 构造(可断言的集合运算,不是启发式):
 *   合并树 = 本侧整棵树
 *           ∪ 对侧「相对共同基底自己动过、而本侧没动」的路径逐个取对侧版本;
 *             对侧删掉的路径**不随合并传播** —— 删除必须在合并之后显式做出,那才是守门 100 认得的合法形态
 *           ∪ 对侧与本侧「相对共同基底都动过」的非文档路径 ⇒ **真三方** `git merge-file`(base/ours/theirs
 *             三个 blob)。此前这一类是"整文件取对侧",会**静默吃掉本侧在该文件里的改动** —— 与它要防的
 *             事故同型,只是粒度从文件降到行。合并出冲突或遇二进制/非普通文件:判失败并**点名文件**,
 *             由人来判;绝不猜、绝不选边(这与"零丢失"同等重要)。
 *           ∪ 活文档(PROJECT_PLAN / AGENTS / README)按**三方行重数** union
 *             `结果[l] = 本侧重数 + max(0, 对侧重数 − max(基底重数, 本侧重数))`
 *             —— 只有"对侧相对基底新增"的行才被强制补回;对侧没动、被本侧改写/删除的行
 *               处置权在本侧。旧写法 `max(ours,theirs)` 会把本侧就地改写**之前**的旧行复活
 *               (2026-09-25 实测:刚翻勾的待办被并回未勾,`check-task-claims` 当场重新报成可派)。
 *             2026-09-29 再收一维(G-814386):**带「重复登记副本」指针的行只许"从无到有带一份"**,
 *               不参与份数累加。这一族已被 `plan-tasks` 的派单口径算作同一条活账的副本,而份数累加
 *               等于**把已判过死刑的副本按份数复原** —— 实测 22:16 把该档清到 0 组/0 行,一枚收敛后
 *               未勾选从 1189 顶回 1819、F1 从 0 顶回 37 组,清理那一侧永远追不上重放这一侧。
 *               指针判据取自 `lib/plan-task-index.DUP_POINTER_RE`(与尺子同源,不得另写一个针);
 *               少带的份数在落地当场逐条点名并写进合并提交信息,**不静默折进"0 丢失"**。
 *             2026-09-28 再加一维**搬运感知**(唯一新增判据,实现在 `lib/ledger-move-aware.mjs`):
 *               某一行若在**基准面(本侧)**已被一条 `<!-- 已归档(…) -->` 占位注释代表,
 *               就不得再从对侧取回。立因是"完成即归档"与本工具**结构性互咬**:并行会话持有的
 *               滞后台账副本把已搬走的正文行当"对侧新增"带回来,实测一枚收敛把台账从本侧
 *               7,523 行带回 16,494 行(−8,971 行的归档白做了),面上已勾选行由 0 回到 2,410,
 *               于是只能"瞬时清零、无法收敛",每收敛一次就得再搬一轮。
 *               **这条判据的失效方向只能是"多带一行回来",绝不能是"少带一行"** —— 少带 = 丢
 *               别人新写的行,比互咬更严重。所以占位找不到、归档件取不到、块边界与文本对不上、
 *               块内容与归档件不逐行连续(= 占位之后被就地改写)、空行 —— 一律照旧取回并逐条报因。
 *   落地前自证:丢本侧路径 = 0 ∧ 丢对侧路径 = 0 ∧ 三份文档未存活行 = 0 ∧ 两侧同改文件的**独有行不丢**
 *             (字符行 multiset 底线;真三方可能把两侧改动交织到不同位置,本断言只保证重数不减少、
 *              不判语义顺序 —— 局限如实说明,不假装更强);
 *             "未存活行"这一维自 2026-09-28 起**同时报出**"因搬运感知而合法未取回"的行数与逐条出处
 *             (报告必须能回答"你没带回 N 行,因为这 N 行在基准面已有 已归档 占位代表"),不得静默。
 *   落地后再让**守门 100 本人的 A1** 复核这枚新合并(用它的判据验它的产物,而不是"看着对")。
 *   写盘一律临时索引 + commit-tree + **CAS** update-ref(HEAD 被他人推进则本轮作废重来),
 *   绝不 checkout、绝不碰共享工作区(§12d)。
 *
 * 用法:
 *   node scripts/union-converge.mjs                  # 只报告(零副作用)
 *   node scripts/union-converge.mjs --apply          # 落地合并(幂等)
 *   node scripts/union-converge.mjs --theirs <sha>   # 指定目标(默认 origin/<当前分支>)
 *   node scripts/union-converge.mjs --take-ours <path> [--take-ours <path>]...
 *       # 两侧同改且**能证明对侧那一版在本树必红**时,声明该路径取本侧。
 *       #   必须逐条附取证(跑过对侧版的结果),且会出现在输出与合并提交信息里。
 *   node scripts/union-converge.mjs --take-theirs <path> [--take-theirs <path>]...
 *       # 与上一条对称(2026-09-28 补)。用的唯一场景:两侧把**同一个功能**各写了一份,
 *       #   且同一行被两种写法改写(实测 D151「命令在等键盘输入」:本侧 `awaitingInput:{promptTail}`
 *       #   vs 主干 `waitingInput:boolean`)。这种冲突 `--resolve` 结构上无解 —— 它的零损失断言
 *       #   要求两侧独有行都在,而"都在"= 同名类型/函数声明重复 ⇒ 编译不过;于是它只会一路
 *       #   "需人工",把发布链卡在分叉上(2026-09-28 实测挡停约 3 小时)。
 *       #   声明它 = 该路径持有者说"本侧这一份是被取代的",整文件取对侧。
 *       #   纪律照抄 --take-ours:逐条声明、逐条打印、写进合并提交信息;不声明就仍是 needHuman。
 *   node scripts/union-converge.mjs --resolve '<path>=<内容文件>' [--resolve ...]
 *       # 真三方报冲突后,**人工判完的回灌出口**(2026-09-26 立)。此前"请人工判"是一句死路:
 *       #   工具不接收人工结果,人只能去做裸 git 手术(read-tree/commit-tree/update-ref),
 *       #   从而绕过本工具全部断言 —— 只判不修的门逼人绕过,这条对工具自己同样成立。
 *       # 它与 --take-ours 的区别是本条的安全前提:喂进来的**整份内容**照样跑
 *       #   "两侧独有行重数不得减少"的断言,少哪一侧就当场 bad ⇒ 它不是选边的别名。
 *   node scripts/union-converge.mjs --self-test      # 真临时仓取证(含"选边必判失败"反向对照)
 *   node scripts/union-converge.mjs --move-aware-detail
 *       # 把"因搬运感知而未取回"的行**逐行**打印(默认只按条目块给计数 + 出处归档件路径)。
 * 退出码:0 = 无需合并或已落地且复核干净;1 = 判据不过/两侧同改冲突需人工/CAS 失败;
 *        2 = 脚本自身异常,**或"本器没资格判"**(取不到远端当次真值 / 目标对象不在本机)——
 *        后者走 `unreachableObjectGuidance` 打印三条出口并落 `UNDETERMINED 未判定`,
 *        绝不能落在 0 那一支(把"判不了"报成"无事可做"= 账面全绿而分叉永久留着)。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { auditOne } from './check-merge-addition-loss.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { resolveRemoteHead, catBatch } from './lib/face-reader.mjs'
import { resolveGitBin } from './lib/gitdir.mjs'
import { postMergeLedgerSync } from './lib/post-merge-ledger-sync.mjs'
import { recordBypassLanding } from './lib/commit-attestation.mjs'
import {
  auditPlan,
  malformedLine,
  f9GroupLine,
  DUP_POINTER_RE,
  lineNoteCount,
  mergeNoteUnits,
  keyOfRow,
} from './lib/plan-task-index.mjs'
import { SIM_THRESHOLD, jaccard, tokenize, stripState } from './lib/live-doc-similarity.mjs'
// 搬运感知判据(2026-09-28):占位注释的解析与"哪些行属于那个被搬走的条目"的块归属,
// 一律复用归档器那一份实现(`lib/plan-task-headings.mjs` 的 parseCompletedTaskBlocks),
// **不得在本归并器里再抄一条"什么算一个已完成条目"的正则** —— 两处各写一遍必漂移。
import {
  collectReferencedArchives,
  archivedLineSuppressions,
  subtractSuppressed,
} from './lib/ledger-move-aware.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// git 可执行一律经 §5b 唯一出口解析(候选链 + 探活;§5b 明写"脚本一律不得依赖环境取 git")。
// 旧写法写死 `C:/Program Files/Git/cmd/git.exe`,另一台机(G 盘 checkout)实测 git 落点不同 ⇒ 换机即 ENOENT。
const GIT = resolveGitBin()
if (!GIT) {
  console.error('❌ union-converge:resolveGitBin() 解析不到可用 git(候选链见 scripts/lib/gitdir.mjs)')
  process.exit(2)
}
/** 多会话共写的活文档:行级 union(其余文件按路径整体取某一侧) */
export const LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']
const GIT_TIMEOUT = 300000

/**
 * 提交身份必须随调用一起给,不能依赖"当前用户配过 global config"。
 * 实测:本收敛器由 IHUI-DEPLOYLOOP 以服务身份(LocalSystem)后台发起,而 user.name/user.email
 * 只配在交互账户的 %USERPROFILE%\.gitconfig 里 —— SYSTEM 那份读不到,于是 :1091 的 commit-tree
 * 直接 `fatal: unable to auto-detect email address (got 'SYSTEM@WIN-...')`,收敛**一次都没成功过**。
 * 更坏的是失败形态:调用方 git-sync-converge 把"非零退出"统一报成"union-converge 亦判需人工",
 * 部署环据此连寄告警 —— 工具崩溃被读成了内容裁决,而内容从未被归并过。
 * 取值与 scripts/git-rebuild-local.mjs:113 登记的仓库机器身份同一份,不自立第二档。
 */
const GIT_IDENTITY = ['-c', 'user.name=智汇AGI社区', '-c', 'user.email=ok502319984@gmail.com']

function git(args, cwd = ROOT, input) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...GIT_IDENTITY, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    // 根治(2026-09-30):本机交互会话下 Node 给子进程建 stdin 管道会 EBUSY(与父进程自身
    // stdin 形态无关,managed/system 两个 node 都中;stdout/stderr 管道正常)。git 绝大多数
    // 调用不消费 stdin ⇒ 无 input 时 stdin 设 ignore;带 input(--stdin 类)必须保住管道。
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    windowsHide: true, // §5b:漏此参数在守护/钩子派生下必弹控制台窗
    timeout: GIT_TIMEOUT,
    maxBuffer: 512 * 1048576,
  }).trim()
}

function show(rev, p, cwd) {
  try {
    return git(['show', `${rev}:${p}`], cwd)
  } catch {
    return ''
  }
}

function blobOf(rev, p, cwd) {
  try {
    // 必须带 --verify --quiet:裸 rev-parse 对解析不了的参数(<rev>:<path> 路径不存在时)
    // 会**原样回显且退出码 0**(2026-10-07 实测抓到:远端树没有 PageClient.tsx,
    // blobOf 回显了 "<sha>:<path>" 整串 ⇒ 被当 blob 塞进 --cacheinfo ⇒ 整轮收敛崩)。
    return git(['rev-parse', '--verify', '--quiet', `${rev}:${p}`], cwd)
  } catch {
    return null
  }
}

function listPaths(rev, cwd) {
  return git(['ls-tree', '-r', '--name-only', rev], cwd).split('\n').filter(Boolean)
}

const counter = (s) => {
  const m = new Map()
  for (const l of s.split('\n')) m.set(l, (m.get(l) || 0) + 1)
  return m
}

/** 两侧相对基底的"动过的路径"清单(含仅改 mode —— 它同样会进 diff --name-only)。 */
function diffNames(a, b, cwd) {
  return git(['diff', '--name-only', a, b], cwd).split('\n').filter(Boolean)
}

/** 内容面判据不得走 `git()`(encoding utf8 + trim 会毁掉二进制与行尾),单开 buffer 通道。 */
function gitBuf(args, cwd = ROOT) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'buffer',
    // 根治:同 git() —— 无 input,stdin 设 ignore 避开本会话子进程 stdin 管道 EBUSY。
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: GIT_TIMEOUT,
    maxBuffer: 512 * 1048576,
  })
}

function blobText(oid, cwd) {
  try {
    return gitBuf(['cat-file', 'blob', oid], cwd).toString('utf8')
  } catch {
    return ''
  }
}

/**
 * 生成物自证标记(G-814415)。判据只认**文件自己声明"我是生成物"**的两种原文标记:
 * `GENERATED FILE — DO NOT EDIT`(生成器头注)与 `IHUI-GEN-PIN-BEGIN`(输入内容哈希钉块,
 * 由 scripts/lib/generated-input-pin.mjs 写)。不靠路径猜、不维护第二份清单 ——
 * 手工清单必然腐烂(§4 对 RN_ONLY_BRAND_KEYS 的教训),而这两个标记是生成器自己落的,
 * 没有生成器就没有标记 ⇒ 判据只对该走"重生成"通道的那一类成立。
 */
export const GENERATED_ARTIFACT_MARKERS = ['GENERATED FILE — DO NOT EDIT', 'IHUI-GEN-PIN-BEGIN']

export function generatedArtifactMarker(texts) {
  for (const t of texts) {
    if (typeof t !== 'string' || t === '') continue
    for (const m of GENERATED_ARTIFACT_MARKERS) if (t.includes(m)) return m
  }
  return null
}

/** 树里该路径的 mode(100644/100755/120000/160000);取不到返回 ''(交人工,不猜)。 */
function modeOf(rev, p, cwd) {
  try {
    return git(['ls-tree', rev, '--', p], cwd).match(/^(\d{6})\s/)?.[1] ?? ''
  } catch {
    return ''
  }
}

function writeBlob(content, p, cwd) {
  // 根治(2026-09-30):--stdin 通道要求子进程 stdin 真管道,而本会话 Node 建 stdin 管道
  // 会 EBUSY ⇒ 改走临时文件。`--path p` 保留:属性/换行过滤仍按业务路径判定,与
  // `--stdin --path p` 产出同一 blob SHA(2026-09-30 以 CRLF 样本实证等价);scratch 用后即焚。
  const scratch = mkScratch('union-blob-')
  const tmp = join(scratch, 'blob')
  writeFileSync(tmp, content)
  try {
    return execFileSync(
      GIT,
      ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'hash-object', '-w', '--path', p, tmp],
      {
        cwd,
        encoding: 'utf8',
        // 无 input ⇒ stdin 设 ignore(同 git()/gitBuf() 各自注释)。
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        timeout: GIT_TIMEOUT,
        maxBuffer: 512 * 1048576,
      },
    ).trim()
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
}

/**
 * 影子 `.js` 的同 stem `.ts/.tsx` 候选(非影子路径返回空数组)。
 * 方向刻意只此一路:本仓约定是"`./x.js` 说明符指的是 `x.ts`",所以"该消失的是 `.js`"。
 */
export function shadowTsSiblings(p) {
  const m = /^(.*)\.(?:js|cjs|mjs)$/.exec(p)
  return m && m[1] ? [`${m[1]}.ts`, `${m[1]}.tsx`] : []
}
/**
 * 纯判据:`p` 那份内容为 `shadowOid` 的文件,在 `rev` 那棵树里是否有**同一份字节**的 `.ts/.tsx` 同伴?
 * 等值证明用 **blob oid 逐字相等**(git 内容寻址给的,比读正文再比更强),不做相似度、不做长度比较。
 * 命中 ⇒ 返回 {path, oid};否则 null。测试可直接调用,不需要真仓。
 */
export function shadowTwinIsIdentical(p, shadowOid, siblingOids) {
  if (!shadowOid || typeof shadowOid !== 'string') return null
  for (const s of shadowTsSiblings(p)) {
    const oid = siblingOids && siblingOids[s]
    if (oid && oid === shadowOid) return { path: s, oid }
  }
  return null
}
/** 上面那条判据的 git 侧包装:去 `rev` 那棵树里取同 stem 同伴的 oid。 */
function shadowTwinOf(p, shadowOid, rev, cwd) {
  if (!shadowOid) return null
  const siblingOids = {}
  for (const s of shadowTsSiblings(p)) siblingOids[s] = blobOf(rev, s, cwd)
  return shadowTwinIsIdentical(p, shadowOid, siblingOids)
}

function emptyBlob(cwd) {
  // 根治(2026-09-30):带 input 的调用 stdio[0] 必须真管道,而本会话建 stdin 管道会 EBUSY。
  // 这里喂的本就是空串 ⇒ 摘掉 input,git 读到立即 EOF,产出同一枚空 blob SHA(e69de29)。
  try {
    return git(['hash-object', '-w', '--stdin'], cwd)
  } catch {
    return null
  }
}

/**
 * 真三方归并三个 blob。ok:false 的三种形态都由人来判,工具本身**绝不退回"取某一侧"**:
 *  conflict = merge-file 报的冲突区数(1..127,其 stdout 带标记,只作证据不入库)
 *  binary   = 二进制无法文本归并(merge-file 直接拒:`Cannot merge binary files`)
 *  error    = 其余非零退出/异常 ⇒ "无法判定",同样不得记为通过(硬约束 7)
 */
function mergeThreeBlobs(baseOid, oursOid, theirsOid, cwd) {
  try {
    const buf = gitBuf(
      [
        'merge-file',
        '-p',
        '--object-id',
        '-L',
        'OURS',
        '-L',
        'BASE',
        '-L',
        'THEIRS',
        oursOid,
        baseOid,
        theirsOid,
      ],
      cwd,
    )
    return { ok: true, buf }
  } catch (e) {
    const status = typeof e?.status === 'number' ? e.status : -1
    const err = Buffer.isBuffer(e?.stderr)
      ? e.stderr.toString('utf8')
      : String(e?.stderr ?? e?.message ?? '')
    // status 1..127 且 stdout 有内容才是 merge-file 自己报的冲突区;
    //   129 这类用法错误(无 stdout)必须落到 error,不得被叫成"冲突"误导人工。
    if (status > 0 && status < 255 && e?.stdout?.length)
      return {
        ok: false,
        kind: 'conflict',
        detail: `merge-file 冲突区 ${status} 处`,
        buf: Buffer.from(e.stdout),
      }
    if (/Cannot merge binary files/.test(err))
      return { ok: false, kind: 'binary', detail: '二进制文件无法文本三方归并' }
    return {
      ok: false,
      kind: 'error',
      detail: `merge-file 退出 ${status}:${err.trim().slice(0, 160)}`,
    }
  }
}

/**
 * 一侧相对基底**新增**的行(字符行 multiset),扣掉另一侧对同名基底行的显式删除后,
 * 必须在归并结果里保住。底线判据:只保证"重数不减少",不判顺序与语义交织
 * (真三方把两侧改动接到不同位置时顺序本就会变,那不是丢行)。
 */
/**
 * 归并结果的任务状态分叉**不得高于任何一侧**(纯函数,不碰 git)。
 * 三条判据同守门 130:F1 同主键两态并存 / F2 自带作废声明未落账 / F3 行号指针已腐烂。
 * 取"各侧最大值"而不是"对侧值"作基准,是因为本侧也可能带着未清存量 —— 归并只许持平或变好。
 * 解析不出(空文本/非计划文档)⇒ 返回空数组并**不**声称通过:调用方只对真做了判定的路径说话。
 *
 * 2026-09-28 G-606 补两维,它们**不进上面那个计数档循环**、各判各的形状:
 *  · **F9b 畸形登记号**:判**行集**而不判计数 —— 计数档对"合并抹掉一侧的旧畸形号、同时造出一枚
 *    新的"恒净零(G-312 为 F9 付过的学费在这里同形重演)。点名到逐行原文,因为修复动作是一行字符。
 *  · **F9 撞号组**:判**键集**——只有"两侧都不撞、而归并结果撞了"的键才算合并造的债。
 *    两侧都不撞而结果撞 ⇒ 是归并把两条不同议题的行拼到同一编号下(取号器并发让号失败的形状);
 *    已有一侧就撞的组**刻意不判红**:让同组多挂一行只能靠人工让号(F9 的差值档在提交链上拦),
 *    而落地闸若为此拒绝归并,唯一出路是删掉某一侧的行 —— 那违反本工具的零丢失承诺,更贵。
 */
export function planStateRegressions(mergedText, sideTexts, accepted = null, noteCredits = null) {
  const KEYS = [
    ['forks', 'F1 同主键两态并存(组)'],
    ['voidRows', 'F2 带作废声明未落账(行)'],
    // 比较量必须是本行标签说的那个东西(2026-09-29 改,原先拿 rotatedPointers 当判据):
    // `rotatedPointers` = **全部**腐烂指针,其中绝大多数**没有任何自动出口**(目标行已被归档搬走、
    // 或作者意图不可推断)。拿它当"归并不得放大"的放行条件,等于要求合并把一个**谁都无法下降**
    // 的数字降下来 —— 而活文档归并本身就是"两侧行的并集",这条维只会随合并单调上升。
    // 实测后果:落地闸连 30+ 轮报「各侧最多 277,归并结果 284 ⇒ 判需人工」,部署环停摆。
    // 一台永远无法满足的 blocking 门 = 每台每次被逼跳门 = 全部守门对每次提交作废(§12f 实测三道同型)。
    // 现在判的是"有出口却变大"= 本次归并新造出**能收却没收**的债;无出口那一半仍每次大声点名,
    // 只是不再当放行条件(点名出口见 f3ExitCaliber,不得删)。
    ['rotatedAuto', 'F3 行号指针·此刻有出口可收(处)'],
    ['dupOpenCopies', 'F4 同一件事多条待办(副本行)'],
    // F6 是块级量纲:整块被并集追加两遍时行级四条一路绿灯,而"每行重数 = max(两侧)"
    // 正是它的生产机制 —— 所以这一维必须在落地闸上判,合并提交不跑 pre-commit。
    ['dupBlocks', 'F6 整块登记重复(块)'],
  ]
  /**
   * `accepted`(2026-09-28 补的**声明式**出口,由 CLI 的 `--accept-state-growth <维>=<理由>` 喂进来):
   * 三条量纲 F1/F4/F3-rotatedAuto 判的是"归并结果不得高于任何一侧",而活文档归并的定义就是
   * **两侧行的并集** —— 同一件事在两台机器各登记一份(一台已勾一台未勾)时,并集必然把它变成
   * 一组新分叉,这一维**只许持平或变好**在这条路径上结构上不可满足(实测:11 组撞号已逐条让号
   * 清偿完毕,剩 F1 各侧最多 17→归并 27 / F4 11→24 / F3 0→3,三者同因)。
   * 缺的不是判断而是**可追责的出口**:与 `--take-ours/--take-theirs` 同一条纪律 —— 必须逐条声明、
   * 必须带理由、必须把两个读数与理由一起打印并写进合并提交信息,不得默认、不得静默。
   * F5(落账注记变少)/ F6(整块重复)/ F9+F9b(撞号与畸形号,本次已真清)/ 路径零丢失
   * **不接受声明放行**:它们是"本可以不做错"的那一型,而不是并集的天然后果。
   */
  const acceptedDims = new Map()
  for (const a of Array.isArray(accepted) ? accepted : [])
    if (a && typeof a.dim === 'string' && a.dim) acceptedDims.set(a.dim, a.reason)
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  if (typeof mergedText === 'string' && mergedText.trim() !== '' && sides.length > 0)
    for (const d of acceptedDims.keys())
      if (!KEYS.some(([k]) => k === d))
        throw new Error(
          `--accept-state-growth 的维名不认识:${d}(可用维 = ${KEYS.map(([k]) => k).join(' / ')};` +
            'F5/F6/F9/F9b 与路径零丢失一律不可声明放行 —— 那三条正是本闸存在的理由)',
        )
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return []
  // 每面只解析一遍(旧写法在每个 KEYS 项里对每侧重解析一次 ⇒ 加维就会把审计成本乘上去)
  const mA = auditPlan(mergedText)
  const sA = sides.map((t) => auditPlan(t))
  const m = mA.counts
  const out = []
  out.accepted = []
  for (const [k, label] of KEYS) {
    const worst = Math.max(...sA.map((a) => a.counts[k]))
    if (m[k] > worst) {
      // 声明式放行只适用于"并集天然放大"那三维(见函数头注的成因)。放行了也必须把两个数
      // 与理由一起交出去 —— 调用方要把它写进合并提交信息;静默跳过就是拆门。
      if (acceptedDims.has(k)) {
        out.accepted.push(`${label} 各侧最多 ${worst} → 归并 ${m[k]}(已声明放行:${acceptedDims.get(k)})`)
        continue
      }
      out.push(`${label} 各侧最多 ${worst},归并结果 ${m[k]}`)
    }
  }
  // F9b:逐字不在任何一侧的畸形行 = 归并自己造的(两侧各自带来的存量都按预存债放过)
  const seenMalformed = new Set(
    sA.flatMap((a) => a.malformedRows.map((r) => String(r.raw).trim().slice(0, 90))),
  )
  const newMal = (mA.malformedRows ?? []).filter(
    (r) => !seenMalformed.has(String(r.raw).trim().slice(0, 90)),
  )
  for (const r of newMal.slice(0, 12)) out.push(`F9b 归并新增畸形登记号 ${malformedLine(r)}`)
  if (newMal.length > 12) out.push(`F9b … 其余 ${newMal.length - 12} 行畸形号见 --json 的 malformedRows`)
  // F9:两侧都不撞、归并结果才撞的键
  const seenColl = new Set(sA.flatMap((a) => (a.collisions ?? []).map((g) => g.key)))
  const newColl = (mA.collisions ?? []).filter((g) => !seenColl.has(g.key))
  for (const g of newColl.slice(0, 12)) out.push(`F9 归并新增撞号组 ${f9GroupLine(g)}`)
  if (newColl.length > 12) out.push(`F9 … 其余 ${newColl.length - 12} 组新增撞号见 --json 的 collisions`)
  /**
   * F5 方向与前四条相反:注记**少**了才坏。这一条正是本会话被咬两次的形状的落地闸 ——
   * 活文档按"每行重数 = max(两侧)"归并时,已落账的行会连同它的注记一起被未落账形态顶掉,
   * 而 F1-F4 与门 71 对此**同时全绿**(退回的是同态行、编号标记也还在)。
   * 合并提交不跑 pre-commit,所以只能在落地闸这里拦。
   */
  const noteMax = Math.max(...sides.map((t) => auditPlan(t).counts.mergeNotes))
  if (m.mergeNotes < noteMax) {
    /**
     * F5 判的是"注记**份数**不得降",而 G-814386 这一票要做的恰恰是"让带副本指针的行少带几份"
     * —— 直接照份数比,本票会让每一枚台账收敛在落地闸上自杀(恒红 ⇒ 唯一出路是各会话绕过收敛,
     * 比原病更响)。所以这里改成**先算合法上限、再判余下差额**:只有"带副本指针且合并结果里仍
     * ≥1 份"的行可以贡献豁免额度,其它任何一条注记行变少都照常判红。
     * 注记的**形状判据与份数判据只有一份实现** = `plan-task-index.lineNoteCount`(G-977960 ① 收口:
     * 本门此前把 MERGE_NOTE_RE 的 source 就地重拼成正则,自己抄了第二份逐行计数,而 F5 的读数住在
     * 另一档量纲上 ⇒ 跨行注记既进不了总额也进不了合法额度,造出"无论怎么合并都差 N 条"的死局。
     * 逐行判必须用**非全局副本**这一点由 lib 内部保证,调用方不得再自带正则。
     */
    const occOf = (l) => lineNoteCount(l)
    const mm = counter(mergedText)
    const sideCounters = sides.map((t) => counter(t))
    /**
     * 遍历域必须是**所有面的并**(2026-09-29 修,原先遍历结果面 `mm`):一条注记行如果在归并结果里
     * 一份都没剩下(`have=0`),它就不在 `mm` 里 ⇒ 结构上永远进不了额度 ⇒ 无论机制如何解释都恒红。
     * 而"结果里一份都没有"恰恰是最需要被解释的那一型 —— 旧写法把"最坏的情形"写成了"不可申诉的情形"。
     */
    const universe = new Set()
    for (const c of [...sideCounters, mm])
      for (const [l, n] of c) if (n > 0 && occOf(l) > 0) universe.add(l)
    const suppress = noteCredits && noteCredits.suppress ? noteCredits.suppress : null
    const baseC = noteCredits && noteCredits.baseText ? counter(noteCredits.baseText) : null
    const oursC = noteCredits && noteCredits.oursText ? counter(noteCredits.oursText) : null
    let allowed = 0
    let byPlaceholder = 0
    let byOwnShrink = 0
    let byDupPointer = 0
    const unexplained = []
    for (const l of universe) {
      const occ = occOf(l)
      if (!occ) continue
      const haveOcc = (mm.get(l) || 0) * occ
      const wantOcc = Math.max(...sideCounters.map((c) => (c.get(l) || 0) * occ))
      if (wantOcc <= haveOcc) continue
      let rest = wantOcc - haveOcc
      // ① 搬运感知:这些份数由基准面上的 `已归档` 占位代表(表按行给**份数**,× 每行条数换到同一量纲)。
      if (suppress && rest > 0) {
        const cov = Math.min((suppress.get(l) || 0) * occ, rest)
        byPlaceholder += cov
        rest -= cov
      }
      // ② 本侧相对**共同基底**自己缩了量 ⇒ `liveDocExpectedCounts` 的约定"基底有而本侧清了 ⇒ 处置权
      //    仍在本侧",这一部分本就不该从对侧补回。刻意要求 `o < b`:只有对侧加过的行永不进这一档。
      if (rest > 0 && oursC && baseC) {
        const o = (oursC.get(l) || 0) * occ
        const b = (baseC.get(l) || 0) * occ
        if (o < b) {
          const cov = Math.min(rest, b - o)
          byOwnShrink += cov
          rest -= cov
        }
      }
      /**
       * ③ 副本指针行的额度**有下限**:只许"从无到有带一份",整族归零不得由这一档解释掉。
       * 旧实现把 rest 全额记账 ⇒ 注释写着"留一份"而代码允许留零份 —— 镜像 R-O 保护的正是这里。
       * 2026-09-29 隔离检出复现:一条带副本指针的注记行在合并结果里一份不剩,仍然报绿。
       * 可记额度 = (wantOcc - occ) 减去 ①② 已记部分 = max(0, rest + haveOcc - occ)。
       */
      if (rest > 0 && DUP_POINTER_RE.test(l)) {
        const cov = Math.min(rest, Math.max(0, rest + haveOcc - occ))
        byDupPointer += cov
        rest -= cov
      }
      if (rest > 0) unexplained.push(`缺 ${rest} 份 :: ${l.slice(0, 70)}`)
      allowed += wantOcc - haveOcc - rest
    }
    if (m.mergeNotes < noteMax - allowed) {
      const named = unexplained.length
        ? `;未被任何机制解释的 ${unexplained.length} 条(列前 5):${unexplained.slice(0, 5).join(' | ')}`
        : ''
      out.push(
        `F5 归并落账注记 各侧最多 ${noteMax} 条,归并结果只剩 ${m.mergeNotes} 条` +
          `(已按行扣除三类**有据**额度共 ${allowed} 条:归档占位代表 ${byPlaceholder} / 本侧相对基底自缩 ${byOwnShrink} / 副本指针有意少带 ${byDupPointer};扣完仍差 ${noteMax - allowed - m.mergeNotes} 条)${named}`,
      )
    }
  }
  /**
   * F5c:跨行注记换成 `lineAttributable` 量纲之后,必须另外钉住"承载它的那几行物理消失"这一型,
   * 否则"少一道恒红"会变成"少一道判据"(与本仓记过的"修红不得顺手削判据"同一条禁令)。
   * 判据刻意只问**这一行还在不在结果面**(而不是份数):
   *  - 并集按行取 max ⇒ 一侧有的物理行必然还在(少带只发生在副本指针行,且至少留 1 份);
   *  - 行序重排会改变"整面命中数",但不会让任何一行消失 —— 所以行还在而份数变了 = 上面那条 phantom,
   *    由 `mergeNoteCrossLineCaliber` 报名;行不在了 = 真被抹掉,这里判红并点名行原文。
   */
  const mergedLines = counter(mergedText)
  for (const t of sides) {
    const units = mergeNoteUnits(t)
    if (units.crossLine === 0) continue
    const src = t.split('\n')
    const sideCounts = counter(t)
    for (const span of units.crossLineSpans) {
      for (let i = span.startLine; i <= span.endLine; i++) {
        const l = src[i]
        if (!l || l.trim() === '') continue
        if ((sideCounts.get(l) || 0) > 0 && (mergedLines.get(l) || 0) === 0) {
          out.push(
            `F5c 跨行注记的行段被抹掉:该注记横跨 ${span.endLine - span.startLine + 1} 行,` +
              `其中一行在归并结果里一份不剩 ← ${l.slice(0, 70)}` +
              `(注记片段:${span.snippet})`,
          )
        }
      }
    }
  }
  return out
}

/**
 * 跨行注记的**报名行**(只打印,不进判据、不进 violations —— 与 `f3ExitCaliber` 同一套规矩:
 * 那个数组里每一条都判红,把"只报名"塞进去就是造一台拦不住任何事、却处处拦你的门)。
 *
 * 为什么 F5 不比这一档:`MERGE_NOTE_RE` 的字符类 `[^〕]` 含换行 ⇒ 一条注记可以横跨两行,
 * 而三类合法额度(占位代表 / 本侧自缩 / 指针少带)**全部按行结算**。拿"整文件命中数"当份数去比,
 * 跨行那部分既进不了总额也进不了额度 ⇒ 天然不可满足(实测 622 / 530 / 已扣 90+3 / 仍差 2 且名单为空)。
 * 所以 F5 只比 `lineAttributable`,这一维单独报出来,让人看得见它有多少、在哪几条。
 *
 * 口径边界(不得读成"已覆盖"):现读 HEAD 面跨行 = 0 ⇒ 今天不比旧写法少抓任何一条真损失;
 * 若将来出现跨行注记被合并抹掉,这里只点名、不拦。补它要把"份数"的定义扩到行区间,另计一票。
 */
export function mergeNoteCrossLineCaliber(mergedText, sideTexts) {
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return ''
  const cal = auditPlan(mergedText).counts
  const perSide = sides.map((t) => auditPlan(t).counts)
  const worst = Math.max(0, ...perSide.map((c) => c.mergeNotesCrossLine ?? 0))
  const now = cal.mergeNotesCrossLine ?? 0
  if (worst === 0 && now === 0) return ''
  const lost = worst - now
  return (
    `F5 量纲:跨行书写的注记 各侧最多 ${worst} 条 / 归并结果 ${now} 条` +
    ` —— **只报名,不参与判红也不计额度**(三类额度都按行结算,拿它比就会造出不可满足的死局);` +
    (lost > 0
      ? `其中 ${lost} 条在本轮合并后不再成跨行匹配 —— 可能是行序重排后仍被整面匹配到(总额未变),也可能是真被抹掉,` +
        '按逐行额度机器判不出是哪种,故只点名不裁决。'
      : '这一档今天与较好一侧持平或更好。') +
    `同轮的逐行可判档 = 各侧最多 ${Math.max(0, ...perSide.map((c) => c.mergeNotes))} 条 / 结果 ${cal.mergeNotes} 条(那才是 F5 的判据)。`
  )
}

/**
 * F3 三维读数的**口径说明行**(只打印,不进判据、不进 violations)。
 * 刻意不并入 planStateRegressions 的返回值:那个数组的每一条都判红,把"只报名"塞进去
 * 就是造一台拦不住任何事却处处拦你的门。无出口部分必须每次现读现报 —— 它不再是
 * 放行条件,但也不许被读成"这一维没人看"。
 */
export function f3ExitCaliber(mergedText, sideTexts) {
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return ''
  const caliber = auditPlan(mergedText).counts
  return (
    `F3 口径:归并结果全部腐烂指针 ${caliber.rotatedPointers} 处 = 此刻有出口可收 ${caliber.rotatedAuto} 处` +
    ` + **无出口交人工 ${caliber.rotatedNoExit} 处**(不拦合并,但必须人工清;本轮未接归档反查索引,` +
    `auto 只算面内那一族 ⇒ 报 0 不等于"没有出口",归档出口的落地档是 plan-tasks-merge --heal)`
  )
}

export function lostAddedLines(baseText, sideText, otherText, mergedText) {
  const cb = counter(baseText)
  const cs = counter(sideText)
  const co = counter(otherText)
  const cm = counter(mergedText)
  const out = []
  // 有意少带的副本份数**单独一桶并必须被调用方点名** —— 例外若静默生效,下一次就没人能
  // 分清"这条被 cap 了"和"这条真的丢了"(把没判写成判过了,是本仓最高频失效型)。
  const capped = []
  for (const [l, n] of cs) {
    const added = n - (cb.get(l) || 0)
    if (added <= 0) continue
    const removedByOther = Math.max(0, (cb.get(l) || 0) - (co.get(l) || 0))
    const need = Math.max(0, added - removedByOther)
    const have = cm.get(l) || 0
    if (have >= need) continue
    // 只有一种下降算合法:该行带「重复登记副本」指针(判据取自 plan-task-index,不另写一个针),
    // 且合并结果里它仍 ≥1 份 —— 信息在,少的是份数。份数为 0 一律照常判丢。
    if (DUP_POINTER_RE.test(l) && have >= 1) {
      capped.push({ line: l, dropped: need - have })
      continue
    }
    out.push(l)
  }
  // 刻意挂成**不可枚举**:这个返回值同时被 `join()` / `for..of` / `deepStrictEqual` 消费,
  // 而既有判据(镜像"重数下降必须点名"那一条)就是拿 deepStrictEqual 比空数组 —— 挂可枚举属性
  // 会让一个元数据把不相干的断言顶红,那等于用工具自己的形状去制造假红(镜像 R-L2 钉死这条)。
  Object.defineProperty(out, 'pointerCapped', { value: capped, enumerable: false })
  return out
}
/** 把"因副本指针有意少带份数"这一桶排成人读行。入参固定为 **`{line, dropped}` 数组**
 *  (即 `lost.pointerCapped` 或 `liveDocPointerCaps()` 的返回值)—— 不接"带该属性的行数组",
 *  否则调用方会顺手把整个 `lost` 传进来,而那个数组的元素是字符串,两种形状混在一个入口必漂移。 */
export function formatPointerCapReport(capped, { maxEntries = 5 } = {}) {
  const list = capped ?? []
  const out = []
  if (!list.length) return []
  const dropped = list.reduce((s, e) => s + e.dropped, 0)
  const shown = Math.min(list.length, maxEntries)
  out.push(
    `      · 因副本指针有意少带 ${dropped} 份(涉及 ${list.length} 条逐字行,每条仍保留 ≥1 份 ⇒ 判"信息未丢")`,
  )
  for (const e of list.slice(0, shown))
    out.push(`        │ 少带 ${e.dropped} 份 ← ${String(e.line).slice(0, 90)}`)
  if (list.length > shown)
    out.push(`        …其余 ${list.length - shown} 条未逐条打印(份数已计入上一行)`)
  return out
}

/**
 * 活文档三方行 union 的**期望重数表**:`结果[l] = 本侧重数 + max(0, 对侧有效重数 − max(基底重数, 本侧重数))`。
 *
 * 为什么必须带基底这一维(2026-09-25 实测逼出来的,不是理论洁癖):
 * 旧写法 `结果 = max(本侧, 对侧)` 在**本侧就地改写某一行**时必然把改写前的旧行复活 ——
 * 本侧旧行 0 份 / 新行 1 份,对侧旧行 1 份未动 ⇒ max 把旧行判成"对侧多出来的",补回末尾。
 * 于是活文档里同时留下新旧两份同体行,而 `- [ ]`/`- [x]` 这种**行首就是状态位**的行被复活,
 * 等于把刚刚翻勾的待办又变回未认领(实测:`check-task-claims` 当场重新报成可派)。
 * 只有"对侧**相对基底新增**的行"才是本工具存在的理由(保住别人的独有行);
 * 对侧相对基底没动、而被本侧改掉/删掉的行,处置权在本侧。
 *
 * `suppress`(2026-09-28 搬运感知)只从**对侧贡献**里扣,永不压本侧自己的重数 ——
 * 少扣一行的后果是"带回已归档的内容",而多扣一行的后果是"丢掉别人新写的行",
 * 后者不可恢复,所以判据拿不准时必须给 suppress 传 null(= 不抑制)。
 *
 * **空行一律不参与补回**(期望表与 `unionLines` 的补回循环同一条规矩,两处必须同形)。
 * 这不是省事,是必要:`show()` 对取回的内容做了 `.trim()`,于是「补在文档末尾的一个空行」在断言侧
 * **根本表示不出来**(字节确实写进了 blob,读回来时尾部空行被剪掉)—— 把它计入期望重数就得到
 * 一道与内容无关的红:`PROJECT_PLAN.md 未存活行:`(冒号后面什么都没有)。这一型是被搬运感知照出来的:
 * 拦掉已归档正文之后,补回的最后一批里第一次出现了空行。
 */
export function liveDocExpectedCounts(oursText, theirsText, baseText = null, suppress = null) {
  const co = counter(oursText)
  const ct = subtractSuppressed(counter(theirsText), suppress)
  const cb = baseText === null ? new Map() : counter(baseText)
  const want = new Map(co)
  for (const [l, n] of ct) {
    if (l === '') continue // 空行不参与补回:与 unionLines 的补回循环同形(理由见本函数头注)
    const own = co.get(l) || 0
    // 副本指针行只许"从无到有带一份",绝不参与份数累加(2026-09-29 G-814386)。
    // 立因:这类行已被尺子的派单口径算作同一条活账的副本,而 max/累加会把**已判过死刑的副本**
    // 按份数复原 —— 实测 21:33 清到 1144 行、22:16 清到 0 组,一枚收敛就把未勾选从 1189 顶回 1819、
    // F1 从 0 顶回 37 组。少带的是**重复份数**,不是信息:本侧有则保持本侧,本侧没有而基底也没有
    // 才带 1 份;基底有而本侧清了 ⇒ 处置权仍在本侧(与不加这一维时同形)。
    const addedByTheirs =
      baseText !== null && DUP_POINTER_RE.test(l)
        ? Math.max(0, Math.min(1, n) - Math.max(cb.get(l) || 0, own))
        : Math.max(0, n - Math.max(cb.get(l) || 0, own))
    if (addedByTheirs > 0) want.set(l, own + addedByTheirs)
  }
  /**
   * 「对侧改写、本侧未动」那一格:把本侧脊柱里那份**来自基底的旧形态**按对侧剩下的份数下调。
   * 与 `unionLines` 的补回循环共用这一张表 ⇒ 产出面与自证面天然同形(两处各写一遍必漂移,
   * 而漂开的表现是"落地闸对着一个产出面根本不存在的数字红")。
   */
  for (const [l, n] of theirsRewriteCaps(oursText, theirsText, baseText, suppress)) {
    const left = (want.get(l) || 0) - n
    if (left <= 0) want.delete(l)
    else want.set(l, left)
  }
  return want
}

/**
 * 「**对侧**就地改写、而**本侧**对该主键完全未动」的折叠表 —— 已有那一条对称规则的另一半。
 *
 * 现有公式(`liveDocExpectedCounts`)已经处理了"本侧改写、对侧未动 ⇒ 不复活旧行"(靠基底那一维)。
 * 缺的是反方向:本侧未改、对侧把 base 的第 i 行改成新形态时,本侧脊柱里那份 base 行会原样留下,
 * 而对侧的新形态又被当"对侧相对基底新增"补回 ⇒ **同一主键两个形态并存**。
 * 台账上的表现就是 F9「归并新增撞号组」(实测 `G-823` / `G-814425` 两组:一侧是未勾原文、
 * 另一侧是同一件事的「已落地」改写形态 ⇒ 两侧都不撞、合并才撞),而它**不是**任何人的登记错误 ——
 * 是这台归并器把"改写"读成了"新增"。
 *
 * 只在四条同时成立时才折(每一条都在防一个具体的误伤):
 *  ① 有基底(无基底就无从判"谁动了",此时两侧都是独有行 ⇒ 一份都不能少带);
 *  ② 该主键两侧**行数相等**(不等 ⇒ 对侧是增行或整族删,增行必须两边都在,整族删按"删除不传播"放过);
 *  ③ 本侧该主键的行多重集**逐字等于基底**(= 本侧对这一族没有任何独有工作 ⇒ 少带一份不丢任何东西);
 *  ④ 对侧该主键与基底不同(否则无事可做)。
 * 折的数量取 `max(0, 基底重数 − 对侧重数)`,所以"对侧只换掉一族里的某一行"时另一行照留。
 *
 * **失效方向**:判不准 ⇒ 不折(多留一份,F9 照常红并交人工)。绝不反过来少带别人的行 ——
 * 与上面 `suppress` 那条"少扣一行=带回已归档内容 / 多扣一行=丢掉别人新写的行"是同一条禁令。
 * 只认台账主键(`keyOfRow`),AGENTS.md / README.md 那些非登记行因此**结构上不参与折叠**,
 * 行为与改动前逐字相同。
 */
export function theirsRewriteCaps(oursText, theirsText, baseText, suppress = null) {
  const caps = new Map()
  if (typeof baseText !== 'string' || baseText === '') return caps
  const group = (text) => {
    const m = new Map()
    for (const l of text.split('\n')) {
      const k = keyOfRow(l)
      if (!k) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(l)
    }
    return m
  }
  const gB = group(baseText)
  const gO = group(oursText)
  // 搬运感知已代表的那些份**不算对侧持有**:否则同一份会被 suppress 与 caps 各扣一次(少带 = 丢内容)。
  // 代价是这一族会因"行数不等"而落回不折 ⇒ 失效方向是多留一份,不是少带一份。
  const left = new Map(suppress || [])
  const tEff = []
  for (const l of theirsText.split('\n')) {
    const s = left.get(l) || 0
    if (s > 0) {
      left.set(l, s - 1)
      continue
    }
    tEff.push(l)
  }
  const gT = group(tEff.join('\n'))
  const multisetEq = (a, b) => {
    if (a.length !== b.length) return false
    const ca = counter(a.join('\n'))
    const cb = counter(b.join('\n'))
    for (const [l, n] of ca) if ((cb.get(l) || 0) !== n) return false
    return true
  }
  for (const [k, bLines] of gB) {
    const oLines = gO.get(k) || []
    const tLines = gT.get(k) || []
    if (tLines.length === 0) continue
    if (bLines.length !== tLines.length) continue
    if (!multisetEq(bLines, oLines)) continue
    if (multisetEq(bLines, tLines)) continue
    // 同号**两个不同议题**(并发取号撞上的)不是就地改写:两侧各是一件活着的登记,
    // 折掉哪一侧都是替别人删事。判"是不是同一件事"的尺子只许有一份,故复用 merge-live-doc
    // 那把字符二元组 Jaccard 与同源阈值(按词切在 CJK 混排行上会断崖下跌,该层头注已记过)。
    const sim = jaccard(
      tokenize(stripState(bLines.join('\n'))),
      tokenize(stripState(tLines.join('\n'))),
    )
    if (sim < SIM_THRESHOLD) continue
    const ct = counter(tLines.join('\n'))
    for (const [l, n] of counter(bLines.join('\n'))) {
      const dropped = n - (ct.get(l) || 0)
      if (dropped > 0) caps.set(l, (caps.get(l) || 0) + dropped)
    }
  }
  return caps
}

/** 行级 union:以本侧顺序为脊柱,把对侧**相对基底新增、且未被搬运感知代表**的重数补在末尾。 */
export function unionLines(oursText, theirsText, baseText = null, suppress = null) {
  const want = liveDocExpectedCounts(oursText, theirsText, baseText, suppress)
  // 脊柱裁剪:期望表已按改写折叠下调过的行,这里必须真把多出来的份数从本侧脊柱里去掉,
  // 否则"折叠"只存在于断言侧而产出面仍是双份 —— 那等于 F9 判据看不见、落地闸却对着一个不存在的数红。
  const remove = new Map()
  const coAll = counter(oursText)
  for (const [l, n] of coAll) {
    const over = n - (want.get(l) || 0)
    if (over > 0) remove.set(l, over)
  }
  const spine = []
  for (const l of oursText.split('\n')) {
    const r = remove.get(l) || 0
    if (r > 0) {
      remove.set(l, r - 1)
      continue
    }
    spine.push(l)
  }
  const out = spine
  const need = new Map(want)
  for (const [l, n] of counter(oursText)) need.set(l, (need.get(l) || 0) - n)
  // 逐行消费时也要按同一张抑制表计数,否则"该少带的那一份"会从末尾漏回来。
  const left = new Map(suppress || [])
  const extra = []
  for (const l of theirsText.split('\n')) {
    const suppressed = left.get(l) || 0
    if (suppressed > 0) {
      left.set(l, suppressed - 1)
      continue
    }
    if (l === '') continue // 空行不参与补回:与 liveDocExpectedCounts 同一条规矩(理由见其头注)
    const k = need.get(l) || 0
    if (k > 0) {
      extra.push(l)
      need.set(l, k - 1)
    }
  }
  const res = out.concat(extra).join('\n')
  const cr = counter(res)
  for (const [l, n] of want)
    if ((cr.get(l) || 0) < n) throw new Error(`行 union 丢行:${l.slice(0, 60)}`)
  return res.endsWith('\n') ? res : res + '\n'
}

/**
 * 对一份活文档算搬运感知抑制表。**内容一律取自被审面**:占位读 `oursRev`(= 基准面),
 * 归档件也读同一个 `oursRev` 的同一轮 `catBatch` —— 表与内容分面取 = 造出自洽却错位的尺子。
 * 取不到(整批失败)⇒ `suppress:null` 并记一条未判定,**绝不当作"已归档"**。
 * @returns {{suppress:Map<string,number>|null, suppressedBlocks:Array, keptBlocks:Array,
 *   undetermined:Array, stats:object, archives:number, fetchError:string|null, doc:string}}
 */
export function moveAwareForDoc(doc, oursText, theirsText, oursRev, cwd = ROOT) {
  const empty = {
    doc,
    suppress: null,
    suppressedBlocks: [],
    keptBlocks: [],
    undetermined: [],
    archives: 0,
    fetchError: null,
    stats: { blocksMatched: 0, suppressedLines: 0, keptLines: 0, undeterminedCount: 0 },
  }
  // 快路径:本侧一份占位都没有 ⇒ 这一维结构上无事可做(不必解析对侧的块,省下整篇台账的解析)。
  if (!/<!--\s*已归档/.test(oursText)) return empty
  const paths = [...collectReferencedArchives(oursText, theirsText)]
  const specs = paths.map((p) => `${oursRev}:${p}`)
  let texts = new Map()
  let fetchError = null
  if (specs.length) {
    try {
      texts = catBatch(cwd, specs)
    } catch (e) {
      fetchError = String((e && e.message) || e).split('\n')[0].slice(0, 160)
    }
  }
  if (fetchError) {
    return {
      ...empty,
      archives: paths.length,
      fetchError,
      undetermined: [
        {
          title: '(整批归档件)',
          paths,
          reason: `取材面整批读不出 ⇒ 一律照旧取回,不得当成已归档:${fetchError}`,
        },
      ],
      stats: { blocksMatched: 0, suppressedLines: 0, keptLines: 0, undeterminedCount: 1 },
    }
  }
  const r = archivedLineSuppressions({
    oursText,
    theirsText,
    archiveOf: (p) => texts.get(`${oursRev}:${p}`) ?? null,
  })
  return {
    doc,
    suppress: r.suppress.size ? r.suppress : null,
    suppressedBlocks: r.suppressedBlocks,
    keptBlocks: r.keptBlocks,
    undetermined: r.undetermined,
    archives: paths.length,
    fetchError: null,
    stats: { ...r.stats, undeterminedCount: r.undetermined.length },
  }
}

/** 缓存版:同一轮 build/verify 必须用**同一张表**(判据与断言不同形会把工具自己锁死,见 verifyUnion 注)。 */
function moveAwareCached(cache, doc, oursText, theirsText, oursRev, cwd) {
  if (cache && cache.has(doc)) return cache.get(doc)
  const r = moveAwareForDoc(doc, oursText, theirsText, oursRev, cwd)
  if (cache) cache.set(doc, r)
  return r
}


/** 构造合并树。临时索引走 §26 的夹具唯一落点 `mkScratch` ——
 *  硬编码 `cwd/.ihui-agent/tmp` 会在"对临时仓库做取证"时直接 ENOENT(自检第一轮即如此),
 *  而且把夹具写进仓库树内还会让 git 的 toplevel 向上逃逸。
 *  返回 needHuman(冲突/二进制/取不到 mode ⇒ 交人工)与 violations(两侧同改的丢行断言),
 *  两者都在本函数里算:归并结果的内容此刻已在手上,不必再派生一次 git 去重读。 */
export function buildUnion(
  base,
  ours,
  theirs,
  cwd = ROOT,
  takeOurs = new Set(),
  resolutions = new Map(),
  moveAwareCache = null,
  takeTheirs = new Set(),
  accepted = null,
) {
  const scratch = mkScratch('union-idx')
  const idx = join(scratch, 'index')
  try {
    const env = { ...process.env, GIT_INDEX_FILE: idx }
    const run = (args) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args], {
        cwd,
        env,
        windowsHide: true,
        // 根治:同 git() —— 无 input,stdin 设 ignore 避开本会话子进程 stdin 管道 EBUSY。
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: GIT_TIMEOUT,
        encoding: 'utf8',
        maxBuffer: 512 * 1048576,
      }).trim()
    // ⚠️ `violations` 必须在**活文档归并循环之前**声明:1) 里的状态分叉判据(2026-09-28 补的那一格)
    // 就往里 push,而下面 2) 的那批清单声明得更晚 —— 放在那里会让本函数在带 PROJECT_PLAN.md 冲突的
    // 每一次调用上抛 `Cannot access 'violations' before initialization`(ReferenceError),
    // 表现是"union-converge 亦判需人工",而真实原因是**这台收敛器当场崩了**。
    // 崩溃被上层当成人工判定 ⇒ 所有会话的台账冲突都收敛不动、发布链卡死。自检补了一条
    // "两侧同改台账 ⇒ 必须产出 plan(不抛)"的用例钉住这条路径。
    const violations = []
    // 声明式放行过的量纲(必须一路交回调用方打印并写进合并提交信息,不能只在内存里"放过")。
    // 声明位置在 1) 之前:活文档那一条循环就要往里 push —— 挂在下面 2) 的累加器群里会撞 TDZ。
    const acceptedGrowth = []
    run(['read-tree', ours])

    // 1) 活文档:三方行 union(对侧相对基底的**独有行**必须存活;本侧就地改写的行不得被旧副本复活;
    //    本侧已有 `已归档` 占位代表的行不得再从对侧取回 —— 见 lib/ledger-move-aware.mjs 头注)
    const liveDocs = []
    for (const p of LIVE_DOCS) {
      const a = show(ours, p, cwd)
      const b = show(theirs, p, cwd)
      if (a === b) continue
      const bt = base ? show(base, p, cwd) : null
      const ma = moveAwareCached(moveAwareCache, p, a, b, ours, cwd)
      liveDocs.push(ma)
      const mergedText = unionLines(a, b, bt, ma.suppress)
      // 根治(2026-09-30):--stdin 通道要求真 stdin 管道(本会话建管道必 EBUSY)⇒ 改走
      // writeBlob 临时文件通道,同 --path 语义、同 blob SHA(该函数头注有 CRLF 等价实证)。
      const oid = writeBlob(mergedText, p, cwd)
      run(['update-index', '--add', '--cacheinfo', `100644,${oid},${p}`])
      /**
       * 状态分叉判据**必须挂在这条路上**,而不是挂在下面 2) 的 `mergedClean` 循环里 ——
       * 2) 开头就有 `if (LIVE_DOCS.includes(p)) continue`,而台账正是活文档,所以那条循环
       * **永远不会**拿到 PROJECT_PLAN.md。2026-09-28 那次半成品把判据函数与自检都写全了、
       * `--self-test` 13 条全绿,而它在收敛落地路径上**生效次数为 0**(判据在、自检过、没人调,
       * 守门 70/76/81/105/115 同族)。今天补的这一格才是"落地前自证清单"真正咬合的地方:
       * 并集策略("每行重数取 max")本身就是状态副本的产地。
       * 下面 2) 那条同名循环保留:它覆盖的是**别的目录里**恰好以 PROJECT_PLAN.md 结尾、
       * 且两侧同改走了三方归并的文件(根台账归本条管,两者不重叠、不双计)。
       */
      if (p.endsWith('PROJECT_PLAN.md')) {
        const sides = [bt, a, b].filter((t) => typeof t === 'string' && t !== '')
        const __rg = planStateRegressions(mergedText, sides, accepted, {
          suppress: ma.suppress,
          baseText: bt,
          oursText: a,
        })
        for (const msg of __rg) violations.push(`${p} 归并放大任务状态分叉:${msg}`)
        for (const msg of __rg.accepted || []) acceptedGrowth.push(msg)
        console.log(`   ${f3ExitCaliber(mergedText, sides)}`)
        const __cl0 = mergeNoteCrossLineCaliber(mergedText, sides)
        if (__cl0) console.log(`   ${__cl0}`)
      }
    }

    // 2) 对侧「相对共同基底自己动过」的路径:仅对侧动过 ⇒ 取对侧版本;两侧同改 ⇒ 真三方归并。
    //    (活文档已在 1) 归并,两条路都不整体覆盖)
    const tookTheirs = []
    const mergedClean = []
    const skippedDeletes = []
    // 票 G-977960 ②(用户拍板):「删除活不过合并」的对症格 —— 本轮**随合并生效**的对侧删除,逐路径点名。
    const propagatedDeletes = []
    const needHuman = []
    const generatedDeferred = [] // 生成物冲突:不判人工、不选边,登记"待重生成"(见 G-814415)
    const keptOurs = []
    const keptTheirs = []
    const humanResolved = []
    const caps = [] // 因副本指针有意少带的份数:不拦落地,但必须逐条点名(见 recordSideLosses)
    // 影子 .js 的两格(见下面循环里那条"刻意例外"):随合并传播掉的删除 / 被拦住没恢复的回归。
    const shadowDeletes = []
    const shadowRestores = []
    const touchedOurs = new Set(diffNames(base, ours, cwd))
    for (const p of diffNames(base, theirs, cwd)) {
      if (LIVE_DOCS.includes(p)) continue
      const theirsBlob = blobOf(theirs, p, cwd)
      const oursBlob = blobOf(ours, p, cwd)
      if (oursBlob === theirsBlob) {
        // 两侧同删(p 能进本循环说明 theirsBlob===null ⇒ 基底必有它):删除无争议地活着,
        // 但仍要点名 —— 票 G-977960 ② 的"逐路径报名"要求报告能完整回答
        // "这轮合并里哪些路径因删除而消失",静默的存活等于下一次还要重新取证一遍。
        if (theirsBlob === null) propagatedDeletes.push(p)
        continue
      }
      if (theirsBlob === null) {
        /**
         * **影子 .js 的删除要传播**,这一条是对"对侧删除不随合并传播"那条通则的**刻意例外**。
         * 依据不是猜测而是内容寻址:本侧那份 `.js` 的 blob oid 与本侧同 stem `.ts` 的 oid **逐字相等**
         * ⇒ 两边装的是同一份字节,删掉它不可能丢任何内容。不堵这一格,实测就会看到
         * 同一份"用 .js 文件名装着 TypeScript 语法"的影子被对侧一次带走、下一次合并又带回来
         * (2026-09-29 一天内两次:01:12 删、04:27 回;后果是干净检出/服务重启即 `SyntaxError`,
         * 而守门 98 的 D4 影子维是全仓唯一看得见这一型的尺子 —— 它只能事后喊,拦不住合并)。
         * 只认 `.js/.cjs/.mjs → .ts/.tsx` 这一个方向:反过来(留 .js 扔 .ts)等于把本仓
         * "`./x.js` 说明符指的是 `.ts`"这条约定倒过来写,那不是收口而是制造第二份真相。
         */
        const twin = shadowTwinOf(p, oursBlob, ours, cwd)
        if (twin) {
          run(['update-index', '--force-remove', p])
          shadowDeletes.push({ path: p, twin: twin.path })
          continue
        }
        // 票 G-977960 ②(2026-10-07 落地):「该路径的删除已是合并结果的祖先 ∧ 两侧相对删除点都未改动过它」
        // ⇒ 传播删除 —— 这正是 git 三方合并自身的语义,可证不丢内容:被删掉的字节就是基底那一份,
        // 本侧从未改过它(逐字同一 blob)⇒ 删除方对这一路径的处置权成立,不再默认折回。
        // 本侧**改过**的(modify/delete 分叉)照旧不传播:处置权归改写方 —— 删除是旧信息,改写是新工作。
        // 两种处置都必须像影子 .js 那一格一样逐路径报名,绝不静默。
        // 失效方向:取不到基底 ⇒ 不传播(多留一份,复核可再删);绝不反向(误删别人的工作不可恢复)。
        const delBase = base ? blobOf(base, p, cwd) : null
        if (delBase && (oursBlob === null || oursBlob === delBase)) {
          if (oursBlob !== null) run(['update-index', '--force-remove', p])
          propagatedDeletes.push(p)
          continue
        }
        skippedDeletes.push(p) // 对侧删除 ∧ 本侧对该路径有独有改动 ⇒ 不传播(处置权归改写方),仍逐条点名
        continue
      }
      // 本侧未动(或本侧已删 ⇒ 删除同样不传播,与"对侧删除"对称)⇒ 整文件取对侧,语义与改前逐字一致
      if (!touchedOurs.has(p) || oursBlob === null) {
        // 同一个例外的反方向:对侧把那份等值影子**带回来**时不取(本侧已经没有它了)。
        const twin = shadowTwinOf(p, theirsBlob, ours, cwd)
        if (twin) {
          shadowRestores.push({ path: p, twin: twin.path })
          continue
        }
        run(['update-index', '--add', '--cacheinfo', `100644,${theirsBlob},${p}`])
        tookTheirs.push(p)
        continue
      }
      // 两侧都动过:旧写法在这里"整文件取对侧",即静默丢掉本侧改动 —— 必须走真三方
      //
      // 但"真三方"只会在两侧改动互相重叠时报冲突,而**报冲突不等于必须交人工**:
      // 若本树的内容已经让对侧那一版判据必红(实测:对侧留着"brand 里不得再有 CTA 档"
      // 的回归锁,而 design-tokens 只有本侧改过、合并树必然含 brand.cta ⇒ 那条锁 100% 失败),
      // 那么"取本侧"不是选边,而是被内容强制的唯一解。此判断不能悄悄做 —— 必须由操作者
      // 显式声明 --take-ours <path>,并写进合并提交信息与输出,留下可追责的取证入口。
      if (takeOurs.has(p)) {
        keptOurs.push(p)
        continue
      }
      // 对称的那一格(2026-09-28 补):两侧同一个功能各写一份、且**同一行被两种写法改写**时,
      // `--resolve` 的零损失断言结构上喂不进去(两侧独有行都留 ⇒ 同名声明重复 ⇒ 编译不过),
      // 于是这类合并永远"需人工"。缺的不是判断,是**声明式出口**:让持有裁决的人
      // 显式说"这一路径本侧是被取代的那一份",整文件取对侧并大声留痕。
      // 与 `--take-ours` 同一条纪律:必须逐条声明、必须打进输出与提交信息,不得默认。
      if (takeTheirs.has(p)) {
        run(['update-index', '--add', '--cacheinfo', `100644,${theirsBlob},${p}`])
        keptTheirs.push(p)
        continue
      }
      const mode = modeOf(ours, p, cwd)
      if (mode !== '100644' && mode !== '100755') {
        needHuman.push({
          path: p,
          kind: 'mode',
          detail: `非普通文件(mode=${mode || '未取到'}),不做文本三方归并`,
        })
        continue
      }
      const baseBlob = blobOf(base, p, cwd) ?? emptyBlob(cwd)
      if (baseBlob === null) {
        needHuman.push({
          path: p,
          kind: 'error',
          detail: '共同基底侧与空 blob 都取不到,无法三方归并',
        })
        continue
      }
      const m = mergeThreeBlobs(baseBlob, oursBlob, theirsBlob, cwd)
      if (!m.ok) {
        // 人工判必须有**受支持的出口**(2026-09-26 立):旧写法只丢一句"请人工判",而人工判完
        // 没有任何回灌路径 —— 于是人只能去做裸 git 手术(read-tree/commit-tree/update-ref),
        // 绕过本工具的全部断言。"只判不修"的门逼人绕过,这条对**工具自己**同样成立。
        // 出口是 `--resolve <path>=<文件>`:人工写好的整份内容。**但它不是选边的别名** ——
        // 喂进去的内容照样过"两侧独有行不得减少"的断言,少了哪一侧就当场 violations。
        const viaFile = resolutions.get(p)
        if (!viaFile) {
          /**
           * 生成物路径(G-814415):两侧各自从各自词源重生成 ⇒ 独有行是**互斥的同形替代**,
           * 任何合法内容都不可能同时含两侧 ⇒ "两侧独有行不得减少"这条锁在这一型路径上永无解,
           * 后果不是这一项判不了,而是**整枚合并卡住**(其余 12 个可合路径一起躺在后面)。
           * 生成物的权威在"重生成"而不是"合并",所以这里的正确处置是:按本侧内容留下、
           * **点名登记为待重生成**、让其余路径照常落地 —— 并在提交信息里带上这份清单,
           * 免得"落地了"被读成"内容已对齐"。非生成物路径一律照旧走 needHuman(反向锁由自检钉住:
           * 这条分支绝不能变成新的选边后门)。
           */
          const marker = generatedArtifactMarker([
            blobText(oursBlob, cwd),
            blobText(theirsBlob, cwd),
          ])
          if (marker) {
            generatedDeferred.push({ path: p, marker, detail: m.detail })
            mergedClean.push(p)
            continue
          }
          needHuman.push({ path: p, kind: m.kind, detail: m.detail })
          continue
        }
        let text = null
        try {
          text = readFileSync(viaFile, 'utf8')
        } catch (e) {
          needHuman.push({
            path: p,
            kind: 'resolve-unreadable',
            detail: `--resolve 的文件读不到:${viaFile}(${String(e.message).split('\n')[0]})`,
          })
          continue
        }
        const buf = Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8')
        const oid = writeBlob(buf, p, cwd)
        if (oid !== oursBlob)
          run(['update-index', '--add', '--cacheinfo', `${mode},${oid},${p}`])
        mergedClean.push(p)
        humanResolved.push(p)
        const [baseText, oursText, theirsText] = [
          blobText(baseBlob, cwd),
          blobText(oursBlob, cwd),
          blobText(theirsBlob, cwd),
        ]
        recordSideLosses(
          lostAddedLines(baseText, oursText, theirsText, text),
          `${p} 人工归并结果丢本侧独有行`,
          violations,
          caps,
        )
        recordSideLosses(
          lostAddedLines(baseText, theirsText, oursText, text),
          `${p} 人工归并结果丢对侧独有行`,
          violations,
          caps,
        )
        continue
      }
      const oid = writeBlob(m.buf, p, cwd)
      if (oid === oursBlob) continue // 归并结果与本侧一致 ⇒ 连 mode 一起保持本侧条目
      run(['update-index', '--add', '--cacheinfo', `${mode},${oid},${p}`])
      mergedClean.push(p)
      const [baseText, oursText, theirsText, mergedText] = [
        blobText(baseBlob, cwd),
        blobText(oursBlob, cwd),
        blobText(theirsBlob, cwd),
        m.buf.toString('utf8'),
      ]
      recordSideLosses(
        lostAddedLines(baseText, oursText, theirsText, mergedText),
        `${p} 两侧同改后本侧独有行丢失`,
        violations,
        caps,
      )
      recordSideLosses(
        lostAddedLines(baseText, theirsText, oursText, mergedText),
        `${p} 两侧同改后对侧独有行丢失`,
        violations,
        caps,
      )
    }
    const tree = run(['write-tree'])
    // ── 任务状态分叉不得被归并放大(2026-09-26 立,守门 130 的同一条判据长在这里)──────────
    // 为什么必须在落地闸里判,而不是等提交链:本收敛器用 commit-tree 造合并提交,
    // **pre-commit 根本不跑**;而"每行重数取 max"的并集策略恰恰就是状态副本的产地
    // (同一件事被两侧各写一份、一份已勾一份未勾 ⇒ 合并结果两行并存)。
    // 所以判据放在提交链看不见的这一环上,否则"不再发生"这句话在收敛路径上是空的。
    for (const p of mergedClean) {
      if (!p.endsWith('PROJECT_PLAN.md')) continue
      const mergedOid = run(['rev-parse', `${tree}:${p}`])
      const sideTexts = [base, ours, theirs]
        .map((rev) => blobOf(rev, p, cwd))
        .filter((oid) => oid)
        .map((oid) => blobText(oid, cwd))
      const __cal = f3ExitCaliber(blobText(mergedOid, cwd), sideTexts)
      if (__cal) console.log(`   ${__cal}`)
      const __cl = mergeNoteCrossLineCaliber(blobText(mergedOid, cwd), sideTexts)
      if (__cl) console.log(`   ${__cl}`)
      const __sideBlobs = [base, ours, theirs].map((rev) => blobOf(rev, p, cwd)).map((oid) => (oid ? blobText(oid, cwd) : null))
      const __rg2 = planStateRegressions(blobText(mergedOid, cwd), sideTexts, accepted, {
        suppress: null,
        baseText: __sideBlobs[0],
        oursText: __sideBlobs[1],
      })
      for (const msg of __rg2) violations.push(`${p} 归并放大任务状态分叉:${msg}`)
      for (const msg of __rg2.accepted || []) acceptedGrowth.push(msg)
    }
    return {
      tree,
      tookTheirs,
      acceptedGrowth,
      mergedClean,
      skippedDeletes,
      propagatedDeletes,
      shadowDeletes,
      shadowRestores,
      needHuman,
      generatedDeferred,
      keptOurs,
      keptTheirs,
      humanResolved,
      violations,
      caps,
      liveDocs,
    }
  } finally {
    rmScratch(scratch, { bestEffort: true })
  }
}

/** 逐路径列出 <rev> 的 blob oid(供"按内容判移动"用)。ls-tree -r 的格式是
 *  `<mode> <type> <oid>\t<path>`,mode 可能是 120000(symlink)/ 160000(gitlink),一律如实带上。 */
function oidMap(rev, cwd) {
  const out = git(['ls-tree', '-r', rev], cwd)
  const m = new Map()
  for (const line of out.split('\n').filter(Boolean)) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const oid = line.slice(0, tab).split(' ')[2]
    if (!oid) continue
    if (!m.has(oid)) m.set(oid, [])
    m.get(oid).push(line.slice(tab + 1))
  }
  return m
}

/** 零丢失自证(路径面 + 活文档行面)。返回违规清单,空 = 可落地。
 *  两侧同改的"独有行不丢"断言在 buildUnion 里(结果内容当场在手),由 plan 合并进同一道闸。
 *
 *  「对侧路径在合并树里找不到」有三种截然不同的成因,必须分开口径(2026-09-25 实测:
 *  旧写法把第一种也判成吞并,于是收敛永远落不了地,而落地不了就等于各会话继续往 main 堆提交):
 *    ① 本侧移动且内容逐字节未变 —— 同一 blob 在本侧另一路径上存在 ⇒ 按移动放行;
 *    ② 本侧移动/删除,且**对侧相对基底根本没改这一路径**(theirs blob == base blob)——
 *      这一路径的处置权按定义属于本侧(合并基底是本侧整棵树),放行;
 *      它不弱化守门 100 的立罪面:A1 只管"某父提交有 ∧ 共同基底没有"的新增路径,
 *      而②的前提恰恰是"基底里有",属本侧对既有路径的改名/搬家/删除;
 *    ③ 真吞并 —— 对侧改过(或基底没有)而内容在合并树里无处可寻 ⇒ 判红,不落地。
 *  ①② 一律逐条进 `bad.moved` 并在结论行点名,绝不静默成"0 处"。 */
export function verifyUnion(
  ours,
  theirs,
  tree,
  cwd = ROOT,
  base = null,
  moveAwareCache = null,
) {
  const M = new Set(listPaths(tree, cwd))
  const bad = []
  const moved = []
  const pointerCaps = []
  const moveAware = []
  for (const p of listPaths(ours, cwd)) {
    if (M.has(p)) continue
    /**
     * "零损失"断言的**内容寻址豁免**(不是白名单、不信任调用方给的清单):
     * 本侧这个路径没进合并结果,但它那份字节在合并树里由同 stem 的 `.ts/.tsx` **同一个 blob oid**
     * 承载 ⇒ 内容一行都没少,少的是那个多余的影子文件名,这正是收口。
     * 与下面"对侧丢失"分支里早已有的 blob 移动豁免(1046 行 `moved`)是同一条证明的两半 ——
     * 本侧这一半此前缺,于是"影子删除被传播"会被自己的零损失断言判成丢内容,合并落地不了。
     * 只有 blob oid 逐字相等才走这一支;内容不等值 ⇒ 照旧 `bad`(自检影子 C 臂钉住)。
     */
    const oid = blobOf(ours, p, cwd)
    const sibOids = {}
    for (const s of shadowTsSiblings(p)) sibOids[s] = blobOf(tree, s, cwd)
    const twin = shadowTwinIsIdentical(p, oid, sibOids)
    if (twin) {
      moved.push(
        `${p} 的字节由 ${twin.path} 同一个 blob(${String(oid).slice(0, 9)})承载 ⇒ 合并结果不含它属收口,不是丢失`,
      )
      continue
    }
    // 票 G-977960 ② 的对称豁免:对侧相对基底删除了它 ∧ 本侧那份逐字等于基底 ⇒ 删除随合并传播,
    // 处置权归删除方。与下面 theirsLost 环里早已有的「本侧已移动或删除;对侧相对基底未改动 ⇒ 处置权归本侧」
    // 是同一条内容寻址证明的另一半 —— 被删的字节就是基底字节,没有任何一侧的独有工作消失。
    // 取不到基底 ⇒ 豁免不成立,照旧判红(失效方向 = 多拦,绝不把真吞并洗成传播)。
    if (base) {
      const delBaseOid = blobOf(base, p, cwd)
      if (delBaseOid && delBaseOid === oid && blobOf(theirs, p, cwd) === null) {
        moved.push(`${p}(对侧已删除;本侧相对基底未改动这一路径 ⇒ 删除随合并传播,零丢失由逐字同一 blob 证明)`)
        continue
      }
    }
    bad.push(`合并树丢了本侧路径 ${p}`)
  }
  const theirsLost = listPaths(theirs, cwd).filter((p) => !M.has(p))
  if (theirsLost.length) {
    const oursOids = oidMap(ours, cwd)
    const treeOids = oidMap(tree, cwd)
    for (const p of theirsLost) {
      const oid = blobOf(theirs, p, cwd)
      const landed = oid && treeOids.get(oid)
      const carried = oid && oursOids.get(oid)
      const to = landed && carried && landed.find((q) => q !== p && carried.includes(q))
      if (to) {
        moved.push(`${p} → ${to}(本侧移动,内容逐字节同一 blob)`)
        continue
      }
      const baseOid = base ? blobOf(base, p, cwd) : null
      if (baseOid && baseOid === oid) {
        moved.push(`${p}(本侧已移动或删除;对侧相对基底未改动这一路径 ⇒ 处置权归本侧)`)
      } else {
        bad.push(`合并树丢了对侧路径 ${p}`)
      }
    }
  }
  for (const p of LIVE_DOCS) {
    const a = show(ours, p, cwd)
    const b = show(theirs, p, cwd)
    if (a === null || b === null) {
      bad.push(`${p} 落地后取不到(本侧或对侧任一面读不出 = 无法自证,不记通过)`)
      continue
    }
    const bt = base ? show(base, p, cwd) : null
    // 断言必须用**同一个期望表**(liveDocExpectedCounts),不得各写一份:
    // 上一版这里仍是旧的 max(本侧,对侧),于是三方化之后每一枚"本侧改写过别人的行"的合并
    // 都被落地闸判成"丢了 12 行"而拒绝落地 —— 判据与实现不同形时,工具会把自己锁死。
    // 搬运感知同一道理:抑制表若只在归并侧生效、断言侧不认,落地闸就会把"合法未取回"判成丢行。
    const ma = moveAwareCached(moveAwareCache, p, a, b, ours, cwd)
    moveAware.push(ma)
    const want = liveDocExpectedCounts(a, b, bt, ma.suppress)
    const mTree = show(tree, p, cwd)
    const m = counter(mTree)
    // 少带的份数在这一条路径上同样必须点名(本票防的就是"台账被静默少带")
    const docCaps = bt === null ? [] : liveDocPointerCaps(bt, [a, b], mTree)
    if (docCaps.length) pointerCaps.push({ doc: p, capped: docCaps })
    for (const [l, n] of want)
      if ((m.get(l) || 0) < n) bad.push(`${p} 未存活行:${l.slice(0, 50)}`)
    // 反向对照:本侧改写/删除过的行,合并树里的**重数**不得高于期望表 ——
    // 不能判">0 即复活":活文档里同一行常有真实多份(台账登记行就是如此,实测 D38 有 4 份),
    // 判存在会把"保住的那 3 份"误报成复活。第一版就被真仓咬出这一条。
    if (bt !== null) {
      const cb = counter(bt)
      const ca = counter(a)
      for (const [l, n] of cb) {
        if ((ca.get(l) || 0) >= n) continue // 本侧留着它 ⇒ 不是改写/删除
        if ((m.get(l) || 0) > (want.get(l) || 0))
          bad.push(
            `${p} 旧行被复活(本侧已改写/删除):重数 ${m.get(l)} > 期望 ${want.get(l) || 0} —— ${l.slice(0, 50)}`,
          )
      }
    }
  }
  bad.moved = moved
  bad.pointerCaps = pointerCaps
  bad.moveAware = moveAware
  return bad
}

/** 活文档路径的"因指针有意少带"计数(与 `lostAddedLines` 同一个形状,但那里按两侧抵扣;
 *  活文档走 `verifyUnion` 的 LIVE_DOCS 环,不经过那两个分支 —— 少带必须在**这条路径**上也被点名,
 *  否则本票最要紧的那一族(台账)反而无人报(2026-09-29 端到端 cap 第三条当场抓到)。
 *  一份都不剩的行**不进这里** —— 那是真丢失,由"未存活行"那条判据拦。 */
export function liveDocPointerCaps(baseText, sideTexts, mergedText) {
  const cm = counter(mergedText)
  const cb = counter(baseText)
  const caps = []
  for (const sideText of sideTexts ?? []) {
    const cs = counter(sideText)
    for (const [l, n] of cs) {
      if (l === '' || !DUP_POINTER_RE.test(l)) continue
      const added = n - (cb.get(l) || 0)
      if (added <= 0) continue
      const have = cm.get(l) || 0
      if (have < 1) continue
      if (have < added) caps.push({ line: l, dropped: added - have })
    }
  }
  return caps
}

/** 把一次"两侧独有行不得减少"断言的产物分流:真丢行进 `violations`(拦落地);
 *  因副本指针有意少带进 `caps`(不拦,但必须逐条点名)。四个调用点必须同形 ⇒ 只许有这一个出口。 */
function recordSideLosses(lost, label, violations, caps) {
  for (const l of lost) violations.push(`${label}:${String(l).slice(0, 60)}`)
  const capped = lost.pointerCapped ?? []
  if (capped.length) caps.push({ label, capped })
}

/**
 * 把"因搬运感知而未取回"这一维排成人读行(纯函数,输入就是 plan() 的 `moveAware` 清单)。
 * 三态必须分开、绝不并桶:
 *  - `suppressedBlocks` —— 拿得到内容证据、**合法不取回**的条目块(逐块报行数与出处归档件);
 *  - `keptBlocks` —— 占位在、但块与归档件不逐行连续(= 之后被就地改写)⇒ 照旧取回,并报为什么;
 *  - `undetermined` —— 归档件取不到 / 块边界对不上 / 整批取材失败 ⇒ **照旧取回**并喊未判定,
 *    绝不静默当成已归档(把"没判"写成"判过了"是本仓最高频失效型)。
 */
export function formatMoveAwareReport(list, { detail = false, maxEntries = 25 } = {}) {
  const out = []
  for (const ma of list ?? []) {
    const s = ma.stats ?? {}
    const blocks = ma.suppressedBlocks ?? []
    const kept = ma.keptBlocks ?? []
    const und = ma.undetermined ?? []
    if (!s.blocksMatched && !kept.length && !und.length) continue
    out.push(
      `  · ${ma.doc} 因搬运感知未取回 ${s.suppressedLines || 0} 行` +
        `(基准面已有 \`已归档\` 占位代表的条目块 ${blocks.length} 个 / 读过归档件 ${ma.archives || 0} 份;` +
        `另有 ${kept.length} 块不逐字同形 ⇒ 照旧取回、${und.length} 块未判定 ⇒ 照旧取回)`,
    )
    const showAll = detail ? blocks.length : Math.min(blocks.length, maxEntries)
    for (const e of blocks.slice(0, showAll))
      out.push(`      - 未取回 ${e.suppressed} 行 ← 条目「${e.title}」代表于 ${e.archivePath}`)
    if (blocks.length > showAll)
      out.push(
        `      …其余 ${blocks.length - showAll} 个条目块未逐条打印(计数已含;加 --move-aware-detail 全列)`,
      )
    if (detail)
      for (const e of blocks) for (const l of e.lines) out.push(`        │ ${String(l).slice(0, 120)}`)
    for (const k of kept)
      out.push(`      · 照旧取回 ${k.lines} 行 ← 条目「${k.title}」:${k.reason}`)
    for (const u of und)
      out.push(`      ⚠️ 未判定 ⇒ 照旧取回 ← 条目「${u.title}」:${u.reason}`)
  }
  return out
}

/**
 * 某枚 commit 的对象在不在本机。**ls-remote 只问引用、不下载对象**(§5b),所以"拿到了远端
 * sha"与"能对它跑 merge-base"是两件事:2026-09-28 同一窗口踩到两次 —— `merge-base --is-ancestor
 * <远端sha> HEAD` 回 `fatal: Not a valid commit name …`,而本器把它读成"不是祖先"继续往下,
 * 直到 `plan()` 里那句 `merge-base` 抛 Node 堆栈,账面表现为"工具坏了"而不是"你还差一次 fetch"。
 * 本器绝不代跑 fetch(网络动作与 ref 写入的归属留给调用方),只把这一维显式判出来。
 */
export function hasCommit(sha, cwd = ROOT) {
  if (!/^[0-9a-f]{7,40}$/.test(String(sha || ''))) return false
  return (
    spawnSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'cat-file', '-e', `${sha}^{commit}`], {
      cwd,
      windowsHide: true,
      // 根治:同 git-sync-converge.mjs —— 本会话 Node 建子进程 stdin 管道会 EBUSY,git 不吃 stdin。
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
      encoding: 'utf8',
    }).status === 0
  )
}

/**
 * 「本器没资格判」那一支的**唯一出路文案出口**(G-473 收口)。
 *
 * 为什么要单列成一份函数而不是在三个分支里各拼一句:调用方(git-sync-converge)按
 * `UNDETERMINED` 分流,而**人**按这三条出口办事 —— 三处各写一遍必然漂开,而漂开的表现是
 * "同一次故障,CLI 用户与 import 者拿到的指导不一样"(本仓"两处算同一件事必漂移"那一族)。
 *
 * 三条出口的**编号按种类固定,不随缺哪条而重排**:①=联网按分支 fetch、②=免联网显式喂可达 sha、
 * ③=ref 存续体检。R-B 依赖这一点:缺的是**本地 HEAD** 时 ① 结构上无效(fetch 回不来本机 HEAD 的
 * 对象,那是 gitdir/refs 受损),所以只发 ③ —— 编号若按位置重排,③ 就会被印成"出口①",
 * 读的人照它去 fetch,白跑一轮还以为是自己网络的问题。
 *
 * 一条硬约束(由 R-A 的反向锁钉死):**不得把"按 sha 直取"包装成可执行命令**。
 * 公共托管默认拒绝未公布对象,而那枚 sha 是否还公布着恰恰在并发高峰最先失效 ——
 * 给出去就是第二条"文档写了却跑不通的出路"(§26 那一族的禁令)。
 *
 * @param {object} o
 * @param {string[]} [o.missing]  本机取不到的 commit(对象不在本机那一型)
 * @param {string} [o.theirs]     本轮想合的目标
 * @param {string} [o.head]       本地 HEAD
 * @param {string} [o.branch]     被审仓库的当前分支名(detached 时 --abbrev-ref 回的 "HEAD" 不算)
 * @param {string|null} [o.noRemoteTruth]  远端当次真值根本没问到时的原因(那一型与"对象不在本机"不同因)
 * @returns {string} 多行文本,首行定性,其后逐行是出口
 */
export function unreachableObjectGuidance({
  missing = [],
  theirs = '',
  head = '',
  branch = '',
  noRemoteTruth = null,
} = {}) {
  // detached 仓库的 `--abbrev-ref HEAD` 回字面量 "HEAD",照抄会产出一条必败的 `fetch origin HEAD`
  // ⇒ 归一成占位,让人自己补(G-RG 的变异自证抓的就是这一步被"简化")。
  const b = branch && branch !== 'HEAD' ? branch : '<当前分支名>'
  const list = (Array.isArray(missing) ? missing : [missing]).filter(Boolean)
  const headMissing = list.length > 0 && !!head && list.includes(head)
  const out = []
  if (noRemoteTruth)
    out.push(
      `问不到远端当次真值:${String(noRemoteTruth).slice(0, 120)}(跟踪 ref 的残值不参与落槌 ⇒ 更不能据此说"已同步")`,
    )
  else if (headMissing)
    out.push(`本地 HEAD 的那枚对象都取不到(${String(head).slice(0, 11)}) ⇒ 这不是"少 fetch 一次",是 gitdir/refs 受损`)
  else {
    // 每枚取不到的 sha 都**按角色**报名:只给一串截断哈希,读的人分不清该 fetch 的是远端还是本机坏了。
    const role = (s) => (s === theirs ? '本轮目标' : s === head ? '本地 HEAD' : '另一枚对象')
    out.push(`对象不在本机(${list.map((s) => `${role(s)} ${String(s).slice(0, 11)}`).join(' / ')})`)
  }
  if (!headMissing) {
    out.push(`  出口① 联网取当次真值:git fetch origin ${b}(随后自行 rev-parse 复核,别信跟踪 ref 的残值)`)
    out.push(
      `  出口② 免联网:显式喂一枚本机已可达的目标 —— node scripts/union-converge.mjs --theirs <本机已可达的 sha>` +
        `(本器不代跑 fetch:网络动作与 ref 写入的归属留给调用方)`,
    )
  }
  out.push(
    `  出口③ ref 存续体检:node scripts/git-refs-heal.mjs --status,缺失即 node scripts/git-refs-heal.mjs` +
      `(§5b:嵌套 ref 会被清理层删掉,update-ref 对它还会假成功)`,
  )
  return out.join('\n')
}

/** 找一对需要合并的输入;skip 非空表示无事可做,undetermined 非空表示"这一步还没资格判"。 */
export function resolveTargets(theirsArg, cwd = ROOT) {
  const head = git(['rev-parse', 'HEAD'], cwd)
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  let theirs = theirsArg
  // "调用方有没有点名一枚 --theirs" 决定"本地纯落后"能不能当短路用(见下面那条注释)。
  const explicit = String(theirsArg || '').trim() !== ''
  if (!theirs) {
    try {
      // 远端位置只认**当次真值**(§5b:跟踪 ref 会被清理层删掉,packed-refs 里的旧值照样被读回来)。
      // 拿残值落槌有两种都不报错的错向:残值==本地 ⇒ 报"已同步"而根本不合并;残值落后 ⇒ 去合一个
      // 早已不存在的分叉。取不到就当"无法判定"交回上层,绝不猜一个 stage 用。
      // ⚠️ 这一支过去落 `skip`(⇒ CLI 打印"无需合并"并 exit 0),那是把"判不了"报成"无事可做":
      // 调用方据此跳过一整轮收敛,账面全绿而分叉永久留着。现在落 undetermined ⇒ exit 2。
      const r = resolveRemoteHead(branch, { root: cwd })
      if (!r.sha)
        return {
          head,
          theirs: '',
          skip: null,
          undetermined: unreachableObjectGuidance({ noRemoteTruth: r.reason, branch }),
        }
      theirs = r.sha
    } catch (e) {
      return {
        head,
        theirs: '',
        skip: null,
        undetermined: unreachableObjectGuidance({
          noRemoteTruth: `取远端异常:${String((e && e.message) || e).slice(0, 90)}`,
          branch,
        }),
      }
    }
  }
  if (theirs === head) return { head, theirs, skip: '已同步' }
  // 对象不在本机时,**任何祖先判据都不可信**:`isAncestor` 只因 cat-file 失败而回 false,于是
  // "已被本地包含 / 纯落后"两条一起被跳过,一路走到 plan() 的 merge-base 才抛 Node 堆栈
  // (G-473:读起来像工具坏了,而真相只是"还差一次 fetch")。这里显式判"未判定":
  // 既不冒红(它不是内容裁决,不该和真冲突混在一张单子上),也不记绿(它什么都没判)。
  const missing = [theirs, head].filter((s) => s && !hasCommit(s, cwd))
  if (missing.length)
    return {
      head,
      theirs,
      skip: null,
      undetermined: unreachableObjectGuidance({ missing, theirs, head, branch }),
    }
  if (isAncestor(theirs, head, cwd)) return { head, theirs, skip: '目标已被本地包含' }
  // ⚠️ "本地纯落后 ⇒ 交给 ff/converge"这一短路**只对"远端真值自动解析"那一支成立**。
  // 显式喂了 `--theirs` 却说这句是错的(G-815406 同族、G-814402 实测):调用方点名要合的那枚提交
  // 是不是已经在本地,只有 `isAncestor(theirs, head)` 能回答;而"本地落后于它"完全不等于
  // "无事可做"—— 它恰恰意味着**还差一次合并**。旧写法在这里 exit 0 并打印"无需合并",
  // 一次已验证的交付差点就这么没了(票面:复核的人都被那句合理话术劝退)。
  // 现在显式档照常走归并:落地闸仍然硬判"两侧路径零丢失",所以它不会比 ff 更危险,而它说真话。
  if (!explicit && isAncestor(head, theirs, cwd))
    return { head, theirs, skip: '本地纯落后 ⇒ 走 ff/converge,不用 union' }
  return { head, theirs, skip: null }
}

function isAncestor(a, b, cwd) {
  return (
    spawnSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'merge-base', '--is-ancestor', a, b], {
      cwd,
      windowsHide: true,
      // 根治:本会话 Node 建子进程 stdin 管道会 EBUSY,git 不吃 stdin。
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      encoding: 'utf8',
    }).status === 0
  )
}

export function plan(
  ours,
  theirs,
  cwd = ROOT,
  takeOurs = new Set(),
  resolutions = new Map(),
  takeTheirs = new Set(),
  accepted = null,
) {
  // 直接走 API 的调用方也必须拿到同一句诊断,而不是 git 的 "Not a valid commit name" 加一串堆栈
  // (G-473 ②:取不到要写成"未判定 + 出口",不得表现为工具故障)。CLI 那一支在 resolveTargets
  // 已经拦下,这条是给 import 者的 —— 两处判据与**两处出路文案**同一份实现(unreachableObjectGuidance),
  // 各写一遍的后果是"CLI 用户与 import 者拿到的指导不一样"。
  const miss = [ours, theirs].filter((s) => s && !hasCommit(s, cwd))
  if (miss.length) {
    let branch = ''
    try {
      branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
    } catch {
      /* 分支名问不到 ⇒ guidance 自己落占位,不因此改变"未判定"这一结论 */
    }
    throw new Error(
      `未判定:${unreachableObjectGuidance({ missing: miss, theirs, head: ours, branch })}`,
    )
  }
  const base = git(['merge-base', ours, theirs], cwd)
  // 一张抑制表同时喂归并与落地断言(分开算必漂移,而漂移的固定代价是"落地闸把合法未取回判成丢行")。
  const moveAwareCache = new Map()
  const built = buildUnion(
    base,
    ours,
    theirs,
    cwd,
    takeOurs,
    resolutions,
    moveAwareCache,
    takeTheirs,
    accepted,
  )
  // needHuman 同时进 bad:任何只看 bad 的调用方(含 git-sync-converge 之外的使用者)都不可能
  //   把一枚含冲突文件的树落地。冲突详情仍单独留清单,报告要点名到"是哪个文件"。
  const blocked = built.needHuman.map((h) => `${h.path} 需人工判(${h.kind}):${h.detail}`)
  const vu = verifyUnion(ours, theirs, built.tree, cwd, base, moveAwareCache)
  return {
    base,
    ...built,
    bad: [...built.violations, ...blocked, ...vu],
    // 两条路径的"少带份数"合流:两侧同改的丢行分流(built.caps)+ 活文档行 union(vu.pointerCaps)。
    // 只接其中一条 = 台账这一族恰好无人点名,而那正是本票要防的形状。
    caps: [
      ...(built.caps || []),
      ...vu.pointerCaps.map((c) => ({ label: `${c.doc} 活文档行 union`, capped: c.capped })),
    ],
    // 按移动放行的那些路径(内容级判据,见 verifyUnion 头注)—— 报告必须逐条点名
    movedPaths: vu.moved,
    // 「因搬运感知而未取回」这一维:逐条目块的行数 + 出处归档件 + 判不出/照旧取回的原因。
    // 报告必须能回答"你没带回 N 行,因为这 N 行在基准面已有 已归档 占位代表"。
    moveAware: [...moveAwareCache.values()],
  }
}

function selfTest() {
  const dir = mkScratch('ihui-union-')
  const run = (...a) => git(a, dir)
  const cases = []
  const ok = (n, c, note = '') => cases.push({ n, c, note })
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
    writeFileSync(join(dir, 'keep.ts'), 'k\n', 'utf8')
    // 本侧会把它 mv 成 moved-to.ts(先 mv 后 add,不是 git mv)—— 这是"旧路径在合并树里消失"
    // 的第二种成因,与守门 100 立罪的那种(内容真的没了)必须分开口径。
    writeFileSync(join(dir, 'moved-from.ts'), 'M\n', 'utf8')
    // ② 型夹具:本侧搬家**并改了内容**(相对基底),对侧原封不动 —— 真仓 2026-09-25 就是这个形态
    // (waiting-keys 用例从 packages/i18n/tests 挪进 packages/shared/tests/chat,顺手改了相对 import)
    writeFileSync(join(dir, 'edited-from.ts'), 'E\n', 'utf8')
    // ③ 型夹具:基底有、本侧删、**对侧改** —— 这是必须判红的真吞并(绝不能被①②的通道洗绿)
    writeFileSync(join(dir, 'theirs-edited.ts'), 'T0\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'init')

    // 本侧:新增一个模块 + 登记一行 + 把 moved-from.ts 挪到 moved-to.ts + 搬家并改内容 + 删掉对侧随后会改的那个
    writeFileSync(join(dir, 'mine.ts'), 'export const m = 1\n', 'utf8')
    writeFileSync(join(dir, 'moved-to.ts'), 'M\n', 'utf8')
    rmSync(join(dir, 'moved-from.ts'), { force: true })
    writeFileSync(join(dir, 'edited-to.ts'), 'E-changed\n', 'utf8')
    rmSync(join(dir, 'edited-from.ts'), { force: true })
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')

    // 对侧:从 init 分叉,另加一个模块、另一行,并删掉一个 init 就有的文件
    run('checkout', '-q', 'HEAD~1')
    run('branch', '-D', 'main')
    writeFileSync(join(dir, 'theirs.ts'), 'export const t = 1\n', 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n', 'utf8')
    writeFileSync(join(dir, 'theirs-edited.ts'), 'T1-modified\n', 'utf8')
    run('rm', '-q', 'keep.ts')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)

    const p = plan(ours, theirs, dir)
    ok('零丢失自证必须通过', p.bad.length === 0, p.bad.slice(0, 3).join(' / '))
    const paths = new Set(listPaths(p.tree, dir))
    ok('本侧独有新增不得丢', paths.has('mine.ts'))
    ok('对侧独有新增照收', paths.has('theirs.ts'))
    // 票 G-977960 ②(用户拍板):这一格的语义已从"删除不传播"改为"传播删除" ——
    // 对侧删 ∧ 本侧未动 ⇒ 合并树里不该再有它,且必须逐路径点名(不是静默吞掉)。
    ok(
      '② 对侧删除 ∧ 本侧未动 ⇒ 删除随合并生效(合并树里没有它,且逐路径点名)',
      !paths.has('keep.ts') && (p.propagatedDeletes || []).includes('keep.ts'),
      `paths.has(keep.ts)=${paths.has('keep.ts')} propagated=${JSON.stringify(p.propagatedDeletes)}`,
    )
    ok(
      'modify/delete 分叉之外不得再进"不传播"清单(keep.ts 不在其中的点名)',
      !p.skippedDeletes.includes('keep.ts'),
      JSON.stringify(p.skippedDeletes),
    )
    // 本侧 mv 走的那条路径:旧路径在合并树里消失,但内容以同一 blob 活在新路径上。
    // 这一类若按"吞并"判红,收敛就永远落不了地(2026-09-25 实测:门自己把一次合法改名拦成了死局);
    // 若不打勾点名,它又会变成任何人掩盖吞并的借口 —— 所以两头都要:放行 + 吼出来。
    ok(
      '本侧改名(mv 后 add)导致的旧路径消失按移动放行,并逐条点名',
      p.bad.length === 0 && p.movedPaths.some((m) => m.startsWith('moved-from.ts → moved-to.ts')),
      `bad=${p.bad.slice(0, 3).join(' / ')} moved=${(p.movedPaths || []).join(' / ')}`,
    )
    // ② 搬家**并改了内容**、对侧原封不动:合并树里旧路径消失不是吞并,处置权按定义归本侧。
    // 真仓 2026-09-25 的拦阻就是这一型 —— waiting-keys 从 i18n/tests 挪进 shared/tests/chat 时顺手改了
    // 相对 import,于是 blob 不再逐字节相等,旧判据把它当吞并,收敛落不了地。
    ok(
      '② 本侧搬家并改内容 ∧ 对侧相对基底未改 ⇒ 按移动放行(不判吞并)',
      p.movedPaths.some((m) => m.startsWith('edited-from.ts(') && m.includes('对侧相对基底未改动')),
      `moved=${(p.movedPaths || []).join(' / ')}`,
    )
    {
      // ③ 边界:同一条路径,本侧删 ∧ 对侧改 —— 移动放行通道**不得**把它算成"本侧处置"。
      // 真行为是保守侧:对侧改过的内容必须活下来(工具的既定纪律 —— "删除不随合并传播,
      // 确要删必须在合并之后显式 git rm"),所以这里钉的是"它还在,且没被写进 moved 清单"。
      run('checkout', '-q', '-b', 'ours-del', ours)
      rmSync(join(dir, 'theirs-edited.ts'), { force: true })
      run('add', '-A')
      run('commit', '-qm', 'ours deletes a path theirs edited')
      const p3 = plan(run('rev-parse', 'HEAD'), theirs, dir)
      const stillThere = listPaths(p3.tree, dir).includes('theirs-edited.ts')
      ok(
        '③ 本侧删 ∧ 对侧改:对侧内容必须存活,且不得被移动通道算成本侧处置',
        stillThere &&
          !p3.movedPaths.some((m) => m.includes('theirs-edited.ts')) &&
          p3.bad.length === 0,
        JSON.stringify({ stillThere, bad: p3.bad.slice(0, 2), moved: p3.movedPaths }),
      )
      run('checkout', '-q', '--detach', ours)
      run('branch', '-D', 'ours-del')
    }
    {
      // 反向对照:真吞并不得被移动通道洗绿 —— 拿"本侧整棵树"当合并树,theirs.ts 的内容在本侧无处可寻
      const oursTree = run('rev-parse', `${ours}^{tree}`)
      const ghost = verifyUnion(ours, theirs, oursTree, dir)
      ok(
        '真吞并仍判红:对侧独有内容在本侧无处可寻时,移动通道不得放行',
        ghost.some((b) => b.includes('丢了对侧路径') && b.includes('theirs.ts')) &&
          !ghost.moved.some((m) => m.startsWith('theirs.ts')),
        `${ghost.join(' / ')} | moved=${ghost.moved.join(' / ')}`,
      )
    }
    const doc = show(p.tree, 'PROJECT_PLAN.md', dir)
    ok(
      '台账两侧登记行都必须存活',
      doc.includes('ours-line') && doc.includes('theirs-line'),
      doc.replace(/\n/g, '|'),
    )

    const sha = run('commit-tree', p.tree, '-p', ours, '-p', theirs, '-m', 'union merge')
    ok(
      '用守门 100 的 A1 复核本工具产物 ⇒ 0 丢失',
      auditOne(sha, dir).lost.length === 0,
      JSON.stringify(auditOne(sha, dir).lost),
    )

    // 反向对照:选边(取对侧整棵树)必须被同一套断言判失败
    const oneSide = git(['rev-parse', `${theirs}^{tree}`], dir)
    const bad = verifyUnion(ours, theirs, oneSide, dir)
    ok(
      '选边式合并必须判失败',
      bad.some((b) => b.includes('mine.ts')),
      bad.slice(0, 2).join(' / '),
    )

    // —— 两侧同改:第二个夹具,以免扰动上面那组的既有断言 ——
    const d2 = mkScratch('ihui-union-3w-')
    const r2 = (...a) => git(a, d2)
    try {
      r2('init', '-q', '-b', 'main')
      r2('config', 'user.email', 't@t')
      r2('config', 'user.name', 't')
      r2('config', 'core.autocrlf', 'false') // 结果按字节断言,行尾必须确定(本机实测 autocrlf=true)
      writeFileSync(join(d2, 'clean.ts'), 'l1\nl2\nl3\nl4\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nx2\nx3\n', 'utf8')
      writeFileSync(join(d2, 'only-theirs.ts'), 'ot-base\n', 'utf8')
      writeFileSync(join(d2, 'both.bin'), Buffer.from('a\u0000b\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'init')

      writeFileSync(join(d2, 'clean.ts'), 'L1\nl2\nl3\nl4\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nOURS\nx3\n', 'utf8')
      writeFileSync(join(d2, 'gen.art'), 'GENERATED FILE — DO NOT EDIT\nOURS\n', 'utf8')
      writeFileSync(join(d2, 'both.bin'), Buffer.from('A\u0000b\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'ours')
      const o2 = r2('rev-parse', 'HEAD')

      r2('checkout', '-q', 'HEAD~1')
      writeFileSync(join(d2, 'clean.ts'), 'l1\nl2\nl3\nTHEIRS\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nTHEIRS\nx3\n', 'utf8')
      writeFileSync(join(d2, 'gen.art'), 'GENERATED FILE — DO NOT EDIT\nTHEIRS\n', 'utf8')
      writeFileSync(join(d2, 'only-theirs.ts'), 'ot-theirs\n', 'utf8')
      writeFileSync(join(d2, 'both.bin'), Buffer.from('a\u0000B\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'theirs')
      const t2 = r2('rev-parse', 'HEAD')
      r2('update-ref', 'refs/heads/main', o2)

      const q = plan(o2, t2, d2)
      ok(
        '两侧同改不同区域 ⇒ 走真三方并入 mergedClean',
        q.mergedClean.includes('clean.ts') && !q.tookTheirs.includes('clean.ts'),
        JSON.stringify([q.mergedClean, q.tookTheirs]),
      )
      const clean = show(q.tree, 'clean.ts', d2)
      ok(
        '干净三方:两侧新增行都必须在结果里',
        clean === 'L1\nl2\nl3\nTHEIRS\nl5',
        clean.replace(/\n/g, '|'),
      )
      const clash = q.needHuman.find((h) => h.path === 'clash.ts')
      ok(
        '两侧同改同一行 ⇒ 判需人工并点名该文件(不选边)',
        clash?.kind === 'conflict',
        JSON.stringify(q.needHuman),
      )
      ok(
        '冲突必须同时进落地闸 bad',
        q.bad.some((b) => b.includes('clash.ts')),
        q.bad.slice(0, 3).join(' / '),
      )
      ok(
        '冲突文件的树内容仍是本侧版本(未被悄悄换成对侧)',
        show(q.tree, 'clash.ts', d2) === 'x1\nOURS\nx3',
        show(q.tree, 'clash.ts', d2),
      )
      // —— 生成物通道(G-814415):冲突不得把整枚合并卡死,但要登记"待重生成" ——
      ok(
        '生成物两侧各自重生成 ⇒ 不进 needHuman、登记 generatedDeferred 并点名自证标记',
        !q.needHuman.some((h) => h.path === 'gen.art') &&
          q.generatedDeferred.some((d) => d.path === 'gen.art' && d.marker === 'GENERATED FILE — DO NOT EDIT'),
        JSON.stringify([q.needHuman.map((h) => h.path), q.generatedDeferred]),
      )
      ok(
        '生成物 Deferred 不得进落地闸 bad(否则还是卡死),且树内容按本侧留下',
        !q.bad.some((b) => b.includes('gen.art')) &&
          show(q.tree, 'gen.art', d2) === 'GENERATED FILE — DO NOT EDIT\nOURS',
        `${q.bad.slice(0, 2).join(' / ')} | ${show(q.tree, 'gen.art', d2).replace(/\n/g, '|')}`,
      )
      ok(
        '反向锁:同一枚合并里非生成物冲突必须照旧交人工(生成物通道不得变成选边后门)',
        q.needHuman.some((h) => h.path === 'clash.ts' && h.kind === 'conflict'),
        JSON.stringify(q.needHuman.map((h) => [h.path, h.kind])),
      )
      ok(
        '二进制两侧同改 ⇒ 无法文本三方,交人工',
        q.needHuman.find((h) => h.path === 'both.bin')?.kind === 'binary',
        JSON.stringify(q.needHuman),
      )
      ok(
        '仅对侧动过 ⇒ 与改前逐字一致(整文件取对侧)',
        q.tookTheirs.includes('only-theirs.ts') &&
          blobOf(q.tree, 'only-theirs.ts', d2) === blobOf(t2, 'only-theirs.ts', d2),
        JSON.stringify(q.tookTheirs),
      )
      ok(
        '活文档仍走行级 union(不经三方)',
        show(q.tree, 'PROJECT_PLAN.md', d2).includes('theirs-line'),
      )
      ok('无丢行违规(干净三方那一个文件)', q.violations.length === 0, JSON.stringify(q.violations))

      /**
       * `--take-theirs` 的成对用例(2026-09-28 补,与上面的"选边必失败"成对而不是相反):
       * 两侧把**同一行**改成两种写法时,`--resolve` 的零损失断言结构上喂不进去(两侧独有行都留
       * ⇒ 同名声明重复 ⇒ 编译不过),所以缺的不是判断而是**声明式出口**。两条必须同时成立:
       *  · 不声明 ⇒ 仍 needHuman(出口不能被静默打开,否则"选边"就成了默认动作);
       *  · 声明 ⇒ 树内容逐字等于对侧、`keptTheirs` 点名该路径、且**不因此产生丢行违规**
       *    (取代是本侧持有者的决定,不是归并器的失误)。
       */
      const forcedT = plan(o2, t2, d2, new Set(), new Map(), new Set(['clash.ts']))
      ok(
        'T-a 声明 --take-theirs ⇒ 该路径整文件取对侧并点名(不藏在 tookTheirs 里)',
        forcedT.keptTheirs.includes('clash.ts') &&
          blobOf(forcedT.tree, 'clash.ts', d2) === blobOf(t2, 'clash.ts', d2) &&
          !forcedT.needHuman.some((h) => h.path === 'clash.ts'),
        JSON.stringify([forcedT.keptTheirs, forcedT.needHuman.map((h) => h.path)]),
      )
      /**
       * 反 TDZ 的形状锁(2026-09-28 实测:第一次 --apply 就是死在
       * `Cannot access 'acceptedGrowth' before initialization` —— 累加器声明挂在 2) 的群里,
       * 而 1) 活文档循环先用它;纯函数自检对此全绿,因为它是照着"函数会给答案"写的,
       * 而不是照"有人调它"写的。声明必须先于使用,这条能由源码文本判,不需要真跑一次合并。)
       */
      ok(
        '声明放行:累加器的声明必须早于第一次使用(1) 活文档循环在 2) 的累加器群之前)',
        (() => {
          const src = readFileSync(new URL(import.meta.url), 'utf8')
          const decl = src.indexOf('const acceptedGrowth = []')
          const use = src.indexOf('acceptedGrowth.push')
          return decl >= 0 && use >= 0 && decl < use
        })(),
      )
      ok(
        '声明放行:accepted 必须真的传到落地闸的两处调用点(只加形参不传 = 自检绿而生效次数 0)',
        (() => {
          const src = readFileSync(new URL(import.meta.url), 'utf8')
          return (
            src.includes('planStateRegressions(mergedText, sides, accepted, {') &&
            src.includes('planStateRegressions(blobText(mergedOid, cwd), sideTexts, accepted, {') &&
            src.includes('moveAwareCache, takeTheirs, accepted,')
          )
        })(),
      )
      ok(
        'F5 额度:三类有据额度必须由**调用点**喂进内容(搬运感知表 / 基底面 / 本侧面)—— ' +
          '只在判据函数里读形参而没人传,等价于这一维从未生效过(守门 70/76/81/105/115 同族)',
        (() => {
          const src = readFileSync(new URL(import.meta.url), 'utf8')
          return (
            src.includes('suppress: ma.suppress') &&
            src.includes('baseText: bt') &&
            src.includes('oursText: a') &&
            src.includes('baseText: __sideBlobs[0]') &&
            src.includes('oursText: __sideBlobs[1]')
          )
        })(),
      )
      ok(
        'T-b 反向锁:不声明时同一夹具仍必须判需人工(声明式例外不得变成默认放行)',
        q.needHuman.some((h) => h.path === 'clash.ts') && !q.keptTheirs?.length,
        JSON.stringify(q.needHuman.map((h) => h.path)),
      )
      ok(
        'T-c 取对侧只影响被声明的那一路径:其余文件的两侧独有行仍须全在',
        show(forcedT.tree, 'clean.ts', d2) === 'L1\nl2\nl3\nTHEIRS\nl5' &&
          show(forcedT.tree, 'PROJECT_PLAN.md', d2).includes('ours-line') &&
          show(forcedT.tree, 'PROJECT_PLAN.md', d2).includes('theirs-line'),
        show(forcedT.tree, 'clean.ts', d2).replace(/\n/g, '|'),
      )

      /**
       * 形状锁:声明必须先于使用。起因是 2026-09-28 的一次真实卡死 —— 1) 里新加的"状态分叉"判据
       * 往 `violations` push,而 `const violations = []` 声明在下面 2) 的清单堆里 ⇒
       * `Cannot access 'violations' before initialization`,上层把它报成"union-converge 亦判需人工",
       * 于是**所有会话的台账冲突都收敛不动、发布链卡死**。
       * 为什么只能用源码序而不能用行为用例钉:抛不抛取决于 `planStateRegressions` 当期有没有报出
       * 内容 —— 上面那个夹具恰好没报,于是自测 20 条全绿而真仓一撞分叉就崩(数据相关的崩溃,
       * 行为用例天然测不到;源码序是这里唯一不依赖数据的锁)。
       */
      ok(
        '形状锁:buildUnion 里 violations 的声明必须先于第一次 push',
        (() => {
          const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
          const decl = src.indexOf('const violations = []')
          const use = src.indexOf('violations.push(')
          return decl >= 0 && use >= 0 && decl < use
        })(),
      )

      // —— --resolve:人工判完的回灌出口必须**不是**选边的别名 ——
      const rfBoth = join(d2, '.resolve-both.txt')
      writeFileSync(rfBoth, 'x1\nOURS\nTHEIRS\nx3\n', 'utf8')
      const qr = plan(o2, t2, d2, new Set(), new Map([['clash.ts', rfBoth]]))
      ok(
        '--resolve 含两侧独有行 ⇒ 冲突消失、进 mergedClean、落地闸过',
        !qr.needHuman.some((h) => h.path === 'clash.ts') &&
          qr.humanResolved.includes('clash.ts') &&
          !qr.bad.some((b) => b.includes('clash.ts')),
        JSON.stringify([qr.needHuman.map((h) => h.path), qr.humanResolved, qr.bad]),
      )
      ok(
        '--resolve 的落树内容 == 人工那份(不是本侧、也不是对侧)',
        show(qr.tree, 'clash.ts', d2) === 'x1\nOURS\nTHEIRS\nx3',
        show(qr.tree, 'clash.ts', d2).replace(/\n/g, '|'),
      )
      const rfOursOnly = join(d2, '.resolve-ours.txt')
      writeFileSync(rfOursOnly, 'x1\nOURS\nx3\n', 'utf8')
      const qo = plan(o2, t2, d2, new Set(), new Map([['clash.ts', rfOursOnly]]))
      ok(
        '反向锁:--resolve 只放本侧内容 ⇒ 判"丢对侧独有行"并进 bad(否则它就是选边后门)',
        qo.bad.some((b) => b.includes('clash.ts') && /对侧独有行/.test(b)),
        qo.bad.slice(0, 3).join(' / '),
      )
      const qb = plan(o2, t2, d2, new Set(), new Map([['clash.ts', join(d2, 'no-such-file.txt')]]))
      ok(
        '--resolve 指向读不到的文件 ⇒ 仍落 needHuman 并点名原因(不静默按本侧落地)',
        qb.needHuman.some((h) => h.path === 'clash.ts' && h.kind === 'resolve-unreadable'),
        JSON.stringify(qb.needHuman.map((h) => [h.path, h.kind])),
      )
    } finally {
      rmScratch(d2, { bestEffort: true })
    }

    // 丢行判据本身的语义边界(纯函数,不需仓库)
    ok(
      '丢行判据:另一侧显式删掉的基底同名行不计为丢失',
      lostAddedLines('d\nd\n', 'd\nd\nd\n', 'd\n', 'd\nd\n').length === 0,
    )
    ok(
      '丢行判据:本侧新增行被吃掉必须点名',
      lostAddedLines('b\n', 'b\nx\n', 'b\n', 'b\n').join() === 'x',
    )
    ok(
      '丢行判据:重数下降也算丢失',
      lostAddedLines('a\n', 'a\nn\nn\n', 'a\n', 'a\nn\n').join() === 'n',
    )
    // ── 副本指针 cap(G-814386):少带份数合法,少带信息非法 ──────────────────────────
    // 三对正反例都必须"同一对输入、只差指针字样",否则例外一旦写宽,普通行的丢失也会被一起放过。
    const PTR = '〔【归并】重复登记副本(2026-09-26):同主键另一条,派单以那条为准。〕'
    ok(
      '指针 cap:对侧新增 3 份带指针的行 ⇒ 只判"少带 2 份",不进丢失桶',
      (() => {
        const l = `- [ ] G-9 事甲 ${PTR}`
        const r = lostAddedLines('base\n', `base\n${l}\n${l}\n${l}\n`, 'base\n', `base\n${l}\n`)
        return (
          r.join() === '' &&
          r.pointerCapped.length === 1 &&
          r.pointerCapped[0].dropped === 2 &&
          formatPointerCapReport(r.pointerCapped).length > 0
        )
      })(),
    )
    ok(
      '指针 cap 的反面:同一形态但不带指针 ⇒ 必须照常判丢失(例外不得吞普通行)',
      (() => {
        const l = '- [ ] G-9 事甲 〔普通注记〕'
        const r = lostAddedLines('base\n', `base\n${l}\n${l}\n${l}\n`, 'base\n', `base\n${l}\n`)
        return r.join() === l && (r.pointerCapped?.length ?? 0) === 0
      })(),
    )
    ok(
      '指针 cap 的反面:指针行在合并结果里一份都不剩 ⇒ 仍判丢失("少带"不等于"带没带")',
      (() => {
        const l = `- [ ] G-9 事甲 ${PTR}`
        const r = lostAddedLines('base\n', `base\n${l}\n${l}\n`, 'base\n', 'base\n')
        return r.join() === l
      })(),
    )
    ok(
      '期望表:指针行只许"从无到有带 1 份";本侧已有 2 份而对侧 5 份 ⇒ 期望仍是 2(不增长)',
      (() => {
        const l = `- [ ] G-9 事甲 ${PTR}`
        return (
          liveDocExpectedCounts('', `${l}\n${l}\n${l}\n`, '').get(l) === 1 &&
          liveDocExpectedCounts(`${l}\n${l}\n`, `${l}\n`.repeat(5), '').get(l) === 2
        )
      })(),
    )
    ok(
      '期望表:基底有 2 份、本侧清成 0、对侧未动 ⇒ 期望 0(处置权仍在本侧,与改动前同形)',
      liveDocExpectedCounts('', `- [ ] G-9 事甲 ${PTR}\n`.repeat(2), `- [ ] G-9 事甲 ${PTR}\n`.repeat(2)).get(
        `- [ ] G-9 事甲 ${PTR}`,
      ) ===
        undefined,
    )
    ok(
      '期望表:不带指针的行完全不受本维影响',
      liveDocExpectedCounts('x\n', 'x\nx\nx\n', 'x\nx\n').get('x') === 2,
    )
    ok(
      '期望表:**没有基底**时指针行也照旧全带(判不出谁加的 ⇒ 不许少带,失效方向只能是多带)',
      liveDocExpectedCounts('', `- [ ] G-9 事甲 ${PTR}\n`.repeat(3)).get(`- [ ] G-9 事甲 ${PTR}`) === 3,
    )
    ok(
      'F5:指针注记行被 cap 后不得判红(否则每一枚台账收敛都在落地闸自杀)',
      (() => {
        const l = `- [ ] G-9 事甲 ${PTR}〔【归并】落账:复测 2026-09-26〕\n`
        const sides = [l.repeat(3), 'other\n']
        return planStateRegressions(l + 'other\n', sides).length === 0
      })(),
    )
    ok(
      'F5 的反面:不带指针的注记行少了 ⇒ 必须照常判红(放宽的是形状,不是方向)',
      planStateRegressions(
        '- [ ] G-9 事甲 〔【归并】落账:复测 2026-09-26〕\n',
        ['- [ ] G-9 事甲 〔【归并】落账:复测 2026-09-26〕\n'.repeat(3), 'z\n'],
      ).join('').includes('F5'),
    )
    // 任务状态分叉不得被并集放大(纯函数;这正是"两份真相"的产地)
    const PS_A = '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。\n'
    const PS_B = '- [ ] **D9 同一件事**:另一侧还挂着未勾。\n'
    ok(
      '状态判据:两侧各 0 分叉,并集归并出 1 组必须报(并集策略就是副本产地)',
      planStateRegressions(PS_A + PS_B, [PS_A, PS_B]).join('').includes('F1'),
      JSON.stringify(planStateRegressions(PS_A + PS_B, [PS_A, PS_B])),
    )
    ok('状态判据:结果与较好一侧持平 ⇒ 不得报', planStateRegressions(PS_A, [PS_A, PS_B]).length === 0)
    // 声明式出口的三条对偶(缺一就把"放行"变成了"关掉判据"):不声明必红 / 声明后必绿且交出理由 / 维名写错必炸
    ok(
      '声明放行:accepted 缺省(空)时同一形状仍必须报红 —— 默认放过就等于没有这道闸',
      planStateRegressions(PS_A + PS_B, [PS_A, PS_B], []).join('').includes('F1'),
    )
    ok(
      '声明放行:声明 forks 后该维不再报红,但两个读数与理由必须一起交回(要写进合并提交信息)',
      (() => {
        const r = planStateRegressions(PS_A + PS_B, [PS_A, PS_B], [
          { dim: 'forks', reason: '两侧各登记一次同一件事,并集天然成对' },
        ])
        return (
          !r.some((x) => x.includes('F1')) &&
          r.accepted.length === 1 &&
          r.accepted[0].includes('各侧最多 0 → 归并 1') &&
          r.accepted[0].includes('并集天然成对')
        )
      })(),
      JSON.stringify(
        planStateRegressions(PS_A + PS_B, [PS_A, PS_B], [
          { dim: 'forks', reason: '两侧各登记一次同一件事,并集天然成对' },
        ]).accepted,
      ),
    )
    ok(
      '声明放行:维名不认识必须抛(拼错的维名静默不生效 = 一张没写到的空白支票)',
      (() => {
        try {
          planStateRegressions(PS_A + PS_B, [PS_A, PS_B], [{ dim: 'F1', reason: 'r' }])
          return false
        } catch (e) {
          return String(e && e.message).includes('维名不认识')
        }
      })(),
    )
    ok(
      '状态判据:副本被正确翻勾(两侧并集但状态一致)⇒ 不算放大',
      planStateRegressions(PS_A + PS_B.replace('- [ ]', '- [x] ✅(2026-09-26) '), [PS_A, PS_B]).length === 0,
    )
    ok(
      '状态判据:输入取不到(空文本/无对照侧)⇒ 返回空且不声称已判(调用方只对真做了判定的路径说话)',
      planStateRegressions('', [PS_A]).length === 0 && planStateRegressions(PS_A, []).length === 0,
    )
    // F5 存续性:方向与前四条相反 —— 注记**少了**才坏,这正是本会话被活文档并集抹掉两次的形状
    const PS_N1 = '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。〔【归并】D9 落账:复测 2026-09-26: 取证。\n'
    const PS_N0 = '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。\n'
    ok(
      'F5:一侧带落账注记、归并结果把注记顶掉 ⇒ 必须报(前四条此时全绿)',
      planStateRegressions(PS_N0, [PS_N1, PS_N0]).join('').includes('F5'),
    )
    ok(
      'F5:注记与较好一侧持平或更多 ⇒ 不得报(否则清完账反而恒红)',
      planStateRegressions(PS_N1, [PS_N1, PS_N0]).length === 0 &&
        planStateRegressions(PS_N1 + PS_N1, [PS_N1]).length === 0,
    )
    // ── F5 的三类"有据额度"(2026-09-29)──
    // 立因:落地闸报「各侧最多 537,归并只剩 501」却不给逐份出处,而按行量下来 64 份缺口
    // **全部**能落到两类合法机制上(38 份由基准面的 `已归档` 占位代表、26 份是本侧相对基底自缩)。
    // 旧写法只认"副本指针行"一档,且**遍历结果面** ⇒ "一份都没剩下"那种行结构上不可申诉。
    // 这三条成对用例钉的是:有据的两档必须认下来(否则每次台账合并自杀),而无据那一档**照旧判红**
    // (放宽的是形状,不是方向 —— 把判据改成"永远放过"就等于没有这道门)。
    const AR =
      '<!-- 已归档(2026-09-26:某条目收口,随块带走的归并落账注记: 〔【归并】D9 落账:复测 2026-09-26〕 〔【归并】D10 落账:复测 2026-09-26〕 -->'
    const ARn = (k) => (k > 0 ? `${AR}\n`.repeat(k) : '')
    ok(
      'F5 额度①:搬运感知表按行点名的"占位代表"份数 ⇒ 不得判红(结果里一份都没有也必须能申诉)',
      planStateRegressions('x\n', ['x\n', 'x\n', ARn(2)], null, {
        suppress: new Map([[AR, 2]]),
        baseText: 'x\n',
        oursText: 'x\n',
      }).length === 0,
    )
    ok(
      'F5 额度②:本侧相对共同基底自己缩了量 ⇒ 依"处置权在本侧"不判红(与 liveDocExpectedCounts 同形)',
      planStateRegressions(ARn(1), [ARn(3), ARn(1), ARn(3)], null, {
        suppress: null,
        baseText: ARn(3),
        oursText: ARn(1),
      }).length === 0,
    )
    ok(
      'F5 有牙:对侧相对基底**加**了注记、归并却没带(既非占位代表也非自缩)⇒ 照常判红并点名未解释条数',
      (() => {
        const r = planStateRegressions(ARn(1), [ARn(1), ARn(1), ARn(3)], null, {
          suppress: null,
          baseText: ARn(1),
          oursText: ARn(1),
        }).join('')
        return r.includes('F5') && r.includes('未被任何机制解释')
      })(),
    )
    ok(
      'F5 量纲:搬运感知表给的是**份数**,一行挂两条注记时必须换算成 2 个 occurrence —— ' +
        '把行数当份数(本仓反复复发的那一单位错)会让这一档少扣一半,把正常合并钉成恒红',
      planStateRegressions('x\n', ['x\n', 'x\n', ARn(1)], null, {
        suppress: new Map([[AR, 1]]),
        baseText: 'x\n',
        oursText: 'x\n',
      }).length === 0 &&
        // 反向对照:同一张表什么都不给 ⇒ 必须红(有牙,不是"能解释就算过")
        planStateRegressions('x\n', ['x\n', 'x\n', ARn(1)], null, {
          suppress: new Map(),
          baseText: 'x\n',
          oursText: 'x\n',
        }).join('')
          .includes('F5') === true,
    )
    // ── G-977960 ①:跨行注记不得再造"无论怎么合并都差 N 条"的死局,但真抹掉行仍必须判红 ──
    // `MERGE_NOTE_RE` 的字符类含换行 ⇒ 一条注记可以横写两行;旧写法拿"整面命中数"当份数,
    // 而三类额度全部按行结算 ⇒ 这一档既进不了总额也进不了额度(实测名单为空而仍差 2)。
    const CL_OPEN = '- [x] ✅(2026-09-20) **CL 跨行注记**:做完了。〔【归并】CL '
    const CL_CLOSE = '落账:复测 2026-09-26: 取证〕'
    const CL_SIDES = [CL_OPEN, CL_CLOSE, CL_OPEN, CL_CLOSE].join('\n') + '\n'
    const CL_MERGED = [CL_OPEN, CL_OPEN, CL_CLOSE, CL_CLOSE].join('\n') + '\n'
    ok(
      '跨行注记:物理行一条没少、只是相邻顺序变了 ⇒ 落地闸不得判红(旧口径在这里必红,而名单为空)',
      planStateRegressions(CL_MERGED, [CL_SIDES, 'z\n']).join('') === '',
    )
    ok(
      '跨行注记的**变异对照**(证明上面那条不是恒真):同一形状按旧量纲(整面命中数)比 ⇒ 一定差 1 条 ' +
        '—— 所以放掉的只有 phantom 残差,不是"比较量变小了所以什么都过"',
      mergeNoteUnits(CL_SIDES).total - mergeNoteUnits(CL_MERGED).total === 1 &&
        mergeNoteUnits(CL_SIDES).lineAttributable === mergeNoteUnits(CL_MERGED).lineAttributable,
    )
    ok(
      '跨行注记必须**报名**:量纲说明行要同时给出各侧与结果的跨行条数,并写明"只报名不判红"',
      (() => {
        const line = mergeNoteCrossLineCaliber(CL_MERGED, [CL_SIDES, 'z\n'])
        return (
          line.includes('跨行书写的注记') &&
          line.includes('各侧最多 2 条') &&
          line.includes('归并结果 1 条') &&
          line.includes('只报名,不参与判红')
        )
      })(),
    )
    ok(
      'F5c 有牙:跨行注记的**承载行**在结果里一份不剩 ⇒ 必须判红并点名该行(换量纲不等于关掉这一维)',
      planStateRegressions(CL_OPEN + '\n', [CL_SIDES, 'z\n']).join('').includes('F5c'),
    )
    ok(
      'F5c 反向对照:同一形状里承载行都在位 ⇒ 不得判红(允许少带份数,不允许带走注记的行)',
      planStateRegressions(CL_SIDES, [CL_SIDES, 'z\n']).join('') === '',
    )
    ok(
      '形状锁:注记的形状判据与份数判据只许有一份实现 —— 本门不得再自带 new RegExp(MERGE_NOTE_RE,…) ' +
        '抄第二份逐行计数(G-977960 ① 的根因就是"读数住整面量纲、额度住逐行量纲"两套并存)',
      (() => {
        const src = readFileSync(new URL(import.meta.url), 'utf8')
        return (
          /new RegExp\(\s*MERGE_NOTE_RE\.source/.test(src) === false &&
          src.includes('lineNoteCount') &&
          src.includes('mergeNoteUnits')
        )
      })(),
    )
    // ── F9b 畸形号 / F9 撞号两维进落地闸(2026-09-28 G-606)──
    // 成对:① 归并自己造的必须点名;② 两侧本来就带着的存量不得钉红归并(否则每次收敛都红)。
    // 这两维判的是**行集/键集**而不是计数 —— 计数档对"抹掉一侧旧的、带进一枚新的"恒净零。
    const MAL_G = '- [ ] **G-G-354 门33的provider名单该由谁供给**:甲。\n'
    const CLEAN_G = '- [ ] **G-360 部署环 ff 竞态**:乙。\n'
    ok(
      'F9b:两侧都没有畸形号而归并结果有 ⇒ 必须点名到逐行原文(只报数等于让人再跑一遍全量档)',
      planStateRegressions(MAL_G, [CLEAN_G, CLEAN_G]).join('').includes('F9b') &&
        planStateRegressions(MAL_G, [CLEAN_G, CLEAN_G]).join('').includes('G-G-354'),
      JSON.stringify(planStateRegressions(MAL_G, [CLEAN_G, CLEAN_G])),
    )
    ok(
      'F9b:畸形行是**某一侧原样带着的存量** ⇒ 不得报(那是他人的历史债,归并没有制造它)。' +
        '对照行刻意用**另一个号**:G-G-354 与 G-354 在 keyOfRow 下取到的是同一枚主键(判据从正文里' +
        '搜 `G-\\d+`,第一段 `G-` 被跳过),两行并排会同时红在 F9 上 —— 那既是本例要避开的噪声, ' +
        '也是"逐条剥前缀必须先问目标号有没有人占着"的根据(见 lib planMalformedStrip 的 refused)',
      planStateRegressions(MAL_G + CLEAN_G, [MAL_G, CLEAN_G]).length === 0,
      JSON.stringify(planStateRegressions(MAL_G + CLEAN_G, [MAL_G, CLEAN_G])),
    )
    ok(
      'F9b 反向锁:等量换号(抹掉一侧的旧畸形号、同时带进一枚新的)必须仍被点名 —— ' +
        '这一条就是"两把棘轮只比数量"那一型的落地闸版本,把它并进计数档就恒绿',
      planStateRegressions(MAL_G, [CLEAN_G, '- [ ] **G-G-399 另一议题**:乙。\n'])
        .join('')
        .includes('G-G-354'),
    )
    const COL_A = '- [ ] **G-500 甲议题**:一侧写的。\n'
    const COL_B = '- [ ] **G-500 乙议题**:另一侧写的。\n'
    ok(
      'F9:两侧各自都不撞、归并把两条不同议题拼到同一编号下 ⇒ 必须逐组点名',
      planStateRegressions(COL_A + COL_B, [COL_A, COL_B]).join('').includes('F9 归并新增撞号组') &&
        planStateRegressions(COL_A + COL_B, [COL_A, COL_B]).join('').includes('G-500'),
      JSON.stringify(planStateRegressions(COL_A + COL_B, [COL_A, COL_B])),
    )
    ok(
      'F9:某一侧本来就撞的组 ⇒ 归并不判红(同组多挂一行只能人工让号;为它拒绝收敛的唯一出路是' +
        '删掉某一侧的行,那违反本工具的零丢失承诺,更贵)',
      planStateRegressions(COL_A + COL_B + '- [ ] **G-500 丙议题**:第三行。\n', [
        COL_A + COL_B,
        COL_A,
      ]).length === 0,
      JSON.stringify(
        planStateRegressions(COL_A + COL_B + '- [ ] **G-500 丙议题**:第三行。\n', [
          COL_A + COL_B,
          COL_A,
        ]),
      ),
    )

    // ── 活文档三方行 union(2026-09-25 实测逼出:旧写法 max(ours,theirs) 会把"本侧就地改写"
    //    之前的旧行复活。行首是状态位的行一旦被复活,刚翻勾的待办就重新变成"无人认领可派"。) ──
    ok(
      '活文档:本侧就地改写一行 ⇒ 改写前的旧行不得被对侧复活',
      !unionLines('a\nb\nL2\n', 'a\nb\nL\n', 'a\nb\nL\n').split('\n').includes('L'),
      '合并结果里仍出现旧行 L',
    )
    ok(
      '活文档:对侧相对基底新增的行必须保住(本工具的存在理由)',
      unionLines('a\nb\nL2\n', 'a\nb\nL\nT\n', 'a\nb\nL\n').includes('T'),
    )
    ok(
      '活文档:两侧各自新增不同行 ⇒ 两行都在,不选边',
      ['O-new', 'T-new'].every((s) => unionLines('a\nO-new\n', 'a\nT-new\n', 'a\n').includes(s)),
    )
    ok(
      '活文档:两侧新增了**同一行** ⇒ 只留一份(旧写法在此已是 max,新公式不得回退成 2 份)',
      counter(unionLines('a\nsame\n', 'a\nsame\n', 'a\n')).get('same') === 1,
    )
    ok(
      '活文档:本侧删掉一行而对侧未动 ⇒ 删除归本侧处置,不被补回',
      !unionLines('a\n', 'a\nb\n', 'a\nb\n').split('\n').includes('b'),
    )
    ok(
      '活文档:无基底信息(两侧都是新增文件)⇒ 退回旧的 max 语义,一条都不丢',
      ['x', 'y'].every((s) => counter(unionLines('x\n', 'y\n', null)).get(s) === 1),
    )
    ok(
      '防复活必须是**有基底的三方判据**:只给两侧文本时旧行为不变(证明收紧靠的是 base 而不是削判据)',
      counter(unionLines('a\n', 'a\nb\n')).get('b') === 1,
    )
    // 「对侧改写、本侧未动」那一族的四条成对用例(正例 + 三条"判不准就不许折"的反向对照)。
    // 反向三条各自的失效方向都是**多留一份**,绝不是少带 —— 少带就是丢别人的行,比 F9 红更贵。
    const RW_BASE = '- [ ] G-770 折叠夹具:同一议题的甲写法,含落点与判据两段说明。\n'
    const RW_NEW = '- [x] G-770 折叠夹具:同一议题的乙写法,含落点与判据两段说明。\n'
    const RW_MINE = '- [ ] G-770 折叠夹具:本侧自己改成的第三种形态。\n'
    const rwHas = (r, s) => (s === '' ? false : r.includes(s.trim()))
    ok(
      '对侧就地改写 ∧ 本侧对该主键逐字未动 ⇒ 结果只带改写那一份(旧写法把改写读成「对侧新增」,' +
        '于是同号两个形态并存 —— 实测 G-823 与 G-814425 两组 F9 就是这么造出来的)',
      (() => {
        const r = unionLines(`a\n${RW_BASE}`, `a\n${RW_NEW}`, `a\n${RW_BASE}`)
        return rwHas(r, RW_NEW) && !rwHas(r, RW_BASE)
      })(),
    )
    ok(
      '反向锁:本侧对同一主键**也改过** ⇒ 两侧同改,机器不许折(交人工),两份形态都必须留在结果里',
      (() => {
        const r = unionLines(`a\n${RW_MINE}`, `a\n${RW_NEW}`, `a\n${RW_BASE}`)
        return rwHas(r, RW_MINE) && rwHas(r, RW_NEW)
      })(),
    )
    ok(
      '反向锁:对侧是**增行**而不是改写(该主键行数不等)⇒ 不折,本侧那份基底行一份都不能少',
      (() => {
        const r = unionLines(`a\n${RW_BASE}`, `a\n${RW_BASE}${RW_NEW}`, `a\n${RW_BASE}`)
        return rwHas(r, RW_BASE) && rwHas(r, RW_NEW)
      })(),
    )
    ok(
      '反向锁:同一枚号被两侧各登记成**不同议题**(并发取号撞的)⇒ 不许折 —— 折掉任何一侧都是替别人删一件活账,比 F9 红贵得多;这条就是本判据唯一的假阳方向',
      (() => {
        const A = '- [ ] G-773 构建脚本的包名解析恒为空,versionCode 读错 app 的清单。'
        const B = '- [ ] G-773 派单阻塞登记:排队语义在满载时把已终态任务再次入队。'
        const r = unionLines(`a\n${A}\n`, `a\n${B}\n`, `a\n${A}\n`)
        return r.includes(A.trim()) && r.includes(B.trim())
      })(),
    )
    ok(
      '反向锁:对侧把该主键**整族删掉** ⇒ 删除不随合并传播(本侧那份照留),与上面「本侧删而对侧未动」那条对称',
      (() => {
        const r = unionLines(`a\n${RW_BASE}`, 'a\n', `a\n${RW_BASE}`)
        return rwHas(r, RW_BASE)
      })(),
    )
    ok(
      '期望表与产出面必须同一张尺:折叠登记在 liveDocExpectedCounts 里,自证侧读到同一个数 ' +
        '(否则落地闸对着一个产出面根本不存在的数字红,而那种红会被读成「别人把我的行改坏了」)',
      (() => {
        const want = liveDocExpectedCounts(`a\n${RW_BASE}`, `a\n${RW_NEW}`, `a\n${RW_BASE}`)
        return (want.get(RW_BASE.trimEnd()) || 0) === 0 && want.get(RW_NEW.trimEnd()) === 1
      })(),
    )
    // 多重行的口径(真仓第一天就把我这条反向对照判成假阳:台账同一行本来就有 4 份)
    ok(
      '活文档:同一行有多份时按重数算,本侧删掉一份 ≠ "旧行被复活"',
      liveDocExpectedCounts('x\n', 'x\nx\n', 'x\nx\n').get('x') === 1,
    )
    ok(
      '活文档:多份行且对侧又加了一份 ⇒ 期望重数 = 本侧 + 对侧净增,不重复计',
      liveDocExpectedCounts('x\n', 'x\nx\nx\n', 'x\nx\n').get('x') === 2,
    )
    // 端到端:走真临时仓的 plan(),而不是只测纯函数 —— 纯函数过而调用点忘传 base 是本类缺陷最常见的残法。
    // ⚠️ 两侧必须是**真分叉**(同一基底的两个兄弟提交)。第一版这里写成"提交对侧 → 在同一线上
    //   接着提交本侧",于是 merge-base 就是对侧那枚,基底里根本没有那行,"不复活"与"保住对侧行"
    //   两条断言同时变成空转 —— 是反向对照(必须保住对侧独有行)当场把它抓出来的。
    {
      const d3 = mkScratch('ihui-union-resurrect-')
      try {
        const g3 = (...a) => git(a, d3)
        g3('init', '-q', '-b', 'main')
        g3('config', 'user.email', 't@t')
        g3('config', 'user.name', 't')
        const DOC0 = '- [ ] 待办 T9\n- [ ] 别人的行\n'
        writeFileSync(join(d3, 'PROJECT_PLAN.md'), DOC0, 'utf8')
        writeFileSync(join(d3, 'x.ts'), '1\n', 'utf8')
        g3('add', '-A')
        g3('commit', '-qm', 'base')
        // 对侧分支:只在文档尾部加自己的一行(不动 T9)
        g3('checkout', '-q', '-b', 'theirs')
        writeFileSync(join(d3, 'PROJECT_PLAN.md'), DOC0 + '- [ ] 对侧新行\n', 'utf8')
        g3('add', '-A')
        g3('commit', '-qm', 'theirs')
        const theirs3 = g3('rev-parse', 'HEAD').trim()
        // 本侧:回到兄弟分支的同一个基底,把 T9 **就地改写**(翻勾)
        g3('checkout', '-q', '-B', 'ours', g3('rev-parse', 'theirs~1').trim())
        writeFileSync(
          join(d3, 'PROJECT_PLAN.md'),
          '- [x] ✅ 待办 T9 已闭环\n- [ ] 别人的行\n',
          'utf8',
        )
        g3('add', '-A')
        g3('commit', '-qm', 'ours')
        const base3 = g3('merge-base', 'ours', 'theirs').trim()
        const merged3 = show(
          plan(g3('rev-parse', 'HEAD').trim(), theirs3, d3).tree,
          'PROJECT_PLAN.md',
          d3,
        )
        // 夹具自证:这确实是一枚真分叉(否则下面两条断言都是空转)
        ok(
          '端到端夹具自证:两侧是同一基底的两个兄弟提交(merge-base 就是 base)',
          base3 === g3('rev-parse', 'theirs~1').trim() && DOC0.includes('- [ ] 待办 T9'),
          `merge-base=${base3}`,
        )
        ok(
          '端到端(真临时仓):本侧翻勾的一行在对侧未动的情况下不得被复活成未勾',
          !/^- \[ \] 待办 T9$/m.test(merged3),
          `合并树里又出现了未勾的 T9:\n${merged3}`,
        )
        ok(
          '端到端:同一次合并仍必须保住对侧独有新增行(反向对照,防"不复活"被写成"丢对侧")',
          /^- \[ \] 对侧新行$/m.test(merged3),
          `对侧独有行被吞了:\n${merged3}`,
        )
        // 再一条反向:改写前的旧行确实存在于基底与对侧,否则"没复活"只是因为从来就没有过
        ok(
          '端到端夹具自证:旧行 T9 在未合并的两父里都在(证明第一条是"防复活"而不是"本来没有")',
          /^- \[ \] 待办 T9$/m.test(show(theirs3, 'PROJECT_PLAN.md', d3)) &&
            /^- \[ \] 待办 T9$/m.test(show(base3, 'PROJECT_PLAN.md', d3)),
        )
      } finally {
        rmScratch(d3, { bestEffort: true })
      }
    }
    // ── 搬运感知(2026-09-28):被 `已归档` 占位代表着的行不得再从对侧取回 ──────────
    // 四条纯函数 + 一条端到端。端到端那条必要:纯函数过而调用点没接线是本类缺陷最常见的残法。
    {
      const PH1 = '<!-- 已归档(2026-09-28:甲条目 ✅,完整内容在 .ihui-agent/archive/A.md -->'
      const OURS_MA = `# 台账\n${PH1}\n- [ ] 活账\n`
      const THEIRS_MA = OURS_MA + '## 甲条目 ✅\n\n- [x] 甲一\n- [ ] 别人刚在块里补的一行\n- [x] 甲二\n'
      const ARC = '# 归档\n\n## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n\n---\n\n'
      const m1 = archivedLineSuppressions({
        oursText: OURS_MA,
        theirsText: THEIRS_MA,
        archiveOf: (p) => (p === '.ihui-agent/archive/A.md' ? ARC : null),
      })
      ok(
        '搬运感知:只抑制"与归档件逐行连续"的段;块内别人新写那一行永远不进抑制表(失效方向只能是多带)',
        m1.suppress.get('## 甲条目 ✅') === 1 &&
          m1.suppress.get('- [x] 甲一') === 1 &&
          !m1.suppress.has('- [ ] 别人刚在块里补的一行') &&
          !m1.suppress.has('') &&
          m1.stats.suppressedLines === 2,
        JSON.stringify(m1.stats),
      )
      const m2 = archivedLineSuppressions({
        oursText: OURS_MA,
        theirsText: THEIRS_MA,
        archiveOf: () => null,
      })
      ok(
        '搬运感知:归档件取不到 = 坏指针 ⇒ 一分都不抑制并记未判定(绝不把"没证据"写成"已归档")',
        m2.suppress.size === 0 && m2.undetermined.length === 1,
        JSON.stringify(m2.undetermined),
      )
      const m3 = archivedLineSuppressions({
        oursText: OURS_MA.replace('/A.md', '/A_*.md'),
        theirsText: THEIRS_MA,
        archiveOf: () => ARC,
      })
      ok(
        '搬运感知:通配归档件名不指向可核验内容 ⇒ 照旧取回并点名原因',
        m3.suppress.size === 0 && /通配/.test(m3.undetermined[0]?.reason || ''),
        JSON.stringify(m3.undetermined),
      )
      ok(
        '搬运感知:抑制表只减对侧贡献,本侧自己的行一份都不能少',
        counter(unionLines('a\nb\n', 'a\na\na\n', 'a\n', new Map([['a', 99]]))).get('a') === 1,
      )
    }
    {
      // 端到端夹具:基底**就是"已归档形态"** —— 否则三方判据自己就把这些行拦了,新判据无从表现
      const d4 = mkScratch('ihui-union-moveaware-')
      const ARC4 = '.ihui-agent/archive/PROJECT_PLAN_2026-09-28_auto-archive.md'
      try {
        const g4 = (...a) => git(a, d4)
        const PH4 = `<!-- 已归档(2026-09-28:甲条目 ✅,完整内容在 ${ARC4} -->`
        const DOC4 = `# 台账\n${PH4}\n- [ ] 活账\n`
        g4('init', '-q', '-b', 'main')
        g4('config', 'user.email', 't@t')
        g4('config', 'user.name', 't')
        g4('config', 'core.autocrlf', 'false')
        writeFileSync(join(d4, 'PROJECT_PLAN.md'), DOC4, 'utf8')
        mkdirSync(join(d4, '.ihui-agent', 'archive'), { recursive: true })
        writeFileSync(join(d4, ARC4), '## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n\n---\n\n', 'utf8')
        g4('add', '-A')
        g4('commit', '-qm', 'base(已归档形态)')
        const base4 = g4('rev-parse', 'HEAD').trim()
        g4('checkout', '-q', '-b', 'theirs', base4)
        writeFileSync(
          join(d4, 'PROJECT_PLAN.md'),
          `${DOC4}## 甲条目 ✅\n\n- [x] 甲一\n- [x] 甲二\n\n- [ ] 别人新写的待办\n`,
          'utf8',
        )
        g4('add', '-A')
        g4('commit', '-qm', 'theirs(滞后台账)')
        const theirs4 = g4('rev-parse', 'HEAD').trim()
        g4('checkout', '-q', '-B', 'ours', base4)
        writeFileSync(join(d4, 'PROJECT_PLAN.md'), `${DOC4}ours-line\n`, 'utf8')
        g4('add', '-A')
        g4('commit', '-qm', 'ours')
        const p4 = plan(g4('rev-parse', 'HEAD').trim(), theirs4, d4)
        const doc4 = show(p4.tree, 'PROJECT_PLAN.md', d4)
        ok(
          '端到端夹具自证:merge-base 就是"已归档形态"那枚基底,被搬走的正文只在**对侧**而不在基底与本侧',
          g4('merge-base', 'ours', 'theirs').trim() === base4 &&
            /^- \[x\] 甲一$/m.test(show(theirs4, 'PROJECT_PLAN.md', d4)) &&
            !/^- \[x\] 甲一$/m.test(show(base4, 'PROJECT_PLAN.md', d4)) &&
            collectReferencedArchives(DOC4, show(theirs4, 'PROJECT_PLAN.md', d4)).size === 1,
        )
        ok(
          '端到端:被占位代表的已归档正文不进合并树,而别人新写的行必须在(少带就是丢内容)',
          !/^- \[x\] 甲[一二]$/m.test(doc4) &&
            !/^## 甲条目 ✅$/m.test(doc4) &&
            /^- \[ \] 别人新写的待办$/m.test(doc4) &&
            doc4.includes(PH4),
          doc4.replace(/\n/g, '|'),
        )
        ok(
          '端到端:落地闸对这一维必须计得出数并点名条目,不得静默(否则报告答不出为什么少带)',
          p4.bad.length === 0 &&
            p4.moveAware.some(
              (x) =>
                x.doc === 'PROJECT_PLAN.md' &&
                x.stats.suppressedLines === 3 &&
                x.suppressedBlocks[0]?.title === '甲条目 ✅' &&
                x.suppressedBlocks[0]?.archivePath === ARC4,
            ),
          JSON.stringify(p4.moveAware.map((x) => [x.doc, x.stats])),
        )
        ok(
          '端到端:报告必须把"因搬运感知未取回 N 行"与出处归档件都说出来(计数行与出处行各说一半 ⇒ 合起来判)',
          /因搬运感知未取回 3 行/.test(formatMoveAwareReport(p4.moveAware).join('\n')) &&
            formatMoveAwareReport(p4.moveAware).some((l) => l.includes(ARC4)),
          formatMoveAwareReport(p4.moveAware).join(' / '),
        )
      } finally {
        rmScratch(d4, { bestEffort: true })
      }
      // ── 端到端:副本指针 cap(G-814386)——纯函数过了不代表 plan() 在真仓里也认这条例外 ──
      {
        const d5 = mkScratch('ihui-union-cap-')
        try {
          const g5 = (...a) => git(a, d5)
          const PTR5 = '〔【归并】重复登记副本(2026-09-26):同主键另一条,派单以那条为准。〕'
          const ROW5 = `- [ ] G-9 同一件事 ${PTR5}`
          g5('init', '-q', '-b', 'main')
          g5('config', 'user.email', 't@t')
          g5('config', 'user.name', 't')
          g5('config', 'core.autocrlf', 'false')
          writeFileSync(join(d5, 'PROJECT_PLAN.md'), `# 台账\n- [ ] 公共行\n`, 'utf8')
          g5('add', '-A')
          g5('commit', '-qm', 'base')
          const base5 = g5('rev-parse', 'HEAD').trim()
          // 对侧 = 一份"滞后的台账副本":同一行指针行被并集追加了三遍
          g5('checkout', '-q', '-b', 'theirs', base5)
          writeFileSync(
            join(d5, 'PROJECT_PLAN.md'),
            `# 台账\n- [ ] 公共行\n${ROW5}\n${ROW5}\n${ROW5}\n- [ ] 别人新写的行\n`,
            'utf8',
          )
          g5('add', '-A')
          g5('commit', '-qm', 'theirs(滞后副本把指针行追加了三遍)')
          const theirs5 = g5('rev-parse', 'HEAD').trim()
          g5('checkout', '-q', '-B', 'ours', base5)
          writeFileSync(join(d5, 'PROJECT_PLAN.md'), '# 台账\n- [ ] 公共行\n- [ ] ours 独有\n', 'utf8')
          g5('add', '-A')
          g5('commit', '-qm', 'ours')
          const p5 = plan(g5('rev-parse', 'HEAD').trim(), theirs5, d5)
          const doc5 = show(p5.tree, 'PROJECT_PLAN.md', d5)
          const copies = doc5.split('\n').filter((l) => l === ROW5).length
          ok(
            '端到端 cap:对侧带指针的同一行有三份 ⇒ 合并树只取回一份(重放被当场拦住)',
            copies === 1 && p5.bad.length === 0,
            JSON.stringify([copies, p5.bad]),
          )
          ok(
            '端到端 cap:同一枚合并必须保住对侧**不带指针**的独有行(不复活 ≠ 丢内容)',
            /^- \[ \] 别人新写的行$/m.test(doc5) && /^- \[ \] ours 独有$/m.test(doc5),
            doc5.replace(/\n/g, '|'),
          )
          ok(
            '端到端 cap:少带的份数必须进 caps 并被点名,不得静默(否则读者只看到"0 丢失")',
            (p5.caps ?? []).length > 0 &&
              /因副本指针有意少带 2 份/.test(
                (p5.caps ?? []).flatMap((c) => formatPointerCapReport(c.capped)).join('\n'),
              ),
            JSON.stringify(p5.caps),
          )
        } finally {
          rmScratch(d5, { bestEffort: true })
        }
      }
      // ── 端到端:影子 .js 不得随合并恢复,而它的**删除**要传播(2026-09-29 用户拍板"在合并规则里堵死")──
      // 三臂成对:A=对侧删影子 ⇒ 删除传播;B=对侧带回与 .ts 同一份字节的影子 ⇒ 拦住;
      // C=对侧那份影子内容与 .ts **不等值** ⇒ 照旧取对侧(证明这一刀是按字节切的,不是按名字切的)。
      {
        const d6 = mkScratch('ihui-union-shadow-')
        try {
          const g6 = (...a) => git(a, d6)
          const TS = 'a.ts'
          const JS = 'a.js'
          const C = 'export const v = 1\n'
          const treeHas = (tree, p) => {
            try {
              git(['rev-parse', `${tree}:${p}`], d6)
              return true
            } catch {
              return false
            }
          }
          g6('init', '-q', '-b', 'main')
          g6('config', 'user.email', 't@t')
          g6('config', 'user.name', 't')
          g6('config', 'core.autocrlf', 'false')
          writeFileSync(join(d6, TS), C, 'utf8')
          writeFileSync(join(d6, JS), C, 'utf8') // 影子:与 .ts 同一份字节
          writeFileSync(join(d6, 'keep.md'), '# keep\n', 'utf8')
          g6('add', '-A')
          g6('commit', '-qm', 'base(ts + 等值影子)')
          const base6 = g6('rev-parse', 'HEAD').trim()

          // A 臂:对侧删掉影子,本侧没动 ⇒ 本工具的产物树里也不该再有它
          g6('checkout', '-q', '-b', 'theirs', base6)
          g6('rm', '-q', JS)
          g6('commit', '-qm', 'theirs(删影子)')
          const theirs6a = g6('rev-parse', 'HEAD').trim()
          g6('checkout', '-q', '-B', 'ours', base6)
          g6('commit', '-q', '--allow-empty', '-m', 'ours(没动)')
          const pa = plan(g6('rev-parse', 'HEAD').trim(), theirs6a, d6)
          ok(
            '端到端 影子A:对侧删掉"与 .ts 同一份字节"的影子 ⇒ 删除随合并传播(不再走 skippedDeletes)',
            !treeHas(pa.tree, JS) &&
              treeHas(pa.tree, TS) &&
              // 字节没丢:合并树里那份 .ts 的 oid **就是**原影子的 oid(内容寻址证明,不是文字比对)
              blobOf(pa.tree, TS, d6) === blobOf(base6, JS, d6) &&
              (pa.shadowDeletes ?? []).length === 1 &&
              pa.shadowDeletes[0].path === JS &&
              !(pa.skippedDeletes ?? []).includes(JS) &&
              pa.bad.length === 0,
            JSON.stringify([pa.shadowDeletes, pa.skippedDeletes, pa.bad]),
          )

          // B 臂:对侧把影子**加回来**(内容仍等于 .ts),本侧从未有过 ⇒ 不恢复
          g6('checkout', '-q', '-B', 'theirs', base6)
          g6('rm', '-q', JS)
          g6('commit', '-qm', 'theirs 基线调整')
          const tb6 = g6('rev-parse', 'HEAD').trim()
          writeFileSync(join(d6, JS), C, 'utf8')
          g6('add', '-A')
          g6('commit', '-qm', 'theirs(把同一份字节又写成 .js)')
          const theirs6b = g6('rev-parse', 'HEAD').trim()
          g6('checkout', '-q', '-B', 'ours', tb6)
          const pb = plan(g6('rev-parse', 'HEAD').trim(), theirs6b, d6)
          ok(
            '端到端 影子B:对侧新增等值影子 ⇒ 不恢复,且必须点名(不得静默当成"这一侧没有")',
            !treeHas(pb.tree, JS) &&
              treeHas(pb.tree, TS) &&
              blobOf(pb.tree, TS, d6) === blobOf(theirs6b, JS, d6) &&
              (pb.shadowRestores ?? []).length === 1 &&
              pb.shadowRestores[0].path === JS &&
              !(pb.tookTheirs ?? []).includes(JS),
            JSON.stringify([pb.shadowRestores, pb.tookTheirs]),
          )

          // C 臂(反向对照,这条才是"没有放宽"):内容与 .ts **不等值** ⇒ 照旧取对侧
          g6('checkout', '-q', '-B', 'theirs', base6)
          writeFileSync(join(d6, JS), C + 'export const other = 2\n', 'utf8')
          g6('add', '-A')
          g6('commit', '-qm', 'theirs(影子有独有内容)')
          const theirs6c = g6('rev-parse', 'HEAD').trim()
          g6('checkout', '-q', '-B', 'ours', base6)
          const pc = plan(g6('rev-parse', 'HEAD').trim(), theirs6c, d6)
          // 内容等值一律按 **blob oid** 证(不按文本比 —— 换行风格会骗人,而 oid 不会)
          const cTreeOid = blobOf(pc.tree, JS, d6)
          const cTheirsOid = blobOf(theirs6c, JS, d6)
          const cTsOid = blobOf(pc.tree, TS, d6)
          ok(
            '端到端 影子C:影子内容与 .ts 不等值 ⇒ 本规则**不触发**,照旧取对侧(按字节切,不按名字切)',
            (pc.tookTheirs ?? []).includes(JS) &&
              cTreeOid === cTheirsOid &&
              cTreeOid !== cTsOid &&
              (pc.shadowRestores ?? []).length === 0 &&
              (pc.shadowDeletes ?? []).length === 0 &&
              pc.bad.length === 0,
            JSON.stringify([pc.tookTheirs, pc.shadowRestores, pc.shadowDeletes, pc.bad]),
          )
        } finally {
          rmScratch(d6, { bestEffort: true })
        }
      }
      // ── 纯函数:影子候选名只认 .js/.cjs/.mjs → .ts/.tsx 这一个方向 ──
      ok(
        '纯函数 影子:候选名方向唯一(.js/.cjs/.mjs → .ts/.tsx;给 .ts 返回空 ⇒ 不会反过来丢 TS 保 JS)',
        JSON.stringify(shadowTsSiblings('a/b.js')) === JSON.stringify(['a/b.ts', 'a/b.tsx']) &&
          JSON.stringify(shadowTsSiblings('a/b.mjs')) === JSON.stringify(['a/b.ts', 'a/b.tsx']) &&
          shadowTsSiblings('a/b.ts').length === 0 &&
          shadowTsSiblings('a/b.md').length === 0 &&
          shadowTsSiblings('a/b').length === 0 &&
          shadowTwinIsIdentical('a/b.js', 'oid1', { 'a/b.ts': 'oid2' }) === null &&
          shadowTwinIsIdentical('a/b.js', 'oid1', { 'a/b.ts': 'oid1' }).path === 'a/b.ts' &&
          shadowTwinIsIdentical('a/b.ts', 'oid1', { 'a/b.js': 'oid1' }) === null,
      )
    }
    // ── 票 G-977960 ②(用户拍板):「删除活不过合并」的对症格 —— 传播删除 ──
    {
      const d7 = mkScratch('ihui-union-del-')
      const g7 = (...a) => git(a, d7)
      try {
        g7('init', '-q', '-b', 'main')
        g7('config', 'user.email', 't@t')
        g7('config', 'user.name', 't')
        g7('config', 'core.autocrlf', 'false')
        // 四个基底路径:orph1(对侧删 ∧ 本侧未动 ⇒ 传播)、orph2(本侧改 ∧ 对侧删 ⇒ modify/delete 分叉,
        // 不传播)、orph3(两侧同删 ⇒ 结果里也不该有)、orph4(本侧删 ∧ 对侧未动 ⇒ 本来就活,钉住不折回)。
        writeFileSync(join(d7, 'orph1.ts'), 'O1\n', 'utf8')
        writeFileSync(join(d7, 'orph2.ts'), 'O2\n', 'utf8')
        writeFileSync(join(d7, 'orph3.ts'), 'O3\n', 'utf8')
        writeFileSync(join(d7, 'orph4.ts'), 'O4\n', 'utf8')
        writeFileSync(join(d7, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
        g7('add', '-A')
        g7('commit', '-qm', 'base(带四条零引用路径)')
        const base7 = g7('rev-parse', 'HEAD').trim()

        g7('checkout', '-q', '-b', 'theirs', base7)
        g7('rm', '-q', 'orph1.ts')
        g7('rm', '-q', 'orph2.ts')
        g7('rm', '-q', 'orph3.ts')
        writeFileSync(join(d7, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n', 'utf8')
        g7('add', '-A')
        g7('commit', '-qm', 'theirs 删三条')
        const theirs7 = g7('rev-parse', 'HEAD').trim()

        g7('checkout', '-q', '-B', 'main', base7)
        writeFileSync(join(d7, 'orph2.ts'), 'O2-OURS-EDIT\n', 'utf8')
        g7('rm', '-q', 'orph3.ts')
        g7('rm', '-q', 'orph4.ts')
        writeFileSync(join(d7, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
        g7('add', '-A')
        g7('commit', '-qm', 'ours 改 orph2、删 orph3/orph4')
        const ours7 = g7('rev-parse', 'HEAD').trim()

        const pd = plan(ours7, theirs7, d7)
        const paths7 = new Set(listPaths(pd.tree, d7))
        ok(
          '② 端到端:对侧删除 ∧ 本侧未动 ⇒ 删除随合并传播(合并树里没有它,且逐路径点名)',
          !paths7.has('orph1.ts') &&
            (pd.propagatedDeletes || []).includes('orph1.ts') &&
            pd.bad.length === 0,
          JSON.stringify([paths7.has('orph1.ts'), pd.propagatedDeletes, pd.skippedDeletes, pd.bad.slice(0, 2)]),
        )
        ok(
          '② 反向锁:对侧删除 ∧ 本侧改过 ⇒ 不传播(modify/delete 分叉,处置权归改写方,本侧内容照旧在)',
          paths7.has('orph2.ts') &&
            blobOf(pd.tree, 'orph2.ts', d7) === blobOf(ours7, 'orph2.ts', d7) &&
            !(pd.propagatedDeletes || []).includes('orph2.ts') &&
            pd.skippedDeletes.length === 1 &&
            pd.skippedDeletes[0] === 'orph2.ts',
          JSON.stringify([pd.propagatedDeletes, pd.skippedDeletes, pd.bad.slice(0, 2)]),
        )
        ok(
          '② 两侧同删 ⇒ 合并结果里也不该有,且一样点名(不得静默)',
          !paths7.has('orph3.ts') && (pd.propagatedDeletes || []).includes('orph3.ts'),
          JSON.stringify([pd.propagatedDeletes, pd.bad.slice(0, 2)]),
        )
        ok(
          '② 另一半:本侧删 ∧ 对侧未动 ⇒ 已删路径不得被合并折回(处置权归本侧,老规矩)',
          !paths7.has('orph4.ts') && !pd.bad.some((b) => b.includes('orph4')),
          JSON.stringify([paths7.has('orph4.ts'), pd.bad.slice(0, 2)]),
        )
        const sha7 = g7('commit-tree', pd.tree, '-p', ours7, '-p', theirs7, '-m', 'union(删除传播)')
        ok(
          '② 传播删除的产物经守门 100 复核 0 丢失(A1 只立罪新增,不管删除)',
          auditOne(sha7, d7).lost.length === 0,
          JSON.stringify(auditOne(sha7, d7).lost),
        )
      } finally {
        rmScratch(d7, { bestEffort: true })
      }
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
  for (const c of cases) console.log(`${c.c ? '✅' : '❌'} ${c.n}${c.c ? '' : ` —— ${c.note}`}`)
  const fail = cases.filter((c) => !c.c).length
  console.log(fail ? `\n❌ ${fail} 例失败` : `全部 ${cases.length} 例通过`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const apply = argv.includes('--apply')
  const ti = argv.indexOf('--theirs')
  // --take-ours <path>(可重复):仅在"两侧同改且能证明对侧那一版在本树必红"时使用。
  //   它不隐藏任何事:输出会逐条列出,合并提交信息里也带同一份清单(见 msg 拼装处)。
  const takeOurs = new Set()
  for (let i = 0; i < argv.length; i++)
    if (argv[i] === '--take-ours' && argv[i + 1]) takeOurs.add(argv[++i])
  // --take-theirs <path>(可重复):与 --take-ours 对称的那一格(2026-09-28 补)。
  //   用它的唯一正当场景是"两侧同一个功能各写一份,而**同一行**被两种写法改写"——
  //   这种冲突 `--resolve` 结构上无解(两侧独有行都留 ⇒ 同名声明重复 ⇒ 编译不过),
  //   于是它只会一路"需人工",把发布链卡在分叉上。声明它 = 该路径的持有者说"本侧是被取代的那一份"。
  //   纪律与 --take-ours 完全一致:逐条声明、逐条打印、写进合并提交信息,绝不默认生效。
  const takeTheirs = new Set()
  for (let i = 0; i < argv.length; i++)
    if (argv[i] === '--take-theirs' && argv[i + 1]) takeTheirs.add(argv[++i])
  // --resolve <path>=<文件>(可重复):人工判完冲突后的**回灌出口**。与 --take-ours 的关键区别:
  //   它不选边 —— 喂进来的整份内容照样过"两侧独有行不得减少"的断言,少哪一侧当场 violations。
  const resolutions = new Map()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a !== '--resolve' || !argv[i + 1]) continue
    const eq = argv[++i].indexOf('=')
    if (eq <= 0) {
      console.log(`❌ --resolve 需要 <path>=<内容文件>,得到的是:${argv[i]}`)
      process.exit(2)
    }
    resolutions.set(argv[i].slice(0, eq), argv[i].slice(eq + 1))
  }
  // --accept-state-growth <维>=<理由>(可重复):并集天然放大的三条量纲(F1 / F4 / F3-rotatedAuto)
  //   的**声明式出口**。它不是"关掉判据" —— 每条都必须带理由,两个读数与理由一起打印,并写进
  //   合并提交信息;维名不认识直接退 2;F5/F6/F9/F9b 与路径零丢失不接受放行(见 planStateRegressions 头注)。
  const accepted = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a !== '--accept-state-growth' || !argv[i + 1]) continue
    const v = String(argv[++i])
    const eq = v.indexOf('=')
    if (eq <= 0) {
      console.log(`❌ --accept-state-growth 需要 <维>=<理由>,得到的是:${v}`)
      process.exit(2)
    }
    const dim = v.slice(0, eq).trim()
    const reason = v.slice(eq + 1).trim()
    if (!dim || !reason) {
      console.log(`❌ --accept-state-growth ${dim || v}:维与理由都不得为空(空理由的放行等于没有判据)`)
      process.exit(2)
    }
    accepted.push({ dim, reason })
  }
  // --move-aware-detail:把"因搬运感知而未取回"的行**逐行**打印(默认只按条目块报计数)。
  const moveAwareDetail = argv.includes('--move-aware-detail')
  const t = resolveTargets(ti >= 0 ? argv[ti + 1] : '')
  if (t.skip) {
    console.log(`[union-converge] ${t.skip} ⇒ 无需合并`)
    process.exit(0)
  }
  if (t.undetermined) {
    // 退出码 2 = "本器没资格判",刻意区别于 1("判了,需人工"):调用方把 2 读成内容裁决,
    // 就会把一次 fetch 说成一次归并失败(git-sync-converge 那一支按措辞分流,见其 ③ 段)。
    // `UNDETERMINED` 是给调用方的**机器可读契约**:git-sync-converge 用它把"没资格判"与
    // "判了、需人工"分开(对面那侧的调用方按这个 token 分流,按中文措辞分流会在换措辞时静默失效)。
    console.log(`[union-converge] UNDETERMINED 未判定:${t.undetermined}`)
    process.exit(2)
  }
  // 显式点名了 --theirs 而本地又落后于它:不再打印"无需合并"(G-815406 同族、G-814402 实测的那次
  // 差点吞掉一整个已验证交付),而是**照常归并并说清为什么**。快进确实是更省的动作,但那是对调用方
  // 说的,不该由本器代替他下结论后 exit 0。
  if (ti >= 0 && String(argv[ti + 1] || '').trim() !== '' && isAncestor(t.head, t.theirs, ROOT))
    console.log(
      '[union-converge] 本地落后于所点名的 --theirs ⇒ 这不是"无需合并";按显式目标照常归并' +
        '(要快进请自己跑 git merge --ff-only,本器不替调用方决定动作)',
    )
  const p = plan(t.head, t.theirs, ROOT, takeOurs, resolutions, takeTheirs, accepted)
  console.log(
    `[union-converge] ${apply ? 'APPLY' : 'CHECK ONLY'} base=${p.base.slice(0, 11)} ours=${t.head.slice(0, 11)} theirs=${t.theirs.slice(0, 11)} / 取对侧 ${p.tookTheirs.length} 路径 / 两侧同改三方归并 ${p.mergedClean.length} / 需人工 ${p.needHuman.length} / 对侧删除不传播 ${p.skippedDeletes.length} / 删除随合并传播 ${p.propagatedDeletes?.length ?? 0} / 影子 .js 随合并删掉 ${p.shadowDeletes?.length ?? 0} / 影子 .js 未恢复 ${p.shadowRestores?.length ?? 0} / 活文档行 union`,
  )
  for (const d of p.skippedDeletes)
    console.log(
      `  · 对侧删除 ∧ 本侧在该路径有独有改动 ⇒ 不随合并生效:${d}(处置权归改写方;确要删请在合并之后显式 git rm)`,
    )
  // 票 G-977960 ②:删除传播必须逐路径报名 —— 静默生效的例外等于没写判据(与影子 .js 两格同一留痕纪律)。
  for (const d of p.propagatedDeletes || [])
    console.log(
      `  · 删除随合并传播:${d}(对侧相对基底删除 ∧ 本侧相对基底未改动 ⇒ 处置权归删除方,零丢失由逐字同一 blob 证明)`,
    )
  // 移动放行必须吼出来:它放的是"本侧把文件 mv 走了"这一类,不是"对侧新增被吞了"那一类。
  // 不点名的话,这条通道就会变成任何人掩盖吞并的借口。
  for (const mv of p.movedPaths || [])
    console.log(`  · 按移动放行(内容逐字节同一 blob,本侧另有该路径):${mv}`)
  // 「未取回」这一维必须自己说话:报告要能回答"你没带回 N 行,因为这 N 行在基准面已有 已归档 占位代表"。
  for (const line of formatMoveAwareReport(p.moveAware, { detail: moveAwareDetail }))
    console.log(line)
  if (p.mergedClean.length)
    console.log(
      `  · 两侧同改的 ${p.mergedClean.length} 个文件已走真三方归并(判据底线 = 各侧独有行重数不减少;\n` +
        '    不判顺序与语义交织 —— 真三方把两侧改动接到不同位置时顺序本就会变,这属局限而非已验证正确)',
    )
  for (const h of p.needHuman)
    console.log(
      `  ❌ ${h.path} —— ${h.kind}:${h.detail}(本工具不猜、不选边,请人工判这一个文件;` +
        `判好后用 --resolve '${h.path}=<整份内容文件>' 回灌,它会替你的判断做两侧丢行断言)`,
    )
  for (const d of p.generatedDeferred || [])
    console.log(
      `  🧾 ${d.path} —— 生成物冲突(自证标记 "${d.marker}")⇒ 不按人工判、也不选边:` +
        `内容权威在"重生成"而不是"合并"。本枚按本侧内容留下,**落地后必须立刻跑该文件的生成器**` +
        `(否则 HEAD 里留着的是一份旧产物,而守门 105 一类的钉判据会咬到陈旧)。`,
    )
  for (const r of p.humanResolved || [])
    console.log(
      `  · 人工归并已回灌:${r}(内容取自 --resolve;两侧独有行丢行断言已在这份内容上跑过,未过即 bad)`,
    )
  // 声明式放行过的量纲必须在这里说话:它放的是"并集的天然后果",不是"这条判据不成立"。
  for (const r of p.acceptedGrowth || []) console.log(`  ⚠️ 已声明放行:${r}`)
  for (const r of p.keptTheirs || [])
    console.log(
      `  · 取对侧(已声明):${r} —— 本侧在该路径的独有行被取代(同一行两种写法,--resolve 无解);声明者须附"哪一份是被消费的"取证`,
    )
  // 副本指针 cap 必须**当着落地那一刻**打出来 —— 它不是违规,但把它静默折进"0 丢失"就等于
  // 用一条从未被点名的例外,替下一次的人做出"什么都没少"的判断(§"把没判写成判过了"同一条禁令)。
  const capRows = (p.caps || []).flatMap((c) => [
    `  ℹ ${c.label}:本族带「重复登记副本」指针,有意只带一份(每条仍保留 ≥1 份 ⇒ 少的是份数,不是信息)`,
    ...formatPointerCapReport(c.capped),
  ])
  for (const line of capRows) console.log(line)
  const capDropped = (p.caps || []).reduce((s, c) => s + (c.capped?.reduce((a, e) => a + e.dropped, 0) ?? 0), 0)
  if (p.bad.length) {
    console.log(`❌ 落地闸不过 ${p.bad.length} 处:`)
    for (const b of p.bad.slice(0, 15)) console.log(`   ${b}`)
    // F9 判红时必须给出**可执行的出路**,只喊"需人工"的结局本仓写死了(§12e/§12f):每台每次跳钩子。
    // 只打印出路,不碰判据本体;出路里插的是**当次那枚远端 sha**,不是占位文案。
    if (p.bad.some((b) => String(b).includes('F9 归并新增撞号组')))
      console.log(
        `  ➜ F9 出路(可执行,缺省档零副作用,从不写工作树):\n` +
          `     node scripts/plan-collide-renumber.mjs ${t.theirs}\n` +
          `     —— 它用台账那一份键位口径(编号/标题/畸形号全在 lib/plan-task-index.mjs)算出本次归并会新增的撞号组,` +
          `只让未推的本地一侧改号;\n` +
          `     并把**改前整行原文**逐字追加进已入库的归档件(门 71 的归档豁免因此当场成立,而不是等 60 枚提交窗口过去)。` +
          `让号有效性按 own + max(0, 对侧 − max(基底, own)) 现读,该式子的唯一实现就是本器 import 的 liveDocExpectedCounts。\n` +
          `     核对报告后加 --apply 产出 blob(仍不写工作树、从不 commit);判不出的组一律点名拒绝构造。\n` +
          `     禁止的出路:放宽 F9、删任一侧的行、把注记插进编号位(那会改掉复合主键,反而造出新的撞号组)。`,
      )
    process.exit(1)
  }
  if (!apply) {
    console.log('  未落地(加 --apply 才建合并提交;本工具从不 checkout、不碰共享工作区)')
    process.exit(0)
  }
  const msg =
    `Merge ${t.theirs} into ${t.head} —— 文件面零丢失 union(本侧整棵树 ∪ 对侧自身改动 ∪ 两侧同改三方归并 ∪ 活文档行 union)` +
    (p.humanResolved?.length
      ? `;人工归并回灌(已过两侧丢行断言): ${p.humanResolved.join(' ')}`
      : '') +
    (p.keptOurs?.length ? `;取本侧(已声明+可复核): ${p.keptOurs.join(' ')}` : '') +
    // 票 G-977960 ② 的留痕:删除传播不再走"默认折回",后来人只读 git log 也必须看得出
    // **这条不在旧通则里**(对侧删除本来是刻意不传播的),以及它是按什么证明零丢失的。
    (p.propagatedDeletes?.length
      ? `;删除随合并传播(对侧相对基底删除 ∧ 本侧相对基底未改动,零丢失由逐字同一 blob 证明): ${p.propagatedDeletes.join(' ')}`
      : '') +
    // 影子 .js 两格的留痕:这一型是"删除被传播 / 回归被拦住",零损失由 blob oid 逐字相等证明,
    // 但后来人只读 git log 也必须能看出**这两条不在默认通则里**(对侧删除本来是刻意不传播的)。
    (p.shadowDeletes?.length
      ? `;影子 .js 删除已传播(与同 stem .ts 同一份字节,零损失由内容寻址证明): ${p.shadowDeletes.map((x) => `${x.path}⇔${x.twin}`).join(' ')}`
      : '') +
    (p.shadowRestores?.length
      ? `;影子 .js 未随合并恢复(同一份字节): ${p.shadowRestores.map((x) => `${x.path}⇔${x.twin}`).join(' ')}`
      : '') +
    (p.keptTheirs?.length ? `;取对侧(已声明+可复核): ${p.keptTheirs.join(' ')}` : '') +
    (p.acceptedGrowth?.length
      ? `;已声明放行的量纲放大(带理由,非静默): ${p.acceptedGrowth.join(' | ')}`
      : '') +
    // 生成物"待重生成"必须进提交信息:后来人只读 git log 也要知道这一项不是已对齐
    (p.generatedDeferred?.length
      ? `;生成物按本侧留下、落地后需重生成: ${p.generatedDeferred.map((d) => d.path).join(' ')}`
      : '') +
    // 例外必须进提交信息:后来人只读 `git log` 也要知道"份数少带"是本票的判据,不是一次丢行
    (capDropped
      ? `;副本指针行有意少带 ${capDropped} 份(每条仍保留 ≥1 份;判据见台账 G-814386)`
      : '')
  const sha = git(['commit-tree', p.tree, '-p', t.head, '-p', t.theirs, '-m', msg])
  const cas = spawnSync(
    GIT,
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'update-ref', 'refs/heads/main', sha, t.head],
    {
      cwd: ROOT,
      windowsHide: true,
      // 根治:本会话 Node 建子进程 stdin 管道会 EBUSY,git 不吃 stdin。
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
      encoding: 'utf8',
    },
  )
  if (cas.status !== 0) {
    // CAS 失败留下的这枚悬空提交**本工具自己兜掉**:守门 30a 会因为"未备份悬空 commit"
    // 拦下此后每一次提交(今天实测连吃数轮 --no-verify,而一次绕过 = 约 130 道门作废)。
    // 与其把噪声留给下一个人,就地按 §22 的规矩打 tag —— tag 只是加引用,不改任何历史。
    const tagName = `lost-commit/wip-${sha.slice(0, 10)}`
    let tagged = false
    try {
      git(['tag', tagName, sha, '-m', 'union-converge CAS 失败的悬空合并提交(§22 备份)'])
      tagged = true
    } catch {
      /* tag 失败不得掩盖原始故障,下面如实说明 */
    }
    console.log(
      `❌ CAS 失败(HEAD 被他人推进)⇒ 本轮作废,重跑即可;产物 ${sha.slice(0, 11)} ${tagged ? `已按 §22 备份为 ${tagName}(随后由 tag-sync 推远端)` : `是悬空提交且 tag 失败 ⇒ 手工:git tag ${tagName} ${sha}`} —— 不这么做,守门 30a 会替我们记住这笔`,
    )
    process.exit(1)
  }
  const lost = auditOne(sha)
  console.log(
    `✅ 合并落地 ${sha.slice(0, 12)}${lost.lost.length ? ` —— ⚠️ A1 复核仍报 ${lost.lost.length} 处` : ',A1 复核 0 丢失'}`,
  )
  // 旁路合并不跑 post-commit ⇒ 守门 71 的登记行自愈永不触发;而 commit-tree + CAS 也不写钩子链那本
  // 跳门台账 ⇒ 这枚提交在总量统计里会永远落进 unknown(AGENTS §12f 那条"两个来源合起来才是总量")。
  // 两条都在落地这一刻补上,且**都不改本轮结论**:自愈失败只喊一行,留痕按 lib 契约永不抛。
  recordBypassLanding({
    root: ROOT,
    source: 'union-converge --apply',
    landedSha: sha,
    headBefore: t.head,
    declaredFiles: [...new Set([...LIVE_DOCS, ...p.tookTheirs])],
    reason:
      '旁路合并落地(commit-tree + CAS)不触发钩子 ⇒ 提交链上的门禁对本枚未执行;' +
      '声明路径 = 本器构造出内容的那些(活文档 ∪ 取对侧版本的路径)',
  })
  postMergeLedgerSync({ root: ROOT })
  process.exit(lost.lost.length ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  buildUnion,
  unionLines,
  verifyUnion,
  resolveTargets,
  hasCommit,
  unreachableObjectGuidance,
  plan,
  listPaths,
  show,
  blobOf,
  diffNames,
  lostAddedLines,
  planStateRegressions,
  mergeNoteCrossLineCaliber,
  mergeThreeBlobs,
  liveDocExpectedCounts,
  theirsRewriteCaps,
  moveAwareForDoc,
  formatMoveAwareReport,
  formatPointerCapReport,
  LIVE_DOCS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
