// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 暴露凭据主动轮换器(2026-10-30 立,goal-b35 s6)—— 三面齐全的一条腿。
 *
 * 立因(不是运维活,是功能缺口):本仓早有取票/续票能力
 * (scripts/lib/trae-auth-extract.mjs 取、relay-account-pool-scheduler 的 refreshOne 续、
 * sync-trae-client-session.mjs 回灌、docs/RELAY_TRAE_SESSION_EVIDENCE.md 有实测证据链),
 * 但**续票是被动的**(撞 401 / 临期才换)。2026-10-25 有一枚 1.8MB 的 Trae 会话导出附件被误提交
 * 入库(含凭据形态行),2026-10-29 由提交
 * 34036e6a83d0934b277158e7b855036e0dca3d7c 从跟踪摘除,**历史 blob 仍在**。在「凭据已暴露」这一
 * 触发条件下没有任何腿主动把它换掉 ⇒ 泄露的旧值在被动的下一次 401 之前一直是活的。
 *
 * ① 触发面:按「已知暴露值」的 sha256 前缀(fp)执行一次轮换 —— 走既有 refresh 通道
 *    (apps/api/scripts/relay-rotate-exposed-credential.ts 里 import `refreshOne`,本文件零换票实现),
 *    回灌池,并**验证旧值不再被接受**(上游明确拒收才算轮换有效;只换不验 = 没做)。
 *    取不到旧值 / 库不在线 ⇒ 显式「未判定」exit 2,不记绿(§0.3)。
 * ② 登记面:`scripts/data/exposed-credentials.jsonl`(可机读暴露清单,只住 fp 与出处,**绝不含凭据原文**);
 *    每轮把清单条目与号池现值对账,池里仍住着暴露值 ⇒ 点名(uid/name,不点值)。
 * ③ 节律面:由 scripts/git-guardian.mjs 的 `sweepExposedCredentialRotation()` 派发
 *    (与 sweepStaleClosedRows / auditCrossEndParityDrift 同族,节流台账在
 *    .ihui-agent/state/exposed-credential-rotation-last.json);判据 = 存在未结清的暴露条目才动,
 *    空转零写零推零派生。
 *
 * 凭据红线:本文件不读也不写任何凭据原文。`--register` 从**仓外**文件取值,只在内存里做
 * sha256,落盘的只有 fp;轮换用的旧值明文由池侧解密、只在子进程内存里存在,输出面经
 * `safeRowOut()` 白名单投影(子进程多给的键一律丢弃 —— canary 探针钉这一点)。
 *
 * 跑法:
 *   node scripts/rotate-exposed-upstream-credentials.mjs [--dry-run] [--json]
 *   node scripts/rotate-exposed-upstream-credentials.mjs --list
 *   node scripts/rotate-exposed-upstream-credentials.mjs --register --provider trae \
 *        --kind refreshToken --value-file <仓外路径> --source-commit <40 位 sha> --note "<出处>"
 *   node scripts/rotate-exposed-upstream-credentials.mjs --retire --id EXP-1 --reason "<≥10 字定向说明>"
 *
 * 退出码:0 结清(clean/rotated)/ 1 假轮换或换票失败(点名)/ 2 未判定(取不到输入、旧值无法自证)。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveTsxCli } from './lib/tsx-cli.mjs'
import { scratchRoot } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LEDGER_DEFAULT = join(ROOT, 'scripts', 'data', 'exposed-credentials.jsonl')
const STATE_DEFAULT = join(ROOT, '.ihui-agent', 'state', 'exposed-credential-rotation.jsonl')
const TS_LEG = join(ROOT, 'apps', 'api', 'scripts', 'relay-rotate-exposed-credential.ts')
const API_DIR = join(ROOT, 'apps', 'api')
/** 终态处置:旧值已被上游明确拒收,或经具名理由人工结清 */
const TERMINAL_DECISIONS = new Set(['rotated-dead', 'retired'])
const KINDS = new Set(['accessToken', 'refreshToken'])

export function parseArgs(argv) {
  const o = {
    mode: 'rotate',
    dryRun: false,
    json: false,
    ledger: LEDGER_DEFAULT,
    state: STATE_DEFAULT,
    help: false,
    error: null,
    register: { provider: '', kind: '', valueFile: '', sourceCommit: '', note: '' },
    retire: { id: '', reason: '' },
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i] ?? ''
    if (a === '--dry-run') o.dryRun = true
    else if (a === '--json') o.json = true
    else if (a === '--list') o.mode = 'list'
    else if (a === '--register') o.mode = 'register'
    else if (a === '--retire') o.mode = 'retire'
    else if (a === '--ledger') o.ledger = next()
    else if (a === '--state') o.state = next()
    else if (a === '--provider') o.register.provider = next()
    else if (a === '--kind') o.register.kind = next()
    else if (a === '--value-file') o.register.valueFile = next()
    else if (a === '--source-commit') o.register.sourceCommit = next()
    else if (a === '--note') o.register.note = next()
    else if (a === '--id') o.retire.id = next()
    else if (a === '--reason') o.retire.reason = next()
    else if (a === '--help' || a === '-h') o.help = true
    else if (a === '--') continue
    else o.error = `未知参数: ${a}`
  }
  // 登记与退役是互斥动作,混给等于让人猜 ⇒ 当场拒
  if (o.mode === 'register' && !o.register.valueFile)
    o.error = '--register 必须带 --value-file <仓外路径>'
  if (o.mode === 'register' && !KINDS.has(o.register.kind))
    o.error = `--kind 必须是 ${[...KINDS].join('|')}`
  if (o.mode === 'retire' && !o.retire.id) o.error = '--retire 必须带 --id'
  if (o.mode === 'retire' && String(o.retire.reason).trim().length < 10)
    o.error = '--retire 必须带 --reason "<≥10 字定向说明>"(§0.10:结清要交代,不是消红通道)'
  return o
}

/** 与号池导入侧同一把尺(scripts/lib/trae-auth-extract.fingerprintOf),不在本文件复写 sha256 截断 */
export async function sharedFingerprint() {
  const m = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'trae-auth-extract.mjs')).href)
  return m.fingerprintOf
}

export function parseLedger(text) {
  const entries = []
  const rot = []
  let n = 0
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim()
    if (t === '' || t.startsWith('//')) continue
    n++
    let row = null
    try {
      row = JSON.parse(t)
    } catch {
      rot.push({ line: n, why: '不是合法 JSON' })
      continue
    }
    const id = String(row?.id ?? '').trim()
    const provider = String(row?.provider ?? '').trim()
    const kind = String(row?.kind ?? '').trim()
    const fp = String(row?.fp ?? '')
      .trim()
      .toLowerCase()
    if (!id || !provider || !kind || !/^[0-9a-f]{8,64}$/.test(fp)) {
      rot.push({
        line: n,
        why: `缺 id/provider/kind/fp:id=${id || '?'} kind=${kind || '?'} fp 形态不合法`,
      })
      continue
    }
    entries.push({
      id,
      provider,
      kind,
      fp,
      source: row?.source ?? null,
      registeredAt: row?.registeredAt ?? null,
    })
  }
  return { entries, rot, lines: n }
}

export function readLedger(file) {
  if (!existsSync(file)) return { ok: false, why: `暴露清单不存在:${file}`, entries: [], rot: [] }
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    return {
      ok: false,
      why: `暴露清单读不出:${String(e?.message ?? e).slice(0, 120)}`,
      entries: [],
      rot: [],
    }
  }
  const parsed = parseLedger(text)
  return { ok: true, ...parsed }
}

export function readDispositions(file) {
  if (!existsSync(file)) return { rows: [], unreadable: false }
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return { rows: [], unreadable: true }
  }
  const rows = []
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim()
    if (t === '' || !t.startsWith('{')) continue
    try {
      rows.push(JSON.parse(t))
    } catch {
      /* 坏行:留痕只作终态判定,坏行当"没有终态"(失效方向 = 多要一次轮换,不是多放一次) */
    }
  }
  return { rows, unreadable: false }
}

/** 终态 = 同 id ∧ 同 fp 有 rotated-dead / retired 留痕(fp 变了就是新靶,老终态不算) */
export function isSettled(dispositions, entry) {
  return dispositions.some(
    (d) =>
      String(d?.id) === entry.id &&
      String(d?.fp ?? '').toLowerCase() === entry.fp &&
      TERMINAL_DECISIONS.has(String(d?.decision)),
  )
}

/**
 * 子进程行 → 输出行的**白名单投影**:只交出这几列,其余键(哪怕子进程多塞了凭据)一律丢弃。
 * canary 探针钉的就是这一格:把假凭据塞进子进程输出的任意键,断言它不出现在任何输出面。
 */
export const SAFE_ROW_KEYS = Object.freeze([
  'id',
  'provider',
  'kind',
  'fp',
  'uid',
  'name',
  'decision',
  'poolFpBefore',
  'poolFpAfter',
  'oldAccepted',
  'errorKind',
])

export function safeRowOut(row) {
  const out = {}
  for (const k of SAFE_ROW_KEYS) {
    const v = row?.[k]
    if (v === undefined) continue
    out[k] = typeof v === 'string' ? v.slice(0, 200) : v
  }
  return out
}

export function buildRequest(entries, dryRun) {
  return JSON.stringify({
    mode: 'rotate',
    dryRun,
    entries: entries.map((e) => ({ id: e.id, provider: e.provider, kind: e.kind, fp: e.fp })),
  })
}

/** 结论优先级:假轮换 > 换票失败 > 未判定 > 已换死 > 空转(dry-run 另走 preflight) */
export function judge({ dryRun, rot, spawn, summary }) {
  if (!spawn || !summary)
    return { state: 'undetermined', why: spawn ? '未取到子进程结论行' : '执行器未派生', counts: {} }
  if (summary.aliveSuspect > 0)
    return { state: 'fake-rotation', why: null, counts: countsOf(summary) }
  if (summary.failed > 0) return { state: 'failed', why: null, counts: countsOf(summary) }
  if (rot > 0 || summary.unjudged > 0)
    return {
      state: 'undetermined',
      why: rot > 0 ? `清单腐烂 ${rot} 行` : '旧值无法自证或取不到输入',
      counts: countsOf(summary),
    }
  if (dryRun) return { state: 'preflight', why: null, counts: countsOf(summary) }
  if (summary.rotated > 0) return { state: 'rotated', why: null, counts: countsOf(summary) }
  return { state: 'clean', why: null, counts: countsOf(summary) }
}

function countsOf(s) {
  return {
    entries: s.total,
    matched: s.matched,
    rotated: s.rotated,
    dead: s.deadVerified,
    alive: s.aliveSuspect,
    absent: s.absent,
    unjudged: s.unjudged,
    failed: s.failed,
  }
}

export function resultLine(v, rot) {
  const c = v.counts || {}
  const kv = (k, d = '0') => `${k}=${c[k] ?? d}`
  return `ROTATE-RESULT state=${v.state} rot=${rot ?? 0} ${kv('entries')} ${kv('matched')} ${kv('rotated')} ${kv('dead')} ${kv('alive')} ${kv('absent')} ${kv('unjudged')} ${kv('failed')}${v.why ? ` why=${String(v.why).replace(/\s+/g, '+').slice(0, 80)}` : ''}`
}

const CODE_BY_STATE = {
  clean: 0,
  rotated: 0,
  preflight: 0,
  'fake-rotation': 1,
  failed: 1,
  undetermined: 2,
}

/** 派生 api 侧执行器:tsx 与库内其他回灌腿同一把找法(scripts/lib/tsx-cli.mjs,§0.6 不另立第二条) */
export function defaultInvoke(requestText, dryRun) {
  const tsx = resolveTsxCli(ROOT)
  if (!tsx)
    return { code: 2, json: null, error: '未找到 tsx(apps/api/node_modules/tsx);先 pnpm install' }
  const args = [tsx, TS_LEG, '--stdin', '--json']
  if (dryRun) args.push('--dry-run')
  const r = spawnSync(process.execPath, args, {
    cwd: API_DIR,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 1 << 22,
    input: requestText,
    // 带输入必须三段全接管(AGENTS §12g)
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let json = null
  for (const line of String(r.stdout ?? '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      json = JSON.parse(t)
    } catch {
      /* 噪音行继续找 */
    }
  }
  return {
    code: r.status ?? 2,
    json,
    error: json ? null : String(r.stderr || `退出码 ${r.status ?? '?'}`).slice(0, 300),
  }
}

function appendState(file, rows, logger) {
  if (!rows.length) return
  try {
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  } catch (e) {
    logger(
      `⚠️ 轮换留痕写入失败(不改变本轮结论,但下轮会重判):${String(e?.message ?? e).slice(0, 120)}`,
    )
  }
}

export async function runOnce(opts = {}) {
  const {
    ledgerFile = LEDGER_DEFAULT,
    stateFile = STATE_DEFAULT,
    dryRun = false,
    json = false,
    invoke = defaultInvoke,
    logger = (m) => process.stderr.write(`${m}\n`),
    now = new Date().toISOString(),
    fpOf = sharedFingerprint,
  } = opts
  const led = readLedger(ledgerFile)
  if (!led.ok) {
    const v = { state: 'undetermined', why: led.why, counts: {} }
    logger(resultLine(v, 0))
    return { code: 2, verdict: v, rows: [], pending: 0 }
  }
  const { rows: dispositions } = readDispositions(stateFile)
  const pending = led.entries.filter((e) => !isSettled(dispositions, e))
  if (pending.length === 0) {
    // 空转:零派生、零写入、零推送(§5e-1 与"无滞留即零落地"同族)
    const v = {
      state: 'clean',
      why: null,
      counts: {
        entries: led.entries.length,
        matched: 0,
        rotated: 0,
        dead: 0,
        alive: 0,
        absent: 0,
        unjudged: 0,
        failed: 0,
      },
    }
    logger(
      `ROTATE-SKIP 无未结清暴露条目(清单 ${led.entries.length} 枚,全部有终态处置)⇒ 本轮零派生零写入`,
    )
    logger(resultLine(v, led.rot.length))
    return { code: 0, verdict: v, rows: [], pending: 0 }
  }
  const spawn = invoke(buildRequest(pending, dryRun), dryRun)
  if (spawn.error || !spawn.json) {
    const v = { state: 'undetermined', why: spawn.error ?? '子进程无 JSON 结论', counts: {} }
    logger(resultLine(v, led.rot.length))
    return { code: 2, verdict: v, rows: [], pending: pending.length }
  }
  const summary = spawn.json
  const v = judge({ dryRun, rot: led.rot.length, spawn, summary })
  const rows = (Array.isArray(summary.rows) ? summary.rows : []).map(safeRowOut)
  if (!dryRun) {
    const toWrite = rows
      .filter((r) => r.decision !== 'dry-run-matched')
      .map((r) => ({ at: now, seat: 'rotate-exposed-upstream-credentials', ...r }))
    appendState(stateFile, toWrite, logger)
  }
  for (const r of rows) {
    if (r.decision === 'rotated-alive')
      logger(
        `❌ 假轮换点名:${r.id} ${r.provider}/${r.kind} uid=${r.uid ?? '-'} 池=${r.poolFpAfter ?? '?'} 暴露=${r.fp} ⇒ 旧值仍被上游接受(${r.errorKind ?? '未附类别'})`,
      )
    else if (r.decision === 'rotate-failed' || r.decision === 'no-adapter')
      logger(
        `❌ 换票失败点名:${r.id} ${r.provider}/${r.kind} uid=${r.uid ?? '-'} ⇒ ${r.decision}(${r.errorKind ?? '-'})`,
      )
    else if (r.decision === 'unjudged')
      logger(
        `⚠️ 未判定点名:${r.id} ${r.provider}/${r.kind} uid=${r.uid ?? '-'} ⇒ ${r.errorKind ?? '取不到输入'}`,
      )
    else if (r.decision === 'absent')
      logger(
        `ℹ️ 池内无此暴露值:${r.id} ${r.provider}/${r.kind} fp=${r.fp}(无法自证旧值已死 ⇒ 按未判定处理,出路 --retire --reason)`,
      )
    else if (r.decision === 'rotated-dead')
      logger(
        `✅ 轮换有效:${r.id} ${r.provider}/${r.kind} uid=${r.uid ?? '-'} 新值 fp=${r.poolFpAfter ?? '?'}`,
      )
    else if (r.decision === 'dry-run-matched')
      logger(
        `ℹ️ 预演命中:${r.id} ${r.provider}/${r.kind} uid=${r.uid ?? '-'} ⇒ 池内现值即暴露值(本轮未换,出路 = 不带 --dry-run)`,
      )
  }
  logger(resultLine(v, led.rot.length))
  const out = {
    state: v.state,
    counts: v.counts,
    why: v.why,
    pending: pending.length,
    rot: led.rot.length,
    rows,
  }
  if (json) process.stdout.write(`${JSON.stringify(out)}\n`)
  return { code: CODE_BY_STATE[v.state] ?? 2, verdict: v, rows, pending: pending.length }
}

export async function registerEntry(opts, logger = (m) => process.stderr.write(`${m}\n`)) {
  const { ledgerFile = LEDGER_DEFAULT, register } = opts
  if (!existsSync(ledgerFile)) {
    logger(`❌ 暴露清单不存在:${ledgerFile} ⇒ 未判定(不新建空清单再往里塞)`)
    return 2
  }
  // 取值面必须落在 git 面之外:仓内普通路径当输入 = 把凭据文件重新请回仓库(红线);
  // §15b 批准的临时夹具根(scratchRoot,已在 .gitignore 且带坏 gitfile 边界)不算仓内。
  const valuePath = resolve(register.valueFile)
  const rel = relative(ROOT, valuePath)
  const scratch = resolve(scratchRoot())
  const inScratch = scratch === valuePath || valuePath.startsWith(scratch + sep)
  if ((rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) && !inScratch) {
    logger(
      '❌ --value-file 必须落在仓库 git 面之外(登记面只住 fp,仓内不得住凭据;批准临时夹具根除外)⇒ 未判定',
    )
    return 2
  }
  if (!existsSync(valuePath)) {
    logger(`❌ --value-file 读不到:${valuePath} ⇒ 未判定`)
    return 2
  }
  const value = readFileSync(valuePath, 'utf8').trim()
  if (!value) {
    logger('❌ --value-file 内容为空 ⇒ 未判定')
    return 2
  }
  // opts.fpOf 是"提供指纹实现的 thunk"(测试注入用);缺省走仓内唯一尺 trae-auth-extract
  const fpImpl = opts.fpOf ? await opts.fpOf() : await sharedFingerprint()
  const fp = fpImpl(value)
  const text = readFileSync(ledgerFile, 'utf8')
  const dup = text.split(/\r?\n/).some((l) => {
    try {
      return String(JSON.parse(l)?.fp).toLowerCase() === fp
    } catch {
      return false
    }
  })
  if (dup) {
    logger(`ℹ️ 该暴露值已登记(fp=${fp})⇒ 幂等不重复登记`)
    return 0
  }
  const ids = [...text.matchAll(/"id"\s*:\s*"EXP-(\d+)"/g)].map((m) => Number(m[1]))
  const id = `EXP-${(ids.length ? Math.max(...ids) : 0) + 1}`
  const row = {
    id,
    provider: register.provider,
    kind: register.kind,
    fp,
    // 只登记不可逆摘要;值本身留在仓外文件里
    len: value.length,
    source: {
      commit: String(register.sourceCommit || '').slice(0, 40) || null,
      note: String(register.note || '').slice(0, 200) || null,
    },
    registeredAt: new Date().toISOString().slice(0, 10),
  }
  appendFileSync(ledgerFile, `${JSON.stringify(row)}\n`, 'utf8')
  logger(`✅ 已登记 ${id} ${row.provider}/${row.kind} fp=${fp}(len=${row.len};清单内不含凭据原文)`)
  return 0
}

export function retireEntry(opts, logger = (m) => process.stderr.write(`${m}\n`)) {
  const { stateFile = STATE_DEFAULT, retire } = opts
  const led = readLedger(opts.ledgerFile || LEDGER_DEFAULT)
  const entry = led.entries.find((e) => e.id === retire.id)
  if (!entry) {
    logger(`❌ 清单里没有 ${retire.id} ⇒ 未判定(不写无靶的终态留痕)`)
    return 2
  }
  const row = {
    at: new Date().toISOString(),
    seat: 'rotate-exposed-upstream-credentials',
    id: entry.id,
    provider: entry.provider,
    kind: entry.kind,
    fp: entry.fp,
    decision: 'retired',
    reason: String(retire.reason).slice(0, 300),
  }
  appendState(stateFile, [row], logger)
  logger(`✅ 已按具名理由结清 ${entry.id}(fp=${entry.fp};理由入留痕,不入清单)`)
  return 0
}

export function listLedger(opts, logger = (m) => process.stderr.write(`${m}\n`)) {
  const led = readLedger(opts.ledgerFile || LEDGER_DEFAULT)
  if (!led.ok) {
    logger(`❌ ${led.why} ⇒ 未判定`)
    return 2
  }
  const { rows } = readDispositions(opts.stateFile || STATE_DEFAULT)
  for (const e of led.entries) {
    const settled = isSettled(rows, e)
    const d = rows.filter((r) => String(r?.id) === e.id).slice(-1)[0]
    logger(
      `${settled ? '✅' : '⏳'} ${e.id} ${e.provider}/${e.kind} fp=${e.fp} 登记=${e.registeredAt ?? '?'} 终态=${settled ? d?.decision : '无'}`,
    )
  }
  for (const r of led.rot) logger(`❌ 清单腐烂行 ${r.line}:${r.why}`)
  logger(
    `ROTATE-LIST entries=${led.entries.length} settled=${led.entries.filter((e) => isSettled(rows, e)).length} rot=${led.rot.length}`,
  )
  return led.rot.length > 0 ? 2 : 0
}

async function main(argv) {
  const o = parseArgs(argv)
  if (o.error) {
    process.stderr.write(`❌ ${o.error}\n`)
    return 2
  }
  if (o.help) {
    process.stdout.write(
      '用法: node scripts/rotate-exposed-upstream-credentials.mjs [--dry-run|--list|--register|--retire] [--json]\n' +
        '  默认档:读 scripts/data/exposed-credentials.jsonl → 与号池现值对账 → 命中即走既有 refresh 通道轮换 → 自证旧值不再被接受\n' +
        '  --register --provider <p> --kind <accessToken|refreshToken> --value-file <仓外路径> --source-commit <sha40> --note "<出处>"\n' +
        '  --retire --id <EXP-n> --reason "<≥10 字定向说明>"\n' +
        '  任何输出面不含凭据原文;换票与判据一律 import 既有单源(本文件零第二份实现)。\n',
    )
    return 0
  }
  if (o.mode === 'list') return listLedger(o)
  if (o.mode === 'register') return registerEntry(o)
  if (o.mode === 'retire') return retireEntry(o)
  const r = await runOnce({
    ledgerFile: o.ledger,
    stateFile: o.state,
    dryRun: o.dryRun,
    json: o.json,
  })
  return r.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  parseLedger,
  readLedger,
  readDispositions,
  isSettled,
  safeRowOut,
  SAFE_ROW_KEYS,
  buildRequest,
  judge,
  resultLine,
  runOnce,
  listLedger,
  retireEntry,
  registerEntry,
  TERMINAL_DECISIONS,
  CODE_BY_STATE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
