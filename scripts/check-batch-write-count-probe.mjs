#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 量尺探针为 CLI 工具,需 console 输出三态读数 */
/**
 * check-batch-write-count-probe.mjs — 守门 134 的 **B2 裸 SQL 维触发条件量尺**
 *
 * 这是什么(以及它**不是**什么):PROJECT_PLAN「守门 134 的两格条件性扩面」① 写了一条可判的触发条件
 *   「任一 ack 落点的最小函数体 `await` 了一个『体内含无 RETURNING 裸 SQL 写』的具名函数 ⇒ 必补」。
 *   那一票的处置是 **未达即不做**,所以它需要的不是判据而是一把**可以重跑的尺子**:没有它,下一次
 *   想扩这一维的人只能再人肉扫一遍,而人肉扫的结论不可复核(本仓最高频失效型:把"我没看见"写成"没有")。
 * 本文件因此**不参与提交链、不接 guardian-runner、不产出退出码 1 的违规清单**。它只出三态读数:
 *   命中(触发达成)/ 0 命中(未达)/ **判不出**(单独点名并报数,绝不并进"0 命中")。
 *
 * 三条口径(与门 134 同形,不得自创第四份):
 *  1. **判据的三件零件全部从 `check-batch-write-count-honesty.mjs` import**,本文件不写任何识别逻辑:
 *     ① ack 落点 = `findBooleanAckSends`(布尔档)与 `findCountSends`(计数档);
 *     ② 一跳 import 解析 = `parseImportBindings` + `planDelegatedAckSites`(后者内部用 `resolveModuleSpec`);
 *     ③ "缺 RETURNING 的裸 SQL 写" = `findRawSqlWriteChains`(第三十批那份唯一实现)。
 *     两处算同一件事必漂移 —— 这是本仓记过最多次的失败型,所以这里连"什么叫裸 SQL 写"都不重述。
 *  2. **取材面与门一致**:全量档判 HEAD blob;`--staged` 判索引 blob;`--worktree` 仅人工;两面旗同给
 *     判死;取不到 ⇒ **exit 2「无法判定」**,不回落另一个面(回落就是把"没判"写成"判过了")。
 *     内容一律经 `scripts/lib/face-reader.mjs` 的读取入口(`catBatch`),不散写 git 读正文(门 118)。
 *  3. **量法放宽到门自己不看的那一格**:门的 B2 会把"调用方体内自带 drizzle 写链"的落点**先交给 B1**
 *     (planDelegatedAckSites 的 allChains 过滤)。触发条件问的是"任一 ack 落点",不是"B2 会判的那几个",
 *     所以本探针把 `allChains` 传空数组 —— 复用同一份解析实现、只关掉那一层归属分流。放宽后的读数
 *     与门同源可比;若两把尺子各写一遍,"放宽"就会变成"另一把尺子"。
 *
 * 两把**互相独立**的尺子(只用一把,它自己瞎了看不出来):
 *   R1 委托路径:门 134 的 B2 落点集合 → 一跳被调**函数** → 该函数体内是否含无 RETURNING 裸 SQL 写。
 *   R2 边集合:全部含 ack 的文件 × 其全部具名 import(不看是否真被 await、不看 B1/B2 归属)
 *      → 解析到的**文件**里是否存在无 RETURNING 裸 SQL 写。R2 是 R1 的超集口径,两者结论不一致
 *      就说明其中一把在漏(所以两把都跑,且都印自己的数)。
 *   R2 落在"文件"粒度是刻意的:被调函数在文件内即可被 R1 精判,文件级只要**整份文件零裸 SQL 写**,
 *      就已蕴含"其中任何函数都零" ⇒ 否证不需要函数体切分,而切分正是最容易自己骗自己的一步。
 *
 * 如实登记的射程外那一格(不得读成"已确认没有"):门 134 的被调面锚定 `apps/api/src`。指向包外
 * (`@ihui/database` / `@ihui/shared` / 第三方)的具名 import 两把尺子都到不了 —— 本探针把它**单独计数
 * 并逐条报名**,另跑一次跨包面(`--cross-pkg` 默认开)量该面里"无 RETURNING 裸 SQL 写"的实际条数,
 * 让"盲区"与"盲区里有东西"是两件事。
 *
 * 用法:
 *   node scripts/check-batch-write-count-probe.mjs              # HEAD 面,三态读数
 *   node scripts/check-batch-write-count-probe.mjs --staged     # 索引面(与提交链同口径)
 *   node scripts/check-batch-write-count-probe.mjs --json       # 机器可读
 *   node scripts/check-batch-write-count-probe.mjs --self-test  # 正/反对照:证明这把尺子真有牙
 *
 * 退出码:0 = 触发未达成(命中 0 且判不出 0)/ 1 = **触发达成**(命中 ≥1,该补判据了)/
 *        2 = 无法判定(取不到面 / 枚举到 0 个候选 / 存在"判不出"⇒ 拒绝出具合格证)。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  findBooleanAckSends,
  findCountSends,
  findRawSqlWriteChains,
  indexExportedFns,
  listCandidates,
  listFacePaths,
  maskText,
  parseImportBindings,
  planDelegatedAckSites,
  moduleSpecCandidates,
} from './check-batch-write-count-honesty.mjs'
import {
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  Undetermined,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const SELF = 'check-batch-write-count-probe'
/** 跨包盲区量测的落点(只量"里面有没有货",不参与三态判定)。 */
export const CROSS_PKG_DIRS = ['packages/database/src', 'packages/shared/src/utils']
const TS_RE = /\.(ts|mts|cts)$/

/* ----------------------------- 取材(同面同轮) ----------------------------- */

/** 一次 cat-file --batch 读满一面;取不到即抛 —— 不回落另一个面。 */
function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (typeof t !== 'string') throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (t === null || t === undefined)
      throw new Undetermined(`${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${p} ⇒ 不回落另一个面`)
    map.set(p, t)
  })
  return map
}

/* --------------------------------- 两把尺子 --------------------------------- */

/**
 * 一把尺子的实现:把"哪些文件里有无 RETURNING 的裸 SQL 写"算成集合 W。
 * 复用 findRawSqlWriteChains(唯一实现),跑在"剥注释、保留字符串"那一档 —— 与门 134 的取材同档,
 * 因为 RETURNING 就住在模板串里,连字符串一起抹等于把它抹掉。
 */
function buildWriterSet(texts) {
  const w = new Map()
  for (const [p, t] of texts) {
    if (!TS_RE.test(p)) continue
    const nb = maskText(t, { blankStrings: false }).text
    const pool = findRawSqlWriteChains(nb)
    const noRet = pool.chains.filter((c) => !c.hasReturning)
    if (noRet.length) w.set(p, noRet.length)
  }
  return w
}

/**
 * R1:门 134 的 B2 落点集合,放宽到"全部 ack 落点"(allChains 传空)后逐条跑一跳。
 * @returns {{sites:number, needs:number, hits:Array, noWrite:number, confirmed:number, undetermined:Array}}
 */
function runDelegationRuler({ candPaths, candTexts, known, calleeTexts, widenedTo = 'boolean' }) {
  const out = { sites: 0, needs: 0, hits: [], noWrite: 0, confirmed: 0, undetermined: [] }
  for (const p of candPaths) {
    const text = candTexts.get(p)
    const code = maskText(text).text
    const nb = maskText(text, { blankStrings: false }).text
    const rawLines = text.split(/\r?\n/)
    const acks = widenedTo === 'count' ? findCountSends(code) : findBooleanAckSends(code)
    if (!acks.length) continue
    const imports = parseImportBindings(nb, code)
    // allChains = [] ⇒ 关掉门的"归 B1"归属分流,量的是**全部** ack 落点(见头注第 3 条口径)
    const plan = planDelegatedAckSites(p, code, rawLines, acks, [], imports, known, nb)
    for (const site of plan.sites) {
      out.sites++
      if (site.confirmedBy) {
        out.confirmed++ // 调用方自带库答复(raw SQL RETURNING / 同响应诚实载体)⇒ 这一处不靠那一跳
        continue
      }
      for (const u of site.undetermined)
        out.undetermined.push({
          file: p,
          line: site.line,
          why: `那一跳解析不到:${u.kind}(${u.name || u.specifier || ''})`,
        })
      for (const n of site.needs) {
        out.needs++
        const t = calleeTexts.get(n.path)
        if (t === undefined) {
          out.undetermined.push({ file: p, line: site.line, why: `被调正文取不到:${n.path}` })
          continue
        }
        const nbCallee = maskText(t, { blankStrings: false }).text
        const pool = findRawSqlWriteChains(nbCallee)
        const noRet = pool.chains.filter((c) => !c.hasReturning)
        if (!noRet.length) {
          if (pool.unparsed.length)
            out.undetermined.push({
              file: p,
              line: site.line,
              why: `被调文件 ${n.path} 有 ${pool.unparsed.length} 处 execute 括号配平不到 ⇒ 判不了`,
            })
          else out.noWrite++
          continue
        }
        // 文件里确实有无 RETURNING 的裸 SQL 写 ⇒ 再落到函数体一级(R1 的精确判据)
        const idxBlank = indexExportedFns(maskText(t).text)
        const idxRaw = indexExportedFns(nbCallee)
        if (!idxBlank.byName.has(n.name) && !idxBlank.reexportNames.has(n.name)) {
          out.undetermined.push({
            file: p,
            line: site.line,
            why: `被调 ${n.name} 在 ${n.path} 未索引到(遮蔽面)⇒ 判不了那一跳`,
          })
          continue
        }
        const body = idxRaw.byName.get(n.name)
        if (!body) {
          out.undetermined.push({
            file: p,
            line: site.line,
            why: `${n.path} 里 ${n.name} 的函数体在「保留字符串」档切不出 ⇒ 判不了`,
          })
          continue
        }
        const inBody = findRawSqlWriteChains(body.bodyText).chains.filter((c) => !c.hasReturning)
        if (inBody.length)
          out.hits.push({ file: p, line: site.line, key: site.key, callee: n.path, name: n.name })
        else out.noWrite++
      }
    }
  }
  return out
}

/** R2:全部含 ack 的文件 × 全部具名 import(不看 await 形态、不看归属)→ 边是否落进 W。 */
function runEdgeRuler({ candPaths, candTexts, known, writers }) {
  const out = { ackFiles: 0, edges: [], outside: [] }
  for (const p of candPaths) {
    const text = candTexts.get(p)
    const code = maskText(text).text
    const nb = maskText(text, { blankStrings: false }).text
    if (!findBooleanAckSends(code).length && !findCountSends(code).length) continue
    out.ackFiles++
    const imports = parseImportBindings(nb, code)
    for (const [, b] of imports.named) {
      const r = moduleSpecCandidates(b.specifier, p)
      if (r.outside) {
        out.outside.push({ from: p, specifier: b.specifier, exported: b.exported })
        continue
      }
      const hit = r.candidates.find((c) => known.has(c))
      if (hit && writers.has(hit))
        out.edges.push({
          from: p,
          to: hit,
          exported: b.exported,
          noReturningWrites: writers.get(hit),
        })
    }
  }
  return out
}

/** 跨包盲区里到底有没有货(量它,但**不**并进三态 —— 它在门的射程外)。 */
function measureBlindSpot(root, face) {
  let paths = []
  try {
    const out =
      face === 'staged'
        ? gitRaw(['ls-files', '-z', '--', ...CROSS_PKG_DIRS], root)
        : gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...CROSS_PKG_DIRS], root)
    paths = String(out)
      .split('\0')
      .filter((p) => TS_RE.test(p))
  } catch (e) {
    return { ok: false, why: `枚举失败:${e?.message ?? e}` }
  }
  const texts = readFace(root, face, paths)
  const writers = buildWriterSet(texts)
  return {
    ok: true,
    files: paths.length,
    read: texts.size,
    writerFiles: writers.size,
    writes: [...writers.values()].reduce((a, b) => a + b, 0),
  }
}

/* ---------------------------------- 主流程 ---------------------------------- */

export function measure(root, face) {
  const candPaths = listCandidates(root, face)
  if (!candPaths.length)
    throw new Undetermined(
      `${face} 面在门 134 覆盖面上枚举到 0 个候选 ⇒ 判据失效,不计通过也不计"未达"`,
    )
  const candTexts = readFace(root, face, candPaths)
  const known = listFacePaths(root, face)
  const knownTexts = readFace(
    root,
    face,
    [...known].filter((p) => TS_RE.test(p)),
  )
  const writers = buildWriterSet(knownTexts)
  // 需要读的被调文件集合必须按**两把尺子各自的 ack 集**一起算:只按布尔档算会让计数档的那些一跳
  // 全部读不到正文 ⇒ 22 处"被调正文取不到"是我自己造出来的假判不出(第一版就是这么错的)。
  const needs = new Set()
  for (const kind of ['boolean', 'count']) {
    for (const p of candPaths) {
      const text = candTexts.get(p)
      const code = maskText(text).text
      const nb = maskText(text, { blankStrings: false }).text
      const acks = kind === 'count' ? findCountSends(code) : findBooleanAckSends(code)
      if (!acks.length) continue
      const plan = planDelegatedAckSites(
        p,
        code,
        text.split(/\r?\n/),
        acks,
        [],
        parseImportBindings(nb, code),
        known,
        nb,
      )
      for (const n of plan.needs) needs.add(n.path)
    }
  }
  const calleeTexts = new Map([...knownTexts].filter(([p]) => needs.has(p)))
  if (calleeTexts.size !== needs.size)
    throw new Undetermined(
      `需要读的被调文件 ${needs.size} 个,面上只取到 ${calleeTexts.size} 个 ⇒ 判不出被冒充成"读过",不出读数`,
    )
  return {
    face,
    scanned: candPaths.length,
    calleeFilesRead: calleeTexts.size,
    writerFiles: writers.size,
    writerWrites: [...writers.values()].reduce((a, b) => a + b, 0),
    r1: runDelegationRuler({ candPaths, candTexts, known, calleeTexts, widenedTo: 'boolean' }),
    r1count: runDelegationRuler({ candPaths, candTexts, known, calleeTexts, widenedTo: 'count' }),
    r2: runEdgeRuler({ candPaths, candTexts, known, writers }),
    blind: measureBlindSpot(root, face),
  }
}

export function verdictOf(m) {
  const hits = [...m.r1.hits, ...m.r1count.hits, ...m.r2.edges]
  const undet = [...m.r1.undetermined, ...m.r1count.undetermined]
  return { hits, undet }
}

export function formatReport(m) {
  const { hits, undet } = verdictOf(m)
  const L = []
  L.push(
    `取材面:${m.face === 'staged' ? '索引 blob' : m.face === 'worktree' ? '工作树(人工)' : 'HEAD blob'}`,
  )
  L.push(
    `门 134 覆盖文件 ${m.scanned} 个;面上含「无 RETURNING 裸 SQL 写」的文件 ${m.writerFiles} 个 / ${m.writerWrites} 处`,
  )
  L.push(
    `R1 委托路径(布尔 ack,已放宽掉 B1 归属分流):落点 ${m.r1.sites} / 一跳 ${m.r1.needs} / 命中 ${m.r1.hits.length} / 一跳内无该写 ${m.r1.noWrite} / 调用方自带答复 ${m.r1.confirmed} / 判不出 ${m.r1.undetermined.length}`,
  )
  L.push(
    `R1' 同一把尺子跑计数档 ack:落点 ${m.r1count.sites} / 一跳 ${m.r1count.needs} / 命中 ${m.r1count.hits.length} / 一跳内无该写 ${m.r1count.noWrite} / 调用方自带答复 ${m.r1count.confirmed} / 判不出 ${m.r1count.undetermined.length}`,
  )
  L.push(
    `R2 边集合(全部 ack 文件 × 全部具名 import,不看 await 形态):ack 文件 ${m.r2.ackFiles} 个 / 落进「有无 RETURNING 裸 SQL 写」那张集的边 ${m.r2.edges.length}`,
  )
  if (m.blind.ok)
    L.push(
      `射程外(不计入三态,单独报名):跨包 ${CROSS_PKG_DIRS.join(' + ')} 共 ${m.blind.files} 文件(读到 ${m.blind.read}),其中无 RETURNING 裸 SQL 写 ${m.blind.writes} 处`,
    )
  else L.push(`射程外那面**未判定**:${m.blind.why}`)
  for (const h of hits)
    L.push(
      `  ⚠️ 命中:${h.file}:${h.line}${h.key ? ` [${h.key}]` : ''} ⇒ 被调 ${h.callee || h.to}#${h.name || h.exported}`,
    )
  for (const u of undet) L.push(`  判不出:${u.file}:${u.line} — ${u.why}`)
  for (const e of m.r2.edges)
    L.push(
      `  R2 边:${e.from} ⇒ ${e.to}(#${e.exported},该文件含 ${e.noReturningWrites} 处无 RETURNING 写)`,
    )
  L.push(
    hits.length
      ? `结论:**触发条件达成**(${hits.length} 处)⇒ 该给 B2 接裸 SQL 维了。`
      : undet.length
        ? `结论:命中 0,但有 ${undet.length} 处判不出 ⇒ 可达性**未证明也未否证**,不出合格证。`
        : `结论:命中 0 且判不出 0 ⇒ **触发条件未达成**,按票面「未达即不做」。`,
  )
  if (m.r2.outside.length) {
    const by = new Map()
    for (const o of m.r2.outside) by.set(o.specifier, (by.get(o.specifier) || 0) + 1)
    L.push(
      `两把尺子都到不了的一跳(包外/第三方,报名不判):${[...by]
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${s}×${n}`)
        .join(' ')}`,
    )
  }
  return L
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  assertRepoRoot(ROOT, SELF)
  const both = argv.includes('--staged') && argv.includes('--worktree')
  if (both) {
    console.error(`[${SELF}] --staged 与 --worktree 不得同给`)
    return 2
  }
  const face = argv.includes('--staged')
    ? 'staged'
    : argv.includes('--worktree')
      ? 'worktree'
      : 'head'
  let m
  try {
    m = measure(ROOT, face)
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`[${SELF}] 无法判定:${e.message}`)
      return 2
    }
    throw e
  }
  if (argv.includes('--json')) console.log(JSON.stringify(m, null, 2))
  else for (const line of formatReport(m)) console.log(`[${SELF}] ${line}`)
  const { hits, undet } = verdictOf(m)
  if (hits.length) return 1
  if (undet.length || !m.blind.ok) return 2
  return 0
}

/* ---------------------------------- 自检 ---------------------------------- */

const CALLER_NO_RET = [
  "import { success } from '../utils/envelope.js'",
  "import { purgeRows } from '../db/probe-callee.js'",
  'server.delete(basePath, async (request, reply) => {',
  '  const ids = request.body.ids',
  '  await purgeRows(ids)',
  '  return reply.send(success({ deleted: true }))',
  '})',
].join('\n')
/** 被调体:一条**没有 RETURNING** 的裸 SQL 写 —— 这正是触发条件要问的形状。 */
const CALLEE_NO_RET = [
  "import { db } from './index.js'",
  "import { sql } from 'drizzle-orm'",
  'export async function purgeRows(ids) {',
  '  await db.execute(sql`DELETE FROM probe_t WHERE id = ${ids[0]}`)',
  '  return ids.length',
  '}',
].join('\n')
/** 成对反例:同一条写**带上 RETURNING** ⇒ 尺子必须归零(否则它把"已诚实"也算成命中)。 */
const CALLEE_RETURNING = CALLEE_NO_RET.replace(
  'WHERE id = ${ids[0]}`',
  'WHERE id = ${ids[0]} RETURNING id`',
)

/** 归因对照:被调文件里**另有一个函数**带着无 RETURNING 的裸 SQL 写,而 awaited 那一个是干净的。
 *  没有这一条,文件级的"有坏写就算命中"与函数级的"命中必须在被调体内"在账面上长得一模一样。 */
const CALLEE_OTHER_FN_BAD = `${CALLEE_RETURNING}\nexport async function otherDirty() {\n  await db.execute('DELETE FROM probe_other WHERE 1=1')\n}\n`

export function runRulerOnPair(
  callerText,
  calleeText,
  calleePath = 'apps/api/src/db/probe-callee.ts',
) {
  const callerPath = 'apps/api/src/routes/probe-caller.ts'
  const known = new Set([callerPath, calleePath])
  const candTexts = new Map([[callerPath, callerText]])
  const calleeTexts = new Map([[calleePath, calleeText]])
  return runDelegationRuler({
    candPaths: [callerPath],
    candTexts,
    known,
    calleeTexts,
    widenedTo: 'boolean',
  })
}

function selfTest() {
  const R = []
  const t = (name, cond, extra = '') =>
    R.push(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${extra}`}`)
  // ① 阳性对照:尺子必须**认得**它立项那一型(缺这一条,"0 命中"就可能是"尺子瞎了")
  const pos = runRulerOnPair(CALLER_NO_RET, CALLEE_NO_RET)
  t(
    'P1 触发形状必命中(ack → await 具名函数 → 体内无 RETURNING 裸 SQL 写)',
    pos.hits.length === 1,
    `实得 ${pos.hits.length}`,
  )
  t(
    'P2 命中要点到被调文件与导出名',
    pos.hits[0]?.name === 'purgeRows' && pos.hits[0]?.callee?.includes('probe-callee'),
    JSON.stringify(pos.hits),
  )
  t(
    'P3 阳性对照不得同时记成"判不出"',
    pos.undetermined.length === 0,
    JSON.stringify(pos.undetermined),
  )
  // ② 反向对照:同一条写带 RETURNING ⇒ 归零(否则尺子把已诚实的形状也算命中)
  const neg = runRulerOnPair(CALLER_NO_RET, CALLEE_RETURNING)
  t('N1 带 RETURNING 的同一形状必归零', neg.hits.length === 0, JSON.stringify(neg.hits))
  t(
    'N2 且落点仍被扫到(证明是判成"放过"而不是"没看见")',
    neg.sites === 1 && neg.noWrite === 1,
    JSON.stringify({ s: neg.sites, n: neg.noWrite, u: neg.undetermined }),
  )
  // ③ 遮蔽档对照:RETURNING 住在模板串里 ⇒ 尺子必须跑在"保留字符串"那一档
  const bare = runRulerOnPair(
    CALLER_NO_RET,
    CALLEE_NO_RET.replace('WHERE id = ${ids[0]}`', 'WHERE 1=1`'),
  )
  t(
    'N3 无 WHERE 也无 RETURNING 的那条写同样算命中(判据不看 WHERE)',
    bare.hits.length === 1,
    JSON.stringify(bare.hits),
  )
  // ⑤ 归因对照:坏写在**同文件的另一个函数**里 ⇒ 不得算成这一跳的命中,也不算未判定
  const misplaced = runRulerOnPair(CALLER_NO_RET, CALLEE_OTHER_FN_BAD)
  t(
    'A1 坏写落在别的函数体时不得判命中(文件级"有坏写"不等于"那一跳有")',
    misplaced.hits.length === 0,
    JSON.stringify(misplaced.hits),
  )
  t(
    'A2 且它也不得被记成"判不出"—— 归因成功、结论是干净',
    misplaced.undetermined.length === 0 && misplaced.noWrite === 1,
    JSON.stringify({ n: misplaced.noWrite, u: misplaced.undetermined }),
  )
  // ④ 解析不到必须落"判不出",不得静算 0
  const broken = runRulerOnPair(
    CALLER_NO_RET,
    CALLEE_NO_RET.replace('export async function purgeRows', 'async function purgeRows'),
    'apps/api/src/db/other.ts',
  )
  t(
    'U1 被调未导出/取不到时落未判定而不是 0 命中',
    broken.hits.length === 0 && broken.undetermined.length + broken.noWrite >= 1,
    JSON.stringify(broken),
  )
  const failed = R.filter((r) => r.startsWith('❌')).length
  for (const r of R) console.log(`[${SELF}] ${r}`)
  console.log(
    `[${SELF}] ${failed ? `❌ self-test 失败 ${failed}/${R.length}` : `✅ self-test 全通过(${R.length} 条)`}`,
  )
  return failed ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`[${SELF}] 脚本自身异常:${e?.message}\n${e?.stack}`)
    process.exitCode = 2
  }
}

export const __test__ = { runRulerOnPair, measure, verdictOf, formatReport, SELF }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
