// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * green-state — 上一个通过守门的可运行态(O65 P0 · O6503 的回滚半边,2026-10-25 立)。
 *
 * 两条腿各自如实:
 *  ① **机读记号**:部署环打出「部署完成,HEAD=」时由本器 --mark 记下该 sha 与时刻。
 *  ② **一键回退**:--rollback 调既有 `ihui-deploy.ps1 -rollbackOnly`(恢复上次 web 构建产物并
 *     重启 web)。它回退的是**可运行产物**,不是 git 历史;源码面落后多少由 --source-diff 如实报,
 *     要不要 revert 由人或上层 agent 决策 —— 本器**不做** reset --hard / 强推(那是人工阀 destructive-git)。
 *
 * 退出码:0 成功 / 1 拒绝(无记号、或 HEAD 已是记号态) / 2 未判定(记号坏、git 读不到)。
 *
 * 用法:
 *   node scripts/green-state.mjs --mark --apply [--note "deploy loop ok"]
 *   node scripts/green-state.mjs --show [--json]
 *   node scripts/green-state.mjs --source-diff
 *   node scripts/green-state.mjs --rollback [--apply]
 *   node scripts/green-state.mjs --self-test
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const STATE_PATH = join(ROOT, '.ihui-agent', 'state', 'last-green.json')
export const ROLLBACK_SCRIPT = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
export const EXIT_OK = 0
export const EXIT_REFUSED = 1
export const EXIT_UNKNOWN = 2

const SHA_RE = /^[a-f0-9]{7,40}$/

/** 记号形状锁:sha 必须是 7~40 位十六进制、at 可解析;坏形状抛(调用方落 exit 2)。 */
export function parseState(rawText) {
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`green-state 记号不是合法 JSON:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object') throw new Error('green-state 记号不是对象')
  if (typeof doc.sha !== 'string' || !SHA_RE.test(doc.sha))
    throw new Error('green-state 记号 sha 非法')
  if (!Number.isFinite(Date.parse(doc.at))) throw new Error('green-state 记号 at 无法解析')
  return doc
}

/**
 * 回滚判定(纯函数,便于镜像测试):
 *  - 无记号 ⇒ refused(不许凭空回退)
 *  - HEAD == 记号 sha ⇒ refused(已经在绿色态,回退无意义且会重启一次 web)
 *  - 其余 ⇒ allowed,并带上源码面差距
 */
export function decideRollback({ state, headSha }) {
  if (!state) return { action: 'refused', why: '没有 green 记号:先由部署环成功一轮触发 --mark' }
  if (!headSha || !SHA_RE.test(String(headSha)))
    return { action: 'unknown', why: '读不到当前 HEAD' }
  if (
    String(headSha).startsWith(String(state.sha)) ||
    String(state.sha).startsWith(String(headSha))
  ) {
    return {
      action: 'refused',
      why: `HEAD 已是绿色态(${state.sha.slice(0, 10)}),回退会让 web 白重启一次`,
    }
  }
  return {
    action: 'allowed',
    why: `将从当前 ${headSha.slice(0, 10)} 回退产物到绿色态 ${state.sha.slice(0, 10)}`,
  }
}

function git(args) {
  // G-927 迁移批(2026-10-25):裸 spawnSync('git') 改走 face-reader 取材层 gitRaw。
  // gitRaw 非零即抛 Undetermined(带 status),这里折回调用方的 {ok,out,err} 三态,
  // 行为面与旧实现逐字段等值。
  try {
    return { ok: true, out: gitRaw(args, ROOT), err: '' }
  } catch (e) {
    return { ok: false, out: '', err: String(e?.message ?? e) }
  }
}

function headSha() {
  const r = git(['rev-parse', 'HEAD'])
  return r.ok ? r.out.trim() : ''
}

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(`self-test 失败:${m}`)
  }
  const st = parseState(
    '{"sha":"c05ca0d5000e1609f8dbcc60ebb9f770d6e63e56","at":"2026-10-25T10:00:00.000Z"}',
  )
  assert(st.sha.length === 40, '记号解析')
  let threw = false
  try {
    parseState('{"sha":"zzz","at":"2026-10-25T10:00:00.000Z"}')
  } catch {
    threw = true
  }
  assert(threw, '非法 sha 应抛')
  threw = false
  try {
    parseState('{"sha":"abc1234","at":"not-a-date"}')
  } catch {
    threw = true
  }
  assert(threw, '非法时间应抛')
  assert(decideRollback({ state: null, headSha: 'abc1234' }).action === 'refused', '无记号拒绝')
  assert(decideRollback({ state: st, headSha: '' }).action === 'unknown', 'HEAD 读不到判未判定')
  assert(decideRollback({ state: st, headSha: st.sha }).action === 'refused', '已在绿色态拒绝')
  const d = decideRollback({ state: st, headSha: 'deadbee1234' })
  assert(d.action === 'allowed', '有记号且不同 HEAD 应放行')
  console.log('self-test: 全绿(7 组断言)')
}

function main(argv) {
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()

  let state = null
  if (existsSync(STATE_PATH)) {
    try {
      state = parseState(readFileSync(STATE_PATH, 'utf8'))
    } catch (e) {
      console.error(`❌ 未判定:${e.message}(先 --mark 重写记号)`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
  }

  if (has('--mark')) {
    const sha = headSha()
    if (!sha) {
      console.error('❌ 未判定:读不到 HEAD')
      process.exitCode = EXIT_UNKNOWN
      return
    }
    if (!has('--apply')) {
      console.log(`ℹ dry-run:将记下 sha=${sha.slice(0, 10)}(加 --apply 落盘)`)
      return
    }
    const doc = {
      sha,
      at: new Date().toISOString(),
      source: 'deploy-loop',
      note: String(val('--note', '')).slice(0, 200),
    }
    mkdirSync(dirname(STATE_PATH), { recursive: true })
    writeFileSync(STATE_PATH, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
    console.log(`✅ 已记绿色态 ${sha.slice(0, 10)}`)
    return
  }

  if (has('--show') || has('--source-diff') || !has('--rollback')) {
    if (!state) {
      console.error('❌ 没有 green 记号')
      process.exitCode = EXIT_REFUSED
      return
    }
    const head = headSha()
    const diff = git(['log', '--oneline', `${state.sha}..HEAD`])
    const behind = diff.ok ? diff.out.trim().split('\n').filter(Boolean).length : -1
    if (has('--json'))
      console.log(JSON.stringify({ state, head, commitsSinceGreen: behind }, null, 2))
    else {
      console.log(
        `绿色态 ${state.sha.slice(0, 10)}(记于 ${state.at}${state.note ? `;${state.note}` : ''})`,
      )
      console.log(
        `当前 HEAD ${head.slice(0, 10)};源码面落后 ${behind < 0 ? '未判定' : `${behind} 枚提交`}`,
      )
      if (behind > 0) console.log(diff.out.trim())
    }
    return
  }

  // --rollback
  const decision = decideRollback({ state, headSha: headSha() })
  if (decision.action === 'unknown') {
    console.error(`❌ 未判定:${decision.why}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  if (decision.action === 'refused') {
    console.error(`❌ 拒绝回退:${decision.why}`)
    process.exitCode = EXIT_REFUSED
    return
  }
  const cmd = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ROLLBACK_SCRIPT,
    '-rollbackOnly',
  ]
  console.log(`${decision.why}\n命令:pwsh ${cmd.join(' ')}`)
  if (!has('--apply')) {
    console.log('ℹ dry-run:未执行(加 --apply 真回退;会重启 web,api/ai-service 不受影响)')
    return
  }
  const r = spawnSync('pwsh', cmd, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  })
  const tail = String(r.stdout ?? '')
    .trim()
    .split('\n')
    .slice(-6)
    .join('\n')
  if (r.status === 0) console.log(`✅ 回退执行完成(exit=0)\n${tail}`)
  else {
    console.error(`❌ 回退执行失败(exit=${r.status})\n${tail}\n${String(r.stderr ?? '').trim()}`)
    process.exitCode = EXIT_REFUSED
  }
}

export const __test__ = { parseState, decideRollback }

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
