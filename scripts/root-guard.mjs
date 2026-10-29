// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * root-guard — 根护栏(O65 P0 · O6501,2026-10-25 立)。
 *
 * 保护的不是业务代码,是**规则自身**:守门执行器 / 判据单一真源 / AGENTS 全局铁律段。
 * 判据 = 清单内每条目标的规范化 sha256 与现盘一致;不一致时只有"与该新内容绑定的、
 * 未过期的人工解锁记录"才放行。其余一律 fail-closed —— 部署环读到非 0 退出码就拒绝推进。
 *
 * 纪律:
 *  - 取不到清单 / 清单形状坏 / 目标文件缺失 / 铁律段锚点找不到 ⇒ exit 2「未判定」,
 *    绝不回落成"没改动所以放行"(§0.3:没判绝不写成判过)。
 *  - 解锁不是"关闭护栏",而是"人已看过这次改动"的机读留痕:记录里绑定**新内容的 hash**
 *    与过期时刻;内容再变一次就重新判红。解锁必须给出理由,空理由拒写。
 *  - 哈希口径统一走 normalizeText(去 BOM / CRLF→LF / 统一结尾换行),避免同一内容在
 *    autocrlf 检出差异下被判成两个版本。
 *
 * 用法:
 *   node scripts/root-guard.mjs --check            # 部署环前置闸:0 通过 / 1 判红 / 2 未判定
 *   node scripts/root-guard.mjs --check --json
 *   node scripts/root-guard.mjs --status
 *   node scripts/root-guard.mjs --seal --reason "人工复核后重新封存"
 *   node scripts/root-guard.mjs --unlock --target agents-ironlaw --reason "..." [--ttl-min 120]
 *   node scripts/root-guard.mjs --self-test
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gitRaw } from './lib/face-reader.mjs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST_PATH = join(ROOT, 'scripts', 'data', 'root-guard-manifest.json')
export const UNLOCK_PATH = join(ROOT, '.ihui-agent', 'state', 'root-guard-unlocks.json')

export const EXIT_OK = 0
export const EXIT_DRIFT = 1
export const EXIT_UNKNOWN = 2

/** 目标清单形状(唯一真源在 manifest 内;此处只写"必须有哪几条",不写哈希)。 */
export const REQUIRED_TARGET_IDS = ['guardian-runner', 'judgement-libs', 'agents-ironlaw']
const SECTION_START = '## 0. 全局铁律'
const SECTION_END_PREFIX = '## '

/** 规范化:去 BOM、CRLF→LF、统一为单个结尾换行。哈希只认这一份口径。 */
export function normalizeText(raw) {
  let s = String(raw ?? '')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return s.replace(/\n+$/, '\n')
}

export function sha256Of(text) {
  return createHash('sha256').update(normalizeText(text), 'utf8').digest('hex')
}

/**
 * 取 Markdown 二级标题段:从 startMarker 起,到下一个 `## ` 行止(含起始行,不含终止行)。
 * 取不到起始行 ⇒ 返回 null(调用方判「未判定」,不当成空段)。
 */
export function extractSection(raw, startMarker = SECTION_START, endPrefix = SECTION_END_PREFIX) {
  const lines = normalizeText(raw).split('\n')
  // 前缀匹配而非等值:标题常带括注(`## 0. 全局铁律(先读,跨节通用)`),等值匹配会把锚点判丢。
  const start = lines.findIndex((l) => l.trim().startsWith(startMarker))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith(endPrefix)) {
      end = i
      break
    }
  }
  const body = lines.slice(start, end).join('\n')
  return body.endsWith('\n') ? body : `${body}\n`
}

/** 读目标现文并按 mode 取哈希载荷;文件缺失或段锚点失踪 ⇒ { ok:false, why }。 */
export function hashTarget(target, readFile = (p) => readFileSync(p, 'utf8'), root = ROOT) {
  const abs = resolve(root, target.path)
  let raw
  try {
    raw = readFile(abs)
  } catch (e) {
    return { ok: false, why: `目标读不到(${target.path}):${e?.message ?? e}` }
  }
  if (target.mode === 'section') {
    const sec = extractSection(
      raw,
      target.start ?? SECTION_START,
      target.endPrefix ?? SECTION_END_PREFIX,
    )
    if (sec === null)
      return {
        ok: false,
        why: `铁律段锚点找不到(${target.path} 缺 "${target.start ?? SECTION_START}")`,
      }
    return { ok: true, sha256: sha256Of(sec), bytes: Buffer.byteLength(sec, 'utf8') }
  }
  if (target.mode !== 'file') return { ok: false, why: `目标 mode 非法(${target.mode})` }
  return { ok: true, sha256: sha256Of(raw), bytes: Buffer.byteLength(normalizeText(raw), 'utf8') }
}

/** 清单形状锁:缺字段/重复 id/必备条目缺席 ⇒ 抛(调用方落 exit 2)。 */
export function loadManifest(rawText) {
  let m
  try {
    m = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`清单不是合法 JSON:${e?.message ?? e}`)
  }
  if (!m || typeof m !== 'object') throw new Error('清单不是对象')
  if (!Array.isArray(m.targets) || m.targets.length === 0)
    throw new Error('清单 targets 必须是非空数组')
  const seen = new Set()
  for (const t of m.targets) {
    if (!t || typeof t !== 'object') throw new Error('清单 targets 出现非对象项')
    for (const k of ['id', 'path', 'mode', 'sha256']) {
      if (typeof t[k] !== 'string' || !t[k].trim())
        throw new Error(`清单项缺 ${k}:${JSON.stringify(t).slice(0, 120)}`)
    }
    if (!/^[a-f0-9]{64}$/.test(t.sha256))
      throw new Error(`清单项 ${t.id} 的 sha256 不是 64 位小写十六进制`)
    if (!['file', 'section'].includes(t.mode))
      throw new Error(`清单项 ${t.id} 的 mode 非 file/section`)
    if (seen.has(t.id)) throw new Error(`清单 id 重复:${t.id}`)
    seen.add(t.id)
  }
  return m
}

/** 解锁记录:只认「同 id + 同新 hash + 未过期」三条同时成立,否则等于没解锁。 */
export function activeUnlocks(rawText, now = Date.now()) {
  if (!rawText) return []
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch {
    return []
  }
  const list = Array.isArray(doc?.records) ? doc.records : []
  return list.filter((r) => {
    if (!r || typeof r.id !== 'string' || typeof r.sha256 !== 'string') return false
    const exp = Date.parse(r.expiresAt)
    return Number.isFinite(exp) && exp > now
  })
}

/**
 * 逐条判定。返回 { verdict: 'pass'|'fail'|'unknown', targets:[{id,state,detail}] }。
 * 单条目标读不到 ⇒ 整轮 unknown(取不到不判过)。
 */
export function checkAll({ manifest, readFile, root, unlocks = [] } = {}) {
  const targets = []
  let sawUnknown = false
  for (const t of manifest.targets) {
    const h = hashTarget(t, readFile, root)
    if (!h.ok) {
      sawUnknown = true
      targets.push({ id: t.id, state: 'unknown', expected: t.sha256, detail: h.why })
      continue
    }
    if (h.sha256 === t.sha256) {
      targets.push({
        id: t.id,
        state: 'pass',
        expected: t.sha256,
        actual: h.sha256,
        bytes: h.bytes,
        detail: '',
      })
      continue
    }
    const unlocked = unlocks.find((u) => u.id === t.id && u.sha256 === h.sha256)
    targets.push({
      id: t.id,
      state: unlocked ? 'unlocked' : 'fail',
      expected: t.sha256,
      actual: h.sha256,
      bytes: h.bytes,
      detail: unlocked
        ? `人工解锁记录在有效期(理由:${unlocked.reason ?? ''};至 ${unlocked.expiresAt})`
        : '内容已改动且无有效人工解锁',
    })
  }
  const verdict = sawUnknown ? 'unknown' : targets.some((t) => t.state === 'fail') ? 'fail' : 'pass'
  return { verdict, targets }
}

export function exitCodeOf(verdict) {
  return verdict === 'pass' ? EXIT_OK : verdict === 'fail' ? EXIT_DRIFT : EXIT_UNKNOWN
}

/**
 * 判红时把"到底哪一面对不上"也量出来(纯函数,不碰 git ⇒ 可被测试直接喂三面哈希)。
 *
 * 立因(2026-10-29 实测):部署环连着 40 多分钟 fail-closed,而每一次红都不是"有人改了规则",
 * 是清单 ↔ 工作树 ↔ HEAD 三面里某一面对不上(一次是他席在另一枚签出里 --seal 过,一次是
 * `chore(auto)` 收编把规则文件写回旧版)。旧输出只给 expected/actual 两个哈希,读的人只能猜,
 * 猜错就多封一次清单 —— 而多封一次清单恰恰是下一次对不上的成因。
 */
export function faceDiagnosis({ expected, actual, head }) {
  if (head === null || head === undefined)
    return 'HEAD 面取不到 ⇒ 差面未判定,不据此给处置建议(§0.3)'
  const headIsExpected = head === expected
  const headIsActual = head === actual
  if (headIsActual && !headIsExpected)
    return (
      '工作树 == HEAD 面,而清单绑的是另一份内容 ⇒ 这不是"有人改了规则",是清单与**已入库内容**对不上' +
      '(典型成因:在另一枚签出/另一时刻 --seal 过,或合并/收编把规则文件写回旧版)。' +
      '处置:复核 HEAD 面那份改动 → 重新 --seal → **把清单与规则文件同枚提交并推送**;`git checkout -- <path>` 还原工作树不解决问题。'
    )
  if (headIsExpected && !headIsActual)
    return (
      '清单 == HEAD 面,只有工作树副本不同 ⇒ 盘上那份是滞后的在飞副本或未入库改动。' +
      '处置:先确认它是不是你要交的那份 —— 是就提交,不是就 `git checkout -- <path>`,**不要**为它再封一次清单。'
    )
  return 'HEAD / 工作树 / 清单 三面互不相同 ⇒ 需人工逐面复核(本器不猜哪面是权威)'
}

/** 读 HEAD 面上该目标的哈希(section 模式沿用同一条 extractSection 尺)。取不到 ⇒ null,不冒充。 */
function headHashOf(target) {
  try {
    const raw = gitRaw(['show', `HEAD:${target.path}`], ROOT, {})
    return sha256Of(target.mode === 'section' ? extractSection(raw) : raw)
  } catch {
    return null
  }
}

function readOrDie(path, label) {
  try {
    return readFileSync(path, 'utf8')
  } catch (e) {
    const err = new Error(`${label}读不到(${path}):${e?.message ?? e}`)
    err.code = 'UNKNOWN'
    throw err
  }
}

/** --seal:按现盘重算清单。必须给理由(人工复核的机读留痕)。 */
export function seal({
  reason,
  manifestPath = MANIFEST_PATH,
  readFile = (p) => readFileSync(p, 'utf8'),
  root = ROOT,
  now = new Date(),
} = {}) {
  if (!reason || !reason.trim())
    throw new Error('--seal 必须给 --reason(封存是人工动作,空理由拒写)')
  const old = loadManifest(readOrDie(manifestPath, '清单'))
  const targets = old.targets.map((t) => {
    const h = hashTarget(t, readFile, root)
    if (!h.ok) throw new Error(`封存失败:${h.why}`)
    return { ...t, sha256: h.sha256 }
  })
  const doc = {
    $comment:
      'O6501 根护栏清单:改动本清单内目标须先 --unlock 再 --seal;部署环对非 0 退出 fail-closed。',
    version: old.version ?? 1,
    sealedAt: now.toISOString(),
    sealedBy: 'root-guard --seal',
    reason: reason.trim(),
    targets,
  }
  mkdirSync(dirname(manifestPath), { recursive: true })
  const tmp = `${manifestPath}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  renameSync(tmp, manifestPath)
  return doc
}

/** --unlock:把「人已复核」绑定到当前内容哈希,并写过期时刻。 */
export function unlock({
  targetId,
  reason,
  ttlMin = 120,
  manifest,
  unlockPath = UNLOCK_PATH,
  readFile = (p) => readFileSync(p, 'utf8'),
  root = ROOT,
  now = Date.now(),
} = {}) {
  if (!reason || !reason.trim()) throw new Error('--unlock 必须给 --reason(空理由拒写)')
  if (!Number.isFinite(ttlMin) || ttlMin <= 0) throw new Error('--ttl-min 必须是正整数')
  const t = manifest.targets.find((x) => x.id === targetId)
  if (!t)
    throw new Error(
      `清单里没有目标 ${targetId}(现有:${manifest.targets.map((x) => x.id).join('/')})`,
    )
  const h = hashTarget(t, readFile, root)
  if (!h.ok) throw new Error(`解锁失败:${h.why}`)
  let doc = { records: [] }
  if (existsSync(unlockPath)) {
    try {
      const cur = JSON.parse(readFileSync(unlockPath, 'utf8'))
      if (Array.isArray(cur?.records)) doc = { records: cur.records }
    } catch {
      doc = { records: [] }
    }
  }
  const at = new Date(now)
  const expiresAt = new Date(now + ttlMin * 60_000)
  doc.records = doc.records.filter((r) => r?.id !== targetId || Date.parse(r?.expiresAt) > now)
  doc.records.push({
    id: targetId,
    sha256: h.sha256,
    reason: reason.trim(),
    at: at.toISOString(),
    expiresAt: expiresAt.toISOString(),
  })
  mkdirSync(dirname(unlockPath), { recursive: true })
  writeFileSync(unlockPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return { id: targetId, sha256: h.sha256, expiresAt: expiresAt.toISOString() }
}

function fmt(res) {
  const lines = [`root-guard: verdict=${res.verdict}`]
  for (const t of res.targets) {
    lines.push(
      `  ${t.state.toUpperCase().padEnd(8)} ${t.id}  expected=${t.expected.slice(0, 12)} actual=${(t.actual ?? '-').slice(0, 12)}${t.detail ? `  ${t.detail}` : ''}`,
    )
  }
  return lines.join('\n')
}

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(`self-test 失败:${msg}`)
  }
  const md = '# t\n\n## 0. 全局铁律\nA\nB\n\n## 1. 其它\nC\n'
  const sec = extractSection(md)
  assert(sec === '## 0. 全局铁律\nA\nB\n', '段抽取应止于下一个二级标题')
  assert(extractSection('## 1. x\n') === null, '缺锚点应返回 null 而不是空段')
  assert(sha256Of('a\r\nb') === sha256Of('a\nb'), 'CRLF 与 LF 必须同哈希')
  assert(sha256Of('\ufeffa') === sha256Of('a'), 'BOM 必须被剥')
  const m = {
    targets: [
      { id: 'x', path: 'x.mjs', mode: 'file', sha256: sha256Of('good') },
      { id: 'y', path: 'AGENTS.md', mode: 'section', start: SECTION_START, sha256: sha256Of(sec) },
    ],
  }
  const files = { 'x.mjs': 'good', 'AGENTS.md': md }
  const rf = (p) => {
    const k = String(p).replace(/\\/g, '/').split('/').pop()
    if (!(k in files)) throw new Error('ENOENT')
    return files[k]
  }
  let r = checkAll({ manifest: m, readFile: rf, root: '/r' })
  assert(r.verdict === 'pass', '无改动应 pass')
  r = checkAll({
    manifest: m,
    readFile: (p) => (String(p).endsWith('x.mjs') ? 'bad' : md),
    root: '/r',
  })
  assert(r.verdict === 'fail' && r.targets[0].state === 'fail', '改动应 fail')
  const exp = new Date(Date.now() + 60_000).toISOString()
  const unl = [{ id: 'x', sha256: sha256Of('bad'), reason: 'reviewed', expiresAt: exp }]
  r = checkAll({
    manifest: m,
    readFile: (p) => (String(p).endsWith('x.mjs') ? 'bad' : md),
    root: '/r',
    unlocks: unl,
  })
  assert(r.verdict === 'pass' && r.targets[0].state === 'unlocked', '绑定新哈希的解锁应放行')
  r = checkAll({
    manifest: m,
    readFile: (p) => (String(p).endsWith('x.mjs') ? 'bad2' : md),
    root: '/r',
    unlocks: unl,
  })
  assert(r.verdict === 'fail', '解锁后再改一次应重新判红')
  r = checkAll({
    manifest: m,
    readFile: () => {
      throw new Error('ENOENT')
    },
    root: '/r',
  })
  assert(r.verdict === 'unknown', '取不到内容应 unknown 而不是 pass')
  assert(
    exitCodeOf('pass') === 0 && exitCodeOf('fail') === 1 && exitCodeOf('unknown') === 2,
    '退出码映射',
  )
  try {
    loadManifest('{"targets":[]}')
    throw new Error('空 targets 应抛')
  } catch (e) {
    assert(/非空数组/.test(e.message), '空 targets 判错')
  }
  console.log(`self-test: 全绿(9 组断言;必备目标 ${REQUIRED_TARGET_IDS.join('/')})`)
}

function main(argv) {
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()
  if (has('--seal')) {
    const doc = seal({ reason: val('--reason', '') })
    console.log(
      `✅ 已封存 ${doc.targets.length} 条:${doc.targets.map((t) => `${t.id}=${t.sha256.slice(0, 12)}`).join(' / ')}`,
    )
    return
  }
  let manifest
  try {
    manifest = loadManifest(readOrDie(MANIFEST_PATH, '清单'))
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  if (has('--unlock')) {
    try {
      const rec = unlock({
        targetId: val('--target', ''),
        reason: val('--reason', ''),
        ttlMin: Number(val('--ttl-min', '120')),
        manifest,
      })
      console.log(
        `✅ 已解锁 ${rec.id}(绑定当前哈希 ${rec.sha256.slice(0, 12)},至 ${rec.expiresAt})`,
      )
    } catch (e) {
      console.error(`❌ 解锁失败:${e.message}`)
      process.exitCode = EXIT_UNKNOWN
    }
    return
  }
  const now = Date.now()
  let unlocks = []
  if (existsSync(UNLOCK_PATH)) {
    try {
      unlocks = activeUnlocks(readFileSync(UNLOCK_PATH, 'utf8'), now)
    } catch {
      unlocks = []
    }
  }
  const res = checkAll({ manifest, unlocks })
  if (has('--json')) {
    console.log(JSON.stringify({ verdict: res.verdict, targets: res.targets }, null, 2))
  } else {
    console.log(fmt(res))
  }
  if (res.verdict === 'fail') {
    console.error(
      '❌ 根护栏判红:规则文件被改动且无有效人工解锁 ⇒ 部署环 fail-closed 拒绝推进。人工复核后:node scripts/root-guard.mjs --seal --reason "..."',
    )
    for (const t of res.targets) {
      if (t.state !== 'fail') continue
      const target = manifest.targets.find((x) => x.id === t.id)
      console.error(
        `   差面判读[${t.id}]:${faceDiagnosis({ expected: t.expected, actual: t.actual, head: target ? headHashOf(target) : null })}`,
      )
    }
  } else if (res.verdict === 'unknown') {
    console.error('❌ 根护栏未判定:清单/目标取不到 ⇒ 按 fail-closed 处置(不冒充通过)')
  }
  process.exitCode = exitCodeOf(res.verdict)
}

export const __test__ = {
  normalizeText,
  sha256Of,
  extractSection,
  hashTarget,
  loadManifest,
  activeUnlocks,
  checkAll,
  exitCodeOf,
  faceDiagnosis,
  seal,
  unlock,
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
