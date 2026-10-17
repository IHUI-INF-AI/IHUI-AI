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
// ── 2026-10-17 追加:「部署停摆」只读单维档(--stall-only)──
// 为什么要镜像而不是只靠门内 --self-test:门内那批新例子全走**纯函数构造输入**,证的是"读数函数
// 会给正确答案";而这一档真正的新风险全长在**取材与副作用**上 ——
//   取材顺序(先问服务器、再退 FETCH_HEAD、再退本地 tip)被写反 ⇒ 假停摆;
//   高频档若碰了日级去重台账 ⇒ 20h 重发窗口被自己拨回,持续停摆**消音**;
//   CLI 分支若落进缺省巡检 ⇒ 每几分钟打一次厂商 API、判红还真寄一封。
// 这三件事只有镜像测试(真夹具 + 真子进程 + 逐字节对账)看得见,故 T11–T15。
//   T11 取材序列锁:服务器答得上来就不得再退本地;退让次序 FETCH_HEAD → 本地 HEAD 不得倒装。
//   T12 成对夹具(绿 / 停摆超阈 / 未判定×2 / 在飞):未判定各支绝不得产出 ok 或 fail。
//   T13 零副作用锁:反复量这一维,.workbuddy 四件运行态逐字节不动。
//   T14 源码锁:只读档函数体够不着 mail/写盘出口,且 CLI 分支必须排在缺省巡检之前。
//   T15 真子进程自证:`--stall-only --json` 的 stdout 恒为单行可解析 JSON,退出码与档位一致。
// 注:下面 oldWayWouldSend 是**修复前判据形态的快照**,只用于证明改动方向,禁止随源文件演进。
// 注:下面 oldWayWouldSend 是**修复前判据形态的快照**,只用于证明改动方向,禁止随源文件演进。

import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { mkScratch } from '../lib/scratch-dir.mjs'

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
const {
  normalizeAlertState,
  decideAlert,
  advanceAlertState,
  buildLedgerEntry,
  ALERT_ITEM_WINDOW_MS,
  ALERT_STATE_VERSION,
  collectStallInputs,
  judgeStallReadout,
  stallExitCode,
} = m

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
  // 函数体的起点必须从**参数表右括号之后**找:2026-10-17 实测,`fn(input = {})` 这种默认参数会让
  // "第一个 {" 落在参数表里 ⇒ 取回来的是 `{}` 一枚空体,源码级锁当场变成没有对象的锁(判绿而什么都没锁)。
  let depth = 0
  let k = src.indexOf('(', i)
  for (; k < src.length; k++) {
    if (src[k] === '(') depth++
    else if (src[k] === ')') {
      depth--
      if (depth === 0) break
    }
  }
  const open = src.indexOf('{', k)
  if (open < 0) return ''
  depth = 0
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

// ─────────────────────────────────────────────────────────────────────────────
// T11–T15:「部署停摆」只读单维档(2026-10-17 立)
// 夹具一律落 mkScratch(§15b:工作区外 + 进程退出自动回收),**绝不**在仓库树内造 .next/deploy 残骸。
// ─────────────────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-10-17T03:00:00.000Z')
const SHA_LIVE = 'a'.repeat(40)
const SHA_TIP = 'b'.repeat(40)
const SHA_FETCH = 'c'.repeat(40)
const SHA_LOCAL = 'd'.repeat(40)
const pad = (n) => String(n).padStart(2, '0')
/** 日志时间戳形如 `[2026-10-17 03:00:00 +00:00]`(取材层按 UTC 偏移解析,与真日志同形) */
const stamp = (minAgo) => {
  const d = new Date(NOW - minAgo * 60000)
  return `[${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +00:00]`
}
const successLine = (minAgo) => `${stamp(minAgo)} [deploy] === 部署完成,HEAD=x 活跃组=win(8801/8802/8803) ===`
const roundEndLine = (minAgo) => `${stamp(minAgo)} ———— 部署轮询结束(exit=0) ————`
const midRoundLine = (minAgo) => `${stamp(minAgo)} [deploy] next build 进行中…`

/** 造一枚只含停摆取材所需两路输入的最小仓(线上标记 + 部署流水) */
function makeStallRepo({ buildSha, logLines, withLog = true } = {}) {
  const dir = mkScratch('stall-fixture')
  // 夹具按**生产 checkout 的形态**铺(2026-10-17 起取材走 `<DevEnv>/ihui-prod`,读仓内那份是 bug):
  // `readoutAt` 用 IHUI_DEVENV_ROOT 把 `dir` 当 DevEnv 根,故线上标记落 dir/ihui-prod/apps/web/.next。
  const prod = join(dir, 'ihui-prod')
  mkdirSync(join(prod, 'apps', 'web', '.next'), { recursive: true })
  mkdirSync(join(prod, 'deploy', 'win'), { recursive: true })
  if (buildSha !== null) writeFileSync(join(prod, 'apps', 'web', '.next', 'IHUI_BUILD_SHA'), buildSha, 'utf8')
  if (withLog) writeFileSync(join(prod, 'deploy', 'win', 'deploy-loop.log'), (logLines || []).join('\n'), 'utf8')
  return dir
}

/** 把夹具目录临时当作 DevEnv 根(仅在本函数作用域内;`devEnvRoot` 先看这个环境变量,否则拒绝从 scratch 推导) */
function withDevEnvOverride(root, fn) {
  const prev = process.env.IHUI_DEVENV_ROOT
  process.env.IHUI_DEVENV_ROOT = root
  try {
    return fn()
  } finally {
    if (prev === undefined) delete process.env.IHUI_DEVENV_ROOT
    else process.env.IHUI_DEVENV_ROOT = prev
  }
}

/** 一次完整读数:夹具仓 + 注入的取材依赖 ⇒ 不碰真网络、不碰真凭据 */
function readoutAt(repo, { nowMs = NOW, thresholdMin = 45, remoteTip, runGit } = {}) {
  const input = withDevEnvOverride(repo, () =>
    collectStallInputs({
      repo,
      nowMs,
      thresholdMin,
      remoteTip: remoteTip || (() => ({ sha: SHA_TIP, source: 'ls-remote(当次服务器真值)' })),
      runGit: runGit || (() => ''),
    }),
  )
  return { input, readout: judgeStallReadout(input) }
}

test('T11 取材序列锁:先问服务器,答得上来就不许再退本地;退让次序 FETCH_HEAD → 本地 HEAD 不得倒装', () => {
  const dir = makeStallRepo({ buildSha: SHA_LIVE, logLines: [successLine(10), roundEndLine(9)] })
  const calls = []
  withDevEnvOverride(dir, () =>
    collectStallInputs({
      repo: dir,
      nowMs: NOW,
      remoteTip: () => {
        calls.push('remote')
        return { sha: SHA_TIP, source: 'ls-remote(当次服务器真值)' }
      },
      runGit: (...a) => {
        calls.push(`git:${a.join(' ')}`)
        return SHA_FETCH
      },
    }),
  )
  assert.deepEqual(calls, ['remote'], '服务器已给出当次真值 ⇒ 还去读本地 FETCH_HEAD 就是旧顺序的假停摆之源(§5b)')
  // 服务器答不上来 ⇒ 依次退 FETCH_HEAD,再退本地 HEAD(次序是 PROJECT_PLAN 记过的既有口径)
  const calls2 = []
  const i2 = withDevEnvOverride(dir, () =>
    collectStallInputs({
      repo: dir,
      nowMs: NOW,
      remoteTip: () => ({ sha: null, reason: 'ls-remote 不可达:timeout' }),
      runGit: (...a) => {
        calls2.push(a.join(' '))
        return a.includes('FETCH_HEAD') ? '' : SHA_LOCAL
      },
    }),
  )
  assert.deepEqual(calls2, ['rev-parse FETCH_HEAD', 'rev-parse HEAD'], '两档退化都要走,且 FETCH_HEAD 必须在前')
  assert.equal(i2.tipSha, SHA_LOCAL)
  assert.match(i2.tipSource, /本地 HEAD/, '退化到本地必须如实登记来源(否则读数看起来像当次服务器真值)')
  // FETCH_HEAD 拿得到就不该再问本地 HEAD(少一次子进程 = 少一次崩的机会)
  const calls3 = []
  withDevEnvOverride(dir, () =>
    collectStallInputs({
      repo: dir,
      nowMs: NOW,
      remoteTip: () => ({ sha: null, reason: 'ls-remote 不可达' }),
      runGit: (...a) => {
        calls3.push(a.join(' '))
        return SHA_FETCH
      },
    }),
  )
  assert.deepEqual(calls3, ['rev-parse FETCH_HEAD'])
})

test('T12 成对夹具:绿 / 停摆超阈 / 未判定(取不到 tip、取不到 lastSuccess)/ 在飞 —— 未判定绝不出 ok 或 fail', () => {
  const unjudgedLevels = []
  // ① 绿:线上构建 == tip,且 10 分钟前刚成功(阈值 45 内)
  const g = readoutAt(makeStallRepo({ buildSha: SHA_TIP, logLines: [successLine(10), roundEndLine(9)] }))
  assert.equal(g.readout.level, 'ok')
  assert.equal(g.readout.behindHours, 0.2)
  assert.equal(stallExitCode(g.readout.level), 0)
  // ② 停摆:线上落后且 2 小时无成功部署(超 45 分钟阈值)
  const s = readoutAt(makeStallRepo({ buildSha: SHA_LIVE, logLines: [successLine(120), roundEndLine(119)] }))
  assert.equal(s.readout.level, 'fail', '落后 2 小时不判红 = 45 分钟阈值形同虚设(本档立项的那一格)')
  assert.equal(s.readout.behindHours, 2)
  assert.equal(stallExitCode(s.readout.level), 1)
  // ③ 未判定 · 取不到 tip(远端不可达 + FETCH_HEAD 无 + 本地 HEAD 也取不到)
  const u1 = readoutAt(makeStallRepo({ buildSha: SHA_LIVE, logLines: [successLine(120), roundEndLine(119)] }), {
    remoteTip: () => ({ sha: null, reason: 'ls-remote 不可达:timeout' }),
    runGit: () => '',
  })
  unjudgedLevels.push(u1.readout.level)
  assert.match(u1.input.missingInputs.join(' ; '), /tip/)
  assert.equal(u1.input.tipSha, '')
  // 方向锁:网络不可达不得被说成停摆(与本文件"限流/网络不可达 ≠ 凭据过期"同一条口径)
  assert.equal(u1.readout.level, 'unjudged', '取不到 tip 却给出结论 = 把"没量到"写成"量过了"(§0.3)')
  // ④ 未判定 · 取不到 lastSuccess(deploy-loop.log 整枚不在位)
  const u2 = readoutAt(makeStallRepo({ buildSha: SHA_LIVE, withLog: false }), {})
  unjudgedLevels.push(u2.readout.level)
  assert.match(u2.input.missingInputs.join(' ; '), /lastSuccess/)
  assert.equal(u2.readout.level, 'unjudged')
  assert.equal(u2.readout.behindHours, null, '没有成功时刻却拍一个 0 上去 = 冒充"没落后"')
  // ⑤ 未判定 · 本轮在飞(日志末行是轮次中间产物且写于 20 分钟内)
  const u3 = readoutAt(makeStallRepo({ buildSha: SHA_LIVE, logLines: [successLine(120), midRoundLine(5)] }), {})
  unjudgedLevels.push(u3.readout.level)
  assert.equal(u3.input.inFlight, true)
  assert.equal(u3.readout.level, 'unjudged')
  // 汇总:三型未判定合起来不得产出一枚 ok/fail(质量要求的成对断言)
  assert.deepEqual(unjudgedLevels.filter((l) => l === 'ok' || l === 'fail'), [])
  // 反向对照:同一枚夹具仓把日志末行换成轮次边界 ⇒ 必须立刻恢复判定为 fail(在飞护栏不得吞真故障)
  const s2 = readoutAt(makeStallRepo({ buildSha: SHA_LIVE, logLines: [successLine(120), roundEndLine(5)] }), {})
  assert.equal(s2.readout.level, 'fail')
  // 已知边界如实登记:线上标记整枚缺失是**真实部署态**,沿用日级档判红,不当缺输入
  const noMarker = readoutAt(makeStallRepo({ buildSha: null, logLines: [successLine(120), roundEndLine(119)] }), {})
  assert.equal(noMarker.readout.level, 'fail')
  assert.deepEqual(noMarker.input.missingInputs, [])
})

test('T13 零副作用锁:高频量这一维 20 次,.workbuddy 运行态四件必须逐字节不动', () => {
  const present = WATCHED.filter((f) => existsSync(join(ROOT, '.workbuddy', f)))
  if (!present.length) {
    console.log('· T13 未判定:.workbuddy 四件运行态此刻都不在位 ⇒ "没污染"无从比对,不据此声明通过')
    return
  }
  const dir = makeStallRepo({ buildSha: SHA_LIVE, logLines: [successLine(120), roundEndLine(119)] })
  const before = sideEffects()
  for (let k = 0; k < 20; k++)
    withDevEnvOverride(dir, () => judgeStallReadout(collectStallInputs({ repo: dir, nowMs: NOW, remoteTip: () => ({ sha: SHA_TIP }), runGit: () => '' })))
  assert.deepEqual(sideEffects(), before, `高频档动了日级班次的运行态(${present.join(', ')} 在位)⇒ 20h 重发窗口会被自己拨回 = 停摆消音`)
})

test('T14 源码锁:只读档够不着 mail/写盘出口,且 CLI 分支排在缺省巡检之前', () => {
  const body = codeFace(fnBody(SRC, 'stallOnlyMode'))
  assert.ok(body.length > 150, '取不到 stallOnlyMode 函数体 ⇒ 本锁等于没有(改名了不是仓库没问题)')
  for (const forbidden of ['sendEmail', 'dispatchBrandMail', 'buildBrandMailArgv', 'maybeAlert', 'deliver(', 'runChecks(', 'atomicWriteFileSync', 'writeFileSync', 'appendFileSync', 'STATE', 'UNDEL', 'LEDGER']) {
    assert.doesNotMatch(body, new RegExp(forbidden.replace(/[()]/g, '\\$&')), `只读档结构上不得出现 ${forbidden}`)
  }
  // 反向锁的阳性对照:同一把尺子对"确实写了发信"的形状必须命中(否则上面那圈只是恰好为空)
  assert.match(codeFace('function x(){ sendEmail(a) ; atomicWriteFileSync(STATE, s) }'), /sendEmail/)
  const iStall = SRC.indexOf("argv.includes('--stall-only')")
  const iDefault = SRC.indexOf('const results = await runChecks()')
  assert.ok(iStall > 0 && iDefault > 0 && iStall < iDefault, '--stall-only 分支必须排在缺省巡检之前,否则高频档每轮都在打厂商 API 并可能真寄一封')
  assert.match(SRC, /--stall-only  \*\*只读单维档\*\*/, '--help 的用法必须登记这一档(§0.8:写了的命令要真能跑)')
  // 单一真相源:只读档必须走共用取材层 + 共用判据,不许自立第二套停摆判据
  assert.match(body, /collectStallInputs\(/)
  assert.match(body, /judgeStallReadout\(/)
  assert.match(codeFace(fnBody(SRC, 'judgeStallReadout')), /judgeStall\(/, '读数层必须复用 judgeStall 本体')
  assert.match(codeFace(fnBody(SRC, 'deployStallCheck')), /collectStallInputs\(/, '日级班次必须与只读档共用同一份取材(两副面孔的根治点)')
})

test('T15 真子进程自证:`--stall-only --json` 的 stdout 恒为单行可解析 JSON,退出码与档位一致且不写台账', () => {
  const before = sideEffects()
  const r = spawnSync(process.execPath, [SRC_PATH, '--stall-only', '--json'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 150000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.error, undefined, `子进程没起来:${r.error && r.error.code}`)
  const lines = String(r.stdout || '').split(/\r?\n/).filter((l) => l.trim())
  assert.equal(lines.length, 1, `stdout 必须是**单个** JSON 对象(派发层按行取),实测 ${lines.length} 行`)
  let j = null
  try {
    j = JSON.parse(lines[0])
  } catch (e) {
    assert.fail(`stdout 解不出 JSON(派发层拿到的就是噪声):${String(e.message).slice(0, 80)} —— ${lines[0]?.slice(0, 120)}`)
  }
  for (const k of ['at', 'liveSha', 'tipSha', 'lastSuccessIso', 'thresholdMin', 'level', 'why', 'behindHours', 'inFlight']) {
    assert.ok(k in j, `契约字段缺失:${k}`)
  }
  assert.ok(['ok', 'fail', 'unjudged'].includes(j.level), `level 只能是三态之一,实测 ${j.level}`)
  assert.equal(Number(j.thresholdMin) > 0, true, '阈值必须随读数带出(派发层据此判断"量的是哪一把尺")')
  assert.equal(r.status, stallExitCode(j.level), `退出码必须与档位同源(实测 level=${j.level} exit=${r.status}):未判定不得被读成通过`)
  // 未判定的两种成因都要能点名:① 缺输入(取不到 tip / lastSuccess / 线上根)②尺子自己的
  // "不判定"(本轮在飞、tip 取不到)。原先只认第一种措辞,把一条**时刻相关**的巧合写成了断言
  // ——部署环正在跑的那一分钟里量,读数就是②,于是这例自己变成假红。
  if (j.level === 'unjudged') {
    assert.ok(String(j.why || '').length > 0, '未判定必须给出原因,不得只回一个档位')
    assert.match(String(j.why || ''), /取不到输入|不判定|在飞|tip/, `未判定的 why 必须点名是哪一路(实测 ${String(j.why || '').slice(0, 90)})`)
  }
  assert.deepEqual(sideEffects(), before, '真子进程跑过一次就不许动日级班次的运行态(去重台账/心跳/UNDEL/流水)')
  console.log(`· 现读:level=${j.level} behindHours=${j.behindHours} thresholdMin=${j.thresholdMin} tipSource=${j.tipSource}`)
})

// ── T16–T18「线上此刻」的根(2026-10-17 立)────────────────────────────────
// 立因(当天现读):liveSha 与心跳台账原先都取自**仓内这份 checkout**
// (`repo/apps/web/.next/IHUI_BUILD_SHA`、`repo/deploy/win/deploy-loop.log`),而 nssm 跑的
// IHUI-DEPLOYLOOP/IHUI-WEB 是 `<DevEnv>\ihui-prod` 那一份,活环根本不写仓内这两处。
// 后果不是"少报"而是**连寄四天假警报**:仓内标记停在 10-13 10:32 的 `2822437d8`,
// 而线上标记 11:36 已由环写成 `cf3d5fc6e0` ⇒ 每天那封「部署停摆 97.7 小时」是拿错的读数算出来的。
const SHA_PROD = 'a'.repeat(40)
const SHA_OLD = 'b'.repeat(40)

function prodRootFixture(mkMarker, iso = '2026-10-17T04:20:00.000Z') {
  const dir = mkScratch('gg-prod-root-')
  const prev = process.env.IHUI_DEVENV_ROOT
  process.env.IHUI_DEVENV_ROOT = dir
  const asked = []
  const reads = {}
  if (mkMarker) {
    const markerPath = join(dir, 'ihui-prod', 'apps', 'web', '.next', 'IHUI_BUILD_SHA')
    mkdirSync(dirname(markerPath), { recursive: true })
    writeFileSync(markerPath, SHA_PROD)
    reads[markerPath.replace(/\\/g, '/')] = SHA_PROD
  }
  const logPath = join(dir, 'ihui-prod', 'deploy', 'win', 'deploy-loop.log')
  if (mkMarker) {
    mkdirSync(dirname(logPath), { recursive: true })
    writeFileSync(logPath, `[${iso.replace('T', ' ').replace('.000Z', '')} +00:00] === 部署完成,HEAD=${SHA_PROD.slice(0, 10)} ===\n`)
  }
  const readFileText = (p) => {
    const k = String(p).replace(/\\/g, '/')
    asked.push(k)
    return reads[k] ?? ''
  }
  const restore = () => {
    if (prev === undefined) delete process.env.IHUI_DEVENV_ROOT
    else process.env.IHUI_DEVENV_ROOT = prev
  }
  return { dir, asked, readFileText, restore, logPath }
}

test('T16 反向锁:线上标记取自生产 checkout 的根,而不是仓内那份滞后副本', () => {
  const f = prodRootFixture(true)
  try {
    const i = collectStallInputs({ repo: ROOT, nowMs: Date.parse('2026-10-17T04:30:00.000Z'), remoteTip: () => ({ sha: SHA_PROD, source: 'fixture' }), runGit: () => '', readFileText: f.readFileText })
    assert.equal(i.liveSha, SHA_PROD, '必须读生产根的 IHUI_BUILD_SHA')
    assert.equal(askedHasRepoNext(f.asked), false, '一次都不许去问仓内那份 .next(读它 = 拿滞后副本当线上)')
    const v = judgeStallReadout(i)
    assert.equal(v.level, 'ok', `线上==tip 且刚成功过 ⇒ ok;实测 ${v.level}/${v.why}`)
  } finally {
    f.restore()
  }
})

test('T17 生产根不存在 ⇒ 该维未判定,不得折成"线上无构建标记"那一红', () => {
  const f = prodRootFixture(false)
  try {
    const i = collectStallInputs({ repo: ROOT, nowMs: Date.parse('2026-10-17T04:30:00.000Z'), remoteTip: () => ({ sha: SHA_OLD, source: 'fixture' }), runGit: () => '', readFileText: f.readFileText })
    assert.equal(i.liveSha, '')
    const joined = i.missingInputs.join(' ; ')
    assert.match(joined, /线上根.*不存在/, '必须点名是哪一路输入取不到')
    const v = judgeStallReadout(i)
    assert.equal(v.level, 'unjudged', '别人那台机没有这个部署形态 ⇒ 未判定(不记绿也不冒红)')
    assert.equal(stallExitCode(v.level), 2, '未判定的退出码是 2,不是 1')
  } finally {
    f.restore()
  }
})

test('T18 源码锁:deployStallCheck 走 judgeStallReadout 一份裁定,且不再出现仓内根的读法', () => {
  const body = fnBody(SRC, 'deployStallCheck')
  assert.match(body, /judgeStallReadout\(/, '裁定只许有一份(§0.6);绕过去自调 judgeStall 会把"取不到输入"读成红')
  const coll = fnBody(SRC, 'collectStallInputs')
  assert.doesNotMatch(coll, /join\(repo,\s*'apps',\s*'web',\s*'\.next'/, '线上标记不得再从仓内根取')
  assert.doesNotMatch(coll, /join\(repo,\s*'deploy',\s*'win'/, '心跳台账不得再从仓内根取')
  assert.match(coll, /prodCheckoutRoot\(|prodDeployLoopLog\(/, '两个 oracle 必须都走生产根解析器')
})

function askedHasRepoNext(askedList) {
  return askedList.some((p) => p.includes('/apps/web/.next/IHUI_BUILD_SHA') && !p.includes('/ihui-prod/'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
