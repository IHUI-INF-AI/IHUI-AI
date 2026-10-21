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
import { appendFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const QUIET_MIN = Number(process.env.IHUI_AUTO_COMMIT_QUIET_MIN || 3)
const DRY = process.argv.includes('--dry-run')
const LOG = join(ROOT, '.workbuddy', 'hook-logs', 'auto-commit-quiet.log')

const EXCLUDE = [
  /(^|\/)\.env(\.|$)/,
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /(^|\/)\.ihui-agent\/tmp\//,
  /(^|\/)\.workbuddy\/hook-logs\//,
  /\.log$/,
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|apk|aab|jar|so|dll|exe|mp4|woff2?)$/i,
  // 人工台账(2026-10-22 立):`PROJECT_PLAN.md`/`AGENTS.md` 是多席位**并发改写**的活文档,
  // 收编只看工作树现状、不做跨席合并 ⇒ 陈旧副本会造重复登记/丢行,门 203 棘轮判红后
  // safe-commit 还可能落进 --no-verify 兜底,把污染写进历史。这两份交其所有者显式提交。
  /(^|\/)(PROJECT_PLAN|AGENTS)\.md$/,
]
/** 需要单独记日志的"刻意不收编"类,便于从日志一眼看出哪些改动在等人工。 */
const HUMAN_LEDGER_RE = /(^|\/)(PROJECT_PLAN|AGENTS)\.md$/
/** README 生成数字块(由 sync-readme-numbers.mjs 独占写入)。 */
const README_FILES = ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md']

function git(args, opts = {}) {
  // 三件事同批:显式 stdio(§12g,本机不写稳定 EBUSY)、windowsHide 置后(强制生效,调用方覆盖不掉)、
  // 带 input 时 stdin 必须是 pipe。
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 << 20,
    stdio,
    ...opts,
    windowsHide: true,
  })
}

function log(line) {
  mkdirSync(dirname(LOG), { recursive: true })
  appendFileSync(LOG, `[${new Date().toISOString()}] ${line}\n`)
}

function guardBusy() {
  if (existsSync(join(ROOT, '.git', 'index.lock'))) return 'index.lock 在用'
  const preCommitLog = join(ROOT, '.workbuddy', 'hook-logs', 'pre-commit.log')
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
      `⚠️ sync-readme-numbers 失败(不阻断):${String(e?.stdout || e?.message || '').trim().split('\n').slice(-3).join('\n')}`,
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

  const all = listChanges()
  const ledger = all.filter((c) => HUMAN_LEDGER_RE.test(c.path))
  if (ledger.length) {
    log(`跳过人工台账(多席位并发改写,交所有者显式提交):${ledger.map((c) => c.path).join(', ')}`)
  }
  const changes = all.filter((c) => !EXCLUDE.some((re) => re.test(c.path)))
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

  const verb = youngest === Infinity ? '全部已删除' : `最年轻 ${youngest.toFixed(1)} 分钟`
  log(`候选 ${stale.length}/${changes.length} 个文件(${verb},阈值 ${QUIET_MIN} 分钟):${stale.slice(0, 8).join(', ')}${stale.length > 8 ? ' …' : ''}`)
  if (DRY) return log('dry-run:不提交')

  syncReadmeNumbers(stale)

  try {
    const out = execFileSync(
      process.execPath,
      [join(ROOT, 'scripts', 'safe-commit.mjs'), '-m', `chore(auto): 收编停留≥${QUIET_MIN}分钟的未提交改动`, '--', ...stale],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, env: { ...process.env, AGENT_SCOPE: '' } },
    )
    log(`✅ safe-commit 成功\n${String(out).trim().split('\n').slice(-4).join('\n')}`)
  } catch (e) {
    log(`❌ safe-commit 失败(下一轮再试):${String(e.stdout || e.message).trim().split('\n').slice(-6).join('\n')}`)
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
