// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回归锁:bumpProbeStreak 的 info 面必须携带可解析的 firstAt。
// 立项成因(2026-10-20 现读):派发侧 `const st = bump.info[key]` 用 `st.firstAt` 算"已持续档",
// 而 info 四条分支从未写过该字段 ⇒ Date.parse('')=NaN ⇒ 档恒停在最短档 ⇒ 同身份被 24h 窗
// 无限压住(实测公网劣化 streak=16、慢样本率 50%,只寄出过 1 封)。
// 判据一律 import 源脚本,不在本档复制第二份(§22c)。
import assert from 'node:assert/strict'
import { bumpProbeStreak } from '../git-guardian.mjs'

const KEY = 'B/公网'
const REQUIRED = 2
const MIN_GAP = 30 * 60 * 1000
const TTL = 6 * 60 * 60 * 1000
const T0 = Date.parse('2026-10-20T10:00:00.000Z')

const results = (verdict) => ({ [KEY]: { verdict, numbers: '慢样本率 50%' } })
const finiteAt = (entry, label) => {
  assert.ok(entry, `${label}:info[${KEY}] 缺失`)
  assert.equal(
    Number.isFinite(Date.parse(String(entry.firstAt ?? ''))),
    true,
    `${label}:firstAt 不可解析(值=${JSON.stringify(entry.firstAt)})⇒ 派发侧算出 NaN ⇒ 持续档永不跨档`,
  )
}

const cases = []
const run = (name, fn) =>
  cases.push(
    (() => {
      try {
        fn()
        return `PASS ${name}`
      } catch (e) {
        return `FAIL ${name} —— ${e.message}`
      }
    })(),
  )

// 1 breach 首轮
run('breach 首轮 info 带可解析 firstAt', () => {
  const b = bumpProbeStreak({}, results('breach'), {
    now: T0,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  finiteAt(b.info[KEY], 'breach')
  assert.equal(b.info[KEY].streak, 1, '首轮 streak 应为 1')
})

// 2 跨轮不重置(持续档的分母就是 firstAt)
run('第二轮 firstAt 等于首轮 firstAt(不被重置)', () => {
  const b1 = bumpProbeStreak({}, results('breach'), {
    now: T0,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  const b2 = bumpProbeStreak(b1.state, results('breach'), {
    now: T0 + MIN_GAP + 1000,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  finiteAt(b2.info[KEY], 'breach 第二轮')
  assert.equal(b2.info[KEY].firstAt, b1.info[KEY].firstAt, 'firstAt 被改写 ⇒ 持续时长归零,档永远不升')
  assert.equal(b2.info[KEY].streak, 2)
  assert.equal(b2.info[KEY].due, true, '达门槛应 due')
})

// 3 同窗口重复合并分支也必须带 firstAt
run('merged(同窗口重复测量)分支带 firstAt', () => {
  const b1 = bumpProbeStreak({}, results('breach'), {
    now: T0,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  const b2 = bumpProbeStreak(b1.state, results('breach'), {
    now: T0 + 1000,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  assert.equal(b2.info[KEY].merged, true, '前置:该轮应走 merged 分支')
  finiteAt(b2.info[KEY], 'merged')
})

// 4 unjudged 不得把已有 firstAt 洗掉
run('unjudged 分支保留 firstAt', () => {
  const b1 = bumpProbeStreak({}, results('breach'), {
    now: T0,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  const b2 = bumpProbeStreak(b1.state, results('unjudged'), {
    now: T0 + MIN_GAP + 1000,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  finiteAt(b2.info[KEY], 'unjudged')
  assert.equal(b2.info[KEY].firstAt, b1.info[KEY].firstAt)
})

// 5 反向锁:派发侧真正读的那个表达式必须得到有限数(把 bug 的形状钉在断言里)
run('派发侧 Date.parse(st.firstAt) 为有限数', () => {
  const b = bumpProbeStreak({}, results('breach'), {
    now: T0,
    required: REQUIRED,
    ttlMs: TTL,
    minGapMs: MIN_GAP,
  })
  const st = b.info[KEY] || { streak: 1, required: REQUIRED, due: true }
  assert.ok(Number.isFinite(Date.parse(String(st.firstAt || ''))), '派发侧会算出 NaN')
})

const fails = cases.filter((c) => c.startsWith('FAIL'))
for (const c of cases) console.log('  ' + c)
console.log(`${fails.length === 0 ? '✅' : '❌'} ${cases.length - fails.length}/${cases.length} 例通过`)
process.exit(fails.length === 0 ? 0 : 1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
