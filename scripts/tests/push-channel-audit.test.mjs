// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:推送通道巡检腿(auditPushChannel)。
 *
 * 为什么必须有它(2026-10-29 立):这条腿治的是"判据在而零调度"——check-push-sync 早就认得
 * diverged/failed 过期,但只挂在 pre-commit,而本仓旁路落地(object-space-land)不跑钩子,
 * 于是本机 main 与 origin 分叉、推送连续 failed **两天无人喊**。装一条巡检腿而不钉它,
 * 下一格退化成"日志里有行、没人读"照样是静默(§12f:判据失效的表现永远是安静)。
 *
 * §22c:判据全部走生产出口(注入 deps),本文件不复制第二份阈值。
 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { auditPushChannel } from '../git-guardian.mjs'

const results = []
const test = (name, fn) => results.push({ name, fn })

function harness(rc, extra = {}) {
  const root = mkScratch('push-channel')
  const tickFile = join(root, 'state', 'push-channel-last.json')
  const logs = []
  const mails = []
  let calls = 0
  const out = extra.stdout ?? '本地 HEAD: abc1234\norigin   ⚠️  DIVERGED(远端 xyz 与本地分叉)\n收敛结果: origin=DIVERGED'
  const r = auditPushChannel({
    now: Date.parse('2026-10-29T02:00:00.000Z'),
    intervalMs: 10 * 60 * 1000,
    tickFile,
    // 缺席档:给一个不存在的脚本;**在场档必须传 undefined** 才走生产默认值
    // (给 null 会绕开解构默认值,existsSync(null) 当场抛 —— 尺子先坏,结论就成了假红)。
    script: extra.scriptMissing ? join(root, 'nope.mjs') : undefined,
    logger: (s) => logs.push(String(s)),
    notify: (name, detail) => mails.push({ name, detail }),
    runner: () => {
      calls++
      return { status: rc, out, err: extra.stderr ?? '' }
    },
  })
  return { root, tickFile, logs, mails, calls, r }
}

test('P1 rc=0(通道健康)⇒ ok、不喊人、不写行(健康不写行是 §5b 惯例,写了才是噪声)', () => {
  const h = harness(0)
  assert.equal(h.r.state, 'ok')
  assert.equal(h.mails.length, 0, '健康却喊人 = 报警疲劳的成因')
  assert.equal(h.logs.length, 0)
  rmScratch(h.root)
})

test('P2 rc=1(判据当场判阻塞)⇒ blocked、喊人一次、结论原样带出(不复述判据)', () => {
  const h = harness(1)
  assert.equal(h.r.state, 'blocked')
  assert.equal(h.mails.length, 1)
  assert.equal(h.mails[0].name, 'push-channel')
  assert.match(h.mails[0].detail, /git-sync-converge/, '喊人必须给可执行下一步(§5e-1 可整改性)')
  assert.match(h.mails[0].detail, /DIVERGED/, '判据自己的话要原样带出,不在本器重写一遍')
  assert.ok(h.logs.some((l) => l.startsWith('❌')))
  rmScratch(h.root)
})

test('P3 阳性对照:同一 harness 只有 rc 不同 ⇒ 喊人次数必须随之翻(0→1 不是恒喊也不是恒不喊)', () => {
  const h0 = harness(0)
  const h1 = harness(1)
  try {
    assert.equal(h0.mails.length, 0)
    assert.equal(h1.mails.length, 1)
  } finally {
    rmScratch(h0.root)
    rmScratch(h1.root)
  }
})

test('P4 rc=2 / rc=null ⇒ 未判定:只 log、不喊人、绝不记成 ok(§0.3 没判不写成判过)', () => {
  for (const rc of [2, null]) {
    const h = harness(rc, { stdout: '' })
    assert.equal(h.r.state, 'undetermined', `rc=${rc} 必须落未判定`)
    assert.equal(h.mails.length, 0, '未判定不喊人(它不是事实,是量不到)')
    assert.ok(
      h.logs.some((l) => l.includes('未判定')),
      `rc=${rc} 必须在日志里点名未判定,不能安静`,
    )
    rmScratch(h.root)
  }
})

test('P5 节流:窗口内第二次派发不得重复跑判据(每次巡检都 ls-remote 会把热轮刷爆)', () => {
  const root = mkScratch('push-channel')
  const tickFile = join(root, 'state', 'push-channel-last.json')
  mkdirSync(dirname(tickFile), { recursive: true })
  const now = Date.parse('2026-10-29T02:00:00.000Z')
  writeFileSync(tickFile, JSON.stringify({ attemptAt: new Date(now - 60 * 1000).toISOString() }), 'utf8')
  let calls = 0
  const r = auditPushChannel({
    now,
    intervalMs: 10 * 60 * 1000,
    tickFile,
    logger: () => {},
    notify: () => {},
    runner: () => {
      calls++
      return { status: 0, out: '', err: '' }
    },
  })
  assert.equal(r.ran, false)
  assert.equal(calls, 0, '未到窗口却跑了判据 = 节流没生效')
  rmScratch(root)
})

test('P6 先写节流台账再跑判据(配额写在阻塞调用之后 ⇒ 计数恒 0、每轮重犯)', () => {
  const root = mkScratch('push-channel')
  const tickFile = join(root, 'state', 'push-channel-last.json')
  const seen = []
  auditPushChannel({
    now: Date.parse('2026-10-29T02:00:00.000Z'),
    intervalMs: 10 * 60 * 1000,
    tickFile,
    logger: () => {},
    notify: () => {},
    runner: () => {
      // 被调到的那一刻,台账上必须已经有本轮 attemptAt —— 否则崩在中途就白跑一轮
      try {
        seen.push(JSON.parse(readFileSync(tickFile, 'utf8')).attemptAt)
      } catch {
        seen.push(null)
      }
      return { status: 0, out: '', err: '' }
    },
  })
  assert.equal(seen[0], '2026-10-29T02:00:00.000Z')
  rmScratch(root)
})

test('P7 判据缺席 ⇒ 显式点名"本轮跳过,不记为已探测"(器物不在位不能读成健康)', () => {
  const h = harness(0, { scriptMissing: true })
  assert.equal(h.r.ran, false)
  assert.ok(h.logs.some((l) => l.includes('判据不在位')))
  rmScratch(h.root)
})

let failed = 0
for (const { name, fn } of results) {
  try {
    fn()
    console.log(`✅ ${name}`)
  } catch (e) {
    failed++
    console.log(`❌ ${name}\n   ${e && e.message ? e.message : e}`)
  }
}
console.log(`\n${results.length - failed}/${results.length} 通过`)
process.exit(failed === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
