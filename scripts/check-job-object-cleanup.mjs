// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI,需 console 输出诊断信息 */
/**
 * check-job-object-cleanup.mjs — RP-2(L02/P0)进程树清树路径静态审计门
 *
 * 判定边界(诚实纪律,§0.3「没判不写成判过」):
 *   本门只判定**静态可判**的那一份——「三场景清树的代码路径在源码中完整在位,
 *   且不能被悄悄删掉」。它**不**宣称"子进程退出后 Job 内进程数为 0":那是运行时
 *   断言,需要 Windows + Rust 工具链真跑进程树,本机与 CI 均无该能力(cargo 未安装、
 *   CI 无 cargo job)。把静态路径完整写成运行时通过,就是假绿,本门拒绝这么做。
 *
 * 三场景对应的静态锚点(全部去注释后判定,注释里出现不算):
 *   ① 超时:  poll() 命中预算 → kill_inner(SessionState::TimedOut)
 *   ② 显式/崩溃:  kill_inner → TerminateJobObject(Win) + libc_killpg(POSIX 兜底);
 *            子进程 spawn 后 attach_job_object 挂入作业
 *   ③ 主进程退出兜底:  orphan_guard::install() 在 lib.rs 早期挂载 kill-on-close 作业;
 *            orphan_guard 内 create_kill_on_close() + AssignProcessToJobObject
 *   另钉住:create_kill_on_close 设 KILL_ON_JOB_CLOSE 位、lib.rs 作用域形状锁测试在位、
 *            terminal_session.rs 单测数不低于阈值。
 *
 * 自失效防护:扫描到 0 个 .rs / 三个关键文件缺任一 / 任一条锚点不在 ⇒ 判红;
 * 取不到正文的 face ⇒ 未判定(exit 2),绝不静默绿。
 *
 * 取材面(与守门同口径):默认 HEAD blob,--staged 判索引 blob,--worktree 人工排查。
 *
 * 用法:
 *   node scripts/check-job-object-cleanup.mjs
 *   node scripts/check-job-object-cleanup.mjs --staged
 *   node scripts/check-job-object-cleanup.mjs --worktree
 *   node scripts/check-job-object-cleanup.mjs --self-test
 */

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Undetermined, catBatch, gitRaw, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

export const TERMINAL_REL = 'apps/desktop/src-tauri/src/terminal_session.rs'
export const ORPHAN_REL = 'apps/desktop/src-tauri/src/orphan_guard.rs'
export const LIB_REL = 'apps/desktop/src-tauri/src/lib.rs'
export const KEY_FILES = [TERMINAL_REL, ORPHAN_REL, LIB_REL]
export const MIN_RUST_FILES = 20
export const MIN_TERMINAL_TESTS = 8

/** 三场景清树路径的静态锚点。每条都必须去注释后命中,否则判红。 */
export const CLEANUP_PATHS = Object.freeze([
  { id: 'job-create', file: TERMINAL_REL, re: /fn\s+create_kill_on_close\s*\(/, label: '建 kill-on-close 作业' },
  { id: 'kill-on-close-bit', file: TERMINAL_REL, re: /JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE/, label: 'KILL_ON_JOB_CLOSE 位设置' },
  { id: 'tree-kill-win', file: TERMINAL_REL, re: /TerminateJobObject\s*\(/, label: 'Windows 整树终止调用' },
  { id: 'job-attach', file: TERMINAL_REL, re: /attach_job_object\s*\(\s*&child\s*\)/, label: '子进程挂入作业' },
  { id: 'tree-kill-posix', file: TERMINAL_REL, re: /libc_killpg\s*\(/, label: 'POSIX 进程组兜底' },
  { id: 'timeout-path', file: TERMINAL_REL, re: /kill_inner\s*\(\s*SessionState::TimedOut\s*\)/, label: '超时回收路径' },
  { id: 'orphan-install-job', file: ORPHAN_REL, re: /create_kill_on_close\s*\(\s*\)/, label: '退出兜底建 kill-on-close 作业' },
  { id: 'orphan-assign', file: ORPHAN_REL, re: /AssignProcessToJobObject\s*\(/, label: '主进程挂入作业' },
  { id: 'orphan-self', file: ORPHAN_REL, re: /GetCurrentProcess\s*\(\s*\)/, label: '挂入当前进程' },
  // 真绑定必须是 run() 函数作用域的 4 空格缩进行;测试字面量里的同串不会命中本锚点
  { id: 'main-mount', file: LIB_REL, re: /^ {4}let\s+_orphan_guard\s*=\s*orphan_guard::install\(\);/m, label: 'main 早期挂载 OrphanGuard' },
  { id: 'scope-lock-test', file: LIB_REL, re: /mod\s+orphan_guard_scope_tests\b/, label: '作用域形状锁测试' },
])

/** 去注释但保留字符串字面量 —— 头注里写 TerminateJobObject 不算"路径在位"。 */
export function stripComments(source) {
  const src = String(source ?? '')
  let out = ''
  let state = 'code'
  let quote = ''
  for (let i = 0; i < src.length; ) {
    const c = src[i]
    const n = src[i + 1]
    if (state === 'code') {
      if (c === '/' && n === '/') {
        state = 'line'
        i += 2
      } else if (c === '/' && n === '*') {
        state = 'block'
        i += 2
      } else if (c === "'" || c === '"' || c === '`') {
        state = 'string'
        quote = c
        out += c
        i += 1
      } else {
        out += c
        i += 1
      }
    } else if (state === 'line') {
      if (c === '\n') {
        out += c
        state = 'code'
      }
      i += 1
    } else if (state === 'block') {
      if (c === '*' && n === '/') {
        state = 'code'
        i += 2
      } else {
        if (c === '\n') out += c
        i += 1
      }
    } else {
      out += c
      if (c === '\\' && i + 1 < src.length) {
        out += src[i + 1]
        i += 2
      } else {
        if (c === quote) state = 'code'
        i += 1
      }
    }
  }
  return out
}

/** 纯判据:给定同一面的 Rust 源码集合,产出违规明细。 */
export function evaluate({ files, minTests = MIN_TERMINAL_TESTS }) {
  const violations = []
  const list = Array.isArray(files) ? files : []
  if (list.length < MIN_RUST_FILES) {
    return {
      ok: false,
      violations: [{ kind: 'empty-face', file: '(none)', detail: `Rust 源只枚举到 ${list.length} 个(<${MIN_RUST_FILES}),扫描器可能失明` }],
      stats: { files: list.length, paths: 0, pathsTotal: CLEANUP_PATHS.length, tests: 0 },
    }
  }

  const byRel = new Map(list.map((f) => [f.rel, stripComments(f.source)]))
  for (const rel of KEY_FILES) {
    if (!byRel.has(rel)) {
      violations.push({ kind: 'file-missing', file: rel, detail: '关键清树文件不在被审面' })
    }
  }

  for (const p of CLEANUP_PATHS) {
    const code = byRel.get(p.file)
    if (code === undefined) continue // file-missing 已记,不重复刷屏
    if (!p.re.test(code)) {
      violations.push({ kind: 'path-missing', file: p.file, detail: `${p.id}: ${p.label}` })
    }
  }

  const terminal = byRel.get(TERMINAL_REL) ?? ''
  const testCount = (terminal.match(/#\[test\]/g) ?? []).length
  if (byRel.has(TERMINAL_REL) && testCount < minTests) {
    violations.push({
      kind: 'tests-below-floor',
      file: TERMINAL_REL,
      detail: `#[test] 仅 ${testCount} 个 < 阈值 ${minTests},清树状态机回归防护不足`,
    })
  }

  return {
    ok: violations.length === 0,
    violations,
    stats: { files: list.length, paths: CLEANUP_PATHS.length - violations.filter((v) => v.kind === 'path-missing').length, pathsTotal: CLEANUP_PATHS.length, tests: testCount },
  }
}

/** 按判定面枚举 apps/desktop/src-tauri/src 的 .rs 并一次批量取正文;取不到 ⇒ 未判定。 */
function readFace(root, face) {
  let rels = listFaceFiles(root, face, { paths: ['apps/desktop/src-tauri/src'] })
  if (face === 'worktree') {
    const untracked = String(
      gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', 'apps/desktop/src-tauri/src'], root),
    )
      .split('\0')
      .filter(Boolean)
    rels = [...new Set([...rels, ...untracked])]
  }
  rels = rels.filter((rel) => /\.rs$/.test(rel) && !rel.includes('/tests/'))
  if (rels.length < MIN_RUST_FILES) {
    throw new Undetermined(`apps/desktop/src-tauri/src 生产 Rust 源只枚举到 ${rels.length} 个,扫描器可能失明`)
  }
  let sources
  if (face === 'worktree') {
    sources = rels.map((rel) => readWorktreeFile(root, rel))
  } else {
    const specs = rels.map((rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`))
    const blobs = catBatch(root, specs)
    sources = specs.map((spec) => blobs.get(spec) ?? null)
  }
  const missing = rels.filter((_, i) => sources[i] === null || sources[i] === undefined)
  if (missing.length) {
    throw new Undetermined(`${face} 面有 ${missing.length} 个文件取不到正文(首:${missing[0]}),不回落其它面`)
  }
  return rels.map((rel, i) => ({ rel, source: sources[i] }))
}

/** 合成最小 Rust 夹具:每个锚点给一条真代码行 + 足量 #[test]。 */
function fixture({ omit = [], commentOut = [] } = {}) {
  const terminal = [
    'pub struct JobObject;',
    'impl JobObject { pub fn create_kill_on_close() -> Option<Self> {',
    '  info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;',
    '  Some(JobObject) } }',
    'fn attach_job_object(child: &Child) -> Option<JobObject> {',
    '  unsafe { TerminateJobObject(handle, 0); }',
    '  libc_killpg(pid, 15);',
    '  let _job = attach_job_object(&child);',
    '  self.kill_inner(SessionState::TimedOut);',
    ...Array.from({ length: MIN_TERMINAL_TESTS }, () => '#[test] fn t() {}'),
  ]
  const orphan = [
    'pub fn install() -> Option<OrphanGuard> {',
    '  match JobObject::create_kill_on_close() { Some(job) => unsafe {',
    '    AssignProcessToJobObject(job.raw(), GetCurrentProcess());',
    '  } } }',
  ]
  const lib = [
    'fn run() {',
    '    let _orphan_guard = orphan_guard::install();',
    '}',
    '#[cfg(test)] mod orphan_guard_scope_tests {}',
  ]
  const files = {
    [TERMINAL_REL]: terminal,
    [ORPHAN_REL]: orphan,
    [LIB_REL]: lib,
  }
  for (const id of commentOut) {
    const p = CLEANUP_PATHS.find((x) => x.id === id)
    assert.ok(p, `unknown anchor ${id}`)
    const lines = files[p.file]
    const idx = lines.findIndex((l) => p.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines[idx] = `// ${lines[idx]}`
  }
  for (const id of omit) {
    const p = CLEANUP_PATHS.find((x) => x.id === id)
    assert.ok(p, `unknown anchor ${id}`)
    const lines = files[p.file]
    const idx = lines.findIndex((l) => p.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines.splice(idx, 1)
  }
  // 补足 MIN_RUST_FILES 个无关源,避免 evaluate 的 empty-face 提前短路
  const out = KEY_FILES.map((rel) => ({ rel, source: files[rel].join('\n') }))
  for (let i = 0; out.length < MIN_RUST_FILES; i += 1) {
    out.push({ rel: `apps/desktop/src-tauri/src/filler_${i}.rs`, source: '// no anchors here' })
  }
  return out
}

function selfTest() {
  const green = evaluate({ files: fixture() })
  assert.equal(green.ok, true, `绿夹具应通过:${JSON.stringify(green.violations)}`)

  for (const p of CLEANUP_PATHS) {
    const red = evaluate({ files: fixture({ omit: [p.id] }) })
    assert.equal(red.ok, false, `删掉 ${p.id} 必须判红`)
    assert.ok(red.violations.some((v) => v.kind === 'path-missing' && v.detail.startsWith(p.id)), `${p.id} 应产出对应 path-missing`)
  }

  // 反假绿:把锚点写进注释不算路径在位
  const commented = evaluate({ files: fixture({ commentOut: ['tree-kill-win'] }) })
  assert.ok(commented.violations.some((v) => v.detail.startsWith('tree-kill-win')), '注释里的 TerminateJobObject 不得算数')

  // 反假绿:空面 / 单测数不足 / 缺关键文件
  assert.equal(evaluate({ files: [] }).violations[0].kind, 'empty-face', '空扫描面必须判红')
  const fewTests = fixture()
  const terminalF = fewTests.find((f) => f.rel === TERMINAL_REL)
  terminalF.source = terminalF.source.replace(/#\[test\]/g, '// #[test]')
  assert.ok(evaluate({ files: fewTests }).violations.some((v) => v.kind === 'tests-below-floor'), '单测数不足必须判红')
  const missingFile = fixture().filter((f) => f.rel !== ORPHAN_REL)
  // 删掉一个关键文件后补足无关源,避免 empty-face 提前短路掩盖 file-missing 判据
  for (let i = 0; missingFile.length < MIN_RUST_FILES; i += 1) {
    missingFile.push({ rel: `apps/desktop/src-tauri/src/extra_${i}.rs`, source: '// filler' })
  }
  assert.ok(evaluate({ files: missingFile }).violations.some((v) => v.kind === 'file-missing'), '缺关键文件必须判红')

  console.log('✅ check-job-object-cleanup self-test: 绿夹具 + 11 锚点逐条变异 + 注释不算 / 空面 / 单测不足 / 缺文件 全部咬合')
}

function main(argv) {
  if (argv.includes('--self-test')) {
    selfTest()
    return 0
  }
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ check-job-object-cleanup: ${picked.error}(未判定,exit 2)`)
    return 2
  }
  let result
  try {
    result = evaluate({ files: readFace(ROOT, picked.face) })
  } catch (e) {
    console.error(`❌ check-job-object-cleanup: ${e.message}(未判定,exit 2)`)
    return 2
  }
  if (result.ok) {
    console.log(
      `✅ check-job-object-cleanup: 清树路径 ${result.stats.paths}/${result.stats.pathsTotal} 在位,` +
        `扫描 ${result.stats.files} 个 Rust 源,terminal 单测 ${result.stats.tests} 个(面:${picked.face})`,
    )
    console.log('   ℹ️  静态路径完整 ≠ 运行时"进程数=0":后者需 Windows+Rust 真跑进程树,本门不伪称该断言')
    return 0
  }
  console.error(`❌ check-job-object-cleanup: ${result.violations.length} 处清树路径缺口(面:${picked.face})`)
  for (const v of result.violations) console.error(`  - [${v.kind}] ${v.file}: ${v.detail}`)
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
