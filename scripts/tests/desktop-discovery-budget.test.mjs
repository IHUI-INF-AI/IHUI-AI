// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面"发现射程"巡检的镜像测试(2026-11-02 立)。
 *
 * 立因:运行期解析桌面版靠分页翻 GitHub `/releases`(创建时间倒序),而 Android nightly 每跑
 * 一次就多一枚 release ⇒ 桌面版离第一页越来越远(2026-11-02 实测:第一页 100 条全是 nightly,
 * `desktop-v0.1.76` 在第 3 页)。分页有上限,顶穿的那一刻**不报错**,只是安静退回入库快照 ——
 * 与同族"造好没装车"(§0.9)同一型失效:安静。所以这一格既要有尺子,也要有调度器,还要有
 * 把两者钉在一起的锁。
 *
 * 钉死七件事:
 *   T1 pass ⇒ 绿行点名 pages/maxPages 读数,且不发信;
 *   T2 fail ⇒ 发信一次,dedupKey 只放稳定身份(cause + held,不含会抖的页数/时刻,§5e-3),
 *             正文必须给两条当场可改的出路(§5e-1 可整改性准入);
 *   T3 undetermined ⇒ 不喊人(出口取不到不是缺陷);
 *   T4 结论不可解析 ⇒ judged=false,**绝不记绿**(否则"尺子坏了"与"射程有余量"长得一样);
 *   T5 节流窗口内不第二次派发;
 *   T6 装车锁:调度器定义在、调用挂在巡检轮体内、在出口表里、间隔可由 env 覆盖;
 *   T7 契约锁:调度器读的 JSON 键必须真存在于尺子 `toVerdict` 的出口(不手抄形状)。
 *   判据 import 尺子的 `__test__`,本文件零复算(§22c)。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as budgetRuler } from '../check-desktop-release-discovery-budget.mjs'
import { sweepDesktopDiscoveryBudget } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPTS_DIR, '..', '..')

function harness({ stdout, status = 0, scratchName = 'desktop-budget' } = {}) {
  const scratch = mkScratch(scratchName)
  const calls = []
  const logs = []
  const result = sweepDesktopDiscoveryBudget({
    now: Date.parse('2026-11-02T12:00:00.000Z'),
    tickFile: join(scratch, 'tick.ts'),
    firstFile: join(scratch, 'first.json'),
    lastFile: join(scratch, 'last.json'),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, opts) => calls.push({ title, body, opts }),
    runner: () => ({ status, stdout, stderr: '' }),
  })
  return { result, calls, logs, scratch }
}

test('T1 pass ⇒ 绿行点名读数,不发信', () => {
  const h = harness({
    stdout: JSON.stringify({
      state: 'pass',
      scan: { pages: 3, maxPages: 10, scanned: 201, partial: false },
      red: [],
      undetermined: [],
    }),
  })
  assert.equal(h.result.judged, true)
  assert.equal(h.result.reds, 0)
  assert.equal(h.calls.length, 0, 'pass 不该发信')
  assert.match(h.logs.join('\n'), /OK：第 3\/10 页|OK:第 3\/10 页/)
  rmScratch(h.scratch)
})

test('T2 fail ⇒ 发信一次,身份只放稳定维度,正文给两条可改出路', () => {
  const h = harness({
    stdout: JSON.stringify({
      state: 'fail',
      scan: { pages: 10, maxPages: 10, scanned: 1000, partial: false },
      red: [{ id: 'pages', detail: '已翻到第 10/10 页(scanned=1000)', state: 'breach' }],
      undetermined: [],
    }),
  })
  assert.equal(h.calls.length, 1)
  const { opts, body, title } = h.calls[0]
  assert.match(String(opts.dedupKey), /^verdict=fail;cause=pages-at-ceiling;held=/)
  assert.doesNotMatch(String(opts.dedupKey), /1000|2026-|:/, '身份里不得混入原始计数/时刻')
  assert.match(body, /RELEASE_PAGE_MAX_PAGES/, '出路① 必须点名唯一可调处')
  assert.match(body, /releases\/tags\//, '出路② 必须给出免翻页的正解')
  assert.match(title, /射程/)
  rmScratch(h.scratch)
})

test('T2b 有页取不到 ⇒ cause 换成 page-unreachable(与"触顶"是两种整改)', () => {
  const h = harness({
    stdout: JSON.stringify({
      state: 'fail',
      scan: { pages: 2, maxPages: 10, scanned: 100, partial: true },
      red: [{ id: 'partial', detail: '有页取不到', state: 'breach' }],
      undetermined: [],
    }),
  })
  assert.match(String(h.calls[0].opts.dedupKey), /cause=page-unreachable/)
  rmScratch(h.scratch)
})

test('T3 undetermined ⇒ 不喊人,只写日志', () => {
  const h = harness({
    stdout: JSON.stringify({
      state: 'undetermined',
      scan: null,
      red: [],
      undetermined: [{ id: 'endpoint', detail: '出口取不到', state: 'unjudged' }],
    }),
  })
  assert.equal(h.calls.length, 0)
  assert.equal(h.result.judged, false)
  assert.equal(h.result.undetermined, 1)
  rmScratch(h.scratch)
})

test('T4 结论不可解析 ⇒ judged=false,绝不记绿', () => {
  const h = harness({ stdout: 'not json at all', status: 2 })
  assert.equal(h.result.judged, false)
  assert.equal(h.calls.length, 0, '拿不到结论时不发信,但也不能报成没事')
  assert.match(h.logs.join('\n'), /未判定/)
  rmScratch(h.scratch)
})

test('T5 节流窗口内第二次不派发', () => {
  const good = JSON.stringify({ state: 'pass', scan: { pages: 1, maxPages: 10 }, red: [], undetermined: [] })
  const first = harness({ stdout: good, scratchName: 'desktop-budget-throttle' })
  let dispatched = false
  const second = sweepDesktopDiscoveryBudget({
    now: first.result ? Date.parse('2026-11-02T12:30:00.000Z') : 0,
    tickFile: join(first.scratch, 'tick.ts'),
    firstFile: join(first.scratch, 'first.json'),
    lastFile: join(first.scratch, 'last.json'),
    logger: () => {},
    notify: () => {},
    runner: () => {
      dispatched = true
      return { status: 0, stdout: good, stderr: '' }
    },
  })
  assert.equal(second.ran, false)
  assert.equal(dispatched, false, '30 分钟后仍在 6h 窗口内 ⇒ 不该再打公网')
  rmScratch(first.scratch)
})

test('T6 装车锁:定义/调用/出口/env 可覆盖 四项齐(§0.9 已接线才算存在)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(src, /export function sweepDesktopDiscoveryBudget\(/, '调度器必须导出')
  assert.match(src, /if \(!CHECK_ONLY\) sweepDesktopDiscoveryBudget\(\)/, '必须挂在巡检轮体内')
  assert.match(src, /sweepDesktopDiscoveryBudget,\n/, '必须在出口表里(测试与外部可 import)')
  assert.match(src, /IHUI_DESKTOP_BUDGET_INTERVAL_MS/, '节流必须可由 env 覆盖')
  assert.ok(
    existsSync(join(ROOT, 'scripts', 'check-desktop-release-discovery-budget.mjs')),
    '派发的目标文件必须真在位(门 89 R7 同型)',
  )
})

test('T7 契约锁:调度器读的键 = 尺子 toVerdict 真实出口(不手抄形状)', () => {
  const verdict = budgetRuler.toVerdict(
    budgetRuler.judgeDiscoveryBudget({ pages: 10, maxPages: 10, scanned: 1000, partial: false }),
    'fixture',
  )
  for (const key of ['state', 'red', 'undetermined', 'scan']) {
    assert.ok(key in verdict, `尺子出口必须含 ${key},否则调度器永远读成未判定`)
  }
  assert.equal(verdict.state, 'fail')
  assert.equal(budgetRuler.judgeDiscoveryBudget({ pages: 3, maxPages: 10 }).level, 'ok')
  assert.equal(budgetRuler.judgeDiscoveryBudget(null).level, 'unjudged', '缺输入不冒充绿(§0.3)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
