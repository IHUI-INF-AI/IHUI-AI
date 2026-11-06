#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 302:e2e skip / 固定等待制度(判据见 `apps/web/e2e/SKIP-WAIT-POLICY.md`)。
 *
 * 接入位置:`scripts/guardian-runner.mjs` 门 302 条目(blocking);随本票同批入库。
 * 纯判据在 `scripts/lib/e2e-skip-wait-policy.mjs`;本文件只做仓面读取与输出。
 *
 * 判红:
 *  - 裸 `test.skip()` / `setupTest.skip()`(无参数、无理由);
 *  - skip 没有 ≥8 字可读理由,或没有 `[SKIP:<id>]` 关联编号;
 *  - 编号不在台账、category 不是 ENV/BUG、ENV 引用不存在、BUG 引用不存在或已关闭;
 *  - 台账 reviewBy 过期;台账有、代码没引用的孤儿条目;
 *  - `waitForTimeout` 没有紧邻的 `// WAIT-POLICY:<TIMING-id> <理由>` 注解,或 TIMING 编号未知/过期。
 *
 * 未判定(exit 2):台账取不到/JSON 坏/结构坏、面无文件、面参数互斥。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, existsSync } from 'node:fs'
import {
  catBatch,
  listFaceFiles,
  readWorktreeFile,
  selectFace,
  Undetermined,
  FACE_LABEL,
} from './lib/face-reader.mjs'
import {
  __test__ as rules,
  evaluatePolicy,
  summarize,
  localIsoDate,
} from './lib/e2e-skip-wait-policy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.IHUI_GUARDIAN_ROOT || path.resolve(HERE, '..')
const SCOPE_DIRS = ['apps/web/e2e', 'apps/web/tests/visual']
const SPEC_RE = /\.(?:spec|setup)\.tsx?$/
const REGISTER = 'apps/web/e2e/skip-register.json'

function isSpec(rel) {
  return SCOPE_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)) && SPEC_RE.test(rel)
}

/** worktree 面补上未入库的新 spec(ls-files 看不到)。 */
function walkDir(absDir, relDir, acc) {
  for (const e of readdirSync(absDir, { withFileTypes: true })) {
    const rel = `${relDir}/${e.name}`
    if (e.isDirectory()) walkDir(path.join(absDir, e.name), rel, acc)
    else if (e.isFile() && isSpec(rel)) acc.push(rel)
  }
}

function walkScope() {
  const acc = []
  for (const d of SCOPE_DIRS) {
    const abs = path.join(ROOT, d)
    if (existsSync(abs)) walkDir(abs, d, acc)
  }
  return acc
}

function readFace(face) {
  let paths = listFaceFiles(ROOT, face, { paths: SCOPE_DIRS }).filter(isSpec)
  if (face === 'worktree') paths = [...new Set([...paths, ...walkScope()])]
  const specs = paths.map((p) => (face === 'head' ? `HEAD:${p}` : face === 'staged' ? `:${p}` : p))
  const registerSpec = face === 'head' ? `HEAD:${REGISTER}` : face === 'staged' ? `:${REGISTER}` : REGISTER
  let raw
  if (face === 'worktree') {
    raw = new Map()
    for (const p of [...paths, REGISTER]) raw.set(p, readWorktreeFile(ROOT, p))
  } else {
    raw = catBatch(ROOT, [...specs, registerSpec], { maxBuffer: 128 * 1024 * 1024 })
  }
  const files = paths.map((p, i) => ({ path: p, text: raw.get(specs[i]) ?? null }))
  const regText = raw.get(registerSpec) ?? null
  return { files, regText }
}

function selfTest() {
  const t = (name, ok, extra = '') => {
    console.log(`${ok ? '✅' : '❌'} ${name}${ok || !extra ? '' : `: ${extra}`}`)
    return ok
  }
  const today = '2026-11-06'
  const future = '2027-05-31'
  const meta = { owner: 'S-E2E', reviewBy: future }
  const mk = (over = {}) => ({ schemaVersion: 1, envRefs: {}, defects: [], skips: [], timings: [], ...over })
  const envReg = mk({
    envRefs: { SEED_DATA: { reason: '测试数据未 seed 时合法跳过', ...meta } },
    skips: [{ id: 'SKIP-0001', category: 'ENV', ref: 'ENV:SEED_DATA', reason: '测试数据未 seed 时合法跳过', ...meta }],
  })
  const bugReg = mk({
    defects: [{ id: 'E2E-SKIP-0001', title: '某能力未实现时允许挂账跳过', status: 'open', ...meta }],
    skips: [{ id: 'SKIP-0002', category: 'BUG', ref: 'BUG:E2E-SKIP-0001', reason: '该能力尚未实现,挂缺陷号后允许跳过', ...meta }],
  })
  const closedReg = mk({
    defects: [{ id: 'E2E-SKIP-0002', title: '另一条已修复缺陷不该再被 skip 引用', status: 'fixed', ...meta }],
    skips: [{ id: 'SKIP-0003', category: 'BUG', ref: 'BUG:E2E-SKIP-0002', reason: '缺陷已修复,此条应判红', ...meta }],
  })
  const expiredReg = mk({
    envRefs: { SEED_DATA: { reason: '测试数据未 seed 时合法跳过', ...meta } },
    skips: [{ id: 'SKIP-0004', category: 'ENV', ref: 'ENV:SEED_DATA', reason: '到期未复审的条目', owner: 'S-E2E', reviewBy: '2026-01-01' }],
  })
  const timingReg = mk({ timings: [{ id: 'TIMING-0001', reason: '点击后 UI 过渡落定窗口,无条件可观察', ...meta }] })
  const orphanReg = mk({
    envRefs: { SEED_DATA: { reason: '测试数据未 seed 时合法跳过', ...meta } },
    skips: [{ id: 'SKIP-0001', category: 'ENV', ref: 'ENV:SEED_DATA', reason: '测试数据未 seed 时合法跳过', ...meta }],
  })
  const run = (text, register) => evaluatePolicy({ files: [{ path: 'apps/web/e2e/demo.spec.ts', text }], register, today })

  const cases = [
    ['① 裸 skip ⇒ skip-bare 红', run('test.skip()\n', mk()), 'skip-bare'],
    ['② 只有条件没有理由 ⇒ skip-no-reason 红', run('test.skip(true)\n', mk()), 'skip-no-reason'],
    ['③ 有理由没编号 ⇒ skip-no-ref 红', run("test.skip(true, '因为当前环境缺少测试数据')\n", mk()), 'skip-no-ref'],
    ['④ 编号不存在 ⇒ skip-unknown-ref 红', run("test.skip(true, '理由足够长 [SKIP:SKIP-9999]')\n", mk()), 'skip-unknown-ref'],
    ['⑤ 已登记 ENV skip ⇒ 绿', run("test.skip(true, '测试数据未 seed 时合法跳过 [SKIP:SKIP-0001]')\n", envReg), null],
    ['⑥ 已登记 BUG skip ⇒ 绿', run("test.skip(true, '该能力尚未实现,挂缺陷号后允许跳过 [SKIP:SKIP-0002]')\n", bugReg), null],
    ['⑦ 缺陷已修复仍 skip ⇒ skip-defect-closed 红', run("test.skip(true, '缺陷已修复,此条应判红 [SKIP:SKIP-0003]')\n", closedReg), 'skip-defect-closed'],
    ['⑧ 过期条目 ⇒ skip-expired 红', run("test.skip(true, '到期未复审的条目 [SKIP:SKIP-0004]')\n", expiredReg), 'skip-expired'],
    ['⑨ 固定等待无注解 ⇒ wait-no-annotation 红', run('await page.waitForTimeout(200)\n', timingReg), 'wait-no-annotation'],
    [
      '⑩ 注解理由不足 ⇒ wait-no-reason 红',
      run('// WAIT-POLICY:TIMING-0001 短\nawait page.waitForTimeout(200)\n', timingReg),
      'wait-no-reason',
    ],
    [
      '⑪ 合法 TIMING 注解 ⇒ 绿',
      run('// WAIT-POLICY:TIMING-0001 点击后 UI 过渡落定窗口,无条件可观察\nawait page.waitForTimeout(200)\n', timingReg),
      null,
    ],
    [
      '⑫ 注释里提到 skip/waitForTimeout 不算调用',
      run("// test.skip() 与 waitForTimeout(200) 只是注释\nconst x = 'test.skip()'\n", mk()),
      null,
    ],
    ['⑬ 台账有、代码没引用 ⇒ orphan 红', evaluatePolicy({ files: [], register: orphanReg, today }), 'orphan-skip'],
    ['⑭ 台账结构坏 ⇒ 未判定 exit 2(不记绿)', evaluatePolicy({ files: [], register: { schemaVersion: 99 }, today }).exitCode === 2, null],
  ]
  let ok = true
  for (const [name, res, rule] of cases) {
    let pass
    if (typeof res === 'boolean') pass = res
    else if (rule === null) pass = res.exitCode === 0
    else pass = res.exitCode === 1 && res.violations.some((v) => v.rule === rule)
    ok = t(name, pass, typeof res === 'object' ? JSON.stringify(res.counts ?? res.problems) : '') && ok
  }
  // 形状锁:判据实现必须只从 lib 取,且自检覆盖 skip/等待/孤儿三面
  ok = t('⑮ 自检覆盖 skip / wait / orphan 三面', rules.MIN_REASON === 8 && cases.length >= 14) && ok
  console.log(ok ? '✅ 自检全绿(15/15)' : '❌ 自检有红')
  return ok ? 0 : 1
}

function main(argv) {
  const args = argv.slice(2)
  if (args.includes('--self-test')) return selfTest()
  const json = args.includes('--json')
  const staged = args.includes('--staged')
  const worktree = args.includes('--worktree')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.log(`❌ 未判定:${sel.error}`)
    return 2
  }
  let faceData
  try {
    faceData = readFace(sel.face)
  } catch (e) {
    console.log(`❌ 未判定:${e instanceof Undetermined ? e.message : `读面失败:${e.message}`}`)
    return 2
  }
  if (!faceData.regText) {
    console.log(`❌ 未判定:取不到台账 ${REGISTER}(${FACE_LABEL[sel.face] ?? sel.face})`)
    return 2
  }
  let register
  try {
    register = JSON.parse(faceData.regText)
  } catch (e) {
    console.log(`❌ 未判定:台账 JSON 解析失败:${e.message}`)
    return 2
  }
  const unreadable = faceData.files.filter((f) => typeof f.text !== 'string')
  if (unreadable.length > 0) {
    console.log(`❌ 未判定:${unreadable.length} 个 spec 取不到内容(${FACE_LABEL[sel.face] ?? sel.face})`)
    return 2
  }
  if (faceData.files.length === 0) {
    console.log(`[e2e skip/等待门] 面=${sel.face} · 0 个 spec,无事可判(exit 0)`)
    return 0
  }

  const result = evaluatePolicy({ files: faceData.files, register, today: localIsoDate() })
  if (json) {
    console.log(JSON.stringify({ face: sel.face, ...result }, null, 2))
  } else {
    console.log(summarize(result, sel.face))
    for (const p of result.problems) console.log(`  · 台账结构:${p.code} ${p.detail}`)
    if (result.violations.length > 0) {
      console.log(`❌ 命中 ${result.violations.length} 处:`)
      for (const v of result.violations.slice(0, 80)) {
        const where = v.line > 0 ? `${v.file}:${v.line}` : v.file
        console.log(`    · [${v.rule}] ${where} → ${v.detail}`)
      }
      if (result.violations.length > 80) console.log(`    · …另有 ${result.violations.length - 80} 处`)
      console.log('  出路:补 `[SKIP:<id>]` + ≥8 字理由并登记台账;固定等待改成条件等待,确实不可观察的补 WAIT-POLICY 注解。')
    } else if (result.exitCode === 0) {
      console.log('✅ 所有 skip 均有理由与登记编号;所有固定等待均有 WAIT-POLICY 注解;台账无孤儿。')
    }
  }
  return result.exitCode
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv)
}

export { main, selfTest, readFace, isSpec }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
