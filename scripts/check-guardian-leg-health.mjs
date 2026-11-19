#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * Y-72 guardian 存活独立哨兵（只读，不拉起）。
 *
 * 背景(票面):git-guardian --daemon 是「盘根卫生 / TEMP 夹具清扫 / worktree 回收」三腿唯一载体；
 * 看门狗只管拉起 daemon，缺独立存活哨兵 ⇒ daemon 与看门狗同批被停就一起瞎，30+ 小时空转无人知。
 *
 * 三态判据（warn 档 §12e，绝不自动拉起）:
 *   ok    — daemon 进程在 + 三腿 tick 戳全部新鲜
 *   stale — daemon 在但 ≥1 腿 tick 超龄（腿卡住）
 *   down  — daemon 进程不在，或全部三腿 tick 均超长超龄（daemon 已死）
 *
 * 阈值:
 *   daemon tick 正常节奏 ≈ 2 分钟/轮 ⇒ 单腿超龄阈 STALE_MS=30min；
 *   全腿超长超龄阈 DOWN_MS=24h（daemon 已死，tick 全停）。
 *
 * 用法: node scripts/check-guardian-leg-health.mjs [--json]
 *   exit 0 = ok / exit 1 = stale / exit 2 = down / exit 3 = 未判定（输入缺失）
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_DIR = join(ROOT, '.ihui-agent', 'state')
// hook-logs 目录仅作文档参考(daemon pid 文件实际在 state 根,见 PID_FILE 注释),故保留常量不引用。
const _LOG_DIR = join(STATE_DIR, 'hook-logs')

/** daemon PID 文件（git-guardian.mjs 写入: join(dirname(LOG),'git-guardian.pid') = state 根目录；内容 pid=<pid> at=<iso>） */
const PID_FILE = join(STATE_DIR, 'git-guardian.pid')
/** 三腿 tick 戳（guardian 每轮刷新；mtime 即最后一次落地时间） */
const LEG_TICKS = {
  'disk-root-hygiene': join(STATE_DIR, 'disk-root-hygiene-audit-tick.ts'),
  'temp-scrub': join(STATE_DIR, 'temp-scrub-tick.iso'),
  'worktree-reap': join(STATE_DIR, 'worktree-reap-tick.iso'),
}

const STALE_MS = 30 * 60 * 1000 // 30 分钟
const DOWN_MS = 24 * 60 * 60 * 1000 // 24 小时

/** 进程是否存活（POSIX kill(pid,0)；Windows 上退化为 pid 文件新鲜度判断） */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e.code === 'ESRCH') return false
    if (e.code === 'EPERM') return true // 存在但无权发信号 ⇒ 视为存活
    return false
  }
}

function readDaemonPid() {
  if (!existsSync(PID_FILE)) return { pid: null, startedAt: null }
  const txt = readFileSync(PID_FILE, 'utf8')
  const pidM = /pid=(\d+)/.exec(txt)
  const atM = /at=(\S+)/.exec(txt)
  return {
    pid: pidM ? Number(pidM[1]) : null,
    startedAt: atM ? atM[1] : null,
  }
}

function legAgeMs(p) {
  if (!existsSync(p)) return null
  try {
    return Date.now() - statSync(p).mtimeMs
  } catch {
    return null
  }
}

function main() {
  const { pid, startedAt } = readDaemonPid()
  const daemonAlive = pid !== null && pidAlive(pid)

  const legs = {}
  for (const [name, p] of Object.entries(LEG_TICKS)) {
    const age = legAgeMs(p)
    legs[name] = {
      path: p,
      exists: age !== null,
      ageMs: age,
      ageHuman: age === null ? 'never' : `${Math.round(age / 60000)}min`,
      stale: age !== null && age > STALE_MS,
      down: age === null || age > DOWN_MS,
    }
  }

  const allDown = Object.values(legs).every((l) => l.down)
  const anyStale = Object.values(legs).some((l) => l.stale)

  let state
  if (!daemonAlive || allDown) state = 'down'
  else if (anyStale) state = 'stale'
  else state = 'ok'

  const summary = { state, daemonAlive, pid, startedAt, legs }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(`guardian 存活哨兵: state=${state}`)
    console.log(`  daemon pid=${pid ?? '∅'} alive=${daemonAlive}${startedAt ? ` started=${startedAt}` : ''}`)
    for (const [name, l] of Object.entries(legs)) {
      console.log(`  leg ${name.padEnd(18)} exists=${l.exists} age=${l.ageHuman} stale=${l.stale} down=${l.down}`)
    }
  }

  // 未判定:输入完全缺失（无 pid 文件且无任何 tick）
  if (pid === null && Object.values(legs).every((l) => !l.exists)) {
    console.error('未判定:pid 文件与三腿 tick 全缺 ⇒ guardian 可能从未在本机跑过')
    process.exit(3)
  }
  process.exit(state === 'ok' ? 0 : state === 'stale' ? 1 : 2)
}

// §22d 入口守卫:CLI 直跑 + 被 import 双形态;测试/工具 import 本模块时不触发 CLI 主流程。
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
