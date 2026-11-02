#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cross-end-landing-ledger.mjs —— 跨端自愈腿「写盘申报账本」的判据库(2026-11-03 立)
 *
 * 立因:git-guardian 的 8 条跨端写盘腿(sweepWeb/Rn/MiniappStyleTiers、healCrossEndMirror、
 * convergeCrossEndPortalVerdicts、autoRegisterRnTokenPairs、sweepRnHostShells、
 * sweepHandMirrorUpgrades)每 30 分钟真写工作树文件,注释承诺「落库交给 auto-commit-quiet」;
 * 但 auto-commit-quiet 全仓没有任何派生调用点,且其 COLLECT_WHITELIST(f6e0ba44a9 收窄,
 * 那次收窄是对的——旧实现无差别收编把 7 件实质回退+3 个半成品测试送进主干)不收业务代码。
 * 结果:守护写了盘,永远悬挂在工作树。
 *
 * 正解不是放宽白名单,而是**验过才收**:写盘腿自己往本账追写申报行,收编侧只认
 * 「账本在册 ∧ 落点当前 blob 逐字节等于登记 blobOid ∧ 已过静默期」的条目。
 * blob 相符这一维是防事故的核心:守护写完后文件被别人改过 ⇒ contested,一条不放。
 *
 * 取材纪律(AGENTS §0.4 / §12g):git 面一律走 scripts/lib/face-reader.mjs 的现成出口
 * (gitRaw / catBatchOids),本库不自拼裸 git 派生;ROOT 由 import.meta.url 推导(§15,
 * 禁进程 cwd 定根);失效方向恒为「少收」——取不到输入 ⇒ {ok:false, reason},调用方据此
 * 不收编任何一条(§0.3:未判定不记绿也不冒红,更不得用空集冒充"没有待收")。
 *
 * 账本形态(与 mail-send-ledger 同族要求,§5e-3):一行一条 JSON、ASCII 键 + ISO 时刻、
 * 无 BOM、LF(禁 CRLF);leg/path 允许非 ASCII 原值,由 JSON.stringify 保证不破行形态。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, catBatchOids, gitRaw } from './face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '..', '..')

const LEDGER_SEGMENTS = ['.ihui-agent', 'state', 'cross-end-landing.jsonl']
/** 账本唯一路径(仓库根口径);scrub/测试注入别的 root 时走 ledgerPathFor(root)。 */
export const LEDGER_PATH = join(ROOT, ...LEDGER_SEGMENTS)

/** 必填键集(缺任一键的行 ⇒ incomplete 点名,不静默跳);landedSha 可缺。 */
export const LEDGER_FIELDS = Object.freeze(['at', 'leg', 'path', 'blobOid', 'landedSha'])
const REQUIRED_FIELDS = Object.freeze(['at', 'leg', 'path', 'blobOid'])

/** 默认静默期:守护写完后 3 分钟内不动(与 auto-commit-quiet 的 QUIET_MIN 同档)。 */
export const DEFAULT_QUIET_MS = 3 * 60 * 1000

/** 该 root 的账本路径(root===ROOT 时逐字节等于 LEDGER_PATH)。 */
export function ledgerPathFor(root = ROOT) {
  return root === ROOT ? LEDGER_PATH : join(root, ...LEDGER_SEGMENTS)
}

/** 复合主键 = leg+NUL+path(同一路径不同腿各算一条;不得按 path 单键,§1 台账同款)。 */
export function landingKeyOf(row) {
  return `${row?.leg ?? ''}\u0000${row?.path ?? ''}`
}

/** 单行解析(纯函数):空行/非对象/非法 JSON ⇒ null,由调用方归 unreadable。 */
export function parseLine(text) {
  const s = String(text ?? '').trim()
  if (!s) return null
  let obj
  try {
    obj = JSON.parse(s)
  } catch {
    return null
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null
  return obj
}

/** 必填键缺失清单(纯函数):非空字符串才算齐备。 */
export function missingFieldsOf(row) {
  const missing = []
  for (const f of REQUIRED_FIELDS) {
    const v = row?.[f]
    if (typeof v !== 'string' || v.trim() === '') missing.push(f)
  }
  return missing
}

export function isRowComplete(row) {
  return missingFieldsOf(row).length === 0
}

/** 行龄(毫秒);时刻解析不出 ⇒ null(调用方必须点名,不得当 0 用)。 */
export function ageMs(row, nowMs) {
  const t = Date.parse(String(row?.at ?? ''))
  if (!Number.isFinite(t)) return null
  return Number(nowMs) - t
}

/**
 * 路径形状判据(纯函数):必须是仓内相对路径、正斜杠、不含 `\`、`:`、`..`、
 * 空段、以 `-` 或 `/` 开头(防被 git 当旗标)。不成立 ⇒ 该行进 incomplete 点名。
 */
export function pathShapeOk(p) {
  if (typeof p !== 'string' || p === '') return false
  if (p.includes('\\') || p.includes(':') || p.startsWith('/')) return false
  const segs = p.split('/')
  if (segs.some((s) => s === '' || s === '.' || s === '..')) return false
  if (segs[0].startsWith('-')) return false
  return true
}

/** 规范 ISO 时刻;解析不出 ⇒ null。 */
export function canonicalIso(at) {
  const t = Date.parse(String(at ?? ''))
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

// ─── 读账本 ──────────────────────────────────────────────────────────────────

/**
 * 读账本。face='worktree'(默认)读盘;'head'/'staged' 读对应面的 blob —— 账本住在
 * .ihui-agent/state(通常 gitignored),head/staged 面读不到是**常态**,如实 not-found。
 * 账本不存在与空文件必须在 reason 里区分(都不算 ok:true 的空集)。
 * @returns {{ok:true, lines:object[], unreadable:Array<{lineNo:number, preview:string}>}
 *          | {ok:false, reason:string}}
 */
export function readLanding({ face = 'worktree', root = ROOT } = {}) {
  const file = ledgerPathFor(root)
  let text
  if (face === 'worktree') {
    if (!existsSync(file)) return { ok: false, reason: `not-found:${file}` }
    try {
      text = readFileSync(file, 'utf8')
    } catch (e) {
      return { ok: false, reason: `unreadable:${file} (${String(e?.message ?? e).split('\n')[0]})` }
    }
  } else if (face === 'head' || face === 'staged') {
    const spec = face === 'head' ? `HEAD:${LEDGER_SEGMENTS.join('/')}` : `:${LEDGER_SEGMENTS.join('/')}`
    let oidOf
    try {
      oidOf = catBatchOids(root, [spec])
    } catch (e) {
      return { ok: false, reason: `git 取账本 blob 失败(${face} 面): ${String(e?.message ?? e).split('\n')[0]}` }
    }
    const oid = oidOf.get(spec)
    if (!oid) return { ok: false, reason: `not-found:${spec}(账本不在 ${face} 面)` }
    let blob
    try {
      blob = catBatch(root, [spec]).get(spec)
    } catch (e) {
      return { ok: false, reason: `git 读账本正文失败(${face} 面): ${String(e?.message ?? e).split('\n')[0]}` }
    }
    if (blob === null || blob === undefined)
      return { ok: false, reason: `not-found:${spec}(正文取不到,非"没有")` }
    text = String(blob)
  } else {
    return { ok: false, reason: `未知面 ${String(face)}(只认 worktree/head/staged)` }
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  if (text.trim() === '') return { ok: false, reason: `empty:${file}` }
  const lines = []
  const unreadable = []
  const rawLines = text.split(/\r?\n/)
  rawLines.forEach((raw, i) => {
    if (raw.trim() === '') return
    const obj = parseLine(raw)
    if (obj === null) {
      unreadable.push({ lineNo: i + 1, preview: raw.slice(0, 120) })
      return
    }
    lines.push(obj)
  })
  return { ok: true, lines, unreadable }
}

// ─── 写账本 ──────────────────────────────────────────────────────────────────

/**
 * 逐行追写申报。纪律:
 *  - 必填键不齐 / 时刻解析不出 / 路径形状不正 ⇒ 进 rejected 带 reason,**不落盘**;
 *  - 幂等:同 landingKeyOf + 同 blobOid(账本里已有的、或本批前面已写的)不重复追写,
 *    否则守护每 30 分钟一轮会把账本撑爆;
 *  - append(flag 'a'),目录不存在先建;一行一条 JSON + LF,无 BOM。
 * @returns {{appended:number, rejected:Array<{path:string, reason:string}>, deduped:number}}
 */
export function appendLanding(entries, opts = {}) {
  const root = opts.root ?? ROOT
  const file = ledgerPathFor(root)
  const rejected = []
  const list = Array.isArray(entries) ? entries : []

  // 现存账本的键集(读不到 = 不存在/空 ⇒ 空集,不拦首写;这是写侧,不是判侧)
  const seen = new Set()
  const rd = readLanding({ face: 'worktree', root })
  if (rd.ok) {
    for (const row of rd.lines) {
      if (typeof row?.blobOid === 'string') seen.add(`${landingKeyOf(row)}|${row.blobOid.toLowerCase()}`)
    }
  }

  const toWrite = []
  let deduped = 0
  for (const e of list) {
    const shownPath = String(e?.path ?? '(缺 path)')
    const missing = missingFieldsOf(e)
    if (missing.length) {
      rejected.push({ path: shownPath, reason: `必填键缺失或为空: ${missing.join(', ')}` })
      continue
    }
    const iso = canonicalIso(e.at)
    if (!iso) {
      rejected.push({ path: shownPath, reason: `at 不是可解析的 ISO 时刻: ${String(e.at).slice(0, 40)}` })
      continue
    }
    if (!pathShapeOk(e.path)) {
      rejected.push({ path: shownPath, reason: 'path 必须是仓内相对路径(正斜杠,不含 .. 或反斜杠)' })
      continue
    }
    const oid = String(e.blobOid).trim().toLowerCase()
    if (!/^[0-9a-f]{40}$/.test(oid)) {
      rejected.push({ path: shownPath, reason: `blobOid 不是 40 位十六进制: ${oid.slice(0, 46)}` })
      continue
    }
    const composite = `${landingKeyOf(e)}|${oid}`
    if (seen.has(composite)) {
      deduped += 1
      continue
    }
    seen.add(composite)
    const row = { at: iso, leg: String(e.leg), path: String(e.path), blobOid: oid }
    if (typeof e.landedSha === 'string' && e.landedSha.trim() !== '') row.landedSha = e.landedSha.trim()
    toWrite.push(row)
  }

  if (toWrite.length > 0) {
    mkdirSync(dirname(file), { recursive: true })
    for (const row of toWrite) appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8')
  }
  return { appended: toWrite.length, rejected, deduped }
}

// ─── 主判据:哪些路径此刻可被收编 ────────────────────────────────────────────

/**
 * 四条同时成立才进 collectible:
 *  ① 行完整(四必填键齐备非空)
 *  ② at 可解析且 now-at >= quietMs
 *  ③ 落点在 face 面的当前 blob 逐字节等于登记 blobOid(被改过 ⇒ contested)
 *  ④ path 形状合法且 git check-ignore 判非 ignored
 * 失效方向恒为「少收」;整批输入取不到(账本/git)⇒ {ok:false, reason},调用方一条不收。
 * 账本体固定读 worktree 面(state/ 通常不入库);face 只作用于**落点 blob** 的取面。
 */
export function collectiblePaths(now, { quietMs = DEFAULT_QUIET_MS, face = 'worktree', root = ROOT } = {}) {
  const nowMs =
    now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(String(now ?? ''))
  if (!Number.isFinite(nowMs)) return { ok: false, reason: `now 不可解析: ${String(now)}` }
  if (!['worktree', 'head', 'staged'].includes(face))
    return { ok: false, reason: `未知面 ${String(face)}(只认 worktree/head/staged)` }

  const rd = readLanding({ root })
  if (!rd.ok) return rd
  if (rd.lines.length === 0 && rd.unreadable.length > 0)
    return { ok: false, reason: `账本 ${rd.unreadable.length} 行全部解析不出 ⇒ 未判定` }

  const collectible = []
  const quiet = []
  const contested = []
  const incomplete = []
  const ignored = []
  const candidates = []

  for (const row of rd.lines) {
    const missing = missingFieldsOf(row)
    if (missing.length) {
      incomplete.push({ path: String(row?.path ?? '(缺 path)'), missingFields: missing })
      continue
    }
    const age = ageMs(row, nowMs)
    if (age === null) {
      incomplete.push({ path: row.path, missingFields: ['at (不是可解析的 ISO 时刻)'] })
      continue
    }
    if (age < quietMs) {
      quiet.push({ leg: row.leg, path: row.path, ageMs: age })
      continue
    }
    if (!pathShapeOk(row.path)) {
      incomplete.push({
        path: row.path,
        missingFields: ['path (须为仓内相对路径: 正斜杠、不含 .. / 反斜杠 / 盘符)'],
      })
      continue
    }
    candidates.push({ row, age })
  }

  if (candidates.length === 0)
    return { ok: true, collectible, quiet, contested, incomplete, ignored, unreadable: rd.unreadable }

  // ④ ignored 判定:一次批量 check-ignore。exit 0=有命中,1=全不 ignored,其它=取不到。
  const paths = candidates.map((c) => c.row.path)
  let ignoredSet
  try {
    ignoredSet = batchCheckIgnored(root, paths)
  } catch (e) {
    return { ok: false, reason: `git check-ignore 取不到 ⇒ 未判定: ${String(e?.message ?? e).split('\n')[0]}` }
  }
  const liveCandidates = []
  for (const c of candidates) {
    if (ignoredSet.has(c.row.path)) {
      ignored.push({ leg: c.row.leg, path: c.row.path, blobOid: c.row.blobOid })
      continue
    }
    liveCandidates.push(c)
  }

  // ③ blob 相符:按面取当前 oid,逐字节(小写归一后)等值比较。
  let actualOf
  try {
    actualOf = currentOidsForFace(root, face, liveCandidates.map((c) => c.row.path))
  } catch (e) {
    return { ok: false, reason: `落点 blob 取不到(${face} 面)⇒ 未判定: ${String(e?.message ?? e).split('\n')[0]}` }
  }
  for (const c of liveCandidates) {
    const row = c.row
    const expected = String(row.blobOid).trim().toLowerCase()
    const actual = actualOf.get(row.path)
    if (actual === expected) {
      collectible.push({ leg: row.leg, path: row.path, blobOid: expected, ageMs: c.age })
    } else {
      contested.push({ leg: row.leg, path: row.path, expectedOid: expected, actualOid: actual ?? null })
    }
  }
  return { ok: true, collectible, quiet, contested, incomplete, ignored, unreadable: rd.unreadable }
}

/** 一次 `git check-ignore --no-index -v --stdin` 问完一批路径,返回 ignored 路径集;128 等异常抛出。 */
function batchCheckIgnored(root, paths) {
  const hit = new Set()
  if (paths.length === 0) return hit
  try {
    const out = gitRaw(['check-ignore', '--no-index', '-v', '--stdin'], root, {
      input: `${paths.join('\n')}\n`,
    })
    for (const line of String(out).split(/\r?\n/)) {
      if (!line) continue
      const tab = line.lastIndexOf('\t')
      if (tab >= 0) hit.add(line.slice(tab + 1))
    }
  } catch (e) {
    if (typeof e?.status === 'number' && e.status === 1) return hit // git 明说:没有一个被 ignore(正常结论)
    throw e
  }
  return hit
}

/**
 * 一批路径在指定面的当前 blob oid:`Map<path, oid|null>`(null = 该面上读不到该文件)。
 *  worktree ⇒ 逐路径 `git hash-object`(文件不在盘上 ⇒ null,派生本身失败 ⇒ 抛);
 *  head/staged ⇒ 一次 catBatchOids 批量解 `<rev>:<path>` / `:<path>`。
 */
function currentOidsForFace(root, face, paths) {
  const out = new Map()
  if (paths.length === 0) return out
  if (face === 'worktree') {
    for (const p of paths) {
      if (!existsSync(join(root, p))) {
        out.set(p, null)
        continue
      }
      out.set(p, String(gitRaw(['hash-object', '--', p], root)).trim().toLowerCase())
    }
    return out
  }
  const specs = paths.map((p) => (face === 'head' ? `HEAD:${p}` : `:${p}`))
  const oidOf = catBatchOids(root, specs)
  paths.forEach((p, i) => out.set(p, oidOf.get(specs[i]) ?? null))
  return out
}

// ─── CLI(isDirectRun 守卫,AGENTS §22d)──────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--dump')) {
    const res = collectiblePaths(new Date())
    if (!res.ok) {
      console.log(`未判定(unjudged): ${res.reason}`)
      return 0
    }
    console.log(
      JSON.stringify(
        {
          collectible: res.collectible.length,
          quiet: res.quiet.length,
          contested: res.contested.length,
          incomplete: res.incomplete.length,
          ignored: res.ignored.length,
          unreadable: res.unreadable.length,
        },
        null,
        2,
      ),
    )
    for (const b of ['collectible', 'quiet', 'contested', 'incomplete', 'ignored'])
      for (const it of res[b]) console.log(`[${b}] ${JSON.stringify(it)}`)
    return 0
  }
  console.log(
    '用法: node scripts/lib/cross-end-landing-ledger.mjs --self-test | --dump\n(判据库本体,对外出口由调用方 import,不落任何盘)',
  )
  return 0
}

/** 纯判据自检(零 git、零写盘);真正的行为锁在 scripts/tests/cross-end-landing-ledger.test.mjs。 */
function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push([name, !!cond])
  ok('LEDGER_FIELDS 恰为 5 键', LEDGER_FIELDS.join(',') === 'at,leg,path,blobOid,landedSha')
  ok(
    'LEDGER_PATH 由 import.meta.url 推导(绝对路径 + 末三段齐)',
    LEDGER_PATH.endsWith(join('.ihui-agent', 'state', 'cross-end-landing.jsonl')) && resolve(LEDGER_PATH) === LEDGER_PATH,
  )
  ok('landingKeyOf 用 NUL 分键', landingKeyOf({ leg: 'a', path: 'b' }) === 'a\u0000b')
  ok('缺 blobOid ⇒ 点名', missingFieldsOf({ at: 'x', leg: 'l', path: 'p' }).join() === 'blobOid')
  ok('时刻不可解析 ⇒ ageMs 为 null', ageMs({ at: 'not-a-date' }, Date.now()) === null)
  ok('正斜杠相对路径放行', pathShapeOk('apps/web/src/x.tsx'))
  ok('反斜杠路径拒收', !pathShapeOk('apps\\web\\x.tsx'))
  ok('.. 逃逸路径拒收', !pathShapeOk('apps/../etc/passwd'))
  ok('旗标形路径拒收', !pathShapeOk('-C'))
  ok('parseLine 拒绝数组', parseLine('[1,2]') === null)
  ok('parseLine 接受对象', parseLine('{"at":"x"}')?.at === 'x')
  ok('canonicalIso 规范化', canonicalIso('2026-11-03T00:00:00Z') === '2026-11-03T00:00:00.000Z')
  ok('now 不可解析 ⇒ 未判定', !collectiblePaths('not-a-time').ok)
  let failed = 0
  for (const [name, pass] of cases) {
    if (!pass) {
      failed++
      console.error(`❌ selfTest: ${name}`)
    }
  }
  if (failed) {
    console.error(`❌ cross-end-landing-ledger --self-test ${failed}/${cases.length} 条不过`)
    return 1
  }
  console.log(`✅ cross-end-landing-ledger --self-test ${cases.length} 例通过(末行现读)`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

/**
 * §22c:暴露给镜像测试的核心判据 —— 测试必须 import 这一份,不得复制第二支判定
 * (门 191 check-test-judge-not-replicated)。命名导出与此处指向同一批函数对象。
 */
export const __test__ = {
  parseLine,
  isRowComplete,
  missingFieldsOf,
  ageMs,
  pathShapeOk,
  canonicalIso,
  landingKeyOf,
  ledgerPathFor,
  REQUIRED_FIELDS,
  batchCheckIgnored,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
