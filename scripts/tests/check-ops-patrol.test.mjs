// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-ops-patrol.mjs` 的装车与定级方向锁。
 * 判据一律 import 源文件导出的 `__test__`,**不在这里重抄一份** —— 抄了就是在复读实现。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const src = (p) => readFileSync(join(REPO, p), 'utf8')
const mod = await import(pathToFileURL(join(REPO, 'scripts', 'check-ops-patrol.mjs')).href)
const { measureDir, ageVerdict, parseLastSync, patrol } = mod.__test__

const REAL_W32TM_LINE = '上次成功同步时间: 2026/9/28 19:52:42'

test('T1 装车:派发点必须真住在守护的两个执行体里(不跑它等于没有调度器)', () => {
  const g = src('scripts/git-guardian.mjs')
  assert.match(g, /export function auditOpsPatrol\(/, '派发函数缺失')
  const calls = [...g.matchAll(/auditOpsPatrol\(\)/g)].length
  assert.equal(calls, 2, `调用点应为 2 处(健康轮 + daemon tick),实测 ${calls} —— 少一处就是某个执行体永不巡检`)
})

test('T2 摘线不得被读成已装车(构造面反向对照,T1 的牙)', () => {
  const g = src('scripts/git-guardian.mjs')
  const onlyOnce = g.replace(/if \(!CHECK_ONLY\) auditOpsPatrol\(\)/, '')
  const calls = [...onlyOnce.matchAll(/auditOpsPatrol\(\)/g)].length
  assert.equal(calls, 1, '摘掉一处调用后必须只剩 1 —— 剩 2 说明 T1 数的是别处文本,不是挂点')
})

test('T3 定级方向锁:本门绝不被接进提交链(判机器状态 ⇒ 恒红 ⇒ 每台每次 --no-verify)', () => {
  for (const f of ['scripts/guardian-runner.mjs', 'scripts/lib/pre-commit-hook.js', '.husky/pre-commit', '.husky/post-commit']) {
    assert.doesNotMatch(src(f), /check-ops-patrol/, `${f} 里出现了本门 ⇒ 定级被改成了提交链档,需先给出"为什么现在能接"的证据`)
  }
})

test('T4 两执行体必须共用同一个节流戳(否则双执行体翻倍发信)', () => {
  const g = src('scripts/git-guardian.mjs')
  const tick = g.match(/const OPS_PATROL_TICK = [^\n]+/)
  assert.ok(tick, '节流戳常量不见了')
  assert.match(tick[0], /ops-patrol-tick/, `节流戳文件名异常:${tick[0]}`)
  assert.equal([...g.matchAll(/OPS_PATROL_TICK\b/g)].length, 2, '常量应"定义一次 + 用作默认值一次";多了说明有第二份戳')
})

test('T5 真实 w32tm 输出必须能解出时刻(夹具逐字取自本机,不得照实现编)', () => {
  const at = parseLastSync(REAL_W32TM_LINE)
  assert.equal(at, Date.parse('2026-09-28T19:52:42'), '斜杠日期 + 中文标签这一族必须命中')
  assert.equal(parseLastSync('Last Successful Sync Time:2026/9/29 3:37:00 AM'), Date.parse('2026-09-29T03:37:00'), '英文标签同样必须命中(换系统语言不该让这一维失明)')
  assert.equal(parseLastSync('上次成功同步时间: 未知'), null, '有标签但日期认不出 ⇒ 未判定,不是猜一个')
})

test('T6 三态不并桶:量不到不得被写成通过,也不得写成红', () => {
  assert.equal(ageVerdict(NaN, 10), 'undetermined')
  assert.equal(ageVerdict(0, 10), 'ok')
  assert.equal(ageVerdict(11 * 60_000, 10), 'finding')
})

test('T7 盒形量算必须既能读到、又不穿重解析点(只测一边等于没测)', () => {
  const inRepo = measureDir(join(REPO, 'scripts/lib'))
  assert.ok(inRepo && inRepo.entries > 0 && !inRepo.truncated, '真实目录量不到 ⇒ 这一维在伪装成"没问题"')
})

test('T8 巡检整体可跑且返回三档计数(端到端,零写盘:不带 --apply)', async () => {
  const r = await patrol({})
  assert.ok(r.counts, '没有 counts 就是结论没成形')
  assert.equal(typeof r.rc, 'number')
  assert.ok(
    r.findings.every((x) => x.state === 'finding') && r.undetermined.every((x) => x.state === 'undetermined'),
    '分档必须按最终状态算 —— 推入时定档会把"修复失败"的条目留在绿档',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
