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
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
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

// ─── 台账 ⇄ 代码对账(2026-10-04 复核补立)───────────────────────────────
//
// 为什么必须补:上面那两条测试**遍历的是台账自身**,能抓"已登记项写错形状",
// 抓不住"登记内容与代码相反"。实测就栽在这里 —— `merge-addition-loss` 登记成
// `auto` 且理由写「派发时已带 --apply」,文案完全合规、字面全绿,而代码里
// `union-converge` **零处派发**、`auditMergeAdditionLoss` 只派 `--all-new`,
// 其设计注释还明写「只判不修…人来点」。**"写得对而错"的文案骗得过所有形状校验。**
// 只有把台账的 `where` 拿去回读源码,才钉得住。

const GUARDIAN_SRC = () => readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')

test('台账对账:auto 格声称"派发带 --apply"时,源码里那一格必须真的派发了它', () => {
  const src = GUARDIAN_SRC()
  // 从 where 里取出动作器脚本名(形如 xxx.mjs --apply)
  const claimed = Object.entries(AUTO_HEAL_LEDGER).filter(
    ([, v]) => v.mode === 'auto' && /派发时已带/.test(String(v.why)) && /[a-z0-9-]+\.mjs\s+--apply/i.test(String(v.where)),
  )
  assert.ok(claimed.length >= 2, '本应至少有两格声称"派发时已带 --apply"(ops-patrol / service-heal)')
  for (const [name, v] of claimed) {
    const script = String(v.where).match(/([a-z0-9-]+\.mjs)\s+--apply/i)[1]
    // 两段都要找,缺一不可:
    //  ① 源码里确实引到了这个脚本名(证明这格的动作面就是它);
    //  ② 某个 execFileSync/spawnSync 调用里同时出现"脚本变量/名字"与 '--apply'。
    //     派发有**两种写法**,只认一种会把真派发判成没派发(第一版就栽在这):
    //       a) 直写路径:['scripts/xxx.mjs', '--json', '--apply']
    //       b) 变量拼路径:const script = join(…, 'xxx.mjs'); execFileSync(…, [script, '--json', '--apply'])
    const quoted = src.includes(script) || src.includes(script.replace(/\.mjs$/, ''))
    assert.ok(quoted, `${name} 声称派发 ${script},但源码里连这个脚本名都没出现过`)
    const re = new RegExp(`(execFileSync|spawnSync)\\([\\s\\S]{0,320}--apply`)
    assert.match(src, re, `${name} 声称派发 ${script} --apply,但源码里找不到任何带 --apply 的派发调用`)
  }
})

test('台账对账:manual 格不得声称"派发时已带 --apply"(动作面必须由人点)', () => {
  for (const [name, v] of Object.entries(AUTO_HEAL_LEDGER)) {
    if (v.mode !== 'manual') continue
    assert.doesNotMatch(
      String(v.why),
      /派发时已带 --apply/,
      `${name} 是 manual 却写"派发时已带 --apply" —— manual 格的动作面必须由人点`,
    )
  }
})

test('台账对账:merge-addition-loss 必须是 manual(代码只判不修,出口由人点)', () => {
  // 本次错判的钉子:auditMergeAdditionLoss 只派 --all-new,设计注释明写"只判不修"
  assert.equal(AUTO_HEAL_LEDGER['merge-addition-loss'].mode, 'manual')
  assert.match(AUTO_HEAL_LEDGER['merge-addition-loss'].why, /只判不修|人来点/)
})

test('台账对账:每个告警出口都要有登记 —— 由源码里的告警身份反查', () => {
  // 漏登记是台账唯一会漂的方向(新增一格的人不会想到回来改它),而遍历台账自身的
  // 那两条测试对"漏登记"零判别力。这里改成**从源码的告警身份反查**。
  const identities = [
    ['converge-align', 'converge-align-stall'],
    ['env-drift', 'env 键值漂移'],
    ['ops-patrol', '元运维巡检红'],
    ['service-heal', '服务自愈'],
    ['merge-addition-loss', '合并吞并对账判红'],
    ['host-timezone', '主机时区'],
    ['disk-root-hygiene', '盘根外流'],
    ['public-path', '公网路径探测'],
    ['orphan-deletion-refs', '孤儿删除引用巡检命中'],
    ['recovery-source-refresh', '恢复源'],
  ]
  for (const [key, needle] of identities) {
    assert.ok(AUTO_HEAL_LEDGER[key], `告警出口「${needle}」在台账里没有登记 —— 漏登记的格必须登记`)
    assert.ok(
      GUARDIAN_SRC().includes(needle),
      `告警出口「${needle}」在 git-guardian.mjs 里已找不到(可能已改名或删除),台账需同步`,
    )
  }
})

// ─── 自愈动作面收窄:必须真的派发 --align-only(不是裸跑收敛)──────────────
//
// 这是**动作面最关键的不变量**,而上一版测试只在告警**文案**里断言过
// `--align-only` 出现过 —— 把它改成裸 `git-sync-converge.mjs`(那会 fetch/合并/推送)
// 一样全绿。现在直接钉 argv。
test('自愈动作面:实际派发的 argv 必须带 --align-only(裸跑收敛会 fetch/合并/推送)', () => {
  const src = GUARDIAN_SRC()
  assert.match(
    src,
    /spawnSync\([\s\S]{0,300}process\.execPath[\s\S]{0,200}\[\s*'scripts\/git-sync-converge\.mjs',\s*'--align-only'\s*\]/,
    '自愈派发未带 --align-only —— 裸跑 git-sync-converge.mjs 会顺手做 fetch/合并/推送,动作面失控',
  )
  assert.doesNotMatch(
    src,
    /spawnSync\([\s\S]{0,300}process\.execPath[\s\S]{0,200}\[\s*'scripts\/git-sync-converge\.mjs'\s*\]/,
    '自愈派发出现了不带 --align-only 的裸调用',
  )
})

test('自愈总开关:env IHUI_ALIGN_HEAL_DISABLED 必须是实现的真实读取面(名字不一致要判红)', () => {
  // 复核发现:注释写 ALIGN_HEAL_DISABLED 而实现读 IHUI_ALIGN_HEAL_DISABLED,名字不一致
  // 且无测试能发现。这里钉住"实现确实读 IHUI_ 前缀的那个"。
  const src = GUARDIAN_SRC()
  assert.match(src, /process\.env\.IHUI_ALIGN_HEAL_DISABLED/)
  // 纯判据层的注入面仍须有效(env 读不到时也要能用注入口测)
  assert.equal(decideAlignHeal(FAILING, {}, NOW, { disabled: true }).heal, false)
})

test('自愈熔断:派发器起不来也计入次数时,必须在告警正文里看得见(不得静默烧光额度)', () => {
  // 复核发现的两条熔断误消耗路径之一:run() 抛异常也算一次 attempts。
  // 即便本次不修,也要钉住"熔断后告警正文必须出现熔断字样"——
  // 否则收信人看到的是一条"从没说有人试过"的告警。
  const dir = tmpDir('breaker')
  const statePath = writeState(dir, FAILING)
  const sent = []
  checkConvergeAlignStall({
    now: NOW,
    statePath,
    notify: (name, detail) => sent.push([name, String(detail || '')]),
    // 熔断态:decideAlignHeal 返回 healed:false(used >= maxAttempts)
    heal: () => ({ healed: false, ok: false, why: `自愈已用满 3/3 次 ⇒ 熔断,转人工`, attempts: 3 }),
    cfg: {},
  })
  // 熔断时仍按原阈值喊人(不能因为"在修"就完全不喊)
  assert.equal(sent.length, 1)
  // 正文必须让人看得出"机器试过了、且已熔断"
  assert.match(sent[0][1], /熔断|自动修复/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
