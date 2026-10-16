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
  const mk = (restarts, eventsProbe = 'ok') => kit.judge(mkInput({ restarts, eventsProbe }))
  assert.equal(mk(kit.summarizeRestarts([{ level: 4, timeMs: t0, msg: 'Cloudflared service starting' }, { level: 4, timeMs: t0 + 21_000, msg: 'Cloudflared service starting' }]))['restart-churn'].verdict, 'breach')
  assert.equal(mk({ total: 3, starts: 1, stops: 1, nonInfo: 1, doubleStart: false })['restart-churn'].verdict, 'breach', '出现 Warning/Error 级事件必须喊')
  assert.equal(mk({ total: 8, starts: 4, stops: 4, nonInfo: 0, doubleStart: false })['restart-churn'].verdict, 'warn', '4 次/24h(基线 0.5)只报数')
  assert.equal(mk({ total: 2, starts: 1, stops: 1, nonInfo: 0, doubleStart: false })['restart-churn'].verdict, 'ok')
  assert.equal(mk(null, 'failed')['restart-churn'].verdict, 'unjudged')
  assert.match(mk(null, 'failed')['restart-churn'].reason, /wevtutil/, '未判定必须点名生产者')
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

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
