// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-2 镜像测试:check-job-object-cleanup 的判据本体。
 *
 * 正反成对,避免只留正向用例让判据整族空转:
 *   ① 绿:11 条清树锚点齐 + 单测达标 ⇒ 零违规;
 *   ② 红:逐条删掉每条锚点 ⇒ 对应 path-missing 判红(变异咬合);
 *   ③ 反假绿:注释里的锚点不算、单测数不足、缺关键文件、空扫描面全部判红;
 *   ④ 边界:诚实断言本门判的是"静态路径完整",不把运行时"进程数=0"写成通过。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CLEANUP_PATHS,
  KEY_FILES,
  LIB_REL,
  MIN_RUST_FILES,
  MIN_TERMINAL_TESTS,
  ORPHAN_REL,
  TERMINAL_REL,
  evaluate,
  stripComments,
} from '../check-job-object-cleanup.mjs'

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
  const files = { [TERMINAL_REL]: terminal, [ORPHAN_REL]: orphan, [LIB_REL]: lib }
  for (const id of commentOut) {
    const p = CLEANUP_PATHS.find((x) => x.id === id)
    const lines = files[p.file]
    const idx = lines.findIndex((l) => p.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines[idx] = `// ${lines[idx]}`
  }
  for (const id of omit) {
    const p = CLEANUP_PATHS.find((x) => x.id === id)
    const lines = files[p.file]
    const idx = lines.findIndex((l) => p.re.test(l))
    assert.ok(idx >= 0, `fixture 缺锚点行 ${id}`)
    lines.splice(idx, 1)
  }
  const out = KEY_FILES.map((rel) => ({ rel, source: files[rel].join('\n') }))
  for (let i = 0; out.length < MIN_RUST_FILES; i += 1) {
    out.push({ rel: `apps/desktop/src-tauri/src/f_${i}.rs`, source: '// filler' })
  }
  return out
}

test('① stripComments:注释里的锚点符号被剔除但字符串保留', () => {
  const s = '// TerminateJobObject in comment\nlet x = TerminateJobObject(a); /* killpg */'
  const stripped = stripComments(s)
  assert.equal(/TerminateJobObject/.test(stripped), true, '真代码锚点应保留')
  assert.equal((stripped.match(/TerminateJobObject/g) ?? []).length, 1, '注释里的同串必须被剔除')
  assert.equal(/killpg/.test(stripped), false, '块注释里的锚点必须被剔除')
})

test('② 绿夹具:11 锚点齐 + 单测达标 ⇒ 零违规', () => {
  const result = evaluate({ files: fixture() })
  assert.equal(result.ok, true, JSON.stringify(result.violations))
  assert.equal(result.stats.paths, CLEANUP_PATHS.length)
  assert.equal(result.stats.tests, MIN_TERMINAL_TESTS)
})

test('③ 变异咬合:逐条删锚点 ⇒ 对应 path-missing 判红', () => {
  for (const p of CLEANUP_PATHS) {
    const red = evaluate({ files: fixture({ omit: [p.id] }) })
    assert.equal(red.ok, false, `删 ${p.id} 必须判红`)
    assert.ok(
      red.violations.some((v) => v.kind === 'path-missing' && v.detail.startsWith(p.id)),
      `${p.id} 必须产出对应 path-missing`,
    )
  }
})

test('④ 反假绿:注释锚点不算 / 单测不足 / 缺关键文件 / 空面', () => {
  const commented = evaluate({ files: fixture({ commentOut: ['tree-kill-win', 'timeout-path'] }) })
  assert.ok(commented.violations.some((v) => v.detail.startsWith('tree-kill-win')))
  assert.ok(commented.violations.some((v) => v.detail.startsWith('timeout-path')))

  const few = fixture()
  few.find((f) => f.rel === TERMINAL_REL).source = few
    .find((f) => f.rel === TERMINAL_REL)
    .source.replace(/#\[test\]/g, '// #[test]')
  assert.ok(evaluate({ files: few }).violations.some((v) => v.kind === 'tests-below-floor'))

  const noOrphan = fixture().filter((f) => f.rel !== ORPHAN_REL)
  for (let i = 0; noOrphan.length < MIN_RUST_FILES; i += 1) {
    noOrphan.push({ rel: `apps/desktop/src-tauri/src/x_${i}.rs`, source: '// f' })
  }
  assert.ok(evaluate({ files: noOrphan }).violations.some((v) => v.kind === 'file-missing'))

  assert.equal(evaluate({ files: [] }).violations[0].kind, 'empty-face')
})

test('⑤ 判据边界:本门判静态路径完整,不把运行时进程数=0 写成通过', () => {
  // 绿夹具在无任何进程树实跑的前提下通过 —— 证明门判定范围就是静态路径本身,
  // 若有人把它误读/误改成"运行时已验证进程数归零",这条夹具的存在即是反证。
  assert.equal(evaluate({ files: fixture() }).ok, true)
  assert.equal(
    CLEANUP_PATHS.some((p) => /process.?count|进程数/.test(p.id)),
    false,
    '锚点里不应出现运行时进程数断言(那不是静态可判)',
  )
})
