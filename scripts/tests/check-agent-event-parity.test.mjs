// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D139(尺子①扩面)的镜像测试 —— §22c 口径,但走**真实入口**(spawn 本尊)而非 import:
 * 这道门体量大、顶层有副作用,且判据的牙恰恰要在"真跑一遍"上证明。
 *
 * 三条,每条都防一类失效:
 *   T1 装车/扩面形状锁:门源码必须真含六端目录表与 face-reader 的 catBatch ——
 *      没有它,"扩面"会被一次回写悄悄退回只扫 web,而门照报绿(守门 118 半接线同型)。
 *   T2 自检端到端:--self-test 必须跑完、退出 0、三条 ST 全 ✅。
 *   T3 反向对照:故意断言"六端表里的目录字符串在门源码里逐个出现" —— 少一个(=退回只扫 web)
 *      必须红,否则 T1/T2 只是复读实现。
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const GATE = join(ROOT, 'scripts', 'check-agent-event-parity.mjs')

const END_DIRS = [
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'packages/app/src',
  'apps/extension',
  'apps/desktop',
  'apps/cli/src',
]

// 六端表搬到 lib 之后,装车证明的 grep 目标必须跟着搬到**真相源所在的那一份**,否则一次正当的
// 收口重构就把"判据静默失效"的守卫自己变成了恒红(2026-10-16 实测:T1 缺 apps/desktop、T2 还钉
// "# 自检 3/3 通过"而门体自检已长到 15 条、T3 构造面在门源码里已找不到那串)。
// 分工照门体自己的 ST3:端表住 `lib/agent-event-coverage.mjs`,门本体负责**接线**(import 它)。
const COV_LIB = join(ROOT, 'scripts', 'lib', 'agent-event-coverage.mjs')

// 门体自己的 ST3 里也写了这条 specifier 的字面量,所以判"有没有接线"不能用 `.includes`(会被那句
// 自述字符串命中 ⇒ 摘掉真 import 也不红)。只认**一条 import 声明**的形态。
const COV_IMPORT_RE = /import\s*\{[^{}]*\}\s*from\s*'\.\/lib\/agent-event-coverage\.mjs'/

/** T1 的判据本体(提成函数,T3 才能拿构造面喂它证有牙) */
function parityWiringVerdict({ gateSrc, libSrc }) {
  const missing = []
  if (!/catBatch/.test(gateSrc)) missing.push('门未经 face-reader 的 catBatch 按被审面取材(退回只读磁盘)')
  if (!COV_IMPORT_RE.test(gateSrc))
    missing.push('门没 import 端表所在的那份 lib ⇒ 端表与消费面两处各写一份必漂移')
  if (!/agent-event-end-capability\.json/.test(libSrc))
    missing.push('端表那份 lib 不读端能力档案 ⇒ 已声明帧无放行依据')
  for (const d of END_DIRS) {
    if (!libSrc.includes(d)) missing.push(`端表缺端目录 ${d} —— 消费面被退回部分端时判据静默失效`)
  }
  return missing
}

test('T1 扩面形状锁:门接线 + catBatch 在门源码里,六端目录表在端表唯一出口里(退回只扫 web 必红)', () => {
  const missing = parityWiringVerdict({
    gateSrc: readFileSync(GATE, 'utf8'),
    libSrc: readFileSync(COV_LIB, 'utf8'),
  })
  assert.deepEqual(missing, [], `扩面装车不完整:\n  · ${missing.join('\n  · ')}`)
})

test('T2 自检端到端:--self-test 跑完、退出 0、末行 N/N 通过且 N≥3', () => {
  const r = spawnSync(process.execPath, [GATE, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  })
  assert.equal(r.status, 0, `--self-test 应退出 0,实得 ${r.status}\nstdout 尾:${(r.stdout || '').slice(-600)}`)
  // 不钉条数:自检从 3 条长到 15 条是正当演进(§0.1 凡数字现读)。要保的是"全绿 + 末行自述 + 三条
  // 原始 ST 都还在",而末行那个 N/N 必须等值 —— 它同时挡住"崩在第 4 条却被读成通过"那一型。
  const m = /# 自检 (\d+)\/(\d+) 通过/.exec(r.stdout || '')
  assert.ok(m, `末行找不到「# 自检 N/N 通过」:\n${(r.stdout || '').slice(-400)}`)
  assert.equal(m[1], m[2], `末行通过数与总数不等(${m[1]}/${m[2]})⇒ 自述与实况不符`)
  assert.ok(Number(m[2]) >= 3, `自检条数掉到 ${m[2]}(<3)⇒ 有臂被删了,不是"变简洁"`)
  for (const st of ['ST1', 'ST2', 'ST3']) {
    assert.match(r.stdout || '', new RegExp(`✅ ${st}`), `自检缺少 ${st} 的通过行`)
  }
})

test('T3 反向对照:摘掉接线 / 剥掉一个端目录 / 改掉末行,T1·T2 就必须红(证明它们有牙)', () => {
  const gateSrc = readFileSync(GATE, 'utf8')
  const libSrc = readFileSync(COV_LIB, 'utf8')
  // ① 端表里剥掉一个端目录 ⇒ T1 同款判据必须点名
  const brokenLib = libSrc.replace('apps/desktop', 'apps/__removed__')
  assert.notEqual(brokenLib, libSrc, '构造面未生效:端表里找不到 apps/desktop')
  assert.ok(
    parityWiringVerdict({ gateSrc, libSrc: brokenLib }).some((x) => x.includes('apps/desktop')),
    '剥掉一个端目录后 T1 判据仍不红 ⇒ 这把尺是恒绿的装饰',
  )
  // ② 门不再 import 端表那份 lib ⇒ 同一条判据必须点名(单源被绕开就是两处各写一遍)
  //    必须按 import 声明的形态整条摘掉:门体 ST3 里也有那句字面量,只 replace 字符串会留下它,
  //    于是"摘掉接线"的构造面根本没摘掉(2026-10-16 第一次写就是这样假红在反向对照上)。
  const brokenGate = gateSrc.replace(COV_IMPORT_RE, '/* 接线被摘掉的构造面 */')
  assert.notEqual(brokenGate, gateSrc, '构造面未生效:门源码里找不到那条 import 声明')
  assert.ok(
    parityWiringVerdict({ gateSrc: brokenGate, libSrc }).some((x) => x.includes('没 import')),
    '摘掉接线后 T1 判据仍不红 ⇒ 装车证明看不见"绕过唯一出口"',
  )
  // ③ 同款原语用在 T2:末行 N/N 不等时必须判不过
  const fake = '# 自检 14/15 通过\n'
  const mm = /# 自检 (\d+)\/(\d+) 通过/.exec(fake)
  assert.ok(mm && mm[1] !== mm[2], '末行等值锁抓不到"崩在最后一条"⇒ T2 那一半是空转')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
