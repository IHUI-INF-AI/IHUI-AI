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
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'

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
            [join(ROOT, 'scripts', 'scrub-declared-removals.mjs'), f],
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
          log(
            `活文档摘除台账复洁(${f}): ${m ? `${m[1]} dropped=${m[2]}` : '未回带机读行 ⇒ 本轮不收编'}`,
          )
          if (!m) {
            revertIfRed('复洁未回带机读行')
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
        // §12g:派生必须显式接管 stdio(不吃 stdin ⇒ 首通道 ignore,stdout 要回读 ⇒ 管道)
        stdio: ['ignore', 'pipe', 'pipe'],
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
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
