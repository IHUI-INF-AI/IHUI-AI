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
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'

import {
  sweepCrossEndLandingLeg,
  sweepCssTokensSourceLeg,
  sweepMiniappMessageKeysLeg,
  sweepRnColorLiteralLeg,
  sweepRnCompatLeg,
  sweepUiMirrorLeg,
} from '../git-guardian.mjs'
import { __test__ as autoQuiet } from '../auto-commit-quiet.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN = resolve(import.meta.dirname, '..', 'git-guardian.mjs')
const CSS_SYNC = resolve(import.meta.dirname, '..', 'sync-css-tokens.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')

const fixture = () => ({ tickFile: join(mkScratch('cross-end-landing-'), 'tick.json') })
/** 每条腿各用独立 scratch 内的独立戳名,避免同片测试互踩节流窗口 */
const tick = (name) => join(mkScratch('cross-end-landing-'), name)
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

// ── 第二批:两件存量落档器首次上链(sweepUiMirrorLeg / sweepRnColorLiteralLeg)────────────
// 立因:两件器物早就存在,但 parity-auto 只被喂 `--json`、runner 里 255 只跑 `--check --staged`,
// git-guardian 通篇零 `--apply` ⇒ 写档从未放行(§0.9)。挂周期前的前置是归属闸已就位。
test('U1 落档腿:有产出 ⇒ 读数进计数且落日志', () => {
  const seen = []
  const r = sweepUiMirrorLeg({
    tickFile: tick('u1.json'),
    logger: (s) => seen.push(String(s)),
    runner: () => ({
      status: 0,
      stdout: '结论 landing=2(新登记 2/在册去重 0) skipLanded=1 held=3 写出=2 ledger=ok',
      stderr: '',
    }),
  })
  assert.deepEqual({ ran: r.ran, ok: r.ok, landed: r.landed, held: r.held, skipped: r.skipped }, {
    ran: true,
    ok: true,
    landed: 2,
    held: 3,
    skipped: 1,
  })
  assert.ok(seen.some((s) => s.includes('小程序↔RN 映射块落档')), '有产出必须点名到哪条腿')
})

test('U2 落档腿:landing=0 ∧ held=0 ⇒ 一声不出(clean 常态零噪声)', () => {
  let hits = 0
  const r = sweepUiMirrorLeg({
    tickFile: tick('u2.json'),
    logger: () => {
      hits++
    },
    runner: () => ({ status: 0, stdout: '结论 landing=0 skipLanded=5 held=0 ledger=ok', stderr: '' }),
  })
  assert.equal(r.ok, true)
  assert.equal(hits, 0, 'clean 常态不得落日志')
})

test('U3 落档腿:结论取不到 ⇒ undetermined,绝不折成"无漂移可落"(§0.3)', () => {
  const seen = []
  const r = sweepRnColorLiteralLeg({
    tickFile: tick('u3.json'),
    logger: (s) => seen.push(String(s)),
    runner: () => ({ status: 0, stdout: '一句话里没有 landing=', stderr: '' }),
  })
  assert.equal(r.state, 'undetermined')
  assert.equal(r.ok, false)
  assert.ok(seen.some((s) => s.includes('未判定')), '未判定必须显式点名')
})

test('U4 落档腿:held>0 ⇒ 必须点名(拦截不能静默)', () => {
  const seen = []
  const r = sweepRnColorLiteralLeg({
    tickFile: tick('u4.json'),
    logger: (s) => seen.push(String(s)),
    runner: () => ({ status: 0, stdout: '结论 landing=0 skipLanded=0 held=6 ledger=unjudged', stderr: '' }),
  })
  assert.equal(r.held, 6)
  assert.equal(r.state, 'unjudged-ledger')
  assert.ok(seen.length > 0, 'held=6 是"本应落档却被归属闸拦下",不点名等于静默放过')
})

test('U5 落档腿顺序锁:两件在写盘腿之后、在落库腿之前,且 tickFile 可被 opts 覆盖', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const at = (needle) => src.indexOf(needle)
  const iCss = at('if (!CHECK_ONLY) sweepCssTokensSourceLeg()')
  const iUi = at('if (!CHECK_ONLY) sweepUiMirrorLeg()')
  const iColor = at('if (!CHECK_ONLY) sweepRnColorLiteralLeg()')
  const iLand = at('if (!CHECK_ONLY) sweepCrossEndLandingLeg()')
  const iCockpit = at('if (!CHECK_ONLY) sweepParityCockpit()')
  assert.ok(iUi > 0 && iColor > 0, '两条落档腿必须真的挂在主串上(不是只在文件里出现过函数名)')
  assert.ok(iCss < iUi && iUi < iLand && iColor < iLand, '源头 → 落档 → 落库,顺序颠倒就会收编到旧面')
  assert.ok(iLand < iCockpit, '落库必须排在汇总面之前')
  // tickFile 若没走 opts 解构,冒烟与镜像测试会互相踩生产节流戳(本轮实测踩过一次)
  assert.match(src, /tickFile = defaultTickFile/, '共用派发体必须允许 opts 覆盖节流戳')
})

// ── 第三批:门 251 的修法出口首次上链(sweepRnCompatLeg)──────────────────────────────
// 立因:守门 251 是提交链上的 blocking 门,其头注给出的两条修法出口都指向 `gen-rn-compat.mjs --write`,
// 而该命令在全仓**零调度点**(git grep 只命中门体文案与自身)。上游发新图标名 / 登记表新增一条
// rn↔miniapp 都不触发提交 ⇒ 没有这条腿,漂移要等下一个人恰好提交且恰好撞门才被发现(同门 260 的 CVE 型)。
// 挂周期腿的前置是本器补齐了归属闸 + 未知旗拒绝 + 落点申报(2026-11-03),否则自动写档=覆盖他席现场。
test('U6 RN兼容层腿:按本器真实结论行解析 landing/held,且 clean 一声不出', () => {
  const seen = []
  const r = sweepRnCompatLeg({
    tickFile: tick('u6.json'),
    logger: (s) => seen.push(String(s)),
    runner: () => ({
      status: 0,
      // 逐字取自 2026-11-03 实跑 `node scripts/gen-rn-compat.mjs --write` 的末行(契约不手抄)
      stdout:
        '结论 landing=2(新登记 1/在册去重 1) 无变化=0 held=1 写出=2 leg=rn-compat ledger=ok landingPath=.ihui-agent/state/cross-end-landing.jsonl',
      stderr: '',
    }),
  })
  assert.deepEqual(
    { ran: r.ran, ok: r.ok, state: r.state, landed: r.landed, held: r.held },
    { ran: true, ok: true, state: 'ok', landed: 2, held: 1 },
  )
  assert.ok(seen.some((s) => s.includes('RN 兼容层派生产物落档')), '有产出必须点名到哪条腿')
  // 反向对照:landing=0 ∧ held=0(幂等常态)⇒ 不得刷日志
  const hits = []
  const clean = sweepRnCompatLeg({
    tickFile: tick('u6-clean.json'),
    logger: (s) => hits.push(String(s)),
    runner: () => ({
      status: 0,
      stdout: '结论 landing=0(新登记 0/在册去重 0) 无变化=2 held=0 写出=0 leg=rn-compat ledger=ok',
      stderr: '',
    }),
  })
  assert.equal(clean.landed, 0)
  assert.equal(hits.length, 0, 'clean 档必须零输出(每 30 分钟一行"没问题"会把守护日志淹成噪声)')
})

test('U7 RN兼容层腿:结论行缺失 ⇒ 未判定,不得折成"无漂移可落"', () => {
  const r = sweepRnCompatLeg({
    tickFile: tick('u7.json'),
    logger: () => {},
    runner: () => ({ status: 1, stdout: '', stderr: 'boom' }),
  })
  assert.equal(r.ok, false, '取不到结论不得记绿')
  assert.equal(r.state, 'undetermined')
})

test('U8 RN兼容层腿挂载与器内契约锁(改措辞即点名,防腿静默失明)', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const iCompat = src.indexOf('if (!CHECK_ONLY) sweepRnCompatLeg()')
  const iLand = src.indexOf('if (!CHECK_ONLY) sweepCrossEndLandingLeg()')
  assert.ok(iCompat > 0, '新腿必须真挂在主串上(不是只在文件里出现过函数名)')
  assert.ok(iCompat < iLand, '写盘腿必须排在落库腿之前,否则本轮产出收编不到')
  // 本器结论行文案是派发体唯一的取数面:它改措辞 ⇒ 腿当场瞎成 undetermined(与 css 腿同一条锁法)
  const gen = readFileSync(join(dirname(GUARDIAN), 'gen-rn-compat.mjs'), 'utf8')
  assert.match(gen, /结论 landing=\$\{landing\}/, '本器结论行前缀变了 ⇒ 派发体再也量不到产出')
  assert.match(gen, /held=\$\{held\.length\}/, 'held 维缺失 ⇒ 归属闸拦了几枚无人知道')
  assert.match(gen, /ledger=\$\{ledgerState\}/, 'ledger 维缺失 ⇒ "写了盘没申报上"会被读成 clean')
  // 未知旗必须拒绝:静默忽略会让周期腿把 --apply 当成"预演不写盘"而每轮报绿(空转守卫)
  assert.match(gen, /未知参数 \$\{unknown\.join\(' '\)\}/, '本器不得静默忽略未知旗')
})

// ── 第四批:小程序词包整块缺口首次有器物并上链(sweepMiniappMessageKeysLeg)──────────────
// 立因:驾驶舱的 mirror-pack-namespace-missing 红连日按同身份复发(2026-11-03 现读 09:20 / 10:32 两轮),
// 尺子(check-miniapp-mirror-fidelity 的 packAbsent 维)把出路写成"人工从 messages/mobile-rn 逐字搬",
// 而全仓零器物 ⇒ 每复发一次都要人当场手抄五语言 JSON(§0.9:判据在、器物缺 = 没有)。
const MSG_KEYS_CONCLUSION =
  '结论 landing=5(新登记 5/在册去重 0) 计划=35 held=0 写出=5 leg=miniapp-message-keys ledger=ok 基准侧查无=0 landingPath=.ihui-agent/state/cross-end-landing.jsonl'

test('U9 词包搬运腿:按本器真实结论行解析 landing/写出,且 clean 一声不出', () => {
  const seen = []
  const r = sweepMiniappMessageKeysLeg({
    tickFile: tick('u9.json'),
    logger: (s) => seen.push(String(s)),
    runner: () => ({ status: 0, stdout: MSG_KEYS_CONCLUSION, stderr: '' }),
  })
  assert.deepEqual(
    { ran: r.ran, ok: r.ok, state: r.state, landed: r.landed, held: r.held },
    { ran: true, ok: true, state: 'ok', landed: 5, held: 0 },
  )
  assert.ok(seen.some((s) => s.includes('词包整块缺口搬运')), '有产出必须点名到哪条腿')
  // 反向对照:本端词包无缺口(幂等常态)⇒ 零落地零日志
  const hits = []
  const clean = sweepMiniappMessageKeysLeg({
    tickFile: tick('u9-clean.json'),
    logger: (s) => hits.push(String(s)),
    runner: () => ({
      status: 0,
      stdout: '结论 landing=0 无变化=0 held=0 写出=0 leg=miniapp-message-keys ledger=ok needs=0 未判定=0(本端词包无整块缺口)',
      stderr: '',
    }),
  })
  assert.equal(clean.landed, 0)
  assert.equal(clean.held, 0)
  assert.equal(hits.length, 0, 'clean 档必须零输出(每 30 分钟一行"没问题"会把守护日志淹成噪声)')
})

test('U10 词包搬运腿:结论行缺失 ⇒ 未判定,不得折成"无缺口可搬"', () => {
  const r = sweepMiniappMessageKeysLeg({
    tickFile: tick('u10.json'),
    logger: () => {},
    runner: () => ({ status: 2, stdout: '', stderr: '还原度门取不到' }),
  })
  assert.equal(r.ok, false, '取不到结论不得记绿(§0.3)')
  assert.equal(r.state, 'undetermined')
})

test('U11 词包搬运腿挂载与器内契约锁(改措辞即点名,防腿静默失明)', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const iMsg = src.indexOf('if (!CHECK_ONLY) sweepMiniappMessageKeysLeg()')
  const iLand = src.indexOf('if (!CHECK_ONLY) sweepCrossEndLandingLeg()')
  const iBundle = src.indexOf('if (!CHECK_ONLY) healI18nBundleLeg()')
  assert.ok(iMsg > 0, '本腿必须真挂在主串上(不是只在文件里出现过函数名)')
  assert.ok(iMsg < iLand, '写盘腿排在落库腿之前,否则本轮产出收编不到')
  assert.ok(iBundle > iMsg, '离线建包腿必须排在搬运之后,否则搬进来的词进不了本轮包')
  const tool = readFileSync(join(dirname(GUARDIAN), 'sync-miniapp-message-keys.mjs'), 'utf8')
  assert.match(tool, /结论 landing=\$\{landing\}/, '本器结论行前缀变了 ⇒ 派发体再也量不到产出')
  assert.match(tool, /held=\$\{held\.length\}/, 'held 维缺失 ⇒ 归属闸拦了几枚无人知道')
  assert.match(tool, /ledger=\$\{ledgerState\}/, 'ledger 维缺失 ⇒ "写了盘没申报上"会被读成 clean')
  assert.match(tool, /未知参数 \$\{unknown\.join\(' '\)\}/, '本器不得静默忽略未知旗')
  assert.match(tool, /ownershipGate\(\{ root: ROOT \}\)/, '写盘前必须有归属闸(共享工作区不覆盖他席现场)')
  // 零复算(§0.6):"缺哪些命名空间"必须取自还原度门的 --json,而不是本器另写一把取词尺
  assert.match(tool, /check-miniapp-mirror-fidelity\.mjs/, '缺口口径必须 import/调用既有尺子')
  assert.doesNotMatch(tool, /function consumedKeys|MARK_RE/, '本器不得自带第二份取词判据')
})
