// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-tunnel-leg-health.mjs(§22c —— 判据只在源脚本一份,本文件只 import 使用,不复制)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as kit } from '../check-tunnel-leg-health.mjs'

const NETSH_FIXTURE = [
  '接口 6: 以太网',
  '地址类型   DAD 状态    有效寿命   首选寿命   地址',
  '---------  ----------- ---------- ---------- ------------------------',
  '临时         首选项         2d10h28m5s   22h10m2s 2408:8234:c16:1f44:187:718f:be39:60a3',
  '临时         反对          2d10h28m5s         0s 2408:8234:c16:1f44:284a:8ae6:e432:bb3',
  '公用         首选项         2d10h28m5s 1d10h28m5s 2408:8234:c16:1f44:a941:20e7:542c:6d2b',
  '其他         首选项           infinite   infinite ::1',
  '其他         首选项           infinite   infinite fe80::c531:cfbf:988d:c1f7%6',
].join('\n')

const NETSTAT_FIXTURE = [
  '  TCP    127.0.0.1:20241        0.0.0.0:0              LISTENING       1484',
  '  TCP    127.0.0.1:49192        127.0.0.1:8801         ESTABLISHED     1484',
  '  TCP    [::1]:51730            [::1]:22               ESTABLISHED     1484',
  '  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49167  [2606:4700:a0::6]:7844  ESTABLISHED     1484',
  '  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49175  [2606:4700:a8::10]:7844  ESTABLISHED     1484',
  '  TCP    [2408:8234:c16:1f44:187:718f:be39:60a3]:49177  [2606:4700:a0::1]:7843  ESTABLISHED     1484',
  '  TCP    [2408:8234:c16:1f44:284a:8ae6:e432:bb3]:49178  [2606:4700:a8::9]:7844  ESTABLISHED     9999',
  '  UDP    [::]:54703             *:*                                    1484',
].join('\n')

const HEALTHY = '2408:8234:c16:1f44:187:718f:be39:60a3'
const DEPRECATED = '2408:8234:c16:1f44:284a:8ae6:e432:bb3'
const PUB = '2408:8234:c16:1f44:a941:20e7:542c:6d2b'

function mkLeg(source, sourcePort = 1, destPort = 7844) {
  return { source, sourcePort, dest: '2606:4700:a0::6', destPort }
}

function mkInput(overrides = {}) {
  return {
    processProbe: 'ok',
    pids: ['1484'],
    netshProbe: 'ok',
    netstatProbe: 'ok',
    legs: [mkLeg(HEALTHY, 1)],
    addresses: kit.parseNetshAddresses(NETSH_FIXTURE),
    ...overrides,
  }
}

test('netsh 解析:表头/分隔行/接口行被形态判据拒掉,地址族全收下', () => {
  const m = kit.parseNetshAddresses(NETSH_FIXTURE)
  assert.equal(m.size, 5)
  assert.equal(m.get(DEPRECATED).preferredLifetime, '0s')
  assert.equal(m.get(DEPRECATED).state, '反对')
  assert.equal(m.get(HEALTHY).preferredLifetime, '22h10m2s')
})

test('netsh 解析:zone 后缀被归一(%6 摘掉,与 netstat 侧同键可对账)', () => {
  const m = kit.parseNetshAddresses(NETSH_FIXTURE)
  assert.ok(m.has('fe80::c531:cfbf:988d:c1f7'), '带 %6 的源键必须归一后入账')
})

test('isDeprecatedRecord 正反:0s 或 反对 ⇒ true;首选项/22h/infinite ⇒ false;查无 ⇒ false', () => {
  const m = kit.parseNetshAddresses(NETSH_FIXTURE)
  assert.equal(kit.isDeprecatedRecord(m.get(DEPRECATED)), true)
  assert.equal(kit.isDeprecatedRecord(m.get(HEALTHY)), false)
  assert.equal(kit.isDeprecatedRecord(m.get(PUB)), false)
  assert.equal(kit.isDeprecatedRecord(m.get('::1')), false)
  assert.equal(kit.isDeprecatedRecord(undefined), false)
})

test('netstat 解析:只收本 pid × ESTABLISHED × 远端 7843/7844;方括号剥净', () => {
  const { legs } = kit.parseNetstatLegs(NETSTAT_FIXTURE, ['1484'])
  assert.equal(legs.length, 3)
  assert.equal(legs[0].source, HEALTHY)
  assert.equal(legs[0].destPort, 7844)
  assert.ok(legs.every((l) => !l.source.includes('[') && !l.source.includes(':784')))
})

test('netstat 解析:多 pid 集合同收,无关进程的行不收', () => {
  const { legs } = kit.parseNetstatLegs(NETSTAT_FIXTURE, ['1484', '9999'])
  assert.equal(legs.length, 4)
  assert.equal(legs[3].source, DEPRECATED)
})

test('parseTasklistPids:只认 cloudflared.exe 行的第二列,提示行与其他映像行一律不吃', () => {
  assert.deepEqual(kit.parseTasklistPids(''), [], '空输出 = 进程不在(不是"解析失败")')
  assert.deepEqual(kit.parseTasklistPids('\r\n'), [])
  assert.deepEqual(kit.parseTasklistPids('"cloudflared.exe","1484","Console","1","39,780 K"'), ['1484'])
  assert.deepEqual(
    kit.parseTasklistPids('"notepad.exe","7","Console","1","1,000 K"\n"cloudflared.exe","42","RDP-Tcp#0","2","12,345 K"'),
    ['42'],
    '内存列带千分位逗号 ⇒ 全局抓数字会抓到 7/1/1000 这些无关数(这条就是防那个)',
  )
  assert.deepEqual(kit.parseTasklistPids('INFO: No tasks are running which match the specified criteria.'), [], '提示行不吃')
  assert.deepEqual(kit.parseTasklistPids('"cloudflared.exe","42","Console","1","1 K"\n"cloudflared.exe","42","Console","1","1 K"'), ['42'], '同 pid 重复行去重')
})

test('tasklist 采集失败/被杀 ⇒ 三格 unjudged 并点名 tasklist(不得洗成"没问题",也不得冒红)', () => {
  const d = kit.judge(mkInput({ processProbe: 'failed', pids: [], legs: [] }))
  assert.equal(d['leg-count'].verdict, 'unjudged')
  assert.match(d['leg-count'].reason, /tasklist/, '文案必须指对生产者 —— 上一版写的是 powershell,查错方向会去查解释器而不是取号方式')
})

test('形状锁:采集热路径不得再出现 PowerShell(守护身份下冷启动超时 ⇒ 哨永久未判定)', () => {
  const src = readFileSync(fileURLToPath(new URL('../check-tunnel-leg-health.mjs', import.meta.url)), 'utf8')
  assert.equal(/powershell\.exe|PWSH|Get-Process/.test(src), false, '取 pid 必须走原生命令行工具(tasklist)')
  assert.ok(/tasklist\.exe/.test(src), '必须显式给绝对路径 —— 守护/计划任务身份的 PATH 不可信')
})


test('leg-count 正色:进程在而 0 腿 ⇒ breach(隧道断了)', () => {
  const d = kit.judge(mkInput({ legs: [] }))
  assert.equal(d['leg-count'].verdict, 'breach')
})

test('leg-count 反色:进程不在 ⇒ unjudged(不冒充"0 腿=断流");腿≥1 ⇒ ok', () => {
  const absent = kit.judge(mkInput({ pids: [], legs: [] }))
  assert.equal(absent['leg-count'].verdict, 'unjudged')
  const alive = kit.judge(mkInput({ legs: [mkLeg(HEALTHY)] }))
  assert.equal(alive['leg-count'].verdict, 'ok')
})

test('leg-count:netstat 采集失败 ⇒ unjudged,不记绿也不冒红', () => {
  const d = kit.judge(mkInput({ netstatProbe: 'failed', legs: [] }))
  assert.equal(d['leg-count'].verdict, 'unjudged')
})

test('deprecated-source 正色:在用源地址首选寿命 0s ⇒ breach', () => {
  const d = kit.judge(mkInput({ legs: [mkLeg(DEPRECATED)] }))
  assert.equal(d['deprecated-source'].verdict, 'breach')
  assert.match(d['deprecated-source'].reason, /0s/)
})

test('deprecated-source 反色:在用源地址健康 ⇒ ok', () => {
  const d = kit.judge(mkInput({ legs: [mkLeg(HEALTHY), mkLeg(PUB, 2)] }))
  assert.equal(d['deprecated-source'].verdict, 'ok')
})

test('deprecated-source:腿的源地址查无此条 ⇒ unjudged 并点名该地址', () => {
  const d = kit.judge(mkInput({ legs: [mkLeg('2408:dead::beef')] }))
  assert.equal(d['deprecated-source'].verdict, 'unjudged')
  assert.match(d['deprecated-source'].reason, /2408:dead::beef/)
})

test('deprecated-source:netsh 采集失败 ⇒ unjudged;腿数维各自结账互不顶账', () => {
  const d = kit.judge(mkInput({ netshProbe: 'failed', legs: [mkLeg(HEALTHY)] }))
  assert.equal(d['deprecated-source'].verdict, 'unjudged')
  assert.equal(d['leg-count'].verdict, 'ok')
})

test('single-source-point:健康态 4 腿同源 = warn-only(判红即恒红门,§12e)', () => {
  const legs = [1, 2, 3, 4].map((p) => mkLeg(HEALTHY, p))
  const d = kit.judge(mkInput({ legs }))
  assert.equal(d['single-source-point'].verdict, 'warn')
  assert.equal(d['deprecated-source'].verdict, 'ok')
})

test('single-source-point:多源 ⇒ ok;0 腿 ⇒ unjudged', () => {
  const ok = kit.judge(mkInput({ legs: [mkLeg(HEALTHY, 1), mkLeg(PUB, 2)] }))
  assert.equal(ok['single-source-point'].verdict, 'ok')
  const zero = kit.judge(mkInput({ legs: [] }))
  assert.equal(zero['single-source-point'].verdict, 'unjudged')
})

test('deprecated × 单点同真时,结论点名放大因子(4 腿同断的乘数)', () => {
  const legs = [1, 2, 3, 4].map((p) => mkLeg(DEPRECATED, p))
  const d = kit.judge(mkInput({ legs }))
  assert.equal(d['deprecated-source'].verdict, 'breach')
  assert.match(d['deprecated-source'].reason, /放大因子/)
})

test('退出码映射:breach=1 / 全维未判定=3 / 探测失败=3 / 仅 warn(含 ok)=0', () => {
  const breach = kit.judge(mkInput({ legs: [mkLeg(DEPRECATED)] }))
  assert.equal(kit.decideExit(breach, true), 1)
  const warnOnly = kit.judge(mkInput({ legs: [1, 2].map((p) => mkLeg(HEALTHY, p)) }))
  assert.equal(kit.decideExit(warnOnly, true), 0)
  const probeFail = kit.judge(mkInput({ processProbe: 'failed', pids: [], netshProbe: 'failed', netstatProbe: 'failed', legs: [] }))
  assert.equal(kit.decideExit(probeFail, true), 3)
  assert.equal(kit.decideExit(warnOnly, false), 3, '阳性对照失手必须整轮降 3')
})

test('阳性对照自身:已知坏夹具 ⇒ passed=true 且 leg-count 未被牵连', () => {
  const c = kit.positiveControl()
  assert.equal(c.passed, true)
  assert.equal(c.dims['leg-count'].verdict, 'ok')
})

test('变异自证(形状锁):把 deprecated 夹具的寿命改成健康值,对照必翻红 ⇒ 证明判据真的在消费该字段', () => {
  const badAddresses = new Map([[DEPRECATED, { kind: '临时', state: '反对', validLifetime: '2d', preferredLifetime: '0s' }]])
  const mutated = kit.judge({
    processProbe: 'ok',
    pids: ['1'],
    netshProbe: 'ok',
    netstatProbe: 'ok',
    legs: [mkLeg(DEPRECATED, 1), mkLeg(DEPRECATED, 2)],
    addresses: new Map([[DEPRECATED, { ...badAddresses.get(DEPRECATED), preferredLifetime: '22h10m2s', state: '首选项' }]]),
  })
  assert.equal(mutated['deprecated-source'].verdict, 'ok', '寿命/状态都健康 ⇒ 不再 breach(若摘掉 deprecated 支,此断言仍过 ⇒ 由下一条反钉)')
  const stillBad = kit.judge({
    processProbe: 'ok',
    pids: ['1'],
    netshProbe: 'ok',
    netstatProbe: 'ok',
    legs: [mkLeg(DEPRECATED, 1), mkLeg(DEPRECATED, 2)],
    addresses: badAddresses,
  })
  assert.equal(stillBad['deprecated-source'].verdict, 'breach', '已知坏输入必须被 deprecated 支接住;该支被摘 ⇒ 本断言翻红')
})

test('解析全失败形态:空文本 ⇒ 0 地址 0 腿,judge 落 unjudged 而非 ok', () => {
  const empty = kit.judge(mkInput({ legs: kit.parseNetstatLegs('', ['1484']).legs, addresses: kit.parseNetshAddresses(''), netstatProbe: 'ok' }))
  assert.equal(empty['leg-count'].verdict, 'breach', '进程在而 netstat 有行集为空 ⇒ 断流判红,不是解析失败')
  const netshEmpty = kit.judge(mkInput({ addresses: kit.parseNetshAddresses('') }))
  assert.equal(netshEmpty['deprecated-source'].verdict, 'unjudged', '地址表空 ⇒ 查无 ⇒ 未判定点名')
})

test('REMOTE_TUNNEL_PORTS 事实锁:7843/7844 都在(实测值会漂,两档都认)', () => {
  assert.deepEqual(kit.REMOTE_TUNNEL_PORTS, [7843, 7844])
})

// ───────── 重启账(第四维):事件日志 provider=Cloudflared 的生命周期 ─────────
// 量出来的定档依据:14 天 21 条、全 Level 4;10-15 两次"相隔 21 秒的 starting"= 崩溃循环签名。

const EV = (ms, msg, level = 4) =>
  `<Event xmlns='x'><System><Provider Name='Cloudflared'/><Level>${level}</Level><TimeCreated SystemTime='${new Date(ms).toISOString()}'/></System><EventData><Data>${msg}</Data></EventData></Event>`

test('parseEventLogXml:取 Level/SystemTime/Data 三样;解析不出 ⇒ 空表(交给上层判采集失败)', () => {
  const t0 = Date.parse('2026-10-16T07:43:00.000Z')
  const list = kit.parseEventLogXml(EV(t0, 'Cloudflared service starting') + EV(t0 + 1000, 'cloudflared terminated without error'))
  assert.equal(list.length, 2)
  assert.equal(list[0].level, 4)
  assert.equal(list[0].timeMs, t0)
  assert.equal(list[0].msg, 'Cloudflared service starting')
  assert.deepEqual(kit.parseEventLogXml(''), [], '空输入 = 空表')
  assert.deepEqual(kit.parseEventLogXml('<Event><垃圾>没有 Level 也没有时刻'), [], '残缺记录不吃(不得把读不出说成没有事件)')
})

test('summarizeRestarts:两次 starting 相隔 21 秒 ⇒ doubleStart;正常一停一起 ⇒ 不', () => {
  const t0 = 1_760_000_000_000
  const flap = kit.summarizeRestarts([
    { level: 4, timeMs: t0, msg: 'Cloudflared service starting' },
    { level: 4, timeMs: t0 + 21_000, msg: 'Cloudflared service starting' },
  ])
  assert.equal(flap.doubleStart, true)
  assert.equal(flap.minStartGapMs, 21_000)
  const calm = kit.summarizeRestarts([
    { level: 4, timeMs: t0, msg: 'cloudflared starting graceful shutdown' },
    { level: 4, timeMs: t0 + 1000, msg: 'Cloudflared service stopped' },
    { level: 4, timeMs: t0 + 5000, msg: 'Cloudflared service starting' },
  ])
  assert.equal(calm.doubleStart, false)
  assert.equal(calm.starts, 1)
  assert.equal(calm.stops, 1)
})

test('restart-churn 五向:双启 breach / 非信息级 breach / 4 次 warn / 真 0 ok / 采集失败 unjudged', () => {
  const t0 = 1_760_000_000_000
  const mk = (restarts, eventsProbe = 'ok', nowMs = undefined) => kit.judge(mkInput(nowMs === undefined ? { restarts, eventsProbe } : { restarts, eventsProbe, nowMs }))
  // 双启夹具必须把"此刻"钉在事件之后几秒 —— 否则它量的是"窗口里的历史",落进停抖那一档
  assert.equal(
    mk(kit.summarizeRestarts([{ level: 4, timeMs: t0, msg: 'Cloudflared service starting' }, { level: 4, timeMs: t0 + 21_000, msg: 'Cloudflared service starting' }]), 'ok', t0 + 26_000)['restart-churn'].verdict,
    'breach',
  )
  assert.equal(mk({ total: 3, starts: 1, stops: 1, nonInfo: 1, doubleStart: false })['restart-churn'].verdict, 'breach', '出现 Warning/Error 级事件必须喊')
  assert.equal(mk({ total: 8, starts: 4, stops: 4, nonInfo: 0, doubleStart: false })['restart-churn'].verdict, 'warn', '4 次/24h(基线 0.5)只报数')
  assert.equal(mk({ total: 2, starts: 1, stops: 1, nonInfo: 0, doubleStart: false })['restart-churn'].verdict, 'ok')
  assert.equal(mk(null, 'failed')['restart-churn'].verdict, 'unjudged')
  assert.match(mk(null, 'failed')['restart-churn'].reason, /wevtutil/, '未判定必须点名生产者')
})

// 2026-10-17 现场:02:26:56→02:32:48 崩了 15 轮,02:33:50 起来后再没断过,而 06:33 又寄出一封信。
// 这一族成对夹具钉住的就是"现行犯"与"窗口里的历史"必须分家(机主被这封重复信叫起来过一次)。
test('restart-churn 现行犯与历史分家:停抖满一个 tick ⇒ 只报数;仍在抖 ⇒ breach;时刻取不到 ⇒ 照拦', () => {
  const last = 1_760_667_230_000
  const churn = { total: 65, starts: 15, stops: 15, graceful: 5, nonInfo: 10, minStartGapMs: 4904, lastEventMs: last, doubleStart: true }
  const mk = (restarts, nowMs) => kit.judge(mkInput({ restarts, eventsProbe: 'ok', nowMs }))['restart-churn']
  const stale = mk(churn, last + 8 * 60 * 60 * 1000)
  assert.equal(stale.verdict, 'warn', '停抖 8 小时后不得再判现行犯')
  assert.match(stale.reason, /循环已停抖/, '报数必须写明这是"已停"而不是"没发生"')
  assert.match(stale.reason, /wevtutil/, '报数必须给下一步取证出口(§5e-1:收信人能干什么)')
  assert.equal(mk(churn, last + 2 * 60 * 1000).verdict, 'breach', '2 分钟前还在抖 ⇒ 现行犯')
  // 反向锁:把 lastEventMs 摘掉(= 旧夹具/尺子读不出时刻)必须回到 breach,不得被读成"已停"
  const noStamp = { total: churn.total, starts: churn.starts, stops: churn.stops, graceful: churn.graceful, nonInfo: churn.nonInfo, minStartGapMs: churn.minStartGapMs, doubleStart: churn.doubleStart }
  assert.equal(mk(noStamp, last + 8 * 60 * 60 * 1000).verdict, 'breach', '取不到时刻 ⇒ 按现行论,绝不放行')
})

test('summarizeRestarts:lastEventMs 取全部事件的最大时刻(乱序输入也一样;无时刻 ⇒ null)', () => {
  const t0 = 1_760_000_000_000
  const r = kit.summarizeRestarts([
    { level: 4, timeMs: t0 + 90_000, msg: 'Cloudflared service stopped' },
    { level: 4, timeMs: t0, msg: 'Cloudflared service starting' },
    { level: 4, timeMs: t0 + 45_000, msg: 'Cloudflared service starting' },
  ])
  assert.equal(r.lastEventMs, t0 + 90_000, '最大时刻')
  assert.equal(kit.summarizeRestarts([]).lastEventMs, null, '空表 ⇒ null(不是 0)')
  assert.equal(kit.summarizeRestarts([{ level: 4, timeMs: NaN, msg: 'Cloudflared service starting' }]).lastEventMs, null, '残缺时刻不吃')
})

test('restart-churn 真 0 与"读不出"分家;调用方不采这一路时整维不产出(旧夹具不得被拖成 3)', () => {
  const zero = kit.judge(mkInput({ eventsProbe: 'empty', restarts: { total: 0, starts: 0, stops: 0, nonInfo: 0, doubleStart: false } }))
  assert.equal(zero['restart-churn'].verdict, 'ok')
  assert.match(zero['restart-churn'].reading.note, /真 0/)
  const absent = kit.judge(mkInput({}))
  assert.equal(absent['restart-churn'], undefined, '没采这一路 ⇒ 不产出该维(平白多一格 unjudged 会把退出码拖成 3)')
})

test('形状锁:事件采集只走原生 wevtutil,不得回到 PowerShell(守护身份下冷启动会杀穿超时)', () => {
  const raw = readFileSync(fileURLToPath(new URL('../check-tunnel-leg-health.mjs', import.meta.url)), 'utf8')
  // 锁只判**代码行**:注释里写"为什么不用 Get-WinEvent"是必需的来龙去脉,不该把这条锁绊倒
  // (遮噪方向与守门 118 一致:判代码结构时注释与字符串都要遮,判字面量时才保留字符串)。
  const code = raw
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')
  assert.equal(/Get-WinEvent|powershell\.exe|PWSH/.test(code), false, '取事件必须走原生 wevtutil —— PowerShell 在 LocalSystem 身份下冷启动会杀穿采集超时')
  assert.ok(/wevtutil\.exe/.test(code) && /\/f:XML/.test(code), '必须显式绝对路径 + /f:XML(区域无关;/f:CSV 与 /f:RD 本机实测报"选项 f 的值无效")')
})

// ───────── IPv4 源地址那一路(2026-10-17 立)─────────
// 立案事实:netstat 现读 4 条腿里 1 条的本地地址是 `192.168.1.37`(v4),而尺子只查 ipv6 地址表
// ⇒ deprecated-source 恒 unjudged、退出码恒 3,立项要防的"源地址被删 ⇒ 腿整组断"一轮都判不出来。
// 夹具按本机 netsh 现读形状写(zh-CN=Administrator 身份 / en-US=SYSTEM 身份两档表头),
// 解析一律走源脚本出口(§22c:本文件不复制第二份判据)。

const NETSH_V4_ZH = [
  '',
  '接口 "以太网" 的配置',
  '    DHCP 已启用:                          否',
  '    IP 地址:                           192.168.1.37',
  '    子网前缀:                        192.168.1.0/24 (掩码 255.255.255.0)',
  '    默认网关:                         192.168.1.1',
  '    网关跃点数:                       256',
  '    InterfaceMetric:                      25',
  '',
  '接口 "Loopback Pseudo-Interface 1" 的配置',
  '    DHCP 已启用:                          否',
  '    IP 地址:                           127.0.0.1',
  '    子网前缀:                        127.0.0.0/8 (掩码 255.0.0.0)',
].join('\n')

const NETSH_V4_EN = [
  'Configuration interface Ethernet (Ethernet)',
  '-------------------------------------------------------------------------------',
  '    DHCP enabled:                          No',
  '    IP address:                         192.168.1.37',
  '    Subnet prefix:                192.168.1.0/24 (mask 255.255.255.0)',
  '    Default gateway:                   192.168.1.1',
  '    InterfaceMetric:                      25',
].join('\n')

const V4_IN = '192.168.1.37'
const V4_GONE = '192.168.99.7'

function mkInputV4(overrides = {}) {
  return mkInput({
    netshV4Probe: 'ok',
    v4Addresses: kit.parseNetshV4Addresses(NETSH_V4_ZH),
    legs: [{ source: V4_IN, sourcePort: 50044, dest: '198.41.192.37', destPort: 7844 }],
    ...overrides,
  })
}

test('netsh v4 解析:两档身份表头(zh-CN / en-US)都认;中文表头不吃、子网/网关/跃点/掩码一枚不收', () => {
  const zh = kit.parseNetshV4Addresses(NETSH_V4_ZH)
  const en = kit.parseNetshV4Addresses(NETSH_V4_EN)
  assert.deepEqual([...zh.keys()].sort(), ['127.0.0.1', V4_IN], 'zh 档只收两枚 IP 地址行的地址')
  assert.deepEqual([...en.keys()], [V4_IN], 'en 档同一形状 ⇒ 同一读数')
  assert.equal(zh.has('192.168.1.1'), false, '默认网关是别台机器的地址,不许当成本机在册')
  assert.equal(zh.has('255.255.255.0'), false, '掩码括号里的数字不是地址')
  assert.equal(zh.has('192.168.1.0'), false, '子网前缀不是地址')
  assert.equal(kit.parseNetshV4Addresses('').size, 0, '空文本 ⇒ 0 枚(上层据此落 blind,不判 breach)')
})

test('isIPv4AddressText:八位组越界不当地址(netsh 少见的畸形行不得变成"在册")', () => {
  assert.equal(kit.isIPv4AddressText('192.168.1.37'), true)
  assert.equal(kit.isIPv4AddressText('192.168.1.301'), false)
  assert.equal(kit.isIPv4AddressText('2408:8234::60a3'), false)
})

test('deprecated-source v4 族成对夹具:在册 ⇒ ok;两表皆无且两路采集齐 ⇒ breach', () => {
  const inTable = kit.judge(mkInputV4())
  assert.equal(inTable['deprecated-source'].verdict, 'ok', 'v4 源在 ipv4 表在册 ⇒ 该表无退化字段,在册即健康')
  const gone = kit.judge(mkInputV4({ legs: [{ source: V4_GONE, sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }] }))
  assert.equal(gone['deprecated-source'].verdict, 'breach', '在用 v4 源地址两张表都查不到 ⇒ 腿随时整组断')
  assert.match(gone['deprecated-source'].reason, /两张地址表里都查不到/, 'breach 必须说清依据是"两表皆无"')
  assert.match(gone['deprecated-source'].reason, RegExp(V4_GONE), '必须点名是哪枚地址')
})

test('deprecated-source v4 族:采集缺一路 ⇒ unjudged 点名 netsh ipv4,不得折成 ok/breach', () => {
  for (const probe of ['failed', 'blind', 'absent']) {
    const d = kit.judge(mkInputV4({ netshV4Probe: probe, legs: [{ source: V4_GONE, sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }] }))['deprecated-source']
    assert.equal(d.verdict, 'unjudged', `netshV4Probe=${probe} 必须未判定`)
    assert.match(d.reason, /netsh ipv4/, `netshV4Probe=${probe} 的未判定必须点名 netsh ipv4`)
  }
  const inTableButBlind = kit.judge(mkInputV4({ netshV4Probe: 'blind' }))
  assert.equal(inTableButBlind['deprecated-source'].verdict, 'unjudged', 'ipv4 失明时"在册"也无从可证 ⇒ 不给绿')
  const tablesNotReady = kit.judge(mkInputV4({ netshProbe: 'failed', legs: [{ source: V4_GONE, sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }] }))
  assert.equal(tablesNotReady['deprecated-source'].verdict, 'unjudged', '两表未齐 ⇒ 不许判 breach(没判绝不写成判过)')
})

test('0.0.0.0 这类未指定源地址 ⇒ unjudged,不许被"两表皆无"判成假 breach', () => {
  const d = kit.judge(mkInputV4({ legs: [{ source: '0.0.0.0', sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }] }))
  assert.equal(d['deprecated-source'].verdict, 'unjudged')
  assert.match(d['deprecated-source'].reason, /未指定地址/)
})

test('变异自证:breach 那一例摘掉新增分支(只喂 v6 表)即不成立 ⇒ 新支真的有牙', () => {
  const withV4 = kit.judge(mkInputV4({ legs: [{ source: V4_GONE, sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }] }))
  assert.equal(withV4['deprecated-source'].verdict, 'breach', '两路取材齐 ⇒ breach(新增支被摘则本断言翻红)')
  const v6TableOnly = kit.judge(mkInput({ legs: [{ source: V4_GONE, sourcePort: 1, dest: '198.41.192.37', destPort: 7844 }] }))
  assert.equal(v6TableOnly['deprecated-source'].verdict, 'unjudged', '只喂 v6 表 = 分流前的形态 ⇒ 恒未判定,这正是当初的盲区')
})

test('混合源(v6 腿 + v4 腿)逐地址判、取最坏档、reason 分族点名', () => {
  const mixed = kit.judge(
    mkInputV4({
      legs: [
        { source: HEALTHY, sourcePort: 53221, dest: '2606:4700:a8::7', destPort: 7844 },
        { source: V4_GONE, sourcePort: 50044, dest: '198.41.192.37', destPort: 7844 },
      ],
    }),
  )
  assert.equal(mixed['deprecated-source'].verdict, 'breach', 'v4 已消失 ⇒ 整格最坏档')
  assert.match(mixed['deprecated-source'].reason, /v6族=ok/, 'v6 读数必须单独点名')
  assert.match(mixed['deprecated-source'].reason, /v4族=breach/, 'v4 读数必须单独点名')
  assert.equal(mixed['leg-count'].verdict, 'ok', '两族分判不许牵连腿数维')
})

test('族间不顶账:v6 失明不折成 v4 的绿,v4 失明不折成 v6 的红', () => {
  const v6Blind = kit.judge(
    mkInputV4({
      netshProbe: 'failed',
      addresses: new Map(),
      legs: [
        { source: HEALTHY, sourcePort: 53221, dest: '2606:4700:a8::7', destPort: 7844 },
        { source: V4_IN, sourcePort: 50044, dest: '198.41.192.37', destPort: 7844 },
      ],
    }),
  )['deprecated-source']
  assert.equal(v6Blind.verdict, 'unjudged', 'v6 那一路取不到 ⇒ 整格不得记绿')
  assert.match(v6Blind.reason, /v4族=ok/, 'v4 判到了什么照实写出,不替 v6 顶账')
  const v4Blind = kit.judge(
    mkInputV4({
      netshV4Probe: 'failed',
      legs: [
        { source: DEPRECATED, sourcePort: 53221, dest: '2606:4700:a8::7', destPort: 7844 },
        { source: V4_IN, sourcePort: 50044, dest: '198.41.192.37', destPort: 7844 },
      ],
    }),
  )['deprecated-source']
  assert.equal(v4Blind.verdict, 'breach', 'v6 退化是真 breach,不因 v4 未判定而消音')
  assert.match(v4Blind.reason, /v4族=unjudged/, 'v4 的失明必须一起点名')
})

test('纯 v6 夹具(旧调用方)文案与分流前逐字相同:不许顺手改已有维度', () => {
  const dep = kit.judge(mkInput({ legs: [mkLeg(DEPRECATED, 1), mkLeg(DEPRECATED, 2)] }))
  assert.equal(dep['deprecated-source'].verdict, 'breach')
  assert.match(dep['deprecated-source'].reason, /^在用源地址已退化:.*(首选寿命 0s,状态 反对).*放大因子\)$/, '单族仍走原句式,含放大因子')
  const miss = kit.judge(mkInput({ legs: [mkLeg('2408:dead::beef')] }))
  assert.match(miss['deprecated-source'].reason, /^腿的源地址在 netsh 地址表里查不到,无法判退化:2408:dead::beef$/, '旧 unjudged 句式一字不改')
})

test('阳性对照第二路:v4 支自身必须有牙(breach),且没采 netsh ipv4 时不得冒充 breach', () => {
  const c = kit.positiveControl()
  assert.equal(c.passed, true, '两路对照都命中才算有牙')
  assert.equal(c.v4Dims['deprecated-source'].verdict, 'breach')
  assert.match(c.v4Dims['deprecated-source'].reason, /两张地址表里都查不到/)
})

test('形状锁:v4 取材必须是原生 netsh,采集失败源必须能分别点名 ipv6/ipv4 两路', () => {
  const raw = readFileSync(fileURLToPath(new URL('../check-tunnel-leg-health.mjs', import.meta.url)), 'utf8')
  const code = raw
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')
  assert.ok(/'interface',\s*'ipv4',\s*'show',\s*'addresses'/.test(code), '必须真跑 netsh interface ipv4 show addresses(不是只写判据)')
  assert.ok(/'interface',\s*'ipv6',\s*'show',\s*'addresses'/.test(code), 'ipv6 那一路不许被摘')
  assert.ok(/`netsh ipv4\(/.test(code) && /`netsh ipv6\(/.test(code), '失败源清单必须分族点名,不许两路共用一个名字顶账')
  assert.ok(/netshV4Probe:\s*netshV4Probe|netshV4Probe,/ .test(code), 'collect 必须把 netshV4Probe 交给 judge(取材与判据同一路线)')
})


// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
