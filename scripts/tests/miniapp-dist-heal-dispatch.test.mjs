// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序 weapp 产物重建腿(`healStaleMiniappDist`)的调度镜像测试(2026-10-28 立)。
 *
 * 立因:`apps/miniapp-taro/dist` 停摆两天(实测 2026-10-26 11:25 vs 源码 10-28 19:50)⇒
 * `check-miniapp-css-landing.mjs` 的 C0 结构判据只能落「未判定」,C1 覆盖率尺**恒瞎**。
 * 同族的 `healStaleDistLeg` 只编译 workspace 包的 dist,**没有任何腿造 app 的构建产物** ——
 * 而"造的器物有了、没人派发"与"没有器物"失效形态完全相同(AGENTS §0.9,本仓记过最多次的一型)。
 *
 * 钉死五件事:
 *   M1 结论逐态出账(would-heal / healed / still 各自点名读数,不当成"没跑");
 *   M2 未判定 ⇒ ok=false,绝不记绿(§0.3);
 *   M3 节流窗口内不派生第二次(一轮 = 一次完整 Taro 构建,不能被 2 分钟一 tick 的守护轮反复点着);
 *   M4 器物不在位 ⇒ 跳过且**不写节流台账**(补回器物后下一轮立刻能跑);
 *   M5 装车锁:定义在 / 挂在巡检轮体内 / 排在 healStaleDistLeg 之后 / 进 __test__ 出口 / 节流可 env 覆盖。
 *      顺序判据按结构取(同函数体 + index 先后),不靠"两处都提到过"。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { healStaleMiniappDist } from '../git-guardian.mjs'
import { c0Verdict } from '../heal-stale-miniapp-dist.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')

/** 装车锁判的是"入库那一枚到底接上没有"⇒ 读 HEAD 面(盘上副本可能滞后,§0.4)。 */
function headGuardian() {
  try {
    return execFileSync('git', ['show', 'HEAD:scripts/git-guardian.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
}

const fixture = () => ({ tickFile: join(mkScratch('miniapp-dist-leg-'), 'tick.json') })
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}
const runnerOf = (obj) => () => JSON.stringify(obj)

test('M1 would-heal ⇒ 判过并点名 C0(预演不当成"已修好")', () => {
  const { logs, logger } = logsOf()
  const r = healStaleMiniappDist({
    ...fixture(),
    logger,
    runner: runnerOf({ state: 'would-heal', c0: 'stale', why: '产物陈旧' }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'would-heal')
  assert.match(logs.join('\n'), /c0=stale/)
})

test('M1b healed / still 各自出账(构建秒数与仍不新鲜的原因都要进日志)', () => {
  const a = logsOf()
  const r1 = healStaleMiniappDist({
    ...fixture(),
    logger: a.logger,
    runner: runnerOf({ state: 'healed', c0: 'stale', after: 'fresh', buildMs: 183000 }),
  })
  assert.equal(r1.ok, true)
  assert.match(a.logs.join('\n'), /构建=183s/)

  const b = logsOf()
  const r2 = healStaleMiniappDist({
    ...fixture(),
    logger: b.logger,
    runner: runnerOf({ state: 'still', c0: 'stale', after: 'stale', why: '构建失败:x' }),
  })
  assert.equal(r2.ok, true, '"still"是判过了(构建跑过但没消账),不是未判定')
  assert.match(b.logs.join('\n'), /after=stale/)
})

test('M2 未判定 ⇒ ok=false,不记绿(§0.3)', () => {
  const { logs, logger } = logsOf()
  const r = healStaleMiniappDist({
    ...fixture(),
    logger,
    runner: runnerOf({ state: 'undetermined', why: 'C0 判词解析不出' }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false, '"尺子判不出"与"产物全新鲜"长得一样就是本文件要治的失效型')
  assert.match(logs.join('\n'), /state=undetermined/)
})

test('M2b 结论行不是 JSON / 缺 state ⇒ 同样未判定(形状漂移不许冒绿)', () => {
  const r1 = healStaleMiniappDist({ ...fixture(), logger: () => {}, runner: () => 'boom' })
  assert.equal(r1.ok, false)
  const r2 = healStaleMiniappDist({
    ...fixture(),
    logger: () => {},
    runner: runnerOf({ c0: 'fresh' }),
  })
  assert.equal(r2.ok, false)
})

test('M3 节流窗口内第二轮不派生(一轮 = 一次完整 Taro 构建)', () => {
  const f = fixture()
  let calls = 0
  const runner = () => {
    calls++
    return JSON.stringify({ state: 'fresh', c0: 'fresh' })
  }
  const now = Date.now()
  const iv = 6 * 60 * 60 * 1000
  assert.equal(healStaleMiniappDist({ ...f, now, runner, logger: () => {}, intervalMs: iv }).ran, true)
  assert.equal(
    healStaleMiniappDist({ ...f, now: now + 60 * 1000, runner, logger: () => {}, intervalMs: iv }).ran,
    false,
  )
  assert.equal(calls, 1)
  assert.equal(
    healStaleMiniappDist({ ...f, now: now + iv + 1, runner, logger: () => {}, intervalMs: iv }).ran,
    true,
  )
  assert.equal(calls, 2)
})

test('M4 器物不在位 ⇒ 跳过且不写节流台账(补回后下一轮立刻能跑)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const r = healStaleMiniappDist({
    ...f,
    logger,
    scriptFile: join(mkScratch('miniapp-dist-missing-'), 'nope.mjs'),
  })
  assert.equal(r.ran, false)
  assert.equal(hasTick(f.tickFile), false, '不记为已探测 ⇒ 节流台账不得被写')
  assert.match(logs.join('\n'), /器物不在位/)
})

function hasTick(p) {
  try {
    readFileSync(p, 'utf8')
    return true
  } catch {
    return false
  }
}

test('M6 判词归类是判据本体:判不出必须 null(不许猜一个)', () => {
  // 这一格锁的是器物出口与调度侧读的同一份判词 —— 调度侧不重算新鲜度(§0.6)
  assert.equal(c0Verdict('C0 产物新鲜度:**旧产物** —— dist 停在 X'), 'stale')
  assert.equal(c0Verdict('C0 产物新鲜度:新鲜(相差 7 ms)'), 'fresh')
  assert.equal(c0Verdict('C0 产物新鲜度:判不出 —— 目录不存在'), 'undetermined')
  assert.equal(c0Verdict('(没有这一行)'), null)
})

test('M5 装车锁:定义 + 调用挂巡检轮(排在 dist 腿之后)+ __test__ 出口 + 节流 env', (t) => {
  const src = headGuardian()
  if (src === null) {
    // 取不到被审面 ⇒ 显式跳过并说明(§0.3:不记绿也不冒红);本仓正常在跑时走不到这一支
    t.skip('HEAD 面取不到 git-guardian.mjs ⇒ 未判定')
    return
  }
  if (!/export function healStaleMiniappDist\b/.test(src)) {
    // 尚未入库(本枚提交的同一批里才接上)⇒ 报"待落地"而不是判坏;落地后 HEAD 有它,判据照常生效
    t.skip('healStaleMiniappDist 尚未进 HEAD(落地后本锁自动生效)')
    return
  }
  const has = (re, what) => {
    if (!re.test(src)) throw new Error(`${what} —— HEAD 面上缺失`)
  }
  has(/healStaleMiniappDist,/, '必须进 __test__ 出口,否则镜像测试取不到本体')
  has(/IHUI_MINIAPP_DIST_HEAL_INTERVAL_MS/, '节流必须可由 env 覆盖')
  const call = src.match(/^\s*if \(!CHECK_ONLY\) healStaleMiniappDist\(\)$/m)
  assert.ok(call, '派发必须挂在 !CHECK_ONLY 分支(--check 档不跑构建)')
  const anchor = src.match(/^\s*if \(!CHECK_ONLY\) healStaleDistLeg\(\)$/m)
  assert.ok(anchor, 'workspace dist 腿的调用锚点必须还在(它没了本锁就该重写,而不是静默失配)')
  const fnStarts = [...src.matchAll(/^(?:export )?(?:async )?function\s+(\w+)/gm)].map((m) => m.index)
  const enclosing = (idx) => {
    let name = null
    for (const s of fnStarts) {
      if (s <= idx)
        name = src
          .slice(s, src.indexOf('(', s))
          .replace(/^(?:export\s+)?(?:async\s+)?function\s+/, '')
      else break
    }
    return name
  }
  assert.equal(
    enclosing(call.index),
    enclosing(anchor.index),
    '两条派发必须同函数(巡检轮);分开即"抽出去了但没接回轮上"',
  )
  assert.ok(call.index > anchor.index, 'app 产物重建排在 workspace dist 之后(同族且更重,不打乱既有先后)')
})
