// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/benchmark-frame-end-matrix.mjs(D160 我方侧「帧 × 端」对账器)。
// 判据一律 import 源实现,本文件不抄第二份解析/分类逻辑(抄了就等于测自己)。
// 跑法:node --test scripts/tests/benchmark-frame-end-matrix.test.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { __test__ as tool } from '../benchmark-frame-end-matrix.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'benchmark-frame-end-matrix.mjs')
const SOURCE = readFileSync(SCRIPT, 'utf8')

function run(args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 540000,
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? 2, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

const TS_FIXTURE = `export const SSE_EVENTS = { A: 'chunk', B: 'done', C: 'plan_updated', D: 'citations', E: 'goal_updated', F: 'terminal_delta', G: 'injection_applied', H: 'error', I: 'budget', J: 'fallback', K: 'retry_scheduled' } as const\nexport const SSE_EVENT_NAMES = Object.values(SSE_EVENTS)`
const PY_FIXTURE = 'SSE_EVENTS: frozenset[str] = frozenset(\n    "chunk",\n    "done",\n    "plan_updated",\n    "citations",\n    "goal_updated",\n    "terminal_delta",\n    "injection_applied",\n    "error",\n    "budget",\n    "fallback",\n    "retry_scheduled",\n)\n'

test('T1 出口成套:解析与分类必须由源文件导出(测试面不得有第二份实现)', () => {
  for (const k of ['parseTsNames', 'parsePyNames', 'dispatchPatterns', 'classifyCell', 'buildMatrix', 'render'])
    assert.equal(typeof tool[k], 'function', `必须导出 __test__.${k}`)
  assert.equal(/function\s+(parseTsNames|parsePyNames|classifyCell)\s*\(/.test(readFileSync(fileURLToPath(import.meta.url), 'utf8')), false, '镜像里不得重写判据')
})

test('T2 §22d:CLI 入口有 isDirectRun 守卫,且 __test__ 在其后(本文件 import 未触发 main)', () => {
  assert.match(SOURCE, /pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.ok(SOURCE.indexOf('export const __test__') > SOURCE.indexOf('if (isDirectRun)'), '__test__ 必须在入口守卫之后')
})

test('T3 两份契约的解析形状(TS 按值、py 按 frozenset 深度配平)', () => {
  assert.equal(tool.parseTsNames(TS_FIXTURE).size, 11)
  assert.equal(tool.parsePyNames(PY_FIXTURE).size, 11)
  assert.ok(tool.parseTsNames(TS_FIXTURE).has('goal_updated'))
})

test('T4 帧名太少 ⇒ 判据失效就拒绝出表(不得静默出一张缺半的表)', () => {
  assert.throws(() => tool.parseTsNames(`export const SSE_EVENTS = { A: 'chunk' } as const`), /判据失效|拒绝出表/)
  assert.throws(() => tool.parsePyNames('SSE_EVENTS: frozenset[str] = frozenset(\n    "chunk",\n)\n'), /判据失效|拒绝出表/)
  assert.throws(() => tool.parseTsNames('没有那个常量'), /找不到 SSE_EVENTS/)
})

test('T5 分派位模式必须是 POSIX ERE —— (?: 会让每条 git grep fatal 而 stdout 为空(真实自伤)', () => {
  for (const [, pat] of tool.dispatchPatterns('citations')) assert.ok(!pat.includes('(?:'), `模式含 (?: ⇒ git 会 fatal:${pat}`)
  assert.equal(tool.dispatchPatterns('citations').length, 3)
})

test('T6 四态分类互斥:判不出不得被吞成"没有",仅测试面不得被吞成"有"', () => {
  assert.equal(tool.classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 2, sample: '' }).state, 'undetermined')
  assert.equal(tool.classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 0, sample: '' }).state, 'absent')
  assert.equal(tool.classifyCell({ dispatchProd: [], dispatchAll: [{ line: 'HEAD:a.test.ts:1', kind: 'switch' }], quotedProd: 0, sample: '' }).state, 'testOnly')
  assert.equal(tool.classifyCell({ dispatchProd: [{ kind: 'table', at: 'x.ts:1' }], dispatchAll: [], quotedProd: 0, sample: '' }).state, 'wired')
})

test('T7 渲染必须把三态与"本机不下已实测结论"写进正文', () => {
  const md = tool.render(
    {
      frames: ['chunk'],
      cells: [
        tool.ENDS.map((_, i) =>
          i === 0
            ? tool.classifyCell({ dispatchProd: [{ kind: 'switch', at: 'a:1' }], dispatchAll: [], quotedProd: 0, sample: '' })
            : i === 1
              ? tool.classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 3, sample: '' })
              : tool.classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 0, sample: '' }),
        ),
      ],
      counts: { ts: 1, py: 1 },
    },
    'scripts/benchmark-frame-end-matrix.mjs',
  )
  assert.ok(md.includes('有·switch'))
  assert.ok(md.includes('判不出(字面量 3 处'))
  assert.ok(md.includes('一律不下"已实测"结论'), '到端渲染本机不可取证,必须在表里说明')
  assert.ok(/不得[\s\S]{0,12}被读成"该端没有这一能力"/.test(md), '`—` 的三种判不出形态必须写明(判不出不得洗成"没有")')
})

test('T8 空枚举/取材失败必须大声:守卫在源码里,不在注释里', () => {
  assert.match(SOURCE, /GREP_ERRORS/, '必须有 git 报错收集器')
  assert.match(SOURCE, /拒绝出表/, '报错非零 ⇒ 拒绝出表')
  assert.match(SOURCE, /if \(errors\.length > 0\)[\s\S]{0,160}return 1/, 'main 必须因报错返回 1')
})

test('T9 端到端:--self-test 必须零失败(不接受"跑过一次")', () => {
  const { rc, out } = run(['--self-test'])
  assert.equal(rc, 0, out)
  assert.match(out, /❌ 0 条/)
})

test('T10 端到端:真跑一次生成(--stdout)必须拿到与文件同样形的表', () => {
  const { rc, out } = run(['--stdout'])
  assert.equal(rc, 0, out.slice(0, 400))
  const rowLines = out.split('\n').filter((l) => /^\| `/.test(l))
  assert.ok(rowLines.length >= 20, `表体只有 ${rowLines.length} 行 ⇒ 帧全集解析退化`)
  assert.ok(out.includes('有·') || out.includes('判不出'), '表里必须至少有一格是判定结果(全空 = 尺子空转)')
})

test('T11 反向锁:工具不得被接进提交链(它判的是清单与代码是否一致,与提交内容无关)', () => {
  const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.equal(runner.includes('benchmark-frame-end-matrix'), false, '接入提交链需先满足 AGENTS §12f 的前置,不能顺手接')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
