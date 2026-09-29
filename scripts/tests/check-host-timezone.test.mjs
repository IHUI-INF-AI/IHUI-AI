// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/check-host-timezone.mjs
//   立门凭据本身(2026-09-04 那次未登记的时区改动)不是夹具能造的,所以这里既有构造面三态对账,
//   也有**取自当次真机现读**的阳性对照 —— 判据必须认得出它立项那一型。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { __test__ as G } from '../check-host-timezone.mjs'

const CFG = {
  expected: { windowsZoneKey: 'China Standard Time', iana: 'Asia/Shanghai', utcOffsetMinutes: 480 },
  changedAt: { utc: '2026-09-29T17:17:29Z' },
  logStampConsumers: { naiveStampDefault: '+08:00' },
}

test('T1 装车证明:门体在 HEAD 面上真的注册了问责入口(package.json 的 check:host-timezone)', () => {
  const pkg = JSON.parse(readFileSync(resolve(G.REPO, 'package.json'), 'utf8'))
  assert.ok(pkg.scripts && /check-host-timezone/.test(pkg.scripts['check:host-timezone'] || ''), 'pnpm check:host-timezone 必须存在,否则门只有代码没有问责入口')
})

test('T2 摘线方向锁:脚本头注声称的定级不得被悄悄升级成 blocking 提交链', () => {
  const src = readFileSync(resolve(G.REPO, 'scripts', 'check-host-timezone.mjs'), 'utf8')
  assert.match(src, /绝不进 blocking 提交链/, '头注必须写明它是机器态 warn 档(§12e:恒红门逼所有人跳门)')
  const runner = readFileSync(resolve(G.REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.ok(!/check-host-timezone/.test(runner), '本门刻意不入提交链;被接进去必须连同"为什么现在能接"的证据一起改这条测试')
})

test('T3 H1 认得出立项那一型(真机 2026-09-04..29 的现读形态)', () => {
  const r = G.judgeH1(CFG, { zoneKey: 'UTC', tzutil: 'UTC' }, 'UTC', 0)
  assert.equal(r.state, 'mismatch')
  assert.match(r.detail.join(' '), /registry=UTC/)
})

test('T4 H1 三条通道全空 ⇒ 未判定,绝不记为通过', () => {
  assert.equal(G.judgeH1(CFG, null, null, null).state, 'undetermined')
})

test('T5 H2 时区被人又改了一次而声明表没跟上 ⇒ drift 且点名发起进程(9-04 缺的就是这个)', () => {
  const r = G.judgeH2(CFG, [{ utc: '2026-10-05T02:00:00Z', proc: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' }])
  assert.equal(r.state, 'drift')
  assert.match(r.culprit, /pwsh\.exe/)
})

test('T6 H2 一条事件都取不到 ⇒ 未判定,不得读成"没人动过时区"(本仓最高频失效型)', () => {
  assert.equal(G.judgeH2(CFG, []).state, 'undetermined')
  assert.equal(G.judgeH2(CFG, null).state, 'undetermined')
})

test('T7 H3 的基准是**注册表偏移**而不是跑判据进程的缓存区 —— 否则拿被检对象当尺子(循环论证)', () => {
  const nowZ = Date.parse('2026-09-29T17:00:00Z')
  assert.equal(G.stampHourGapHours('2026-09-29 17:00:00', nowZ, 0), 0, '声明就是 UTC 时不得谎报 8 小时')
  assert.equal(Math.abs(G.stampHourGapHours('2026-09-29 17:00:00', nowZ, 480)), 8, '声明 +08 而戳是旧缓存 ⇒ 必须量出 8 小时')
  assert.equal(G.stampHourGapHours('2026-09-29 17:00:00', nowZ, null), null, '没有基准就下结论 = 判据失效')
})

test('T8 空闲日志 ⇒ 未判定。"没新行"与"缓存正确"在账面上必须不同形', () => {
  const r = G.judgeH3(resolve(G.REPO, 'scripts'), Date.now() + 40 * 60 * 1000, 480)
  assert.equal(r.state, 'undetermined')
})

test('T9 无偏移日志戳的归属区只能来自声明表;坏形态/缺席 ⇒ null,不得默认 UTC', () => {
  assert.equal(G.naiveStampOffset({ logStampConsumers: { naiveStampDefault: 'UTC' } }), null)
  assert.equal(G.naiveStampOffset({ logStampConsumers: {} }), null)
  assert.equal(G.naiveStampOffset(CFG), '+08:00')
})

test('T10 PowerShell 载荷必须是纯 ASCII + 派生必须带 windowsHide/timeout(§26 码页、§5b 弹窗、守门 80)', () => {
  assert.ok(!/[^\x00-\x7F]/.test(G.PS_QUERY), 'PS_QUERY 里不得出现非 ASCII 字符(中文会被 GBK 码页打断成乱码结论)')
  assert.match(G.PS_QUERY, /FromFileTime/, '前后时刻必须取事件的结构化 Properties,不解析本地化消息文本')
  // windowsHide/timeout 住在派生函数的 options 里,不在载荷里 —— 断错对象就是一条恒假断言。
  const src = readFileSync(resolve(G.REPO, 'scripts', 'check-host-timezone.mjs'), 'utf8')
  assert.match(src, /windowsHide: true/, '派生 PowerShell/node/w32tm 不得弹窗')
  assert.ok(/timeout: 45000/.test(src) && /timeout: 25000/.test(src) && /timeout: 15000/.test(src), '三处派生都必须带 timeout')
})

test('T11 声明表与门体的偏移符号约定必须同形(东八区 = +480,Bias = -480)', () => {
  const cfg = G.readConfig()
  assert.equal(cfg.ok, true, cfg.reason)
  assert.equal(cfg.data.expected.utcOffsetMinutes, 480)
  // PS 侧返回的是 Windows ActiveTimeBias(带反号),runOnce 必须取负后再当基准
  const src = readFileSync(resolve(G.REPO, 'scripts', 'check-host-timezone.mjs'), 'utf8')
  assert.match(src, /-\s*Number\(regBias\)|-\s*regBias/, '丢了这次取负,H3 就会把正确当漂移')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
