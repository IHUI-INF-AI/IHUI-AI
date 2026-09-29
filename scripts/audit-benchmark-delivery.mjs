#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 尺子②:对标交付核验(票 D140,V3 §八 自留建议)。
//
// 它回答一个此前没有任何一处能回答的问题:**一条被写进对标文档的差距,今天还成立吗?**
// 立票凭据是本线自己踩到的两件事:V3 #73「小程序无 AI 对话页」与 #51「后台只有 sleep/echo」
// 两条都被代码推翻了,而**没有任何一处会喊"这条已过期"** —— 手工重验能抓到只是因为那一轮恰好
// 重读了它,那不是防线是运气。同日另一型是反方向:D132 已入库却仍挂着未勾选。两个方向都要尺子。
//
// 用法:
//   node scripts/audit-benchmark-delivery.mjs [--doc <相对路径>]... [--claims <相对路径>]
//   node scripts/audit-benchmark-delivery.mjs --strict      # 判不出/台账腐烂 ⇒ exit 2(拒绝出合格证)
//   node scripts/audit-benchmark-delivery.mjs --json
//   node scripts/audit-benchmark-delivery.mjs --self-test
//
// 三态口径(绝不并桶,这是本尺子的全部价值):
//   delivered   已交付 —— 该条 blocking 子断言全部在被审面成立
//   still-open  仍存在 —— 至少一条子断言在被审面不成立
//   undetermined 判不出 —— 条目没挂机器可判的锚点(锚点缺路径或缺正则)
// undetermined 既不得并入 delivered,也不得并入 still-open;--strict 下有未判定即 exit 2,
// 因为"整票已交付"的假结论正是这张票点名的最大风险(#51 的 stub 半边仍在)。
//
// 定级:warn 且**刻意不进提交链** —— 它判的是"文档与代码是否一致",与本次提交内容无关;
// 挂 blocking 就是一台恒红门,唯一结局是各会话 `--no-verify` 连带全部守门作废(AGENTS §12e/§12f)。
// 文件名不以 check|scan|guard 开头 ⇒ 守门 89 结构上看不见它,不变量由 --self-test 与 §22c
// 镜像测试 scripts/tests/audit-benchmark-delivery.test.mjs 钉住。
// **明令禁止 `--update` 式把读数冻成基线**(照 scripts/check-plan-sha-resolvable.mjs 的先例):
// 读数每天会变,冻起来等于给"文档与代码脱节"发通行证。
//
// 取材口径同 70/77/83/98/101/103/118:全量判 HEAD blob、`--staged` 判索引 blob、
// `--worktree` 仅人工;两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定,不冒红也不记绿;
// 存在性用 catBatchOids、内容用同一次 catBatch ⇒ **清单与内容同面同轮**(分两轮读会在并发
// 会话推进的那一刻产出自洽却错位的尺子)。

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, catBatchOids, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_CLAIMS = 'config/benchmark-delivery-claims.json'
const GIT_TIMEOUT = 120000

/** 一条锚点:paths[] 是候选路径(路径搬家型差距必须能挂多个候选),regex 在被命中的文件里找。 */
function anchorProblem(a) {
  if (!a || !Array.isArray(a.paths) || a.paths.length === 0) return '缺候选路径'
  if (typeof a.regex !== 'string' || a.regex.length === 0) return '缺正则锚点'
  if (a.expect !== 'present' && a.expect !== 'absent') return 'expect 必须是 present|absent'
  return null
}

/** 单条锚点在被审面上的判读。face 是一个注入式读取器 {exists, read},便于镜像用构造面而不是真仓。 */
function evalAnchor(anchor, face) {
  const bad = anchorProblem(anchor)
  if (bad) return { state: 'undetermined', reason: bad }
  const hits = []
  const misses = []
  for (const p of anchor.paths) {
    if (!face.exists(p)) {
      misses.push(p)
      continue
    }
    const body = face.read(p)
    if (typeof body !== 'string') return { state: 'undetermined', reason: `路径在位但取不到内容:${p}` }
    let re
    try {
      re = new RegExp(anchor.regex, 'g')
    } catch {
      return { state: 'undetermined', reason: `正则不可解析:${anchor.regex}` }
    }
    const n = (body.match(re) || []).length
    const need = Number.isFinite(anchor.minCount) ? anchor.minCount : 1
    if (n >= need) hits.push({ path: p, count: n })
    else misses.push(`${p}(命中 ${n} < ${need})`)
  }
  if (anchor.expect === 'present') {
    return hits.length > 0
      ? { state: 'holds', hit: hits[0], triedHits: hits, missed: misses }
      : { state: 'fails', missed: misses }
  }
  // expect:'absent' —— 只有"每个候选都确认取到过"才算成立;任何一个候选取不到内容 ⇒ 判不出,
  // 不得把"没看见"写成"确实没有"(本仓最高频失效型)。
  return hits.length === 0
    ? { state: 'holds', missed: misses }
    : { state: 'fails', hit: hits[0] }
}

/**
 * 一条子断言:所有锚点都判读后归约。
 * 任一 undetermined ⇒ 整条 undetermined(不得让一条判不出被别条的绿顶掉)。
 */
function evalAssertion(assertion, face) {
  const anchors = (assertion.anchors || []).map((a) => ({ anchor: a, result: evalAnchor(a, face) }))
  if (anchors.length === 0) return { state: 'undetermined', reason: '未挂任何锚点', anchors }
  if (anchors.some((x) => x.result.state === 'undetermined'))
    return { state: 'undetermined', anchors, reason: anchors.filter((x) => x.result.state === 'undetermined').map((x) => x.result.reason).join(';') }
  return { state: anchors.every((x) => x.result.state === 'holds') ? 'holds' : 'fails', anchors }
}

/** 一条差距条目的结论:只看 blocking 子断言;observations 一律打印,不参与定性。 */
function judgeClaim(claim, face) {
  const blocking = (claim.assertions || []).filter((a) => a.blocking !== false)
  const results = blocking.map((a) => ({ text: a.text, ...evalAssertion(a, face) }))
  const observations = (claim.observations || []).map((a) => ({ text: a.text, ...evalAssertion(a, face) }))
  let verdict = 'delivered'
  if (results.length === 0) verdict = 'undetermined'
  else if (results.some((r) => r.state === 'undetermined')) verdict = 'undetermined'
  else if (results.some((r) => r.state === 'fails')) verdict = 'still-open'
  return { id: claim.id, title: claim.title, verdict, assertions: results, observations }
}

/** 文档表格行:`| 15 | 能力名 | 证据 | ✅ |` —— 用来量"登记面覆盖率",不让尺子偷偷只判几条。 */
function parseDocRows(text) {
  const rows = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d{1,3})\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/)
    if (m) rows.push({ id: Number(m[1]), title: m[2].trim(), evidence: m[3].trim(), status: m[4].trim() })
  }
  return rows
}

/** 台账自洽:每条 claim 的 docAnchor 必须还能在被引文档里找到(行号会变,所以只按内容锚点核)。 */
function ledgerRot(claims, docTextById) {
  const rot = []
  for (const c of claims) {
    const doc = docTextById.get(c.doc)
    if (!doc) {
      rot.push({ id: c.id, reason: `点名的文档不在射程里:${c.doc}` })
      continue
    }
    if (typeof c.docAnchor !== 'string' || c.docAnchor.length < 4) {
      rot.push({ id: c.id, reason: '缺内容锚点 docAnchor(行号不作证据)' })
      continue
    }
    if (!doc.includes(c.docAnchor)) rot.push({ id: c.id, reason: `docAnchor 在 ${c.doc} 里已找不到(条目搬家或已删)` })
  }
  return rot
}

function loadFace(root, face) {
  const cache = new Map()
  const specs = new Map()
  return {
    face,
    prime(paths) {
      const uniq = [...new Set(paths)].filter((p) => !specs.has(p))
      if (uniq.length === 0) return
      if (face === 'worktree') {
        for (const p of uniq) {
          specs.set(p, null)
          try {
            cache.set(p, readWorktreeFile(root, p))
          } catch {
            cache.set(p, null)
          }
        }
        return
      }
      const revs = uniq.map((p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`))
      let oids
      try {
        oids = catBatchOids(root, revs, { timeout: GIT_TIMEOUT })
      } catch (e) {
        throw new Undetermined(`枚举被审面失败(${face}):${e?.message ?? e}`)
      }
      const needBody = []
      uniq.forEach((p, i) => {
        specs.set(p, revs[i])
        const oid = oids.get(revs[i])
        if (typeof oid === 'string' && oid.length > 0) needBody.push(revs[i])
        else cache.set(p, null)
      })
      if (needBody.length === 0) return
      let bodies
      try {
        bodies = catBatch(root, needBody, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
      } catch (e) {
        throw new Undetermined(`读取被审面失败(${face}):${e?.message ?? e}`)
      }
      for (const [p, spec] of specs) if (spec && needBody.includes(spec)) cache.set(p, bodies.get(spec) ?? null)
    },
    exists(p) {
      if (!specs.has(p)) this.prime([p])
      const body = cache.get(p)
      if (typeof body === 'string') return true
      if (body === null) return false
      // 内容尚未取到但规格已知:再取一次(规格已知 ⇒ 只需读这一条)
      this.prime([p])
      return typeof cache.get(p) === 'string'
    },
    read(p) {
      if (!specs.has(p) || cache.get(p) === undefined) this.prime([p])
      const body = cache.get(p)
      return typeof body === 'string' ? body : null
    },
  }
}

function walkPaths(claims) {
  const out = []
  for (const c of claims)
    for (const a of [...(c.assertions || []), ...(c.observations || [])])
      for (const an of a.anchors || []) for (const p of an.paths || []) out.push(p)
  return out
}

function formatLine(r) {
  const mark = { delivered: '✅ 已交付', 'still-open': '❌ 仍存在', undetermined: '❔ 判不出' }[r.verdict]
  const first = r.assertions && r.assertions[0]
  const res = first && first.anchors && first.anchors[0] && first.anchors[0].result
  // 命中路径必须报名;expect:'absent' 那一型没有"命中",就报"核过哪些候选" ——
  // 否则读者拿到一句"已交付",却不知道该结论是靠哪个文件撑起来的(报告不得只给颜色)。
  if (res && res.hit) return `  ${mark}  ${r.id} ${r.title} —— 命中 ${res.hit.path}`
  if (res && Array.isArray(res.missed)) return `  ${mark}  ${r.id} ${r.title} —— 已核候选 ${res.missed.length} 个路径/条件:${res.missed.slice(0, 3).join(', ')}`
  return `  ${mark}  ${r.id} ${r.title}${first && first.reason ? ` —— ${first.reason}` : ''}`
}

function main(argv) {
  const opt = (name, dflt) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`))
    return hit ? hit.slice(name.length + 3) : dflt
  }
  const flags = new Set(argv)
  if (flags.has('--help')) {
    console.log('用法:node scripts/audit-benchmark-delivery.mjs [--doc <路径>] [--claims <路径>] [--staged|--worktree] [--strict] [--json] [--self-test]')
    return 0
  }
  if (flags.has('--self-test')) return selfTest()

  const picked = selectFace({ staged: flags.has('--staged'), worktree: flags.has('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error} —— 两面同给 = 判死(AGENTS 取材面纪律)`)
    return 2
  }
  const face = picked.face

  const claimsPath = opt('claims', DEFAULT_CLAIMS)
  let claimsRaw
  try {
    claimsRaw = JSON.parse(readFileSync(resolve(ROOT, claimsPath), 'utf8'))
  } catch (e) {
    console.error(`❌ 断言登记表取不到或坏了:${claimsPath} —— ${e?.message ?? e}(坏 JSON 不得当空表用)`)
    return 2
  }
  const claims = Array.isArray(claimsRaw.claims) ? claimsRaw.claims : []
  if (claims.length === 0) {
    console.error('❌ 断言登记表为空 ⇒ 本尺子一处都没判,不记为通过')
    return 2
  }

  const docPaths = (argv.reduce((acc, a, i) => (a === '--doc' ? acc.concat(argv[i + 1]) : acc), []).concat(claimsRaw.docs || ['docs/AI_CHAT_BENCHMARK_ANALYSIS_V3.md'])).filter(Boolean)
  const docTextById = new Map()
  for (const d of [...new Set(docPaths)]) {
    try {
      docTextById.set(d, readFileSync(resolve(ROOT, d), 'utf8'))
    } catch {
      docTextById.set(d, '')
    }
  }

  const faceReader = loadFace(ROOT, face)
  faceReader.prime(walkPaths(claims)) // 清单与内容同面同轮:一次把全部锚点文件读满

  const results = claims.map((c) => judgeClaim(c, faceReader))
  const rot = ledgerRot(claims, docTextById)
  const counts = { delivered: 0, 'still-open': 0, undetermined: 0 }
  for (const r of results) counts[r.verdict] += 1

  const rows = docPaths.reduce((acc, d) => acc.concat(parseDocRows(docTextById.get(d) || '')), [])
  const registered = new Set(claims.map((c) => c.id.replace(/^#/, '')))
  const coverage = { docRows: rows.length, claimsRegistered: claims.length, unregistered: rows.filter((r) => !registered.has(String(r.id))).length }

  if (flags.has('--json')) {
    console.log(JSON.stringify({ face, counts, coverage, rot, results }, null, 2))
  } else {
    console.log(`[对标交付核验] 判定面=${face}  登记表=${claimsPath}(${claims.length} 条已建子断言)`)
    for (const r of results) console.log(formatLine(r))
    for (const r of results)
      for (const o of r.observations || [])
        console.log(`     · 如实登记(不参与定性):${r.id} ${o.text} —— ${o.state === 'holds' ? '仍成立' : o.state === 'fails' ? '已不成立(登记表待更正)' : '判不出'}`)
    if (rot.length > 0) {
      console.log(`⚠️ 登记表与文档脱节 ${rot.length} 条:`)
      for (const x of rot) console.log(`     - ${x.id}:${x.reason}`)
    }
    if (coverage.docRows > 0)
      console.log(`覆盖面:${coverage.docRows} 条文档条目 / 已建断言 ${coverage.claimsRegistered} 条 / 未建档 ${coverage.unregistered} 条 —— 未建档的不是"已核对",是"还没判"`)
    console.log(`三态:已交付 ${counts.delivered} / 仍存在 ${counts['still-open']} / 判不出 ${counts.undetermined}(判不出绝不并入前两者)`)
    console.log('定级 warn:本尺子不在提交链上(它判文档与代码是否一致,与提交内容无关 ⇒ blocking 即恒红门)。')
  }

  if (flags.has('--strict') && (counts.undetermined > 0 || rot.length > 0)) {
    console.error('❌ --strict:存在判不出或台账腐烂 ⇒ 拒绝出具合格证')
    return 2
  }
  return 0
}

function selfTest() {
  const pass = []
  const fail = []
  const t = (name, cond) => (cond ? pass : fail).push(name)
  // 构造面:不依赖仓库瞬时状态(镜像 103 T12 那一课 —— 证明判据只能用纯函数 + 构造面)
  const mapFace = (files) => ({
    exists: (p) => typeof files[p] === 'string',
    read: (p) => (typeof files[p] === 'string' ? files[p] : null),
  })
  const anchor = (paths, regex, expect = 'present', minCount) => ({ paths, regex, expect, minCount })

  const A = evalAnchor(anchor(['a.py'], 'IMPLEMENTED_TASK_TYPES\\s*[:=]'), mapFace({ 'a.py': 'IMPLEMENTED_TASK_TYPES = {"x"}' }))
  t('① present 命中 ⇒ holds', A.state === 'holds' && A.hit.path === 'a.py')
  t('② present 命中数不足 ⇒ fails', evalAnchor(anchor(['a.py'], 'zzz'), mapFace({ 'a.py': 'nope' })).state === 'fails')
  t('③ 路径搬家:候选第二个命中 ⇒ holds 且点名用的是哪个', (() => {
    const r = evalAnchor(anchor(['pages/chat.tsx', 'pkg-ai/ai/chat.tsx'], 'export default'), mapFace({ 'pkg-ai/ai/chat.tsx': 'export default X' }))
    return r.state === 'holds' && r.hit.path === 'pkg-ai/ai/chat.tsx'
  })())
  t('④ 缺正则锚点 ⇒ 判不出(不是"仍存在")', evalAnchor({ paths: ['a.py'], regex: '' }, mapFace({ 'a.py': '' })).state === 'undetermined')
  t('⑤ 缺候选路径 ⇒ 判不出', evalAnchor({ paths: [], regex: 'x' }, mapFace({})).state === 'undetermined')
  t('⑥ absent 且全部候选确认取到过 ⇒ holds', evalAnchor(anchor(['a.py', 'b.py'], 'nope', 'absent'), mapFace({ 'a.py': 'x', 'b.py': 'y' })).state === 'holds')
  t('⑦ absent 但命中了 ⇒ fails(这就是"条目已过期")', evalAnchor(anchor(['a.py'], 'x', 'absent'), mapFace({ 'a.py': 'x' })).state === 'fails')
  t('⑦b 判 absent 而候选一个都没取到过 ⇒ holds 但必须能在报告里看出"是靠枚举确认的"', evalAnchor(anchor(['ghost.py'], 'x', 'absent'), mapFace({})).state === 'holds')
  t('⑧ minCount:数量判据有牙', (() => {
    const f = mapFace({ 't.py': 'async def a\nasync def b\nasync def c' })
    return evalAnchor(anchor(['t.py'], 'async def', 'present', 4), f).state === 'fails' && evalAnchor(anchor(['t.py'], 'async def', 'present', 3), f).state === 'holds'
  })())

  const claim = (assertions, observations) => ({ id: '#9', title: 'x', assertions, observations })
  t('⑨ 全 holds ⇒ delivered', judgeClaim(claim([{ text: 'p', anchors: [anchor(['a.py'], 'x')] }], undefined), mapFace({ 'a.py': 'x' })).verdict === 'delivered')
  t('⑩ 任一 fails ⇒ still-open', judgeClaim(claim([{ text: 'p', anchors: [anchor(['a.py'], 'nope')] }], undefined), mapFace({ 'a.py': 'x' })).verdict === 'still-open')
  t('⑪ 任一判不出 ⇒ 整条判不出(不得被别条的绿顶掉)', judgeClaim(claim([{ text: 'p', anchors: [{ paths: [], regex: '' }] }, { text: 'q', anchors: [anchor(['a.py'], 'x')] }], undefined), mapFace({ 'a.py': 'x' })).verdict === 'undetermined')
  t('⑫ observations 不参与定性(stub 半边仍成立也不得把 delivered 改成 still-open)', judgeClaim(claim([{ text: 'p', anchors: [anchor(['a.py'], 'x')] }], [{ text: 'stub 仍在', anchors: [anchor(['a.py'], 'x')] }]), mapFace({ 'a.py': 'x' })).verdict === 'delivered')
  t('⑬ 一条断言都没挂 ⇒ 判不出(空表不等于通过)', judgeClaim(claim([], []), mapFace({ 'a.py': 'x' })).verdict === 'undetermined')

  const doc = ['| 15 | 会话标题 | `chat.ts` 有 auto-title | ✅ |', '| 16 | 平滑渲染 | `x.ts` | ✅ |', '| 编号 | 名称 | 证据 | 状态 |'].join('\n')
  const rows = parseDocRows(doc)
  t('⑭ 表格行只认数字 id(表头行不算条目)', rows.length === 2 && rows[0].id === 15)

  const rot = ledgerRot([{ id: '#1', doc: 'd.md', docAnchor: '找不到的串' }], new Map([['d.md', '别的内容']]));
  t('⑮ docAnchor 找不到 ⇒ 台账腐烂点名', rot.length === 1 && /找不到/.test(rot[0].reason))
  const rot2 = ledgerRot([{ id: '#1', doc: 'd.md', docAnchor: '这条还在' }], new Map([['d.md', '……这条还在……']]));
  t('⑯ docAnchor 在位 ⇒ 不判腐烂(反向对照)', rot2.length === 0)
  const rot3 = ledgerRot([{ id: '#1', doc: 'd.md' }], new Map([['d.md', 'x']]));
  t('⑰ 缺内容锚点本身算腐烂(禁止拿行号当证据)', rot3.length === 1)

  console.log(`✅ ${pass.length} 条 / ❌ ${fail.length} 条`)
  for (const f of fail) console.log(`   ❌ ${f}`)
  return fail.length === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定:${e.message}(不冒红也不记绿)`)
      process.exit(2)
    }
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

// §22d:__test__ 的 export 必须在入口守卫之后(位置本身是判据,镜像测试 T2 钉着)。
export const __test__ = { anchorProblem, evalAnchor, evalAssertion, judgeClaim, parseDocRows, ledgerRot, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
