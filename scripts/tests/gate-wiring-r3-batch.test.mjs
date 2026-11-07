// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:R3 should-wire 批「最低风险 5 枚」接线锁(2026-11-04)。
// 立因:门 89 的 R3 只报数不判红 ⇒ 「台账里写了 should-wire」与「runner 里真注册了」之间没有任何机器锁,
// 接线漏一笔、script 名写错、stagedTriggers 指向不存在的路径,都会以「报数仍在」的形态静默通过。
//
// 本测试锁三件事(全部只读,不 spawn 被判门):
//   ① 这 5 枚现在确实在 runner 注册表里,且给定其任一真实触发路径时调度条件为「执行」;
//   ② 未接的 19 枚仍在 R3 台账 should-wire(只报数,不判红),且不与已接 5 枚重叠;
//   ③ 接错路径不得静默变绿:脚本必须真实存在,每条 stagedTriggers 必须命中至少一个 git 跟踪文件,
//      不匹配的路径必须被判「不触及」(跳过要显式,而不是记绿)。
//
// §22c:注册表解析只 import `lib/land-gate-rerun.mjs` 的 parseGateRegistry,触发判定只 import
// `lib/guardian-triggers.mjs`,不在测试里复制第二份判据。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { parseGateRegistry } from '../lib/land-gate-rerun.mjs'
import { isMetaGate } from '../lib/gate-scope.mjs'
import { normalizeTriggers, triggersTouch } from '../lib/guardian-triggers.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const RUNNER = join(ROOT, 'scripts', 'guardian-runner.mjs')
const ALLOWLIST = join(ROOT, 'scripts', 'gate-wiring-allowlist.json')
const GIT = resolveGitBin() || 'git'

/** 本批接线清单(编号/脚本/档位/射程的期望值;改这里必须与 runner 同笔)。 */
const WIRED = [
  {
    id: '293',
    script: 'check-plan-row-length.mjs',
    skipEnv: 'HUSKY_SKIP_PLAN_ROW_LENGTH',
    meta: true,
    triggers: ['PROJECT_PLAN.md', 'scripts/check-plan-row-length.mjs', 'scripts/lib/plan-task-index.mjs'],
  },
  {
    id: '294',
    script: 'check-panel-metric-exists.mjs',
    skipEnv: 'HUSKY_SKIP_PANEL_METRIC_EXISTS',
    meta: false,
    triggers: [
      'monitoring/panel-defs/panels/',
      'deploy/observability/panel-defs/panels/',
      'deploy/saas/panel-defs/panels/',
      'apps/ai-service/app/',
      'apps/api/src/',
      'packages/',
      'monitoring/alertbridge/',
      'scripts/data/panel-external-metrics.json',
      'scripts/check-panel-metric-exists.mjs',
    ],
  },
  {
    id: '295',
    script: 'check-hairline-separator.mjs',
    skipEnv: 'HUSKY_SKIP_HAIRLINE_SEPARATOR',
    meta: false,
    triggers: ['apps/', 'packages/', 'scripts/check-hairline-separator.mjs'],
  },
  {
    id: '296',
    script: 'check-retry-aliases.mjs',
    skipEnv: 'HUSKY_SKIP_RETRY_ALIASES',
    meta: false,
    triggers: [
      'packages/app/src/features/',
      'apps/mobile-rn/src/screens/',
      'apps/web/',
      'apps/miniapp-taro/src/',
      'scripts/check-retry-aliases.mjs',
      'scripts/lib/retry-reload.mjs',
      'scripts/data/retry-reload-baseline.jsonl',
      'scripts/check-cross-end-screen-coverage.mjs',
      'scripts/check-rn-host-shell-coverage.mjs',
    ],
  },
  {
    id: '297',
    script: 'check-permission-lease-bounded.mjs',
    skipEnv: 'HUSKY_SKIP_PERMISSION_LEASE_BOUNDED',
    meta: false,
    triggers: ['apps/cli/src/', 'packages/', 'scripts/check-permission-lease-bounded.mjs'],
  },
]

const registryText = readFileSync(RUNNER, 'utf8')
const registry = parseGateRegistry(registryText)
const allowlist = JSON.parse(readFileSync(ALLOWLIST, 'utf8'))
const tracked = spawnSync(GIT, ['-c', 'safe.directory=*', 'ls-files'], {
  cwd: ROOT,
  encoding: 'utf8',
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
  .stdout.split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
const trackedSet = new Set(tracked)

test('T0 注册表可解析(解析失败时下面所有断言都无意义,先判死)', () => {
  assert.ok(!registry.error, `registry parse error: ${registry.error}`)
  assert.ok(registry.entries.length > 300, `注册表条目数异常: ${registry.entries.length}`)
})

test('T1 五枚都在注册表里:script/mode/skipEnv/射程逐字对上,且脚本文件真实存在', () => {
  const byId = new Map(registry.entries.map((e) => [String(e.id), e]))
  const seenScript = new Map()
  for (const want of WIRED) {
    const got = byId.get(want.id)
    assert.ok(got, `门 ${want.id} 未注册(台账 should-wire 拔掉但 runner 没接 = R3 漏接)`)
    assert.equal(got.script, want.script, `门 ${want.id} 的 script 不符`)
    assert.equal(got.mode, 'blocking', `门 ${want.id} 必须是 blocking(只报数不拦等于没接)`)
    assert.equal(got.skipEnv, want.skipEnv, `门 ${want.id} 的 skipEnv 不符`)
    assert.deepEqual(
      normalizeTriggers(got.stagedTriggers),
      want.triggers,
      `门 ${want.id} 的 stagedTriggers 与接线单不符`,
    )
    // 接错路径的第一种形态:script 指向不存在的文件,门永远跑不起来却仍占着注册表。
    assert.ok(existsSync(join(ROOT, 'scripts', want.script)), `门 ${want.id} 的脚本不存在: scripts/${want.script}`)
    assert.equal(seenScript.get(want.script), undefined, `同一脚本被注册两次: ${want.script}`)
    seenScript.set(want.script, want.id)
  }
})

test('T2 触发路径全部命中真实跟踪文件(接错路径不得静默变绿)', () => {
  for (const want of WIRED) {
    for (const t of want.triggers) {
      const hit = /[*?]/.test(t)
        ? triggersTouch(tracked, [t])
        : [...trackedSet].some((p) => p === t || p.startsWith(t))
      assert.ok(hit, `门 ${want.id} 的触发路径不命中任何跟踪文件: ${t}(typo 会让该门在该类改动上永不被调度)`)
    }
    // 反向锁:不属于射程的路径必须判「不触及」—— 跳过是显式 skip,不能被算作绿。
    assert.equal(
      triggersTouch(['scripts/tests/gate-wiring-r3-batch.test.mjs'], want.triggers),
      false,
      `门 ${want.id} 的射程过宽:本测试自身路径被判触及`,
    )
  }
})

test('T3 元门档事实:只有 293 在元门档(本地 pre-commit 可跑);294-297 只在 CI 或 IHUI_GATE_SCOPE=full', () => {
  const byId = new Map(registry.entries.map((e) => [String(e.id), e]))
  for (const want of WIRED) {
    assert.equal(isMetaGate(byId.get(want.id)), want.meta, `门 ${want.id} 的元门档归属变了 ⇒ 本地可执行性结论必须重写`)
  }
})

test('T4 未接的 19 枚仍在 R3 台账只报数,且不与已接 5 枚重叠', () => {
  const entries = allowlist.r3Register?.entries || []
  const states = entries.reduce((acc, e) => {
    acc[e.state] = (acc[e.state] || 0) + 1
    return acc
  }, {})
  assert.equal(entries.length, 47, `R3 台账条目数应为 47(52 摘 5),实读 ${entries.length}`)
  assert.equal(states['CLI-tool'], 28, 'CLI-tool 读数应保持 28')
  assert.equal(states['should-wire'], 19, `未接的 should-wire 应剩 19 枚,实读 ${states['should-wire']}`)
  assert.equal(states['deprecated'], undefined)
  assert.equal(states['unknown'], undefined)
  const paths = new Set(entries.map((e) => e.path))
  for (const want of WIRED) {
    assert.equal(paths.has(`scripts/${want.script}`), false, `已接线的 scripts/${want.script} 仍留在 R3 台账会变成常驻 stale 报数`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
