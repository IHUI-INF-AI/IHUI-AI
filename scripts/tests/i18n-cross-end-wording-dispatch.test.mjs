// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端同名键文案漂移巡检腿(`auditI18nCrossEndWording`)的镜像测试。
 *
 * 立因:尺子 `scripts/check-i18n-cross-end-wording.mjs` 是只读对账尺 —— 它刻意不进提交链
 * (判文案裁定面,存量未清时挂成提交门就是恒红门,§12e)。这类尺子的失效形态是**安静**:
 * 没有调度点就没人跑,没有寄信就没人知道它在报什么。所以本腿必须被钉住"真在被派生",
 * 而派生结论必须落进日志。
 *
 * 判据一律 import 生产出口(§22c),测试不复制一份豁免规则。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { auditI18nCrossEndWording, __test__ as WORDING } from '../git-guardian.mjs'
import { __test__ as ruler } from '../check-i18n-cross-end-wording.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const tickFile = () => join(mkScratch('i18n-xend-'), 'tick.json')

const body = (fn) => Function.prototype.toString.call(fn)

const verdict = (over = {}) => ({
  face: 'HEAD',
  sharedKeys: 2748,
  driftTotal: 42,
  cleared: 0,
  uncleared: [],
  invalid: [],
  expired: [],
  rot: [],
  waiverRows: 0,
  byKind: {},
  state: 'drift-uncleared',
  unclearedKeys: [],
  ...over,
})

test('D1 有未裁漂移 ⇒ 只写日志,不改守护退出码也不喊人', () => {
  const logs = []
  const r = auditI18nCrossEndWording({
    now: Date.parse('2026-10-30T00:00:00Z'),
    tickFile: tickFile(),
    logger: (m) => logs.push(String(m)),
    runner: () => ({
      ok: false,
      status: 1,
      out: JSON.stringify(verdict({ unclearedKeys: ['a.b', 'c.d'], uncleared: [1, 2] })),
      err: '',
    }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.state, 'drift-uncleared')
  assert.equal(r.ok, false, '有未裁 ⇒ 不记 ok')
  const j = logs.join('\n')
  assert.match(j, /漂移 42/)
  assert.match(j, /未裁 2/)
  // 形状锁:本腿**没有** notify 形参 —— 常态存量每 60 分钟寄一封会把人淹掉(§5e-1)。
  assert.doesNotMatch(
    body(auditI18nCrossEndWording).slice(0, 700),
    /notify/,
    '只读尺子的巡检不许自带到人通道',
  )
})

test('D2 全裁清 ⇒ state=clean 且日志仍出声(不能静默)', () => {
  const logs = []
  const r = auditI18nCrossEndWording({
    now: Date.parse('2026-10-30T00:00:00Z'),
    tickFile: tickFile(),
    logger: (m) => logs.push(String(m)),
    runner: () => ({
      ok: true,
      status: 0,
      out: JSON.stringify(verdict({ driftTotal: 0, state: 'clean' })),
      err: '',
    }),
  })
  assert.equal(r.ok, true)
  assert.match(logs.join('\n'), /state=clean/)
})

test('D3 结论取不到 ⇒ 记未判定,绝不折成"没有未裁漂移"(§0.3)', () => {
  const logs = []
  const r = auditI18nCrossEndWording({
    now: Date.parse('2026-10-30T00:00:00Z'),
    tickFile: tickFile(),
    logger: (m) => logs.push(String(m)),
    runner: () => ({ ok: false, status: null, out: '', err: 'boom' }),
  })
  assert.equal(r.ok, false)
  assert.equal(r.state, 'unparsed')
  assert.match(logs.join('\n'), /本轮没判/)
})

test('D4 节流窗口内 ⇒ 不派生第二次', () => {
  const fx = tickFile()
  let calls = 0
  const base = {
    tickFile: fx,
    logger: () => {},
    intervalMs: 60 * 60 * 1000,
    runner: () => {
      calls++
      return { ok: true, status: 0, out: JSON.stringify(verdict()), err: '' }
    },
  }
  auditI18nCrossEndWording({ ...base, now: Date.parse('2026-10-30T00:00:00Z') })
  const second = auditI18nCrossEndWording({ ...base, now: Date.parse('2026-10-30T00:30:00Z') })
  assert.equal(calls, 1, '窗口内不许再起子进程')
  assert.equal(second.ran, false)
  assert.equal(second.why, '未到节流窗口')
})

test('D5 装车锁:挂点在 !CHECK_ONLY、函数在 __test__ 出口、节流可由 env 覆盖', () => {
  assert.match(
    SRC,
    /if \(!CHECK_ONLY\) auditI18nCrossEndWording\(\)/,
    '必须挂在健康轮次的 !CHECK_ONLY 分支',
  )
  assert.match(SRC, /export function auditI18nCrossEndWording\(/, '函数必须存在')
  const t = SRC.slice(SRC.indexOf('export const __test__ = {'))
  assert.match(t, /\bauditI18nCrossEndWording,/, '镜像测试要能 import 到(§22c)')
  assert.match(SRC, /IHUI_I18N_CROSS_END_INTERVAL_MS/, '节流须留运维旋钮')
})

test('D6 派生 argv 是 --json 且无任何写盘旗标', () => {
  const site = SRC.slice(
    SRC.indexOf('export function auditI18nCrossEndWording'),
    SRC.indexOf('const CROSS_END_WEB_RN_INTERVAL_MS') >
      SRC.indexOf('export function auditI18nCrossEndWording')
      ? SRC.indexOf('export function auditI18nCrossEndWording') + 6000
      : SRC.length,
  )
  const argv = site.match(/execFileSync\(process\.execPath,\s*\[script,([^\]]*)\]/)
  assert.ok(argv, '派生 argv 必须能定位到(形制变了要同步本锁)')
  assert.match(argv[1], /--json/)
  assert.doesNotMatch(argv[1], /--(write|apply)/, '只读尺的巡检不许带写盘旗标')
})

test('D7 尺子的豁免类别允许集与"同屏两套字不可豁免"是同一份单源(§0.6)', () => {
  assert.ok(ruler.LEGAL_KINDS instanceof Set, '尺子必须导出类别允许集')
  assert.ok(!ruler.LEGAL_KINDS.has('same-screen-drift'), '同屏两套字是要修项,写进台账也不许消账')
  assert.equal(
    ruler.waiverProblem({
      key: 'x.y',
      kind: 'same-screen-drift',
      reason: 'x'.repeat(30),
      expires: '2099-01-01',
    }) !== null,
    true,
  )
  // 反向对照:同一份判据对合法类别必须放行(否则上面那条只是"什么都拦"的假锁)
  assert.equal(
    ruler.waiverProblem({
      key: 'x.y',
      kind: 'platform-adaptation',
      reason: '微信里给不出本机路径,只能从会话选择文件',
      expires: '2099-01-01',
    }),
    null,
  )
  assert.equal(typeof WORDING.auditI18nCrossEndWording, 'function', 'guardian 出口需可 import')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
