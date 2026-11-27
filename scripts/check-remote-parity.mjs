#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-remote-parity.mjs — 双远端(origin/Gitee)同源一致性守门
 *
 * 背景(2026-11-27 机主令):
 *   本仓 `main` 同时写 `origin`(GitHub) 与 `gitee`(Gitee)。历史事故:只推了一边,
 *   另一边的远端 tip 与本地 `HEAD` 长期不一致,收尾却按"已推送"报完成。
 *   机主明确要求:不允许再出现两边不一致,规范写清、门禁落地。
 *
 * 判据(三方逐 sha 相等,不是"看起来差不多"):
 *   `local HEAD == origin/<branch> == gitee/<branch>`
 *   任一边 behind / ahead / diverged / 分支缺失 ⇒ exit 1。
 *   远端网络不可达 / 对象补不齐 ⇒ exit 2(未判定,不记绿)。
 *
 * 用法:
 *   node scripts/check-remote-parity.mjs --branch main
 *   node scripts/check-remote-parity.mjs --branch main --remotes=origin,gitee
 *   node scripts/check-remote-parity.mjs --self-test
 *
 * 退出码(§0.3):
 *   0 — 所有远端 tip 都与本地 HEAD 相等
 *   1 — 至少一边不一致(behind / ahead / diverged / 分支缺失 / remote 未配置)
 *   2 — 未判定(ls-remote 不可达 / fetch 补对象失败 / 本地 HEAD 读不出)
 */
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const CLI = process.argv.slice(2)
const getArg = (name, def) => {
  const hit = CLI.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : def
}
const hasFlag = (name) => CLI.includes(`--${name}`)

/** 纯判据核:便于 --self-test 不碰网络/仓库。 */
function classifySync({ behind, ahead }) {
  if (behind > 0 && ahead > 0) return 'diverged'
  if (behind > 0) return 'behind'
  if (ahead > 0) return 'ahead'
  return 'synced'
}

/** ls-remote 单行 → 40/64 位 sha;空行/短 sha/名字都算未确认。 */
function parseLsRemote(out) {
  const line = String(out ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean)
  if (!line) return null
  const sha = line.split('\t')[0]
  return /^[0-9a-f]{40,64}$/.test(sha) ? sha : null
}

if (hasFlag('self-test')) {
  const cases = [
    ['synced', { behind: 0, ahead: 0 }],
    ['ahead', { behind: 0, ahead: 2 }],
    ['behind', { behind: 3, ahead: 0 }],
    ['diverged', { behind: 2, ahead: 3 }],
  ]
  let failed = 0
  for (const [expect, input] of cases) {
    const got = classifySync(input)
    if (got !== expect) {
      console.error(`❌ self-test classify: ${JSON.stringify(input)} 期望 ${expect},实得 ${got}`)
      failed += 1
    }
  }
  const parseCases = [
    ['abc\trefs/heads/main', null],
    ['', null],
    ['refs/heads/main', null],
    ['0123456789abcdef0123456789abcdef01234567\trefs/heads/main', '0123456789abcdef0123456789abcdef01234567'],
  ]
  for (const [input, expect] of parseCases) {
    const got = parseLsRemote(input)
    if (got !== expect) {
      console.error(`❌ self-test parseLsRemote: ${JSON.stringify(input)} 期望 ${expect},实得 ${got}`)
      failed += 1
    }
  }
  if (failed > 0) {
    console.error(`❌ self-test 失败 ${failed}/${cases.length + parseCases.length}`)
    process.exit(1)
  }
  console.log(`✅ self-test 通过 ${cases.length + parseCases.length}/${cases.length + parseCases.length}`)
  process.exit(0)
}

const hasRootFlag = CLI.some((a) => a.startsWith('--root='))
const ROOT = hasRootFlag ? resolve(getArg('root', '.')) : null

function git(args, { allowFail = false, timeout = 120_000 } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout,
    }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

const repoRoot = ROOT || git(['rev-parse', '--show-toplevel'], { allowFail: true })
if (!repoRoot) {
  console.error('?  未判定:当前目录不是 git 仓库(或取不到仓根)')
  process.exit(2)
}

const branch =
  getArg('branch', null) ||
  git(['symbolic-ref', '--short', '-q', 'HEAD'], { allowFail: true }) ||
  'main'
const configured = (git(['remote'], { allowFail: true }) || '')
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
const remotes = (getArg('remotes', 'origin,gitee') || 'origin,gitee')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const localHead = git(['rev-parse', '--verify', '-q', 'HEAD'], { allowFail: true })
if (!localHead) {
  const all = git(['rev-list', '--all', '--count'], { allowFail: true })
  if (all === '0') {
    console.log('⏭  空仓库(尚无提交),双远端一致性检查不适用')
    process.exit(0)
  }
  console.error('?  未判定:本地 HEAD 读不出真实提交(HEAD / ref 损坏)')
  process.exit(2)
}
if (git(['cat-file', '-e', localHead], { allowFail: true }) === null) {
  console.error(`?  未判定:本地 HEAD ${String(localHead).slice(0, 11)} 在对象库中不存在`)
  process.exit(2)
}

/** 远端 tip 三态:{ status:'ok',sha } / { status:'missing-branch' } / { status:'unreachable',why } */
function resolveRemoteTip(remote) {
  let out
  try {
    out = git(['ls-remote', '--heads', remote, `refs/heads/${branch}`], { timeout: 45_000 })
  } catch (e) {
    return { status: 'unreachable', why: String(e?.message || e).split('\n')[0].slice(0, 120) }
  }
  const sha = parseLsRemote(out)
  if (!sha) return { status: 'missing-branch' }
  return { status: 'ok', sha }
}

/** 远端 sha 对象不在本地时补 fetch;补不齐 = 未判定。 */
function ensureObject(remote, sha) {
  if (git(['cat-file', '-e', sha], { allowFail: true }) !== null) return { ok: true }
  try {
    git(['fetch', '--no-tags', remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], {
      timeout: 180_000,
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, why: String(e?.message || e).split('\n')[0].slice(0, 120) }
  }
}

function readCounts(remoteSha) {
  try {
    const out = git(['rev-list', '--left-right', '--count', `${remoteSha}...${localHead}`])
    const m = /^(\d+)\s+(\d+)$/.exec(out)
    if (!m) return { judged: false, why: `rev-list 输出不是两个整数:${JSON.stringify(out.slice(0, 80))}` }
    return { judged: true, behind: Number(m[1]), ahead: Number(m[2]) }
  } catch (e) {
    return { judged: false, why: String(e?.message || e).split('\n')[0].slice(0, 120) }
  }
}

const rows = []
let undetermined = false
let mismatch = false

for (const remote of remotes) {
  if (!configured.includes(remote)) {
    rows.push({ remote, status: 'no-remote', detail: '本仓未配置该 remote' })
    mismatch = true
    continue
  }
  const tip = resolveRemoteTip(remote)
  if (tip.status === 'unreachable') {
    rows.push({ remote, status: 'unreachable', detail: tip.why })
    undetermined = true
    continue
  }
  if (tip.status === 'missing-branch') {
    rows.push({ remote, status: 'missing-branch', detail: `远端没有 refs/heads/${branch}` })
    mismatch = true
    continue
  }
  if (tip.sha === localHead) {
    rows.push({ remote, sha: tip.sha, status: 'synced', behind: 0, ahead: 0 })
    continue
  }
  const fetched = ensureObject(remote, tip.sha)
  if (!fetched.ok) {
    rows.push({ remote, sha: tip.sha, status: 'unreachable', detail: `补对象失败:${fetched.why}` })
    undetermined = true
    continue
  }
  const counts = readCounts(tip.sha)
  if (!counts.judged) {
    rows.push({ remote, sha: tip.sha, status: 'unjudged', detail: counts.why })
    undetermined = true
    continue
  }
  const status = classifySync(counts)
  rows.push({ remote, sha: tip.sha, status, behind: counts.behind, ahead: counts.ahead })
  if (status !== 'synced') mismatch = true
}

const short = (s) => (s ? String(s).slice(0, 11) : '—')
console.log(`\n双远端一致性检查(branch=${branch})`)
console.log(`  ${C.dim}本地 HEAD :${C.reset} ${C.cyan}${short(localHead)}${C.reset}`)
for (const row of rows) {
  const color =
    row.status === 'synced' ? C.green : row.status === 'unreachable' || row.status === 'unjudged' ? C.yellow : C.red
  const bits = [row.status]
  if (row.status !== 'synced' && row.status !== 'no-remote' && row.status !== 'missing-branch') {
    bits.push(`behind=${row.behind}`, `ahead=${row.ahead}`, `remote=${short(row.sha)}`)
  }
  console.log(`  ${row.remote.padEnd(8)}: ${color}${bits.join(' ')}${C.reset}${row.detail ? ` ${C.dim}(${row.detail})${C.reset}` : ''}`)
}

if (!mismatch && !undetermined) {
  console.log(`\n✅ 双远端一致:${remotes.join(' == ')} == 本地 HEAD(${short(localHead)})`)
  process.exit(0)
}
if (undetermined) {
  console.error('\n?  未判定:至少一边取不到可比较的远端 tip(§0.3,不记绿也不冒红)')
  process.exit(2)
}
console.error(
  `\n${C.red}❌ 双远端不一致${C.reset}:${remotes.join(',')} 与本地 HEAD 不是逐 sha 相等。`,
)
console.error(
  `   ${C.green}唯一收尾出口:${C.reset} node scripts/git-push-converge.mjs --branch ${branch} --remotes=${remotes.join(',')}`,
)
console.error('   禁止只推一边后宣称完成;分叉先 fetch + 合并,禁止强推。')
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
