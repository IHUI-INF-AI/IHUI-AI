#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子为 CLI 工具,需 console 输出诊断 */
/**
 * audit-aligned-domain-drift.mjs — 「registers 说 aligned,两端却打不同后端域」的只读队列(2026-10-28 立)
 *
 * 立因(实测):台账 `news` / `news/[id]` 曾记 aligned,载体是 RN 的 Article* 屏;而 RN 打
 * `/api/articles(:id)`(社区文章域),web 资讯打 `/api/news/*`(资讯域)—— 两个不同后端域,
 * 却被"都能看文章"记成对齐,直接把"RN 功能不差"的账面撑大。这类错配不会让任何门变红:
 * 路由存在、屏存在、端点都能调通,只是**不是同一个功能**。
 *
 * 判据(只做队列,不做裁决 —— 与 check-web-rn-screen-parity 的"渲染推翻候选"同一姿态):
 *   A1 对每条 `aligned` 且 `rn` 指针落在 apps/mobile-rn 的行,分别抽两端代码里的 `/api/...` 字面量
 *      (RN 侧另认 fetchApi(`/x`) 这类裸路径,运行期由 normalizeUrl 补 /api)。
 *   A2 取各自**首段**(/api/<seg>)集合;交集为空 ⇒ 记"可疑域错配",逐条点名。
 *      行内已有 `domainAudit`(手核结论:verdict/reason/at)⇒ 不重复点名,单列"已核"待复核时效。
 *      任一侧抽不到端点 ⇒ 记"判不出"(不并进可疑,也不当通过)。
 *   A3 整面读不到(台账或指针文件)⇒ exit 2 未判定(§0.3),不回落另一个面(§0.4)。
 *
 * 期望的用法:它是**给人看的队列**,不改台账、不判红;改判要像 news 那次一样逐条附证据(§24 代裁口径)。
 *
 * Usage:
 *   node scripts/audit-aligned-domain-drift.mjs [--json] [--worktree] [--self-test]
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { catBatch } from './lib/face-reader.mjs'

const ROOT = join(import.meta.dirname, '..')
const MAP_REL = 'scripts/data/web-rn-screen-map.jsonl'

const API_LITERAL = /['"`](\/api\/[a-zA-Z0-9/_-]+)/g
const BARE_CALL = /(?:fetchApi|apiOrThrow)\s*\(\s*[`'"](\/[a-zA-Z0-9/_-]+)/g

const firstSeg = (p) => {
  const s = p.split('/').filter(Boolean) // ['api','news','x'] 或 ['circles']
  return s[0] === 'api' ? (s[1] ?? '') : (s[0] ?? '')
}

/** 从一段源码里抽端点首段集合;抽不到返回空集(调用方据此判"判不出") */
function endpointSegs(text, { bare = false } = {}) {
  const out = new Set()
  for (const m of String(text).matchAll(API_LITERAL)) out.add(firstSeg(m[1]))
  if (bare) for (const m of String(text).matchAll(BARE_CALL)) out.add(firstSeg(m[1]))
  out.delete('')
  return out
}

/** 纯判据:一行 aligned 记录 → 'suspect' | 'ok' | 'undecidable'(喂构造面即可测) */
function classifyRow(row, webText, rnText) {
  if (row.status !== 'aligned' || !row.rn || !String(row.rn).startsWith('apps/mobile-rn/'))
    return { kind: 'skip' }
  if (typeof webText !== 'string' || typeof rnText !== 'string')
    return { kind: 'undecidable', why: '文件取不到' }
  const w = endpointSegs(webText)
  const n = endpointSegs(rnText, { bare: true })
  if (!w.size || !n.size)
    return { kind: 'undecidable', why: w.size ? 'RN 侧抽不到端点' : 'web 侧抽不到端点' }
  const shared = [...w].filter((s) => n.has(s))
  return shared.length
    ? { kind: 'ok', web: [...w].join(','), rn: [...n].join(',') }
    : { kind: 'suspect', web: [...w].join(','), rn: [...n].join(',') }
}

/**
 * 一次性批量取面(§0.4):全仓 233 行 × 2 文件若逐条 spawn git,在本机要 10 分钟以上;
 * 用 `git cat-file --batch` 一轮取满,返回 Map<rel, text|null>。取不到的(路径不存在)记 null。
 */
function batchReadFace(face, rels) {
  const out = new Map()
  if (face === 'worktree') {
    for (const rel of rels) {
      const p = join(ROOT, rel)
      out.set(rel, existsSync(p) ? readFileSync(p, 'utf8') : null)
    }
    return out
  }
  // 批量取材走共享层:自拼 `cat-file --batch` 要把 stdio[0]=pipe / maxBuffer / 头解析三处
  // 本仓都真踩过的坑各重写一遍,棘轮测试按文件计数。索引面用 git 的 `:path` 魔数
  // (原实现写的是空前缀,即把裸路径当对象规格喂进去 —— 取不到只会静默记 null)。
  const spec = face === 'staged' ? ':' : 'HEAD:'
  const raw = catBatch(
    ROOT,
    rels.map((r) => `${spec}${r}`),
  )
  for (const rel of rels) {
    const v = raw.get(`${spec}${rel}`)
    out.set(rel, typeof v === 'string' ? v : null)
  }
  return out
}

function run(argv) {
  const face = argv.includes('--worktree')
    ? 'worktree'
    : argv.includes('--staged')
      ? 'staged'
      : 'head'
  const mapText = batchReadFace(face, [MAP_REL]).get(MAP_REL)
  if (typeof mapText !== 'string') {
    console.log(`❓ 未判定:台账取不到(${face} 面)`)
    return 2
  }
  const rows = mapText
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
  const rels = new Set()
  for (const row of rows) {
    if (row.status !== 'aligned' || !row.rn || !String(row.rn).startsWith('apps/mobile-rn/'))
      continue
    rels.add(row.rn)
    rels.add(`apps/web/app/(main)/${row.web}/page.tsx`)
    rels.add(`apps/web/app/(main)/${row.web}/PageClient.tsx`)
  }
  const texts = batchReadFace(face, [...rels])
  const webSrc = (web) => {
    const parts = [
      `apps/web/app/(main)/${web}/page.tsx`,
      `apps/web/app/(main)/${web}/PageClient.tsx`,
    ]
      .map((r) => texts.get(r))
      .filter((t) => typeof t === 'string')
    return parts.length ? parts.join('\n') : null
  }
  const suspects = []
  const undecidable = []
  const audited = []
  let scanned = 0
  for (const row of rows) {
    const r = classifyRow(row, webSrc(row.web), texts.get(row.rn) ?? null)
    if (r.kind === 'skip') continue
    scanned += 1
    if (r.kind === 'suspect')
      // 手核结论写在行内 domainAudit(verdict+reason+at)⇒ 不再重复点名,单列"已核"由人复核时效
      if (row.domainAudit?.verdict)
        audited.push({
          webPath: row.web,
          verdict: row.domainAudit.verdict,
          at: row.domainAudit.at ?? '',
        })
      else suspects.push({ webPath: row.web, rnPath: row.rn, webSegs: r.web, rnSegs: r.rn })
    else if (r.kind === 'undecidable')
      undecidable.push({ webPath: row.web, rnPath: row.rn, why: r.why })
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face, scanned, suspects, undecidable, audited }))
  } else {
    console.log(
      `[aligned-domain-drift] 面=${face} 可判 aligned 行 ${scanned} · 可疑域错配 ${suspects.length} · 已核 ${audited.length} · 判不出 ${undecidable.length}`,
    )
    for (const s of suspects)
      console.log(`  ⚠ ${s.webPath} → ${s.rnPath} | web[${s.webSegs}] vs rn[${s.rnSegs}]`)
    for (const u of undecidable.slice(0, 10)) console.log(`  · 判不出 ${u.webPath}(${u.why})`)
    for (const au of audited)
      console.log(`  ✓ 已核 ${au.webPath}(${au.verdict}${au.at ? ` @${au.at}` : ''})`)
    if (undecidable.length > 10) console.log(`  … 另有 ${undecidable.length - 10} 条判不出`)
    console.log(
      '  ⓘ 这是队列不是裁决:改判要逐条附证据(参照 news 那次的 /api/news/* vs /api/articles/*)。',
    )
  }
  return 0
}

function selfTest() {
  const cases = []
  const ok = (n, c) => cases.push({ n, c: !!c })
  const row = (o = {}) => ({
    web: 'x',
    status: 'aligned',
    rn: 'apps/mobile-rn/src/screens/X.tsx',
    ...o,
  })
  ok(
    'T1 同域 ⇒ ok',
    classifyRow(row(), "apiOrThrow('/api/news/list')", "fetchApi('/api/news/x')").kind === 'ok',
  )
  ok(
    'T2 域不同 ⇒ suspect(阳性对照:news 那次就是这条)',
    classifyRow(row(), "apiOrThrow('/api/news/articles')", "fetchApi('/api/articles')").kind ===
      'suspect',
  )
  ok(
    'T3 RN 裸路径也认(fetchApi(`/circles`))',
    classifyRow(row(), "apiOrThrow('/api/circles')", 'fetchApi(`/circles`)').kind === 'ok',
  )
  ok(
    'T4 web 抽不到端点 ⇒ 判不出,不并进可疑',
    classifyRow(row(), 'const a = 1', "fetchApi('/api/x')").kind === 'undecidable',
  )
  ok(
    'T5 文件取不到 ⇒ 判不出',
    classifyRow(row(), null, "fetchApi('/api/x')").kind === 'undecidable',
  )
  ok(
    'T6 非 aligned 行不进射程',
    classifyRow(row({ status: 'gap' }), "apiOrThrow('/api/a')", "fetchApi('/api/b')").kind ===
      'skip',
  )
  ok(
    'T7 rn 指针不在 mobile-rn ⇒ 不进射程',
    classifyRow(row({ rn: 'packages/app/src/x.tsx' }), "apiOrThrow('/api/a')", "fetchApi('/api/b')")
      .kind === 'skip',
  )
  for (const c of cases) console.log(`${c.c ? '✅' : '❌'} ${c.n}`)
  const bad = cases.filter((c) => !c.c).length
  console.log(
    bad ? `SELF-TEST FAIL ${bad}/${cases.length}` : `SELF-TEST OK ${cases.length}/${cases.length}`,
  )
  return bad ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const a = process.argv.slice(2)
  process.exit(a.includes('--self-test') ? selfTest() : run(a))
}

export const __test__ = { classifyRow, endpointSegs, firstSeg }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
