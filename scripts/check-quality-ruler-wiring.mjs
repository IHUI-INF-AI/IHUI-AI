#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 328:私有质量尺子的接线与保密(2026-11-26 立,RP-45)。
 *
 * ## 立因
 * 这把尺子的全部价值系在两件事上,而两件事都会**安静地坏掉**:
 *   ① **接线** —— 尺子代码在仓里但没人调用 = "造好没装车",按 AGENTS §0.9 等于没有。
 *      上一轮实测已经撞到同型:`gates.ticketWhitelistNote` 记着判据面票落不了账,而尺子若
 *      从自主环被摘掉,台账会退回"每轮只有 dispatched、零质量读数"——正是这张票要治的病。
 *   ② **保密** —— 原文靠"Swarm 不知道评测存在"防过拟合。题库一旦落进工作树/索引,
 *      自治会话 `git grep` 一遍就能背题,整条外部尺子退化成自我打分。
 * 两类失效都不报错:摘一行调用,程序照跑;题目进一个文件,提交照样绿。
 *
 * ## 判据
 *   Q1 接线存续:被审面必须**同时**满足 —— lib `scripts/lib/autonomy-quality.mjs` 在册;
 *      `scripts/auto-evolve.mjs` 文本含 `autonomy-quality.mjs` 导入 + 四处真实调用
 *      (`resolveQualityConfig(` / `runRuler(` / `buildQualityLedgerRow(` / `readQualityHold(`)。
 *      少任一处 ⇒ red 并点名缺的那枚(被摘的是哪一腿,直接说清)。
 *   Q2 题库保密:被审面不得出现名为 `pairwise-dataset.jsonl` / `pairwise-trend.jsonl` 的路径。
 *      (路径字符串散见于装载器/文档是**合法**的 —— 本判据只看文件名是否真入库。)
 *   Q3 单一入口:`scripts/` 下的 .mjs 里,除白名单(装载器/接线宿主/本门/镜像测试)外
 *      不得出现**第二个尺子调用口** —— 判据是形状而非裸字面:同段代码既拼 `private_eval_run`
 *      又拼 `--version`(= 它在起尺子),或既 import 唯一宿主 lib 又调它的编排出口(= 第二个宿主)。
 *      只提路径字面量的文本(注册表提示、文档、排障指引)不判 —— 首版按裸字面判红,
 *      当场把本门自己的 onFailHint 打成 finding:提示越具体门越红,那是逼人删说明(§0.10)。
 *
 * ## 面纪律(§0.4)
 * 全量档判 **HEAD blob**;`--staged` 判**索引 blob**;两面旗同给 ⇒ 用法错 exit 2;
 * 只在人工排查时用 `--worktree`。blob 取不到 / 面列不出来 ⇒ **exit 2 未判定**,
 * 绝不把"没读到"记成"没违规"(§0.3),也不回落另一个面(§0.4)。
 * 取材一律走 `./lib/face-reader.mjs`,本门不自写 `git show`(§0.6)。
 *
 * ## 用法与出口
 *   node scripts/check-quality-ruler-wiring.mjs [--staged] [--worktree] [--self-test] [--quiet]
 *   退出: 0 通过 / 1 命中违规 / 2 无法判定或用法错
 *   应急: HUSKY_SKIP_QUALITY_RULER_WIRING=1(跳门须附定向说明,§0.10)
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { assertRepoRoot, catBatch, hideComments, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

export const SKIP_ENV = 'HUSKY_SKIP_QUALITY_RULER_WIRING'

export const WIRING_HOST = 'scripts/auto-evolve.mjs'
export const WIRING_LIB = 'scripts/lib/autonomy-quality.mjs'

/** 宿主必须真调用到的四处 lib 出口(少一枚 = 那一腿被摘了)。 */
export const REQUIRED_HOST_TOKENS = Object.freeze([
  'autonomy-quality.mjs',
  'resolveQualityConfig(',
  'runRuler(',
  'buildQualityLedgerRow(',
  'readQualityHold(',
])

/** 真入库即泄题的文件名(装载器/文档里提到这些字符串不算)。 */
export const SECRET_BASENAMES = Object.freeze(['pairwise-dataset.jsonl', 'pairwise-trend.jsonl'])

/** 尺子入口字面:除白名单外第二处**调用口**即违规(纯提及路径名不算)。 */
export const ENTRY_LITERALS = Object.freeze(['pairwise_eval', 'private_eval_run', 'PRIVATE_EVAL_DIR'])

/**
 * 什么才算"第二个入口"(2026-11-26 收紧,本门自己踩过一次宽判据):
 *   S3a 同一段代码里既拼了尺子脚本名、又拼了 CLI 旗标 `--version` ⇒ 它在**起**尺子;
 *   S3b 同一段代码里既 import 了唯一宿主 lib、又调用了它的编排出口 ⇒ 它是第二个宿主。
 * 只出现路径字面量的文本(注册表 onFailHint、文档、注释、排障指引)**不算入口** ——
 * 首版按裸字面判红,当场把刚注册的门 body 自己的提示文案打成了 finding:提示写得越具体,
 * 门越红,那是逼人去删提示,方向完全反了(§0.10 失效方向不能是"少写说明")。
 */
export const SECOND_LAUNCH_RE = /(?:private_eval_run|pairwise_eval)[\s\S]{0,240}?--version|--version[\s\S]{0,240}?(?:private_eval_run|pairwise_eval)/
export const SECOND_HOST_RE = /lib\/autonomy-quality\.mjs[\s\S]{0,400}?(?:runRuler|resolveQualityConfig|readQualityHold)\s*\(|(?:runRuler|resolveQualityConfig|readQualityHold)\s*\([\s\S]{0,400}?lib\/autonomy-quality\.mjs/

/** 唯一持有入口字面的一小组文件(改名/下线必须同批改这里)。 */
export const ENTRY_ALLOWLIST = Object.freeze([
  'scripts/lib/autonomy-quality.mjs',
  WIRING_HOST,
  'scripts/check-quality-ruler-wiring.mjs',
  'scripts/tests/autonomy-quality.test.mjs',
  'scripts/tests/check-quality-ruler-wiring.test.mjs',
])

const C = { red: '\u001b[31m', green: '\u001b[32m', yellow: '\u001b[33m', dim: '\u001b[2m', reset: '\u001b[0m' }

/* ============================ 纯判据(供自检与镜像) ============================ */

/** Q1:接线在不在。hostText 为 null ⇒ 未判定(读不到面 ≠ 被摘线)。 */
export function judgeWiring({ libPresent, hostText, hostPresent }) {
  if (!hostPresent || hostText === null || hostText === undefined) {
    return { state: 'undetermined', missing: [], why: `${WIRING_HOST} 的 blob 取不到 ⇒ 无法判定接线是否还在` }
  }
  const missing = []
  if (!libPresent) missing.push(`${WIRING_LIB}(lib 本体不在册)`)
  for (const tok of REQUIRED_HOST_TOKENS) if (!hostText.includes(tok)) missing.push(`宿主缺 ${tok}`)
  if (missing.length) return { state: 'finding', missing, why: `质量尺子接线被拆:少 ${missing.length} 处` }
  return { state: 'ok', missing: [], why: '' }
}

/** Q2:题库文件有没有真入库(只看 basename,不看提及它的字符串/文档)。 */
export function judgeSecrecy(paths) {
  const hits = paths.filter((p) => SECRET_BASENAMES.includes(path.posix.basename(p)))
  if (hits.length) return { state: 'finding', hits, why: `私有题库/趋势账被写进被审面 ⇒ 自治会话能背题(保密轴失效)` }
  return { state: 'ok', hits: [], why: '' }
}

/** Q3:除白名单外的第二处尺子入口。注释先遮罩(文档式提及不该判红)。 */
export function judgeSingleEntry(entries) {
  const allow = new Set(ENTRY_ALLOWLIST)
  const offenders = []
  const unreadable = []
  for (const [rel, text] of Object.entries(entries)) {
    if (!rel.startsWith('scripts/') || !rel.endsWith('.mjs') || allow.has(rel)) continue
    if (text === null || text === undefined) {
      unreadable.push(rel)
      continue
    }
    let masked
    try {
      masked = hideComments(text)
    } catch {
      masked = text
    }
    const launched = SECOND_LAUNCH_RE.test(String(masked))
    const hosted = SECOND_HOST_RE.test(String(masked))
    if (launched || hosted) {
      offenders.push({ rel, kind: launched && hosted ? 'both' : launched ? 'launch' : 'host', literals: ENTRY_LITERALS.filter((lit) => String(masked).includes(lit)) })
    }
  }
  if (offenders.length) return { state: 'finding', offenders, unreadable, why: `出现第二处尺子入口 ⇒ 两个真相入口必漂(${offenders.map((o) => o.rel).join(', ')})` }
  if (unreadable.length) return { state: 'undetermined', offenders: [], unreadable, why: `${unreadable.length} 份脚本在册但正文取不到 ⇒ Q3 未判定(不拿"读不到"冒充"没违规")` }
  return { state: 'ok', offenders: [], unreadable, why: '' }
}

/* ================================ 自检夹具 ================================ */

const GOOD_HOST = [
  `import { runRuler, readQualityHold } from './lib/autonomy-quality.mjs'`,
  'gates.quality = resolveQualityConfig(g)',
  'const qr = runRuler({ mode, root, version })',
  'record({ ...buildQualityLedgerRow({ verdict }), ticketKey: key })',
  'const hold = readQualityHold(qualityHoldPath(ROOT))',
].join('\n')

export function selfTest() {
  const cases = []
  const add = (name, cond) => cases.push({ name, pass: Boolean(cond) })

  add('ST1 接线齐备 ⇒ ok', judgeWiring({ libPresent: true, hostText: GOOD_HOST, hostPresent: true }).state === 'ok')
  add('ST2 摘掉 runRuler 调用 ⇒ finding 且点名', JSON.stringify(judgeWiring({ libPresent: true, hostText: GOOD_HOST.replace('runRuler(', ''), hostPresent: true })).includes('runRuler('))
  add('ST2b 缺 lib ⇒ finding 点名 lib', judgeWiring({ libPresent: false, hostText: GOOD_HOST, hostPresent: true }).state === 'finding')
  add('ST3 宿主 blob 取不到 ⇒ 未判定(不冒红也不冒绿)', judgeWiring({ libPresent: true, hostText: null, hostPresent: true }).state === 'undetermined')
  add('ST4 题库入库 ⇒ finding', judgeSecrecy(['x', 'apps/ai-service/pairwise-dataset.jsonl']).state === 'finding')
  add('ST4b 仅文档提及路径名 ⇒ ok(不误伤说明文字)', judgeSecrecy(['apps/ai-service/app/services/private_eval_store.py', 'README.md']).state === 'ok')
  add('ST5 第二处真在拼尺子 argv ⇒ finding', judgeSingleEntry({ 'scripts/others.mjs': "const r = spawnSync('python', ['apps/ai-service/scripts/private_eval_run.py', '--version', sha])" }).state === 'finding')
  add('ST5e 第二处宿主(import 宿主 lib 并调编排出口)⇒ finding', judgeSingleEntry({ 'scripts/another-host.mjs': "import { runRuler } from './lib/autonomy-quality.mjs'\nrunRuler({ mode, root })" }).state === 'finding')
  add('ST5b 注释里的入口 ⇒ 遮罩后不判(负对照)', judgeSingleEntry({ 'scripts/others.mjs': `// 参见 pairwise_eval 的说明\nconst x = 1` }).state === 'ok')
  add('ST5d 提示文本裸提路径 ⇒ 不判(本门首版误伤自己的 onFailHint,这一条钉住不回潮)', judgeSingleEntry({ 'scripts/guardian-runner.mjs': "label: 'x', onFailHint: ['把 pairwise_eval.py 的 detect_regression 当唯一真相源', '出路:把 pairwise-dataset.jsonl 移出仓库(见 README)']" }).state === 'ok')
  add('ST5c 白名单内的唯一入口 ⇒ ok', judgeSingleEntry({ [WIRING_LIB]: "const s = 'apps/ai-service/scripts/private_eval_run.py'" }).state === 'ok')
  add('ST6 在册但取不到正文 ⇒ 未判定(绝不冒绿)', judgeSingleEntry({ 'scripts/others.mjs': null }).state === 'undetermined')
  add('ST6b 取不到正文 + 白名单内正常 ⇒ 仍只报未判定不判红', (() => {
    const r = judgeSingleEntry({ 'scripts/others.mjs': null, [WIRING_LIB]: 'pairwise_eval' })
    return r.state === 'undetermined' && r.offenders.length === 0
  })())

  const bad = cases.filter((c) => !c.pass)
  for (const c of cases) console.log(`${c.pass ? '  ✓' : '  ✗'} ${c.name}`)
  console.log(bad.length === 0 ? `[gate-328] SELF-TEST PASS ${cases.length}/${cases.length}` : `[gate-328] SELF-TEST FAIL ${bad.length}/${cases.length}`)
  return bad.length === 0 ? 0 : 1
}

/* =============================== 真跑取材 =============================== */

function readEntries(root, face, rels) {
  if (face === 'worktree') {
    const out = {}
    for (const rel of rels) {
      let t = null
      try {
        t = readWorktreeFile(root, rel)
      } catch {
        t = null
      }
      out[rel] = t === undefined ? null : t
    }
    return out
  }
  const rev = face === 'head' ? 'HEAD' : ''
  const specs = rels.map((r) => `${rev}:${r}`)
  const map = catBatch(root, specs, {})
  const out = {}
  for (const [rel, spec] of rels.map((r) => [r, `${rev}:${r}`])) out[rel] = map.get(spec) ?? null
  return out
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const quiet = argv.includes('--quiet')
  const say = (...a) => !quiet && console.log(...a)

  const pick = selectFace({ staged, worktree, def: 'head' })
  if (pick.error) {
    console.error(`❌ 用法错:${pick.error}(§0.4:取不到唯一面就不判)`)
    process.exit(2)
  }
  const face = pick.face

  if (process.env[SKIP_ENV] === '1') {
    console.log(`${C.yellow}⚠ 门 328 被 ${SKIP_ENV}=1 跳过:接线/保密两轴本轮**未判定**,须补定向说明(§0.10)${C.reset}`)
    process.exit(0)
  }

  try {
    assertRepoRoot(ROOT, '门 328')
  } catch (e) {
    console.error(`❌ 未判定:仓根不可问(${String(e?.message ?? e).slice(0, 120)})`)
    process.exit(2)
  }

  let files
  try {
    files = listFaceFiles(ROOT, face)
  } catch (e) {
    console.error(`❌ 未判定:${face} 面列不出来(${String(e?.message ?? e).slice(0, 160)})⇒ 不记绿也不冒红`)
    process.exit(2)
  }
  if (!Array.isArray(files) || files.length === 0) {
    console.error(`❌ 未判定:${face} 面枚举到 0 个文件(§0.3:枚举到 0 不记绿)`)
    process.exit(2)
  }

  const candidateRels = files.filter(
    (p) => (p.endsWith('.mjs') && p.startsWith('scripts/')) || p === WIRING_HOST || p === WIRING_LIB,
  )
  let entries
  try {
    entries = readEntries(ROOT, face, candidateRels)
  } catch (e) {
    console.error(`❌ 未判定:blob 批量取失败(${String(e?.message ?? e).slice(0, 160)})⇒ 面在但读不到,不判绿`)
    process.exit(2)
  }

  const hostPresent = files.includes(WIRING_HOST)
  const libPresent = files.includes(WIRING_LIB)
  const q1 = judgeWiring({ libPresent, hostPresent, hostText: entries[WIRING_HOST] ?? null })
  const q2 = judgeSecrecy(files)
  const q3 = judgeSingleEntry(entries)

  const undetermined = [q1, q3].filter((r) => r.state === 'undetermined')
  const findings = [
    ['Q1', q1],
    ['Q2', q2],
    ['Q3', q3],
  ].filter(([, r]) => r.state === 'finding')

  say(`${C.dim}[gate-328] 面=${face} 在册 ${files.length} 文件 / 送判 ${candidateRels.length} 份脚本${C.reset}`)
  for (const [id, r] of [['Q1', q1], ['Q2', q2], ['Q3', q3]]) {
    const mark = r.state === 'ok' ? `${C.green}ok${C.reset}` : r.state === 'finding' ? `${C.red}finding${C.reset}` : `${C.yellow}undetermined${C.reset}`
    say(`  ${id} ${mark} ${r.why || ''}`)
  }

  if (findings.length) {
    for (const [id, r] of findings) {
      if (id === 'Q1') console.error(`${C.red}❌ [gate-328] Q1 接线被拆:${r.missing.join('; ')}${C.reset}`)
      if (id === 'Q2') console.error(`${C.red}❌ [gate-328] Q2 题库泄进被审面:${r.hits.slice(0, 6).join(', ')}${r.hits.length > 6 ? ` …共 ${r.hits.length} 枚` : ''}${C.reset}`)
      if (id === 'Q3') console.error(`${C.red}❌ [gate-328] Q3 第二入口:${r.offenders.map((o) => `${o.rel}(${o.literals.join('+')})`).join(', ')}${C.reset}`)
    }
    console.error(
      `${C.dim}  出路:Q1 ⇒ 把调用接回 ${WIRING_HOST}(改档位请动 gates 的 ruler.mode,别摘线);Q2 ⇒ 把题库移出仓库到仓库外批准根(见 README「私有成对评测尺子」段);Q3 ⇒ 收敛到唯一出口 ${WIRING_LIB},别再造第二个调用口。${C.reset}`,
    )
    process.exit(1)
  }
  if (undetermined.length) {
    console.error(`${C.yellow}❓ [gate-328] 接线面取不到输入:${undetermined.map((u) => u.why).join('; ')} ⇒ 本轮未判定(不记绿也不冒红)${C.reset}`)
    process.exit(2)
  }
  console.log(`${C.green}✅ [gate-328] 尺子接线在位、题库未泄、入口唯一(面=${face})${C.reset}`)
  process.exit(0)
}

export const __test__ = Object.freeze({
  judgeWiring,
  judgeSecrecy,
  judgeSingleEntry,
  REQUIRED_HOST_TOKENS,
  SECRET_BASENAMES,
  ENTRY_LITERALS,
  SECOND_LAUNCH_RE,
  SECOND_HOST_RE,
  ENTRY_ALLOWLIST,
  WIRING_HOST,
  WIRING_LIB,
  SKIP_ENV,
  selfTest,
})

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 门 328 自身异常:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
