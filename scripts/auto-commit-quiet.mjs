#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * auto-commit-quiet.mjs —— 无人认领的未提交改动自动收编(2026-10-22 机主令)
 *
 * 存在理由:仓库只有 post-commit 自动推送,没有自动提交;并行席位的半成品会一直
 * 挂在工作区,久了既挡别人的门、又有被并发 checkout 覆盖的风险(§12d 事故面)。
 * 本器在"改动停止呼吸"之后才动手,做到既不全天候抢提交他人的活,也不让任何改动无限期悬空。
 *
 * 判定(全部满足才提交):
 *   1. `git status` 有改动;
 *   2. 所有改动文件的 mtime 都早于 QUIET_MIN 分钟(默认 3,2026-10-22 提速)—— 还在写的一律放过;
 *   3. 无未解决冲突(UU/AA/DD)、无 .git/index.lock、无进行中的守门批;
 *   4. 只收编源码/配置/文档,排除 .env*、node_modules、.next、tmp、日志、二进制。
 *
 * 落地走 safe-commit(全门冻结索引),失败只记日志不重试轰炸;调度器下一轮自然重来。
 * 用法: node scripts/auto-commit-quiet.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw } from './lib/face-reader.mjs'
// 已结清行回退判据(§0.6 单一真相源):本器只 import,不抄第二份"什么算已结清/同一件事"。
import { closedRowRegressions } from './lib/ledger-closed-rows.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIET_MIN = Number(process.env.IHUI_AUTO_COMMIT_QUIET_MIN || 3)
const DRY = process.argv.includes('--dry-run')
const LOG = join(ROOT, '.ihui-agent', 'state', 'hook-logs', 'auto-commit-quiet.log')

const EXCLUDE = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)\.ihui-agent\/tmp\//,
  /(^|\/)\.ihui-agent\/state\/hook-logs\//,
  /\.log$/,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|apk|aab|jar|so|dll|exe|mp4|woff2?)$/i,
  // 人工台账**不**在此排除(2026-10-22 改):`PROJECT_PLAN.md`/`AGENTS.md` 是多席位并发改写的
  // 活文档,但"永不收编"会让改动永久悬挂(实测一份工作树副本吃掉 HEAD 已入库的 7 行)。
  // 处置改为收编前先过 merge-live-doc 归并(见 mergeLiveDocs):归并后 lost≠0 / 长行重复新增
  // 的本轮剔除,其余正常收编 —— 既不丢行,也不留无人认领的改动。
]
/** 排除表唯一判据(§0.6 单一真相源):主流程与镜像测试 import 同一份,不复制表。 */
function isExcluded(path) {
  return EXCLUDE.some((re) => re.test(path))
}

/** 活文档:收编前必须归并(工作树副本可能滞后于 HEAD,直接提交会吞掉别人已入库的行)。 */
const HUMAN_LEDGER_RE = /(^|\/)(PROJECT_PLAN|AGENTS)\.md$/
/** README 生成数字块(由 sync-readme-numbers.mjs 独占写入)。 */
const README_FILES = ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md']

function git(args, opts = {}) {
  // 派生 git 一律走脚本层(lib/face-reader 的 gitRaw,G-927 2026-10-22):裸起 'git' 会被
  // scripts/tests/face-reader.test.mjs 的"裸派生生产文件只减不增"棘轮记为新增者。层内同批兜住
  // 原先手写的三件事(显式 stdio §12g、windowsHide 强制生效、带 input 时 stdin=pipe),
  // maxBuffer 默认 64MB 与本器原值同档;绝对路径 git 二进制与 safe.directory 纪律一并拿到。
  return gitRaw(args, ROOT, opts)
}

/**
 * 滞后副本判据(纯函数;镜像测试直接用它,§22c)。
 *
 * 立因(2026-10-25 实测,不是推测):旁路落地(`object-space-land`)只推进 HEAD 与索引,**不写工作树**;
 * 本器 3 分钟后按工作树字节收编,就把那笔已入库的改动整份写回旧版。实测一枚 `chore(auto)` 在同一文件里
 * 回退了绑定手机/邮箱两端点 88 行与门 198 的 updatedAt 出口形态两处,HEAD 面行为锁 7/7 全红。
 *
 * 判据:工作树 blob ≠ HEAD blob,却等于该路径某个**祖先提交**的同路径 blob ⇒ 滞后副本。
 * 失效方向刻意保持收编(任一探针取不到 ⇒ 当"不是滞后副本"),只有**证实**才跳过并点名,
 * 让"有意回退"由人显式提交(§0.10:失效方向必须是多要一次定向说明)。
 */
export function partitionStaleCopies(paths, probes) {
  const kept = []
  const skipped = []
  for (const p of paths) {
    const wt = probes.worktree(p)
    const head = probes.head(p)
    if (!wt || !head || wt === head) {
      kept.push(p)
      continue
    }
    const ancestors = probes.ancestors(p) || []
    if (ancestors.includes(wt)) skipped.push(p)
    else kept.push(p)
  }
  return { kept, skipped }
}

/** git 探针(取不到一律返回 null ⇒ fail-open,保持原收编行为)。 */
function staleCopyProbes(p) {
  const oid = (ref) => {
    try {
      return git(['rev-parse', ref]).trim()
    } catch {
      return null
    }
  }
  return {
    worktree: () => {
      try {
        return git(['hash-object', '--', p]).trim()
      } catch {
        return null
      }
    },
    head: () => oid(`HEAD:${p}`),
    ancestors: () => {
      let commits = []
      try {
        commits = git(['log', '-n', '6', '--format=%H', '--', p])
          .trim()
          .split('\n')
          .filter(Boolean)
      } catch {
        return []
      }
      const out = []
      for (const c of commits) {
        const b = oid(`${c}:${p}`)
        if (b) out.push(b)
      }
      return out
    },
  }
}

/**
 * 审**全部**候选路径(2026-10-29 取消「已暂存 = 明确意图」那条豁免)。
 *
 * 立因(现读事故,不是推测):b44ab834609(00:36:57)把 a3facca58f3(00:32:48,早 4 分钟)
 * 刚入库的 relay 守卫②整份写回旧版。当时那三个路径被别席暂存过 ⇒ 落进旧豁免 ⇒ 守卫
 * 一次都没问。而本器落地走 safe-commit,它 Step1 `git reset HEAD` 清索引、Step2
 * `git add -A <声明集>` ⇒ **真正入库的是工作树字节**,与"谁暂存过"毫无关系。
 * 所以"已暂存"既不能证明工作树内容是新的,也不能证明提交出去的就是那份暂存。
 *
 * `changes` 参数保留(调用方仍在传,且它是本器其它判据的输入),但不再参与豁免决策。
 * 失效方向仍是"少收编一次":判成滞后就跳过并逐条点名,人想显式提交随时可以(§0.10)。
 */
function dropStaleCopies(stale, changes, probeFactory = staleCopyProbes) {
  if (!stale.length) return { kept: stale, skipped: [] }
  const { skipped } = partitionStaleCopies([...stale], {
    worktree: (p) => probeFactory(p).worktree(),
    head: (p) => probeFactory(p).head(),
    ancestors: (p) => probeFactory(p).ancestors(),
  })
  return { kept: stale.filter((p) => !skipped.includes(p)), skipped }
}

function log(line) {
  mkdirSync(dirname(LOG), { recursive: true })
  appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`)
}

function guardBusy() {
  if (existsSync(join(ROOT, '.git', 'index.lock'))) return 'index.lock 在用'
  const preCommitLog = join(ROOT, '.ihui-agent', 'state', 'hook-logs', 'pre-commit.log')
  if (!existsSync(preCommitLog)) return null
  const ageSec = (Date.now() - statSync(preCommitLog).mtimeMs) / 1000
  if (ageSec > 30) return null // 半分钟没人写 ⇒ 批次已结束(旧实现按 6 分钟判,把刚跑完的批次误当在跑,导致永远让路)
  // 最近 30 秒内有写入:再取一次大小确认是否仍在增长(3 秒采样,避免误判)
  const size1 = statSync(preCommitLog).size
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000) // 真同步睡眠,不烧 CPU
  const size2 = statSync(preCommitLog).size
  if (size2 !== size1) return `守门批正在写(pre-commit.log 30 秒内仍在增长:${size1}→${size2})`
  return null
}

/** 解析 porcelain -z: 每条 `XY path`(重命名带两个 NUL 段),返回 {xy, path} */
function listChanges() {
  const raw = git(['status', '--porcelain', '-z']).split('\0')
  const out = []
  for (let i = 0; i < raw.length; i++) {
    const rec = raw[i]
    if (!rec || rec.length < 4) continue
    const xy = rec.slice(0, 2)
    let path = rec.slice(3)
    if (xy[0] === 'R' || xy[0] === 'C') i++ // 跳过重命名目标段
    if (xy === '??') path = rec.slice(3)
    out.push({ xy, path })
  }
  return out
}

/**
 * 活文档归并:把 HEAD 已入库、工作树副本里被吞掉的行插回(merge-live-doc 的既有职责)。
 * 认绿条件 = 归并后 lost=0 **且** ≥60 字符长行重复新增=0;任一不满足都不收编,
 * 留给下一轮或文档所有者 —— 宁可悬挂一轮,也不把丢行/重复登记写进历史。
 */
function mergeLiveDoc(file) {
  try {
    const out = execFileSync(
      process.execPath,
      [join(ROOT, 'scripts', 'merge-live-doc.mjs'), '--file', file, '--apply'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    // 两种输出形态都要认(2026-10-22 实测):
    //   · 有整行丢失 → apply 插回后打印「归并后仍判 lost = N(必须 0)」;
    //   · 无整行丢失 → apply 是空操作,只打印「真丢失(需插回)= 0」,不打归并汇总。
    // 只认这两类 lost 读数;都读不到就 fail-closed(不认绿,宁可悬挂一轮)。
    const after = out.match(/归并后仍判 lost = (\d+)/)
    const before = out.match(/真丢失\(需插回\)=\s*(\d+)/)
    const lost = after ? Number(after[1]) : before ? Number(before[1]) : null
    if (lost === null) return { ok: false, why: '归并输出缺少 lost 读数(不认绿)' }
    if (lost !== 0) return { ok: false, why: `归并后 lost=${lost}` }
    const dup = out.match(/归并后 \d+\(新增 (\d+)\)/)
    if (dup && Number(dup[1]) !== 0) return { ok: false, why: `长行重复新增 ${dup[1]}` }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      why: String(e?.stdout || e?.message || '')
        .trim()
        .split('\n')
        .slice(-3)
        .join('\n'),
    }
  }
}

/**
 * 门 237(归档单调性)同一把尺子,审磁盘面:红 = 有已归档票被复活成未勾活行 / 逐字孪生回插。
 * 判据实现只有 scripts/check-plan-archive-monotonic.mjs 一份(§0.6 单一真相源),本器不复制。
 */
function checkArchiveMonotonic() {
  try {
    execFileSync(
      process.execPath,
      [join(ROOT, 'scripts', 'check-plan-archive-monotonic.mjs'), '--worktree'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    )
    return { ok: true }
  } catch (e) {
    const out = String(e?.stderr || e?.stdout || e?.message || '')
      .trim()
      .split('\n')
      .filter(Boolean)
    return { ok: false, why: out.slice(0, 3).join(' / ') }
  }
}

/**
 * 活文档写盘前快照(2026-10-24 加固):merge-live-doc 与摘除复洁都是"**先写盘、后判定**"——
 * 实测 16:00/16:06/16:09 三轮各检出 12/14 条归档倒退,提交被门 237 拦下了,但工作树副本
 * 已被这两步写脏,下一位席位读到的是被污染的台账。快照 + 判定红即回滚,让"不收编"真的
 * 等于"本器没碰过这个文件"。返回 Buffer(逐字节回写,不经编码转换)。
 */
function snapshotLedger(file) {
  try {
    return readFileSync(join(ROOT, file))
  } catch {
    return null
  }
}

/** 回滚到快照;内容未变(本器没写盘)时不动文件,避免空写刷新 mtime 把文件又冻 3 分钟。 */
function rollbackLedger(file, snap, why) {
  if (!snap) return
  try {
    const cur = readFileSync(join(ROOT, file))
    if (cur.equals(snap)) return
    writeFileSync(join(ROOT, file), snap)
    log(`活文档已回滚工作树副本(${file}):${why}`)
  } catch (e) {
    log(`⚠️ 活文档回滚失败(${file}),工作树仍可能脏:${String(e?.message || e)}`)
  }
}

/**
 * 处置侧快照落盘(2026-10-28 立,票 gb22「活文档被体积清偿压好后又被归并档原样拉回」)。
 *
 * 为什么需要这一份:§1 的体积清偿是两步走 —— 先把整区正文逐字写进 `.ihui-agent/archive/`,再把文档
 * 压下来。压下来到落库之间(实测 11:40 压 → 11:54 入库)HEAD 仍是**未压版**,而 `merge-live-doc --apply`
 * 比的正是 HEAD ↔ 工作树 ⇒ 它把刚被有意搬走的行判成"真丢失"原样插回(实测 2026-10-28 11:51:57 把
 * 95336 字节顶回 102352,备份件 `.ihui-agent/tmp/AGENTS.md.2026-10-28T03-51-57.pre-merge.bak`)。
 * 复洁器要判"这一行是本轮归并插回来的、还是别人真新增的",唯一可靠的基准就是**归并前那一刻的工作树**
 * —— 也就是本器已经在手的 `snapshotLedger` 快照。落盘只为把它交给子进程,文件名固定 ⇒ 每轮覆盖,不堆积。
 *
 * 只服务正文族(AGENTS.md / README*.md):PROJECT_PLAN.md 一族的四道维有镜像测试钉着,本次红线是不动
 * 其语义,故该族一律不传这一旗(判据语义与 2026-10-22 立版逐字相同)。
 *
 * @returns {string|null} 相对 ROOT 的快照路径;取不到快照 ⇒ null(本维不启用,复洁退回原判据)
 */
function writeDispositionSnapshot(file, snap) {
  if (!file.endsWith('.md') || file.endsWith('PROJECT_PLAN.md')) return null
  if (!snap || !snap.length) return null
  try {
    const dir = join(ROOT, '.ihui-agent', 'tmp', 'auto-commit-quiet')
    mkdirSync(dir, { recursive: true })
    const rel = join('.ihui-agent', 'tmp', 'auto-commit-quiet', `${basename(file)}.pre-merge.disposition`)
    const abs = join(ROOT, rel)
    writeFileSync(abs, snap)
    return rel
  } catch (e) {
    log(`⚠️ 处置侧快照落盘失败(${file}):${String(e?.message || e)} ⇒ 本轮不启用归档批次维(退回原判据)`)
    return null
  }
}

/**
 * 已结清行回退闸的取数口(2026-10-25):HEAD blob 走取材层(守门 118 —— 散写 cat-file 会让
 * "判据与内容不同面同轮"悄悄发生);候选取**现盘文本**,因为调用点已在归并/复洁之后,
 * 那一刻的盘上文本就是即将入库的那一份。任一取不到 ⇒ null,由判据落 undetermined(fail-closed)。
 */
function ledgerFaces(file) {
  let head = null
  try {
    const spec = `HEAD:${file}`
    head = catBatch(ROOT, [spec]).get(spec) ?? null
  } catch {
    head = null
  }
  let candidate = null
  try {
    candidate = readFileSync(join(ROOT, file), 'utf8')
  } catch {
    candidate = null
  }
  return { head, candidate }
}

/**
 * 把 README 的 GENERATED NUMBERS 块刷到现算值,并把**真写盘**的 README 纳入本次提交。
 *
 * 病灶(2026-10-22 实测):该块由 post-commit 回写 ⇒ 工作树最新、索引面落后一枚;而门 173 判的
 * 是索引面,于是**下一枚不带 README 的提交必红**(实测 tracked 15613 / 索引 15612 / HEAD 15611)。
 * 收编前先同步,数字随本次提交落地;sync 幂等(数字没变不写盘),不会造自激提交。
 */
function syncReadmeNumbers(stale) {
  const before = new Map()
  for (const f of README_FILES) {
    try {
      before.set(f, statSync(join(ROOT, f)).mtimeMs)
    } catch {
      /* 缺文件跳过 */
    }
  }
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'sync-readme-numbers.mjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:本机不给显式 stdio 会 EBUSY
    })
  } catch (e) {
    return log(
      `⚠️ sync-readme-numbers 失败(不阻断):${String(e?.stdout || e?.message || '')
        .trim()
        .split('\n')
        .slice(-3)
        .join('\n')}`,
    )
  }
  const added = []
  for (const f of README_FILES) {
    const b = before.get(f)
    if (b === undefined) continue
    let a
    try {
      a = statSync(join(ROOT, f)).mtimeMs
    } catch {
      continue
    }
    if (a !== b && !stale.includes(f)) {
      stale.push(f)
      added.push(f)
    }
  }
  if (added.length) log(`README 生成数字已刷新,纳入本次收编:${added.join(', ')}`)
}

function main() {
  const busy = guardBusy()
  if (busy) return log(`跳过:${busy}`)

  const changes = listChanges().filter((c) => !isExcluded(c.path))
  if (changes.length === 0) return

  const conflicted = changes.filter((c) => /^(UU|AA|DD|AU|UA|DU|UD)$/.test(c.xy))
  if (conflicted.length) return log(`跳过:有未解决冲突 ${conflicted.map((c) => c.path).join(',')}`)

  const now = Date.now()
  let youngest = Infinity
  const stale = []
  const deleted = []
  for (const c of changes) {
    // 删除**永不**自动收编(2026-10-22 实证):删除件没有 mtime 可判"停止呼吸",旧实现按
    // ageMin=Infinity 直接收,于是别的席位刚暂存的 `D scripts/lib/gate-scope.mjs` 立刻被本器
    // 当候选提交 —— 而 runner 仍 import 它,提交即等于把整条守门链打断(靠 pre-commit 崩在
    // ERR_MODULE_NOT_FOUND 才拦住)。删除是"删错一枚就断链"的一类,交人工确认后显式声明。
    if (/D/.test(c.xy)) {
      deleted.push(c.path)
      continue
    }
    const abs = isAbsolute(c.path) ? c.path : join(ROOT, c.path)
    let ageMin
    try {
      ageMin = (now - statSync(abs).mtimeMs) / 60_000
    } catch {
      continue // 刚被移除/改名:状态已过期,本轮不碰
    }
    youngest = Math.min(youngest, ageMin)
    if (ageMin >= QUIET_MIN) stale.push(c.path)
  }
  if (deleted.length) log(`跳过删除(不自动收编,请人工确认后显式声明):${deleted.join(', ')}`)
  if (stale.length === 0) return

  // 活文档先归并,再把归并达标的收编(2026-10-22:替代"永不收编"——后者会让改动永久悬挂)。
  if (!DRY) {
    for (const f of [...stale].filter((p) => HUMAN_LEDGER_RE.test(p))) {
      // 写盘前快照(2026-10-24):下面三步都是"先写盘、后判定",判定红时若不回滚,
      // "本轮不收编"只保住了历史,工作树副本仍被写脏 —— 那正是 16:00/16:06/16:09 三次
      // 回插事故里污染扩散到下一席位的原因。
      const snap = snapshotLedger(f)
      // 处置侧快照(2026-10-28,票 gb22):归并档比的是 HEAD ↔ 工作树,而体积清偿在飞的窗口里
      // HEAD 还是未压版 ⇒ 被有意搬走的行会被判成"真丢失"插回。把归并前的工作树交给复洁器,
      // 它才能把"本轮归并插回的迁出行"和"别人真新增的行"分开。PROJECT_PLAN 一族不传(红线)。
      const dispRel = writeDispositionSnapshot(f, snap)
      /** 只在判定红时回滚;判定绿则保留本器写盘(归并/复洁的正当产物)。 */
      const revertIfRed = (why) => {
        if (!f.endsWith('PROJECT_PLAN.md')) return
        const mono = checkArchiveMonotonic()
        if (mono.ok) return
        rollbackLedger(f, snap, `${why} ⇒ ${mono.why}`)
      }
      const r = mergeLiveDoc(f)
      if (r.ok) {
        // 归并达标≠可以收编:工作树滞后副本里那些"已被声明式摘除"的旧行,归并档看不见
        // (它只判不丢行/不重复),会被当成本轮改动收编回去 —— 实测四枚已结清登记行因此整批复活。
        // 收编前先按摘除台账把这些行剔掉;器物判不出一律不剔(宁可留一轮噪音)。
        try {
          const sr = execFileSync(
            process.execPath,
            [
              join(ROOT, 'scripts', 'scrub-declared-removals.mjs'),
              f,
              ...(dispRel ? ['--archive-disposition', dispRel] : []),
            ],
            {
              cwd: ROOT,
              encoding: 'utf8',
              maxBuffer: 64 << 20,
              timeout: 120000,
              stdio: ['ignore', 'pipe', 'pipe'],
              windowsHide: true,
            },
          )
          const m = /state=(\w+) dropped=(\d+)/.exec(String(sr ?? ''))
          const ar = /archive=(\d+)/.exec(String(sr ?? ''))
          log(
            `活文档摘除台账复洁(${f}): ${m ? `${m[1]} dropped=${m[2]}${ar ? ` archive=${ar[1]}` : ''}` : '未回带机读行 ⇒ 本轮不收编'}`,
          )
          if (!m) {
            revertIfRed('复洁未回带机读行')
            stale.splice(stale.indexOf(f), 1)
            continue
          }
          // 归档批次维放过行 = 本轮归并确实把"已按 §1 逐字迁入 archive 的迁出批次"插回来了,而该批次
          // 此刻只在盘上、不在 HEAD 面 ⇒ 现在收编会把清偿成果第二次写回历史。让路给文档所有者:
          // 工作树已被复洁回到处置那一版(不是被插回的那一版),本器不再碰它,同批归档件与正文一起落库
          // 之后下一轮自然无滞留。失效方向恒为"多要一次落库",绝不是"多放一次收编"。
          if (ar && Number(ar[1]) > 0) {
            log(
              `活文档让路(${f}):本轮归并插回 ${ar[1]} 行"已逐字迁入 archive 的迁出批次"(凭据只在盘上、HEAD 面尚未入库)⇒ 不收编,留给文档所有者与同批归档件一起落库`,
            )
            stale.splice(stale.indexOf(f), 1)
            continue
          }
        } catch (e) {
          log(
            `活文档摘除台账复洁失败(${f}),本轮不收编:${String(e?.stdout || e?.message || '')
              .split('\n')
              .slice(-2)
              .join(' / ')}`,
          )
          revertIfRed('复洁失败')
          stale.splice(stale.indexOf(f), 1)
          continue
        }
        // 归档单调性自检(2026-10-23 新增,承当日实测事故):归并只补"丢行",对"已归档(✅)票被旧快照
        // 展开回未勾活行"零覆盖 —— 实测工作区副本这样回插 29+/16- 后被本器整批收编进历史。收编前按
        // 门 237 同一把尺子审磁盘面(判据只有那一份实现);红即让路,不在本器里"先修后收编"。
        if (f.endsWith('PROJECT_PLAN.md')) {
          const mono = checkArchiveMonotonic()
          if (!mono.ok) {
            log(`活文档归档单调性未通过(${f}),本轮不收编:${mono.why}`)
            // 已实锤的污染态:回滚到本轮开跑前的副本,不让本器的归并/复洁写盘留在磁盘上。
            rollbackLedger(f, snap, `本轮归并/复洁后归档单调性判红:${mono.why}`)
            stale.splice(stale.indexOf(f), 1)
            continue
          }
        }
        // 已结清行回退闸(2026-10-25 新增,承当日 16:25 收编事故):merge-live-doc 只判"丢行/长行
        // 重复",判不出"HEAD 已勾的登记行在工作树副本里被原地写回 `- [ ]`"(行数不变、一行不丢,
        // 归并档结构性看不见);归档单调性只管 ✅ 标题复活,不管勾选态。
        // 两型回退源都在本闸射程内(根因与取证见 scripts/lib/ledger-closed-rows.mjs 头注):
        // ① 混合体(旧副本⊕本地小改)——整份文本不等于任何祖先 blob,dropStaleCopies 结构上判不了;
        // ② 整份旧 blob 覆盖——dropStaleCopies 能拦(2026-10-29 起它审**全部**候选:旧的那条
        //    "已暂存=明确意图"豁免正是 b44ab834609 回退守卫②的入口,而落地走 safe-commit 的
        //    `git add -A`,提交的是工作树字节,与谁暂存过无关),但它仍只回溯该路径最近 6 枚提交,
        //    而本闸按**盘上文本 vs HEAD blob** 判勾选态,不受"副本多老"影响。
        // 位置刻意选在**归并+复洁之后、safe-commit 之前**的最后一档:①候选文本此刻就是即将入库
        // 的那一份(复洁只剔 HEAD 面已不存在的行,动不到本闸的主键面);②放到归并之前会把"归并
        // 本来能补回的行"误判成回退;③与归档单调性同层,任何一道红都在同一处回滚 + 退出候选。
        if (f.endsWith('PROJECT_PLAN.md')) {
          const { head, candidate } = ledgerFaces(f)
          const g = closedRowRegressions(head, candidate)
          if (g.undetermined) {
            log(`活文档已结清行闸未判定(${f}):HEAD/候选取不到或为空 ⇒ 本轮不收编、不写盘`)
            rollbackLedger(f, snap, '已结清行闸未判定')
            stale.splice(stale.indexOf(f), 1)
            continue
          }
          if (!g.ok) {
            const named = g.regressions.slice(0, 10).map((r) => `${r.key}(HEAD L${r.line})`)
            const more =
              g.regressions.length > named.length
                ? ` …另有 ${g.regressions.length - named.length} 条`
                : ''
            log(`活文档已结清行回退(${f}),本轮不收编:${named.join(' / ')}${more}`)
            rollbackLedger(f, snap, `候选把 ${g.regressions.length} 条已结清行写回未勾/抹掉`)
            stale.splice(stale.indexOf(f), 1)
            continue
          }
          log(
            `活文档已结清行闸通过(${f}):HEAD 面 ${g.headClosed} 个已结清主键仍全部在候选已勾集中(${g.candidateClosed})`,
          )
        }
        log(`活文档归并完成(${f}):lost=0 / 长行重复新增 0,可收编`)
      } else {
        log(`活文档归并未达标(${f}),本轮不收编:${r.why}`)
        revertIfRed('归并未达标')
        stale.splice(stale.indexOf(f), 1)
      }
    }
    if (stale.length === 0) return
  }

  const verb = youngest === Infinity ? '全部已删除' : `最年轻 ${youngest.toFixed(1)} 分钟`
  log(
    `候选 ${stale.length}/${changes.length} 个文件(${verb},阈值 ${QUIET_MIN} 分钟):${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ' …' : ''}`,
  )
  if (DRY) return log('dry-run:不提交')

  syncReadmeNumbers(stale) // 先刷数字,再把真写盘的 README 纳入
  // 命令行长度上限(2026-10-24 实测):脏件到 620 个时,整批 pathspec 传给 safe-commit 会在
  // Windows CreateProcess 处撞 ENAMETOOLONG(日志连续多轮 `spawnSync ... ENAMETOOLONG`),
  // 于是"自动收编"整器空转、改动永久悬挂。改为每轮只收前 N 个,余量下一轮接着收 ——
  // 契约不变(全部过期改动最终都会被收编),只是把一次提交拆成多轮。
  // README 必须留在本批:sync 已把数字刷进工作树,不带它提交会让门 173 在下一枚提交必红。
  const MAX_PATHS = Number(process.env.IHUI_AUTO_COMMIT_MAX_PATHS || 100)
  if (stale.length > MAX_PATHS) {
    const keep = stale.filter((f) => README_FILES.includes(f))
    const rest = stale.filter((f) => !README_FILES.includes(f))
    const picked = rest.slice(0, Math.max(0, MAX_PATHS - keep.length))
    log(
      `候选 ${stale.length} 个超过单轮上限 ${MAX_PATHS}(命令行长度),本轮只收 ${picked.length + keep.length} 个,余量下一轮`,
    )
    stale.length = 0
    stale.push(...picked, ...keep)
  }

  try {
    const out = execFileSync(
      process.execPath,
      [
        join(ROOT, 'scripts', 'safe-commit.mjs'),
        '-m',
        `chore(auto): 收编停留≥${QUIET_MIN}分钟的未提交改动`,
        '--',
        ...stale,
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 64 << 20,
        windowsHide: true,
        env: { ...process.env, AGENT_SCOPE: '' },
      },
    )
    log(`✅ safe-commit 成功\n${String(out).trim().split('\n').slice(-4).join('\n')}`)
  } catch (e) {
    log(
      `❌ safe-commit 失败(下一轮再试):${String(e.stdout || e.message)
        .trim()
        .split('\n')
        .slice(-6)
        .join('\n')}`,
    )
  }
}

// §22d:被 import 时不得触发 CLI 主流程(镜像测试要能用生产判据复算,§22c)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}

export const __test__ = {
  isExcluded,
  listChanges,
  guardBusy,
  mergeLiveDoc,
  syncReadmeNumbers,
  snapshotLedger,
  rollbackLedger,
  partitionStaleCopies,
  dropStaleCopies,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
