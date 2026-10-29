// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 「静默阈值按实测分布派生 + unknown 定向升级」镜像测试(2026-10-29 Y-1)。
//
// 立因(现场):10:09:50→10:30 部署环整 27 分钟一行未写(签出 fetch 停在 10:02:19、无子进程、
// 无锁、服务与 nssm 都 RUNNING),而停摆判据只把"日志有新活动"当正向信号 ⇒ 静默本身没有读数
// ⇒ 只落 unknown;monitor-alerts 当日 0 条 ⇒ 没有人被叫醒。
//
// 本文件钉两件事,**都钉行为而不是钉存在**:
//   ① 阈值必须是**函数**(由日志实测分布派生),不是常数:同一份判据在 60s 节律与 360s 节律下
//      必须派生出两个不同的分钟数;样本不足时必须**不给阈值**(拒绝常数顶替);
//   ② 升级资格只给"落后 + 环已停写"这一种组合:真停摆升一次、静默但已同步不升、取不到输入不升、
//      同一事件重复不刷屏;投递失败不得记账(必须留待重试)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  logWriteGapDistribution,
  deriveSilenceThresholdMin,
  judgeStallReadout,
  stallExitCode,
} from '../check-credential-health.mjs'
import { __test__ as N } from '../git-guardian.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHA_LIVE = 'a'.repeat(40)
const SHA_TIP = 'b'.repeat(40)
const NOW = Date.parse('2026-10-29T02:30:00.000Z')
const pad = (n) => String(n).padStart(2, '0')
const stamp = (ms) => {
  const d = new Date(ms)
  return `[${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +00:00]`
}

/**
 * 造一份"像真日志"的流水:每个轮次 = 开始 → 若干条构建行(相邻 1s)→ 结束,轮次间隔 `roundSec`。
 * 这不是复读实现:它复刻的正是真日志被量到的那两个形状(轮间隔有节律、轮内几乎连续写行)。
 */
function fakeLoopLog({ rounds = 40, roundSec = 60, burst = 3, endMs = Date.parse('2026-10-29T02:00:00.000Z') } = {}) {
  const out = []
  for (let i = rounds - 1; i >= 0; i--) {
    const t0 = endMs - i * roundSec * 1000
    out.push(`${stamp(t0)} ———— 部署轮询开始 ————`)
    for (let k = 1; k <= burst; k++) out.push(`${stamp(t0 + k * 1000)} [deploy] next build 进行中…`)
    out.push(`${stamp(t0 + (burst + 1) * 1000)} ———— 部署轮询结束(exit=0) ————`)
  }
  return out.join('\n')
}

test('S1 分布是量出来的:轮间隔/轮内静默都从日志算,样本数如实登记', () => {
  const d = logWriteGapDistribution(fakeLoopLog({ rounds: 40, roundSec: 60 }))
  assert.equal(d.roundSec.n, 39, '40 轮 ⇒ 39 个轮次间隔')
  assert.equal(d.roundSec.p50, 60, '节律 60s 必须被量成 60s,而不是靠配置猜')
  assert.ok(d.samples > 100, `相邻写入间隔样本必须成规模(实测 ${d.samples})`)
  assert.ok(d.intraRoundSec.p95 <= 5, '轮内几乎连续写行 ⇒ 轮内静默 p95 只有几秒')
  // 反向对照:把节律换成 360s,同一个函数必须量出另一个数(证明它真在读日志,不是在返回常量)
  const d360 = logWriteGapDistribution(fakeLoopLog({ rounds: 40, roundSec: 360 }))
  assert.equal(d360.roundSec.p50, 360)
  // 取不到时间戳的日志(整枚不在位)⇒ 样本 0,不假装量过
  assert.equal(logWriteGapDistribution('').samples, 0)
})

test('S2 阈值随实测节律变:60s 与 360s 必须派生出两个不同分钟数,样本不足则拒绝给阈值', () => {
  const t60 = deriveSilenceThresholdMin(logWriteGapDistribution(fakeLoopLog({ rounds: 40, roundSec: 60 })))
  const t360 = deriveSilenceThresholdMin(logWriteGapDistribution(fakeLoopLog({ rounds: 40, roundSec: 360 })))
  assert.equal(t60.ok, true)
  assert.equal(t360.ok, true)
  assert.ok(t60.thresholdMin >= 2 && t60.thresholdMin <= 5, `60s 节律下阈值应落在几分钟(实测 ${t60.thresholdMin})`)
  assert.ok(t360.thresholdMin >= 15 && t360.thresholdMin <= 25, `360s 节律下阈值应放大到十几分钟(实测 ${t360.thresholdMin})`)
  assert.ok(t360.thresholdMin > t60.thresholdMin * 3, '两代配置必须量出两个量级的阈值 —— 常数(45)做不到这件事')
  // 样本不足 ⇒ 不给数:宁可在读数里点名"阈值未派生",也不拿 45 分钟顶上去
  const few = deriveSilenceThresholdMin(logWriteGapDistribution(fakeLoopLog({ rounds: 3, roundSec: 60 })))
  assert.equal(few.ok, false)
  assert.equal(few.thresholdMin, null)
  assert.match(few.why, /阈值未派生/)
})

/** 一次读数:输入直接构造(判据层是纯函数,不需要真仓/真日志;FS/CLL 的接线由 S4 起另测) */
const readout = (o = {}) =>
  judgeStallReadout({
    liveSha: SHA_LIVE,
    tipSha: SHA_TIP,
    lastSuccessIso: '',
    nowMs: NOW,
    thresholdMin: 45,
    lastLogWriteIso: '2026-10-29T02:03:00+00:00',
    logSilenceMin: 27,
    silenceThresholdMin: 21,
    silenceThreshold: { ok: true, thresholdMin: 21, why: '阈值 21 分钟 = max(3×轮间隔 p95 402s, 2×轮内静默 p95 42s)' },
    missingInputs: ['lastSuccess(deploy-loop.log 无完成行)'],
    ...o,
  })

test('S3 升级资格只给"落后 + 环已停写":真停摆升 / 已同步不升 / 取不到输入不升 / 阈值未派生不升', () => {
  // ① 真停摆:未判定 + 线上落后 + 静默 27 分钟 ≥ 派生阈值 21 分钟
  const real = readout()
  assert.equal(real.level, 'unjudged')
  assert.equal(real.silence.silent, true)
  assert.equal(real.escalate.eligible, true)
  assert.equal(real.escalate.episodeKey, `silence:${SHA_LIVE.slice(0, 9)}`, '身份只取线上 sha 前缀:tip 会一直前进,进身份 = 每轮新故障')
  assert.match(real.escalate.why, /27 分钟 ≥ 派生阈值 21 分钟/)
  // 退出码仍然是"未判定"(2):升级是另一条通道,不得把没判过写成判过了
  assert.equal(stallExitCode(real.level), 2)
  // ② 静默但已同步:线上 == tip ⇒ 不是停摆(仍可能未判定,但绝不升级)
  const synced = readout({ tipSha: SHA_LIVE, missingInputs: ['lastSuccess(deploy-loop.log 无完成行)'] })
  assert.equal(synced.escalate.eligible, false)
  assert.match(synced.escalate.why, /落后无从取证|本档已给出结论/)
  // ③ 取不到输入:线上 sha 整枚读不到 ⇒ 落后无从取证 ⇒ 不升(本机=非部署机就是这一支)
  const noLive = readout({ liveSha: '', missingInputs: ['线上根(G:/.DevEnv/ihui-prod 不存在 ⇒ 本机无此部署形态)', 'lastSuccess(不存在)'] })
  assert.equal(noLive.level, 'unjudged')
  assert.equal(noLive.escalate.eligible, false)
  assert.match(noLive.escalate.why, /落后无从取证/)
  // 反向对照:tip 读不到也一样不升 —— "不知道落后不落后"不许冒充"落后"
  assert.equal(readout({ tipSha: '', missingInputs: ['tip(三路都取不到)'] }).escalate.eligible, false)
  // ④ 阈值未派生:静默再久也不升,并点名要一次人工分布读数(不用常数顶替)
  const noThr = readout({ silenceThresholdMin: null, silenceThreshold: { ok: false, thresholdMin: null, why: '阈值未派生:相邻写入间隔样本 4 个 < 20 个' } })
  assert.equal(noThr.escalate.eligible, false)
  assert.match(noThr.escalate.why, /阈值未派生/)
  // ⑤ 未到阈值:静默 5 分钟 < 21 分钟 ⇒ 不算停写
  assert.equal(readout({ logSilenceMin: 5 }).escalate.eligible, false)
  // ⑥ 票面现场的另一副面孔(改这条时现读到的):27 分钟 < 45 分钟阈值 ⇒ judgeStall 给的是**绿**
  //    ("线上落后但最近 27 分钟刚成功过")。只挂 unjudged 就等于换个输入形态再漏一次,必须同升。
  const greenButSilent = readout({ lastSuccessIso: new Date(NOW - 27 * 60000).toISOString(), missingInputs: [] })
  assert.equal(greenButSilent.level, 'ok', '27 分钟静默在 45 分钟阈值下确实判绿 —— 这正是本票的前提')
  assert.equal(greenButSilent.escalate.eligible, true, '绿档下的"环已停写"更要喊:它是被判据当成健康的那一档')
  // 反向对照:同一枚绿档但已同步 ⇒ 不升(否则每次正常部署后的安静都会被喊成停摆)
  assert.equal(readout({ tipSha: SHA_LIVE, lastSuccessIso: new Date(NOW - 27 * 60000).toISOString(), missingInputs: [] }).escalate.eligible, false)
})

/** 派发层夹具:注入读数、假 notify、临时台账,不碰真 state 目录 */
function stallHarness(payload, opts = {}) {
  const dir = mkScratch('gg-stall-silence-')
  const calls = []
  const lines = []
  let n = 0
  const one = (over = {}) => {
    n += 1
    const p = { ...payload, ...over }
    return N.auditDeployStall({
      now: NOW,
      intervalMs: 1,
      tickFile: join(dir, `tick-${n}.ts`),
      firstFile: join(dir, 'first.json'),
      escalatedFile: join(dir, 'escalated.json'),
      logger: (s) => lines.push(String(s)),
      notify: (name, detail, o) => {
        calls.push({ name, detail, opts: o })
        return { sent: true, why: '已送达' }
      },
      runner: () => ({ status: 2, stdout: JSON.stringify(p), stderr: '', killed: false }),
    })
  }
  return { dir, calls, lines, one, opts }
}

const unjudgedPayload = (o = {}) => ({
  level: 'unjudged',
  liveSha: SHA_LIVE,
  tipSha: SHA_TIP,
  tipSource: 'ls-remote(当次服务器真值)',
  lastSuccessIso: '',
  thresholdMin: 45,
  why: '未判定:取不到输入 ⇒ lastSuccess(deploy-loop.log 无完成行)',
  lastLogWriteIso: '2026-10-29T02:03:00+00:00',
  logSilenceMin: 27,
  silenceThresholdMin: 21,
  silence: { silenceMin: 27, thresholdMin: 21, thresholdDerived: true, silent: true },
  escalate: {
    eligible: true,
    episodeKey: `silence:${SHA_LIVE.slice(0, 9)}`,
    silenceMin: 27,
    thresholdMin: 21,
    why: `未判定且线上落后(线上 ${SHA_LIVE.slice(0, 9)} ≠ tip ${SHA_TIP.slice(0, 9)}),日志静默 27 分钟 ≥ 派生阈值 21 分钟 ⇒ 定向升级一次`,
  },
  ...o,
})

test('S4 真停摆 ⇒ 升一次;同一事件重复 ⇒ 去重不刷屏;换一场(线上 sha 变了)⇒ 才许再升', () => {
  const h = stallHarness(unjudgedPayload())
  const r1 = h.one()
  assert.equal(h.calls.length, 1, '落后 + 环已停写必须到人 —— 这正是本票那 27 分钟漏掉的那一封')
  assert.equal(h.calls[0].opts.severity, 'critical')
  assert.match(h.calls[0].opts.dedupKey, new RegExp(`stall-silence;episode=silence:${SHA_LIVE.slice(0, 9)}`))
  assert.match(h.calls[0].detail, /27 分钟 ≥ 派生阈值 21 分钟/)
  assert.match(h.calls[0].detail, /--stall-only --json/, '正文必须留取证命令(收信人能自己复算)')
  assert.equal(r1.escalated, true)
  // 同一场停摆:再来三轮(静默分钟数每轮都在涨)⇒ 一封都不许多寄
  h.one({ logSilenceMin: 42 })
  h.one({ logSilenceMin: 57 })
  assert.equal(h.calls.length, 1, '正文每分钟都在变,身份必须落在事件上,否则去重窗形同虚设')
  assert.match(h.lines.join('\n'), /同一停摆事件已定向升级过一次/)
  // 换一场:线上换了一枚新 sha 之后又停摆 ⇒ 新事件,必须再升一次
  const other = 'c'.repeat(40)
  h.one({ liveSha: other, escalate: { ...unjudgedPayload().escalate, episodeKey: `silence:${other.slice(0, 9)}` } })
  assert.equal(h.calls.length, 2, '新事件被上一场的台账压住 = 一台机永远只许喊一次')
  rmScratch(h.dir)
})

test('S5 静默但已同步 / 取不到输入 ⇒ 不升只报名;投递失败 ⇒ 不记账,下一轮必须重试', () => {
  const synced = stallHarness(
    unjudgedPayload({
      escalate: { eligible: false, episodeKey: '', silenceMin: 27, thresholdMin: 21, why: '线上与 tip 至少一路取不到 ⇒ 落后无从取证,不升级' },
    }),
  )
  const r = synced.one()
  assert.equal(synced.calls.length, 0, '已同步还喊"停摆"= 假告警,是告警通道最怕的事')
  assert.equal(r.judged, false)
  assert.match(synced.lines.join('\n'), /定向升级不介入/)
  rmScratch(synced.dir)

  const noInput = stallHarness(
    unjudgedPayload({
      liveSha: '',
      escalate: { eligible: false, episodeKey: '', silenceMin: null, thresholdMin: 21, why: '线上与 tip 至少一路取不到 ⇒ 落后无从取证,不升级' },
    }),
  )
  noInput.one()
  assert.equal(noInput.calls.length, 0, '取不到输入不得升成告警(§0.3)')
  rmScratch(noInput.dir)

  // 投递失败:不落账 ⇒ 下一轮同一个事件仍会重试(寄失败被记成"已喊过"就是本票要根治的静默)
  const dir = mkScratch('gg-stall-fail-')
  const calls = []
  let n = 0
  const run = (ret) => {
    n += 1
    return N.auditDeployStall({
      now: NOW,
      intervalMs: 1,
      tickFile: join(dir, `tick-${n}.ts`),
      firstFile: join(dir, 'first.json'),
      escalatedFile: join(dir, 'escalated.json'),
      logger: () => {},
      notify: () => {
        calls.push(ret)
        return ret
      },
      runner: () => ({ status: 2, stdout: JSON.stringify(unjudgedPayload()), stderr: '', killed: false }),
    })
  }
  run({ sent: false, why: '派发器异常' })
  assert.equal(existsSync(join(dir, 'escalated.json')), false, '投递失败不得写"已升级"台账')
  run({ sent: true, why: '已送达' })
  assert.equal(calls.length, 2, '失败那一轮没送达 ⇒ 下一轮必须重试,而不是被上一轮的空账压住')
  run({ sent: true, why: '已送达' })
  assert.equal(calls.length, 2, '成功之后才许压住')
  rmScratch(dir)
})

test('S8 装车证明:部署环必须真的在"子进程长时间无输出"时写心跳(否则派生阈值被历史最长阻塞撑大)', () => {
  const src = readFileSync(join(ROOT, 'deploy', 'win', 'ihui-deploy-loop.ps1'), 'utf8')
  assert.match(src, /心跳 本轮已跑/, '没有这行 ⇒ 轮内静默无界,阈值会被 20 分钟门禁阻塞顶到 40 分钟以上,本票 27 分钟的现场照样漏')
  assert.match(src, /\$silenceHeartbeatSec = \$IntervalSeconds/, '心跳间隔必须跟着轮询间隔走,不许另拍一个数')
  const resets = (src.match(/\$lastOutAt = Get-Date/g) || []).length
  assert.ok(resets >= 3, `子进程每写一行都要复位心跳计时(现读 ${resets} 处;少一处就会在有输出时也刷心跳,把"静默"这一维洗掉)`)
})

test('S7 绿档下的"环已停写"同样必须到人(票面那 27 分钟按 45 分钟阈值就是判绿的)', () => {
  const h = stallHarness(
    unjudgedPayload({
      level: 'ok',
      lastSuccessIso: '2026-10-29T02:03:00+00:00',
      why: '线上落后但最近 27 分钟刚成功过,不算停摆',
    }),
  )
  const r = h.one()
  assert.equal(h.calls.length, 1, '这一档若继续沉默,本票的现场换个输入形态照样漏一次')
  assert.match(h.calls[0].detail, /读数档位 ok/, '正文必须写清"这是被判据当成健康的那一档",否则收信人以为是普通停摆')
  assert.equal(r.ok, false)
  // 同一事件第二轮 ⇒ 仍然只一封
  h.one({ lastSuccessIso: '2026-10-29T02:03:00+00:00', logSilenceMin: 42 })
  assert.equal(h.calls.length, 1)
  rmScratch(h.dir)
})

test('S6 恢复成绿 ⇒ 台账结清(第二场停摆不许被上一场压住)', () => {
  const dir = mkScratch('gg-stall-clear-')
  const file = join(dir, 'escalated.json')
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify({ episodeKey: `silence:${SHA_LIVE.slice(0, 9)}`, at: 'x' }), 'utf8')
  const okPayload = {
    level: 'ok',
    liveSha: SHA_TIP,
    tipSha: SHA_TIP,
    tipSource: 'ls-remote(当次服务器真值)',
    lastSuccessIso: '2026-10-29T02:29:00+00:00',
    thresholdMin: 45,
    why: '线上构建 == origin/main tip',
  }
  const calls = []
  N.auditDeployStall({
    now: NOW,
    intervalMs: 1,
    tickFile: join(dir, 't.ts'),
    firstFile: join(dir, 'f.json'),
    escalatedFile: file,
    logger: () => {},
    notify: (...a) => {
      calls.push(a)
      return { sent: true }
    },
    runner: () => ({ status: 0, stdout: JSON.stringify(okPayload), stderr: '', killed: false }),
  })
  assert.equal(existsSync(file), false, '真成功部署之后,上一场停摆的升级台账必须结清')
  assert.equal(calls.length, 0, '绿档不得寄信')
  rmSync(dir, { recursive: true, force: true })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
