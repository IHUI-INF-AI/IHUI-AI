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
  // rmSync 只允许出现在自检夹具一处(清理自己造的临时取证);出现第二处即扩大写删面
  const rmUses = src.split('\n').filter((l) => /\brmSync\s*\(/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  assert.ok(rmUses.length <= 1, `rmSync 至多一处(自检夹具),实为 ${rmUses.length}`)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
