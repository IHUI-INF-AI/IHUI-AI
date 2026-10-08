// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/proc-identity.mjs` 与两条全局锁(`scripts/git-lock.mjs` /
 * `scripts/deploy-lock.mjs`)的身份三元组接线测试(§22c:直接 import 源脚本的 `__test__`,
 * 本文件**不复制第二份判据实现**)。
 *
 * 钉的是同一个病灶的两种死法 —— 部署锁 2026-09-25 冻结生产 11h50m(G-193):
 * `meta.pid=888` 当时被 `nssm.exe` 占着(StartTime 比锁晚 160 秒),而"拿 pid 判活"这件事
 * 只有两种失败方向 —— 要么恒真(白等一个幽灵),要么恒假(抢掉别人正在用的锁)。
 *
 * 三态各自必须有一条正例与一条反例,并且**两条臂只差在身份结论上**:
 *   match       ⇒ 不得新增抢占授权(活人的锁不能被"确证复用"抢走)
 *   mismatch    ⇒ 唯一授权立即抢占的那一态
 *   unverifiable ⇒ **维持改动前行为**(不得折成 mismatch,也不得折成 match)
 * 这样"把 mismatch 折成 unverifiable"的变异必然让 mismatch 那一臂翻红 ——
 * 若折不红,说明断言是恒真的(本仓对"永远绿的断言"记过多次)。
 *
 * 真机零副作用(本票最高红线):
 *   - 所有锁目录取自 `mkScratch()`(§26:工作树同盘的 DevEnv/Temp,结构上不在仓库树内);
 *   - 身份现测**一律注入假 run**(`processStartEpoch(pid, {run})`),一个用例都不派生 PowerShell;
 *   - 绝不 acquire/release/claim 真实 `.git/ihui-git-write.lock` 或项目根 `.deploy.lock`;
 *   - git-lock 的抢占现场用 `claimArchiveRoot` 指进夹具,不往 `gitArchiveDir()` 堆测试垃圾。
 *
 * 另含两条"机制是否真在位"的反向锁(源码级,§22c:这类行为只能用源码锁,加断言会跟着漂绿):
 *   ① `verifyHolder(` 在 git-lock 代码面只能出现一次(住在 `makeIdentityProbe` 里)——
 *      出现第二处就意味着有人把它接到了快路径上;
 *   ② `heartbeat` / `check` 的函数体里既不得出现 `verifyHolder` 也不得出现现测入口 ——
 *      它们一个每 5s 跑一次、一个挂在人手与脚本链上,都是"判抢占以外"的路径。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as P, START_TOLERANCE_SEC } from '../lib/proc-identity.mjs'
import { __test__ as gl } from '../git-lock.mjs'
import { __test__ as dl } from '../deploy-lock.mjs'

const SELF_START = 1_780_000_000
/** 注入的假 run:返回一个"稳定但不等于记录值"的启动时刻,不派生任何进程。 */
const fakeRun = (sec) => () => String(sec)
/** 计数用假 run:证明"同一把锁只问一次"与"旧 meta 根本不问"。 */
function countingRun(sec) {
  const state = { calls: 0 }
  state.run = () => {
    state.calls += 1
    return String(sec)
  }
  return state
}

function fixture(t, name) {
  const base = mkScratch(`proc-id-${name}-`)
  t.after(() => rmScratch(base))
  return base
}

// ═════════════════ 一、库层:三态与解析(纯函数,零 IO) ═════════════════

test('parsePreciseStart / parseStatStartTicks:只认带前缀的高精度形态,其他一律 null', () => {
  // 正例:两种带前缀形态
  assert.equal(P.parsePreciseStart('windows-utc-us:1780000000123456'), 'windows-utc-us:1780000000123456')
  assert.equal(P.parsePreciseStart('boot-ticks:9532'), 'boot-ticks:9532')
  // profile 噪音前缀不碍事
  assert.equal(P.parsePreciseStart(`noise line\r\nwindows-utc-us:42`), 'windows-utc-us:42')
  // 反例:裸数字 / 报错文本 / 空值 ⇒ null(解不出就走秒级档,不得猜)
  assert.equal(P.parsePreciseStart('1780000000123456'), null)
  assert.equal(P.parsePreciseStart('Get-CimInstance : no such process'), null)
  assert.equal(P.parsePreciseStart(''), null)
  assert.equal(P.parsePreciseStart(null), null)
  assert.equal(P.parsePreciseStart('windows-utc-us:'), null)
  // /proc stat field 22:comm 可含空格与括号 ⇒ 以最后一个 ')' 为界
  const stat = `816 (cat) S 1 1 1 0 -1 4194560 1 0 0 0 0 0 0 0 20 0 1 0 9532 1 18446744073709551615`
  assert.equal(P.parseStatStartTicks(stat), 'boot-ticks:9532')
  const paren = `816 (a cat) S 1 1 1 0 -1 4194560 1 0 0 0 0 0 0 0 20 0 1 0 9532 1 18446744073709551615`
  assert.equal(P.parseStatStartTicks(paren), 'boot-ticks:9532')
  assert.equal(P.parseStatStartTicks('garbage'), null, 'comm 后括号都没有 ⇒ null')
  assert.equal(P.parseStatStartTicks('816 (cat) S 1 2 3'), null, '字段不够 ⇒ null')
  assert.equal(P.parseStatStartTicks(''), null)
})

test('高精度镜像(同一夹具跑两版):同秒不同 ticks ⇒ 旧判 match、新判 mismatch', () => {
  const SEC = SELF_START
  const oldP = 'windows-utc-us:1780000000123456'
  const newP = 'windows-utc-us:1780000000654321'
  // 旧实现(只看秒):同一 epoch 秒 ⇒ match —— 正是它结构性失明的复用档
  const legacy = P.judgeIdentity({ recorded: SEC, observed: SEC })
  assert.equal(legacy.kind, 'match', '旧量纲必须判 match(先钉住它确实看不见)')
  // 新实现(两侧都带 precise):同秒不同 ticks ⇒ mismatch,且 why 自己说清凭据
  const v = P.judgeIdentity({ recorded: SEC, observed: SEC, recordedPrecise: oldP, observedPrecise: newP })
  assert.equal(v.kind, 'mismatch', '同秒不同 tick 就是复用,不得被 2s 容差吞掉')
  assert.match(v.why, /已被复用/)
  assert.match(v.why, /windows-utc-us:/)
  // 同一夹具反向:precise 全等 ⇒ 即便秒级有 ±1s 量化差也 match(不因高精度档变严)
  const same = P.judgeIdentity({ recorded: SEC, observed: SEC + 1, recordedPrecise: oldP, observedPrecise: oldP })
  assert.equal(same.kind, 'match')
})

test('高精度镜像(端到端取值):注入 run 走高精度档,三态不得收窄', () => {
  const SEC = SELF_START
  // 高精度档输出 = 带前缀串 + 末行裸秒(与 defaultPreciseRun 同形)
  const preciseRun = (us, sec) => () => `windows-utc-us:${us}\n${sec}`
  // 取值面:高精度 run 回带前缀串 ⇒ epoch 与 precise 都有
  const ok = P.processStartEpoch(7001, { run: preciseRun('1780000000123456', SEC), highPrecision: true })
  assert.equal(ok.epoch, SEC)
  assert.equal(ok.precise, 'windows-utc-us:1780000000123456')
  // 镜像:同一夹具,"旧进程"与"新进程"同秒不同 ticks ⇒ mismatch
  const verdict = P.judgeIdentity({
    recorded: SEC,
    observed: SEC,
    recordedPrecise: 'windows-utc-us:1780000000123456',
    observedPrecise: 'windows-utc-us:1780000000999999',
  })
  assert.equal(verdict.kind, 'mismatch')
  // 反例 1:PowerShell 报错/进程不存在 ⇒ 仍 unverifiable(三态不得收窄)
  const boom = P.processStartEpoch(7002, { run: () => { throw new Error('Get-Process : Cannot find process') } })
  assert.equal(boom.epoch, null)
  assert.equal(boom.precise, null)
  const v1 = P.judgeIdentity({ recorded: SEC, observed: boom.epoch, recordedPrecise: 'windows-utc-us:1', observedPrecise: boom.precise })
  assert.equal(v1.kind, 'unverifiable')
  // 反例 2:输出是报错噪音 ⇒ 同样 unverifiable,不得翻成 mismatch
  const noise = P.processStartEpoch(7003, { run: () => 'Get-CimInstance : no such process' })
  assert.equal(noise.epoch, null)
  assert.equal(noise.precise, null)
  const v2 = P.judgeIdentity({ recorded: SEC, observed: noise.epoch })
  assert.equal(v2.kind, 'unverifiable')
  // 反例 3:只一侧带 precise(量纲不对齐)⇒ 退回秒级档判,不得单侧凭空翻案
  const oneSide = P.judgeIdentity({ recorded: SEC, observed: SEC, recordedPrecise: 'windows-utc-us:1' })
  assert.equal(oneSide.kind, 'match')
})

test('verifyHolder:meta 带 pidStartPrecise ⇒ 现测走高精度档对账;同秒复用 ⇒ mismatch', () => {
  const meta = { pid: 7004, pidStart: SELF_START, pidStartPrecise: 'windows-utc-us:1780000000123456' }
  const hit = P.verifyHolder(meta, {
    run: () => `windows-utc-us:1780000000999999\n${SELF_START}`,
  })
  assert.equal(hit.kind, 'mismatch', `同秒不同 ticks 必须被现测抓到:${hit.why ?? ''}`)
  assert.match(hit.why, /已被复用/)
  const same = P.verifyHolder(meta, { run: () => `windows-utc-us:1780000000123456\n${SELF_START}` })
  assert.equal(same.kind, 'match')
  // 反例:meta 没带 precise ⇒ 走秒级档(旧 meta 行为逐字不变)
  const legacyMeta = { pid: 7005, pidStart: SELF_START }
  const legacy = P.verifyHolder(legacyMeta, { run: fakeRun(SELF_START) })
  assert.equal(legacy.kind, 'match')
  assert.equal(legacy.precise, undefined, '秒级档不得凭空产出 precise 维')
})

test('identityFields:highPrecision 档落 pidStartPrecise,量不到时不落键(旧行为不变)', () => {
  const okId = P.identityFields({ run: () => `windows-utc-us:1780000000123456\n${SELF_START}`, host: 'H1', highPrecision: true })
  assert.equal(okId.host, 'H1')
  assert.equal(okId.pidStartPrecise, 'windows-utc-us:1780000000123456')
  assert.equal(okId.pidStart, SELF_START)
  // 量不到 ⇒ precise 整键不留(与秒级档的 pidStart 同一纪律)
  const badId = P.identityFields({ run: () => { throw new Error('夹具:取不到') }, host: 'H1', highPrecision: true })
  assert.equal('pidStartPrecise' in badId, false)
  // 默认档(不传 highPrecision)形态逐字不变
  const legacyId = P.identityFields({ run: fakeRun(SELF_START), host: 'H1' })
  assert.deepEqual(Object.keys(legacyId).sort(), ['host', 'pidStart'])
})


test('parseStartEpoch 三形态:空串 / 非数字 / profile 噪音前缀(只有最后一种能出值)', () => {
  // 正例:带 profile 噪音前缀(真实 PowerShell 常见形态)⇒ 取最后一段纯数字
  assert.equal(P.parseStartEpoch(`loaded personal profile\r\n${SELF_START}\r\n`), SELF_START)
  assert.equal(P.parseStartEpoch(String(SELF_START)), SELF_START)
  // 反例 1:空串 / 全空白 ⇒ null(不是 0 —— 0 会被当成一个合法时间)
  assert.equal(P.parseStartEpoch(''), null, '空串不得被读成 0')
  assert.equal(P.parseStartEpoch('   \n '), null)
  assert.equal(P.parseStartEpoch(null), null)
  assert.equal(P.parseStartEpoch(undefined), null)
  // 反例 2:非数字 / 只有噪音 ⇒ null
  assert.equal(P.parseStartEpoch('Get-Process : Cannot find process'), null)
  assert.equal(P.parseStartEpoch('12ab34'), null, '半截数字不得当成时间戳')
  // 反例 3:负数与 0 都不算合法启动时刻
  assert.equal(P.parseStartEpoch('-5'), null)
  assert.equal(P.parseStartEpoch('0'), null, '0 是"没有值",不是"1970 年"')
})

test('judgeIdentity 三态各自成对:容差内 match / 超容差 mismatch / 缺值 unverifiable', () => {
  // match 正例:全等,以及容差内的时钟量化误差
  assert.equal(P.judgeIdentity({ recorded: SELF_START, observed: SELF_START }).kind, 'match')
  assert.equal(
    P.judgeIdentity({ recorded: SELF_START, observed: SELF_START + START_TOLERANCE_SEC }).kind,
    'match',
    `±${START_TOLERANCE_SEC}s 内是量化误差,不是复用`,
  )
  // mismatch 正例:两边都量到且超出容差 ⇒ 唯一能授权抢占的一态
  const bad = P.judgeIdentity({ recorded: SELF_START, observed: SELF_START + 500 })
  assert.equal(bad.kind, 'mismatch')
  assert.match(bad.why, /已被复用/, '结论必须自己说清它确证了什么')
  // 反例:容差边界外一格(必须已经是 mismatch,不得"差不多就算 match")
  assert.equal(
    P.judgeIdentity({ recorded: SELF_START, observed: SELF_START + START_TOLERANCE_SEC + 1 })
      .kind,
    'mismatch',
  )
  // unverifiable 成对:任一侧缺值都不得折成另外两态
  for (const [name, args] of [
    ['没记录(旧 meta)', { recorded: undefined, observed: SELF_START }],
    ['没记录 + 也量不到', { recorded: undefined, observed: null }],
    ['记录了但量不到', { recorded: SELF_START, observed: null }],
    ['记录值是 0(归一后的"没有")', { recorded: 0, observed: SELF_START }],
  ]) {
    const v = P.judgeIdentity(args)
    assert.equal(v.kind, 'unverifiable', `${name} ⇒ 必须是 unverifiable,实得 ${v.kind}`)
    assert.ok(v.why, `${name} 必须带原因`)
  }
})

test('verifyHolder:别机持有 ⇒ unverifiable 且**不**据此判复用(还必须在派生之前短路)', () => {
  let ran = 0
  const meta = { host: '另一台机器', pid: 1234, pidStart: SELF_START }
  // 正例:host 不等 ⇒ unverifiable,并且现测**根本没被调用**(跨机比 pid 毫无意义)
  const v = P.verifyHolder(meta, { host: '本机', run: () => { ran += 1; return String(SELF_START + 900) } })
  assert.equal(v.kind, 'unverifiable')
  assert.match(v.why, /别机持有/)
  assert.equal(ran, 0, '别机的锁不得去派生本机启动时间 —— 拿到了也不构成任何判据')
  // 反例:同机 + 值不符 ⇒ 才允许走到 mismatch
  const same = P.verifyHolder(
    { host: '本机', pid: 1234, pidStart: SELF_START },
    { host: '本机', run: fakeRun(SELF_START + 900) },
  )
  assert.equal(same.kind, 'mismatch', same.why)
})

test('verifyHolder:旧 meta(没有 pidStart)⇒ unverifiable 且一次都不派生 PowerShell', () => {
  const probe = countingRun(SELF_START + 900)
  const v = P.verifyHolder({ pid: 1234 }, { run: probe.run })
  assert.equal(v.kind, 'unverifiable', '没记录就是没凭据,不是"可抢占"')
  assert.match(v.why, /没记录启动时间/)
  assert.equal(probe.calls, 0, '结论与现测值无关时还去派生 = 把快路径搬到旧 meta 上')
  // 反例:记了 pidStart 才会去量
  const v2 = P.verifyHolder({ pid: 1234, pidStart: SELF_START }, { run: fakeRun(SELF_START) })
  assert.equal(v2.kind, 'match')
})

test('verifyHolder:量不到启动时间的三种原因必须各自点名(不得都写成"取不到")', () => {
  const mk = (errText) =>
    P.verifyHolder(
      { pid: 1234, pidStart: SELF_START },
      { run: () => { throw new Error(errText) } },
    )
  const ps = mk('PowerShell 不可达')
  assert.equal(ps.kind, 'unverifiable')
  assert.match(ps.why, /PowerShell 不可达/, `原因得跟着结论回来:${ps.why}`)
  const perm = mk('EPERM: operation not permitted')
  assert.match(perm.why, /EPERM/)
  // 反例:输出里没有可用时间戳(不是抛错)也是一种可诊断原因,不得冒成 match
  const noise = P.verifyHolder(
    { pid: 1234, pidStart: SELF_START },
    { run: () => 'No such process; nothing printed' },
  )
  assert.equal(noise.kind, 'unverifiable')
  assert.match(noise.why, /输出里没有可用的启动时间/)
})

test('identityFields / selfStartEpoch:量不到时**整键不留**(旧形态),量得到时带 host', () => {
  const okId = P.identityFields({ run: fakeRun(SELF_START), host: 'H1' })
  assert.equal(okId.host, 'H1')
  assert.equal(okId.pidStart, SELF_START)
  const badId = P.identityFields({
    host: 'H1',
    run: () => { throw new Error('夹具:取不到') },
  })
  assert.equal('pidStart' in badId, true, '值必须是 undefined')
  assert.equal(badId.pidStart, undefined)
  // 关键:undefined 进 JSON 会被整键丢掉 ⇒ 与改动前的 meta 逐字同形(向后兼容)
  const json = JSON.stringify({ pid: 1, ts: 2, ...badId })
  assert.equal(json.includes('pidStart'), false, `旧形态不得被写成 pidStart:null: ${json}`)
  assert.equal(JSON.parse(json).host, 'H1')
})

test('缓存只服务真测:注入的假 run 不得共享缓存(否则测试读的是别人的答案)', () => {
  P.clearCache()
  const pid = 4321
  // 同一个 pid,两个不同的桩:第二个必须拿到自己的结果
  const a = P.processStartEpoch(pid, { run: fakeRun(1_000_000_001) })
  const b = P.processStartEpoch(pid, { run: fakeRun(2_000_000_002) })
  assert.equal(a.epoch, 1_000_000_001)
  assert.equal(b.epoch, 2_000_000_002, '注入桩的结果被缓存顶掉 = 判据按夹具走,账面却一切正常')
  P.clearCache()
})

// ═════════════ 二、git-lock 接线:判定 + 端到端(夹具目录 + 假 run) ═════════════

test('git-lock·写侧 writeMeta 落 host + pidStart,且量不到时退回旧形态', () => {
  const base = mkScratch('gl-write-meta-')
  try {
    const dir = join(base, 'l')
    mkdirSync(dir)
    gl.writeMeta(dir, 'u1', { run: fakeRun(SELF_START) })
    const m = JSON.parse(readFileSync(gl.metaFile(dir), 'utf8'))
    assert.equal(m.pid, process.pid)
    assert.equal(m.pidStart, SELF_START, 'pidStart 没落盘 ⇒ 读侧永远无从对账')
    assert.equal(m.host, hostname())
    assert.equal(m.unitId, 'u1')
    const dir2 = join(base, 'l2')
    mkdirSync(dir2)
    gl.writeMeta(dir2, 'u2', {
      run: () => { throw new Error('夹具:取不到') },
    })
    const m2 = readFileSync(gl.metaFile(dir2), 'utf8')
    assert.equal(m2.includes('pidStart'), false, `取不到就整键不留,形态须与改动前一致:${m2}`)
    assert.equal(JSON.parse(m2).unitId, 'u2')
  } finally {
    rmScratch(base)
  }
})

test('git-lock·授权判据:只有 mismatch 授权抢占,match/unverifiable/没有 都不授权', () => {
  assert.equal(gl.identityAuthorizesClaim({ kind: 'mismatch' }), true)
  for (const v of [undefined, null, { kind: 'match' }, { kind: 'unverifiable' }]) {
    assert.equal(gl.identityAuthorizesClaim(v), false, `${JSON.stringify(v)} 不得授权抢占`)
  }
  // 三态的措辞必须互不相同("没判"与"判过了"不能写成同一句话)
  const notes = [
    gl.identityNote(undefined),
    gl.identityNote({ kind: 'match' }),
    gl.identityNote({ kind: 'unverifiable', why: '夹具原因' }),
    gl.identityNote({ kind: 'mismatch', why: '夹具确证' }),
  ]
  assert.equal(new Set(notes).size, 4, `四种结论必须四样措辞:${notes}`)
  assert.match(notes[3], /确证 pid 已被复用/)
  assert.match(notes[2], /不构成额外授权/)
})

test('git-lock·端到端:pid 在而启动时间不同 ⇒ 立即判可抢占,并给出 mismatch 措辞', async (t) => {
  const base = fixture(t, 'gl-e2e')
  const dir = join(base, 'ihui-git-write.lock')
  const archive = join(base, 'arch')
  mkdirSync(dir)
  writeFileSync(
    gl.metaFile(dir),
    JSON.stringify({
      unitId: 'unit-他人',
      pid: process.pid, // 存活主体:原判据在这一格只会 wait
      ts: Date.now(), // 锁龄 0 ⇒ 远低于 staleMs/hardStaleMs
      host: hostname(),
      pidStart: SELF_START,
    }),
    'utf8',
  )
  const lines = []
  const started = Date.now()
  const ok = await gl.acquire({
    unitId: 'unit-我',
    timeoutMs: 30_000,
    staleMs: 600_000,
    hardStaleMs: 1_800_000,
    dir,
    cleanIndexLocks: false,
    identityRun: fakeRun(SELF_START + 500), // 现测与记录不符 ⇒ mismatch
    claimArchiveRoot: archive,
    log: (m) => lines.push(m),
  })
  const ms = Date.now() - started
  assert.equal(ok, true, `身份确证复用却没抢到:${lines.join('\n')}`)
  assert.ok(ms < 5_000, `确证复用应当立即抢占,实得 ${ms}ms(等成了原判据的轮询)`)
  assert.ok(
    lines.some((l) => /身份三元组确证/.test(l) && /已被复用/.test(l)),
    `抢占理由必须是"确证"而非"猜":${lines.join('\n')}`,
  )
  // 抢到之后锁是自己的,且现场按原子改名留了档(不得裸删)
  assert.equal(gl.readMeta(dir).unitId, 'unit-我')
  assert.ok(readdirSync(archive).some((n) => n.includes('.stale-')), `现场没进归档:${lines.join('\n')}`)
})

test('git-lock·端到端反向:取不到启动时间 ⇒ **不得**抢占,且把原因喊出来', async (t) => {
  const base = fixture(t, 'gl-e2e-nostart')
  const dir = join(base, 'ihui-git-write.lock')
  mkdirSync(dir)
  const raw = JSON.stringify({
    unitId: 'unit-他人',
    pid: process.pid,
    ts: Date.now(),
    host: hostname(),
    pidStart: SELF_START,
  })
  writeFileSync(gl.metaFile(dir), raw, 'utf8')
  const lines = []
  let derivations = 0
  let err = null
  const t0 = Date.now()
  await gl
    .acquire({
      unitId: 'unit-我',
      timeoutMs: 900,
      staleMs: 600_000,
      hardStaleMs: 1_800_000,
      dir,
      cleanIndexLocks: false,
      identityRun: () => {
        derivations += 1
        throw new Error('夹具:PowerShell 不可达')
      },
      log: (m) => lines.push(m),
    })
    .catch((e) => (err = e))
  const waited = Date.now() - t0
  assert.ok(err, '现测不到身份还去抢占 = 把"没判"写成"判过了"')
  assert.equal(readFileSync(gl.metaFile(dir), 'utf8'), raw, '锁的字节必须一字未动')
  assert.ok(
    lines.some((l) => /身份无法核对/.test(l) && /PowerShell 不可达/.test(l)),
    `必须打印为什么判不出来:${lines.join('\n')}`,
  )
  assert.equal(
    lines.filter((l) => /身份无法核对/.test(l)).length,
    1,
    `原因被反复打印说明没做 memo:${lines.join('\n')}`,
  )
  // 快路径反向锁:等满了轮询(900ms / 300ms 一poll ⇒ 至少两轮)却只派生一次
  assert.ok(waited >= 600, `夹具没跑到多轮(waited=${waited}ms),这条断言是空的`)
  assert.equal(derivations, 1, `同一把锁现测了 ${derivations} 次 ⇒ PowerShell 派生进了轮询快路径`)
})

test('git-lock·端到端反向 2:旧 meta(无 pidStart/host)⇒ 走原判据,一次都不派生', async (t) => {
  const base = fixture(t, 'gl-e2e-oldmeta')
  const dir = join(base, 'ihui-git-write.lock')
  mkdirSync(dir)
  // 改动前写下的 meta 形态:只有 unitId/pid/ts
  writeFileSync(gl.metaFile(dir), JSON.stringify({ unitId: 'u-旧', pid: process.pid, ts: Date.now() }), 'utf8')
  const lines = []
  let calls = 0
  let err = null
  await gl
    .acquire({
      unitId: 'u-新',
      timeoutMs: 900,
      staleMs: 600_000,
      dir,
      cleanIndexLocks: false,
      identityRun: () => {
        calls += 1
        return String(SELF_START)
      },
      log: (m) => lines.push(m),
    })
    .catch((e) => (err = e))
  assert.ok(err, '旧 meta 必须继续可用(等一把活锁),不得因为"拿不到身份"就删别人的锁')
  assert.equal(existsSync(dir), true)
  assert.equal(calls, 0, '没记 pidStart ⇒ 结论与现测无关 ⇒ 不该派生(旧锁不该被拖进 PowerShell)')
  assert.ok(
    lines.some((l) => /身份无法核对/.test(l) && /没记录启动时间/.test(l)),
    `旧 meta 也要说清"这一格没有身份凭据":${lines.join('\n')}`,
  )
})

test('git-lock·端到端反向 3:match(这人真的还持着锁)⇒ 绝不被"确证复用"抢走', async (t) => {
  const base = fixture(t, 'gl-e2e-match')
  const dir = join(base, 'ihui-git-write.lock')
  mkdirSync(dir)
  writeFileSync(
    gl.metaFile(dir),
    JSON.stringify({ unitId: 'u-活', pid: process.pid, ts: Date.now(), host: hostname(), pidStart: SELF_START }),
    'utf8',
  )
  const lines = []
  let err = null
  await gl
    .acquire({
      unitId: 'u-等',
      timeoutMs: 900,
      staleMs: 600_000,
      dir,
      cleanIndexLocks: false,
      identityRun: fakeRun(SELF_START + 1), // 容差内 ⇒ match
      log: (m) => lines.push(m),
    })
    .catch((e) => (err = e))
  assert.ok(err, 'match 还抢到就是把身份判据变成了秒抢判据')
  assert.equal(gl.readMeta(dir).unitId, 'u-活', '活锁被抢占')
  assert.equal(lines.filter((l) => /身份三元组确证/.test(l)).length, 0)
})

// ═════════════ 三、deploy-lock 接线:判定 + 端到端(夹具目录 + 假 run) ═════════════

test('deploy-lock·写侧:pidStart 必须量"判活主体",有 owner 时不得量 CLI 自己', () => {
  const base = mkScratch('dl-id-write-')
  try {
    const dir = join(base, 'l')
    mkdirSync(dir)
    // 主体错位的一次就能要命:owner≠self 却记了自己的启动时刻 ⇒ 之后每次对账都 mismatch
    dl.writeMeta(dir, 'build', {
      ownerPid: process.ppid || 99999,
      run: (pid) => {
        if (Number(pid) !== Number(process.ppid)) throw new Error(`量错了主体:${pid}`)
        return String(SELF_START + 11)
      },
    })
    const m = JSON.parse(readFileSync(dl.metaFile(dir), 'utf8'))
    assert.equal(m.pidStart, SELF_START + 11, JSON.stringify(m))
    assert.equal(m.ownerPid, process.ppid || 99999)
    assert.equal(dl.holderIdentity(m).pid, process.ppid || 99999, '投影主体必须与判活主体同一个')
    assert.equal(dl.holderPid(m), dl.holderIdentity(m).pid, 'holderPid 与 holderIdentity 不得两处各算')
  } finally {
    rmScratch(base)
  }
})

test('deploy-lock·读侧:classifyMeta 带出身份两元,旧 meta 归零(= 无从对账)', () => {
  const withId = dl.classifyMeta(
    JSON.stringify({ mode: 'build', pid: 4321, ts: 1, host: 'H', pidStart: 99 }),
  )
  assert.equal(withId.kind, 'ok')
  assert.equal(withId.meta.host, 'H')
  assert.equal(withId.meta.pidStart, 99)
  const legacy = dl.classifyMeta(JSON.stringify({ mode: 'build', pid: 4321, ts: 1 }))
  assert.equal(legacy.kind, 'ok', '旧 meta 继续可用(不得因为多两个字段就判不可用)')
  assert.equal(legacy.meta.pidStart, 0)
  assert.equal(dl.holderIdentity(legacy.meta).pidStart, undefined, '0 归一成 undefined ⇒ 走 unverifiable')
})

test('deploy-lock·判据:三臂只差在身份结论上(mismatch 抢 / match 等 / 不传 等)', () => {
  const base = mkScratch('dl-id-decide-')
  try {
    const mkDir = (extra) => {
      const dir = join(base, `l-${Math.random().toString(36).slice(2, 8)}`)
      mkdirSync(dir)
      writeFileSync(
        dl.metaFile(dir),
        JSON.stringify({
          mode: 'build',
          pid: process.pid, // 名义存活
          ts: Date.now(), // 锁龄 0 ⇒ 原判据只能 wait(既没超 staleMs 也没超硬上限)
          host: hostname(),
          pidStart: SELF_START,
          ...extra,
        }),
        'utf8',
      )
      return dir
    }
    const dir = mkDir()
    const mismatch = dl.decideSteal({
      dir,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: dl.HARD_CAP_MS,
      identity: { kind: 'mismatch', why: '夹具:差 500s' },
    })
    assert.equal(mismatch.action, 'steal', mismatch.why)
    assert.match(mismatch.why, /身份三元组确证/)
    assert.equal(mismatch.immediate, false, '名义存活者不是"已死"⇒ 必须先归档现场再抢')
    // 反臂 1:同一夹具,只换身份结论 ⇒ 必须回到 wait(证明红点在身份,不在夹具)
    const same = dl.decideSteal({
      dir,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: dl.HARD_CAP_MS,
      identity: { kind: 'match', delta: 0 },
    })
    assert.equal(same.action, 'wait', `match 还抢就是把身份变成秒抢判据:${same.why}`)
    // 反臂 2:unverifiable ⇒ 维持改动前行为(也是 wait)
    const unverifiable = dl.decideSteal({
      dir,
      mode: 'build',
      staleMs: 600_000,
      hardCapMs: dl.HARD_CAP_MS,
      identity: { kind: 'unverifiable', why: '夹具:量不到' },
    })
    assert.equal(unverifiable.action, 'wait', unverifiable.why)
    // 反臂 3:不传身份 ⇒ 与改动前逐字同结论,并如实写"未做"
    const bare = dl.decideSteal({ dir, mode: 'build', staleMs: 600_000, hardCapMs: dl.HARD_CAP_MS })
    assert.equal(bare.action, 'wait', bare.why)
    assert.match(bare.why, /身份对账=未做/)
    // 30min 硬上限那一档**没被换掉**:它现在是第二道兜底,不是唯一出路
    const overCap = mkDir({ ts: Date.now() - dl.HARD_CAP_MS - 5_000 })
    const d1 = dl.decideSteal({ dir: overCap, mode: 'build', staleMs: 600_000, identity: { kind: 'match' } })
    assert.equal(d1.action, 'steal', '身份相符也不能把超上限那一档改成不抢(不得顺手改严)')
    assert.match(d1.why, /硬上限/)
    assert.match(d1.why, /身份对账=match/)
  } finally {
    rmScratch(base)
  }
})

test('deploy-lock·端到端:确证复用 ⇒ 归档现场并抢到;量不到 ⇒ 不抢且原因进超时文案', async (t) => {
  const base = fixture(t, 'dl-e2e')
  const archive = join(base, 'scene')
  const prev = process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR
  process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = archive
  try {
    const mkDir = (name, meta) => {
      const dir = join(base, name)
      mkdirSync(dir)
      writeFileSync(dl.metaFile(dir), JSON.stringify(meta), 'utf8')
      return dir
    }
    const live = { mode: 'build', pid: process.pid, ts: Date.now(), host: hostname(), pidStart: SELF_START }
    const hit = mkDir('a', live)
    const ok = await dl.acquire({
      mode: 'build',
      timeoutMs: 5_000,
      staleMs: 600_000,
      hardCapMs: dl.HARD_CAP_MS,
      ownerPid: process.pid,
      dir: hit,
      identityRun: fakeRun(SELF_START + 700),
    })
    assert.equal(ok, true, '身份确证复用却没拿到锁')
    assert.equal(dl.readMeta(hit).meta.pid, process.pid)
    assert.ok(dl.readMeta(hit).meta.pidStart, '新锁必须带上自己的身份,否则下一轮又无从对账')
    assert.ok(
      readdirSync(archive).length >= 1,
      '抢占前没归档现场 ⇒ 抢错了连复核的凭据都不剩',
    )

    const miss = mkDir('b', live)
    let err = null
    await dl
      .acquire({
        mode: 'build',
        timeoutMs: 900,
        staleMs: 600_000,
        dir: miss,
        identityRun: () => {
          throw new Error('夹具:PowerShell 不可达')
        },
      })
      .catch((e) => (err = e))
    assert.ok(err, '量不到身份却抢占 = 把"没判"写成"判过了"')
    assert.equal(existsSync(dl.metaFile(miss)), true, '锁必须原样在位')
    assert.match(err.message, /身份对账=unverifiable/)
    assert.match(err.message, /PowerShell 不可达/, '超时文案必须带上"为什么判不出来"')

    // 端到端反向锁:轮询至少两轮(500ms 一poll / 1200ms 超时),而同一把锁只问一次。
    // 断言方向刻意是"只问一次" —— 现测每轮重问就是把派生搬进了等待快路径。
    let calls = 0
    const counted = mkDir('c', live)
    const t1 = Date.now()
    await dl
      .acquire({
        mode: 'build',
        timeoutMs: 1_200,
        staleMs: 600_000,
        dir: counted,
        identityRun: () => {
          calls += 1
          throw new Error('夹具:计数用')
        },
      })
      .catch(() => {})
    assert.ok(Date.now() - t1 >= 1_000, '没等满两轮 ⇒ 这条 memo 断言是空的')
    assert.equal(calls, 1, `同一把锁现测了 ${calls} 次 ⇒ 派生进了轮询快路径`)
    // 换一次 acquire 调用必须重问(memo 是"每次调用一把锁一次",不是进程级永久缓存),
    // 否则持有者换锁后会被套上一次的结论。
    const other = mkDir('d', { ...live, ts: Date.now() + 60_000 })
    await dl
      .acquire({
        mode: 'build',
        timeoutMs: 300,
        staleMs: 600_000,
        dir: other,
        identityRun: () => {
          calls += 1
          throw new Error('夹具:计数用')
        },
      })
      .catch(() => {})
    assert.equal(calls, 2, '锁指纹变了没重问 ⇒ memo 把上一把锁的结论套到了这一把上')
  } finally {
    if (prev === undefined) delete process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR
    else process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = prev
  }
})

// ═════════════ 四、反向锁:派生只能住在"已决定要判抢占"的那一个闸门后面 ═════════════

/**
 * 取某个顶层函数声明的**函数体**(含首尾大括号)。
 * 参数的解构对象也带 `{`,所以先从第一个 `(` 做括号配对找到参数表收尾,再取后面的 `{`。
 * 取不到 ⇒ 返回 null,调用方必须判红 —— 判据失效不允许表现为"跳过这条断言"。
 */
function fnBody(src, name) {
  const at = src.search(new RegExp(`\\n(?:async\\s+)?function\\s+${name}\\s*\\(`))
  if (at < 0) return null
  let i = src.indexOf('(', at)
  if (i < 0) return null
  let pd = 0
  for (; i < src.length; i += 1) {
    if (src[i] === '(') pd += 1
    else if (src[i] === ')') {
      pd -= 1
      if (pd === 0) break
    }
  }
  const open = src.indexOf('{', i)
  if (open < 0) return null
  let depth = 0
  for (let j = open; j < src.length; j += 1) {
    if (src[j] === '{') depth += 1
    else if (src[j] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(open, j + 1)
    }
  }
  return null
}

/** 取源码里第一个包含 marker 的 `if (...) { … }` 块(用于点名新分支的形态)。 */
function blockContaining(src, marker) {
  const at = src.indexOf(marker)
  if (at < 0) return null
  const open = src.indexOf('{', at)
  if (open < 0) return null
  let depth = 0
  for (let j = open; j < src.length; j += 1) {
    if (src[j] === '{') depth += 1
    else if (src[j] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(open, j + 1)
    }
  }
  return null
}

/** 只保留代码行(整行注释是在解释"为什么不能用",不是调用点)。 */
const codeOnly = (src) =>
  src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

test('反向锁:现测派生只住在一个取用闸门后面,heartbeat/check 一概不问', () => {
  /**
   * 判据形状在此变更(2026-09-29,§12f 清"红在干净 HEAD"):原来是 `verifyHolder(` 全局计数 == 1,
   * 那是把**不变量写成了条目数**。取用闸门本体合法地会问身份 —— git-lock 的 `tryAcquireSingleInstance`
   * 与 deploy-lock 的 `acquire` 都是"每次 acquire 至多问一次"的路径,它们一旦落地,计数判据就在
   * **与任何提交都无关**的干净 HEAD 上恒红(实测 HEAD 面 git-lock 已有 2 处:makeIdentityProbe +
   * tryAcquireSingleInstance,而该套件自此 RC=1)。换成函数白名单**只会更严**:白名单外的任何新落点
   * (包括把现测塞进某个新加的检查函数)都红;而"不许进快路径"这一维本来就由下面逐函数体那条断言管。
   */
  const ALLOWED_FNS = {
    '../git-lock.mjs': ['makeIdentityProbe', 'tryAcquireSingleInstance'],
    '../deploy-lock.mjs': ['acquire'],
  }
  const FN_DECL = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/
  for (const [rel, probeName, guard] of [
    ['../git-lock.mjs', 'makeIdentityProbe', ['heartbeat', 'check']],
    ['../deploy-lock.mjs', null, ['check', 'release']],
  ]) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    const code = codeOnly(src)
    const raw = src.split('\n')
    const callLines = raw
      .map((l, i) => [l, i])
      .filter(([l]) => !/^\s*(\/\/|\*|\/\*)/.test(l) && l.includes('verifyHolder('))
      .map(([, i]) => i)
    assert.ok(callLines.length >= 1, `${rel}:一个现测调用点都没有 ⇒ 取用闸门被摘线,这是判据失明不是通过`)
    for (const ci of callLines) {
      let name = null
      for (let i = ci; i >= 0; i -= 1) {
        const m = raw[i].match(FN_DECL)
        if (m) {
          name = m[1]
          break
        }
      }
      assert.ok(
        name && ALLOWED_FNS[rel].includes(name),
        `${rel}:${ci + 1} 行的现测落在 ${name ?? '顶层/非函数'} —— 不在取用闸门白名单 [${ALLOWED_FNS[rel].join(', ')}] 里 ⇒ 有人把它接到了快路径`,
      )
    }
    if (probeName) assert.ok(code.includes(`function ${probeName}`), `${rel} 的取用闸门被摘掉了`)
    for (const fn of guard) {
      const body = fnBody(src, fn)
      assert.ok(body, `${rel}:取不到 ${fn} 的函数体(判据失效不允许安静通过)`)
      assert.ok(!/verifyHolder\(|processStartEpoch\(/.test(body), `${rel}.${fn} 不得现测身份(只读/热路径)`)
    }
    // 写侧的现测只能出现在"取用闸门 + acquire 的成功写入"里;轮询主体不得重复派生
    assert.ok(!/while\s*\(.*verifyHolder/.test(code), `${rel}:轮询里直接派生`)
  }
  // 身份两元的搬运只能在 heartbeat 里出现(且是"搬"不是"测")
  const hb = fnBody(readFileSync(new URL('../git-lock.mjs', import.meta.url), 'utf8'), 'heartbeat')
  assert.match(hb, /host:\s*meta\.host/)
  assert.match(hb, /pidStart:\s*meta\.pidStart/, '心跳不搬身份两元 ⇒ 第一次续期就把凭据洗掉')
})

test('反向锁:两条锁都不得为"抢得到"而新增裸删除(抢占一律走 lib 的原子改名)', () => {
  // 上限 = 改动前的实测形态:removeLock 的"定义 + 持有者自释"、git 侧 placeGitScene 里
  // 对**已改名暂存目录**的一处 rmSync。任何一次上浮都意味着有人把"删锁"接到了新路径上。
  const RM_SYNC_CAP = { '../git-lock.mjs': 2, '../deploy-lock.mjs': 1 }
  for (const rel of Object.keys(RM_SYNC_CAP)) {
    const code = codeOnly(readFileSync(new URL(rel, import.meta.url), 'utf8'))
    const rm = (code.match(/\bremoveLock\(/g) || []).length
    assert.ok(rm <= 2, `${rel}:removeLock 出现 ${rm} 次 ⇒ 新路径绕回直接删原锁目录`)
    const rmSync = (code.match(/\brmSync\(/g) || []).length
    assert.ok(
      rmSync <= RM_SYNC_CAP[rel],
      `${rel}:rmSync 出现 ${rmSync} 次(改动前上限 ${RM_SYNC_CAP[rel]})⇒ 抢占/身份路径上长了第三处裸删除`,
    )
    assert.ok(
      !/rmSync\(\s*dir\s*,/.test(code.replace(/function removeLock[\s\S]*?\n\}/, '')),
      `${rel}:removeLock 之外出现对锁目录的 rmSync`,
    )
  }
  // 新授权分支本身也只能走原子改名(不是"少一处调用"就算合规)
  const glCode = codeOnly(readFileSync(new URL('../git-lock.mjs', import.meta.url), 'utf8'))
  const branch = blockContaining(glCode, 'if (identityAuthorizesClaim(identity))')
  assert.ok(branch, '取不到 git-lock 的身份授权分支(判据失效不允许安静通过)')
  assert.match(branch, /claimStaleLock\(/, '身份确证那一支也必须走 lib 的改名抢占')
  assert.ok(!/\bremoveLock\(|\brmSync\(/.test(branch), '身份确证那一支里出现了裸删除')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
