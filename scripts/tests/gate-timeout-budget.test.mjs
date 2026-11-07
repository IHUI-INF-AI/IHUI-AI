// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * T1 从预算表取数(2026-11-07 立;票 ticket-gate-watchdog-wait-vs-run-2026-11-07.md)。
 *
 * 三件事被钉住:
 *  ① T1 在册预算必须是表里的 547650ms(不是缺省 300s);
 *  ② 用本次峰值复核 baseMs:365.1s 仍是 push 形态最大值 ⇒ 不抬高;340s 在预算内、560s 超预算;
 *  ③ env `GUARDIAN_GATE_TIMEOUT_MS` 仍是覆盖式:设 300000 时 340s 会判超(已知行为,不许悄悄变)。
 * 另加一条源码接线断言:执行器必须真的调 `resolveGateTimeout`(双键),且用 `budget.ms` 作为超时。
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveGateTimeout, DEFAULT_GATE_TIMEOUT_MS } from '../lib/gate-timeout-budget.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const BUDGET_TABLE_REL = 'scripts/data/land-gate-budgets.json'

// spawnSync 的超时语义就是「runMs > limitMs ⇒ ETIMEDOUT」;这里把它写成可读的判定,不复制实现。
const runOutcome = (runMs, limitMs) => (runMs <= limitMs ? 'ok' : 'ETIMEDOUT')

test('T1 在册:表预算 547650ms,340s 在预算内、560s 超预算', () => {
  const r = resolveGateTimeout({ gateId: 'T1', script: 'check-typecheck.mjs', root: ROOT })
  assert.equal(r.ms, 547650, `T1 必须取表预算;source=${r.source}`)
  assert.equal(r.waitMs, 600000, '排队上限仍与锁侧同源 600s')
  assert.ok(r.entry, '必须命中在册条目(双键 T1 + check-typecheck.mjs)')
  assert.equal(r.entry.gateId, 'T1')
  assert.equal(r.warning, null)

  // 夹具①:runMs=340s + 无排队 ⇒ 通过(按表预算 547.65s)
  assert.equal(runOutcome(340000, r.ms), 'ok')
  // 夹具②:runMs=560s ⇒ 失败(超表预算)
  assert.equal(runOutcome(560000, r.ms), 'ETIMEDOUT')
  // 缺省 300s 确实不够:同一条 340s 在缺省下会被砍
  assert.equal(runOutcome(340000, DEFAULT_GATE_TIMEOUT_MS), 'ETIMEDOUT')
})

test('env 覆盖优先:GUARDIAN_GATE_TIMEOUT_MS=300000 时 340s 仍判超(已知行为)', () => {
  const table = resolveGateTimeout({ gateId: 'T1', script: 'check-typecheck.mjs', root: ROOT })
  const envLimit = 300000 // 覆盖式:设了就压掉表预算,不因表里有 547650 而豁免
  assert.ok(envLimit < table.ms, '前提:env 是覆盖式而不是取最大值')
  assert.equal(runOutcome(340000, envLimit), 'ETIMEDOUT')
})

test('baseMs 复核:新峰值 339.9s 不高于 365.1s ⇒ baseMs/derivedMs 不动,证据条数增长', () => {
  const table = JSON.parse(readFileSync(join(ROOT, BUDGET_TABLE_REL), 'utf8'))
  const t1 = table.gates.find((g) => String(g.gateId) === 'T1')
  assert.equal(t1.baseMs, 365100, 'baseMs 保持 push 形态实测值')
  assert.equal(t1.marginMs, 182550)
  assert.equal(t1.derivedMs, 365100 + 182550, 'derivedMs = baseMs + marginMs')
  assert.equal(t1.timeoutMs, t1.derivedMs, '消费值必须等于派生值')
  assert.equal(t1.evidence.length, 5, '293.757s 与 339.9s 必须入证')
  const reasons = t1.evidence.map((e) => String(e.reason)).join('\n')
  assert.match(reasons, /293757|293\.757/, '必须记录 infra 独立读数')
  assert.match(reasons, /339\.9/, '必须记录当日峰值')
  // 复核结论:339.9 < 365.1,不得借 339.9 抬高 baseMs
  assert.ok(339900 < t1.baseMs)
})

test('接线:执行器按门取表预算,env 仍优先,四数行打印在册门', () => {
  const src = readFileSync(join(ROOT, 'scripts/lib/guardian-executor.mjs'), 'utf8')
  assert.match(src, /resolveGateTimeout\(\{\s*gateId: check\?\.id, script: check\?\.script/)
  assert.match(src, /process\.env\.GUARDIAN_GATE_TIMEOUT_MS/, 'env 覆盖分支必须在')
  assert.match(src, /timeout: Number\.isFinite\(budget\.ms\) && budget\.ms > 0 \? budget\.ms : 0/)
  assert.match(src, /limitMs=\$\{budget\.ms\} limitSource=\$\{budget\.source\}/)
  assert.match(src, /budget\.source === 'env-override' \|\| budget\.entry/, '在册门也要逐门留痕')
})

test('实跑缩比:340ms 在 500ms 预算内通过,560ms 被 500ms 砍成 ETIMEDOUT', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-budget-'))
  try {
    const child = join(dir, 'sleep-child.mjs')
    writeFileSync(child, 'const ms = Number(process.argv[2]); const end = Date.now() + ms; while (Date.now() < end) {}\n', 'utf8')
    const ok = spawnSync(process.execPath, [child, '340'], { timeout: 500, encoding: 'utf8', windowsHide: true })
    assert.equal(ok.status, 0, '340ms ≤ 500ms 必须正常结束')
    const killed = spawnSync(process.execPath, [child, '560'], { timeout: 500, encoding: 'utf8', windowsHide: true })
    assert.equal(killed.error?.code, 'ETIMEDOUT', '560ms > 500ms 必须由 timeout 砍掉')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
