// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收尾对齐停摆的**自动修复**判据回归(2026-10-04)。
 *
 * 立因是一次真停摆,不是设想:10-03 07:41 失败后 **24.8 小时零动作**。而这段代码
 * 原本只负责"喊人",且更糟 —— 告警文案给的唯一出路(跑一轮收敛)在本地已同步时是
 * 空转(实测 7 秒 rc=0、不推送),`alignWorktreeAfterHeadMove` 只在真推进 HEAD 后才调,
 * 于是**台账永不归零**。既不自愈、给出的出路也不自愈,只剩人在中间。
 *
 * 这里只钉**判据**与**接线**,不派生真对齐器:
 *   - `decideAlignHeal` 是纯函数(四道闸:总开关 / 是否真有故障 / 节流 / 熔断);
 *   - `healConvergeAlignStall` 的成败**靠回读台账**而不是子进程退出码 ——
 *     只信 rc 会把"跑完但没归零"记成已修好,下一轮再修,熔断计数被无意义消耗光,
 *     那就退化成"每 2 分钟试一次",正是本条要防的。
 *   - `checkConvergeAlignStall` 的顺序是**先自愈后喊人**;反了就还是"先发信再说"。
 * 派发出口全部注入替身,测试**绝不在真仓库里派生对齐器**。
 *
 * 框架用 `node:test`(本仓 scripts/tests 的既有形态:根 package.json 无 vitest)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AUTO_HEAL_LEDGER,
  checkConvergeAlignStall,
  decideAlignHeal,
  healConvergeAlignStall,
  readAlignHealAttempts,
  shouldAlertAlignStall,
  writeAlignHealAttempts,
} from '../git-guardian.mjs'

const NOW = 1_700_000_000_000
const MIN = 60_000

const tmpDir = (tag) => mkdtempSync(join(tmpdir(), `align-heal-${tag}-`))
const writeState = (dir, obj) => {
  const p = join(dir, 'state.json')
  writeFileSync(p, JSON.stringify(obj), 'utf8')
  return p
}

const FAILING = { consecutiveFailures: 3, lastFailAt: NOW - 60 * MIN, lastOkAt: NOW - 120 * MIN, lastNote: 'ETIMEDOUT' }
const HEALTHY = { consecutiveFailures: 0, lastFailAt: NOW - 60 * MIN, lastOkAt: NOW - MIN, lastNote: 'aligned=0' }

// ─── decideAlignHeal:纯判据 ────────────────────────────────────────────────

test('decideAlignHeal:健康时不派发(不给"每轮都去修"留口子)', () => {
  const d = decideAlignHeal(HEALTHY, {}, NOW, {})
  assert.equal(d.heal, false)
  assert.match(d.why, /无失败/)
})

test('decideAlignHeal:有故障且无节流记录 ⇒ 派发', () => {
  const d = decideAlignHeal(FAILING, {}, NOW, {})
  assert.equal(d.heal, true)
  assert.match(d.why, /第 1\/3 次/)
})

test('decideAlignHeal:节流窗口内不重复派(对齐器本机实测 40–51 秒,守护每 2 分钟一轮)', () => {
  const d = decideAlignHeal(FAILING, { lastAttemptAt: NOW - 10 * MIN, attempts: 1 }, NOW, { throttleMs: 30 * MIN })
  assert.equal(d.heal, false)
  assert.match(d.why, /节流/)
})

test('decideAlignHeal:节流窗口外可再派', () => {
  const d = decideAlignHeal(FAILING, { lastAttemptAt: NOW - 40 * MIN, attempts: 1 }, NOW, { throttleMs: 30 * MIN })
  assert.equal(d.heal, true)
})

test('decideAlignHeal:熔断 —— 用满次数后转人工(自愈本身也必须有上限)', () => {
  const d = decideAlignHeal(FAILING, { lastAttemptAt: NOW - 40 * MIN, attempts: 3 }, NOW, { maxAttempts: 3 })
  assert.equal(d.heal, false)
  assert.match(d.why, /熔断/)
})

test('decideAlignHeal:总开关关掉 ⇒ 不派发(留取证对照的口子)', () => {
  const d = decideAlignHeal(FAILING, {}, NOW, { disabled: true })
  assert.equal(d.heal, false)
  assert.match(d.why, /显式关掉/)
})

test('decideAlignHeal:台账缺失或计数非有限数时不崩,且按"无故障"处理', () => {
  assert.equal(decideAlignHeal(null, {}, NOW, {}).heal, false)
  assert.equal(decideAlignHeal({ consecutiveFailures: 'x' }, {}, NOW, {}).heal, false)
})

// ─── healConvergeAlignStall:成败靠回读台账,不靠退出码 ──────────────────────

test('healConvergeAlignStall:派发成功且台账归零 ⇒ ok=true', () => {
  const dir = tmpDir('ok')
  const statePath = writeState(dir, FAILING)
  const attemptLogPath = join(dir, 'attempts.json')
  let calls = 0
  const run = () => {
    calls++
    writeFileSync(statePath, JSON.stringify({ ...HEALTHY, lastNote: 'aligned=0' }), 'utf8')
    return { ok: true, why: 'exit=0' }
  }
  const r = healConvergeAlignStall({ now: NOW, statePath, attemptLogPath, run, log: () => {} })
  assert.equal(calls, 1)
  assert.equal(r.healed, true)
  assert.equal(r.ok, true)
  // 归零后必须清掉尝试计数,否则下一次真故障一开始就撞上熔断余量
  assert.equal(readAlignHealAttempts(attemptLogPath).attempts, 0)
})

test('healConvergeAlignStall:⚠ 子进程报成功但台账没归零 ⇒ ok=false(只信 rc 会把"没修好"记成已修好)', () => {
  const dir = tmpDir('liar')
  const statePath = writeState(dir, FAILING)
  const r = healConvergeAlignStall({
    now: NOW,
    statePath,
    attemptLogPath: join(dir, 'attempts.json'),
    run: () => ({ ok: true, why: 'exit=0' }), // 台账纹丝不动
    log: () => {},
  })
  assert.equal(r.healed, true)
  assert.equal(r.ok, false)
  assert.equal(r.failsAfter, 3)
})

test('healConvergeAlignStall:派发异常(超时/进程错)归入 ok=false 且不抛', () => {
  const dir = tmpDir('crash')
  const statePath = writeState(dir, FAILING)
  const r = healConvergeAlignStall({
    now: NOW,
    statePath,
    attemptLogPath: join(dir, 'attempts.json'),
    run: () => ({ ok: false, why: '派发超时(900000ms)' }),
    log: () => {},
  })
  assert.equal(r.healed, true)
  assert.equal(r.ok, false)
  assert.match(r.why, /超时/)
})

test('healConvergeAlignStall:健康时不派发(替身不被调用)', () => {
  const dir = tmpDir('healthy')
  const statePath = writeState(dir, HEALTHY)
  let calls = 0
  const r = healConvergeAlignStall({
    now: NOW,
    statePath,
    attemptLogPath: join(dir, 'attempts.json'),
    run: () => {
      calls++
      return { ok: true, why: 'exit=0' }
    },
    log: () => {},
  })
  assert.equal(calls, 0)
  assert.equal(r.healed, false)
})

test('healConvergeAlignStall:尝试台账读不出(坏 JSON)时不永久禁用自愈(fail-closed 方向是"宁可多试")', () => {
  const dir = tmpDir('badledger')
  const statePath = writeState(dir, FAILING)
  const attemptLogPath = join(dir, 'attempts.json')
  writeFileSync(attemptLogPath, '{ 这不是 JSON', 'utf8')
  let calls = 0
  const r = healConvergeAlignStall({
    now: NOW,
    statePath,
    attemptLogPath,
    run: () => {
      calls++
      return { ok: true, why: 'exit=0' }
    },
    log: () => {},
  })
  assert.equal(calls, 1)
  assert.equal(r.healed, true)
})

test('healConvergeAlignStall:尝试台账写入失败不得抛(自愈记录丢不得打断整轮 tick)', () => {
  const dir = tmpDir('unwritable')
  const statePath = writeState(dir, FAILING)
  // 父路径是文件而非目录 ⇒ mkdir/write 必然失败
  const bogus = join(dir, 'a-file', 'attempts.json')
  writeFileSync(join(dir, 'a-file'), 'x', 'utf8')
  assert.doesNotThrow(() =>
    healConvergeAlignStall({
      now: NOW,
      statePath,
      attemptLogPath: bogus,
      run: () => ({ ok: false, why: 'exit=1' }),
      log: () => {},
    }),
  )
})

// ─── checkConvergeAlignStall:顺序 = 先自愈,后喊人 ──────────────────────────

test('checkConvergeAlignStall:自愈成功 ⇒ 一封信都不发(这是本条改动的全部意义)', () => {
  const dir = tmpDir('wiring-ok')
  const statePath = writeState(dir, FAILING)
  const sent = []
  let healCalls = 0
  const r = checkConvergeAlignStall({
    now: NOW,
    statePath,
    notify: (name, detail) => sent.push([name, detail]),
    heal: () => {
      healCalls++
      return { healed: true, ok: true, why: 'exit=0', attempts: 1 }
    },
    cfg: {},
  })
  assert.equal(healCalls, 1)
  assert.equal(sent.length, 0)
  assert.equal(r.alert, false)
  assert.equal(r.healed, true)
})

test('checkConvergeAlignStall:自愈未修好 ⇒ 仍按原阈值喊人,且正文带自愈痕迹', () => {
  const dir = tmpDir('wiring-fail')
  const statePath = writeState(dir, FAILING)
  const sent = []
  let healCalls = 0
  checkConvergeAlignStall({
    now: NOW,
    statePath,
    notify: (name, detail) => sent.push([name, detail]),
    heal: () => {
      healCalls++
      return { healed: true, ok: false, why: 'exit=1', attempts: 1, failsAfter: 3 }
    },
    cfg: {},
  })
  assert.equal(healCalls, 1)
  assert.equal(sent.length, 1)
  const detail = sent[0][1]
  assert.match(detail, /自动修复/)
  assert.match(detail, /仍未修复/)
  // 出路必须在场,且首推能真正归零的那条(这是 24.8 小时停摆的结构性原因)
  assert.match(detail, /--align-only/)
})

test('checkConvergeAlignStall:自愈层自身抛异常 ⇒ 不得阻断喊人(最后一层静默退化比抛出去危险)', () => {
  const dir = tmpDir('wiring-throw')
  const statePath = writeState(dir, FAILING)
  const sent = []
  const r = checkConvergeAlignStall({
    now: NOW,
    statePath,
    notify: (name, detail) => sent.push([name, detail]),
    heal: () => {
      throw new Error('boom')
    },
    cfg: {},
  })
  assert.equal(sent.length, 1)
  assert.match(sent[0][1], /自愈层自身异常/)
  assert.equal(r.alert, true)
})

test('checkConvergeAlignStall:自愈判出无需修(台账健康)⇒ 不发信', () => {
  const dir = tmpDir('wiring-healthy')
  const statePath = writeState(dir, HEALTHY)
  const sent = []
  checkConvergeAlignStall({
    now: NOW,
    statePath,
    notify: (name, detail) => sent.push([name, detail]),
    heal: () => ({ healed: false, ok: false, why: '无失败' }),
    cfg: {},
  })
  assert.equal(sent.length, 0)
})

test('checkConvergeAlignStall:状态文件读不到 ⇒ 不喊也不修(绝不因"文件不存在"发信)', () => {
  const sent = []
  let healCalls = 0
  const r = checkConvergeAlignStall({
    now: NOW,
    statePath: join(tmpDir('missing'), 'nope.json'),
    notify: (name, detail) => sent.push([name, detail]),
    heal: () => {
      healCalls++
      return { healed: true, ok: true, why: 'exit=0' }
    },
    cfg: {},
  })
  assert.equal(r.alert, false)
  assert.equal(sent.length, 0)
  assert.equal(healCalls, 0)
})

// ─── 顺序的判别力回归(2026-10-04,见下面那条变异取证的说明) ────────────────
//
// 为什么单独加这一格:把 `shouldAlertAlignStall` 挪到自愈**之前**(即"先发信再修")是
// 最自然的退化写法,而常规写法测它**测不出来** —— 因为自愈成功那一支自己就 `return` 了,
// 不发信;自愈失败那一支两种顺序都会发信。实测变异体 20/20 全绿 = 这测试没判别力。
//
// 唯一能让顺序差异显形的构造:**让 notify 在"判告警"这一步真的发出去**。
// 判据不是"notify 被调了几次",而是**自愈仍被派发过**这件事:顺序反了的话,
// notify 一旦 return,代码就永远走不到 heal。
test('checkConvergeAlignStall:即使告警判定先行,自愈也必须已经派发过(钉住"先修后喊"的顺序)', () => {
  const dir = tmpDir('ordering')
  const statePath = writeState(dir, FAILING)
  let healCalls = 0
  const sent = []
  const r = checkConvergeAlignStall({
    now: NOW,
    statePath,
    notify: (name, detail) => {
      // 顺手把正文记下来:既用上 detail(不留给 lint 报未使用),也让这一格多一条
      // "正文里必须出现自愈痕迹"的断言 —— 真走到喊人时,人看到的是机器已经试过几次。
      sent.push([name, String(detail || '')])
      // 模拟"判红即发信并 return"的早退:顺序反了的话,这一句之后到不了 heal
      return true
    },
    heal: () => {
      healCalls++
      return { healed: true, ok: true, why: 'exit=0', attempts: 1 }
    },
    cfg: {},
  })
  // 自愈必须先于(可能的)喊人发生
  assert.equal(healCalls, 1, '自愈必须被派发过:顺序反了就是"先发信、再(可能)不修"')
  // 自愈成功 ⇒ 最终确实不该留下未修的告警
  assert.equal(r.healed, true)
  assert.equal(r.alert, false)
  // notify 仍被调用是允许的(它代表"若未达阈值也会评估"),但收信后不得再声称故障未修
  assert.ok(Array.isArray(sent))
  for (const [name, detail] of sent) {
    assert.equal(name, 'converge-align-stall')
    // 真发出去了就必带自愈痕迹:收信人第一眼就知道"机器已经自己试过",而不是只有一句故障描述
    assert.match(detail, /--align-only/)
  }
})

// ─── 与既有告警判据的相容性(不能因为加了自愈就把原阈值改坏) ──────────────

test('shouldAlertAlignStall:阈值语义保持原样(未因自愈接线而漂移)', () => {
  assert.equal(shouldAlertAlignStall(HEALTHY, NOW, {}).alert, false)
  // 失败次数够但时间不够 ⇒ 不喊(原有 10 分钟门限)
  assert.equal(shouldAlertAlignStall({ ...FAILING, lastFailAt: NOW - 60_000 }, NOW, {}).alert, false)
  // 两者都够 ⇒ 喊
  assert.equal(shouldAlertAlignStall(FAILING, NOW, {}).alert, true)
})

test('尝试台账读写往返一致,且目录不存在时补建', () => {
  const dir = tmpDir('ledger-rt')
  const p = join(dir, 'nested', 'attempts.json')
  assert.equal(writeAlignHealAttempts({ lastAttemptAt: NOW, attempts: 2, lastWhy: 'x' }, p), true)
  const back = readAlignHealAttempts(p)
  assert.equal(back.attempts, 2)
  assert.equal(back.lastAttemptAt, NOW)

  const dir2 = tmpDir('ledger-mk')
  const p2 = join(dir2, 'deep', 'deeper', 'attempts.json')
  mkdirSync(join(dir2, 'deep'), { recursive: true })
  assert.equal(writeAlignHealAttempts({ attempts: 1 }, p2), true)
  assert.equal(readAlignHealAttempts(p2).attempts, 1)
})

// ─── 自动修复分档台账(2026-10-04 第二批)────────────────────────────────
//
// 为什么单独钉它:台账唯一会漂的方向是**漏登记** —— 新增一格告警的人不会想到要去改它,
// 于是那格"默认只喊人"这件事没有任何信号。所以这里钉两件事:
//   ① 每一格都必须写清 mode(auto/manual)与 why(理由不能空);
//   ② **manual 的格必须给出不可自动修的具体理由** —— 写"不方便"等于没写,
//     而"看起来该自动修却没自动修"正是李总要那份清单要排除的歧义。

test('分档台账:每一格都必须有合法 mode 与非空理由', () => {
  const entries = Object.entries(AUTO_HEAL_LEDGER)
  assert.ok(entries.length >= 10, `台账格数偏少(${entries.length})—— 新增告警格漏登记了?`)
  for (const [name, v] of entries) {
    assert.ok(v && typeof v === 'object', `${name}: 登记项必须是对象`)
    assert.ok(v.mode === 'auto' || v.mode === 'manual', `${name}: mode 必须是 auto/manual,实得 ${v.mode}`)
    assert.ok(typeof v.why === 'string' && v.why.trim().length >= 10, `${name}: why 必须写清理由(≥10 字)`)
    if (v.mode === 'auto') {
      assert.ok(typeof v.where === 'string' && v.where.length > 0, `${name}: auto 格必须写明落地位置 where`)
    }
  }
})

test('分档台账:manual 格的理由必须点名"为什么不能自动"(不得只写不方便)', () => {
  for (const [name, v] of Object.entries(AUTO_HEAL_LEDGER)) {
    if (v.mode !== 'manual') continue
    // 理由至少要触及一个"不可自动"的关键维度,否则等于没给理由
    const mustMention = /不可逆|凭据|密钥|误删|需人判|归属|不作自…|不得|影响全机|错误判断|无回滚|删除/
    assert.match(v.why, mustMention, `${name} 是 manual 但理由没点明为何不能自动修:${v.why}`)
  }
})

test('分档台账:对齐格必须登记为 auto(第一批已落地,别被后续改动悄悄降级)', () => {
  assert.equal(AUTO_HEAL_LEDGER['converge-align'].mode, 'auto')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
