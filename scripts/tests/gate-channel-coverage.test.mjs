// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gate-channel-coverage.test.mjs —— DG-14「每门至少一个阻断通道」的镜像测试。
 *
 * 判据单源 = `scripts/lib/gate-channel-coverage.mjs`(check-gate-triggers 第二维也 import 它),
 * 测试只调它的纯函数 + 真仓现读,不复制任何判据、不硬写门名清单。
 *
 * 钉住四件事:
 *   ① 真仓现读:登记表形态合法、存量无通道门全部在基线里(= 零误伤),没有新增无通道门;
 *   ② 自动发现:meta 取登记表、push 取 pushGateChecks 段、required CI 取 requiredCiJobs 块;
 *   ③ 新增门可发现:注入一条未登记的 check-* 门 ⇒ 必落进 newUncovered(差额恰好一门);
 *   ④ 失效方向:登记表坏形态 / required job 缺失 / 0 条注册 都必须能被判出来,不得静默绿。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  computeChannelCoverage,
  parseRegisteredScripts,
  parseRequiredCiScripts,
  validateChannelRegistry,
} from '../lib/gate-channel-coverage.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
/** 被判面必须与门一致:HEAD(check-gate-triggers 的缺省面)。多会话共树时工作树副本可能挂着别人未落地的注册表改动。 */
const HEAD = (rel) =>
  execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
const RUNNER_TEXT = HEAD('scripts/guardian-runner.mjs')
const CI_TEXT = HEAD('.github/workflows/ci.yml')
const REGISTRY_RAW = JSON.parse(
  readFileSync(`${ROOT}scripts/data/gate-channel-registry.json`, 'utf8'),
)

const registry = validateChannelRegistry(REGISTRY_RAW)
const parsed = parseRegisteredScripts(RUNNER_TEXT)
const ci = parseRequiredCiScripts(CI_TEXT, registry.requiredCiJobs)
const coverage = computeChannelCoverage({
  registeredScripts: parsed.all,
  pushScripts: parsed.push,
  ciScripts: ci.scripts,
  metaGates: registry.metaGates,
  baseline: registry.baseline,
  missingCiJobs: ci.missingJobs,
})

test('① 真仓现读:登记表合法 ∧ 存量零误伤 ∧ 无新增零通道门', () => {
  assert.deepEqual(registry.problems, [], '登记表形态必须合法')
  assert.ok(
    parsed.all.length > 300,
    `注册表枚举到 ${parsed.all.length} 个 script,过少 ⇒ 取材面可能漂了`,
  )
  assert.deepEqual(
    ci.missingJobs,
    [],
    `required CI job 必须都在 workflow 里:${ci.missingJobs.join(',')}`,
  )
  assert.deepEqual(
    coverage.newUncovered,
    [],
    `存量门不得被通道维误伤(新增无通道门应恰好 0):${coverage.newUncovered.join(', ')}`,
  )
  assert.equal(
    coverage.counts.uncovered,
    coverage.counts.baseline,
    '当前存量无通道门数必须与基线逐条对齐(基线 = 存量快照,不是可随手加的豁免)',
  )
  assert.deepEqual(coverage.staleBaseline, [], '基线里不得有已不在注册表的脚本(腐烂)')
  assert.deepEqual(coverage.staleMeta, [], 'metaGates 里不得有已不在注册表的脚本(腐烂)')
  assert.ok(coverage.counts.meta > 0, '元门档不能为空')
  assert.ok(coverage.counts.push > 0, 'push 通道自动发现到 0 门 ⇒ 解析面漂了')
  assert.ok(coverage.counts.ciRequired > 0, 'required CI 通道自动发现到 0 门 ⇒ 解析面漂了')
})

test('② 通道自动发现:push 段来自 pushGateChecks,CI 段只认 requiredCiJobs', () => {
  assert.equal(parsed.hasPushArray, true, '注册表里必须还能找到 pushGateChecks 段')
  assert.ok(parsed.push.length >= 10, `push 段解析到 ${parsed.push.length} 门,过少`)
  // required 之外的 job(python-ai-service 等)不构成阻断通道
  const nonRequired = parseRequiredCiScripts(CI_TEXT, ['python-ai-service'])
  assert.ok(
    nonRequired.scripts.some((s) => !ci.scripts.includes(s)) ||
      nonRequired.scripts.length === 0 ||
      nonRequired.scripts.every((s) => ci.scripts.includes(s)),
    '非 required job 的解析不得污染 required 通道集合(只允许真子集/空)',
  )
  assert.deepEqual(parseRequiredCiScripts(CI_TEXT, ['no-such-job']).missingJobs, ['no-such-job'])
})

test('③ 新增门可发现:注入未登记门 ⇒ 差额恰好一门', () => {
  const marker = 'const pushGateChecks = ['
  const injected = RUNNER_TEXT.replace(
    marker,
    "const __dg14 = { id: '999', script: 'check-brand-new-gate.mjs' }\n" + marker,
  )
  assert.notEqual(injected, RUNNER_TEXT, '注入锚点不存在 ⇒ 本测试失去意义')
  const p2 = parseRegisteredScripts(injected)
  const c2 = computeChannelCoverage({
    registeredScripts: p2.all,
    pushScripts: p2.push,
    ciScripts: ci.scripts,
    metaGates: registry.metaGates,
    baseline: registry.baseline,
  })
  assert.deepEqual(c2.newUncovered, ['check-brand-new-gate.mjs'], '注入的零通道新门必须被点名')
  // 命中原前缀也不豁免:入档只能靠登记表声明。
  const p3 = parseRegisteredScripts(
    RUNNER_TEXT.replace(
      marker,
      "const __dg14b = { id: '998', script: 'check-plan-new-gate.mjs' }\n" + marker,
    ),
  )
  const c3 = computeChannelCoverage({
    registeredScripts: p3.all,
    pushScripts: p3.push,
    ciScripts: ci.scripts,
    metaGates: registry.metaGates,
    baseline: registry.baseline,
  })
  assert.deepEqual(c3.newUncovered, ['check-plan-new-gate.mjs'], '命名命中原前缀不得替代登记表声明')
})

test('④ 失效方向:坏登记表 / 缺 job / 0 条注册都判得出来', () => {
  assert.equal(validateChannelRegistry({}).ok, false)
  assert.equal(validateChannelRegistry({ version: 1, requiredCiJobs: [], metaGates: {} }).ok, false)
  const duplicated = validateChannelRegistry({
    version: 1,
    requiredCiJobs: ['a'],
    metaGates: { 'check-x.mjs': '' },
    uncoveredBaseline: ['check-a.mjs', 'check-a.mjs'],
  })
  assert.equal(duplicated.ok, false)
  assert.ok(
    duplicated.problems.some((p) => p.includes('理由')),
    '缺理由必须点名',
  )
  assert.ok(
    duplicated.problems.some((p) => p.includes('重复')),
    '基线重复必须点名',
  )

  const empty = computeChannelCoverage({ registeredScripts: [] })
  assert.deepEqual(
    empty.newUncovered,
    [],
    '0 条注册时没有"新增"可判,但 counts.registered = 0 必须如实给出',
  )
  assert.equal(empty.counts.registered, 0)
  assert.deepEqual(empty.staleMeta, [], '空注册面下 staleMeta 由 0 条声明决定,不得凭空冒出门')

  const missingJob = computeChannelCoverage({
    registeredScripts: ['check-x.mjs'],
    missingCiJobs: ['gate-build'],
  })
  assert.deepEqual(missingJob.missingCiJobs, ['gate-build'], 'required job 缺失必须透传,不能被吞')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
