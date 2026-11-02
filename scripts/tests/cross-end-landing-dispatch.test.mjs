// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端落库腿(`sweepCrossEndLandingLeg`)与非色档源头腿(`sweepCssTokensSourceLeg`)的镜像测试。
 *
 * 立因:七条跨端自愈腿"真写工作树、落库交给 auto-commit-quiet",而该器全仓零派生调用点
 * (§0.9 造好没装车 = 没有);两条新腿把收编与源头派生挂进守护。本测试钉行为,不复制判据(§22c):
 * 结论行由生产方 `ledgerConclusionLine` 现产(契约不手抄),解析与日志断言全部 import 生产实现。
 *
 * 测试钉死:
 *   T1 收编 7 枚 ⇒ ok:true 且读数进计数,logger 落「📦 跨端落库」;
 *   T2 无待收(collected=0 ∧ contested=0 ∧ incomplete=0)⇒ state:'ok' 且**一声不出**(§0.3 反向:
 *      clean 常态零噪声,15 分钟一行"没问题"只会淹日志);
 *   T3 取不到 COLLECT-RESULT ⇒ undetermined,绝不折成 clean(与 T3b 阳性对照成对);
 *   T4 子进程被 SIGTERM 掐死 ⇒ 同样未判定,且文案点名"被掐死"而非"跑完";
 *   T5 节流:同一 tickFile 窗口内第二次不派发,推后过 intervalMs 放行;
 *   T6 形状锁:两条腿函数体内 existsSync 前置派发(结构配平取体,不拿行号邻近当证据);
 *   T7 contested/incomplete 计数解析正确且有拦截就必须点名(与 T2 成对);
 *   T8 css-tokens 腿三态:零字节写回⇒clean 无日志 / 已写回⇒written 有日志 / 乱输出⇒未判定;
 *   T9 装车顺序锁:sweepCssTokensSourceLeg() 与 sweepCrossEndLandingLeg() 两行必须排在
 *      sweepHandMirrorUpgrades() 之后、sweepParityCockpit() 之前(源头先补、再收编、最后汇总面);
 *   C1 契约锁:两条腿匹配的结论文案必须真存在于生产方源码(不手抄形状)。
 *
 * 取材面说明:被测两条腿系主 agent 本轮新写入工作树(HEAD 尚无),形状锁按 §0.4 取"与被测实现
 * 同面"的工作树副本(readFileSync),与同族样板 cross-end-mirror-heal-dispatch.test.mjs 一致;
 * 提交后两面收敛,不影响断言。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { sweepCrossEndLandingLeg, sweepCssTokensSourceLeg } from '../git-guardian.mjs'
import { __test__ as autoQuiet } from '../auto-commit-quiet.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const CSS_SYNC = resolve(import.meta.dirname, '..', 'sync-css-tokens.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => ({ tickFile: join(mkScratch('cross-end-landing-'), 'tick.json') })
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}

/** 结论行一律由生产方现产(§22c:测试不复制 COLLECT-RESULT 的拼装)。 */
const collectLine = (over = {}) =>
  autoQuiet.ledgerConclusionLine({
    ledger: 'ok',
    collected: 0,
    whitelistCollected: 0,
    ledgerCollected: 0,
    quiet: 0,
    contested: 0,
    incomplete: 0,
    ignored: 0,
    deduped: 0,
    held: 0,
    dry: false,
    ...over,
  })
const runnerOf = (stdout, extra = {}) => () => ({ status: 0, stdout, stderr: '', ...extra })

test('T1 收编 7 枚 ⇒ ok:true、计数正确、logger 落「📦 跨端落库」', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndLandingLeg({
    ...fixture(),
    logger,
    runner: runnerOf(collectLine({ collected: 7, ledgerCollected: 7 })),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'ok')
  assert.equal(r.collected, 7)
  assert.equal(r.ledgerCollected, 7)
  const line = logs.find((l) => /📦 跨端落库/.test(l))
  assert.ok(line, '有收编必须留读数(否则"收了 7 枚"和"跑了但没判"长得一样)')
  assert.match(line, /collected=7/)
})

test('T2 无待收 ⇒ state:ok 且零日志(clean 常态不淹守护日志)', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndLandingLeg({ ...fixture(), logger, runner: runnerOf(collectLine()) })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'ok')
  assert.equal(r.collected, 0)
  assert.equal(logs.length, 0, 'collected=0 ∧ contested=0 ∧ incomplete=0 ⇒ 一声不出(T1 的阳性对照臂)')
})

test('T3 无 COLLECT-RESULT ⇒ 未判定,绝不折成 clean', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndLandingLeg({ ...fixture(), logger, runner: runnerOf('一些没有结论行的输出\n') })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'undetermined')
  const line = logs.find((l) => /跨端落库/.test(l))
  assert.ok(line && /未判定/.test(line), '取不到结论必须点名"未判定"')
  assert.match(line, /这不等于"无待收编"/, '§0.3:没判绝不冒充判过')
  assert.ok(!logs.some((l) => /📦/.test(l)), '未判定不得落成收编读数')
  // 阳性对照:同一夹具拿到真结论行 ⇒ 走 ok 路径(证明 T3 的红是"没结论"触发的,不是夹具坏了)
  const { logs: logs2, logger: logger2 } = logsOf()
  const ok = sweepCrossEndLandingLeg({ ...fixture(), logger: logger2, runner: runnerOf(collectLine()) })
  assert.equal(ok.ok, true)
  assert.equal(logs2.length, 0)
})

test('T4 SIGTERM 掐死 ⇒ 未判定且文案点名是被掐死而非跑完', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndLandingLeg({
    ...fixture(),
    logger,
    runner: () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }),
  })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.ok, false)
  assert.equal(r.signal, 'SIGTERM')
  const line = logs.find((l) => /跨端落库/.test(l))
  assert.match(line, /SIGTERM/, '信号必须进文案(runLegChild 头注:超时掐死与跑完没打结论行在日志里必须两型)')
  assert.match(line, /掐死/)
})

test('T5 节流:窗口内第二次不派发;推后过 intervalMs 放行', () => {
  const f = fixture()
  const intervalMs = 15 * 60 * 1000
  const T0 = 1_700_000_000_000
  let calls = 0
  const counting = () => {
    calls += 1
    return { status: 0, stdout: collectLine(), stderr: '' }
  }
  const first = sweepCrossEndLandingLeg({ ...f, logger: () => {}, runner: counting, intervalMs, now: T0 })
  assert.equal(first.ran, true)
  const second = sweepCrossEndLandingLeg({ ...f, logger: () => {}, runner: counting, intervalMs, now: T0 + 60_000 })
  assert.equal(second.ran, false)
  assert.equal(second.why, '未到节流窗口')
  assert.equal(calls, 1, '窗口内一次都不派生(收编器每轮会写 HEAD,重复派生即重复提交)')
  // 阳性对照:推后越过窗口必须放行(否则锁是"永不放行"的假锁)
  const third = sweepCrossEndLandingLeg({ ...f, logger: () => {}, runner: counting, intervalMs, now: T0 + intervalMs + 1 })
  assert.equal(third.ran, true)
  assert.equal(calls, 2)
})

/** 结构配平取函数体(不用行号邻近:append 一行就挪位的证据不是证据)。 */
function functionBody(name) {
  const sig = `export function ${name}(`
  const start = SRC.indexOf(sig)
  assert.ok(start >= 0, `${name} 定义消失 ⇒ 本锁要重写,而不是静默失配`)
  // 参数表默认值里的 `{}`(如 `opts = {}`)不是函数体开括弧:先配平第一对圆括号再找 `{`
  let paren = 0
  let i = start + sig.length - 1
  for (; i < SRC.length; i++) {
    const c = SRC[i]
    if (c === '(') paren++
    else if (c === ')') {
      paren--
      if (paren === 0) break
    }
  }
  let depth = 0
  let opened = false
  for (let j = SRC.indexOf('{', i + 1); j < SRC.length; j++) {
    const c = SRC[j]
    if (c === '{') {
      depth++
      opened = true
    } else if (c === '}') {
      depth--
      if (opened && depth === 0) return SRC.slice(start, j + 1)
    }
  }
  assert.fail(`${name}:函数体花括号不配平,取不出闭合体`)
}

test('T6 形状锁:两条腿函数体内 existsSync 排在节流与派发之前', () => {
  for (const name of ['sweepCrossEndLandingLeg', 'sweepCssTokensSourceLeg']) {
    const body = functionBody(name)
    const guard = body.search(/if \(!existsSync\(script\)\)/)
    assert.ok(guard >= 0, `${name}:必须先 existsSync 再动(器物不在位 ⇒ 显式跳过,不冒进 spawn)`)
    const throttle = body.search(/legThrottle\(/)
    const dispatch = body.search(/runLegChild\(/)
    assert.ok(throttle > guard, `${name}:existsSync 必须前置于节流(顺序反了会在缺器物时先烧节流戳)`)
    assert.ok(dispatch > throttle, `${name}:节流必须前置于真派发 runLegChild`)
    assert.match(body, /return \{ ran: false, why: '器物不在位' \}/, `${name}:不在位档必须返回 ran:false`)
  }
})

test('T7 contested=3 ∧ incomplete=2 ∧ collected=0 ⇒ 计数逐键正确且必须点名', () => {
  const { logs, logger } = logsOf()
  const r = sweepCrossEndLandingLeg({
    ...fixture(),
    logger,
    runner: runnerOf(collectLine({ contested: 3, incomplete: 2, held: 1 })),
  })
  assert.equal(r.collected, 0)
  assert.equal(r.contested, 3, 'contested 解析必须来自结论行本身(与 T2 的 0 成对,证明解析器真在读)')
  assert.equal(r.incomplete, 2)
  assert.equal(r.held, 1)
  assert.ok(logs.some((l) => /📦 跨端落库/.test(l)), '有拦截就要点名,不能静默(§0.3 反向:账上有事必须出声)')
})

test('T8 css-tokens 腿三态:clean 无日志 / written 有日志 / 乱输出未判定', () => {
  // ① 一致 ⇒ clean,零字节写回是幂等常态 ⇒ 一声不出
  const a = logsOf()
  const rClean = sweepCssTokensSourceLeg({
    ...fixture(),
    logger: a.logger,
    runner: runnerOf('[sync-css-tokens] ✅ tokens.css 受管块与 TS 源一致(47 档),零字节写回\n'),
  })
  assert.equal(rClean.ok, true)
  assert.equal(rClean.state, 'clean')
  assert.equal(a.logs.length, 0, '源头没动是绝大多数轮次的常态,不该每 30 分钟刷一行')
  // ② 写回 ⇒ written,必须有日志(写了盘却不落账 = 下一轮又从头来)
  const b = logsOf()
  const rWrite = sweepCssTokensSourceLeg({
    ...fixture(),
    logger: b.logger,
    runner: runnerOf('[sync-css-tokens] ✅ 已写回 tokens.css(更新受管块,共 47 档)\n'),
  })
  assert.equal(rWrite.ok, true)
  assert.equal(rWrite.state, 'written')
  assert.ok(b.logs.some((l) => /🎨 非色档源头/.test(l)))
  // ③ 乱输出 ⇒ 未判定,绝不冒充"源头已同源"
  const c = logsOf()
  const rUn = sweepCssTokensSourceLeg({ ...fixture(), logger: c.logger, runner: runnerOf('garbage out') })
  assert.equal(rUn.ok, false)
  assert.equal(rUn.state, 'undetermined')
  assert.match(c.logs.find((l) => /非色档源头/.test(l)), /未判定/)
  assert.ok(!c.logs.some((l) => /🎨/.test(l)))
})

test('T9 装车顺序锁:两条新腿排在 sweepHandMirrorUpgrades() 后、sweepParityCockpit() 前', () => {
  const at = (s) => {
    const i = SRC.indexOf(s)
    assert.ok(i >= 0, `派发点缺失:${s}(腿挂了但顺序错/根本没挂,都由这一锁拦)`)
    return i
  }
  const iHand = at('if (!CHECK_ONLY) sweepHandMirrorUpgrades()')
  const iCss = at('if (!CHECK_ONLY) sweepCssTokensSourceLeg()')
  const iLand = at('if (!CHECK_ONLY) sweepCrossEndLandingLeg()')
  const iCockpit = at('if (!CHECK_ONLY) sweepParityCockpit()')
  assert.ok(iHand < iCss && iHand < iLand, '两条新腿必须在七条写盘腿之后(源头/收编是链的最后一节)')
  assert.ok(iCss < iCockpit && iLand < iCockpit, '必须在驾驶舱之前(汇总面读的是本轮终态)')
  // 节流 env 覆盖 + 节流戳落点(值守压节拍用,不钉死则换默认值无人发现)
  assert.match(SRC, /IHUI_CROSS_END_LANDING_INTERVAL_MS/)
  assert.match(SRC, /IHUI_CSS_TOKENS_SOURCE_INTERVAL_MS/)
  assert.match(SRC, /'cross-end-landing-last\.json'/)
  assert.match(SRC, /'css-tokens-source-last\.json'/)
})

test('C1 契约锁:两条腿匹配的结论文案真存在于生产方源码(不手抄形状)', () => {
  // 落库腿读的 COLLECT-RESULT 由 ledgerConclusionLine 现产(T1 已用同一函数拼行,键集天然对齐);
  // 这里再钉生产方确实导出它,且结论行以 'COLLECT-RESULT' 起头(腿的正则匹配的是前缀)。
  assert.equal(typeof autoQuiet.ledgerConclusionLine, 'function')
  assert.ok(collectLine({ collected: 1 }).startsWith('COLLECT-RESULT'))
  // css 腿的两条文案必须仍在生成器源码里(它改措辞 ⇒ 腿立刻瞎成 undetermined,本锁先一步点名)
  const cssSrc = readFileSync(CSS_SYNC, 'utf8')
  assert.match(cssSrc, /零字节写回/, 'sync-css-tokens.mjs 的"一致"档文案变了 ⇒ sweepCssTokensSourceLeg 的 clean 臂失明')
  assert.match(cssSrc, /已写回 tokens\.css\(/, '「已写回 tokens.css(」文案变了 ⇒ written 臂失明')
})
