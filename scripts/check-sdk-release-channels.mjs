// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// O14 · SDK 发布通道就绪性实跑对账。
//
// 台账在 config/sdk-release-channels.json(五通道 status + blocker + 解除动作 + 验证命令);
// 本脚本是台账的「实跑」那一半判据 —— publish-ready 回归(packages/sdk/tests/publish-ready.test.mjs)
// 只核结构(清单 ↔ CI job ↔ 各语言坐标),这里核的是结构判据结构上看不见的那一维:
//   ① 每条 verifyCommand 必须**真能跑**(argv[0] 不在 PATH = 判红 —— 「不可跑即红」);
//   ② 台账腐烂判红:status=ready 而实跑给不出结论(声称就绪却连验都无法验)、
//      blocked-* 而实跑已命中(条目其实已解除还挂着 = 台账腐烂);
//   ③ (可用 gh 时)secrets 交叉核:ready 而所需 secret 不在仓库 = 红;
//      blocked 而 secret 已在 = 只提示,不判红 —— secret 存在 ≠ 有效,翻 ready 的凭据是发布后回读。
//
// 三态口径是本脚本的生命线(AGENTS.md §5d:「网络不可达 ≠ 无效」):
//   present  = 回读命中(registry/origin 上查得到这个坐标);
//   absent   = 确定性地查无此物(404/410/命令 exit 0 且输出为空);
//   undetermined = 网络不可达 / 命令缺失 / 身份不可用 —— blocked 项只报数,ready 项判红。
// 全部通道都落在 undetermined 时 exit 2「无法判定」—— 空扫不记绿(守门 70/77 同取向)。
//
// 用法:
//   node scripts/check-sdk-release-channels.mjs [--manifest <path>] [--json] [--offline] [--self-test]
// 退出码:0 通过(未判定项已逐条点名) / 1 判红 / 2 无法判定或台账不可读 / self-test 同 0|1
// 本脚本刻意**不接进 pre-commit / check:all**:它判的是外部 registry 与 gh 身份这类机器态/网络态,
// 与提交者改了什么无关;blocking 的净效果是逼各会话 --no-verify(§12e 同型)。问责走手动/CI。

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const DEFAULT_MANIFEST = join(REPO_ROOT, 'config', 'sdk-release-channels.json')

export const STATUS_ENUM = ['ready', 'blocked-by-credential', 'blocked-by-external-ownership', 'not-implemented']
export const PROBE_KINDS = ['http-status', 'git-ls-remote', 'none']
export const EXPECTED_CHANNEL_IDS = ['npm', 'pypi', 'maven', 'nuget', 'go']
const PROBE_TIMEOUT_MS = 25_000

// ───────────────────────── 结构判据(纯函数) ─────────────────────────

/**
 * 台账结构校验:返回错误清单(空 = 合规)。不发网络请求,可被测试直接喂变异对象。
 * @param {unknown} manifest 已 parse 的台账
 * @returns {string[]}
 */
export function validateStructure(manifest) {
  const errors = []
  if (!manifest || typeof manifest !== 'object') return ['台账不是一个对象']
  const m = /** @type {{$schemaVersion?: unknown, channels?: unknown, liveChecker?: unknown}} */ (manifest)
  if (m.$schemaVersion !== 1) errors.push(`$schemaVersion 须为 1(实测 ${String(m.$schemaVersion)})`)
  if (!Array.isArray(m.channels) || m.channels.length === 0) {
    errors.push('channels 必须是非空数组(空台账 = 五通道无人看守)')
    return errors
  }
  const seen = new Set()
  for (const ch of m.channels) {
    const id = typeof ch?.id === 'string' ? ch.id : '<无 id>'
    if (seen.has(id)) errors.push(`${id}: 通道重复登记`)
    seen.add(id)
    if (!STATUS_ENUM.includes(ch?.status)) {
      errors.push(`${id}: status "${String(ch?.status)}" 不在枚举 {${STATUS_ENUM.join(', ')}}`)
      continue
    }
    if (ch.status !== 'not-implemented' && ch.probe?.kind !== 'none' && !PROBE_KINDS.includes(ch.probe?.kind)) {
      errors.push(`${id}: probe.kind "${String(ch?.probe?.kind)}" 不在枚举 {${PROBE_KINDS.join(', ')}}`)
    }
    if (ch.probe?.kind === 'http-status') {
      if (typeof ch.probe.url !== 'string' || !/^https?:\/\//.test(ch.probe.url)) {
        errors.push(`${id}: http-status 探针缺合法 url`)
      }
      for (const k of ['presentOn', 'absentOn']) {
        if (k in ch.probe && !Array.isArray(ch.probe[k])) errors.push(`${id}: probe.${k} 必须是数组`)
      }
    }
    if (ch.probe?.kind === 'git-ls-remote') {
      if (typeof ch.probe.remote !== 'string' || typeof ch.probe.pattern !== 'string') {
        errors.push(`${id}: git-ls-remote 探针必须同时给 remote 与 pattern`)
      }
    }
    if (ch.status.startsWith('blocked-')) {
      // 拦「只写一半的 blocker」:没有具体人工动作的 blocked 条目与没有条目等效。
      if (typeof ch.blocker !== 'string' || ch.blocker.trim().length < 10) {
        errors.push(`${id}: ${ch.status} 必须写明确切的 blocker(≥10 字,不接受空话)`)
      }
      if (typeof ch.unblockAction !== 'string' || ch.unblockAction.trim().length < 10) {
        errors.push(`${id}: ${ch.status} 必须写出解除所需的具体人工动作 unblockAction`)
      }
    }
    if (ch.status !== 'not-implemented') {
      if (typeof ch.verifyCommand !== 'string' || ch.verifyCommand.trim().length === 0) {
        errors.push(`${id}: 缺 verifyCommand(发布后就靠它做回读证明)`)
      }
      if (ch.probe?.kind === 'none' || !ch.probe) {
        errors.push(`${id}: 非 not-implemented 通道必须给可实跑的 probe`)
      }
    }
    if (!Array.isArray(ch.requiredSecrets)) errors.push(`${id}: requiredSecrets 必须是数组(可为空)`)
  }
  const missing = EXPECTED_CHANNEL_IDS.filter((x) => !seen.has(x))
  const extra = [...seen].filter((x) => !EXPECTED_CHANNEL_IDS.includes(x))
  if (missing.length) errors.push(`台账缺通道:${missing.join(', ')} —— 与 release-sdk.yml 的五个 *-publish job 不再一一对应`)
  if (extra.length) errors.push(`台账多出未知通道:${extra.join(', ')}`)
  return errors
}

// ───────────────────────── 判据聚合(纯函数) ─────────────────────────

/**
 * 「摘掉 `private`」这一个动作的全部**廉价**前置。纯函数,不碰 git/npm pack ——
 * 需要真解包的那一半(无扩展名相对 import 等)由调用方在**非 private 时**才付代价去跑
 * `scripts/check-pkg-installable.mjs`,因为保险丝在位时 registry 侧本就拒发。
 *
 * 存在理由(实测,不是假想):2026-09-24 的 `69aa86183dc` 标题即「api-client 去 private」,
 * 而当天两条前置都不成立 —— `dependencies.@ihui/types = "workspace:*"`(发出去即装不到)、
 * `version` 仍是占位的 `0.0.0`。`check-pkg-installable.mjs` 头注写着"本脚本正是去 private
 * 之前必须通过的自检",但没有任何东西在那个时刻执行它 ⇒ 散文。本函数把那句话说成代码。
 *
 * @param {{private?:unknown, version?:unknown,
 *          dependencies?:Record<string,string>, devDependencies?:Record<string,string>,
 *          peerDependencies?:Record<string,string>}} pkg 包清单(已 parse)
 * @returns {string[]} 空数组 = 无欠账;每条点名一个可修的字段
 */
export function publishPreconditionFailures(pkg) {
  if (pkg?.private === true) return []
  const red = []
  if (!pkg || typeof pkg !== 'object') return ['清单不可解析(取不到内容,不得记为通过)']
  if (pkg.version === undefined || pkg.version === '0.0.0') {
    red.push(`version = ${JSON.stringify(pkg.version)} 仍是占位档 ⇒ 这不是一个准备发布的版本`)
  }
  const all = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  }
  const ws = Object.entries(all)
    .filter(([, v]) => typeof v === 'string' && v.startsWith('workspace:'))
    .map(([k, v]) => `${k}=${v}`)
  if (ws.length > 0) red.push(`带 workspace: 依赖 ⇒ 发出去即装不到:${ws.join(', ')}`)
  return red
}

/**
 * 单通道判定。输入全部是已经量好的三态,本函数不触碰 git/网络 —— 变异对照因此可钉成用例。
 * @param {{id:string,status:string,verifyCommand?:string,requiredSecrets?:string[]}} ch
 * @param {{bin: boolean | 'undetermined', binName?: string, outcome: {state:'present'|'absent'|'undetermined',detail:string}}} m
 * @param {{state:'determined',present:string[],missing:string[]}|{state:'undetermined',reason:string}} [secrets]
 * @returns {{red:string[],notes:string[]}}
 */
export function decideChannel(ch, m, secrets) {
  const red = []
  const notes = []
  if (ch.status === 'not-implemented') {
    notes.push('not-implemented:不发探针、不判红,仅如实占位')
    return { red, notes }
  }
  // ① 「verifyCommand 必须真能跑」—— 命令本体缺失即红,与 status 无关。
  if (m.bin === false) red.push(`verifyCommand 不可跑:${m.binName} 不在 PATH(判据「每条 verifyCommand 必须真能跑」不成立)`)
  else if (m.bin === 'undetermined') notes.push(`未能判定 ${m.binName} 是否在 PATH(which 本身不可用)`)

  // ② 台账与实跑读数的双向对账。
  if (ch.status === 'ready') {
    if (m.outcome.state === 'undetermined') {
      red.push(`status=ready 而验证命令给不出确定结论(${m.outcome.detail})—— 声称就绪却连验都无法验,正是本台账要拦的那一型`)
    } else if (m.outcome.state === 'present') {
      notes.push(`回读已命中(${m.outcome.detail}):该坐标已有发布物,翻账时请在 blocker/unblockAction 注明版本号来源 tag`)
    }
  } else if (m.outcome.state === 'present') {
    red.push(`台账记 ${ch.status} 而回读已命中(${m.outcome.detail})—— 条目其实已解除还挂着 = 台账腐烂;核实后翻 ready 或补记首发版本`)
  } else if (m.outcome.state === 'undetermined') {
    notes.push(`回读未判定(${m.outcome.detail}):blocked 态不判红(网络不可达 ≠ 无效),但也**不得据此翻 ready**`)
  }

  // ③ secrets 交叉核(gh 可用时才存在「determined」;缺 gh 只报未判定)。
  if (secrets && secrets.state === 'determined') {
    const need = Array.isArray(ch.requiredSecrets) ? ch.requiredSecrets : []
    if (ch.status === 'ready' && need.length) {
      const miss = need.filter((s) => !secrets.present.includes(s))
      if (miss.length) red.push(`status=ready 但仓库 secrets 缺 ${miss.join(', ')}(gh secret list 实测)`)
    }
    if (ch.status === 'blocked-by-credential' && need.length && need.every((s) => secrets.present.includes(s))) {
      notes.push(`所需 secrets ${need.join(', ')} 已在仓库 —— 但 secret 存在 ≠ 可用,翻 ready 的凭据仍是发布后回读,本条不判红`)
    }
  }
  return { red, notes }
}

// ───────────────────────── 实跑取材(有副作用的只有网络只读请求) ─────────────────────────

/** @param {string} cmd @returns {boolean|'undetermined'} */
function binAvailable(cmd) {
  if (/^(https?:)?\/\//.test(cmd) || cmd.includes('/')) return 'undetermined' // 不是裸命令名(可能是内联 URL 等),不猜
  const probe =
    process.platform === 'win32'
      ? spawnSync('where.exe', [cmd], { windowsHide: true, timeout: 10_000, encoding: 'utf8' })
      : spawnSync('which', [cmd], { windowsHide: true, timeout: 10_000, encoding: 'utf8' })
  if (probe.error) return 'undetermined'
  if (probe.status === 0) return true
  if (probe.status === 1) return false // where/which 的正常「查无」码
  return 'undetermined'
}

/**
 * @param {{kind:string,url?:string,presentOn?:number[],absentOn?:number[],remote?:string,pattern?:string}} probe
 * @param {{offline?:boolean}} [opts]
 * @returns {Promise<{state:'present'|'absent'|'undetermined',detail:string}>}
 */
export async function runProbe(probe, opts = {}) {
  if (opts.offline) return { state: 'undetermined', detail: '--offline' }
  if (probe.kind === 'http-status') {
    try {
      const res = await fetch(probe.url, { redirect: 'follow', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      const code = res.status
      if ((probe.presentOn ?? [200]).includes(code)) return { state: 'present', detail: `HTTP ${code}` }
      if ((probe.absentOn ?? [404, 410]).includes(code)) return { state: 'absent', detail: `HTTP ${code}` }
      return { state: 'undetermined', detail: `HTTP ${code} 不在 present/absent 值域` }
    } catch (err) {
      return { state: 'undetermined', detail: `fetch 失败:${String(err?.message ?? err).split('\n')[0]}` }
    }
  }
  if (probe.kind === 'git-ls-remote') {
    let bin = 'git'
    try {
      const mod = await import(pathToFileURL(join(REPO_ROOT, 'scripts/lib/gitdir.mjs')).href)
      if (typeof mod.resolveGitBin === 'function') bin = mod.resolveGitBin() || 'git'
    } catch {
      // 共享解析器不可用:退回 PATH,结论行里用的是哪条仍如实(git 跑不动会落 undetermined,不冒判)
    }
    try {
      const out = execFileSync(bin, ['-c', 'safe.directory=*', 'ls-remote', '--tags', probe.remote, probe.pattern], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return out.trim().length > 0
        ? { state: 'present', detail: `origin 有匹配 tag(${out.trim().split(/\r?\n/).length} 条)` }
        : { state: 'absent', detail: '命令 exit 0、输出为空(远端可达且无该前缀 tag)' }
    } catch (err) {
      return { state: 'undetermined', detail: `ls-remote 失败:${String(err?.stderr ?? err?.message ?? err).toString().split('\n')[0]}` }
    }
  }
  return { state: 'undetermined', detail: `未知 probe.kind ${probe.kind}` }
}

/** @returns {{state:'determined',present:string[],missing:[]}|{state:'undetermined',reason:string}} */
function ghSecretState() {
  if (binAvailable('gh') === false) return { state: 'undetermined', reason: 'gh 不在 PATH' }
  try {
    const out = execFileSync('gh', ['secret', 'list', '--repo', 'IHUI-INF-AI/IHUI-AI'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const present = out
      .split(/\r?\n/)
      .map((l) => l.split('\t')[0].trim())
      .filter(Boolean)
    return { state: 'determined', present, missing: [] }
  } catch (err) {
    return { state: 'undetermined', reason: `gh secret list 不可用:${String(err?.stderr ?? err?.message ?? err).toString().split('\n')[0]}` }
  }
}

/** verifyCommand 的 argv[0]:去掉引号,取第一个空白前 token。 */
function firstToken(cmd) {
  return cmd.trim().split(/\s+/)[0].replace(/^["']/, '').replace(/["']$/, '')
}

// ───────────────────────── CLI ─────────────────────────

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return runSelfTest()
  const json = args.includes('--json')
  const offline = args.includes('--offline')
  const mIdx = args.indexOf('--manifest')
  const manifestPath = mIdx >= 0 && args[mIdx + 1] ? resolve(args[mIdx + 1]) : DEFAULT_MANIFEST

  let raw
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    console.error(`❌ 台账不可读(${manifestPath}):${String(err?.message ?? err)}`)
    process.exit(2)
  }
  const structErrors = validateStructure(raw)
  if (structErrors.length) {
    for (const e of structErrors) console.error(`❌ 结构:${e}`)
    process.exit(1)
  }
  const secrets = ghSecretState()
  const rows = []
  let reds = 0
  let decided = secrets.state === 'determined' ? 1 : 0
  for (const ch of raw.channels) {
    const bin = binAvailable(firstToken(ch.verifyCommand || ''))
    const outcome = await runProbe(ch.probe, { offline })
    if (outcome.state !== 'undetermined' || bin !== 'undetermined') decided += 1
    const { red, notes } = decideChannel(ch, { bin, binName: firstToken(ch.verifyCommand || ''), outcome }, secrets)
    reds += red.length
    rows.push({ id: ch.id, status: ch.status, bin, outcome, red, notes })
  }
  const lines = rows.map((r) => {
    const head = `${r.red.length ? '❌' : '  '} ${r.id.padEnd(6)} status=${r.status.padEnd(28)} cmd=${r.bin} probe=${r.outcome.state}(${r.outcome.detail})`
    return [head, ...r.red.map((x) => `     🔴 ${x}`), ...r.notes.map((x) => `     · ${x}`)].join('\n')
  })
  if (json) {
    console.log(JSON.stringify({ manifest: manifestPath, ghSecrets: secrets, rows }, null, 2))
  } else {
    console.log(`SDK 发布通道就绪性实跑对账(台账:${manifestPath};gh:${secrets.state === 'determined' ? '实测 secrets 清单在握' : `未判定 —— ${secrets.reason}`})`)
    console.log(lines.join('\n'))
  }
  if (reds > 0) {
    console.error(`\n❌ 判红 ${reds} 条 —— 台账与实跑读数不一致(或缺 verifyCommand 可跑性)`); process.exit(1)
  }
  if (decided === 0) {
    console.error('\n⚠️ 所有通道的可跑性/回读均未判定且 gh 身份不可用 —— 无法判定,不记绿'); process.exit(2)
  }
  console.log('\n✅ 无判红项(未判定项已逐条点名,未判定 ≠ 通过)')
  process.exit(0)
}

// ───────────────────────── 自检(零外部依赖:本地 http server + 临时 git 仓) ─────────────────────────

/** @returns {Promise<void>} */
async function runSelfTest() {
  const { mkScratch, rmScratch } = await import(pathToFileURL(join(REPO_ROOT, 'scripts/lib/scratch-dir.mjs')).href)
  let pass = 0
  let fail = 0
  const ok = (name, cond, extra = '') => {
    if (cond) {
      pass += 1
      console.log(`  ✔ ${name}`)
    } else {
      fail += 1
      console.error(`  ✘ ${name}${extra ? ` —— ${extra}` : ''}`)
    }
  }
  const ch = (over) => ({ id: 'npm', status: 'blocked-by-credential', verifyCommand: 'npm view x', requiredSecrets: ['NPM_TOKEN'], probe: { kind: 'none' }, ...over })
  const det = { state: 'present', detail: 'HTTP 200' }
  const ab = { state: 'absent', detail: 'HTTP 404' }
  const un = { state: 'undetermined', detail: 'self-test fixture' }
  const yes = { bin: true, binName: 'npm', outcome: ab }

  // 判据矩阵:双向各留牙
  ok('S1 blocked + absent → 无红', decideChannel(ch({}), yes).red.length === 0)
  ok('S2 blocked + present → 红(已解除仍挂着)', decideChannel(ch({}), { ...yes, outcome: det }).red.some((x) => x.includes('台账腐烂')))
  ok('S3 ready + absent → 无红(就绪未首发是正当态)', decideChannel(ch({ status: 'ready', requiredSecrets: [] }), yes).red.length === 0)
  ok('S4 ready + undetermined → 红(声称就绪却无法验证)', decideChannel(ch({ status: 'ready', requiredSecrets: [] }), { ...yes, outcome: un }).red.some((x) => x.includes('无法验')))
  ok('S5 假 ready 的注入面:present → 无红但必留提示', decideChannel(ch({ status: 'ready', requiredSecrets: [] }), { ...yes, outcome: det }).notes.length === 1)
  ok('S6 verifyCommand 不可跑 → 必红(与 status 无关)', decideChannel(ch({}), { bin: false, binName: 'no-such-bin', outcome: ab }).red.some((x) => x.includes('不可跑')))
  const sec = { state: 'determined', present: ['SMTP_PASS'], missing: [] }
  ok('S7 ready + secret 缺 → 红', decideChannel(ch({ status: 'ready', requiredSecrets: ['NPM_TOKEN'] }), yes, sec).red.some((x) => x.includes('secrets 缺')))
  const secHasIt = { state: 'determined', present: ['NPM_TOKEN'], missing: [] }
  ok('S8 blocked-credential + secret 已在 → 不红只提示(secret 存在 ≠ 可用)', decideChannel(ch({}), yes, secHasIt).red.length === 0 && decideChannel(ch({}), yes, secHasIt).notes.some((x) => x.includes('≠ 可用')))
  // 结构判据的变异对照
  const good = { $schemaVersion: 1, channels: EXPECTED_CHANNEL_IDS.map((id) => ({ id, status: 'blocked-by-credential', blocker: 'fixture blocker 描述', unblockAction: 'fixture 解除动作', requiredSecrets: [], verifyCommand: 'npm view x', probe: { kind: 'git-ls-remote', remote: 'origin', pattern: 'refs/tags/v*' } })) }
  ok('S9 合规台账 → 结构零错', validateStructure(good).length === 0, validateStructure(good).join(';'))
  ok('S10 摘掉 nuget 通道 → 必报缺', validateStructure({ ...good, channels: good.channels.filter((c) => c.id !== 'nuget') }).some((x) => x.includes('nuget')))
  ok('S11 status 拼错 → 必报枚举', validateStructure({ ...good, channels: good.channels.map((c, i) => (i === 0 ? { ...c, status: 'almost-ready' } : c)) }).some((x) => x.includes('不在枚举')))
  ok('S12 blocked 而无解除动作 → 必报 unblockAction', validateStructure({ ...good, channels: good.channels.map((c, i) => (i === 0 ? { ...c, unblockAction: '' } : c)) }).some((x) => x.includes('unblockAction')))
  ok('S13 blocked 而 probe=none → 必报缺实跑探针', validateStructure({ ...good, channels: good.channels.map((c, i) => (i === 0 ? { ...c, probe: { kind: 'none' } } : c)) }).some((x) => x.includes('probe')))

  // http 探针真跑:present / absent / 端口关闭 → undetermined(不是 present 也不是 absent)
  const server = createServer((req, res) => {
    if (req.url === '/present') res.writeHead(200).end('{}')
    else res.writeHead(404).end('')
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port
  ok('S14 http present', (await runProbe({ kind: 'http-status', url: `http://127.0.0.1:${port}/present` })).state === 'present')
  ok('S15 http absent', (await runProbe({ kind: 'http-status', url: `http://127.0.0.1:${port}/missing` })).state === 'absent')
  await new Promise((r) => server.close(r))
  ok('S16 端口已关 → undetermined(绝不落进 present/absent)', (await runProbe({ kind: 'http-status', url: `http://127.0.0.1:${port}/present` })).state === 'undetermined')

  // git-ls-remote 探针:临时裸仓当 remote,tag 前 absent、打标后 present
  const scratch = mkScratch('sdk-channels')
  try {
    const work = join(scratch, 'work')
    const g = (a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: work, windowsHide: true, timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
    execFileSync('git', ['init', work], { windowsHide: true, timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] })
    const { writeFileSync } = await import('node:fs')
    writeFileSync(join(work, 'f.txt'), 'x')
    g(['add', 'f.txt'])
    g(['commit', '-m', 't'])
    const before = await runProbe({ kind: 'git-ls-remote', remote: work, pattern: 'refs/tags/v*' })
    g(['tag', 'v1.2.3'])
    const after = await runProbe({ kind: 'git-ls-remote', remote: work, pattern: 'refs/tags/v*' })
    ok('S17 ls-remote 无 tag → absent', before.state === 'absent', JSON.stringify(before))
    ok('S18 ls-remote 有 tag → present', after.state === 'present', JSON.stringify(after))
  } finally {
    rmScratch(scratch)
  }

  console.log(`\nself-test: ${pass} 通过 / ${fail} 失败`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
