#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本器是派单板,机器读数必须走 stdout */
/**
 * dispatch-board — 排他切席板(2026-10-27 立)。
 *
 * 收的是哪一格:主席给人派单时靠三条**手纪律**判断两席会不会打架 ——
 *   ① 票面点名文件两两不相交;② 不在当前脏文件集;③ 不挂任何在册租约牌。
 * 三条从来没有器物算过(现读 `scripts/` 无一把尺子判"两票同一块地"),于是"不允许两席做
 * 同一件任务"只能靠主席肉眼,而肉眼在同仓 3 个会话 + 每 2–4 分钟推进一次的 HEAD 下必然漏。
 * 本器把这三条变成可复跑的读数,并多做一件它们本来做不到的事:**最大不相交子集**(一次 wave
 * 能同时开几席),以及**空转归因**(排不进席位时,到底是台账没活、还是全被重叠/脏面/租约挡死)。
 *
 * 立因(2026-10-27 实测,不是假想):本席用 worktree 隔离一次派 5 席,每席检出 16,673 个文件,
 * G: 盘余量 3.1 GB ⇒ 五席全部 `No space left on device`,零产出。派单器不量盘就是替人造灾难,
 * 所以**磁盘容量前置判据是本器的第 0 步**,不是可选项。
 *
 * 判据单源(§0.6,本器一律 import,不写第二份):
 *   登记行/票号/挂牌 —— `lib/plan-task-index.mjs` 的 parseTaskRows / keyOfRow / claimMarkOf;
 *   票面点名路径 —— `check-live-doc-references.mjs` 的 extractRefs(与 fileConflictOverlay 同尺);
 *   脏集/HEAD 集 —— `plan-tasks.mjs` 的 collectDirtyPaths / collectHeadPaths(取不到返回 null);
 *   出单口径 —— 不自己算:子进程跑**唯一入口** `node scripts/plan-tasks.mjs --open
 *   --dispatchable --exclude-inflight`,再按 L 行号 + 正文前缀双重核验落回 HEAD blob 全文。
 *
 * 行号核验(为什么不能只信 L####):§1 明令行号不配当可追责指针(一次 append 就挪位)。这里行号
 *   只做**同轮内**的取数键,且必须再比一次正文前缀;前缀对不上 ⇒ 该行标 anchorMismatch、
 *   从计划里剔除并点名,绝不带着错作用域去派席(那正是"两席同一块地"的成因)。
 *
 * 分档(§0.3:没判不许写成判过):
 *   clean        exit 0  wave 排出来了(或派单面本就 0 枚且逐格判过 ⇒ state=idle-no-backlog);
 *   spinning     exit 1  有可派票却一枚都排不进席位(全被重叠/热文件/anchorMismatch 挡死)
 *                          ⇒ 这就是"席位空转",主席必须重排,不是"今天没活";
 *   undetermined exit 2  输入取不到:HEAD 读不到 / 唯一入口跑失败或超时 / 脏集或盘容量读不出。
 *   未判定优先于其它档。
 *
 * 只判 HEAD blob。`--staged` / `--worktree` 一律拒收(§0.4 同面同轮;派单基线必须是提交链上的账)。
 * 本器**只读不写**:不改台账、不摘牌、不落地。摘牌归 strip-stale-claim-marks,翻勾归 live-doc-edit。
 * 入口(现读形态):本器**尚未接进任何权威接线点** —— 主席直接跑 `node scripts/dispatch-board.mjs
 * --seats N`。要加根 `package.json` 的 `check:dispatch-board` 别名,必须与 AGENTS/README 的 R4 点名
 * 同批提交(门 89 R4),而 AGENTS.md 在 HEAD 面上已超预算(2026-10-27 现读 101,848 > 96,000,门 207),
 * 所以那一格的前置 = 先做体积清偿。按 §12e 它判"此刻谁在干什么",本身也不该进提交链。
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readFileSync, statfsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseTaskRows, keyOfRow, claimMarkOf } from './lib/plan-task-index.mjs'
import { extractRefs } from './check-live-doc-references.mjs'
import { collectDirtyPaths, collectHeadPaths } from './plan-tasks.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

/** 活文档与注册表这类"人人都要写"的文件:两张票同时点它 = 同一块地,哪怕业务代码不相交。 */
export const HOT_FILES = Object.freeze([
  'PROJECT_PLAN.md',
  'AGENTS.md',
  'README.md',
  'README.en.md',
  'README.ja.md',
  'README.ko.md',
  'README.zh-TW.md',
  'package.json',
  'scripts/guardian-runner.mjs',
  'packages/design-tokens/src/styles/tokens.css',
])

/** 盘容量地板(GB):低于此值不许派新席 —— 今天五席全死在这格上。 */
export const DISK_FLOOR_GB_DEFAULT = 4

/** 唯一入口的超时:plan-tasks 单跑实测 2–4 分钟,短 timeout 会把"还在跑"读成"失败"。 */
export const PLAN_TASKS_TIMEOUT_MS_DEFAULT = 15 * 60 * 1000

/** 名额不足与外部声明的默认存活期:与超龄认领牌那把尺同量级(小时),写死了会长期占着别人的地。 */
export const SEAT_CLAIM_TTL_MINUTES_DEFAULT = 90

/**
 * 席位作用域台账(仓内运行态,`.ihui-agent/*` 已被 gitignore ⇒ 不进任何审面)。
 * 收的是跨**会话**那一格:各主席的派单只在自己脑子里,对席看不见 ⇒ 同一台机上两个会话
 * 各开一席去做同一枚票时,谁都不觉得自己打架。本台账把"我这席占着哪些文件"落成机器可读行,
 * 板子装载他席未过期的声明后,把它们**当作已占的地**排出去。
 * 过期即失效(不续租就是没在干),读不到 ⇒ 该维落未判定,不得当成"没有别席在飞"。
 */
export const SEAT_LEDGER_REL = '.ihui-agent/state/seat-scopes.jsonl'

export function seatLedgerPath(root) {
  return path.join(root, SEAT_LEDGER_REL)
}

/** 装载席位声明。文件不存在/读不出 ⇒ null(调用方必须喊未判定,不得回落成空集)。 */
export function loadSeatClaims(root, { nowMs = Date.now(), selfSeat = null } = {}) {
  let text
  try {
    text = readFileSync(seatLedgerPath(root), 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT')
      // 台账不存在 = 还没人登记过。这不等于"没有别席在飞"(不登记恰恰是漏的地方),
      // 所以调用方要按 ledgerState='absent' 喊一句"未登席的次次不受本器保护"。
      return { claims: [], malformed: [], ledgerState: 'absent', reason: null }
    return { claims: null, reason: `席位台账读不出(${SEAT_LEDGER_REL}:${String(e?.code ?? e?.message).slice(0, 40)})` }
  }
  const claims = []
  const malformed = []
  let seq = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    seq += 1
    let o
    try {
      o = JSON.parse(line)
    } catch {
      malformed.push(seq)
      continue
    }
    if (!o || typeof o.seat !== 'string' || !Array.isArray(o.paths) || typeof o.at !== 'string') {
      malformed.push(seq)
      continue
    }
    let atMs
    try {
      atMs = Date.parse(o.at)
    } catch {
      atMs = NaN
    }
    if (!Number.isFinite(atMs)) {
      malformed.push(seq)
      continue
    }
    const ttl = Number.isFinite(Number(o.ttlMinutes)) && Number(o.ttlMinutes) > 0 ? Number(o.ttlMinutes) : SEAT_CLAIM_TTL_MINUTES_DEFAULT
    const ageMin = (nowMs - atMs) / 60000
    if (o.releasedAt) continue // 已收席 ⇒ 这块地当场还回去(留着行只是为了有出处)
    if (ageMin > ttl) continue // 过期 = 失效,不占别人的地
    if (selfSeat && o.seat === selfSeat) continue
    claims.push({ seat: o.seat, paths: o.paths.map((p) => String(p).replace(/\/+$/, '')), ageMin: Math.round(ageMin) })
  }
  return { claims, malformed, reason: null }
}

/** 追加一枚席位声明(只追加,不改别人的行;落地由调用方主席做)。 */
export function appendSeatClaim(root, { seat, ticket = null, paths, ttlMinutes = SEAT_CLAIM_TTL_MINUTES_DEFAULT, nowIso = new Date().toISOString() }) {
  if (!seat || !Array.isArray(paths) || paths.length === 0) return { ok: false, reason: 'seat 与 paths(非空数组)都必给' }
  const rec = { at: nowIso, seat, ticket, paths: paths.map((p) => String(p).replace(/\/+$/, '')), ttlMinutes }
  try {
    mkdirSync(path.dirname(seatLedgerPath(root)), { recursive: true })
    appendFileSync(seatLedgerPath(root), `${JSON.stringify(rec)}\n`, 'utf8')
    return { ok: true, rec }
  } catch (e) {
    return { ok: false, reason: `写入失败:${String(e?.code ?? e?.message).slice(0, 60)}` }
  }
}

/** 收席:按 seat 名把该席的行标 released(保留行与出处,不静默删证据)。 */
export function releaseSeatClaims(root, { seat, nowIso = new Date().toISOString() }) {
  let text
  try {
    text = readFileSync(seatLedgerPath(root), 'utf8')
  } catch (e) {
    return { ok: false, reason: `席位台账读不出:${String(e?.code ?? e?.message).slice(0, 40)}` }
  }
  let n = 0
  const out = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        const o = JSON.parse(l)
        if (o?.seat === seat && !o.releasedAt) {
          o.releasedAt = nowIso
          n += 1
          return JSON.stringify(o)
        }
        return l
      } catch {
        return l
      }
    })
    .join('\n')
  try {
    writeFileSync(seatLedgerPath(root), `${out}\n`, 'utf8')
    return { ok: true, released: n }
  } catch (e) {
    return { ok: false, reason: `写入失败:${String(e?.code ?? e?.message).slice(0, 60)}` }
  }
}

/** 把已装载的声明摊平成"路径 → 席位",供冲突图当作已占的地。 */
export function flattenSeatClaims(claims) {
  const byPath = new Map()
  for (const c of claims || []) for (const p of c.paths) if (!byPath.has(p)) byPath.set(p, c.seat)
  return byPath
}

/**
 * 票号 → 席位(2026-10-27 补的第二维)。只压路径不够:今天实测到本席按派单面派出 3 席,
 * 而**对席会话在同一分钟把其中两枚票翻勾结清** —— 那两枚票票面上根本没写点名路径,
 * 路径维看不见它。票号维才是"一枚票只能有一席在干"的直接判据(与 §1「认领即租约」同义,
 * 只是把租约从"必须写进活文档"降级成"席位之间当场可见",不占用他人处置权)。
 */
export function flattenSeatTickets(claims) {
  const byTicket = new Map()
  for (const c of claims || []) {
    if (!c.ticket) continue
    if (!byTicket.has(c.ticket)) byTicket.set(c.ticket, c.seat)
  }
  return byTicket
}

export function parseArgs(argv) {
  const issues = []
  let seats = 6
  let diskFloorGb = DISK_FLOOR_GB_DEFAULT
  let timeoutMs = PLAN_TASKS_TIMEOUT_MS_DEFAULT
  let json = false
  let brief = false
  let mode = 'plan'
  let seat = null
  let ticket = null
  let ttlMinutes = SEAT_CLAIM_TTL_MINUTES_DEFAULT
  const scopes = []
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--brief') brief = true
    else if (a === '--json') json = true
    else if (a === '--self-test')
      return { selfTest: true, seats, diskFloorGb, timeoutMs, json, brief, issues, mode, seat, ticket, scopes, ttlMinutes }
    else if (a === '--claim' || a === '--release') {
      mode = a === '--claim' ? 'claim' : 'release'
      const v = argv[++i]
      if (!v || v.startsWith('-')) issues.push(`${a} 需要席位短名(与认领牌同一个口径),实得:${JSON.stringify(v)}`)
      else seat = v
    } else if (a === '--seat') {
      const v = argv[++i]
      if (!v || v.startsWith('-')) issues.push(`--seat 需要席位短名,实得:${JSON.stringify(v)}`)
      else seat = v
    } else if (a === '--ticket') {
      const v = argv[++i]
      if (!v || v.startsWith('-')) issues.push(`--ticket 需要票号,实得:${JSON.stringify(v)}`)
      else ticket = v
    } else if (a === '--scope') {
      const v = argv[++i]
      if (!v || v.startsWith('-')) issues.push(`--scope 需要一个仓内相对路径,实得:${JSON.stringify(v)}`)
      else scopes.push(v)
    } else if (a === '--ttl-minutes') {
      const v = argv[++i]
      if (!/^\d+$/.test(String(v ?? '')) || Number(v) < 1) issues.push(`--ttl-minutes 需要正整数,实得:${JSON.stringify(v)}`)
      else ttlMinutes = Number(v)
    } else if (a === '--staged' || a === '--worktree')
      issues.push(`${a} 不吃:派单基线只认 HEAD blob(§0.4 同面同轮),要判别的面请直说`)
    else if (a === '--seats' || a.startsWith('--seats=')) {
      const raw = a.startsWith('--seats=') ? a.slice(8) : argv[++i]
      if (!/^\d+$/.test(String(raw ?? '')) || Number(raw) < 1)
        issues.push(`--seats 需要一个 ≥1 的整数,实得:${JSON.stringify(raw)}`)
      else seats = Number(raw)
    } else if (a === '--disk-floor-gb' || a.startsWith('--disk-floor-gb=')) {
      const raw = a.startsWith('--disk-floor-gb=') ? a.slice('--disk-floor-gb='.length) : argv[++i]
      if (!/^\d+(\.\d+)?$/.test(String(raw ?? '')))
        issues.push(`--disk-floor-gb 需要一个十进制数,实得:${JSON.stringify(raw)}`)
      else diskFloorGb = Number(raw)
    } else if (a === '--plan-tasks-timeout-ms' || a.startsWith('--plan-tasks-timeout-ms=')) {
      const raw = a.startsWith('--plan-tasks-timeout-ms=')
        ? a.slice('--plan-tasks-timeout-ms='.length)
        : argv[++i]
      if (!/^\d+$/.test(String(raw ?? '')))
        issues.push(`--plan-tasks-timeout-ms 需要正整数,实得:${JSON.stringify(raw)}`)
      else timeoutMs = Number(raw)
    } else issues.push(`未知开关:${a}(残缺开关静默退回默认是本仓登记过的失效型,一律 exit 2)`)
  }
  if (mode === 'claim' && scopes.length === 0)
    issues.push('--claim 必须带至少一条 --scope(没有作用域的登记等于给别人发"这块地没人占"的合格证)')
  if (mode === 'release' && !seat) issues.push('--release 需要席位短名')
  return { selfTest: false, seats, diskFloorGb, timeoutMs, json, brief, issues, mode, seat, ticket, scopes, ttlMinutes }
}

/** 抽一台机的剩余空间。读不出 ⇒ null(调用方落未判定,不得拿 0 冒充"盘满"也不冒充"够")。 */
export function freeGbOf(dir) {
  try {
    const st = statfsSync(dir)
    return (st.bsize * st.bavail) / 1024 ** 3
  } catch {
    return null
  }
}

/**
 * 从唯一入口的 stdout 抠出"派单面"那一段的行号与正文前缀。
 * 输出面格式(现读):`── N 行(判定面:HEAD blob)──` 之后是 `  L<num>  <clip(raw)>`。
 * ⚠ 分隔线是制表线 `─`(U+2500)而不是 ASCII `-`:2026-10-27 镜像测试实测,只写 `-{1,2}` 时
 *   真跑输出被解析成 **0 行** —— 而"0 行"在本器里是合法读数("台账今天没活"),于是解析失败
 *   会冒充结论(假绿,§0.3 明令禁止的那一型)。故本器把两档分开:
 *     · 段头没找到 ⇒ `ok:false`(调用方落未判定,不许读成"没活");
 *     · 段头宣告 N 行、实际抠到 M≠N ⇒ `shortfall:true`(同上,N 是段头自报的数)。
 */
export function parseDispatchFace(stdout) {
  const SECT = /^[\s]*[─-]{2,}\s*(\d+)\s*行\(判定面/
  const ROW = /^\s*L(\d+)\s+(\S.*)$/
  const lines = String(stdout).split(/\r?\n/)
  const headIdx = lines.findIndex((l) => SECT.test(l))
  if (headIdx < 0) return { ok: false, declared: null, rows: [], reason: '唯一入口的输出里找不到「── N 行(判定面」段头' }
  const declared = Number(SECT.exec(lines[headIdx])[1])
  const rows = []
  for (let i = headIdx + 1; i < lines.length; i += 1) {
    const m = ROW.exec(lines[i])
    if (m) rows.push({ line: Number(m[1]), clipped: m[2].trim() })
    else if (/^[\s]*[─-]{2,}/.test(lines[i]) && rows.length > 0) break
  }
  if (rows.length !== declared)
    return { ok: false, declared, rows, reason: `段头宣告 ${declared} 行、实抠到 ${rows.length} 行 ⇒ 输出面形状变了,不拿残缺面拼板` }
  return { ok: true, declared, rows, reason: null }
}

/** 兼容旧出口名(镜像与自检按这一档取行)。 */
export function parseDispatchFaceLines(stdout) {
  return parseDispatchFace(stdout).rows
}

function norm(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim()
}

/** 前缀核验:派单面那份是裁剪过的正文,与 HEAD 全文取公共前缀比,阈值 20 字(实测足够定位)。 */
export function prefixMatches(clipped, raw, { min = 20 } = {}) {
  const a = norm(clipped)
  const b = norm(raw)
  if (a.length < min || b.length < min) return false
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i += 1
  return i >= min
}

/** 一行登记行的作用域:点名路径 ∪ 命中的热文件档(热文件之间互为冲突)。 */
export function scopeOfRow(raw) {
  const paths = []
  try {
    for (const [key, rec] of extractRefs(String(raw ?? ''), 'PROJECT_PLAN.md')) {
      paths.push(rec && rec.form === 'dir' ? `${key}/` : key)
    }
  } catch {
    return { paths: [], extractFailed: true }
  }
  return { paths, extractFailed: false }
}

export function hotClassesOf(paths) {
  const hits = []
  for (const p of paths) {
    const q = String(p).replace(/\/$/, '')
    if (HOT_FILES.includes(q)) hits.push(q)
    else if (/^README[^/]*\.md$/i.test(q)) hits.push('README*.md')
  }
  return [...new Set(hits)]
}

/**
 * 一次 wave:按"作用域小者先"贪心选最大不相交子集,平票按行号升序 ⇒ 结果可复跑、不随输入序漂。
 * 冲突判据两条(缺一漏打):① 逐字同一路径,或一方是目录而另一方落在该目录下(两侧都剥尾斜杠
 * 再比前缀 —— 不剥就把 `apps/api/` 与 `apps/api/src/x.ts` 读成不相交,实测错过一次);
 * ② 同属一个热文件档(活文档/注册表人人要写,业务代码不相交也不算两块地)。
 * **同目录不同文件不算冲突** —— 把它算成冲突会把可并发的票判成"排不进",那是"席位空转"的
 * 另一种成因(判据过严与判据过松都是缺陷,2026-10-27 自检抓到)。
 */
export function buildWave(candidates, { maxSeats, externalClaims = new Map(), externalTickets = new Map() }) {
  const normKey = (p) => String(p).replace(/\/+$/, '')
  const isUnder = (child, dir) => child.startsWith(`${dir}/`)
  const ext = [...externalClaims].map(([p, seat]) => ({ p: normKey(p), seat }))
  const order = [...candidates].sort((x, y) => {
    const d = x.paths.length - y.paths.length
    return d !== 0 ? d : x.line - y.line
  })
  const wave = []
  const dropped = []
  const takenPaths = []
  const takenHot = new Set()
  for (const c of order) {
    if (wave.length >= maxSeats) {
      dropped.push({ ...c, why: 'seat-cap' })
      continue
    }
    // 同一枚票只能有一席在干(票号维,排在作用域维之前):今天实测到对席会话在同一分钟把
    // 本席已派出的两枚票翻勾结清 —— 那两枚票票面没写路径,只靠路径维永远看不见这种撞。
    const byTicket = externalTickets.get(c.ticketId)
    if (byTicket) {
      dropped.push({ ...c, why: 'held-ticket-by-seat', detail: [`${c.ticketId} 已被席位 ${byTicket} 登记`] })
      continue
    }
    // 空作用域不算"与谁都不撞"—— 它是**不知道会撞谁**。2026-10-27 实测 HEAD 面 70 枚未勾登记行里
    // 38 枚票面根本没写点名路径;把它们直接排进波,等于用"没量到"给别人发互斥合格证(§0.3 同一型)。
    if (c.paths.length === 0) {
      dropped.push({ ...c, why: 'scope-unknown' })
      continue
    }
    const mine = c.paths.map(normKey)
    // 他席已声明的地(跨会话那一格):同名/同目录内都算占着,标签点名是哪一席,不静默剔。
    const held = []
    for (const p of mine) for (const e of ext) if (p === e.p || isUnder(p, e.p) || isUnder(e.p, p)) held.push(`${p}⇄${e.p}(${e.seat})`)
    if (held.length > 0) {
      dropped.push({ ...c, why: 'held-by-seat', detail: held.slice(0, 4) })
      continue
    }
    const clash = []
    for (const p of mine) {
      for (const t of takenPaths) {
        if (p === t || isUnder(p, t) || isUnder(t, p)) clash.push(`${p}⇄${t}`)
      }
    }
    const hotClash = c.hot.filter((h) => takenHot.has(h))
    if (clash.length > 0 || hotClash.length > 0) {
      dropped.push({
        ...c,
        why: clash.length > 0 ? 'path-overlap' : 'hot-file',
        detail: [...clash, ...hotClash].slice(0, 4),
      })
      continue
    }
    wave.push(c)
    for (const p of mine) takenPaths.push(p)
    for (const h of c.hot) takenHot.add(h)
  }
  return { wave, dropped }
}

/** 空转归因:排不进席位到底是"没活"还是"有活全被挡"。主席据此决定下一步,不许猜。 */
export function spinVerdict({ dispatchFaceCount, waveCount, dropped, anchorMismatch }) {
  if (dispatchFaceCount === 0) return { state: 'idle-no-backlog', red: false }
  if (waveCount > 0) return { state: 'dispatchable', red: false }
  const blockedByOverlap = dropped.filter((d) => ['path-overlap', 'hot-file', 'held-by-seat', 'held-ticket-by-seat'].includes(d.why)).length
  if (blockedByOverlap > 0 || anchorMismatch > 0) return { state: 'spinning', red: true }
  if (dropped.some((d) => d.why === 'scope-unknown'))
    return { state: 'needs-scope', red: true }
  return { state: 'idle-seats-exhausted', red: false }
}

export function readHeadPlan(root) {
  try {
    const buf = execFileSync('git', ['-C', root, 'show', 'HEAD:PROJECT_PLAN.md'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 28,
      windowsHide: true,
    })
    return { text: buf.toString('utf8'), sha: headSha(root) }
  } catch (e) {
    return { text: null, sha: null, error: String(e?.stderr ?? e?.message ?? e).slice(0, 200) }
  }
}

export function headSha(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
      .toString()
      .trim()
  } catch {
    return null
  }
}

export function runDispatchFace(root, timeoutMs) {
  try {
    const out = execFileSync(
      process.execPath,
      [path.join('scripts', 'plan-tasks.mjs'), '--open', '--dispatchable', '--exclude-inflight'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs, maxBuffer: 1 << 28, windowsHide: true },
    )
    return { text: out.toString('utf8'), error: null }
  } catch (e) {
    return { text: null, error: String(e?.stderr ?? e?.message ?? e).slice(0, 240) }
  }
}

/**
 * 组装:派单面 → 落回 HEAD 全文 → 作用域/热文件/脏命中/租约 → wave + 空转归因。
 * 返回 { ok, undetermined?, reason?, board? } —— 判不出时**只**给原因,不编一张看起来完整的板。
 */
export function buildBoard(root, opts = {}) {
  const {
    maxSeats = 6,
    diskFloorGb = DISK_FLOOR_GB_DEFAULT,
    timeoutMs = PLAN_TASKS_TIMEOUT_MS_DEFAULT,
    selfSeat = null,
  } = opts
  const free = freeGbOf(root)
  if (free === null) return { ok: false, undetermined: true, reason: `盘容量读不出(${root})` }
  const claimsRes = loadSeatClaims(root, { selfSeat })
  if (claimsRes.claims === null)
    return { ok: false, undetermined: true, reason: `席位声明面读不出,不能当成"没有别席在飞":${claimsRes.reason}` }
  const plan = readHeadPlan(root)
  if (!plan.text) return { ok: false, undetermined: true, reason: `HEAD 面台账读不出:${plan.error}` }
  const face = runDispatchFace(root, timeoutMs)
  if (!face.text) return { ok: false, undetermined: true, reason: `唯一入口跑不出出口:${face.error}` }
  const parsedFace = parseDispatchFace(face.text)
  if (!parsedFace.ok)
    return { ok: false, undetermined: true, reason: `派单面解析不出(不得读成"台账没活"):${parsedFace.reason}` }

  const rowsByLine = new Map()
  for (const r of parseTaskRows(plan.text)) {
    if (r.state === 'open') rowsByLine.set(r.line, r)
  }
  const faceLines = parsedFace.rows
  const dirty = collectDirtyPaths(root)
  const headSet = collectHeadPaths(root)

  const candidates = []
  const anchorMismatch = []
  const undeterminedRefs = []
  for (const f of faceLines) {
    const row = rowsByLine.get(f.line)
    if (!row || !prefixMatches(f.clipped, row.raw)) {
      anchorMismatch.push({ line: f.line, clipped: f.clipped.slice(0, 60) })
      continue
    }
    const sc = scopeOfRow(row.raw)
    if (sc.extractFailed) undeterminedRefs.push({ line: row.line, reason: 'extractRefs 抛错' })
    const paths = sc.paths
    const dirtyHit =
      dirty === null ? [] : paths.filter((p) => (p.endsWith('/') ? [...dirty].some((d) => d === p.slice(0, -1) || d.startsWith(p)) : dirty.has(p)))
    const absentInHead =
      dirty === null || headSet === null ? [] : paths.filter((p) => !p.endsWith('/') && !headSet.has(p) && ![...headSet].some((h) => h.startsWith(`${p}/`)))
    candidates.push({
      line: row.line,
      ticketId: keyOfRow(row.raw) ?? '(无号)',
      title: norm(row.raw).replace(/^[-*]\s+\[\s\]\s*/, '').slice(0, 60),
      claim: claimMarkOf(row.raw) ? claimMarkOf(row.raw) : null,
      paths,
      hot: hotClassesOf(paths),
      dirtyHit,
      absentInHead,
      raw: row.raw,
    })
  }

  const { wave, dropped } = buildWave(candidates, {
    maxSeats,
    externalClaims: flattenSeatClaims(claimsRes.claims),
    externalTickets: flattenSeatTickets(claimsRes.claims),
  })
  const heldBySeat = dropped.filter((d) => d.why === 'held-by-seat' || d.why === 'held-ticket-by-seat').length
  const spin = spinVerdict({
    dispatchFaceCount: faceLines.length,
    waveCount: wave.length,
    dropped,
    anchorMismatch: anchorMismatch.length,
  })
  return {
    ok: true,
    board: {
      state: spin.state,
      red: spin.red,
      headSha: plan.sha,
      seatsMax: maxSeats,
      freeGb: Math.round(free * 100) / 100,
      diskFloorGb,
      diskStarved: free < diskFloorGb,
      dispatchFace: faceLines.length,
      rowsOpenInHead: rowsByLine.size,
      candidateCount: candidates.length,
      wave: wave.map((w) => ({ line: w.line, ticketId: w.ticketId, title: w.title, paths: w.paths, hot: w.hot, raw: String(w.raw ?? '').slice(0, 900) })),
      dropped: dropped.map((d) => ({ line: d.line, ticketId: d.ticketId, why: d.why, detail: d.detail ?? null })),
      anchorMismatch,
      dirtyFace: dirty === null ? 'undetermined' : dirty.size,
      headFace: headSet === null ? 'undetermined' : headSet.size,
      leasesOnCandidates: candidates.filter((c) => c.claim).length,
      /** 他席声明:席位条数 + 被它们压下去的票数;台账不存在 ⇒ 0 条并如实标 absent(那不代表"没有别席")。 */
      seatClaims: claimsRes.claims.length,
      heldBySeat,
      seatLedgerState: claimsRes.ledgerState ?? 'present',
      malformedSeatRows: claimsRes.malformed?.length ?? 0,
      undeterminedRefs,
    },
  }
}

function selfTest() {
  let n = 0
  const ok = []
  const bad = []
  const t = (name, pass) => {
    n += 1
    ;(pass ? ok : bad).push(name)
  }
  const cands = [
    { line: 1, ticketId: 'A', title: 'a', paths: ['apps/api/src/x.ts'], hot: [], dirtyHit: [], claim: null },
    { line: 2, ticketId: 'B', title: 'b', paths: ['apps/web/src/y.tsx'], hot: [], dirtyHit: [], claim: null },
    { line: 3, ticketId: 'C', title: 'c', paths: ['apps/api/src/z.ts'], hot: [], dirtyHit: [], claim: null },
    { line: 4, ticketId: 'D', title: 'd', paths: ['apps/api/'], hot: [], dirtyHit: [], claim: null },
    { line: 5, ticketId: 'E', title: 'e', paths: ['PROJECT_PLAN.md'], hot: ['PROJECT_PLAN.md'], dirtyHit: [], claim: null },
    { line: 6, ticketId: 'F', title: 'f', paths: ['PROJECT_PLAN.md', 'AGENTS.md'], hot: ['PROJECT_PLAN.md', 'README*.md'], dirtyHit: [], claim: null },
  ]
  const w1 = buildWave(cands, { maxSeats: 6 })
  t('① 同路径不相交者同波(A 与 B 同波)', w1.wave.some((x) => x.ticketId === 'A') && w1.wave.some((x) => x.ticketId === 'B'))
  t('② 同目录不同文件必须允许并行(C 与 A 同在 apps/api/src 但不是同一文件)', w1.wave.some((x) => x.ticketId === 'C'))
  t('③ 目录前缀包含要挡(D=apps/api/ 撞 apps/api/src/x.ts,剥尾斜杠后仍要认出)', w1.dropped.some((d) => d.ticketId === 'D' && d.why === 'path-overlap'))
  t('④ 活文档同档串行(E 与 F 只进一席)', [w1.wave, w1.dropped].flat().filter((x) => x.ticketId === 'E' || x.ticketId === 'F').length === 2 && w1.wave.filter((x) => x.ticketId === 'E' || x.ticketId === 'F').length === 1)
  const w2 = buildWave(cands, { maxSeats: 1 })
  t('⑤ 名额=1 时其余落 seat-cap 而不是"没活"', w2.wave.length === 1 && w2.dropped.filter((d) => d.why === 'seat-cap').length === 5)
  t('⑥ 有活全被挡 ⇒ spinning 判红', spinVerdict({ dispatchFaceCount: 3, waveCount: 0, dropped: [{ why: 'path-overlap' }], anchorMismatch: 0 }).red === true)
  t('⑦ 派单面 0 枚 ⇒ idle-no-backlog 不判红(§12e 禁恒红门)', spinVerdict({ dispatchFaceCount: 0, waveCount: 0, dropped: [], anchorMismatch: 0 }).red === false)
  t('⑧ 抽取面不认的行号必须点名剔除,不带错作用域派席(公共前缀不足 20 字 ⇒ 不认;够 ⇒ 认)', prefixMatches('- [ ] G-9 甲案做法', '- [ ] G-9 乙案做法完全不同', { min: 20 }) === false && prefixMatches('- [ ] G-9 修法唯一 = 抽常量', '- [ ] G-9 修法唯一 = 抽常量再注入 primitive adapter', { min: 20 }) === true)
  t('⑨ 盘容量读不出 ⇒ null(不得拿 0 冒充"盘满")', freeGbOf('/definitely/not/a/path-ihui') === null)
  t('⑩ --staged/--worktree 一律拒收(§0.4 同面同轮)', parseArgs(['--staged']).issues.length === 1 && parseArgs(['--worktree']).issues.length === 1)
  t('⑪ 残缺旗标不得静默退回默认', parseArgs(['--seats']).issues.length === 1 && parseArgs(['--seats=abc']).issues.length === 1)
  t('⑫ 热文件清单含活文档与注册表(派单面必问的一档)', HOT_FILES.includes('PROJECT_PLAN.md') && HOT_FILES.includes('scripts/guardian-runner.mjs'))
  t('⑬ 制表线段头解析得出(ASCII 段头同样认)', parseDispatchFace('── 2 行(判定面:HEAD blob)──\n  L10  - [ ] 甲\n  L20  - [ ] 乙').ok === true)
  t('⑭ 段头缺失 ⇒ 未判定,绝不读成"0 行=没活"(假绿是本器最贵的失效)', parseDispatchFace('随便一段散文\n没有段头').ok === false)
  t('⑮ 段头宣告数与实抠行数不符 ⇒ 未判定(输出面形状变了不拼残板)', parseDispatchFace('── 9 行(判定面:HEAD blob)──\n  L10  - [ ] 甲').ok === false)
  t('⑯ 段头宣告 0 行是真·0 行(合法读数,与 ⑭ 分开)', parseDispatchFace('── 0 行(判定面:HEAD blob)──\n  结论:无').ok === true)
  const w3 = buildWave([cands[0], { ...cands[1], paths: [], hot: [] }], { maxSeats: 6 })
  t('⑰ 空作用域不落波(不知道会撞谁就不能发互斥合格证)且归因 needs-scope', w3.wave.length === 1 && w3.dropped[0].why === 'scope-unknown')
  const extMap = new Map([['apps/api/src/x.ts', 'other-seat']])
  const w4 = buildWave([cands[0], cands[1]], { maxSeats: 6, externalClaims: extMap })
  t('⑳ 他席已声明的地不重派,且点名是被哪一席占着', !w4.wave.some((x) => x.ticketId === 'A') && w4.dropped.some((d) => d.ticketId === 'A' && d.why === 'held-by-seat' && /other-seat/.test(d.detail.join(' '))))
  t('㉑ 席位摊平:同一路径先到先得,不被后写的席覆盖', (() => {
    const f = flattenSeatClaims([{ seat: 'first', paths: ['a.ts'] }, { seat: 'second', paths: ['a.ts', 'b.ts'] }])
    return f.get('a.ts') === 'first' && f.get('b.ts') === 'second'
  })())
  const absent = loadSeatClaims(path.join(ROOT, 'definitely-not-an-ihui-repo'))
  t('㉒ 台账不存在 ⇒ 零声明 + ledgerState=absent(绝不冒充"没有别席在飞")', absent.claims.length === 0 && absent.ledgerState === 'absent')
  const w5 = buildWave([cands[0]], { maxSeats: 6, externalTickets: new Map([['A', 'other-seat']]) })
  t('㉓ 同一枚票被别席领走 ⇒ 当场压住(票号维排在作用域维之前,今天实测到的那型撞)', w5.wave.length === 0 && w5.dropped[0].why === 'held-ticket-by-seat')
  const f2 = flattenSeatTickets([
    { seat: 's1', ticket: 'G-9', paths: [] },
    { seat: 's2', ticket: null, paths: [] },
  ])
  t('㉔ 票号摊平:没写票号的声明不冒充票号维', f2.get('G-9') === 's1' && f2.size === 1)
  t('㉕ 被别席占着也算"有活排不进"⇒ 判红要人重排(不得读成"今天没活")', spinVerdict({ dispatchFaceCount: 2, waveCount: 0, dropped: [{ why: 'held-ticket-by-seat' }], anchorMismatch: 0 }).red === true)
  t('⑱ needs-scope 判红(有活排不进=主席须补作用域,不是"今天没活")', spinVerdict({ dispatchFaceCount: 2, waveCount: 1, dropped: w3.dropped, anchorMismatch: 0 }).red === false && spinVerdict({ dispatchFaceCount: 2, waveCount: 0, dropped: [{ why: 'scope-unknown' }], anchorMismatch: 0 }).state === 'needs-scope')
  const br = briefOf({ line: 1, ticketId: 'G-9', title: '示例票', paths: ['apps/api/src/x.ts'], hot: [] }, { seat: 's1', ticketRow: '- [ ] G-9 示例票正文' })
  t('㉗ 派单书必须自带今晚踩过的三条硬约束(严禁 worktree / 先自核勾选态 / 执行席不 commit)', /严禁 git worktree/.test(br) && /先自核票面勾选态/.test(br) && /git add/.test(br) && /--claim s1 --ticket G-9 --scope apps\/api\/src\/x\.ts/.test(br))
  t('㉘ 派单书把作用域与票面原文逐条列全(不靠主席手抄漏项)', br.includes('apps/api/src/x.ts') && br.includes('G-9 示例票正文'))
  console.log(`[dispatch-board] self-test ${ok.length}/${n} 通过${bad.length ? ` ⇒ 失败:${bad.join(', ')}` : ''}`)
  return bad.length === 0 ? 0 : 1
}

/**
 * 派单书生成(§11 六要素 + 本席今晚实测到的三条硬约束)。
 * 为什么要这一格:切席判据算得出来之后,任务书仍是主席手抄 —— 手抄就会漏"严禁 worktree"
 * (今晚五席全灭那条)、漏"先自核票面勾选态"(今晚两席空活那条)、漏"执行席不 commit"
 * (共享索引被别人占着、safe-commit 必拒那条)。把这三句做成模板印出来,而不是指望人记得。
 * 只给**有作用域**的票出书;scope-unknown 的票不出(它没有互斥凭据)。
 */
export function briefOf(candidate, { seat, ticketRow }) {
  const c = candidate
  const paths = c.paths.length > 0 ? c.paths : []
  const lines = []
  lines.push(`【席位 ${seat}】票 ${c.ticketId}`)
  lines.push(`目标：${c.title} —— 动手前先跑 git show HEAD:PROJECT_PLAN.md 现读该行全文，别只信本节转述。`)
  lines.push('受影响文件（只准写这些，其余一律不碰）：')
  for (const p of paths) lines.push(`  - ${p}`)
  if (c.hot.length > 0) lines.push(`  ⚠ 本票含热档 ${c.hot.join(', ')} ⇒ 与同档他席串行，不得并写`)
  lines.push('禁止修改：PROJECT_PLAN.md / AGENTS.md / README*.md / 根 package.json / .husky/** / scripts/data/** / 他席在飞面（见席位台账 seat-scopes.jsonl）')
  lines.push('验证命令（交付前自跑并贴末行现读）：')
  lines.push('  1) 先自核票面勾选态：`git show HEAD:PROJECT_PLAN.md | grep -c "<本行标题锚点>"` —— 命中在 `- [x]` 或 0 命中 ⇒ **零改动回报**，只交现读命令与末行（票面已被别席结清就是有效交付，不是失败）')
  lines.push('  2) 语法冒烟：`node --check <每个改动文件>`')
  lines.push('  3) 只跑该票点名的那一条判据/测试，**别跑全量守门批**（机器上数十 node 进程，会把他人用例打成假红）')
  lines.push('  4) 新文件：`node scripts/watermark.mjs inject <file>` + `verify`；改动带镜像测试且做"摘掉即红"变异自证')
  lines.push('约束边界：**严禁 git worktree**（共享盘与 16,673 文件检出会把派单顶穿）；严禁 `git add`/`commit`/`push`（主席带 pathspec 或 object-space-land 落地）；派单书第一条动作 = `mkdir -p .ihui-agent/tmp/<席名>` 并在 30 秒内写 progress.md 首行（本仓死席主形态是静默死亡）')
  lines.push(`交付物：改动清单 + 末行读数 + 报告 ≤300 字（含未收格与未判定项，不得用"完成"盖住）`)
  lines.push(`登记本席作用域（主席执行）：node scripts/dispatch-board.mjs --claim ${seat} --ticket ${c.ticketId} ${paths.map((p) => `--scope ${p}`).join(' ')} --ttl-minutes 120`)
  if (typeof ticketRow === 'string' && ticketRow.trim()) lines.push(`票面原文（逐字，勿改）：${ticketRow.trim().slice(0, 700)}`)
  return lines.join('\n')
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const a = parseArgs(argv)
  if (a.issues.length > 0) {
    console.error(`❌ 用法未判定:\n  - ${a.issues.join('\n  - ')}`)
    process.exit(2)
  }
  if (a.mode === 'claim' || a.mode === 'release') {
    const r =
      a.mode === 'claim'
        ? appendSeatClaim(ROOT, { seat: a.seat, ticket: a.ticket, paths: a.scopes, ttlMinutes: a.ttlMinutes })
        : releaseSeatClaims(ROOT, { seat: a.seat })
    if (!r.ok) {
      console.error(`❌ 席位${a.mode === 'claim' ? '登记' : '收席'}未落:${r.reason}`)
      process.exit(2)
    }
    console.log(
      a.mode === 'claim'
        ? `✅ 已登记席位 ${a.seat}(票 ${a.ticket ?? '(无号)'}) 占 ${r.rec.paths.length} 条路径,${a.ttlMinutes} 分钟内对其它席生效`
        : `✅ 已收席 ${a.seat}(标 released ${r.released} 行;行不删,留出处)`,
    )
    process.exit(0)
  }
  const res = buildBoard(ROOT, {
    maxSeats: a.seats,
    diskFloorGb: a.diskFloorGb,
    timeoutMs: a.timeoutMs,
    selfSeat: a.seat,
  })
  if (!res.ok) {
    console.error(`❌ 未判定(不记绿也不冒红):${res.reason}`)
    process.exit(2)
  }
  const b = res.board
  if (a.json) console.log(JSON.stringify(b))
  else {
    console.log(`── 排他切席板(判定面 HEAD blob,sha ${String(b.headSha).slice(0, 10)})──`)
    console.log(`  盘容量 ${b.freeGb} GB / 地板 ${b.diskFloorGb} GB ${b.diskStarved ? '⚠ 低于地板 ⇒ 本波不得派席(先腾盘)' : ''}`)
    console.log(`  出单 ${b.dispatchFace} 枚(唯一口径) / HEAD 未勾登记行 ${b.rowsOpenInHead} / 落回作用域 ${b.candidateCount} / 带在册租约 ${b.leasesOnCandidates}`)
    console.log(`  脏面 ${b.dirtyFace} / 前缀核验不通过剔除 ${b.anchorMismatch.length}(行号会挪位,只认同轮双重核验)`)
    console.log(`  席位台账 ${b.seatLedgerState}:他席未过期声明 ${b.seatClaims} 条 ⇒ 压住 ${b.heldBySeat} 枚 / 坏行 ${b.malformedSeatRows}(未登席的次次不受本器保护,那一格只能靠认领牌)`)
    console.log(`  可同波 ${b.wave.length} 席(名额 ${b.seatsMax}):`)
    for (const w of b.wave)
      console.log(`    L${w.line} ${w.ticketId} 「${w.title}」 作用域 ${w.paths.slice(0, 4).join(', ')}${w.hot.length ? ` 热档:${w.hot.join(',')}` : ''}`)
    if (b.dropped.length > 0) {
      console.log(`  排不进本波 ${b.dropped.length} 枚:`)
      for (const d of b.dropped.slice(0, 12)) console.log(`    L${d.line} ${d.ticketId} ${d.why}${d.detail ? ` (${d.detail.slice(0, 2).join(' ')})` : ''}`)
      if (b.dropped.length > 12) console.log(`    …另 ${b.dropped.length - 12} 枚(同口径重跑可全量点名)`)
    }
    const scopeUnknown = b.dropped.filter((d) => d.why === 'scope-unknown').length
    if (scopeUnknown > 0)
      console.log(`  ⚠ 作用域未点名 ${scopeUnknown} 枚 ⇒ 本器不替它们发互斥合格证;唯一出路 = 主席按票面正文补出点名文件后重跑`)
    console.log(`  结论 state=${b.state}${b.red ? ' ⇒ 有可派票却一枚排不进,主席须重排(不是没活)' : ''}`)
  }
  if (a.brief) {
    console.log('')
    console.log('── 派单书(§11 六要素 + 本仓三条硬约束;票面正文请从 HEAD 现读补齐)──')
    for (const w of b.wave) console.log(`\n${briefOf(w, { seat: a.seat ?? `seat-L${w.line}`, ticketRow: w.raw })}`)
    if (b.wave.length === 0) console.log('(本波无票可派书 ⇒ 一枚都没排进,按上面的归因处置,不是"没活")')
  }
  process.exit(b.red ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}

export const __test__ = {
  parseArgs,
  freeGbOf,
  parseDispatchFace,
  parseDispatchFaceLines,
  loadSeatClaims,
  appendSeatClaim,
  releaseSeatClaims,
  flattenSeatClaims,
  flattenSeatTickets,
  briefOf,
  seatLedgerPath,
  SEAT_LEDGER_REL,
  SEAT_CLAIM_TTL_MINUTES_DEFAULT,
  prefixMatches,
  scopeOfRow,
  hotClassesOf,
  buildWave,
  spinVerdict,
  HOT_FILES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
