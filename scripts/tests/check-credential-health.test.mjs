// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-credential-health.mjs 的「告警去重身份粒度」与「投递台账诚实性」。
//
// 为什么这一族只有镜像能钉:门自身的 --self-test 走的是构造输入 + 纯函数,它证的是
// "函数会给正确答案";而两个缺陷都长在**调用侧** ——
//   缺陷① 去重身份 = "本轮失败项拼成的整条 sig"(不是逐项),失败集合逐轮翻转即被当成新告警;
//   缺陷② appendLedger 恒传 null ⇒ 台账逐条写 "(dry-run,未投递)",而真寄成功过。
// 只改判据函数、不改调用点(或反过来),纯函数测试一律看不见 —— 所以 T7/T8 是源码级反向锁。
//
// 各条与"把它改回旧写法就翻红"的对应关系:
//   T0 import 不得触发 CLI 巡检(§22d 守卫)—— 摘掉 isDirectRun 守卫即红;
//   T1 (a) 同一项窗口内第二次不寄 + 超窗必寄 —— 把 due 写成恒真/恒假各红一支;
//   T2 (b) 组合翻转:已寄项不得重寄、新项可寄 —— 恢复旧 `changed = sig !== prev.sig` 即红;
//   T3 (b) 两项各自出现/消失凑 4 种组合:旧判据寄 4 封、新判据寄 2 封(噪声主因的量化复现);
//   T4 (c) 真寄成功的台账条目**不得**出现"未投递";
//   T5 (d) dry-run 的台账**必须**出现"未投递"(两态各有独立证据,不得由一句模板覆盖);
//   T6 全通道失败写"❌ 全通道失败"而非"未投递"(成因不同的两件事不得并成一格);
//   T7 源码锁:maybeAlert 体内不得再出现 `appendLedger(title, desp, null)` 这一恒传;
//   T8 源码锁:maybeAlert 必须把决定权交给 decideAlert,且不得再自己拼 sig 判 changed/overdue;
//   T9 向后兼容:真实现读的状态文件(v1 单条 sig)不得被读成 unknown;文件不在位则如实报"未判定";
//   T10 反向锁:不得出现"每日/每轮最多 N 封"式总量封顶(AGENTS §5e 明令禁止)。
// 注:下面 oldWayWouldSend 是**修复前判据形态的快照**,只用于证明改动方向,禁止随源文件演进。

import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC_PATH = resolve(ROOT, 'scripts', 'check-credential-health.mjs')
const SRC = readFileSync(SRC_PATH, 'utf8')

// 副作用快照:本文件所在仓库此刻的 .workbuddy 运行态。被 import 的脚本若没有 §22d 守卫,
// 顶层 CLI 链会真跑一轮巡检(打厂商 API,判红时还会真发一封到人邮件)—— 那必须可被量到。
const WATCHED = [
  'credential-health-alert-state.json',
  'credential-health-alerts.log',
  'credential-health-last.json',
  'credential-health-alert-UNDELIVERED.json',
]
const sideEffects = () =>
  WATCHED.map((f) => {
    const p = join(ROOT, '.workbuddy', f)
    if (!existsSync(p)) return [f, 'absent']
    try {
      const s = statSync(p)
      return [f, s.size, Math.round(s.mtimeMs)]
    } catch (e) {
      return [f, 'error', String(e && e.code)]
    }
  })

const BEFORE = sideEffects()
// 动态 import:守卫若在,这次加载只取判据、不跑 CLI(T0 与这行是绑在一起的)。
const m = await import('../check-credential-health.mjs')
const { normalizeAlertState, decideAlert, advanceAlertState, buildLedgerEntry, ALERT_ITEM_WINDOW_MS, ALERT_STATE_VERSION } = m

const T0 = Date.parse('2026-09-29T00:00:00.000Z')
const HR = 3600 * 1000
const A = '部署停摆(线上构建 vs origin/main)'
const B = '国内镜像活性(mirror-to-cn)'

/** 造一份 v2 状态(表里的值 = 上次通报的毫秒时刻) */
const v2state = (entries, nowMs = T0) => ({
  present: true,
  parsed: {
    version: ALERT_STATE_VERSION,
    ts: new Date(nowMs).toISOString(),
    sig: Object.keys(entries).sort().join(' | '),
    fails: Object.keys(entries).length,
    sent: Object.fromEntries(Object.entries(entries).map(([k, ms]) => [k, new Date(ms).toISOString()])),
  },
})
/** 修复前判据的逐字快照(HEAD 版 maybeAlert 里的 changed/overdue 两行 + 归零判定) */
function oldWayWouldSend({ failNames, prev, nowMs }) {
  const sig = [...failNames].sort().join(' | ')
  if (failNames.length === 0 && !(prev && prev.sig)) return false
  if (failNames.length > 0) {
    const changed = !prev || (prev.sig || '') !== sig
    const overdue = prev && prev.ts && nowMs - Date.parse(prev.ts) > ALERT_ITEM_WINDOW_MS
    if (!changed && !overdue) return false
  }
  return true
}
/** 逐轮推进一整轮"判 → 寄成功 → 写回",返回 { 是否寄, 下一份 parsed 状态 } */
function step(parsed, failNames, nowMs) {
  const state = parsed ? { present: true, parsed } : { present: false }
  const d = decideAlert({ failNames, state, nowMs })
  if (!d.shouldSend) return { parsed, sentCount: 0, due: [], pending: d.pending }
  const next = advanceAlertState({ table: normalizeAlertState(state).table, failNames, notified: d.due, nowMs, recovered: d.recovered })
  return { parsed: next, sentCount: 1, due: d.due, pending: d.pending }
}
/** 取某个函数体的原文(大括号配平);取不到返回 ''。 */
function fnBody(src, name) {
  const i = src.indexOf(`async function ${name}(`) >= 0 ? src.indexOf(`async function ${name}(`) : src.indexOf(`function ${name}(`)
  if (i < 0) return ''
  const open = src.indexOf('{', i)
  let depth = 0
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++
    else if (src[j] === '}') {
      depth--
      if (depth === 0) return src.slice(open, j + 1)
    }
  }
  return ''
}

test('T0 import 判据不得触发 CLI 巡检(§22d 双形态守卫在位)', () => {
  assert.deepEqual(sideEffects(), BEFORE, 'import 后被 import 就动了 .workbuddy 运行态 ⇒ 顶层 CLI 链没被守卫挡住')
  assert.match(SRC, /const isDirectRun = Boolean\(process\.argv\[1\]\) && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(SRC, /if \(isDirectRun\) \{/, '守卫必须是 AGENTS §22d 模板的正体(`if (isDirectRun) { main()… }`),否则测试一 import 就真跑巡检、真发告警邮件')
  assert.equal(typeof decideAlert, 'function')
})

test('T1 (a) 同一项失败在窗口内第二次判"不寄",过窗必须重寄', () => {
  const again = decideAlert({ failNames: [A], state: v2state({ [A]: T0 }), nowMs: T0 + 1 * HR })
  assert.equal(again.shouldSend, false, '同项窗口内第二次仍寄 = 去重没生效')
  assert.deepEqual(again.due, [])
  const later = decideAlert({ failNames: [A], state: v2state({ [A]: T0 }), nowMs: T0 + ALERT_ITEM_WINDOW_MS + 1 })
  assert.equal(later.shouldSend, true, '超窗不寄 = 把持续故障压成哑弹(本脚本头注明令禁止的方向)')
  assert.deepEqual(later.due, [A])
})

test('T2 (b) 组合翻转:窗口内已寄过的项不得重寄,新项可寄', () => {
  const flip = decideAlert({ failNames: [A, B], state: v2state({ [A]: T0 }), nowMs: T0 + 1 * HR })
  assert.equal(flip.shouldSend, true, '有新身份却不寄 = 漏报')
  assert.deepEqual(flip.due, [B], '需通报的必须是新身份那一项')
  assert.deepEqual(flip.pending, [A], 'A 已在窗口内通报过 ⇒ 不得因组合变了被算成新身份')
  // 方向证明:同一份输入喂修复前的判据,它整条 sig 都变了 ⇒ 无从区分 A 已寄过
  const prev = { ts: new Date(T0).toISOString(), sig: A, fails: 1 }
  assert.equal(oldWayWouldSend({ failNames: [A, B], prev, nowMs: T0 + 1 * HR }), true)
  assert.equal(flip.due.includes(A), false, '本判据与旧判据必须在"要不要重报 A"这一格分歧,否则这条测试没测到修复')
  // 两项都记过 ⇒ 不寄(扩粒度不得把噪声变成"什么都寄")
  assert.equal(decideAlert({ failNames: [A, B], state: v2state({ [A]: T0, [B]: T0 }), nowMs: T0 + 1 * HR }).shouldSend, false)
})

test('T3 (b) 实测噪声形态量化:两项各自出现/消失的 4 种组合,旧判据 4 封、新判据 2 封', () => {
  const seq = [[A], [A, B], [B], [A]]
  let parsedNew = null
  let parsedOld = null
  let newMails = 0
  let oldMails = 0
  for (let i = 0; i < seq.length; i++) {
    const nowMs = T0 + i * HR
    const r = step(parsedNew, seq[i], nowMs)
    newMails += r.sentCount
    parsedNew = r.parsed
    // 旧判据的历史状态 = 它自己寄成功时写的那条 sig
    if (oldWayWouldSend({ failNames: seq[i], prev: parsedOld, nowMs })) {
      oldMails++
      parsedOld = { ts: new Date(nowMs).toISOString(), sig: [...seq[i]].sort().join(' | '), fails: seq[i].length }
    }
  }
  assert.equal(oldMails, 4, '旧判据在两项各 1 封的 4 轮里应寄 4 封(前提若与实况不符,这条先红)')
  assert.equal(newMails, 2, '逐项身份下同一序列只该寄 2 封(A 一次、B 一次)')
})

test('T4 (c) 真实投递成功的台账条目不得出现"未投递"', () => {
  const line = buildLedgerEntry({ title: 'T', desp: 'D', delivery: { sent: true, via: 'email', attempts: ['email: 已送达 — 品牌模板通道'] }, nowIso: 'X' })
  assert.equal(line.includes('未投递'), false, '寄成功了台账还写"未投递" = 缺陷②原样复发')
  assert.match(line, /投递: ✅ 经 email 送达/)
})

test('T5 (d) dry-run 的台账必须出现"(dry-run,未投递)"', () => {
  const line = buildLedgerEntry({ title: 'T', desp: 'D', delivery: { sent: false, dryRun: true, via: null, attempts: ['alert-dry:只打印正文,未调用派发器'] }, nowIso: 'X' })
  assert.match(line, /投递: \(dry-run,未投递\)/)
})

test('T6 全通道失败:写"❌ 全通道失败",不得与 dry-run 并成一格', () => {
  const line = buildLedgerEntry({ title: 'T', desp: 'D', delivery: { sent: false, via: null, attempts: ['email: 未送达 — 派发器缺失'] }, nowIso: 'X' })
  assert.match(line, /投递: ❌ 全通道失败/)
  assert.equal(line.includes('未投递'), false, '"没送出去"与"没打算送"是两件事,并成一格就查不出通道坏了')
})

test('T7 源码锁:台账必须拿到真实投递结果,不得恒传 null(缺陷②的调用侧)', () => {
  const body = fnBody(SRC, 'maybeAlert')
  assert.ok(body.length > 200, '取不到 maybeAlert 函数体 = 本条锁失去对象(判据改名了,不是仓库没问题)')
  // 只咬"第三个实参就是字面量 null"这一形(缺陷②的形状);dry-run 那条传的是对象,内含 via: null 不算
  assert.doesNotMatch(body, /appendLedger\(\s*[^,]+,\s*[^,]+,\s*null\s*\)/, '台账被恒传 null 就是缺陷②本身:纯函数测试结构上看不见它')
  assert.match(body, /appendLedger\(\s*title\s*,\s*desp\s*,\s*d\s*\)/, '台账必须写"实际拿到的那个返回值"')
  assert.match(body, /dryRun:\s*true/, 'dry-run 分支要显式声明未投递,而不是靠"delivery 缺席"表达')
})

test('T8 源码锁:该不该寄的决定权必须在 decideAlert,不得再就地拼 sig 判 changed/overdue', () => {
  const body = fnBody(SRC, 'maybeAlert')
  assert.match(body, /decideAlert\(\{/, '调用点绕开判据 = 门在、判据对、没人问它')
  assert.doesNotMatch(body, /\bconst changed\b/, '旧的整条-sig 去重写法不得回来(它就是 4 封噪声的成因)')
  assert.doesNotMatch(body, /\bconst overdue\b/)
  assert.equal(/20 \* 3600 \* 1000/.test(body), false, '窗口数字必须只有一个出处(ALERT_ITEM_WINDOW_MS),两处各写一遍必然漂开')
})

test('T9 向后兼容:真实现读的状态文件不得被读成 unknown;取不到则如实报"未判定"', () => {
  const p = join(ROOT, '.workbuddy', 'credential-health-alert-state.json')
  if (!existsSync(p)) {
    console.log('· T9 未判定:.workbuddy/credential-health-alert-state.json 此刻不在位(首轮或被清理)⇒ 不据此得出结论')
    return
  }
  let parsed = null
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    assert.fail(`状态文件在位而解不开(且本轮没被 ⓪ 项判红?):${String(e && e.message).slice(0, 80)}`)
  }
  const n = normalizeAlertState({ present: true, parsed })
  assert.notEqual(n.kind, 'unknown', `真实现读形态解不出(kind=${n.kind})⇒ 每次升级都会多寄一封,方向是"噪声"而非"漏报",仍算缺陷`)
  assert.ok(n.kind === 'v2' || n.kind === 'legacy' || n.kind === 'partial' || n.kind === 'unreadable', `未知 kind: ${n.kind}`)
  // 旧格式的那几项必须各有一条历史可读(不得被当成"本轮全部已寄过"以外的第三种结论)
  if (n.kind === 'legacy') assert.ok(Object.keys(n.table).length >= 1, 'legacy 且有 sig ⇒ 至少拆出一项记录')
})

/** 取"代码面":剥块注释与行注释。总量封顶那道锁必须扫代码面 ——
 *  本文件的散文里就写着"无总量封顶""按身份去重"这类**解释规矩**的话,
 *  整文件正则会把"门在描述自己不该做什么"读成违规(守门 131/70 同型:门判红自己写的说明)。 */
function codeFace(text) {
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[\t ]*\/\/.*$/gm, '')
}

test('T10 反向锁:不得引入"每日/每轮 N 封"式总量封顶(AGENTS §5e)', () => {
  const face = codeFace(SRC)
  assert.ok(face.includes('function decideAlert'), '遮罩把代码面抹干净了 ⇒ 本锁等于没有(先证明尺子还看得见东西)')
  assert.doesNotMatch(face, /(每日|每天|每轮|每周)\s*(最多|上限|限额|封顶)/, '限制只许按身份去重;自设总量上限 = 把"告警静默"再复制一遍')
  assert.doesNotMatch(face, /\b(DAILY|PER_DAY|MAX_ALERTS|ALERT_QUOTA|MAX_MAILS)\w*/i)
  // 阳性对照:同一把尺子对"写在代码位"的违例必须命中(否则 T10 只是恰好为空)
  assert.match(codeFace('const DAILY_CAP = 3\n// 每日最多 3 封\ncount++ // 每轮上限'), /DAILY_CAP/)
  assert.ok(ALERT_ITEM_WINDOW_MS > 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
