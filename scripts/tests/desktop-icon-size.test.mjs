// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桌面图标档三件套的镜像测试(2026-10-27 立)。
 *
 * 立因:Windows 11 随显示器拓扑变化自行把桌面图标档重算成 96(纵向格距 100px→164px),
 * 机主看到的即"图标间距突然变大"。同批实测还**证伪**了一条常见出路:
 * `WindowMetrics\IconSpacing` 压不住桌面网格(同一份 -1125/-1470 下 bag=48⇒100px、bag=96⇒164px),
 * 唯一杠杆是 `HKCU\...\Shell\Bags\1\Desktop\IconSize`。器物已经装车(判据层 + 只读尺 + 守护派发腿),
 * 本文件把它的十件行为钉死,免得下一次重构把"该动的不动、不该动的乱动"这一格改歪:
 *
 *   A1-A6 判定面:ok / topology-rederive / 有人开着文件夹窗口 / 用户手势 / 成因取不到 / 输入取不到
 *   A7      钉值会到期:reviewBy 过期必须判 ok=false,不许静默腐烂(§0.7)
 *   A8      verdictLine 是派发层唯一的机器读面,不靠中文文案猜
 *   D1-D6   派发面:ok 零写零推、drift 派修复并留痕、拒绝回滚用户选择、取不到不记绿、旧痕必裁、节流
 *   S1-S2   接线锁:定义 + 主循环内恰好一次调用点(且注释里提到不算调用)
 *   N1      形状锁:收尾只准按 pid,禁止按映像名杀进程(复用 check-no-visible-spawn 的 N1 判据)
 *   Z1-Z2   装载纪律:被 import 时不触发主流程(§22d)、器物文件真在位
 *
 * 判据一律 import 生产脚本的 `__test__`(§22c),本文件不复制任何判定逻辑或常量。
 * 取材面登记:本批三件器物在写下这份测试时尚未提交(实测 untracked/modified,故 HEAD 面读不到),
 *   S1/N1 这两把形状锁因此读**工作树源码**(与同族 `closed-row-drop-ledger.test.mjs` 同法)。
 *   器物随后入 HEAD(43c56167ece9),两面自此同形;形状锁的对象是"这份文件当下写了什么",读工作树不变。
 * 本文件零触碰真桌面:不跑 `--apply`、不写注册表、不重启 explorer、不派 pwsh 量桌面。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as GRID } from '../lib/desktop-icon-grid.mjs'
import { __test__ as CHECKER } from '../check-desktop-icon-size.mjs'
import { auditDesktopIconSize } from '../git-guardian.mjs'
import { __test__ as SPAWN_GATE } from '../check-no-visible-spawn.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const GUARDIAN_SRC = readFileSync(here('../git-guardian.mjs'), 'utf8')
const CHECKER_SRC = readFileSync(here('../check-desktop-icon-size.mjs'), 'utf8')

/** 固定时刻:判定面全部输入显式给出,不赌"本机此刻几点"。 */
const T0 = new Date('2026-10-27T02:00:00Z')
const shift = (ms) => new Date(T0.getTime() + ms)
const iso = (d) => d.toISOString()

/** helper 的 JSON 面读数(键名取自 scripts/lib/desktop-icon-grid.ps1 的 $out)。 */
const face = (over = {}) => ({
  iconSize: 48,
  bagWrittenAt: iso(T0),
  topologyStamps: [iso(shift(30_000))],
  openFolderWindows: 0,
  pitchDy: 100,
  explorerPid: 4321,
  cxScreen: 3440,
  cyScreen: 1440,
  dpi: 100,
  ...over,
})
const PREF_48 = { ok: true, pref: { iconSize: 48 } }
const driftFace = (over = {}) => face({ iconSize: 96, pitchDy: GRID.MEASURED_PITCH_PX[96], ...over })
const judgeDrift = (over = {}) => CHECKER.judge({ face: driftFace(over), preference: PREF_48 })

const scratch = (prefix) => {
  const dir = mkScratch(prefix)
  return { dir, tickFile: path.join(dir, 'tick.json'), ledgerFile: path.join(dir, 'drift.jsonl') }
}
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(String(m)) }
}
const readLedger = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l))
    : null

// ── 判定面 ──────────────────────────────────────────────────────────────────

test('A1 live=48 ∧ 偏好=48 ⇒ state=ok，且一律不自动动手', () => {
  const v = CHECKER.judge({ face: face(), preference: PREF_48 })
  assert.equal(v.state, 'ok', `同档必须判 ok,实得 state=${v.state}(${v.reason ?? ''})—— 改这一行会红:liveSize===preferredSize 那一支`)
  assert.equal(v.cause, null, 'ok 没有成因;若这里冒出 cause,说明"同档"也被拿去派修复')
  assert.equal(CHECKER.isAutoRepairable(v), false, 'ok 绝不可自动动手 —— 否则每轮守护都会重写注册表')
  assert.equal(v.pitchPx, GRID.MEASURED_PITCH_PX[48], '报表格距必须取自实测表,不得写死 100')
  assert.equal(v.measuredPitchPx, 100, 'helper 实测量必须原样透传(它是唯一能证伪 IconSpacing 那条出路的数据)')
})

test('A2 live=96 ∧ 改档时刻距拓扑写入 30s ∧ 无人开窗口 ⇒ drift/topology-rederive，允许自动按回', () => {
  const v = judgeDrift()
  assert.equal(v.state, 'drift')
  assert.equal(v.cause, 'topology-rederive', `实测锚点(30s 内)必须判成"Windows 随换屏重算",实得 ${v.cause}`)
  assert.equal(v.nearestTopologySec, 30, '带符号秒差要进结论(它是唯一那条成因判据的证据)')
  assert.equal(CHECKER.isAutoRepairable(v), true, '这一格是全仓唯一允许自动动手的;判成 false 就等于复发无人管')
})

test('A2b 耦合窗口的边界：恰好 TOPOLOGY_COUPLING_WINDOW_SEC 算拓扑重算，再多 1 秒就不算', () => {
  const W = GRID.TOPOLOGY_COUPLING_WINDOW_SEC
  assert.equal(judgeDrift({ topologyStamps: [iso(shift(W * 1000))] }).cause, 'topology-rederive', `gap=${W}s 是窗口内的实测形态`)
  assert.equal(
    judgeDrift({ topologyStamps: [iso(shift(W * 1000 + 1000))] }).cause,
    'user-gesture-or-unknown',
    `gap=${W + 1}s 已出窗 —— 把 <= 改成 < 或把窗口调宽都会让这条红`,
  )
})

test('A3 有人开着资源管理器窗口 ⇒ 拒绝自动动手（绝不为了"想修"关掉别人的浏览现场）', () => {
  const v = judgeDrift({ openFolderWindows: 2 })
  assert.equal(v.cause, 'topology-rederive', '成因照实判,不许因为"不想动手"就把成因改掉')
  assert.equal(CHECKER.isAutoRepairable(v), false, `openFolderWindows=2 必须挡住动手,实得 ${CHECKER.isAutoRepairable(v)}`)
  assert.equal(CHECKER.isAutoRepairable(judgeDrift({ openFolderWindows: 1 })), false, '只开着一个窗口也得挡住(helper 的 OpenFolderWindows() 返回计数,1 就是 1)')
  assert.equal(CHECKER.isAutoRepairable(judgeDrift({ openFolderWindows: undefined })), false, '缺键(没有这一项读数)同样不动手')
  assert.equal(CHECKER.isAutoRepairable(judgeDrift({ openFolderWindows: 0 })), true, '无人开窗口时这一格必须放行,否则整条自愈腿永远不动手、复发照旧无人管')
})

/**
 * A3b 取不到窗口数那一格(2026-10-27 实测到 ⇒ 同日实现侧已修):helper 的
 * `openFolderWindows` 在枚举窗口那一步失败时是 **null**(Add-Type 之后的语句级失败不中断
 * 脚本,前一步读到的 bag 仍在),而旧实现写的是 `Number(...) === 0` ⇒ "取不到"被读成
 * "没人开着窗口" ⇒ 允许重启 explorer,正好违反 A3 立意的方向(§0.3「没判」不得写成"判过")。
 * 现判据是严格 `=== 0`,摘掉它(改回 Number())本条即翻红。
 */
test('A3b openFolderWindows 取不到(null/缺键)⇒ 绝不动手;确证 0 才允许动手', () => {
  assert.equal(CHECKER.isAutoRepairable(judgeDrift({ openFolderWindows: null })), false, '取不到窗口数 ⇒ 未判定 ⇒ 不动手(§0.3)')
  const noKey = { ...driftFace({}) }
  delete noKey.openFolderWindows
  assert.equal(CHECKER.judge({ face: noKey, preference: PREF_48 }).openFolderWindows, undefined, '夹具确实把键摘掉了(否则下一条是空断言)')
  assert.equal(CHECKER.isAutoRepairable(judgeDrift({ openFolderWindows: undefined })), false, '显式 undefined 同样不得被当成 0')
  assert.equal(
    CHECKER.isAutoRepairable(judgeDrift({ openFolderWindows: 0 })),
    true,
    '阳性对照:确证无人开窗口时这一格必须仍可修,否则上面三条只是空断言',
  )
})

test('A4 改档时刻距最近拓扑写入 4 小时 ⇒ user-gesture-or-unknown，一律不回滚用户自己的选择', () => {
  const v = judgeDrift({ topologyStamps: [iso(shift(-4 * 60 * 60 * 1000))] })
  assert.equal(v.cause, 'user-gesture-or-unknown', '用户在右键「查看」里自己选的档,自动按回就是跟用户打架')
  assert.equal(CHECKER.isAutoRepairable(v), false, '这一格不可自动修是全票的立论之一,改成 true 即红')
})

test('A5 topologyStamps=[] ⇒ cause-undetermined 且不可自动修（空数组 ≠ 取不到）', () => {
  const v = judgeDrift({ topologyStamps: [] })
  assert.equal(v.state, 'drift', '档差是量到的,成因判不出不能把结论降成未判定')
  assert.equal(v.cause, 'cause-undetermined', `无时刻可比对 ⇒ 只能报成因未判定,实得 ${v.cause}`)
  assert.equal(CHECKER.isAutoRepairable(v), false, '成因不明绝不动手')
  // 同一条结论的另一格:整个输入取不到(undefined)时必须是 undetermined,而不是当成空数组
  const u = CHECKER.judge({ face: face({ iconSize: 96, topologyStamps: undefined }), preference: PREF_48 })
  assert.equal(u.state, 'undetermined', 'topologyStamps 取不到 ⇒ 未判定(§0.3),不得当成"没有拓扑写入"')
  assert.match(String(u.reason), /topologyStamps/, `必须点名缺的是哪一项,实得 reason=${u.reason}`)
})

test('A6 输入缺项 ⇒ state=undetermined 且 reason 点名缺的正是哪一项', () => {
  const v = CHECKER.judge({ face: face({ iconSize: null }), preference: PREF_48 })
  assert.equal(v.state, 'undetermined')
  assert.match(String(v.reason), /liveSize/, `必须点名 liveSize,实得 reason=${v.reason}`)
  assert.equal(CHECKER.isAutoRepairable(v), false, '未判定绝不动手')

  const offTier = CHECKER.judge({ face: face({ iconSize: 47 }), preference: PREF_48 })
  assert.equal(offTier.state, 'undetermined', '不在 Explorer 档位表内的读数不可解释,不能猜成"某一档"')
  assert.match(String(offTier.reason), /不在.*档位表/, `必须说清是档位表外,实得 reason=${offTier.reason}`)

  const noFace = CHECKER.judge({ face: null, preference: PREF_48 })
  assert.equal(noFace.state, 'undetermined')
  assert.match(String(noFace.reason), /helper/, 'helper 没产出 JSON 时要点名 pwsh/桌面会话这一因')

  const noPref = CHECKER.judge({ face: face(), preference: { ok: false, errors: ['夹具：偏好件到期'] } })
  assert.equal(noPref.state, 'undetermined')
  assert.match(String(noPref.reason), /偏好件不可用/, '偏好件不可用排在面读数之前,不得拿旧钉值继续判')
})

// ── 钉值到期 ────────────────────────────────────────────────────────────────

test('A7 钉值会到期：reviewBy 是过去的日期 ⇒ readPreferenceShape().ok===false（不许静默腐烂）', () => {
  const expired = GRID.readPreferenceShape({ iconSize: 48, reason: '夹具:机主定的默认档', reviewBy: '2020-01-01' })
  assert.equal(expired.ok, false, '到期必须 ok=false —— 把到期这一支摘掉,本条当场翻红')
  assert.ok(
    expired.errors.some((e) => /到期/.test(e)),
    `errors 必须点名"到期"这一因,实得 ${JSON.stringify(expired.errors)}`,
  )

  const future = iso(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)).slice(0, 10)
  assert.equal(GRID.readPreferenceShape({ iconSize: 48, reason: '夹具:机主定的默认档', reviewBy: future }).ok, true, '未到期且形状齐备必须是 ok,否则整族判据恒红(§12e)')

  assert.equal(GRID.readPreferenceShape({ iconSize: 47, reason: '夹具:机主定的默认档', reviewBy: future }).ok, false, '档不在表内的钉值不可用')
  assert.equal(GRID.readPreferenceShape({ iconSize: 48, reason: '太短', reviewBy: future }).ok, false, '定向说明不得短于 10 字(§0.7 豁免必须带原因)')
  assert.equal(GRID.readPreferenceShape({ iconSize: 48, reason: '夹具:机主定的默认档', reviewBy: '2027/04/30' }).ok, false, '日期形态必须是 YYYY-MM-DD,写歪不能算已钉')
  assert.equal(GRID.readPreferenceShape(null).ok, false, '非对象输入直接不可用,不得抛')

  // 真钉值这一格:过期即红是**有意设计** —— 出路是去 scripts/data/desktop-icon-preference.json 重钉 reviewBy,
  // 而不是把这条断言改松(§0.7:豁免会到期;§0.10:失效方向必须是"多要一次定向说明")。
  const shipped = JSON.parse(readFileSync(CHECKER.PREFERENCE_FILE, 'utf8'))
  const shape = GRID.readPreferenceShape(shipped)
  assert.equal(shape.ok, true, `仓内偏好件必须当下一致(实得 ${JSON.stringify(shape.errors)});到期就去重钉 reviewBy,不要改这条断言`)
})

// ── 结论行 ──────────────────────────────────────────────────────────────────

test('A8 verdictLine 三态都输出机器可读那一行，且报表把最后一行留给它', () => {
  const samples = [
    CHECKER.judge({ face: face(), preference: PREF_48 }),
    judgeDrift(),
    CHECKER.judge({ face: face({ iconSize: null }), preference: PREF_48 }),
  ]
  for (const v of samples) {
    const line = GRID.verdictLine(v)
    assert.ok(line.startsWith('DESKTOP-ICON-STATE '), `必须以 DESKTOP-ICON-STATE 开头供派发层定位,实得:${line}`)
    assert.match(line, /state=/, `必须含 state=,派发层只认这一行不靠中文文案猜,实得:${line}`)
    assert.doesNotMatch(line, /\n/, '结论行必须单行')
    const last = CHECKER.summarize(v).split(/\r?\n/).pop()
    assert.equal(last, line, 'summarize 的末行必须是同一行结论(派发层用 .pop() 取,写在中间就取不到)')
  }
})

// ── 派发面（注入 runCheck/runApply，零触碰真桌面）───────────────────────────

test('D1 派发层：ok ⇒ 零写零推、不派修复、不留痕', () => {
  const f = scratch('desktop-icon-ok-')
  try {
    const { logs, logger } = logsOf()
    let applyCalls = 0
    const okVerdict = CHECKER.judge({ face: face(), preference: PREF_48 })
    const r = auditDesktopIconSize({
      ...f,
      logger,
      runCheck: () => ({ out: GRID.verdictLine(okVerdict) }),
      runApply: () => {
        applyCalls += 1
        return { out: GRID.verdictLine(okVerdict) }
      },
    })
    assert.equal(r.ok, true)
    assert.equal(applyCalls, 0, '同档时一次都不许派修复 —— 派了就是每 30 分钟重写一次注册表')
    assert.equal(readLedger(f.ledgerFile), null, `ok 不留痕(实测零写),却写出了 ${f.ledgerFile} ⇒ 台账会被绿行淹掉`)
    assert.match(logs.join('\n'), /零写零推/, 'ok 也要留一行读数:"没跑"与"跑了且没漂移"必须能区分')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D2 派发层：drift ⇒ 按器物自己那行结论派修复并留痕（契约锁：行格式不手抄）', () => {
  const f = scratch('desktop-icon-drift-')
  try {
    const { logger } = logsOf()
    let applyCalls = 0
    const before = judgeDrift() // 器物那把尺子的真实产出
    const after = CHECKER.judge({ face: face(), preference: PREF_48 })
    const r = auditDesktopIconSize({
      ...f,
      logger,
      runCheck: () => ({ out: GRID.verdictLine(before) }),
      runApply: () => {
        applyCalls += 1
        return { out: GRID.verdictLine(after) }
      },
    })
    assert.equal(applyCalls, 1, '可修那一格必须派一次 --apply(修不修由器物自己的闸判,派发层不复算判据)')
    assert.equal(r.action, 'repaired', `修复后取到 ok ⇒ 必须记 repaired,实得 ${r.action}`)
    const rows = readLedger(f.ledgerFile)
    assert.equal(rows.length, 1)
    assert.equal(String(rows[0].live), '96', '留痕里的 live 必须来自器物那一行(派发层抄错键名这里就红)')
    assert.equal(String(rows[0].preferred), '48')
    assert.equal(rows[0].cause, 'topology-rederive')
    assert.equal(rows[0].afterState, 'ok')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D3 派发层：器物按闸拒绝 ⇒ 记 refused-or-failed，不谎报已修', () => {
  const f = scratch('desktop-icon-refuse-')
  try {
    const { logs, logger } = logsOf()
    const userGesture = judgeDrift({ topologyStamps: [iso(shift(-4 * 60 * 60 * 1000))] })
    const r = auditDesktopIconSize({
      ...f,
      logger,
      runCheck: () => ({ out: GRID.verdictLine(userGesture) }),
      runApply: () => ({ out: GRID.verdictLine(userGesture) }), // 器物自己拒绝,结论仍是 drift
    })
    assert.equal(r.ok, false, '结果还是 drift ⇒ 不得记绿(§0.3)')
    assert.equal(r.action, 'refused-or-failed')
    assert.match(logs.join('\n'), /不自动回滚用户自己的选择/, '日志必须把"为什么没动"写清,给人留下 --force 这一条出路')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D4 派发层：结论取不到 / 不可解析 ⇒ 未判定，既不记绿也不冒红，且不派修复', () => {
  const f = scratch('desktop-icon-undet-')
  try {
    const { logs, logger } = logsOf()
    let applyCalls = 0
    const noApply = () => {
      applyCalls += 1
      return { out: GRID.verdictLine(CHECKER.judge({ face: face(), preference: PREF_48 })) }
    }
    const undet = auditDesktopIconSize({
      ...f,
      tickFile: path.join(f.dir, 'tick-a.json'),
      ledgerFile: path.join(f.dir, 'ledger-a.jsonl'),
      logger,
      runCheck: () => ({ out: GRID.verdictLine(CHECKER.judge({ face: face({ iconSize: null }), preference: PREF_48 })) }),
      runApply: noApply,
    })
    assert.equal(undet.state, 'undetermined')
    assert.equal(undet.ok, false, '未判定不得记绿')
    assert.equal(applyCalls, 0, '输入取不到时绝不派修复(没有结论就没有动手的依据)')

    const unparsed = auditDesktopIconSize({
      ...f,
      tickFile: path.join(f.dir, 'tick-b.json'),
      ledgerFile: path.join(f.dir, 'ledger-b.jsonl'),
      logger,
      runCheck: () => ({ out: '桌面图标看起来一切正常（没有机器读面）' }),
      runApply: noApply,
    })
    assert.equal(unparsed.ok, false)
    assert.match(String(unparsed.why), /不可解析/)
    assert.equal(applyCalls, 0, '解析不出一行结论同样不许动手')
    const rows = readLedger(path.join(f.dir, 'ledger-b.jsonl'))
    assert.equal(rows[0].state, 'unparsed', '瞎了这一格必须留痕,否则"器物坏了"与"没漂移"长得一样')
    assert.match(logs.join('\n'), /未判定/)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D5 派发层：超保留窗口的旧痕必须被裁且把裁掉的枚数报出来', () => {
  const f = scratch('desktop-icon-prune-')
  try {
    writeFileSync(f.ledgerFile, `${JSON.stringify({ at: iso(shift(-365 * 24 * 60 * 60 * 1000)), state: 'drift' })}\n`, 'utf8')
    const { logs, logger } = logsOf()
    const before = judgeDrift()
    const after = CHECKER.judge({ face: face(), preference: PREF_48 })
    auditDesktopIconSize({ ...f, logger, runCheck: () => ({ out: GRID.verdictLine(before) }), runApply: () => ({ out: GRID.verdictLine(after) }) })
    const rows = readLedger(f.ledgerFile)
    assert.equal(rows.length, 1, `旧痕必须被裁掉只剩本轮一条,实得 ${rows.length} 条`)
    assert.match(logs.join('\n'), /裁掉 1 条/, '被裁条数必须报(§0:留痕与 stale-claim-strip 同口径,不许静默清账)')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D6 派发层：节流窗口内不派生第二次', () => {
  const f = scratch('desktop-icon-throttle-')
  try {
    const { logger } = logsOf()
    const okLine = GRID.verdictLine(CHECKER.judge({ face: face(), preference: PREF_48 }))
    let calls = 0
    const counting = () => {
      calls += 1
      return { out: okLine }
    }
    const first = auditDesktopIconSize({ ...f, logger, now: 1_700_000_000_000, intervalMs: 30 * 60 * 1000, runCheck: counting, runApply: counting })
    const second = auditDesktopIconSize({ ...f, logger, now: 1_700_000_000_000 + 1000, intervalMs: 30 * 60 * 1000, runCheck: counting, runApply: counting })
    assert.equal(first.ran, true)
    assert.equal(second.ran, false, '窗口内二次派发 ⇒ 同一场漂移被量两遍,留痕与推送都会翻倍')
    assert.equal(calls, 1, `窗口内必须一次都不派生,实得 ${calls} 次`)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

// ── 形状尺：注释里提到 ≠ 真调用 ─────────────────────────────────────────────

/** 该下标之前引号个数为奇 ⇒ 落在字符串字面量里(日志文案提到函数名,不是调用)。 */
const insideString = (line, idx) => {
  let quotes = 0
  for (let i = 0; i < idx; i++) if (line[i] === `'` || line[i] === '"' || line[i] === '`') quotes += 1
  return quotes % 2 === 1
}
const DEF_RE = /^\s*(?:export\s+)?(?:async\s+)?function\s+auditDesktopIconSize\b/
/**
 * 调用点取法:整行定位,注释行 / 定义行 / 字符串文案里的同名字样都不算。
 * (与生产门同法:按 `lastIndexOf('\n')` 回推行首再判该行的形态,见 check-no-visible-spawn 扫源那一步。)
 */
function callSites(src) {
  const found = []
  for (const m of src.matchAll(/\bauditDesktopIconSize\s*\(/g)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1
    const nextNl = src.indexOf('\n', m.index)
    const lineText = src.slice(lineStart, nextNl < 0 ? undefined : nextNl).trim()
    const head = src.slice(lineStart, m.index)
    if (/^\s*(?:\/\/|\*|\/\*|#)/.test(head)) continue
    if (DEF_RE.test(src.slice(lineStart, nextNl < 0 ? undefined : nextNl))) continue
    if (insideString(head, head.length)) continue
    found.push({ index: m.index, lineText })
  }
  return found
}
/** 该下标落在哪个函数名下(取「≤ index 的最后一个 function 定义」;同族接线锁用同一把尺)。 */
function enclosingFunctionName(src, index) {
  let name = null
  for (const m of src.matchAll(/^(?:export )?(?:async )?function\s+(\w+)/gm)) {
    if (m.index <= index) name = m[1]
    else break
  }
  return name
}

test('S1 接线锁：auditDesktopIconSize 既被 export，又在守护主流程里恰好调用一次', () => {
  assert.equal(typeof auditDesktopIconSize, 'function', 'import 取不到本体 ⇒ 镜像测试只能去抄第二份判据(§22c)')
  const defs = GUARDIAN_SRC.split(/\r?\n/).filter((l) => DEF_RE.test(l))
  assert.equal(defs.length, 1, `export 定义必须恰好一枚,实得 ${defs.length}`)
  assert.match(GUARDIAN_SRC, /^export function auditDesktopIconSize\b/m, '必须是 export(不 export 就别的路径进不来)')

  const sites = callSites(GUARDIAN_SRC)
  assert.equal(sites.length, 1, `主循环里的调用点必须恰好一次(0 次=造好没装车 §0.9;2 次=同一轮量两遍),实得 ${sites.map((s) => s.lineText).join(' | ')}`)
  assert.match(
    sites[0].lineText,
    /^if \(!CHECK_ONLY\) auditDesktopIconSize\(\)$/,
    `调用点必须挂在 !CHECK_ONLY 分支(--check 档不写盘),实得:${sites[0].lineText}`,
  )

  const enclosing = enclosingFunctionName(GUARDIAN_SRC, sites[0].index)
  assert.equal(enclosing, 'main', `调用点必须落在守护主流程体内,实得 ${enclosing}`)
  // 邻接判据:与同族巡检腿落在同一个函数体内 —— "文件里两处都出现过"不等于接在同一轮上
  const sibling = /^[ \t]*if \(!CHECK_ONLY\) sweepCrossEndShellPages\(\)[ \t]*$/m.exec(GUARDIAN_SRC)
  assert.ok(sibling, '同族巡检腿的调用锚点必须还在(它没了本锁就该跟着重写,而不是静默失配)')
  assert.equal(
    enclosingFunctionName(GUARDIAN_SRC, sibling.index),
    enclosing,
    '两条派发必须同函数(巡检轮);分开即"抽出去了但没接回轮上"',
  )

  const defAt = GUARDIAN_SRC.indexOf('export function auditDesktopIconSize')
  assert.match(GUARDIAN_SRC.slice(defAt, defAt + 3000), /check-desktop-icon-size\.mjs/, '这条腿必须真指向那把只读尺(指向别的器物=接了个空转)')
})

test('S2 形状锁的尺本身：注释里提到、字符串里提到都不算调用，摘掉调用点必须翻红', () => {
  const dispatch = '    if (!CHECK_ONLY) auditDesktopIconSize()'
  assert.equal(callSites(`function main() {\n${dispatch}\n}`).length, 1, '真调用必须数到 1')
  assert.equal(callSites(`function main() {\n// ${dispatch}\n}`).length, 0, '被注释掉的调用点不得算已接线')
  assert.equal(callSites(`function main() {\n  // auditDesktopIconSize() 已接线\n}`).length, 0, '行注释里提到不算')
  assert.equal(callSites(`/**\n * auditDesktopIconSize()\n */`).length, 0, 'JSDoc 块里提到不算')
  assert.equal(callSites(`function main() {\n  logger('已调用 auditDesktopIconSize() 完成')\n}`).length, 0, '字符串文案里提到不算')
  assert.equal(callSites(`export function auditDesktopIconSize(opts = {}) {}`).length, 0, '定义行本身不算调用点')
  assert.equal(callSites(`function main() {\n${dispatch}\n${dispatch}\n}`).length, 2, '两处调用必须数得出 2(否则 S1 的"恰好一次"是空断言)')

  // 摘掉即翻红:把真实那一行删净/改成注释,本锁必须读到 0
  const removed = GUARDIAN_SRC.replace(/^[ \t]*if \(!CHECK_ONLY\) auditDesktopIconSize\(\)[ \t]*$/m, '')
  assert.equal(callSites(removed).length, 0, '摘掉派发那一行后必须归零 —— 不归零说明 S1 数的是别处,这条锁是空跑')
  const commented = GUARDIAN_SRC.replace(/^([ \t]*)if \(!CHECK_ONLY\) auditDesktopIconSize\(\)[ \t]*$/m, '$1// if (!CHECK_ONLY) auditDesktopIconSize()')
  assert.equal(callSites(commented).length, 0, '把派发腿注释掉同样必须归零')
})

// ── 形状锁：收尾只准按 pid ──────────────────────────────────────────────────

test('N1 形状锁：桌面图标器物不得按映像名杀进程，且必须保留"取不到 pid 就不动手"这一格', () => {
  const hits = SPAWN_GATE.scanSource(CHECKER_SRC, 'scripts/check-desktop-icon-size.mjs').filter((v) => v.kind === 'name-kill')
  assert.equal(hits.length, 0, `taskkill /IM 会连带杀掉别人的同名进程,本仓明令禁止(见 check-no-visible-spawn 的 N1),实得 ${JSON.stringify(hits)}`)

  // 尺子的正/反向对照:证明上面那条不是空断言
  const bad = SPAWN_GATE.scanSource(`execFileSync('taskkill', ['/IM', 'explorer.exe', '/F'], { windowsHide: true })`, 'fixture.mjs')
  assert.ok(bad.some((v) => v.kind === 'name-kill'), '夹具形态的 taskkill /IM 必须被抓;抓不到说明 N1 这把尺换了实现,本锁要跟着改')
  const good = SPAWN_GATE.scanSource(`execFileSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true })`, 'fixture.mjs')
  assert.equal(good.filter((v) => v.kind === 'name-kill').length, 0, '按 pid 收尾的正解不得被判红(改法本身被判红 ⇒ 没人照正解改)')

  assert.match(CHECKER_SRC, /^export function restartShellByPid\b/m, '按 pid 收尾的实现必须在位(摘掉它,写 bag 后连"外壳回来没有"都判不了)')
  assert.match(CHECKER_SRC, /Stop-Process -Id/, '收尾脚本必须按 Id 停,不得回落到按名字停')
  assert.match(CHECKER_SRC, /取不到 explorerPid/, '取不到 pid 时必须显式拒动手,不许"那就按名字杀"——这一格没了就是本条禁令的漏洞')
})

test('Z1 装载纪律：被测试 import 时不得触发主流程(§22d)', () => {
  assert.match(CHECKER_SRC, /^const isDirectRun =$/m, '必须有 isDirectRun 守卫(顶层直接 main() 会让 import 就写注册表)')
  assert.match(CHECKER_SRC, /^if \(isDirectRun\) \{$/m, '守卫必须在顶层且包住 main()')
  const callIdx = [...CHECKER_SRC.matchAll(/(?<!function\s)\bmain\(\)/g)].map((m) => m.index)
  assert.equal(callIdx.length, 1, `main() 的调用点必须恰好一处(实得 ${callIdx.length} 处),多的那处就是"import 即跑主流程"`)
  const guardIdx = CHECKER_SRC.indexOf('if (isDirectRun) {')
  assert.ok(guardIdx > 0, '守卫块必须还在')
  assert.ok(callIdx[0] > guardIdx && callIdx[0] - guardIdx < 200, `唯一那处 main() 必须落在 isDirectRun 守卫之内(实得间隔 ${callIdx[0] - guardIdx} 字符)`)
  assert.equal(typeof CHECKER.judge, 'function', '本文件 import 成功即证明主流程没被触发(触发了早就 exit 了)')
})

test('Z2 器物在位：只读 helper 与偏好件的取径都从 __test__ 常量拿', () => {
  assert.ok(path.isAbsolute(CHECKER.HELPER), 'HELPER 必须是绝对路径,不得由 cwd 推(共享工作树 cwd 不可靠,守门 70 同型)')
  assert.ok(existsSync(CHECKER.HELPER), `${CHECKER.HELPER} 不在位 ⇒ 只读尺取不到面,整族判据会退成未判定`)
  assert.ok(existsSync(CHECKER.PREFERENCE_FILE), `${CHECKER.PREFERENCE_FILE} 不在位 ⇒ 没有钉值就没有"该是哪一档"的依据`)
  assert.equal(CHECKER.PREFERENCE_FILE, path.join(CHECKER.ROOT, 'scripts', 'data', 'desktop-icon-preference.json'), '偏好件取径必须锚在 ROOT 上,ROOT 改形时这里同步改')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
