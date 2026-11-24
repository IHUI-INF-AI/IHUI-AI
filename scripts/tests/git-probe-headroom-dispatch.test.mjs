// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * git status 余量哨兵的派发接线锁(2026-11-04 立)。
 *
 * 钉三件事,缺一即红:
 *  D 组 三态分桶不并桶:ok ⇒ 不发信;drift ⇒ 按尺子给的稳定 identity 去重发信;
 *     unjudged ⇒ 只写日志且不记绿;结论取不到 ⇒ judged:false(绝不冒充"已探测到健康")。
 *     节律方向也必须对:判过 ⇒ 满窗口后才复跑,未判定 ⇒ 短冷却后即重试(先写戳后判定会把
 *     "整轮没跑成"记成"刚跑过",哨兵自己变成静默源)。
 *  W 组 调度器真挂在守护的两个执行体里(§0.9 判据"造好没装车"= 没有;计划任务档禁用后
 *     daemon 是唯一执行体 ⇒ 只挂 main() 一次性路径等于永不判)。
 *  X 组 反向锁:这道尺子**不得**被注册进提交链(判的是本机此刻的负载,挂 blocking 就是把
 *     上一席的负载定责给下一席,而下一席补不动 ⇒ §12e 恒红门)。
 * 判据一律 import 被测实现与本尺的 __test__,本文件零复算(§22c)。夹具每例独立 tick 文件。
 */
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { sweepGitProbeHeadroom } from '../git-guardian.mjs'
import { __test__ as kit } from '../check-git-probe-headroom.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TMP = join(ROOT, '.ihui-agent', 'tmp', 'git-probe-headroom-dispatch')
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })

let pass = 0
let fail = 0
const ok = (name, cond, note = '') => {
  if (cond) pass++
  else {
    fail++
    console.log(`  ❌ ${name}${note ? ' :: ' + note : ''}`)
  }
}
const mk = (tag) => ({
  tickFile: join(TMP, tag + '.tick.json'),
  lastFile: join(TMP, tag + '.last.json'),
})
const run = (tag, verdict, extra = {}) => {
  const sent = []
  const logs = []
  const r = sweepGitProbeHeadroom({
    now: Date.parse('2026-11-04T04:00:00.000Z'),
    ...mk(tag),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, opt) => sent.push({ title, body, ...opt }),
    runner: () => ({ status: 0, stdout: JSON.stringify(verdict), stderr: '' }),
    ...extra,
  })
  return { r, sent, logs }
}
const healthy = {
  verdict: 'ok',
  summary: 'breach=0 unjudged=0',
  identity: 'git-probe-headroom:ok:latency=ok:collectors=ok',
  dims: [
    { dim: 'status-latency', state: 'ok' },
    { dim: 'collector-tailers', state: 'ok' },
  ],
  warnMs: 3500,
  budgetMs: 5000,
}
const breach = {
  verdict: 'drift',
  summary: 'breach=1 unjudged=0',
  identity: 'git-probe-headroom:drift:latency=drift:collectors=ok',
  dims: [
    { dim: 'status-latency', state: 'drift', readout: '最大 5104ms', next: '收窄采集面' },
    { dim: 'collector-tailers', state: 'ok' },
    { dim: 'untracked-walk-share', state: 'report', readout: '占 43%' },
  ],
  warnMs: 3500,
  budgetMs: 5000,
}
const unjudge = {
  verdict: 'unjudged',
  summary: 'breach=0 unjudged=1',
  identity: 'git-probe-headroom:unjudged:latency=unjudged:collectors=ok',
  dims: [{ dim: 'status-latency', state: 'unjudged', readout: '取不到' }],
}

// ---- D 组 ----
const d1 = run('d1', healthy)
ok(
  'D1 健康档:派生且不发信,judged:true',
  d1.r.ran === true && d1.r.judged === true && d1.sent.length === 0,
)
const d2 = run('d2', breach)
ok(
  'D2 病害档:发信一次,dedupKey=尺子的稳定身份(不掺时刻/明细)',
  d2.sent.length === 1 && d2.sent[0].dedupKey === breach.identity,
  JSON.stringify(d2.sent[0] || {}),
)
ok(
  'D3 病害正文带"能做什么"(出路逐字来自尺子,不是本测试拼的)',
  d2.sent.length === 1 && d2.sent[0].body.includes('收窄采集面') && d2.sent[0].body.includes('43%'),
)
const d4 = run('d4', unjudge)
ok(
  'D4 未判定:只写日志、不发信、judged:false(不记绿也不冒红)',
  d4.r.ran === true &&
    d4.r.judged === false &&
    d4.sent.length === 0 &&
    d4.logs.some((l) => l.includes('未判定')),
)
const d5 = run('d5', { verdict: 'nonsense' })
ok(
  'D5 结论不可解析:judged:false,绝不冒充"已探测到健康"',
  d5.r.judged === false && d5.r.why === '结论不可解析' && d5.sent.length === 0,
)
// 节律方向:判过 ⇒ 满窗口才复跑。先按健康档落一枚 judged:true 的戳,后两例验的就是"判过之后"
run('d6', healthy)
const d6b = sweepGitProbeHeadroom({
  now: Date.parse('2026-11-04T04:20:00.000Z'),
  ...mk('d6'),
  logger: () => {},
  notify: () => {},
  runner: () => ({ status: 0, stdout: JSON.stringify(healthy), stderr: '' }),
})
ok(
  'D6 判过 ⇒ 20 分钟后仍在 30 分钟窗口内 ⇒ 不重复派生',
  d6b.ran === false && d6b.why === '未到节流窗口',
)
const d6c = sweepGitProbeHeadroom({
  now: Date.parse('2026-11-04T04:35:00.000Z'),
  ...mk('d6'),
  logger: () => {},
  notify: () => {},
  runner: () => ({ status: 0, stdout: JSON.stringify(healthy), stderr: '' }),
})
ok('D7 超 30 分钟 ⇒ 必须真复跑(节律判反了就是永不复查)', d6c.ran === true && d6c.judged === true)
// 未判定 ⇒ 短冷却(10 分钟)后可再试,不能占满 30 分钟
run('d8', unjudge)
const d8b = sweepGitProbeHeadroom({
  now: Date.parse('2026-11-04T04:15:00.000Z'),
  ...mk('d8'),
  logger: () => {},
  notify: () => {},
  runner: () => ({ status: 0, stdout: JSON.stringify(healthy), stderr: '' }),
})
ok(
  'D8 未判定 ⇒ 15 分钟后可重试(把"整轮没跑成"记成"刚跑过"就是静默源)',
  d8b.ran === true && d8b.judged === true,
)
// 变异:同一份 tick,只把 verdict 从 drift 换成 ok ⇒ 发信条数必须从 1 变 0
const d9 = run('d9', healthy)
ok(
  'D9 变异自证:发信只连 verdict,不连夹具形状(ok 档不发)',
  d9.sent.length === 0 && d2.sent.length === 1,
)
ok(
  'D10 状态件真的落盘(drift 那枚可被取证读到)',
  existsSync(join(TMP, 'd2.last.json')) &&
    readFileSync(join(TMP, 'd2.last.json'), 'utf8').includes('status-latency'),
)

// ---- X 组:报警身份稳定性与阈值出处(判据 import 本尺 __test__,零复算) ----
ok(
  'X1 报警线严格低于消费者预算,否则这道尺永远不会先响',
  kit.WARN_MS < kit.BUDGET_MS,
  `${kit.WARN_MS} vs ${kit.BUDGET_MS}`,
)
ok(
  'X2 稳定身份不掺时刻/sha(同状态必同身份)',
  (() => {
    const dims = [
      { dim: 'status-latency', state: 'drift' },
      { dim: 'collector-tailers', state: 'ok' },
    ]
    return (
      kit.alertIdentity(dims) === kit.alertIdentity(dims) && !/\d{8,}/.test(kit.alertIdentity(dims))
    )
  })(),
)
ok(
  'X3 形态尺可分活文件与轮转副本(阈值挂在它上面)',
  kit.LIVE_RE.test('svc-web-nssm-err.log') &&
    !kit.LIVE_RE.test('svc-web-nssm-20261103T004612.300.log') &&
    kit.ROTATION_RE.test('svc-web-nssm-err-20261103T004612.300.log'),
)

// ---- W 组:接线面(§0.4 索引 blob 优先 = 即将入库那面,回落 HEAD,再回落工作树) ----
const showFrom = (ref) => {
  try {
    return execFileSync('git', ['show', `${ref}:scripts/git-guardian.mjs`], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return ''
  }
}
/**
 * 取面按新鲜度择优:索引 ⇒ HEAD ⇒ 工作树,取**第一个真的含有这枚函数**的面。
 * 为什么不照抄"索引优先就完事":并发席会把旧基线暂存着(实测本仓索引面长期落后 HEAD),
 * 那时索引面读不到本枚函数不是本枚没接线,而是别人的陈旧暂存 —— 把它判红就是 §12e
 * "与本次提交内容无关的红"。取到哪个面一律打印,账面可查(§0.4 取不到不回落另一个面的
 * 例外只在这里成立:回落链的每一环都是同一份"即将入库的那一面"的候选)。
 */
const faceCandidates = [
  ['索引', showFrom('')],
  ['HEAD', showFrom('HEAD')],
  [
    '工作树',
    (() => {
      try {
        return readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
      } catch {
        return ''
      }
    })(),
  ],
]
const SYM = 'export function sweepGitProbeHeadroom'
let faceText = ''
let faceName = ''
for (const [n, t] of faceCandidates) {
  if (t && t.includes(SYM)) {
    faceText = t
    faceName = n
    break
  }
}
ok(`W1 派发函数已在 git-guardian 内定义(${faceName || '三个面都没有'} 面现读)`, faceText !== '')
ok(
  'W2 挂点一:main() 单轮链已接(!CHECK_ONLY 档在位)',
  /if \(!CHECK_ONLY\) sweepGitProbeHeadroom\(\)/.test(faceText),
)
ok(
  'W3 挂点二:daemon tick 链也接(计划任务档禁用后 daemon 是唯一执行体)',
  /\n\s{8,}sweepGitProbeHeadroom\(\)/.test(faceText),
)
ok(
  'W4 头注点名的尺子脚本真在位(接线声称对着空气即红)',
  existsSync(join(ROOT, 'scripts', 'check-git-probe-headroom.mjs')),
)
ok(
  'W5 派生带 §12g 三件套:显式 stdio + windowsHide + timeout',
  (() => {
    const i = faceText.indexOf(SYM)
    const body = faceText.slice(i, i + 9000)
    return (
      body.includes("stdio: ['ignore', 'pipe', 'pipe']") &&
      body.includes('windowsHide: true') &&
      body.includes('timeout: GIT_PROBE_TIMEOUT_MS')
    )
  })(),
)
const runnerText = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
ok(
  'X4 反向锁:这道尺子未被注册进提交链(注册即把上一席负载定责给下一席 ⇒ §12e 恒红门)',
  (runnerText.match(/check-git-probe-headroom/g) || []).length === 0,
)

rmSync(TMP, { recursive: true, force: true })
console.log(
  fail === 0
    ? `git-probe-headroom 接线锁: ${pass} 例全绿`
    : `git-probe-headroom 接线锁: ${pass} 绿 / ${fail} 红`,
)
if (fail > 0) process.exitCode = 1
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
