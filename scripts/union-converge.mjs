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
 *   落地前自证:丢本侧路径 = 0 ∧ 丢对侧路径 = 0 ∧ 三份文档未存活行 = 0 ∧ 两侧同改文件的**独有行不丢**
 *             (字符行 multiset 底线;真三方可能把两侧改动交织到不同位置,本断言只保证重数不减少、
 *              不判语义顺序 —— 局限如实说明,不假装更强);
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
 *   node scripts/union-converge.mjs --resolve '<path>=<内容文件>' [--resolve ...]
 *       # 真三方报冲突后,**人工判完的回灌出口**(2026-09-26 立)。此前"请人工判"是一句死路:
 *       #   工具不接收人工结果,人只能去做裸 git 手术(read-tree/commit-tree/update-ref),
 *       #   从而绕过本工具全部断言 —— 只判不修的门逼人绕过,这条对工具自己同样成立。
 *       # 它与 --take-ours 的区别是本条的安全前提:喂进来的**整份内容**照样跑
 *       #   "两侧独有行重数不得减少"的断言,少哪一侧就当场 bad ⇒ 它不是选边的别名。
 *   node scripts/union-converge.mjs --self-test      # 真临时仓取证(含"选边必判失败"反向对照)
 * 退出码:0 = 无需合并或已落地且复核干净;1 = 判据不过/两侧同改冲突需人工/CAS 失败;2 = 脚本自身异常。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { auditOne } from './check-merge-addition-loss.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
import { resolveRemoteHead } from './lib/face-reader.mjs'
import { auditPlan } from './lib/plan-task-index.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = 'C:/Program Files/Git/cmd/git.exe'
/** 多会话共写的活文档:行级 union(其余文件按路径整体取某一侧) */
export const LIVE_DOCS = ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md']
const GIT_TIMEOUT = 300000

function git(args, cwd = ROOT, input) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    input,
    encoding: 'utf8',
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
    return git(['rev-parse', `${rev}:${p}`], cwd)
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
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'buffer',
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

/** 树里该路径的 mode(100644/100755/120000/160000);取不到返回 ''(交人工,不猜)。 */
function modeOf(rev, p, cwd) {
  try {
    return git(['ls-tree', rev, '--', p], cwd).match(/^(\d{6})\s/)?.[1] ?? ''
  } catch {
    return ''
  }
}

function writeBlob(content, p, cwd) {
  return execFileSync(
    GIT,
    ['-c', 'safe.directory=*', 'hash-object', '-w', '--path', p, '--stdin'],
    {
      cwd,
      input: content,
      encoding: 'utf8',
      windowsHide: true,
      timeout: GIT_TIMEOUT,
      maxBuffer: 512 * 1048576,
    },
  ).trim()
}

function emptyBlob(cwd) {
  try {
    return git(['hash-object', '-w', '--stdin'], cwd, '')
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
 */
export function planStateRegressions(mergedText, sideTexts) {
  const KEYS = [
    ['forks', 'F1 同主键两态并存(组)'],
    ['voidRows', 'F2 带作废声明未落账(行)'],
    ['rotatedPointers', 'F3 行号指针已腐烂(处)'],
    ['dupOpenCopies', 'F4 同一件事多条待办(副本行)'],
  ]
  const sides = (sideTexts ?? []).filter((t) => typeof t === 'string' && t.trim() !== '')
  if (typeof mergedText !== 'string' || mergedText.trim() === '' || sides.length === 0) return []
  const m = auditPlan(mergedText).counts
  const out = []
  for (const [k, label] of KEYS) {
    const worst = Math.max(...sides.map((t) => auditPlan(t).counts[k]))
    if (m[k] > worst) out.push(`${label} 各侧最多 ${worst},归并结果 ${m[k]}`)
  }
  return out
}

export function lostAddedLines(baseText, sideText, otherText, mergedText) {
  const cb = counter(baseText)
  const cs = counter(sideText)
  const co = counter(otherText)
  const cm = counter(mergedText)
  const out = []
  for (const [l, n] of cs) {
    const added = n - (cb.get(l) || 0)
    if (added <= 0) continue
    const removedByOther = Math.max(0, (cb.get(l) || 0) - (co.get(l) || 0))
    if ((cm.get(l) || 0) < Math.max(0, added - removedByOther)) out.push(l)
  }
  return out
}

/**
 * 活文档三方行 union 的**期望重数表**:`结果[l] = 本侧重数 + max(0, 对侧重数 − max(基底重数, 本侧重数))`。
 *
 * 为什么必须带基底这一维(2026-09-25 实测逼出来的,不是理论洁癖):
 * 旧写法 `结果 = max(本侧, 对侧)` 在**本侧就地改写某一行**时必然把改写前的旧行复活 ——
 * 本侧旧行 0 份 / 新行 1 份,对侧旧行 1 份未动 ⇒ max 把旧行判成"对侧多出来的",补回末尾。
 * 于是活文档里同时留下新旧两份同体行,而 `- [ ]`/`- [x]` 这种**行首就是状态位**的行被复活,
 * 等于把刚刚翻勾的待办又变回未认领(实测:`check-task-claims` 当场重新报成可派)。
 * 只有"对侧**相对基底新增**的行"才是本工具存在的理由(保住别人的独有行);
 * 对侧相对基底没动、而被本侧改掉/删掉的行,处置权在本侧。
 */
export function liveDocExpectedCounts(oursText, theirsText, baseText = null) {
  const co = counter(oursText)
  const ct = counter(theirsText)
  const cb = baseText === null ? new Map() : counter(baseText)
  const want = new Map(co)
  for (const [l, n] of ct) {
    const own = co.get(l) || 0
    const addedByTheirs = Math.max(0, n - Math.max(cb.get(l) || 0, own))
    if (addedByTheirs > 0) want.set(l, own + addedByTheirs)
  }
  return want
}

/** 行级 union:以本侧顺序为脊柱,把对侧**相对基底新增**的重数补在末尾。 */
export function unionLines(oursText, theirsText, baseText = null) {
  const want = liveDocExpectedCounts(oursText, theirsText, baseText)
  const out = oursText.split('\n')
  const need = new Map(want)
  for (const [l, n] of counter(oursText)) need.set(l, (need.get(l) || 0) - n)
  const extra = []
  for (const l of theirsText.split('\n')) {
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

/** 构造合并树。临时索引走 §26 的夹具唯一落点 `mkScratch` ——
 *  硬编码 `cwd/.ihui-agent/tmp` 会在"对临时仓库做取证"时直接 ENOENT(自检第一轮即如此),
 *  而且把夹具写进仓库树内还会让 git 的 toplevel 向上逃逸。
 *  返回 needHuman(冲突/二进制/取不到 mode ⇒ 交人工)与 violations(两侧同改的丢行断言),
 *  两者都在本函数里算:归并结果的内容此刻已在手上,不必再派生一次 git 去重读。 */
export function buildUnion(base, ours, theirs, cwd = ROOT, takeOurs = new Set(), resolutions = new Map()) {
  const scratch = mkScratch('union-idx')
  const idx = join(scratch, 'index')
  try {
    const env = { ...process.env, GIT_INDEX_FILE: idx }
    const run = (args) =>
      execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
        cwd,
        env,
        windowsHide: true,
        timeout: GIT_TIMEOUT,
        encoding: 'utf8',
        maxBuffer: 512 * 1048576,
      }).trim()
    run(['read-tree', ours])

    // 1) 活文档:三方行 union(对侧相对基底的**独有行**必须存活;本侧就地改写的行不得被旧副本复活)
    for (const p of LIVE_DOCS) {
      const a = show(ours, p, cwd)
      const b = show(theirs, p, cwd)
      if (a === b) continue
      const bt = base ? show(base, p, cwd) : null
      const oid = git(['hash-object', '-w', '--path', p, '--stdin'], cwd, unionLines(a, b, bt))
      run(['update-index', '--add', '--cacheinfo', `100644,${oid},${p}`])
    }

    // 2) 对侧「相对共同基底自己动过」的路径:仅对侧动过 ⇒ 取对侧版本;两侧同改 ⇒ 真三方归并。
    //    (活文档已在 1) 归并,两条路都不整体覆盖)
    const tookTheirs = []
    const mergedClean = []
    const skippedDeletes = []
    const needHuman = []
    const keptOurs = []
    const humanResolved = []
    const violations = []
    const touchedOurs = new Set(diffNames(base, ours, cwd))
    for (const p of diffNames(base, theirs, cwd)) {
      if (LIVE_DOCS.includes(p)) continue
      const theirsBlob = blobOf(theirs, p, cwd)
      if (theirsBlob === null) {
        skippedDeletes.push(p) // 对侧删除不随合并传播,否则本工具的产物会被守门 100 判红
        continue
      }
      const oursBlob = blobOf(ours, p, cwd)
      if (oursBlob === theirsBlob) continue
      // 本侧未动(或本侧已删 ⇒ 删除同样不传播,与"对侧删除"对称)⇒ 整文件取对侧,语义与改前逐字一致
      if (!touchedOurs.has(p) || oursBlob === null) {
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
        for (const l of lostAddedLines(baseText, oursText, theirsText, text))
          violations.push(`${p} 人工归并结果丢本侧独有行:${l.slice(0, 60)}`)
        for (const l of lostAddedLines(baseText, theirsText, oursText, text))
          violations.push(`${p} 人工归并结果丢对侧独有行:${l.slice(0, 60)}`)
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
      for (const l of lostAddedLines(baseText, oursText, theirsText, mergedText))
        violations.push(`${p} 两侧同改后本侧独有行丢失:${l.slice(0, 60)}`)
      for (const l of lostAddedLines(baseText, theirsText, oursText, mergedText))
        violations.push(`${p} 两侧同改后对侧独有行丢失:${l.slice(0, 60)}`)
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
      for (const msg of planStateRegressions(blobText(mergedOid, cwd), sideTexts))
        violations.push(`${p} 归并放大任务状态分叉:${msg}`)
    }
    return {
      tree,
      tookTheirs,
      mergedClean,
      skippedDeletes,
      needHuman,
      keptOurs,
      humanResolved,
      violations,
    }
  } finally {
    rmScratch(scratch)
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
export function verifyUnion(ours, theirs, tree, cwd = ROOT, base = null) {
  const M = new Set(listPaths(tree, cwd))
  const bad = []
  const moved = []
  for (const p of listPaths(ours, cwd)) if (!M.has(p)) bad.push(`合并树丢了本侧路径 ${p}`)
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
    const want = liveDocExpectedCounts(a, b, bt)
    const m = counter(show(tree, p, cwd))
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
  return bad
}

/** 找一对需要合并的输入;skip 非空表示无事可做。 */
export function resolveTargets(theirsArg, cwd = ROOT) {
  const head = git(['rev-parse', 'HEAD'], cwd)
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
  let theirs = theirsArg
  if (!theirs) {
    try {
      // 远端位置只认**当次真值**(§5b:跟踪 ref 会被清理层删掉,packed-refs 里的旧值照样被读回来)。
      // 拿残值落槌有两种都不报错的错向:残值==本地 ⇒ 报"已同步"而根本不合并;残值落后 ⇒ 去合一个
      // 早已不存在的分叉。取不到就当"无法判定"交回上层,绝不猜一个 stage 用。
      const r = resolveRemoteHead(branch, { root: cwd })
      if (!r.sha)
        return {
          head,
          theirs: '',
          skip: `取不到 ${branch} 的当次远端真值(不拿跟踪 ref 残值落槌):${r.reason}`,
        }
      theirs = r.sha
    } catch (e) {
      return {
        head,
        theirs: '',
        skip: `取远端 ${branch} 异常:${String((e && e.message) || e).slice(0, 90)}`,
      }
    }
  }
  if (theirs === head) return { head, theirs, skip: '已同步' }
  if (isAncestor(theirs, head, cwd)) return { head, theirs, skip: '目标已被本地包含' }
  if (isAncestor(head, theirs, cwd))
    return { head, theirs, skip: '本地纯落后 ⇒ 走 ff/converge,不用 union' }
  return { head, theirs, skip: null }
}

function isAncestor(a, b, cwd) {
  return (
    spawnSync(GIT, ['-c', 'safe.directory=*', 'merge-base', '--is-ancestor', a, b], {
      cwd,
      windowsHide: true,
      timeout: 120000,
      encoding: 'utf8',
    }).status === 0
  )
}

export function plan(ours, theirs, cwd = ROOT, takeOurs = new Set(), resolutions = new Map()) {
  const base = git(['merge-base', ours, theirs], cwd)
  const built = buildUnion(base, ours, theirs, cwd, takeOurs, resolutions)
  // needHuman 同时进 bad:任何只看 bad 的调用方(含 git-sync-converge 之外的使用者)都不可能
  //   把一枚含冲突文件的树落地。冲突详情仍单独留清单,报告要点名到"是哪个文件"。
  const blocked = built.needHuman.map((h) => `${h.path} 需人工判(${h.kind}):${h.detail}`)
  const vu = verifyUnion(ours, theirs, built.tree, cwd, base)
  return {
    base,
    ...built,
    bad: [...built.violations, ...blocked, ...vu],
    // 按移动放行的那些路径(内容级判据,见 verifyUnion 头注)—— 报告必须逐条点名
    movedPaths: vu.moved,
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
    ok(
      '对侧的删除不随合并传播(合并之后显式删才算)',
      paths.has('keep.ts'),
      'keep.ts 被顺手删了 ⇒ 与"取某一侧"无区别',
    )
    ok('对侧删除项如实报数', p.skippedDeletes.includes('keep.ts'), JSON.stringify(p.skippedDeletes))
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
      writeFileSync(join(d2, 'both.bin'), Buffer.from('A\u0000b\u0000c\n'))
      writeFileSync(join(d2, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
      r2('add', '-A')
      r2('commit', '-qm', 'ours')
      const o2 = r2('rev-parse', 'HEAD')

      r2('checkout', '-q', 'HEAD~1')
      writeFileSync(join(d2, 'clean.ts'), 'l1\nl2\nl3\nTHEIRS\nl5\n', 'utf8')
      writeFileSync(join(d2, 'clash.ts'), 'x1\nTHEIRS\nx3\n', 'utf8')
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
      rmScratch(d2)
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
    // 任务状态分叉不得被并集放大(纯函数;这正是"两份真相"的产地)
    const PS_A = '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。\n'
    const PS_B = '- [ ] **D9 同一件事**:另一侧还挂着未勾。\n'
    ok(
      '状态判据:两侧各 0 分叉,并集归并出 1 组必须报(并集策略就是副本产地)',
      planStateRegressions(PS_A + PS_B, [PS_A, PS_B]).join('').includes('F1'),
      JSON.stringify(planStateRegressions(PS_A + PS_B, [PS_A, PS_B])),
    )
    ok('状态判据:结果与较好一侧持平 ⇒ 不得报', planStateRegressions(PS_A, [PS_A, PS_B]).length === 0)
    ok(
      '状态判据:副本被正确翻勾(两侧并集但状态一致)⇒ 不算放大',
      planStateRegressions(PS_A + PS_B.replace('- [ ]', '- [x] ✅(2026-09-26) '), [PS_A, PS_B]).length === 0,
    )
    ok(
      '状态判据:输入取不到(空文本/无对照侧)⇒ 返回空且不声称已判(调用方只对真做了判定的路径说话)',
      planStateRegressions('', [PS_A]).length === 0 && planStateRegressions(PS_A, []).length === 0,
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
        rmScratch(d3)
      }
    }
  } finally {
    rmScratch(dir)
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
  const t = resolveTargets(ti >= 0 ? argv[ti + 1] : '')
  if (t.skip) {
    console.log(`[union-converge] ${t.skip} ⇒ 无需合并`)
    process.exit(0)
  }
  const p = plan(t.head, t.theirs, ROOT, takeOurs, resolutions)
  console.log(
    `[union-converge] ${apply ? 'APPLY' : 'CHECK ONLY'} base=${p.base.slice(0, 11)} ours=${t.head.slice(0, 11)} theirs=${t.theirs.slice(0, 11)} / 取对侧 ${p.tookTheirs.length} 路径 / 两侧同改三方归并 ${p.mergedClean.length} / 需人工 ${p.needHuman.length} / 对侧删除不传播 ${p.skippedDeletes.length} / 活文档行 union`,
  )
  for (const d of p.skippedDeletes)
    console.log(`  · 对侧删除不随合并生效:${d}(确要删请在合并之后显式 git rm)`)
  // 移动放行必须吼出来:它放的是"本侧把文件 mv 走了"这一类,不是"对侧新增被吞了"那一类。
  // 不点名的话,这条通道就会变成任何人掩盖吞并的借口。
  for (const mv of p.movedPaths || [])
    console.log(`  · 按移动放行(内容逐字节同一 blob,本侧另有该路径):${mv}`)
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
  for (const r of p.humanResolved || [])
    console.log(
      `  · 人工归并已回灌:${r}(内容取自 --resolve;两侧独有行丢行断言已在这份内容上跑过,未过即 bad)`,
    )
  if (p.bad.length) {
    console.log(`❌ 落地闸不过 ${p.bad.length} 处:`)
    for (const b of p.bad.slice(0, 15)) console.log(`   ${b}`)
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
    (p.keptOurs?.length ? `;取本侧(已声明+可复核): ${p.keptOurs.join(' ')}` : '')
  const sha = git(['commit-tree', p.tree, '-p', t.head, '-p', t.theirs, '-m', msg])
  const cas = spawnSync(
    GIT,
    ['-c', 'safe.directory=*', 'update-ref', 'refs/heads/main', sha, t.head],
    {
      cwd: ROOT,
      windowsHide: true,
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
  plan,
  listPaths,
  show,
  blobOf,
  diffNames,
  lostAddedLines,
  planStateRegressions,
  mergeThreeBlobs,
  LIVE_DOCS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
