// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端镜像「键级撤除台账」——一行 = "这个页面少渲染共享屏的这一个键,是验过的决定,不是漏"。
//
// 为什么要有它(2026-10-30 立):还原度尺 check-miniapp-mirror-fidelity.mjs 判「共享屏消费的键
// 有没有出现在页面正文里」,它结构上判不出**可达性**——键写在一个永假分支里也算"还原"。于是
// 「按后端出处把死分支的假绿键撤掉」这个正确动作,一定会把 missing 从 0 顶成 N,漂移尺随即按
// mirror-missing-increase 维发"补回文案"的到人告警(f526a1a143 撤 6 枚键即此型,六条都有后端
// 出处)。让收信人照告警去补回死分支,等于让判据把仓库往错的方向推(§5e-1 可整改性准入)。
//
// 与屏级台账 scripts/data/miniapp-mirror-verdicts.jsonl 的分工:那张键 = 共享屏 spec,判「这一
// 整屏由不由小程序承载」;这张键 = (page, spec, key) 三元组,判「同一屏里这一个键」。两张不能
// 并一张:屏级裁决会把整屏缺口一起免掉,粒度就是判据强度。
//
// 失效方向恒为"多要一次定向说明"(§0.10):reason/evidence/expires 任一缺、坏、过期 ⇒ **不免**,
// 缺口照原样冒红。绝不因台账取不到就当"全都免了"——那会把判据做成白名单(§0.7)。
//
// 形态:JSONL,一行一键,键序固定(page, spec, key, reason, evidence, at, expires, source)。
// 固定键序 = diff 只随内容变(与屏级台账同口径)。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** 台账路径 —— 全仓唯一一份(§0.6)。 */
export const RETRACTIONS_PATH = 'scripts/data/miniapp-key-retractions.jsonl'

/** 一条撤除要成立,evidence 至少要这么多字:短到这个长度基本等于没写出处。 */
export const MIN_EVIDENCE_CHARS = 20

/**
 * 一行撤除是否成立。
 * @param {object} r
 * @returns {string|null} null = 成立;否则点名为什么不成立
 */
export function retractionValidity(r) {
  if (!r || typeof r !== 'object') return '非对象'
  if (typeof r.page !== 'string' || !r.page) return '缺 page'
  if (typeof r.spec !== 'string' || !r.spec) return '缺 spec'
  if (typeof r.key !== 'string' || !r.key) return '缺 key'
  if (typeof r.reason !== 'string' || !r.reason.trim()) return '缺 reason'
  const ev = typeof r.evidence === 'string' ? r.evidence.trim() : ''
  if (ev.length < MIN_EVIDENCE_CHARS) return `evidence 不足 ${MIN_EVIDENCE_CHARS} 字`
  if (typeof r.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.expires))
    return 'expires 缺失或形态坏'
  // V8 对越界日历日会顺延(2099-02-30 → 3 月 2 日)而照报一个数,所以必须回读年月日等值才算数。
  const [ey, em, ed] = r.expires.split('-').map(Number)
  const stamped = new Date(Date.UTC(ey, em - 1, ed))
  if (
    stamped.getUTCFullYear() !== ey ||
    stamped.getUTCMonth() !== em - 1 ||
    stamped.getUTCDate() !== ed
  )
    return `expires 不是有效日历日(${r.expires})`
  const endOfDay = stamped.getTime() + 24 * 3600 * 1000 - 1
  if (endOfDay < Date.now()) return `已到期(${r.expires})`
  return null
}

/**
 * 免检身份键 = 三元组。页面改路由或共享屏换文件,这条撤除应当**失去命中**,
 * 而不是继续免到另一页/另一屏上去(那正是"串门豁免"的成因)。
 */
export function retractionId({ page, spec, key }) {
  return `${page}\u0000${spec}\u0000${key}`
}

/**
 * 解析台账文本。坏行不静默丢:单独归入 bad(§0.3「没判不写成判过」)。
 * @returns {{rows: object[], bad: {raw: string, why: string}[]}}
 */
export function parseRetractions(text) {
  const rows = []
  const bad = []
  for (const line of String(text || '').split('\n')) {
    const s = line.trim()
    if (!s) continue
    let obj
    try {
      obj = JSON.parse(s)
    } catch {
      bad.push({ raw: s, why: '非 JSON' })
      continue
    }
    if (!obj || typeof obj !== 'object') {
      bad.push({ raw: s, why: '非对象' })
      continue
    }
    rows.push(obj)
  }
  return { rows, bad }
}

/**
 * 读某一面的台账(取材面纪律 §0.4:默认 HEAD blob;worktree 仅人工逃生舱)。
 * 取不到 = 这张台账还是空的 ⇒ rows=[],**不回落另一个面**(回落会把"还没落 HEAD"读成"没人撤过")。
 * @returns {{text: string|null, rows: object[], bad: {raw: string, why: string}[]}}
 */
export function readRetractions(face = 'head', root = ROOT) {
  const rel = RETRACTIONS_PATH.replace(/\\/g, '/')
  if (face === 'worktree') {
    const p = join(root, rel)
    if (!existsSync(p)) return { text: null, rows: [], bad: [] }
    const text = readFileSync(p, 'utf8')
    return { text, ...parseRetractions(text) }
  }
  const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  try {
    const text = execFileSync('git', ['-C', root, 'show', spec], {
      encoding: 'utf8',
      // §12g:派生 git 必须显式接管 stdio(不写稳定 EBUSY)
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    return { text, ...parseRetractions(text) }
  } catch {
    return { text: null, rows: [], bad: [] }
  }
}

/**
 * 把台账分成三桶:成立(可免)/ 不成立(不免,逐条点名)/ 坏行(读不出来)。
 * 桶的划分不看"像不像",只看 retractionValidity 与 parse 的坏行集 ⇒ 一张表三态,
 * 任何一格取不到都不会被折成"没问题"。
 * @returns {{active: Set<string>, refused: {id: string, why: string}[], bad: {raw: string, why: string}[], total: number}}
 */
export function indexRetractions(rows, bad = []) {
  const active = new Set()
  const refused = []
  for (const r of rows || []) {
    const why = retractionValidity(r)
    const id =
      r && typeof r.page === 'string' && typeof r.spec === 'string' && typeof r.key === 'string'
        ? retractionId(r)
        : null
    if (why) refused.push({ id: id ?? `${r?.page ?? '?'}|${r?.spec ?? '?'}|${r?.key ?? '?'}`, why })
    else if (!active.has(id)) active.add(id)
    else refused.push({ id, why: '同键重复登记(后一条不扩覆盖面,只让台账读起来像有两档裁决)' })
  }
  return { active, refused, bad: [...bad], total: (rows || []).length }
}

/** 序列化:一行一 JSON,键序固定。 */
export function serializeRetractions(rows) {
  return rows
    .map((r) =>
      JSON.stringify({
        page: r.page,
        spec: r.spec,
        key: r.key,
        reason: r.reason || '',
        evidence: r.evidence || '',
        at: r.at || '',
        expires: r.expires || '',
        source: r.source || '',
      }),
    )
    .join('\n')
}

/** §22c 三步之①:判据单源,镜像测试直接用生产实现,不在测试里复制一份。 */
export const __test__ = {
  RETRACTIONS_PATH,
  MIN_EVIDENCE_CHARS,
  retractionValidity,
  retractionId,
  parseRetractions,
  indexRetractions,
  serializeRetractions,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
