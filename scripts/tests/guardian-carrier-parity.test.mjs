// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * guardian-carrier-parity.test.mjs —— 承载面齐平判据的镜像锁(§22c:import 源判据,零复算)
 *
 * 变异自证在册:
 *   · 把"按函数边界划区"换成"按固定行号划区"⇒ P9(插行后同集)立刻翻红;
 *   · 把"某面枚举到 0 ⇒ unjudged"摘掉 ⇒ P6 会读成"齐平"(正是最危险的假绿);
 *   · 把"被审面取不到 ⇒ unjudged"摘掉 ⇒ P5 会扫别的面顶替。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { __test__ as cp } from '../lib/guardian-carrier-parity.mjs'

const SRC = [
  '// 头注',
  'const X = 1',
  'function helperA() { sweepAlpha(); return 1 }',
  'async function main() {',
  '  dispatchDeployFeedback()',
  '  sweepStaleClosedRows()',
  '  healCrossEndMirror()',
  '  if (!CHECK_ONLY) auditOpsPatrol()',
  '}',
  'function startDaemon() {',
  '  dispatchRelayCapacity()',
  '  sweepStaleClosedRows()',
  '  auditOpsPatrol()',
  '}',
  'export function otherThing() { healNotCalledAnywhere() }',
].join('\n')

test('P1 只在 main 里的腿进 dark,两面都有的不进', () => {
  const r = cp.judgeCarrierParity({ source: SRC })
  assert.equal(r.state, 'drift')
  assert.deepEqual(r.dark, ['dispatchDeployFeedback', 'healCrossEndMirror'])
  assert.ok(!r.dark.includes('sweepStaleClosedRows'), '两面都调用过 ⇒ 不算黑腿')
  assert.ok(!r.dark.includes('auditOpsPatrol'), '被 if 包住的调用也要认(dark 里不该有它)')
})

test('P2 两面齐平 ⇒ ok(反向档:不能恒红)', () => {
  const flat = SRC.replace('function startDaemon() {', 'function startDaemon() {\n  dispatchDeployFeedback()\n  healCrossEndMirror()')
  const r = cp.judgeCarrierParity({ source: flat })
  assert.equal(r.darkCount, 0, JSON.stringify(r.dark))
  assert.equal(r.state, 'ok')
  assert.match(r.why, /已齐平/)
})

test('P3/P4 找不到 main 或 startDaemon ⇒ unjudged(绝不扫整文件顶替)', () => {
  assert.equal(cp.judgeCarrierParity({ source: SRC.replace(/async function main/g, 'async function mant') }).state, 'unjudged')
  assert.equal(cp.judgeCarrierParity({ source: SRC.replace(/function startDaemon/g, 'function startDamon') }).state, 'unjudged')
})

test('P5 被审面空 ⇒ unjudged', () => {
  for (const bad of ['', '   ', null, undefined]) {
    const r = cp.judgeCarrierParity({ source: bad })
    assert.equal(r.state, 'unjudged')
    assert.ok(r.why.length > 5, '未判定必须点名原因')
  }
})

test('P6 某一面枚举到 0 ⇒ unjudged,不读成"齐平"(假绿最贵)', () => {
  const noDaemonCalls = 'async function main() {\n  sweepAlpha()\n}\nfunction startDaemon() {\n  const x = 1\n  return x\n}\n'
  const r = cp.judgeCarrierParity({ source: noDaemonCalls })
  assert.equal(r.state, 'unjudged', r.why)
  assert.equal(r.daemonCount, 0)
})

test('P7 注释里的调用点不计(否则定义与散文会冒充调用)', () => {
  const commented = SRC.replace('  healCrossEndMirror()', '  // healCrossEndMirror() 已摘线,见工单')
  const r = cp.judgeCarrierParity({ source: commented })
  assert.ok(!r.dark.includes('healCrossEndMirror'), '被注释掉的调用不该算作 main 面在跑')
})

test('P9 变异档:在前面插 7 行注释后,dark 集必须一模一样(证明按函数边界而非行号)', () => {
  const shifted = ['// 别人 append 了一行', '// 又一行', '', '/* 块注释 */', '// 第四', '// 第五', '// 第六'].join('\n') + '\n' + SRC
  const a = cp.judgeCarrierParity({ source: SRC })
  const b = cp.judgeCarrierParity({ source: shifted })
  assert.deepEqual(b.dark, a.dark, '行号漂移不得改变判定')
  assert.equal(b.state, a.state)
})

test('P8 现读 git-guardian:已迁移的腿不得再被判黑(回归锁,不钉会变的计数)', () => {
  const head = execSync('git show HEAD:scripts/git-guardian.mjs', { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  const r = cp.judgeCarrierParity({ source: head })
  assert.notEqual(r.state, 'unjudged', `本维必须判得出,实为 unjudged:${r.why}`)
  // 2026-11-04 承载面补齐那枚搬进 daemon tick 的,逐条抽查:搬了就不许再算黑腿
  for (const n of [
    'dispatchDeployFeedback',
    'dispatchDeployOutcomeIntake',
    'dispatchE2eAutofill',
    'sweepStaleClosedRows',
    'sweepExposedCredentialRotation',
    'healCrossEndMirror',
    'auditLandedReverts',
    // 第二批(原先整条链无节流、靠调用点 legThrottle 才敢上常驻面的四条)
    'auditMergeAdditionLoss',
    'refreshRecoverySource',
    'rotateRunLogs',
    'reportBaselineFreshness',
  ]) {
    assert.ok(!r.dark.includes(n), `${n} 已挂常驻面,不得再被判黑腿`)
  }
  // 反向对照:原本就在常驻面上的也不得被误列
  assert.ok(!r.dark.includes('dispatchRelayCapacity'), 'relay-capacity 一直在 daemon tick 里')
  assert.ok(!r.dark.includes('auditOpsPatrol'), 'auditOpsPatrol 一直在 daemon tick 里')
  // 残余是"待逐条裁决"的债,必须是小额且可数的;不许回到几十条(那说明有人新挂了个只走 main 的腿)
  assert.ok(r.darkCount <= 10, `残余黑腿应是个位数量级,现读 ${r.darkCount}:${r.dark.join(', ')}`)
})

test('P10 腿与助手的区分按定义签名,不按调用点写法(摘掉即漏计/误计)', () => {
  const F = cp.isLegDefinition
  const L = (n) => `sweep${n}` // 用合前缀的名字单测签名判定,名字维由 P12 单独管
  // 腿:无形参 或 形参全带默认值 ⇒ 可以在调度位上裸调
  assert.ok(F(`function ${L('A')}() {`), '无参 = 腿')
  assert.ok(F(`export function ${L('B')}(opts = {}) {`), 'opts={} = 腿')
  assert.ok(F(`function ${L('C')}({ logger = log } = {}) {`), '解构+整参带默认 = 腿(深度 0 的 = 才算)')
  assert.ok(F(`function ${L('D')}(...args) {`), 'rest 形参天然可省 = 腿')
  // 助手:必需的解构形参(调用方必须交值)⇒ 不是调度点
  assert.ok(!F(`function ${L('E')}({ title, desp, severity, dryRun = false }) {`), '必需解构形参 = 助手')
  assert.ok(!F(`function ${L('F')}(a, b) {`), '必需形参 = 助手')
  // 名字不匹配腿前缀 ⇒ 不判为"前缀腿"(但可能是 unclassified,见 P12)
  assert.ok(!F('function helperA(opts = {}) {'), '非腿前缀不进 legs 集')
  assert.ok(!F('function broken(opts {'), '签名括号不配平 ⇒ 不认')
})

test('P15 §7 装车表对账:只在一次性 main 上的声称 ⇒ drift 点名;两面都有 ⇒ ok;两面都无 ⇒ absent', () => {
  const doc = ['# 题', '## 7. 装车状态', '| 器物 | 载体 | 频率 |', '|---|---|---|', '| a.mjs | `dispatchBoth()` | 60min |', '| b.mjs | `dispatchMainOnly()` | 30min |', '| c.mjs | `dispatchNowhere()` | 1h |'].join('\n')
  const src = [
    'async function main() {',
    '  dispatchBoth()',
    '  dispatchMainOnly()',
    '}',
    'function startDaemon() {',
    '  dispatchBoth()',
    '  dispatchResidentOnly()',
    '}',
    'function dispatchBoth() {}',
    'function dispatchMainOnly() {}',
    'function dispatchResidentOnly() {}',
  ].join('\n')
  const r = cp.judgeRoadmapClaims({ guardianSource: src, roadmapText: doc })
  assert.equal(r.state, 'drift', r.why)
  assert.equal(r.darkCount, 2)
  const byName = Object.fromEntries(r.rows.map((x) => [x.carrier, x.state]))
  assert.equal(byName.dispatchBoth, 'ok', '两面都接 ⇒ 声明成立')
  assert.equal(byName.dispatchMainOnly, 'dark', '声称已装车但只挂 main ⇒ 就是这次 46 条那一型')
  assert.equal(byName.dispatchNowhere, 'absent', '挂点根本不存在 ⇒ 另一型假声明')
  assert.match(r.why, /只在一次性 main/)
})

test('P16 对账取不到输入 ⇒ 未判定(不拿"读不到"冒充"无声明"或"全部已装车")', () => {
  const doc = '## 7. 装车状态\n| a | `dispatchX()` |\n'
  assert.equal(cp.judgeRoadmapClaims({ guardianSource: '', roadmapText: doc }).state, 'unjudged')
  assert.equal(cp.judgeRoadmapClaims({ guardianSource: 'function main() {}', roadmapText: doc }).state, 'unjudged')
  assert.equal(cp.judgeRoadmapClaims({ guardianSource: 'async function main() {}\nfunction startDaemon() {}\n', roadmapText: '' }).state, 'unjudged')
  // 表里一条派发点都解析不到 ⇒ 不读成"无需对账"
  const empty = cp.judgeRoadmapClaims({
    guardianSource: 'async function main() {\n  dispatchX()\n}\nfunction startDaemon() {\n  dispatchX()\n}\nfunction dispatchX() {}',
    roadmapText: '## 7. 装车状态\n| 器物 | 载体 |\n| a.mjs | 人工 CLI |',
  })
  assert.equal(empty.state, 'unjudged', empty.why)
})

test('P17 现读:§7 那张表此刻的每一条守护载体声称,都必须在常驻面上(回归锁)', () => {
  const guardian = execSync('git show HEAD:scripts/git-guardian.mjs', { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  const roadmap = execSync('git show HEAD:docs/self-evolution-roadmap.md', { maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  const r = cp.judgeRoadmapClaims({ guardianSource: guardian, roadmapText: roadmap })
  assert.notEqual(r.state, 'unjudged', `本维必须判得出:${r.why}`)
  assert.ok(r.rows.length >= 4, `§7 应至少对账 4 条守护载体声称,现读 ${r.rows.length}`)
  const bad = r.rows.filter((x) => x.state !== 'ok')
  assert.deepEqual(bad.map((x) => x.carrier), [], `装车表声称与常驻承载面不符:${JSON.stringify(bad)}`)
})

test('P13 具名豁免四档成对:有效摘掉 / 到期照判 / 形状坏视同没登记 / 不再命中=腐烂', () => {
  const NOW = Date.parse('2026-11-04T00:00:00.000Z')
  const good = { name: 'ensureGuardDaemonAlive', owner: 'main 路径', reason: '它负责把不在的 daemon 拉起,挂进 daemon 自己里等于监视自己', expires: '2027-02-01' }
  const r1 = cp.applyCarrierExemptions(['ensureGuardDaemonAlive', 'rotateRunLogs'], [good], NOW)
  assert.deepEqual(r1.waived, ['ensureGuardDaemonAlive'])
  assert.deepEqual(r1.darkRemaining, ['rotateRunLogs'], '没被豁免的那条必须仍判黑')

  // 到期 ⇒ 不摘,进 expired
  const r2 = cp.applyCarrierExemptions(['X'], [{ ...good, name: 'X', expires: '2026-01-01' }], NOW)
  assert.deepEqual(r2.expired, ['X'])
  assert.deepEqual(r2.darkRemaining, ['X'], '到期必须照旧判黑,不许静默放行')

  // 形状坏三型 ⇒ 视同没登记
  for (const bad of [
    { ...good, name: 'X', reason: '太短' },
    { name: 'X', reason: good.reason, expires: '2027-02-01' },
    { ...good, name: 'X', expires: '不是日期' },
  ]) {
    const r = cp.applyCarrierExemptions(['X'], [bad], NOW)
    assert.deepEqual(r.malformed, ['X'], `形状坏应被点名:${JSON.stringify(bad).slice(0, 60)}`)
    assert.deepEqual(r.darkRemaining, ['X'], '形状坏 ⇒ 照旧判黑')
  }

  // 登记的 name 当下面不再命中 ⇒ 清单腐烂
  const r4 = cp.applyCarrierExemptions(['other'], [{ ...good, name: 'Gone' }], NOW)
  assert.deepEqual(r4.rotting, ['Gone'], '豁免清单里躺着一条不再命中的 ⇒ 腐烂同红(§0.7)')
})

test('P14 豁免必须能整维清零(否则 A9 就是恒红门,§12e)', () => {
  const src = [
    'async function main() {',
    '  ensureGuardDaemonAlive()',
    '  rotateOnlyMain()',
    '  auditShared(opts = 1)',
    '}',
    'function startDaemon() {',
    '  auditShared(opts = 1)',
    '}',
    'function auditShared(opts = {}) {}',
    'function ensureGuardDaemonAlive() {}',
    'function rotateOnlyMain() {}',
  ].join('\n')
  const NOW = Date.parse('2026-11-04T00:00:00.000Z')
  const base = cp.judgeCarrierParity({ source: src, exemptions: [], now: NOW })
  assert.equal(base.state, 'drift')
  assert.deepEqual(base.dark, ['ensureGuardDaemonAlive', 'rotateOnlyMain'])
  const waived = cp.judgeCarrierParity({
    source: src,
    exemptions: [
      { name: 'ensureGuardDaemonAlive', owner: 'o', reason: '它负责把不在的 daemon 拉起,挂进 daemon 自己里等于监视自己', expires: '2027-02-01' },
      { name: 'rotateOnlyMain', owner: 'o', reason: '动的是 daemon 自己正在写的日志面,归一次性档', expires: '2027-02-01' },
    ],
    now: NOW,
  })
  assert.equal(waived.state, 'ok', waived.why)
  assert.deepEqual(waived.dark, [])
  assert.equal(waived.waived.length, 2, '摘掉的必须在读数里点名,不许静默')
})

test('P12 不合腿名前缀但是真腿的,必须走 unclassified 点名(假绿最贵)', () => {
  const src = [
    'async function main() {',
    '  devenvMigratePatrol({ logger: log })',
    '  auditResident(opts)',
    '}',
    'function startDaemon() {',
    '  auditResident(opts)',
    '}',
    'function auditResident(opts = {}) {}',
    'function devenvMigratePatrol({ logger = log } = {}) {}',
  ].join('\n')
  const r = cp.judgeCarrierParity({ source: src })
  assert.deepEqual(r.unclassifiedDark, ['devenvMigratePatrol'], '名字不合规的真腿只挂 main ⇒ 必须被点名')
  assert.ok(r.dark.includes('~devenvMigratePatrol'), 'dark 集里要带 ~ 前缀显式区分"未归类"')
  assert.equal(r.state, 'drift')
  // 反向成对:两面都挂 ⇒ 不许进 unclassifiedDark
  const both = [
    'async function main() {',
    '  devenvMigratePatrol({ logger: log })',
    '  auditResident(opts)',
    '}',
    'function startDaemon() {',
    '  auditResident(opts)',
    '  devenvMigratePatrol({ logger: log })',
    '}',
    'function auditResident(opts = {}) {}',
    'function devenvMigratePatrol({ logger = log } = {}) {}',
  ].join('\n')
  const r2 = cp.judgeCarrierParity({ source: both })
  assert.deepEqual(r2.unclassifiedDark, [], '两面都有 ⇒ 不该被列')
  // 谓词位/取值位的调用不算排班(否则 if(!taskActionOk(c)) 这类会淹掉真信号)
  const predicate = [
    'async function main() {',
    '  if (!taskActionOk(c)) return 1',
    '  const s = statusFormatter(x)',
    '  auditResident(opts)',
    '}',
    'function startDaemon() {',
    '  auditResident(opts)',
    '}',
    'function auditResident(opts = {}) {}',
    'function taskActionOk(c = 1) { return true }',
    'function statusFormatter(x = 1) { return x }',
  ].join('\n')
  const r3 = cp.judgeCarrierParity({ source: predicate })
  assert.deepEqual(r3.unclassifiedDark, [], '谓词位/赋值位的调用不得被当成腿')
})

test('P11 定义不在本文件的腿必须照算(宁可多报,绝不把真腿洗成不计)', () => {
  // dispatchFromElsewhere 在本文件里没有定义 ⇒ 取不到签名,必须仍按腿算
  const src = [
    'async function main() {',
    '  dispatchFromElsewhere()',
    '  sweepLocal(opts)',
    '  auditResident(opts = {})',
    '}',
    'function startDaemon() {',
    '  auditResident(opts)',
    '}',
    'function auditResident(opts = {}) {}', // 整参带默认 ⇒ 是腿,且两面都调 ⇒ 不该进 dark
    'function sweepLocal(a, b) {}', // 必需形参 ⇒ 判为助手
  ].join('\n')
  const r = cp.judgeCarrierParity({ source: src })
  assert.equal(r.state, 'drift', r.why)
  assert.ok(r.dark.includes('dispatchFromElsewhere'), '定义不在本文件 ⇒ 必须保守当腿')
  assert.ok(!r.dark.includes('sweepLocal'), '本文件定义且形参必需 ⇒ 判为助手')
  assert.ok(!r.dark.includes('auditResident'), '两面都调的真腿不得被列')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
