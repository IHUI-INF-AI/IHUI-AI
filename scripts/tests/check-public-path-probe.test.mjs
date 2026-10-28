#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* 本测试不发 console —— 结论全部走 node:test 的断言面 */
/**
 * §22c 镜像测试:判据一律 import 自 `scripts/check-public-path-probe.mjs` 的 `__test__` 出口,
 * **本文件不得重写任何归类/统计/判定逻辑**(镜像常量漂移 = 测试从防线变成掩体)。
 *
 * 覆盖票 G-301 点名的四件事:
 *  ① 合成样本"174×200 + 25 超时 + 1×502" ⇒ 序列 B 计数正确,且**超时归"未判定/超时"而不是 5xx**;
 *  ② 同一样本里落在换流时刻前后的坏点必须离开常态集、按序列 A 的口径计(两条序列互不掩盖);
 *  ③ 取证被截断(无 `#EVIDENCE-RC` 行)⇒ 未判定,不得计入失败率、不得当成"跑过了";
 *  ④ 形状锁:探测尺子不得调用任何改状态的命令(无 child_process / 不落第二套 RC 标记语法)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as probe } from '../check-public-path-probe.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SRC = resolve(ROOT, 'scripts', 'check-public-path-probe.mjs')
// 本测试唯一的写面:项目内探针目录(§15/§25;该机明令禁止往 TEMP/项目外落文件)。
const DIR = resolve(ROOT, '.ihui-agent', 'tmp', 'probers')

const T0 = Date.parse('2026-09-28T00:00:00.000Z')
const iso = (offsetSec) => new Date(T0 + offsetSec * 1000).toISOString()

/** 造一条样本:走**真判据** classifySample。与生产 runSequence 同形态(raw 字段 + 归类字段并存)。 */
function mkSample(raw, atSec) {
  return { at: iso(atSec), ...raw, ...probe.classifySample(raw) }
}

/** 票面 ① 的合成分布:174×200 + 25×超时(被上限掐) + 1×502,散布在约 1000s 窗口。 */
function buildTicketSamples() {
  const samples = []
  for (let i = 0; i < 174; i += 1) samples.push(mkSample({ status: 200, ms: 9 + (i % 40) }, i * 5))
  for (let i = 0; i < 25; i += 1) samples.push(mkSample({ status: null, ms: 15_001, aborted: true, causeCode: 'ABORT_ERR' }, 100 + i * 30))
  samples.push(mkSample({ status: 502, ms: 40 }, 850))
  return samples
}

test('① B 序列计数诚实:174/25/1 逐桶正确,超时进"未判定/超时"而不是 5xx/失败', () => {
  const all = buildTicketSamples()
  const stat = probe.summarizeSequence(all, { slowMs: 8000 })
  assert.equal(stat.n, 200)
  assert.equal(stat.buckets.ok, 174, '健康样本数')
  assert.equal(stat.buckets.overCeiling, 25, '超时样本必须整批落 overCeiling')
  assert.equal(stat.buckets.http5xx, 1, '5xx 只有那一条 502 —— 超时不得被并进这里')
  assert.equal(stat.unavailable, 1, '"对端可归因失败"只算 5xx 那 1 条')
  assert.equal(stat.indeterminate, 25, '25 条超时按三态落"不可归因",不并桶进失败率')
  assert.equal(stat.probeSideBroken, 0)
  // 三态不并桶的推论:failRatio 只含 502;慢样本率才含超时(至少证明"比上限慢",这是慢的事实、不是不可用的事实)
  assert.ok(Math.abs(stat.failRatio - 1 / 200) < 1e-9, '失败率 = 1/200,不是 26/200')
  assert.ok(stat.slowRatio > 0.1)
  const j = probe.judgeSequence('B/公网', stat, { rule: 'ratio', slowMs: 8000 })
  assert.equal(j.verdict, 'breach')
  const reasons = j.reasons.join('\n')
  assert.match(reasons, /慢样本率/, '越界原因必须点名慢样本率')
  assert.doesNotMatch(reasons, /对端可归因失败率/, '1/200 不该把失败率也判红 —— 那等于把超时错误定责成对端不可用')
  assert.match(reasons, /不可归因/, '25 条超时必须作为"附"项报名,不静默')
})

test('② 换流窗口分离:事件前后的坏点离开常态集、按 A 的"洞长"口径计;分离是全划分,不重不漏', () => {
  const all = buildTicketSamples()
  // 换流事件钉在 502(at 850s)上;窗口取 preMs=40s / postMs=60s ⇒ 邻近超时(820s)在窗内,更早的(790s/700s)不在。
  const evAt = T0 + 850_000
  const split = probe.splitBySwapWindow(all, [{ at: evAt }], { preMs: 40_000, postMs: 60_000 })
  assert.equal(split.splitApplied, true)
  const windowAt = new Set(split.inWindow.map((s) => s.at))
  assert.ok(windowAt.has(iso(850)), '502 那条必须被分离到窗口段')
  assert.ok(windowAt.has(iso(820)), '事件前 40s 内的超时(820s)也必须离开常态集(票面"前后的坏点归 A")')
  assert.ok(!windowAt.has(iso(790)), '窗口外的超时不得被顺带摘走(分离是窗口,不是"挨着事件的都算")')
  assert.ok(!windowAt.has(iso(700)), '远早于窗口的事件前样本不得被误摘')
  const steady = probe.summarizeSequence(split.steady, { slowMs: 8000 })
  const win = probe.summarizeSequence(split.inWindow, { slowMs: 8000 })
  assert.equal(steady.buckets.http5xx, 0, '常态集的 5xx 必须被摘干净 —— 留下就是两条互相掩盖的反例')
  assert.equal(win.buckets.http5xx, 1)
  assert.equal(steady.n + split.inWindow.length, all.length, '分离是全划分')
  // A 口径(洞长)下这条 40ms 的 502 不构成越阈值;它在 B 常态集也已被分离出去 ⇒ 两侧各说各的,没有第三份结论
  assert.equal(probe.judgeSequence('B/窗口段', win, { rule: 'outage', outageMs: 5000 }).verdict, 'ok')
  // 事件不可得 ⇒ 分离**不假装生效**:全部样本留常态、理由点名"无法分开计数"(三态的"未判定"支)
  const noEv = probe.splitBySwapWindow(all, [])
  assert.equal(noEv.splitApplied, false)
  assert.equal(noEv.steady.length, all.length)
  assert.match(noEv.reason, /无法分开计数/)
  // 真 0:事件在位而确无样本落窗口 ⇒ splitApplied=true 且 inWindow=0(这才允许报"本次无窗口坏点")
  const far = probe.splitBySwapWindow([mkSample({ status: 200, ms: 30 }, 0)], [{ at: T0 + 10 * 60_000 }], { preMs: 20_000, postMs: 60_000 })
  assert.equal(far.splitApplied, true)
  assert.equal(far.inWindow.length, 0)
})

test('③ 取证被截断 ⇒ 未判定:不得计入失败率、不得当"跑过了"(判据复用 run-evidence,零第二份)', () => {
  mkdirSync(DIR, { recursive: true })
  const f = resolve(DIR, 'mirror-g301-truncated.jsonl')
  const g = resolve(DIR, 'mirror-g301-sealed.jsonl')
  try {
    const all = buildTicketSamples()
    const half = all.slice(0, Math.floor(all.length / 2))
    writeFileSync(resolve(DIR, 'mirror-g301-truncated.jsonl'), half.map((s) => JSON.stringify({ kind: 'sample', seq: 'B', url: 'https://public.test/x', ...s })).join('\n') + '\n{"kind":"summary', 'utf8')
    writeFileSync(
      resolve(DIR, 'mirror-g301-sealed.jsonl'),
      all.map((s) => JSON.stringify({ kind: 'sample', seq: 'B', url: 'https://public.test/x', ...s })).join('\n') + '\n',
      'utf8',
    )
    probe.writeLedgerTrailer(g, { at: iso(999), rc: 0, results: {} })
    probe.sealLedger(g, 0)

    const t = probe.readLedger(f)
    assert.equal(t.completion.kind, 'truncated', '没有 #EVIDENCE-RC 行 = 没跑到,不是"跑了没问题"')
    assert.equal(t.exit, 3, 'INCOMPLETE 的退出码是 3,既不是通过(0)也不是失败(1)')
    // 反假绿核心断言:这份截断取证里有"整一半全是 200"的样本 —— 若判据失职,它会被读成"0 次失败的合格证据"
    assert.ok(t.bySeq.B.length > 0, '样本行本身可读回(证明不是"文件全空"这种 trivial 情况)')

    const ok = probe.readLedger(g)
    assert.equal(ok.completion.kind, 'complete')
    assert.equal(ok.bySeq.B.length, all.length, '封缄后的取证必须原样读回全部样本')
    assert.equal(ok.exit, 0)
    // 读不到的文件 ⇒ missing 态,同样不记绿
    const gone = probe.readLedger(resolve(DIR, 'no-such-ledger-9f3a2b.jsonl'))
    assert.equal(gone.completion.kind, 'missing')
    assert.equal(gone.exit, 3)
  } finally {
    // 只删自己造的、且确在 DIR(probers)前缀下的夹具 —— 测试的删除面与写入面同窄
    for (const p of [f, g]) if (p.startsWith(DIR) && existsSync(p)) rmSync(p, { force: true })
  }
})

test('④ 形状锁:这把尺子不得调用任何改状态的命令、不得另立第二套 RC 标记语法', () => {
  const src = readFileSync(SRC, 'utf8')
  const banned = [
    /require\(\s*['"]node:child_process['"]\s*\)/,
    /from\s+['"]node:child_process['"]/,
    /\bspawn(Sync)?\s*\(/,
    /\bexecSync\s*\(/,
    /\bexecFile(Sync)?\s*\(/,
    /\bfork\s*\(/,
    /shell\s*:\s*true/,
    /\brmdirSync\s*\(/,
    /\brenameSync\s*\(/,
    /\btruncateSync\s*\(/,
    /\bunlinkSync\s*\(/,
    /Stop-Service|Restart-Service|nssm\s+set|Remove-Item/,
  ]
  for (const re of banned) assert.equal(re.test(src), false, `形状锁:探测尺子不得出现 ${re}`)
  // RC 标记只能来自 run-evidence 那一份判据(自己拼字符串 = 两套标记必漂移)
  assert.match(src, /from\s+'\.\/run-evidence\.mjs'/, '必须 import run-evidence 的判据')
  assert.equal(/['"]#EVIDENCE-RC=/.test(src), false, '不得在本文件里重新拼 RC 标记字面量')
  // rmSync 只允许出现在自检夹具里(清理自己造的临时取证/临时台账);出现第三处或落在 selfTest 之外即扩大写删面
  const rmLines = src.split('\n').map((l, i) => [l, i + 1]).filter(([l]) => /\brmSync\s*\(/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  const stStart = src.split('\n').findIndex((l) => /^function selfTest\(\)\s*\{/.test(l))
  const stEnd = src.split('\n').findIndex((l) => /^async function main\(/.test(l))
  assert.ok(rmLines.length <= 2, `rmSync 至多两处(均为自检夹具),实为 ${rmLines.length}:${rmLines.map(([, n]) => n).join(',')}`)
  for (const [, n] of rmLines) assert.ok(stStart >= 0 && stEnd > stStart && n > stStart && n < stEnd, `rmSync 只准在 selfTest 夹具内(第 ${n} 行落在其外)`)
})

test('④b 形状锁(测试自锁):本测试的写面钉死在 probers 目录,不得改任何仓库内容', () => {
  const lines = readFileSync(fileURLToPath(import.meta.url), 'utf8').split(/\r?\n/)
  // 只认**调用点**(词 + 左括号);扫描器自己的判据定义行是 `词|词` 形态,不匹配此式 —— 否则测试会判红自己。
  const CALL_RE = /\b(?:writeFileSync|appendFileSync|mkdirSync|rmSync)\s*\(/
  const isDecl = (l) => /\bconst\s+(?:f|g)\s*=/.test(l) && /resolve\(DIR/.test(l)
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i]
    if (!CALL_RE.test(l)) continue
    if (l.trim().startsWith('//') || l.trim().startsWith('*')) continue
    // 合法形态只有三种:① 本行或紧邻行(跨行调用的实参/收尾)出现 DIR;② 紧跟"声明为 resolve(DIR,…) 的变量"之后;③ 自身是该变量的声明行
    const near = lines.slice(Math.max(0, i - 1), i + 2).join('\n')
    const ok = /DIR/.test(near) || (i > 0 && isDecl(lines[i - 1])) || isDecl(l)
    assert.ok(ok, `测试的写操作只准钉在项目内探针目录: ${l.slice(0, 110)}`)
  }
})

test('⑤ 换流签名对真日志有牙(只读;非部署机如实跳过 —— 该格由 self-test E6 在生产档报名)', () => {
  const log = probe.DEFAULTS.deployLog
  if (!existsSync(log)) return
  const r = probe.readSwapEvent(log, probe.DEFAULTS.swapMarker)
  assert.ok(r.events.length > 0, `真日志尾部必须问出至少一个换流事件(拿不到 = oracle 又瞎了):${r.reason}`)
  assert.ok(Number.isFinite(r.at))
})

// ───────────── 2026-10-16 两维新增:归因到"哪一跳" + 按对照组定位到"哪一段" ─────────────

test('⑥ connect 超时具名落 connStall(它既不是对端坏、也不是尺子失明)', () => {
  // 真形态取自 2026-10-16 11:42 实测样本(12 样本里那条 10735ms)
  const real = { status: null, ms: 10_735, errorName: 'TypeError', causeCode: 'UND_ERR_CONNECT_TIMEOUT,Connect,Timeout,Error,(attempted,addresses:,2606:4700:3033::ac43:a3c3:443,,timeout:,10000ms),fetch,failed,TypeError' }
  const c = probe.classifySample(real)
  assert.equal(c.bucket, 'connStall', '回退到旧实现时这条会落 probeError ⇒ 本断言即翻红')
  assert.equal(c.stage, 'stall')
  assert.equal(c.indeterminate, true)
  assert.notEqual(c.probeSideBroken, true, '不得记成"尺子自己失明" —— 20% 失明线会把真链路故障洗成"本轮不出结论"')
  assert.notEqual(c.unavailable, true, '也不得记成对端不可用')
  // 反向对照:同一个统计面上,拒连仍然是"走到了对端 + 对端可归因"(拆归因不许反过来洗白对端坏)
  const refused = probe.classifySample({ status: null, ms: 3, causeCode: 'ECONNREFUSED,127.0.0.1:8801' })
  assert.equal(refused.stage, 'conn')
  assert.equal(refused.unavailable, true)
})

test('⑥b 空闲超时(PROBE_INACTIVITY,握手完成后)⇒ overCeiling/不可归因,不得记成"尺子自己失明"(2026-10-25 现读 E/bsm 那一型)', () => {
  const real = { status: null, ms: 10_460, errorName: 'Error', errorCode: 'PROBE_INACTIVITY', causeCode: 'PROBE_INACTIVITY,PROBE_INACTIVITY,Error', stageReached: 'tlsDone', stages: { dns: 2, tcp: 260, tls: 520, head: null, body: null } }
  const c = probe.classifySample(real)
  assert.equal(c.bucket, 'overCeiling', '摘掉 PROBE_INACTIVITY 那一支即翻红(旧实现落 probeError)')
  assert.equal(c.indeterminate, true)
  assert.notEqual(c.probeSideBroken, true, '不得记成"本地探测故障" —— 20% 失明线会把一次真慢洗成"本轮不出结论"')
  assert.notEqual(c.unavailable, true, '也不得记成对端不可用')
  // 变异对照:同一条错误形态,坏点停在握手中(没到 TLS 完成)⇒ 必须仍归 tlsStall(本机出口段那一型不许被新支吞掉)
  const preTls = probe.classifySample({ ...real, stageReached: 'tcp', stages: { dns: 2, tcp: 260, tls: null, head: null, body: null } })
  assert.equal(preTls.bucket, 'tlsStall')
  // 腿面落点:空闲超时的腿 ⇒ 未判定(不得顶绿,也不得判红)
  const j = probe.judgeEndpointSample('bsm', 'https://bsm.aizhs.top/sso/login', real)
  assert.equal(j.tier, 'undetermined')
  assert.equal(j.verdict, 'unjudged')
})

test('⑦ 慢样本按跳分账且总额不丢;旧取证(没有 stage 字段)按 status/bucket 派生', () => {
  const mix = [
    mkSample({ status: 200, ms: 100 }, 0),
    mkSample({ status: 200, ms: 9000 }, 1),
    mkSample({ status: null, ms: 10_735, errorName: 'TypeError', causeCode: 'UND_ERR_CONNECT_TIMEOUT' }, 2),
    mkSample({ status: null, ms: 9000, causeCode: 'ECONNREFUSED' }, 3),
    mkSample({ status: null, ms: 1, errorName: 'Error', causeCode: 'ERR_INTERNAL_WEIRD' }, 4),
  ]
  const s = probe.summarizeSequence(mix, { slowMs: 8000 })
  assert.equal(s.n, 5)
  assert.equal(s.httpN, 2, '两条 200 才算走到对端')
  assert.equal(s.stallN, 2, 'connect 超时 + 无法归类异常')
  assert.equal(s.connN, 1, '拒连走到了对端')
  assert.equal(s.slow, 3, '总额仍是老口径(含 conn 阶段的慢样本)—— 拆维不得把账抹掉')
  assert.equal(s.httpSlow, 1)
  assert.equal(s.stallSlow, 1)
  assert.equal(s.buckets.connStall, 1)
  // 旧取证行:classifySample 当年不写 stage,派生必须走 status/bucket,不能把 200 读成"没走到对端"
  const legacy = [{ bucket: 'ok', unavailable: false, ms: 9000, status: 200, at: iso(0) }, { bucket: 'connStall', unavailable: false, indeterminate: true, ms: 10_735, status: null, at: iso(1) }]
  const l = probe.summarizeSequence(legacy, { slowMs: 8000 })
  assert.equal(l.httpN, 1, '一条 200 响应绝不能被读成 stall')
  assert.equal(l.stallN, 1)
  assert.equal(l.httpSlow, 1)
  assert.equal(l.stallSlow, 1)
})

test('⑧ 定位到"哪一段"必须**随对照组与握手分界翻**(变异取证:换输入即换段)', () => {
  // 新传输层每条样本都带 stageReached/stages ⇒ 生产形态的夹具也必须带(否则测的是旧取证那一支)
  const stg = (over) => ({ stageReached: 'body', stages: { dns: 2, tcp: 270, tls: 510, head: 700, body: over.ms }, ...over })
  const mk2 = (raw, atSec) => ({ at: iso(atSec), ...raw, ...probe.classifySample(raw) })
  const pub = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2(stg({ status: 200, ms: i < 6 ? 9000 : 500 }), i)), { slowMs: 8000 })
  const localFast = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2(stg({ status: 200, ms: 20 }), 100 + i)), { slowMs: 8000 })
  const localSlow = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2(stg({ status: 200, ms: 9000 }), 200 + i)), { slowMs: 8000 })
  const entry = probe.classifyPublicLeg(pub, localFast)
  assert.equal(entry.leg, 'entry')
  assert.equal(entry.tag, '入口段', '公网 6/10 条 ≥8s(握手后拿到响应)而对照 20ms ⇒ 只能是 CF 边缘/隧道/上行')
  const service = probe.classifyPublicLeg(pub, localSlow)
  assert.equal(service.leg, 'service')
  assert.equal(service.tag, '服务段', '对照同轮也慢 ⇒ 洞在 web 本体,再让人去查公网链路就是误导')
  assert.notEqual(entry.tag, service.tag, '两段的身份必须不同(dedupKey 按身份,换段该重新起一轮)')
  // 停在握手中那一型:同一条越阈读数,段名必须翻成"本机出口段"(2026-10-16 那封邮件的真身)
  const handShakeStall = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2({ bucket: 'tlsStall', stage: 'stall', stageReached: 'tcp', stages: { dns: 2, tcp: 300, tls: null, head: null, body: null }, indeterminate: true, preTls: true, unavailable: false, status: null, ms: 10_700 }, 300 + i)), { slowMs: 8000 })
  assert.equal(probe.classifyPublicLeg(handShakeStall, localFast).tag, '本机出口段')
  // 三态:任一侧没样本 / 没有分阶段读数 ⇒ 不猜
  assert.equal(probe.classifyPublicLeg(pub, probe.summarizeSequence([])).leg, 'undetermined')
  assert.equal(probe.classifyPublicLeg(pub, probe.summarizeSequence([])).tag, null, '拿不到定位时身份里不许凭空多一档段名')
  assert.equal(probe.classifyPublicLeg(probe.summarizeSequence([]), localFast).leg, 'undetermined')
  const legacy = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2({ status: 200, ms: i < 6 ? 9000 : 500 }, 400 + i)), { slowMs: 8000 })
  assert.equal(legacy.stageEvidence, false, '旧取证(无 stageReached)必须被判成"分界证据不全"')
  assert.equal(probe.classifyPublicLeg(legacy, localFast).leg, 'unlocated', '拿旧取证冒认某一段 = 让人去查一个可能健康的组件')
  // 公网自己没越阈 ⇒ clear(段名只用于真有坏点时)
  assert.equal(probe.classifyPublicLeg(localFast, localSlow).leg, 'clear')
})

test('⑨ 形状锁:新判据符号必须从 __test__ 出口可达(实现了但调不到 = 没实现,§0.9)', () => {
  for (const k of ['classifySample', 'sampleStage', 'summarizeSequence', 'classifyPublicLeg', 'judgeSequence', 'classifyAlertIdentity', 'projectVerdictForDispatch']) {
    assert.equal(typeof probe[k], 'function', `__test__ 出口缺 ${k} —— 镜像测试就只能靠复制判据(§22c 禁止)`)
  }
  // numbers 必须真带出分账读数(否则邮件里仍然只有"慢 6"这一句话,收信人无从下手)
  const stat = probe.summarizeSequence([mkSample({ status: 200, ms: 9000 }, 0), mkSample({ status: null, ms: 10_735, causeCode: 'UND_ERR_CONNECT_TIMEOUT' }, 1)], { slowMs: 8000 })
  const j = probe.judgeSequence('B/公网·常态·入口段', stat, { rule: 'ratio', slowMs: 8000 })
  assert.match(j.numbers, /走到对端并拿到响应 1,没走到对端 1/, `读数必须把两跳分开:${j.numbers}`)
  assert.match(j.numbers, /响应之后 1 \/ 连对端都没到 1/)
})

// ───────────── 2026-10-17 新增:告警身份归一(classifyAlertIdentity,派发层 dedupKey 的唯一供给) ─────────────

/** 造一份"纯慢、不断流"的统计:n 样本里 slow 条 ≥8s(全部走到对端)。 */
const rate = (n, slow) => probe.summarizeSequence(Array.from({ length: n }, (_, i) => mkSample({ status: 200, ms: i < slow ? 9_000 : 20 }, i)), { slowMs: 8_000 })

test('⑩ 身份与计数无关(本票存在理由的变异自证)+ 严重度边界钉死', () => {
  // 变异自证:两轮读数只在**计数**上不同(20/12 与 40/24,同为 60%)⇒ 身份必须逐字节相等。
  // 若把 sevTier 换成原始计数(旧 alertFingerprint(name, detail) 那一型),这两行当场分叉、4h 窗口形同虚设。
  const a = probe.classifyAlertIdentity('B/公网·常态', rate(20, 12), { nowMs: T0 })
  const b = probe.classifyAlertIdentity('B/公网·常态', rate(40, 24), { nowMs: T0 })
  assert.equal(a.identity, b.identity)
  assert.equal(a.identity, 'unknown;sev=2;held=0')
  // 边界夹具:89% vs 90%、49% vs 50%(边界含高档)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', rate(100, 89), { nowMs: T0 }).sevTier, 2)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', rate(100, 90), { nowMs: T0 }).sevTier, 3)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', rate(100, 49), { nowMs: T0 }).sevTier, 1)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', rate(100, 50), { nowMs: T0 }).sevTier, 2)
  // 断流级优先:全拒连(0 慢样本)也是档 4 —— "有对端可归因失败/真断流"不许被慢样本率降档
  const broke = probe.summarizeSequence(Array.from({ length: 6 }, (_, i) => mkSample({ status: null, ms: 3, causeCode: 'ECONNREFUSED' }, i)), { slowMs: 8_000 })
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', broke, { nowMs: T0 }).sevTier, 4)
  // why/identity 均不含本轮原始计数(计数只归派发层正文)
  const r = probe.classifyAlertIdentity('B/公网·常态', rate(15, 8), { nowMs: T0 })
  assert.ok(!/15/.test(r.identity) && !/8/.test(r.identity) && !/15/.test(r.why) && !/8/.test(r.why), `身份与 why 里混进了原始计数:${r.identity} / ${r.why}`)
  assert.match(r.why, /成因=.*严重度=档.*已持续=档/s)
})

test('⑪ 三态与档位:未判定与 breach 不同形 / 跨档换身份 / 同档不换 / 起点取不到按最短档并点名不得静音', () => {
  const s = rate(20, 12)
  // 未判定:零样本 ⇒ sev=0、cause=unknown;probeSideBroken ⇒ sev=0、cause=local;
  // 与同目标 breach 身份不同形 ⇒ 既替不了 breach 的账,也不会被派发层读成"合规"。
  const breach = probe.classifyAlertIdentity('B/公网·常态·入口段', s, { nowMs: T0 })
  const zero = probe.classifyAlertIdentity('B/公网·常态·入口段', probe.summarizeSequence([]), { nowMs: T0 })
  const blind = probe.classifyAlertIdentity('B/公网·常态·入口段', probe.summarizeSequence([mkSample({ status: null, ms: 1, errorName: 'Error', causeCode: 'ERR_INTERNAL_WEIRD' }, 0), mkSample({ status: null, ms: 1, errorName: 'Error', causeCode: 'ERR_INTERNAL_WEIRD' }, 1), mkSample({ status: 200, ms: 20 }, 2)]), { nowMs: T0 })
  assert.ok(breach.sevTier >= 1)
  assert.equal(zero.sevTier, 0)
  assert.equal(zero.causeKey, 'unknown')
  assert.notEqual(zero.identity, breach.identity)
  assert.equal(blind.sevTier, 0)
  assert.equal(blind.causeKey, 'local')
  assert.notEqual(blind.identity, breach.identity)
  assert.notEqual(blind.identity, zero.identity)
  // 持续档:<6h⇒0、6h⇒1、24h⇒2、72h⇒3(边界含高档)
  const H = 3_600_000
  const held = (ms) => probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0, firstBreachAtMs: T0 - ms }).heldTier
  assert.equal(held(5 * H), 0)
  assert.equal(held(6 * H), 1)
  assert.equal(held(24 * H), 2)
  assert.equal(held(72 * H), 3)
  // 同因同档不重报(3h 与 5h 同 held=0)/ 跨档必换身份(6h 起 held=1 ⇒ 派发层立刻重寄 = 到期升级的终态保证)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0, firstBreachAtMs: T0 - 3 * H }).identity, probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0, firstBreachAtMs: T0 - 5 * H }).identity)
  assert.notEqual(probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0, firstBreachAtMs: T0 - 6 * H }).identity, probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0 }).identity)
  // 起点取不到/时刻倒挂 ⇒ 最短档 + why 点名"不得据此静音"(§0.10:失效方向是多要一次说明)
  const noStart = probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0 })
  assert.equal(noStart.heldTier, 0)
  assert.match(noStart.why, /起点取不到.*不得据此静音/)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', s, { nowMs: T0, firstBreachAtMs: T0 + 60_000 }).heldTier, 0)
})

test('⑫ 成因段只映射既有输出:段标签/A/窗口段/对照组 ⇒ 档;两条既有定位读数打架 ⇒ mixed;给不出 ⇒ unknown 不折档', async () => {
  const s = rate(20, 12)
  const cause = (k) => probe.classifyAlertIdentity(k, s, { nowMs: T0 }).causeKey
  assert.equal(cause('B/公网·常态·入口段'), 'entry')
  assert.equal(cause('B/公网·常态·服务段'), 'origin')
  assert.equal(cause('B/公网·常态·本机出口段'), 'local')
  assert.equal(cause('A/公网'), 'origin', '换流洞按 classifyPublicLeg"本地也越阈⇒服务段"与窗口段归 A 语义的既有口径,不新立规则')
  assert.equal(cause('B/本地·常态'), 'origin')
  assert.equal(cause('B/公网·窗口段(归A语义)'), 'origin')
  assert.equal(cause('B/公网·常态'), 'unknown', '既有判据给不出段 ⇒ 不冒认(§0.3)')
  // opt.leg / opt.localStat 都走 classifyPublicLeg 那一份实现:一致则采信,打架则 mixed
  assert.equal(probe.classifyAlertIdentity('B/公网·常态·入口段', s, { nowMs: T0, leg: 'entry' }).causeKey, 'entry')
  assert.equal(probe.classifyAlertIdentity('B/公网·常态·入口段', s, { nowMs: T0, leg: 'service' }).causeKey, 'mixed')
  const stg = (over) => ({ stageReached: 'body', stages: { dns: 2, tcp: 270, tls: 510, head: 700, body: over.ms }, ...over })
  const pub = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => ({ at: iso(i), ...stg({ status: 200, ms: i < 6 ? 9000 : 500 }), ...probe.classifySample(stg({ status: 200, ms: i < 6 ? 9000 : 500 })) })), { slowMs: 8000 })
  const localFast = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => ({ at: iso(100 + i), ...stg({ status: 200, ms: 20 }), ...probe.classifySample(stg({ status: 200, ms: 20 })) })), { slowMs: 8000 })
  const localSlow = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => ({ at: iso(200 + i), ...stg({ status: 200, ms: 9000 }), ...probe.classifySample(stg({ status: 200, ms: 9000 })) })), { slowMs: 8000 })
  assert.equal(probe.classifyAlertIdentity('B/公网·常态·入口段', pub, { nowMs: T0, localStat: localFast }).causeKey, 'entry')
  assert.equal(probe.classifyAlertIdentity('B/公网·常态·入口段', pub, { nowMs: T0, localStat: localSlow }).causeKey, 'mixed')
  // 派发层按**具名导出** import(不靠 __test__):具名缺失 = 接线当场失明(§0.9)
  const mod = await import('../check-public-path-probe.mjs')
  assert.equal(typeof mod.classifyAlertIdentity, 'function')
  assert.equal(mod.classifyAlertIdentity, probe.classifyAlertIdentity, '具名导出与 __test__ 出口必须是同一枚实现')
})

// ───────────── 2026-10-20 新增:派发契约(投影层不得吞掉严重度档的唯一输入) ─────────────

test('⑬ 投影到派发契约后,严重度档必须仍然算得出来(实测曾被无声吞掉两周)', () => {
  const j = probe.judgeSequence('B/公网·常态·入口段', rate(20, 12), { rule: 'ratio', slowMs: 8000 })
  const verdict = { key: 'B/公网·常态·入口段', ...j, leg: 'entry', stat: rate(20, 12) }
  const projected = probe.projectVerdictForDispatch(verdict)

  // ① 契约键齐全:派发层 git-guardian 按这五个键算身份与出路,少任何一个都是"读成没问题"。
  for (const k of ['verdict', 'reasons', 'numbers', 'leg', 'stat']) {
    assert.ok(projected[k] !== undefined, `派发契约缺 ${k} —— 消费方按 \`r?.${k}\` 取,取不到不报错,只会静默降级`)
  }
  // ② 拿投影后的 stat 再走一遍身份,必须与原始 stat 逐字节同结果(投影是有损还是无损,只认这条)。
  const raw = probe.classifyAlertIdentity('B/公网·常态·入口段', verdict.stat, { nowMs: T0, leg: 'entry' })
  const viaProject = probe.classifyAlertIdentity('B/公网·常态·入口段', projected.stat, { nowMs: T0, leg: 'entry' })
  assert.equal(viaProject.identity, raw.identity, `投影改变了身份:${raw.identity} → ${viaProject.identity}`)
  assert.equal(viaProject.sevTier, 2, `纯慢 60% 应是档 2,实得档 ${viaProject.sevTier}`)
  // ③ 变异自证:**这正是线上那一型** —— 契约里没 stat 时 sev 恒 0,断流级恶化不再变成新身份。
  const starved = probe.classifyAlertIdentity('B/公网·常态·入口段', {}, { nowMs: T0, leg: 'entry' })
  assert.equal(starved.sevTier, 0, '反证失效:摘掉 stat 后仍然不是档 0,说明这一维本来就没靠 stat')
  assert.notEqual(starved.identity, raw.identity, '摘掉 stat 必须让身份变形(否则"恒 0"根本看不出来)')
  // ④ 断流级也必须能穿过契约:全拒连(0 慢样本、sev=4)投影后仍是 4。
  const broke = probe.summarizeSequence(Array.from({ length: 6 }, (_, i) => mkSample({ status: null, ms: 3, causeCode: 'ECONNREFUSED' }, i)), { slowMs: 8_000 })
  const brokeP = probe.projectVerdictForDispatch({ key: 'B/公网·常态·入口段', ...probe.judgeSequence('B/公网·常态·入口段', broke, { rule: 'ratio', slowMs: 8000 }), leg: 'entry', stat: broke })
  assert.equal(probe.classifyAlertIdentity('B/公网·常态·入口段', brokeP.stat, { nowMs: T0, leg: 'entry' }).sevTier, 4, 'sev=4 是升级即重报那一档,过不了契约就等于没有')
  // ⑤ A 序列本来就带 stat(:1258)—— 旧投影把它丢掉过,所以这里连 A 一起钉。
  assert.ok(probe.projectVerdictForDispatch({ key: 'A/公网', verdict: 'breach', reasons: [], numbers: 'x', stat: broke }).stat !== undefined, 'A 序列的 stat 也不许在投影里丢')
})

// ───────────── 2026-10-22 新增(票 G-960):换靶真入口 + 3xx"零信息"语义 ─────────────

test('⑭ G-960 靶形状锁(与 env 无关):默认字面量必须是 www 真入口,裸域旧靶只作夹具', () => {
  const host = (u) => {
    try {
      return new URL(u).host
    } catch {
      return ''
    }
  }
  // 立案现场:靶钉裸域 ⇒ 公网腿恒拿 Cloudflare 边缘 301,入口 522/530 断流结构上量不到。
  // 定档数据(2026-10-22 成组对照,各 20 次):www/sso/login 20×200;裸域/sso/login 20×301。
  assert.ok(host(probe.ENTRY_URL_DEFAULT).startsWith('www.'), `默认靶离开了真入口:${probe.ENTRY_URL_DEFAULT}`)
  assert.equal(host(probe.ZERO_INFO_LEGACY_URL), 'aizhs.top', '裸域旧靶必须保留具名(留名是为了"换回去"也得在代码里留下理由)')
  assert.notEqual(probe.ENTRY_URL_DEFAULT, probe.ZERO_INFO_LEGACY_URL, '默认靶若换回恒 301 的旧靶 = 重造立案现场,本断言当场翻红')
})

test('⑮ G-960 classifySample:单条 3xx 不算坏,但 note 必须自曝"不证明回源健康"(不得冒认终态)', () => {
  for (const s of [301, 302, 307, 399]) {
    const c = probe.classifySample({ status: s, ms: 668 })
    assert.equal(c.bucket, 'redirected', `HTTP ${s} 必须落 redirected`)
    assert.equal(c.stage, 'http')
    assert.equal(c.unavailable, false, '单条 3xx 不算对端失败(混合腿照旧出合格证)—— 但整轮全 3xx 由 ⑯ 剥夺资格')
    assert.match(c.note, /不证明回源健康/, '3xx 只证明"到得了答 3xx 的那一跳",归类注记必须写明这条边界(§0.3)')
  }
  // 邻界变异:终态/4xx/5xx 各归各桶,"不跟重定向"不许把读数漏进隔壁
  assert.equal(probe.classifySample({ status: 200, ms: 400 }).bucket, 'ok')
  assert.equal(probe.classifySample({ status: 404, ms: 400 }).unavailable, false)
  assert.equal(probe.classifySample({ status: 522, ms: 400 }).unavailable, true, '522(CF 回源超时)是对端可归因失败 —— 入口断流时这把尺子必须看得见这一型')
})

test('⑯ G-960 三态:整轮全 3xx ⇒ 未判定并点名换靶出路 / 混合照旧出证 / 3xx+5xx 断流优先', () => {
  // 复现立案现场:10/10 停 redirected(裸域恒 301),旧账面写 ok ⇒ 现在必须自曝零信息
  const bare = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mkSample({ status: 301, ms: 668 }, i)), { slowMs: 8000 })
  const jb = probe.judgeSequence('B/公网·常态', bare, { rule: 'ratio', slowMs: 8000 })
  assert.equal(bare.buckets.redirected, 10)
  assert.equal(bare.unavailable, 0)
  assert.equal(jb.verdict, 'unjudged', '零信息腿不得出"入口健康"的合格证')
  const why = jb.reasons.join(' ')
  assert.match(why, /全部停在 3xx/)
  assert.ok(why.includes(probe.ENTRY_URL_DEFAULT), `出路必须当场给出可执行的下一步(§5e-1 出口①),含现读默认靶:${why}`)
  // 身份面:未判定不得携带严重度("量不到"不许冒充档位)
  assert.equal(probe.classifyAlertIdentity('B/公网·常态', bare, { nowMs: T0 }).sevTier, 0)
  // 混合(5×301+5×200):3xx 仍不算坏、该腿照旧出合格证 —— 不许把"有重定向"读成失明
  const mix = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mkSample({ status: i % 2 ? 301 : 200, ms: 400 }, i)), { slowMs: 8000 })
  const jm = probe.judgeSequence('B/公网·常态', mix, { rule: 'ratio', slowMs: 8000 })
  assert.equal(jm.verdict, 'ok')
  assert.equal(jm.reasons.length, 0, '混合轮的 3xx 不许混进判红或附项(既有语义不动)')
  // 反向锁:整轮没有 2xx 但**确有**对端可归因失败(3xx+5xx)⇒ 断流优先,不得被零信息支洗成未判定
  const out = probe.summarizeSequence(Array.from({ length: 8 }, (_, i) => mkSample({ status: i < 6 ? 301 : 502, ms: 700 }, i)), { slowMs: 8000 })
  assert.equal(out.unavailable, 2)
  assert.equal(probe.judgeSequence('B/公网·常态', out, { rule: 'ratio', slowMs: 8000 }).verdict, 'breach', '断流必须红,"掺了 3xx"不是豁免')
  // 变异对照:全 200(www 腿现测形状)不得被误报未判定
  const healthy = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mkSample({ status: 200, ms: 185 }, i)), { slowMs: 8000 })
  assert.equal(probe.judgeSequence('B/公网·常态', healthy, { rule: 'ratio', slowMs: 8000 }).verdict, 'ok')
})

test('⑰ G-960 classifyPublicLeg:快速 5xx 断流必须归"入口段",不得被旧判序指到本机出口段(正反双向变异对照)', () => {
  // 立案现场的第二型:断流不是"慢"——CF 的 522/530 几百毫秒就答。旧判序(慢样本→入口段/否则→本机出口段)
  // 会把整轮 5xx 写成"只关于本机出口、真实访客不经此路",把最该喊人的那一型指到健康的组件上(§5e-1)。
  const stg = (over) => ({ stageReached: over.status ? 'body' : 'tcp', stages: { dns: 2, tcp: 260, tls: 520, head: over.status ? 700 : null, body: over.status ? 900 : null }, ...over })
  const mk2 = (raw, atSec) => ({ at: iso(atSec), ...raw, ...probe.classifySample(raw) })
  const pub530 = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2(stg({ status: 530, ms: 300 }), i)), { slowMs: 8000 })
  const localFast = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2(stg({ status: 200, ms: 20 }), 100 + i)), { slowMs: 8000 })
  // 牙齿自证:这一读数在**旧判序**的落点条件上确实成立(httpSlow+postTlsStall=0)⇒ 本断言不是空转
  assert.equal(pub530.httpSlow + pub530.postTlsStall, 0, '前提破:读数不是"快 5xx"那一型')
  assert.equal(pub530.unavailable, 10)
  const g = probe.classifyPublicLeg(pub530, localFast)
  assert.equal(g.leg, 'entry', '对端可归因失败必须归访客同经的入口段,不得落本机出口段')
  assert.equal(g.tag, '入口段')
  assert.match(g.note, /对端可归因失败/, '定位正文必须点名失败形态(收信人据此查 cloudflared/回源,不是查本机网络)')
  assert.match(g.note, /5xx 10/)
  // 双向对照①:对照组同轮也越阈 ⇒ 既有"服务段"判定不得被新支吞掉
  const localBad = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2(stg({ status: 500, ms: 20 }), 200 + i)), { slowMs: 8000 })
  assert.equal(probe.classifyPublicLeg(pub530, localBad).tag, '服务段')
  // 双向对照②:无对端可归因失败、坏点全停在握手中 ⇒ 仍归"本机出口段"(新支不得把本机出口的账抢进入口)
  // 夹具必须真"停在握手中"(stages.tls=null):带 tls 读数会被读成握手完成后才停 ⇒ 归口本就该是入口段
  const stall = probe.summarizeSequence(Array.from({ length: 10 }, (_, i) => mk2({ status: null, ms: 10_700, aborted: true, causeCode: 'PROBE_INACTIVITY,Socket', stageReached: 'tcp', stages: { dns: 2, tcp: 300, tls: null, head: null, body: null } }, 300 + i)), { slowMs: 8000 })
  assert.equal(stall.unavailable, 0)
  assert.equal(probe.classifyPublicLeg(stall, localFast).tag, '本机出口段')
})

// ───────────── 2026-10-24 立、2026-10-25 收口(票 G-960 判据面):靶只认台账 + 3xx 跟到终态 + 逐维三态 ─────────────

const LEGS_SRC = resolve(ROOT, 'scripts', 'data', 'public-path-legs.json')

test('⑱ G-960 靶形状锁:腿清单只认 scripts/data/public-path-legs.json 一处登记面,每行带仓内出处与现读凭据', () => {
  const load = probe.loadPublicLegs(LEGS_SRC)
  assert.equal(load.state, 'ok', `靶台账必须现读可用,实为 ${load.state}:${load.reason}`)
  const hosts = load.legs.map((e) => new URL(e.url).host)
  // 立案现场:靶只钉裸域(或只钉一条腿)⇒ 真腿结构上量不到。www + api + sso + ai 四条腿必须同时在册
  for (const h of ['www.aizhs.top', 'api.aizhs.top', 'sso.aizhs.top', 'ai.aizhs.top']) assert.ok(hosts.includes(h), `缺腿:${h}`)
  assert.equal(new Set(hosts).size, hosts.length, '同一 host 不得在册两次(重复身份)')
  for (const e of load.legs) {
    assert.equal(e.host, new URL(e.url).host, `${e.id}:host 字段与 url 的 host 必须逐字一致(两套靶必漂移)`)
    assert.ok(e.registeredIn.length > 0, `${e.id}:缺 registeredIn ⇒ 路径是凭记忆写的,票面禁止`)
    assert.match(String(e.measuredOn), /^\d{4}-\d{2}-\d{2}$/, `${e.id}:measuredOn 形态坏 ⇒ 现读凭据不成立`)
    assert.ok(String(e.measured).trim().length > 0, `${e.id}:缺 measured(现读状态形态)`)
    assert.match(String(e.rawRoleOrigin || e.origin || ''), /(127\.0\.0\.1|localhost):\d+/, `${e.id}:缺源站(红了收信人要能查到那一段,§5e-1)`)
  }
  assert.equal(load.dropped.length, 0, `台账里有不合格行被剔:${JSON.stringify(load.dropped)}`)
  // 单一真相源(§0.6):代码侧不得再留第二份硬编码靶
  const src = readFileSync(SRC, 'utf8')
  assert.equal(/PUBLIC_ENDPOINTS/.test(src), false, '旧硬编码矩阵 PUBLIC_ENDPOINTS 必须已退役')
  assert.equal(/id:\s*'www',\s*host:/.test(src), false, '代码里不得再抄一份腿清单')
  assert.ok(/public-path-legs\.json/.test(src), '尺子必须点名唯一登记面')
  assert.equal(new URL(probe.ENTRY_URL_DEFAULT).host, 'www.aizhs.top')
  assert.equal(probe.ZERO_INFO_LEGACY_URL, 'https://aizhs.top/sso/login', '裸域旧靶只作夹具/文档对照,不得回到射程')
})

test('⑱b G-960 台账腐烂 ⇒ 未判定(缺文件/坏 JSON/枚举 0/到期/缺 expires/凭记忆写/host 漂移/撞号/时刻坏),绝不回落成第二份靶', () => {
  mkdirSync(DIR, { recursive: true })
  const written = []
  const wf = (name, text) => {
    const p = resolve(DIR, name)
    writeFileSync(p, text, 'utf8')
    written.push(p)
    return p
  }
  try {
    const good = { id: 'x', host: 'x.test', url: 'https://x.test/', registeredIn: ['scripts/tests/check-public-path-probe.test.mjs:1'], measuredOn: '2026-10-25', measured: '200', origin: '127.0.0.1:8801' }
    const cases = [
      ['legs-missing.json', null, /读不到/],
      ['legs-broken.json', '{不是 JSON', /不是合法 JSON/],
      ['legs-zero.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [] }), /枚举为 0/],
      ['legs-expired.json', JSON.stringify({ schema: 1, expires: '2020-01-01', legs: [good] }), /到期/],
      ['legs-noexpires.json', JSON.stringify({ schema: 1, legs: [good] }), /expires/],
      ['legs-nomemory.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [{ ...good, registeredIn: undefined }] }), /registeredIn/],
      ['legs-hostdrift.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [{ ...good, host: '漂移.host' }] }), /逐字不等/],
      ['legs-dupid.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [good, { ...good, url: 'https://x.test/other' }] }), /撞号/],
      ['legs-timerotate.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [{ ...good, measuredOn: '昨天' }] }), /measuredOn/],
      ['legs-noorigin.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [{ ...good, origin: undefined }] }), /源站/],
    ]
    for (const [name, text, re] of cases) {
      const p = text === null ? resolve(DIR, 'legs-does-not-exist.json') : wf(name, text)
      const r = probe.loadPublicLegs(p)
      assert.equal(r.state, 'unjudged', `${name}:台账腐烂必须落未判定,实为 ${r.state}`)
      assert.match(r.reason, re, `${name}:未判定必须点名原因,实得 ${r.reason}`)
    }
    // 混合面:一行坏 + 一行好 ⇒ 好行仍入射程,但该面不得出合格证(缺腿就喊缺腿,不静默少探)
    const mix = probe.loadPublicLegs(wf('legs-mixed.json', JSON.stringify({ schema: 1, expires: '2099-01-01', legs: [good, { ...good, id: 'y', host: '漂移.host', url: 'https://y.test/' }] })))
    assert.equal(mix.state, 'unjudged')
    assert.equal(mix.legs.length, 1, '合格行仍要留下(失效方向 = 多要一次登记,绝不少探一条)')
    assert.equal(mix.dropped.length, 1)
    // 形状锁:导出的默认面就是仓内那本台账(派发侧无需再传)
    assert.equal(probe.PUBLIC_LEGS_FILE, LEGS_SRC)
    assert.equal(probe.loadPublicLegs().file, probe.PUBLIC_LEGS_FILE)
    assert.equal(probe.loadPublicLegs().state, 'ok', '默认面必须现读可用 —— 派发层(git-guardian)拿的就是这一枚')
  } finally {
    for (const p of written) if (p.startsWith(DIR)) rmSync(p, { force: true })
  }
})

test('⑲ G-960 三档判据正反照(夹具锁判据,不发网络):5xx→红、终页 2xx→绿、止步 3xx/4xx/探不到→未判定且点名', () => {
  const ep = (raw) => probe.judgeEndpointSample('www', 'https://www.aizhs.top/sso/login', raw)
  // 正照:522/530/5xx 是"源站不可达",必须判红 —— 不许并进 3xx 那一档放过
  for (const s of [522, 530, 500, 503]) {
    const j = ep({ status: s, ms: 300 })
    assert.equal(j.tier, 'origin-unreachable', `HTTP ${s} 必须落 origin-unreachable`)
    assert.equal(j.verdict, 'breach', `HTTP ${s} 必须判红`)
    assert.equal(j.stat.unavailable, 1, `HTTP ${s} 必须计入对端可归因失败(派发层的严重度档靠它)`)
    assert.equal(j.leg, 'entry', '断流的定位必须是访客同经的入口段,不得指到本机出口(§5e-1)')
    assert.match(j.reasons.join(' '), /源站不可达/)
  }
  // 2026-10-25 收紧:3xx **不再顶绿**(旧档 edge-reachable + verdict=ok 就是"断了也没人喊"那一格)
  for (const s of [301, 302, 307, 308]) {
    const capped = ep({ status: s, ms: 668, legHops: 3, redirectNote: '跟随已达上限 3 跳' })
    assert.equal(capped.tier, 'redirect-unresolved', `HTTP ${s} 终读仍是 3xx ⇒ 必须落 redirect-unresolved`)
    assert.equal(capped.verdict, 'unjudged', `HTTP ${s} 绝不得读成可用`)
    assert.equal(capped.reasons.length, 1, '未判定必须点名(不得静默放过)')
    assert.match(capped.numbers, /上限 3 跳/)
    const broken = ep({ status: s, ms: 668, legHops: 0, redirectNote: 'Location 缺失 ⇒ 终点未知,不猜' })
    assert.equal(broken.verdict, 'unjudged')
    assert.match(broken.numbers, /终点未知/)
    // 变异对照:同样一条 3xx,拿到"跟到终页 200"的读数后必须翻成绿(未判定不是恒红)
    assert.equal(ep({ status: 200, ms: 668, legHops: 1, legUrl: 'https://www.aizhs.top/x' }).verdict, 'ok')
  }
  // 4xx:边缘或路由语义都能答 ⇒ 未判定(票面"避免把 404 当源站故障"的另一半:也不得把 4xx 当好)
  for (const s of [403, 404, 429]) {
    const j = ep({ status: s, ms: 300 })
    assert.equal(j.tier, 'unverified-answer', `HTTP ${s} 不证明回源 ⇒ 未判定`)
    assert.equal(j.verdict, 'unjudged')
    assert.match(j.reasons.join(' '), /核对靶台账/, '出路必须可执行(§5e-1):先核对登记路径')
  }
  // 绿只发给终页 2xx,且必须带上"跟了几跳"的凭据
  const okDirect = ep({ status: 200, ms: 120 })
  assert.equal(okDirect.tier, 'origin-ok')
  assert.equal(okDirect.verdict, 'ok')
  assert.equal(okDirect.reasons.length, 0)
  assert.doesNotMatch(okDirect.numbers, /跟随/, '未跟跳就不许凭空写出跳数(读数不得编造)')
  const okVia = ep({ status: 200, ms: 900, legHops: 2, legUrl: 'https://sso.aizhs.top/admin/master/console/', chain: ['https://sso.aizhs.top/', 'https://sso.aizhs.top/admin/', 'https://sso.aizhs.top/admin/master/console/'] })
  assert.equal(okVia.verdict, 'ok')
  assert.match(okVia.numbers, /跟随 2 跳至 https:\/\/sso\.aizhs\.top\/admin\/master\/console\//)
  // 探不到:超时 / DNS / 连接超时 ⇒ 未判定,不得冒充通过
  for (const raw of [
    { status: null, ms: 15_001, aborted: true, causeCode: 'ABORT_ERR' },
    { status: null, ms: 5, causeCode: 'ENOTFOUND' },
    { status: null, ms: 10_735, causeCode: 'UND_ERR_CONNECT_TIMEOUT' },
  ]) {
    const j = probe.judgeEndpointSample('www', 'https://www.aizhs.top/sso/login', raw)
    assert.equal(j.tier, 'undetermined', `未采到状态行必须落 undetermined:${raw.causeCode}`)
    assert.equal(j.verdict, 'unjudged', '探不到 ⇒ 未判定,不得写成"入口健康"')
    assert.match(j.numbers, /未判定/)
  }
  // 反向锁:拒连/复位是走到了对端、对端可归因的失败 ⇒ 红,不得被"探不到"支洗成未判定
  for (const code of ['ECONNREFUSED', 'ECONNRESET']) {
    const j = probe.judgeEndpointSample('api', 'https://api.aizhs.top/api/health', { status: null, ms: 3, causeCode: code })
    assert.equal(j.tier, 'origin-unreachable', `${code} 是对端可归因失败,必须红`)
    assert.equal(j.verdict, 'breach')
  }
})

test('⑲b G-960 跟跳决策:Location 解析与三态止步(纯函数,不发网络)—— 跟不完必须报名,不得当成终页', () => {
  assert.equal(probe.nextHopUrl('https://sso.aizhs.top/', '/admin/'), 'https://sso.aizhs.top/admin/')
  assert.equal(probe.nextHopUrl('https://x.test/a', 'https://www.aizhs.top/sso/login'), 'https://www.aizhs.top/sso/login')
  assert.equal(probe.nextHopUrl('https://x.test/a', ''), null, '缺 Location ⇒ 不猜终点')
  assert.equal(probe.nextHopUrl('https://x.test/a', undefined), null)
  assert.equal(probe.nextHopUrl('https://x.test/a', 'ftp://x.test/b'), null, '非 http(s) 不得跟')
  assert.equal(probe.nextHopUrl('https://x.test/a', 'http://'), null, '不可解析 ⇒ null')
  assert.equal(probe.planLegHop({ status: 200, location: '/x' }, 'https://x.test/a', 0, 3).stop, 'terminal', '2xx 有 Location 也不许多跟')
  assert.equal(probe.planLegHop({ status: 404, location: '/y' }, 'https://x.test/a', 0, 3).follow, false)
  assert.equal(probe.planLegHop({ status: null, location: '/y' }, 'https://x.test/a', 0, 3).follow, false)
  const cap = probe.planLegHop({ status: 302, location: '/y' }, 'https://x.test/a', 3, 3)
  assert.equal(cap.stop, 'cap')
  assert.match(cap.note, /上限 3 跳/)
  const bad = probe.planLegHop({ status: 301 }, 'https://x.test/a', 0, 3)
  assert.equal(bad.stop, 'broken')
  assert.match(bad.note, /Location 缺失/)
  const go = probe.planLegHop({ status: 307, location: '/y' }, 'https://x.test/a', 0, 3)
  assert.equal(go.follow, true)
  assert.equal(go.next, 'https://x.test/y')
  assert.equal(probe.LEG_REDIRECT_MAX_HOPS, 3, '上限本身要钉住:调它必须同时改判据与取证')
})

test('⑲c G-960 逐维三态报数(照 check-tunnel-leg-health 的形态):不并桶 / 合计不等即未判定 / 枚举 0 判死', () => {
  const mix = probe.summarizeLegStates([{ verdict: 'ok' }, { verdict: 'breach' }, { verdict: 'unjudged' }], { state: 'ok', legsExpected: 3 })
  assert.equal(mix.ok, 1)
  assert.equal(mix.breach, 1)
  assert.equal(mix.unjudged, 1)
  assert.equal(mix.total, 3)
  assert.equal(mix.ledgerState, 'ok')
  // 三态各自独立:一条红不得把另一条未判定洗成 0,也不得被"多数绿"顶掉
  const short = probe.summarizeLegStates([{ verdict: 'ok' }], { state: 'ok', legsExpected: 3 })
  assert.match(short.note, /有腿没探到/, '台账 3 条只量到 1 条 ⇒ 必须点名,不得按"1 条全绿"出证')
  const none = probe.summarizeLegStates([], { state: 'ok', legsExpected: 0 })
  assert.match(none.note, /判死/)
  const dead = probe.summarizeLegStates([], { state: 'unjudged', reason: '靶台账读不到:ENOENT', legsExpected: 0 })
  assert.equal(dead.ledgerState, 'unjudged')
  assert.match(dead.note, /不得按"0 个坏点"出合格证/)
  // 形态不认识的一律算未判定(不得默认成 ok —— 那正是本票要消灭的顶绿)
  assert.equal(probe.summarizeLegStates([{ verdict: 'green?' }, {}], { state: 'ok', legsExpected: 2 }).unjudged, 2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
