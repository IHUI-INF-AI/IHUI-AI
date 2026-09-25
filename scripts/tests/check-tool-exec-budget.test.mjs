// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:门 `scripts/check-tool-exec-budget.mjs` 的"判据是否还能咬人"证明。
//
// 为什么需要它而 `--self-test` 不够:self-test 判的是**判据语义**(在构造面上跑),
// 本文件判的是**这门与仓库的装配关系** —— 单一真相源有没有被抄成第二份、有没有被摘线、
// 有没有"声称已接线但其实没接"(守门 89 的 R1 型)、编号有没有撞车。
//
// 运行:`node --test scripts/tests/check-tool-exec-budget.test.mjs`

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as GATE } from '../check-tool-exec-budget.mjs'
import * as LIB from '../lib/tool-exec-budget.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_REL = 'scripts/check-tool-exec-budget.mjs'
const LIB_REL = 'scripts/lib/tool-exec-budget.mjs'
const RUNNER_REL = 'scripts/guardian-runner.mjs'

const gateSrc = readFileSync(path.join(ROOT, GATE_REL), 'utf8')
const libSrc = readFileSync(path.join(ROOT, LIB_REL), 'utf8')
const runnerSrc = existsSync(path.join(ROOT, RUNNER_REL))
  ? readFileSync(path.join(ROOT, RUNNER_REL), 'utf8')
  : ''

function runGate(args, opts = {}) {
  try {
    const out = execFileSync(process.execPath, [GATE_REL, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: opts.timeout ?? 120_000,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout: out, stderr: '' }
  } catch (e) {
    return {
      status: typeof e?.status === 'number' ? e.status : -1,
      stdout: String(e?.stdout ?? ''),
      stderr: String(e?.stderr ?? e?.message ?? ''),
    }
  }
}

test('T1 §22c 锚点:门必须 export __test__ 且带上本文件用到的键(漂移即红)', () => {
  for (const key of ['FIX_INDEX', 'FIX_SUBAGENT', 'assertNonEmptyScan', 'selfTest', 'FIXED_FILES']) {
    assert.ok(Object.prototype.hasOwnProperty.call(GATE, key), `__test__ 缺键 ${key}`)
  }
  assert.match(
    readFileSync(path.join(ROOT, 'scripts/tests/check-tool-exec-budget.test.mjs'), 'utf8'),
    /import\s*\{\s*__test__\s+as\s+GATE\s*\}\s*from\s*'\.\.\/check-tool-exec-budget\.mjs'/,
  )
})

test('T2 单一真相源:判据语义只在 lib 里一份,门不得原地重写一遍', () => {
  // 门里出现这些实现体 = 有人把判据抄回装配层(两处算同一件事必漂移,本仓记过多次)
  for (const forbidden of ['function maskCodeLines', 'function evalNumericExpr', 'function parseExecBudgetDeclarations']) {
    assert.ok(!gateSrc.includes(forbidden), `门里出现了第二份实现:${forbidden}`)
  }
  assert.ok(gateSrc.includes("from './lib/tool-exec-budget.mjs'"), '门没有从 lib 取判据')
  // lib 是纯判据层:碰了 fs / child_process / git 就没法用构造面证明
  for (const imp of ["from 'node:fs'", "from 'node:child_process'", "from './face-reader.mjs'"]) {
    assert.ok(!libSrc.includes(imp), `判据层引入了副作用依赖:${imp}`)
  }
})

test('T3 装车方向锁:门**尚未**接线时不得出现"已接"声称(守门 89 R1 型)', () => {
  const wired = runnerSrc.includes('check-tool-exec-budget')
  const claimsWired = /已接\s*pre-commit|已接入\s*guardian|第\s*\d+\s*项.*本门/.test(gateSrc)
  if (!wired) {
    assert.ok(!claimsWired, '未接线却声称已接 = 给下一道"看起来有其实没有"的门背书')
    assert.match(gateSrc, /尚未接进|接线由主会话/, '未接线必须在头注如实写明')
  }
  if (wired) {
    // 一旦接线:必须同时有 blocking 语义与应急跳过通道,否则恒红只能逼人 --no-verify
    assert.match(gateSrc, /HUSKY_SKIP_TOOL_EXEC_BUDGET/, '接线后门必须自带应急跳过通道')
    const block = runnerSrc.slice(runnerSrc.indexOf('check-tool-exec-budget') - 600, runnerSrc.indexOf('check-tool-exec-budget') + 600)
    assert.match(block, /blocking/, '接线后必须是 blocking(不得静默降成 warn)')
  }
})

test('T4 反假绿:空枚举与缺必在场文件都必须"无法判定"而非绿', () => {
  assert.throws(() => GATE.assertNonEmptyScan([]), /无法判定/)
  assert.throws(() => GATE.assertNonEmptyScan(['apps/cli/src/tools/other.ts']), /必须在场文件缺失/)
  assert.equal(GATE.assertNonEmptyScan([...GATE.FIXED_FILES]), GATE.FIXED_FILES.length)
})

test('T5 判据有牙(构造面):摘掉封顶行 / 摘掉子 loop 的 signal 必红', () => {
  const clean = LIB.findMechanismGaps(GATE.FIX_INDEX)
  assert.deepEqual(
    clean.map((g) => g.id),
    [],
    `合成机制文件本身被判缺:${JSON.stringify(clean)}`,
  )
  const noCap = LIB.findMechanismGaps(GATE.FIX_INDEX.replace('Math.min(safe, TOOL_EXEC_BUDGET_MAX_MS)', 'safe'))
  assert.ok(noCap.some((g) => g.id === 'S1b-cap'), '删掉封顶行仍判绿 ⇒ 本门对自己的产出形态是盲的')
  const noSignal = LIB.findSubagentGaps(GATE.FIX_SUBAGENT.replace('signal: outerCtx.signal,', ''))
  assert.ok(noSignal.some((g) => g.id === 'S1e'), '子 loop 摘掉 signal 仍判绿 ⇒ 取消下发那一半没人看守')
})

test('T6 声明侧合法/非法成对:空壳 reason 与越封顶必红,合法声明不红', () => {
  const cap = LIB.parseExecBudgetConstants(GATE.FIX_INDEX).maxMs
  const bad = (src) => LIB.auditFile('apps/cli/src/tools/x.ts', src, cap).hard.map((h) => h.id)
  assert.ok(bad('const t = { execBudget: { notInterruptible: true, reason: "*/ " } };\n').includes('B1-reason-hollow'))
  assert.ok(bad(`const t = { execBudget: { ms: ${cap + 1} } };\n`).includes('B1-ms-over-cap'))
  assert.deepEqual(bad('const t = { execBudget: { ms: 1500 } };\n'), [])
  // 反向锁:注释里的示例不得被判成声明(否则门在自己的说明里红)
  assert.equal(LIB.auditFile('apps/cli/src/tools/x.ts', '// execBudget: { ms: 1 }\nconst a = 1\n').declarations, 0)
})

test('T7 禁用命名:新造 budget-exempt 通道直接判红(结构性声明不得混进到期豁免账)', () => {
  assert.deepEqual(LIB.findForbiddenExemptMarkers('const a = 1 // budget-exempt: 开后门\n'), [1])
  assert.deepEqual(LIB.findForbiddenExemptMarkers('const a = 1\n'), [])
})

test('T8 CLI 三态:--self-test 必 0;两面旗标同给必 2;--worktree --json 必可 parse', () => {
  const st = runGate(['--self-test'])
  assert.equal(st.status, 0, `self-test 退出码 ${st.status}:${st.stderr.slice(0, 400)}`)
  assert.match(st.stdout, /0 失败/)
  const both = runGate(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stderr.slice(0, 300))
  const wt = runGate(['--worktree', '--json'])
  assert.ok(wt.status === 0 || wt.status === 1, `unexpected exit ${wt.status}: ${wt.stderr.slice(0, 300)}`)
  const parsed = JSON.parse(wt.stdout.split(/\r?\n/)[0])
  assert.ok(Array.isArray(parsed.hard), '--json 输出缺 hard 字段')
  assert.ok(parsed.scanned > 0, '--json 枚举到 0 个文件却回了解析得了的结论')
})

test('T9 真仓工作树面:机制在位 ⇒ 无硬违规(与 HEAD 面的"改前必红"互为对照)', () => {
  const r = runGate(['--worktree'])
  assert.equal(r.status, 0, `工作树面退出码 ${r.status}:${r.stdout.slice(-800)}${r.stderr.slice(-800)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
