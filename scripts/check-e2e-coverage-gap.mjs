#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读尺子需输出读数 */
/**
 * check-e2e-coverage-gap.mjs —— 新模块缺测试的准入尺子(票「E2E 自动补测」的发现缺口那一半)。
 *
 * 判据唯一源 = `scripts/lib/e2e-coverage-gap.mjs`(§0.6):命名约定映射、纯类型/空导出/
 * 转发桶的排除、unknown 形态的点名全在那层,本文件**只做四件事**:
 *   ① 按 §0.4 三面取材:`--staged` 判索引 blob / 无旗判 HEAD blob / `--worktree` 仅人工逃生舱;
 *   ② 读射程清单(`scripts/data/e2e-coverage-gap-scope.json`),坏行 / 过期 ⇒ exit 2 未判定;
 *   ③ 差值棘轮:锚点 = 该模块在 HEAD 面自身是否已是缺口,只拦"本次新增"(§0.5);
 *   ④ 出读数与 §22d `isDirectRun` / `__test__`。
 *
 * 退出码:0 无新增缺口 / 1 有新增缺口 / 2 未判定(取不到面、坏清单、空扫、未知形态)。
 * **接线(2026-10-26,机主授权)**:guardian-runner id 250,**warn 档观察**(只喊话不拦提交);
 * `stagedTriggers` = 三个射程根 + 收集目录(apps/web/tests、apps/api/tests、apps/api/test,2026-10-27
 * 随规则③补:收集目录测试被删会翻缺口)+ 本文件 + 射程清单 + 判据层;`--staged` 判索引、无旗判 HEAD。
 * 跳过 `HUSKY_SKIP_E2E_COVERAGE_GAP=1`;不进 package.json。升 blocking 前置 = 存量缺口归零。
 *
 * 用法:node scripts/check-e2e-coverage-gap.mjs [--staged|--worktree] [--json] [--self-test]
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  catBatch,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import {
  SOURCE_EXTS,
  countByReason,
  diffGaps,
  extOf,
  findTestlessModules,
  inRoot,
  isTestFile,
  normalizePath,
  testCoversModule,
} from './lib/e2e-coverage-gap.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '..')
export const SCOPE_REL = 'scripts/data/e2e-coverage-gap-scope.json'
const TAG = '[E2E 缺口]'
const LIST_LIMIT = 20

export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 射程清单校验(§0.7「豁免必须验过才免且会到期」同向):每条必须 `{root, reason, reviewBy}`,
 * reason 是定向说明(≥8 字,裸白名单不算),reviewBy 到期即 exit 2 逼重审。
 * 任一行不合规 ⇒ 整份清单判死,不"跳过坏行继续跑"(那会把射程悄悄缩小)。
 */
export function validateScope(doc, today = todayIso()) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Undetermined(`射程清单根必须是对象,实得 ${Array.isArray(doc) ? '数组' : typeof doc}`)
  }
  if (!Array.isArray(doc.roots) || doc.roots.length === 0) {
    throw new Undetermined('射程清单 roots 必须是非空数组')
  }
  const seen = new Set()
  const roots = []
  doc.roots.forEach((entry, i) => {
    const label = `roots[${i}]`
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Undetermined(`${label} 不是对象`)
    }
    const root = normalizePath(entry.root)
    if (!root) throw new Undetermined(`${label}.root 缺失/为空`)
    if (root.startsWith('/') || /^[A-Za-z]:\//.test(root)) {
      throw new Undetermined(`${label}.root 必须是仓库相对路径:${root}`)
    }
    if (seen.has(root)) throw new Undetermined(`${label}.root 重复登记:${root}`)
    seen.add(root)
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : ''
    if (reason.length < 8) {
      throw new Undetermined(`${label}.reason 缺失或过短(需 ≥8 字定向说明):${JSON.stringify(entry.reason ?? null)}`)
    }
    const reviewBy = entry.reviewBy
    if (typeof reviewBy !== 'string' || !ISO_DATE.test(reviewBy) || Number.isNaN(Date.parse(`${reviewBy}T00:00:00Z`))) {
      throw new Undetermined(`${label}.reviewBy 必须是 YYYY-MM-DD 日期:${JSON.stringify(reviewBy ?? null)}`)
    }
    if (reviewBy < today) {
      throw new Undetermined(`${label} 已过复审期(reviewBy=${reviewBy} < ${today}) ⇒ 射程未重审,本轮不判`)
    }
    roots.push({ root, reason, reviewBy })
  })
  return { roots, note: typeof doc._note === 'string' ? doc._note : '' }
}

export function loadScope(root = REPO_ROOT, today = todayIso()) {
  let text
  try {
    text = readFileSync(join(root, SCOPE_REL), 'utf8')
  } catch (e) {
    throw new Undetermined(`射程清单取不到(${SCOPE_REL}):${e?.message ?? e}`)
  }
  let doc
  try {
    doc = JSON.parse(text)
  } catch (e) {
    throw new Undetermined(`射程清单不是合法 JSON(${SCOPE_REL}):${e?.message ?? e}`)
  }
  return validateScope(doc, today)
}

/**
 * 按判定面取材:清单与内容同面同轮(§0.4)。
 * 清单:`listFaceFiles`(HEAD ⇒ ls-tree / staged ⇒ ls-files --cached / worktree ⇒ ls-files)。
 * 内容:HEAD/staged 走 `catBatch`(批量,不逐文件派生 git);worktree 读盘(人工档)。
 * 只读**源码形态**的正文:资源/未知扩展名的正文判不了任何东西,分类器按路径就能判。
 */
export function collectFace(root, face, opts = {}) {
  const roots = opts.roots ?? []
  const list = opts.listFiles ?? ((repoRoot, which) => listFaceFiles(repoRoot, which))
  let all
  try {
    all = list(root, face)
  } catch (e) {
    throw e instanceof Undetermined ? e : new Undetermined(`取不到 ${face} 面文件清单:${e?.message ?? e}`)
  }
  if (!Array.isArray(all)) throw new Undetermined(`${face} 面文件清单不是数组`)
  const paths = all.map(normalizePath).filter(Boolean)
  const tests = paths.filter(isTestFile)
  const inRoots = paths.filter((p) => roots.some((r) => inRoot(p, r)))
  const sourceFiles = inRoots.filter((p) => SOURCE_EXTS.includes(extOf(p)))
  const contents = new Map()
  if (sourceFiles.length > 0) {
    if (face === 'worktree') {
      for (const p of sourceFiles) contents.set(p, readWorktreeFile(root, p))
    } else {
      const rev = face === 'staged' ? '' : 'HEAD'
      let got
      try {
        got = catBatch(root, sourceFiles.map((p) => `${rev}:${p}`), { timeout: 120_000 })
      } catch (e) {
        throw e instanceof Undetermined ? e : new Undetermined(`${face} 面源码 blob 取不到:${e?.message ?? e}`)
      }
      for (const p of sourceFiles) contents.set(p, got.get(`${rev}:${p}`) ?? null)
    }
  }
  const files = inRoots.map((p) => (contents.has(p) ? { path: p, text: contents.get(p) } : { path: p }))
  return { files, tests, scanned: inRoots.length, sourceCount: sourceFiles.length }
}

export function evaluateFace(root, face, roots, opts = {}) {
  const collected = collectFace(root, face, { roots, ...opts })
  const result = findTestlessModules({
    files: collected.files,
    testFiles: collected.tests,
    roots,
  })
  return { ...result, face, sourceCount: collected.sourceCount }
}

/**
 * 退出码口径(纯函数,便于镜像测试钉住三态):
 *   取不到面 / 射程根枚举为 0 / 模块为 0 / 有会**阻断**的未知形态 ⇒ 2 未判定;
 *   有新增缺口 ⇒ 1;否则 0。
 * 生成物类 undetermined(`blocks:false`)只点名不阻断 —— 否则 3 枚 `*.generated.ts`
 * 会让这道门恒红(§12e),而恒红门的唯一结局是逼人跳门。
 */
export function judgeExit({ face, result, newGaps }) {
  if (!face || !result) return 2
  if (result.scanned === 0) return 2
  if (result.modules === 0) return 2
  if ((result.emptyRoots ?? []).length > 0) return 2
  if ((result.undetermined ?? []).some((u) => u.blocks)) return 2
  return (newGaps ?? []).length > 0 ? 1 : 0
}

function printUndetermined(result) {
  if (!result.undetermined.length) return
  const parts = countByReason(result.undetermined).map(([k, n]) => `${k}:${n}`)
  console.log(
    `⚪ 未判定形态 ${result.undetermined.length} 枚(${parts.join(' / ')})—— 逐条点名,既不记绿也不判红:`,
  )
  for (const u of result.undetermined.slice(0, LIST_LIMIT)) {
    console.log(`   ${u.blocks ? '!' : '-'} ${u.path}  ← ${u.reason}`)
  }
  if (result.undetermined.length > LIST_LIMIT) console.log(`   …另 ${result.undetermined.length - LIST_LIMIT} 枚`)
}

function summarize(result) {
  const gaps = result.gaps ?? []
  const dirs = new Map()
  for (const g of gaps) {
    const dir = g.path.slice(0, g.path.lastIndexOf('/')) || '.'
    dirs.set(dir, (dirs.get(dir) ?? 0) + 1)
  }
  return [...dirs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([dir, n]) => `   ${String(n).padStart(3)}  ${dir}`)
}

function selfTest() {
  const L = findTestlessModules
  const M = (p) => ({ path: p, text: 'export const useThing = () => 1\n' })
  const base = (files, tests) =>
    L({ files, testFiles: tests ?? [], roots: ['apps/web/src', 'packages/shared/src'] })
  const cases = []
  const check = (name, ok) => cases.push([name, Boolean(ok)])

  const sibling = base([M('apps/web/src/a/x.ts')], ['apps/web/src/a/x.test.ts'])
  check('①同目录 x.test.ts 命中 ⇒ 不计缺口', sibling.gapCount === 0)
  const spec = base([M('apps/web/src/a/x.tsx')], ['apps/web/src/a/x.spec.tsx'])
  check('②同目录 x.spec.tsx 命中(跨扩展名)', spec.gapCount === 0)
  const dirHit = base([M('packages/shared/src/b/y.ts')], ['packages/shared/src/b/__tests__/y.test.ts'])
  check('③__tests__/y* 命中', dirHit.gapCount === 0)
  const dirPrefix = base([M('packages/shared/src/b/y.ts')], ['packages/shared/src/b/__tests__/y-extra.test.ts'])
  check('④__tests__ 词边界前缀(y-extra)命中', dirPrefix.gapCount === 0)
  const boundary = base([M('packages/shared/src/b/user.ts')], ['packages/shared/src/b/__tests__/users.test.ts'])
  check('⑤前缀必须落词边界:users 不能冒充 user 的测试', boundary.gapCount === 1)
  const noTest = base([M('apps/web/src/a/z.ts')])
  check('⑥无任何测试 ⇒ 缺口', noTest.gapCount === 1)
  const empty = base([{ path: 'apps/web/src/a/e.ts', text: '// 只有注释\n' }])
  check('⑦空导出文件不计', empty.modules === 0 && empty.gapCount === 0)
  const typed = base([
    { path: 'apps/web/src/a/t.ts', text: 'export type A = string\nexport interface B { a: number }\n' },
  ])
  check('⑧纯类型文件不计', typed.modules === 0 && typed.skipped.some((s) => /纯类型/.test(s.reason)))
  const barrel = base([
    { path: 'apps/web/src/a/index.ts', text: "export { a } from './a'\nexport * from './b'\n" },
  ])
  check('⑨纯转发桶不计', barrel.modules === 0 && barrel.skipped.some((s) => /转发桶/.test(s.reason)))
  const generated = base([
    { path: 'packages/shared/src/g/gen.ts', text: '// @generated\nexport const x = 1\n' },
  ])
  check('⑩生成物落 undetermined 且不阻断', generated.undetermined.length === 1 && generated.undetermined[0].blocks === false)
  const noExt = base([{ path: 'apps/web/src/a/script', text: 'export const a = 1\n' }])
  check('⑪无扩展名落 undetermined 且阻断', noExt.undetermined.length === 1 && noExt.undetermined[0].blocks === true)
  const unknown = base([{ path: 'apps/web/src/a/w.vue', text: '<template/>' }])
  check('⑫未知扩展名落 undetermined 且阻断', unknown.undetermined.length === 1 && unknown.undetermined[0].blocks === true)
  const asset = base([{ path: 'apps/web/src/a/s.css', text: '.a{}' }])
  check('⑬资源文件跳过不点名', asset.skipped.length === 1 && asset.undetermined.length === 0)
  const outside = base([{ path: 'apps/other/src/x.ts', text: 'export const x = 1\n' }])
  check('⑭射程外文件不计入(也不当缺口)', outside.scanned === 0 && outside.outOfScope === 1)

  // 两个射程根都必须有真实文件,否则 emptyRoots 先判 exit 2,⑰/⑱ 永远量不到 1/0。
  const faceResult = base(
    [M('apps/web/src/a/new.ts'), M('apps/web/src/a/old.ts'), M('packages/shared/src/b/x.ts')],
    ['packages/shared/src/b/x.test.ts'],
  )
  const baseResult = base([M('apps/web/src/a/old.ts')], [])
  const ratchet = diffGaps(faceResult, baseResult)
  check('⑮棘轮:基底已是缺口 ⇒ 存量;基底不是 ⇒ 新增', ratchet.newGaps.length === 1 && ratchet.stock.length === 1)
  const noBase = diffGaps(faceResult, null)
  check('⑯无基底 ⇒ 新增 0、全为存量', noBase.newGaps.length === 0 && noBase.stock.length === 2)
  check('⑰退出码:有新增 ⇒ 1', judgeExit({ face: 'head', result: faceResult, newGaps: ratchet.newGaps }) === 1)
  check('⑱退出码:只有存量 ⇒ 0', judgeExit({ face: 'head', result: faceResult, newGaps: [] }) === 0)
  check('⑲退出码:有阻断型未知形态 ⇒ 2', judgeExit({ face: 'head', result: noExt, newGaps: [] }) === 2)
  check('⑳退出码:空扫 ⇒ 2', judgeExit({ face: 'head', result: outside, newGaps: [] }) === 2)

  const good = {
    roots: [
      { root: 'apps/web/src', reason: 'web 端源码命名约定稳定', reviewBy: '2099-01-01' },
      { root: 'packages/shared/src/', reason: '共享层源码同目录 __tests__ 约定', reviewBy: '2099-01-01' },
    ],
  }
  const scope = validateScope(good, '2026-10-25')
  check('㉑合法清单被规范化(root 去尾斜杠)', scope.roots[0].root === 'apps/web/src' && scope.roots[1].root === 'packages/shared/src')
  let badThrew = false
  try {
    validateScope({ roots: [{ root: 'apps/web/src', reason: '短', reviewBy: '2099-01-01' }] }, '2026-10-25')
  } catch (e) {
    badThrew = e instanceof Undetermined
  }
  check('㉒坏行(reason 过短)⇒ Undetermined(exit 2)', badThrew)
  let expiredThrew = false
  try {
    validateScope({ roots: [{ root: 'apps/web/src', reason: '理由足够长的定向说明', reviewBy: '2020-01-01' }] }, '2026-10-25')
  } catch (e) {
    expiredThrew = e instanceof Undetermined && /复审期/.test(e.message)
  }
  check('㉓过期 reviewBy ⇒ Undetermined(exit 2)', expiredThrew)

  // 规则③(收集目录同名 + 同包同名唯一,2026-10-27 立):正反成对,收紧方向全部指向"多要一次说明"。
  const baseApi = (files, tests) => L({ files, testFiles: tests ?? [], roots: ['apps/api/src'] })
  const coll = baseApi([M('apps/api/src/lib/x.ts')], ['apps/api/tests/lib/x.test.ts'])
  check(
    '㉔③收集目录任意层精确同名命中 ⇒ 不计缺口',
    coll.gapCount === 0 && coll.covered[0]?.test === 'apps/api/tests/lib/x.test.ts',
  )
  const collFlat = baseApi([M('apps/api/src/db/y.tsx')], ['apps/api/test/y.test.ts'])
  check('㉕③test/(单数)平铺命中,且跨扩展名(y.tsx ← y.test.ts)', collFlat.gapCount === 0)
  const crossPkg = baseApi([M('apps/api/src/lib/x.ts')], ['apps/web/tests/x.test.ts'])
  check('㉖③反证:跨包收集目录不认(apps/web/tests 不盖 apps/api/src)', crossPkg.gapCount === 1)
  const specInTests = baseApi([M('apps/api/src/lib/x.ts')], ['apps/api/tests/visual/x.spec.ts'])
  check('㉗③反证:收集目录 *.spec.* 不认(playwright 族,vitest 不收)', specInTests.gapCount === 1)
  const sharedStem = baseApi(
    [M('apps/api/src/lib/audit.ts'), M('apps/api/src/plugins/audit.ts')],
    ['apps/api/tests/audit.test.ts'],
  )
  check('㉘③反证:同名×2 ⇒ 名字指认不了模块,③失效双双落缺口', sharedStem.gapCount === 2)
  const prefixed = baseApi([M('apps/api/src/lib/x.ts')], ['apps/api/tests/x-extra.test.ts'])
  check('㉙③反证:精确同名才认,x-extra 不盖 x(③不做② 的前缀放宽)', prefixed.gapCount === 1)
  const embedded = baseApi([M('apps/api/src/lib/x.ts')], ['apps/api/src/lib/tests/x.test.ts'])
  check('㉚③反证:src 内嵌 tests/ 不是收集目录(锚定 P/src|app 兄弟层)', embedded.gapCount === 1)
  check(
    '㉛③pairwise 契约:stemUnique 缺省不认,显式 true 才认',
    testCoversModule('apps/api/src/lib/x.ts', 'apps/api/tests/x.test.ts') === false &&
      testCoversModule('apps/api/src/lib/x.ts', 'apps/api/tests/x.test.ts', { stemUnique: true }) === true,
  )
  const baseWeb2 = (files, tests) => L({ files, testFiles: tests ?? [], roots: ['apps/web/app', 'apps/web/src'] })
  const crossRoot = baseWeb2(
    [M('apps/web/app/b/solo.ts'), M('apps/web/src/a/solo.ts')],
    ['apps/web/tests/solo.test.ts'],
  )
  check('㉜③同包跨根(app 与 src)同名也计入唯一性 ⇒ ③失效', crossRoot.gapCount === 2)
  const oneRoot = baseWeb2([M('apps/web/src/a/solo.ts')], ['apps/web/tests/solo.test.ts'])
  check('㉝③同名唯一(同包全根计数后只剩一枚)⇒ 认', oneRoot.gapCount === 0)

  let fail = 0
  for (const [name, ok] of cases) {
    if (!ok) fail += 1
    console.log(`${ok ? '✓' : '✗'} ${name}`)
  }
  console.log(`自检 ${cases.length - fail}/${cases.length} 通过`)
  return fail === 0
}

async function main(argv) {
  if (argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1)
  }
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.log(`⚪ ${TAG} 取材面自相矛盾 ⇒ 未判定:${sel.error}`)
    process.exit(2)
  }
  let scope
  try {
    scope = loadScope(REPO_ROOT)
  } catch (e) {
    console.log(`⚪ ${TAG} ${e instanceof Undetermined ? '未判定' : '异常'}:${e?.message ?? e}`)
    process.exit(2)
  }
  const roots = scope.roots.map((r) => r.root)
  const json = argv.includes('--json')
  let faceResult
  let baseResult = null
  try {
    faceResult = evaluateFace(REPO_ROOT, sel.face, roots)
    if (sel.face === 'staged' || sel.face === 'worktree') {
      baseResult = evaluateFace(REPO_ROOT, 'head', roots)
    }
  } catch (e) {
    console.log(`⚪ ${TAG} 取不到判定面 ⇒ 未判定:${e?.message ?? e}`)
    process.exit(2)
  }
  const { newGaps, stock } = diffGaps(faceResult, baseResult)
  const rc = judgeExit({ face: sel.face, result: faceResult, newGaps })

  const payload = {
    face: sel.face,
    baseFace: baseResult ? 'head' : null,
    roots,
    scanned: faceResult.scanned,
    sourceCount: faceResult.sourceCount,
    modules: faceResult.modules,
    gapCount: faceResult.gapCount,
    newCount: newGaps.length,
    stockCount: stock.length,
    newGaps,
    stockGaps: stock,
    skipped: faceResult.skipped,
    undetermined: faceResult.undetermined,
    emptyRoots: faceResult.emptyRoots,
    rc,
  }
  if (json) {
    console.log(JSON.stringify(payload, null, 2))
    process.exit(rc)
  }

  console.log(
    `${TAG} 面=${sel.face === 'head' ? 'HEAD blob' : sel.face === 'staged' ? '索引 blob' : '工作树(人工档)'}` +
      ` 射程=${roots.length} 根 文件=${faceResult.scanned} 模块=${faceResult.modules}`,
  )
  console.log(
    `缺口=${faceResult.gapCount} 新增=${newGaps.length} 存量=${stock.length}` +
      ` 跳过=${faceResult.skipped.length} 未判定=${faceResult.undetermined.length}`,
  )
  if (stock.length > 0) {
    console.log('存量缺口分布(前 10 个目录,只报数,不拦本次提交):')
    for (const line of summarize(faceResult)) console.log(line)
  }
  if (newGaps.length > 0) {
    console.log(`本次新增缺口 ${newGaps.length} 枚(缺测试的新模块,须补测或登记):`)
    for (const g of newGaps.slice(0, LIST_LIMIT)) console.log(`  ✗ ${g.path}`)
    if (newGaps.length > LIST_LIMIT) console.log(`  …另 ${newGaps.length - LIST_LIMIT} 枚`)
  }
  printUndetermined(faceResult)
  if (faceResult.emptyRoots.length > 0) {
    console.log(`⚪ 射程条目一枚文件都没枚举到(清单腐烂):${faceResult.emptyRoots.join(' / ')}`)
  }
  if (faceResult.scanned === 0) console.log('⚪ 射程内 0 枚文件 ⇒ 未判定(空扫不记绿,§0.3)')
  if (rc === 2) console.log('⚪ 未判定:既不记绿也不冒红,先修输入(取材面/清单/未知形态)')
  const verdict = rc === 0 ? '通过(无新增缺口)' : rc === 1 ? '失败(本次带进新缺口)' : '未判定'
  console.log(`${TAG} ⇒ ${verdict}  [rc=${rc}]`)
  process.exit(rc)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  REPO_ROOT,
  SCOPE_REL,
  validateScope,
  loadScope,
  collectFace,
  evaluateFace,
  judgeExit,
  todayIso,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
