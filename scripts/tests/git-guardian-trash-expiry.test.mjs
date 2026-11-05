// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:scripts/lib/git-guardian-trash-expiry.mjs(goal-b49 W7 未竟 1 的调度腿)。
 *
 * §22c 纪律:判据函数一律从源脚本 import,本文件不复制任何判定字面量;切片/非注释判据
 * 复用门体 `check-sweeper-liveness.mjs` 的 `__test__` 出口(§0.6 单一真相源)。
 *
 * 钉住五件事:
 *  ① 节流判定:取不到戳 ⇒ 该跑(失效方向恒为「多跑一次」,不是「少跑」);未到窗口 ⇒ 不跑。
 *  ② 结论行三态:pruned / clean / undetermined / retired 各自读得出来;**坏行判未判定**,不记绿。
 *  ③ 接线锁:`sweepTrashExpiry` 必须同时在 git-guardian.mjs 的 main() 单轮链与 daemon 常驻链里
 *     —— 只挂一处 = 计划任务档禁用后该面永久不跑(2026-11-03 实证 27 小时零派发的同一失效型)。
 *  ④ 跨进程边界唯一:端内入口文件真实在位,且调度层引用的 apps 侧路径**只有那一个**(防第二份清单)。
 *  ⑤ 到人通知只认 `gate=retired`:其余各档一律不寄信(§12e 判机器状态的面不占人通道)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { trashExpiryDue, parseTrashPruneReport } from '../lib/git-guardian-trash-expiry.mjs'
import { __test__ as P } from '../check-sweeper-liveness.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '..', '..')
const GUARDIAN_SRC = join(ROOT, 'scripts', 'git-guardian.mjs')
const LEG_SRC = join(ROOT, 'scripts', 'lib', 'git-guardian-trash-expiry.mjs')
const ENTRY_REL = join('apps', 'cli', 'src', 'tools', 'trash-prune-entry.ts')

const DAY = 24 * 60 * 60 * 1000

describe('① 节流判定(取不到戳 ⇒ 该跑;未到窗口 ⇒ 不跑)', () => {
  it('戳读不到 ⇒ 该跑', () => {
    assert.equal(trashExpiryDue(1_000_000, NaN), true)
    assert.equal(trashExpiryDue(1_000_000, undefined), true)
  })
  it('未到 24h 窗口 ⇒ 不跑', () => {
    assert.equal(trashExpiryDue(1_000_000 + DAY - 1, 1_000_000), false)
  })
  it('到 24h 窗口 ⇒ 跑', () => {
    assert.equal(trashExpiryDue(1_000_000 + DAY, 1_000_000), true)
  })
})

describe('② 结论行解析(三态;坏行判未判定,不记绿)', () => {
  it('pruned:读得出计数与字节', () => {
    const p = parseTrashPruneReport(
      'TRASH-PRUNE state=pruned gate=run manifests=2 entries=5 removed=3 failed=0 skipped=0 bytes=4096 overBudget=0 streak=0',
    )
    assert.equal(p.judged, true)
    assert.equal(p.state, 'pruned')
    assert.equal(p.gate, 'run')
    assert.equal(p.removed, 3)
    assert.equal(p.bytes, 4096)
    assert.equal(p.streak, 0)
  })
  it('clean + gate=empty(空账档没有 overBudget/streak 尾巴)', () => {
    const p = parseTrashPruneReport(
      'TRASH-PRUNE state=clean gate=empty manifests=0 entries=0 removed=0 failed=0 skipped=0 bytes=0',
    )
    assert.equal(p.judged, true)
    assert.equal(p.state, 'clean')
    assert.equal(p.gate, 'empty')
    assert.equal(p.streak, null)
  })
  it('undetermined:判不出,且能带上原因行', () => {
    const p = parseTrashPruneReport(
      'TRASH-PRUNE state=undetermined gate=run manifests=1 entries=1 removed=0 failed=0 skipped=1 bytes=0 overBudget=0 streak=1\n' +
        'TRASH-PRUNE-SKIP reason=清单形态不合法',
    )
    assert.equal(p.judged, true)
    assert.equal(p.state, 'undetermined')
    assert.equal(p.reason, '清单形态不合法')
  })
  it('retired:退休档必须读得出(那是唯一到人通知的一档)', () => {
    const p = parseTrashPruneReport(
      'TRASH-PRUNE state=clean gate=retired manifests=1 entries=1 removed=0 failed=0 skipped=0 bytes=0 overBudget=0 streak=8',
    )
    assert.equal(p.judged, true)
    assert.equal(p.gate, 'retired')
    assert.equal(p.streak, 8)
  })
  it('坏行 ⇒ 未判定(不得折成「零回收」当判过)', () => {
    for (const bad of [
      '',
      '崩了',
      'TRASH-PRUNE state=weird gate=run',
      'TRASH-PRUNE-FAIL reason=x',
    ]) {
      assert.equal(parseTrashPruneReport(bad).judged, false, `坏行被读成判过了:${bad}`)
    }
  })
})

describe('③ 接线锁:main() 与 daemon 常驻链必须双在', () => {
  const src = readFileSync(GUARDIAN_SRC, 'utf8')
  it('tick 体里有实调用', () => {
    const body = P.tickBodyOf(src)
    assert.notEqual(body, '', '判不出 tick 体 ⇒ 本锁失效,按判红处理')
    assert.equal(
      P.hasLiveCall(body, 'sweepTrashExpiry'),
      true,
      'daemon 常驻链缺 sweepTrashExpiry ⇒ 该面永久不跑',
    )
  })
  it('main() 体里有实调用', () => {
    const main = P.mainBodyOf(src)
    assert.notEqual(main, '', '判不出 main 体 ⇒ 本锁失效,按判红处理')
    assert.equal(P.hasLiveCall(main, 'sweepTrashExpiry'), true, 'main() 单轮链缺 sweepTrashExpiry')
  })
  it('反证:注释里出现调用名不算接线(恒真即等于没锁)', () => {
    const commented = [
      'function startDaemon() {',
      '  const tick = () => {',
      '    // sweepTrashExpiry()',
      '  }',
      '}',
    ].join('\n')
    assert.equal(P.hasLiveCall(P.tickBodyOf(commented), 'sweepTrashExpiry'), false)
  })
})

describe('④ 跨进程边界唯一', () => {
  it('端内入口文件真实在位', () => {
    assert.equal(existsSync(join(ROOT, ENTRY_REL)), true, `端内入口不在位:${ENTRY_REL}`)
  })
  it('调度层引用的 apps 侧路径只有那一个(不得出现第二份清单)', () => {
    const leg = readFileSync(LEG_SRC, 'utf8')
    const refs = [...leg.matchAll(/join\('apps',\s*'cli',\s*'src',\s*'tools',\s*'[^']+'\)/g)].map(
      (m) => m[0],
    )
    assert.equal(
      refs.length,
      1,
      `端内入口引用了 ${refs.length} 处 ⇒ 第二份清单必然漂移(§0.6):${refs.join(' | ')}`,
    )
  })
})

describe('⑤ 到人通知只认 retired 那一档', () => {
  const leg = readFileSync(LEG_SRC, 'utf8')
  it('通知门条件锁在 gate === retired 上', () => {
    assert.match(leg, /p\.gate === 'retired'/, '通知条件必须锁在 retired 档上')
  })
  it('通知正文必须答得出「红了收信人能做什么」(§5e-1)', () => {
    assert.match(leg, /可整改路径/, '通知正文缺可整改路径 ⇒ 违反 §5e-1')
    assert.match(leg, /不要求收信人删任何文件/, '通知正文缺「删除类动作不推回用户」的声明(§5e-2)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
