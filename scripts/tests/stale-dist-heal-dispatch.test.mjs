// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dist 新鲜度自愈腿(`healStaleDistLeg`)的调度镜像测试(2026-10-27 立)。
 *
 * 立因:消费方按 `exports` 取的是 **dist** 而不是 src,而全仓没有任何一条腿跑
 * `pnpm --filter <pkg> build`(实测 `@ihui/shared` 落后 HEAD 21 项样式常量,且**没有门会红**)。
 * 器物 `heal-stale-dist.mjs` 治的是"谁落后、跑哪条命令";本文件治的是"有没有人按节拍去跑它"
 * —— §0.9 的另一半:器物造好而无人派发,失效形态与没有器物完全相同(安静)。
 *
 * 钉死六件事:
 *   D1 结论逐态出账(clean / built / partial 各自点名读数);
 *   D2 partial ⇒ 仍算"判过了"(ok=true),但把仍落后的包名写进日志(不谎报消账);
 *   D3 结论行解析不出 ⇒ ok=false 未判定,绝不记绿(§0.3);
 *   D4 节流窗口内不派生第二次(build 是分钟级动作,不能被 2 分钟一 tick 的守护轮反复触发);
 *   D5 器物不在位 ⇒ 跳过且**不记为已探测**(不写节流 ⇒ 补回器物后下一轮立刻能跑);
 *   D6 装车锁:定义在 / 调用挂在巡检轮体内(与样式派生腿同函数、且**排在其后**)/ 进 __test__ 出口 /
 *      节流可 env 覆盖 —— 邻接与顺序判据都按结构取,不靠"两处都提到过"。
 *   D7 契约锁:调度器读的 state/targets/healed/still 键,必须真存在于器物自己的返回形状。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { healStaleDistLeg } from '../git-guardian.mjs'
import { __test__ as healer } from '../heal-stale-dist.mjs'
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
  } catch (e) {
    return null
  }
}

const fixture = () => ({ tickFile: join(mkScratch('stale-dist-leg-'), 'tick.json') })
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}
const runnerOf = (obj) => () => JSON.stringify(obj)

test('D1 clean ⇒ 判过且报读数(无落后不等于"没跑")', () => {
  const { logs, logger } = logsOf()
  const r = healStaleDistLeg({
    ...fixture(),
    logger,
    runner: runnerOf({ state: 'clean', targets: [], healed: [], still: [], why: '' }),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'clean')
  assert.match(logs.join('\n'), /state=clean/)
})

test('D2 built ⇒ 已消账进日志', () => {
  const { logs, logger } = logsOf()
  const r = healStaleDistLeg({
    ...fixture(),
    logger,
    runner: runnerOf({
      state: 'built',
      targets: [{ pkg: '@ihui/shared' }],
      healed: ['@ihui/shared'],
      still: [],
      why: '',
    }),
  })
  assert.equal(r.ok, true)
  assert.match(logs.join('\n'), /已消账=1/)
})

test('D2b partial ⇒ 仍算判过,但仍落后的包名必须点名(不许被"已重建"盖掉)', () => {
  const { logs, logger } = logsOf()
  const r = healStaleDistLeg({
    ...fixture(),
    logger,
    runner: runnerOf({
      state: 'partial',
      targets: [{ pkg: '@ihui/x' }],
      healed: [],
      still: ['@ihui/x'],
      why: '1 个包重建后仍落后',
    }),
  })
  assert.equal(r.ok, true)
  assert.equal(r.state, 'partial')
  const line = logs.join('\n')
  assert.match(line, /仍落后=@ihui\/x/)
  assert.match(line, /重建后仍落后/)
})

test('D3 结论取不到 ⇒ 未判定,不记绿(§0.3)', () => {
  const { logs, logger } = logsOf()
  const r = healStaleDistLeg({ ...fixture(), logger, runner: () => 'not json at all' })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false, '"器物坏了"与"dist 全新鲜"长得一样就是本文件要治的失效型')
  assert.match(logs.join('\n'), /未判定/)
})

test('D3b 结论缺 state 键 ⇒ 同样未判定(形状漂移不许冒绿)', () => {
  const r = healStaleDistLeg({ ...fixture(), logger: () => {}, runner: runnerOf({ targets: [] }) })
  assert.equal(r.ok, false)
})

test('D4 节流窗口内第二轮不派生(build 是分钟级,不能被 2 分钟节拍反复点着)', () => {
  const f = fixture()
  let calls = 0
  const runner = () => {
    calls++
    return JSON.stringify({ state: 'clean', targets: [], healed: [], still: [], why: '' })
  }
  const now = Date.now()
  assert.equal(
    healStaleDistLeg({ ...f, now, runner, logger: () => {}, intervalMs: 30 * 60 * 1000 }).ran,
    true,
  )
  assert.equal(
    healStaleDistLeg({
      ...f,
      now: now + 60 * 1000,
      runner,
      logger: () => {},
      intervalMs: 30 * 60 * 1000,
    }).ran,
    false,
  )
  assert.equal(calls, 1)
  assert.equal(
    healStaleDistLeg({
      ...f,
      now: now + 31 * 60 * 1000,
      runner,
      logger: () => {},
      intervalMs: 30 * 60 * 1000,
    }).ran,
    true,
  )
  assert.equal(calls, 2)
})

test('D5 器物不在位 ⇒ 跳过且不写节流台账(补回后下一轮立刻能跑)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const r = healStaleDistLeg({
    ...f,
    logger,
    scriptFile: join(mkScratch('stale-dist-missing-'), 'nope.mjs'),
  })
  assert.equal(r.ran, false)
  assert.equal(existsTick(f.tickFile), false, '不记为已探测 ⇒ 节流台账不得被写')
  assert.match(logs.join('\n'), /器物不在位/)
})

function existsTick(p) {
  try {
    readFileSync(p, 'utf8')
    return true
  } catch {
    return false
  }
}

test('D7 契约锁:调度器读的键必须真存在于器物自己的返回形状(不手抄形状)', () => {
  const shape = healer.healStaleDist({
    apply: true,
    read: () => ({
      ok: true,
      json: {
        verdicts: {
          reds: [{ pkg: '@ihui/shared', fix: 'pnpm --filter @ihui/shared build' }],
          onlyReported: [],
          stockOnly: [],
        },
      },
    }),
    run: () => ({ ok: true, stdout: '' }),
  })
  // 器物第二轮复量走同一 read ⇒ 恒列同一包 ⇒ partial;这里只关心"有哪些键"
  for (const k of ['state', 'targets', 'healed', 'still', 'why']) {
    assert.ok(k in shape, `器物返回里没有 ${k} ⇒ 调度日志读的是空气`)
  }
  assert.equal(shape.state, 'partial', '复量仍列出同一包 ⇒ 必须是 partial,不能记成 built')
  assert.ok(
    Array.isArray(shape.targets) && typeof shape.targets[0].pkg === 'string',
    'targets 必须是带 pkg 的条目',
  )
})

test('D6 装车锁:定义 + 调用挂巡检轮(排在样式派生之后)+ __test__ 出口 + 节流 env', (t) => {
  const src = headGuardian()
  if (src === null) {
    // 取不到被审面 ⇒ 显式跳过并说明(§0.3:不记绿也不冒红);本仓正常在跑时走不到这一支
    t.skip('HEAD 面取不到 git-guardian.mjs ⇒ 未判定')
    return
  }
  if (!/export function healStaleDistLeg\b/.test(src)) {
    // 尚未入库(本枚提交的同一批里才接上)⇒ 报"待落地"而不是判坏;落地后 HEAD 有它,判据照常生效
    t.skip('healStaleDistLeg 尚未进 HEAD(落地后本锁自动生效)')
    return
  }
  const has = (re, what) => {
    if (!re.test(src)) throw new Error(`${what} —— HEAD 面上缺失`)
  }
  has(/healStaleDistLeg,/, '必须进 __test__ 出口,否则镜像测试取不到本体')
  has(/IHUI_DIST_HEAL_INTERVAL_MS/, '节流必须可由 env 覆盖')
  const call = src.match(/^\s*if \(!CHECK_ONLY\) healStaleDistLeg\(\)$/m)
  assert.ok(call, '派发必须挂在 !CHECK_ONLY 分支(--check 档不跑 build)')
  const tokens = src.match(/^\s*if \(!CHECK_ONLY\) healStyleTokensLeg\(\)$/m)
  assert.ok(tokens, '样式派生腿的调用锚点必须还在(它没了本锁就该重写,而不是静默失配)')
  // 邻接 + 顺序:两条必须在同一个函数体内,且 dist 腿排在派生腿之后
  const fnStarts = [...src.matchAll(/^(?:export )?(?:async )?function\s+(\w+)/gm)].map(
    (m) => m.index,
  )
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
    enclosing(tokens.index),
    '两条派发必须同函数(巡检轮);分开即"抽出去了但没接回轮上"',
  )
  assert.ok(call.index > tokens.index, 'dist 重建必须排在样式派生之后(派生写 src,dist 编译 src)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
