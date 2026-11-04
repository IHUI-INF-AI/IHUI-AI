// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/gates-progress-format.mjs` 的镜像测试(§22c:直接 import 源实现,不抄第二份)。
 *
 * 钉三件事:
 *   ① 新行尾部按 `scope` → `runId` → `stderr` 稳定顺序落三个字段,且旧五个字段拼法不变;
 *   ② stderr 里的换行 / 制表符被压成单行(` ⏎ ` / 空格),控制字符删净;
 *   ③ 旧格式行仍能解析,且**标为「未标注」而不是 full** —— 没标注不等于全量口径。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildGateRunId,
  formatGateProgressLine,
  parseGateProgressLine,
  resolveGateProgressScope,
  summarizeGateStderr,
} from '../lib/gates-progress-format.mjs'

const AT = new Date('2026-11-04T00:00:00.000Z')

test('① 新行含 scope/runId/stderr 三字段且顺序稳定,旧五列拼法不变', () => {
  const line = formatGateProgressLine({
    at: AT,
    status: 'fail',
    id: '44',
    elapsedMs: 37,
    script: 'check-root-dir-clean.mjs',
    scope: 'staged',
    runId: '1234-1700000000000',
    stderr: 'boom',
  })
  // 旧前缀逐字不变:ISO / status(5) / id(8) / elapsed(6)ms / script
  const legacyHead = `[${AT.toISOString()}] ${'fail'.padEnd(5)} ${'44'.padEnd(8)} ${'37'.padStart(6)}ms check-root-dir-clean.mjs`
  assert.ok(line.startsWith(legacyHead), `旧前缀被改动:${line}`)
  assert.ok(line.slice(legacyHead.length).startsWith(' scope='), `新字段必须追加在行尾:${line}`)
  const scopeAt = line.indexOf(' scope=')
  const runAt = line.indexOf(' runId=')
  const stderrAt = line.indexOf(' stderr=')
  assert.ok(scopeAt > 0 && runAt > scopeAt && stderrAt > runAt, `新字段顺序不稳定:${line}`)
  assert.ok(line.endsWith(' scope=staged runId=1234-1700000000000 stderr=boom'), `尾部不符合预期:${line}`)

  const parsed = parseGateProgressLine(line)
  assert.equal(parsed.labeled, true)
  assert.equal(parsed.status, 'fail')
  assert.equal(parsed.id, '44')
  assert.equal(parsed.elapsedMs, 37)
  assert.equal(parsed.script, 'check-root-dir-clean.mjs')
  assert.equal(parsed.scope, 'staged')
  assert.equal(parsed.runId, '1234-1700000000000')
  assert.equal(parsed.stderr, 'boom')
})

test('② stderr 含换行/制表符时被压成单行,控制字符删净', () => {
  const raw = '第一行\r\n第二行\t带制表符\u001b[31m红\u0007'
  const summary = summarizeGateStderr(raw)
  assert.ok(!/[\r\n\t\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(summary), `仍有控制字符:${summary}`)
  assert.equal(summary, '第一行 ⏎ 第二行 带制表符[31m红')
  // 超过 200 字符只留前 200
  assert.equal([...summarizeGateStderr('x'.repeat(300))].length, 200)
  assert.equal(summarizeGateStderr(''), '-')
  assert.equal(summarizeGateStderr(undefined), '-')

  const line = formatGateProgressLine({
    at: AT,
    status: 'error',
    id: '7',
    elapsedMs: 5,
    script: 'check-x.mjs',
    scope: 'full',
    runId: '999-1',
    stderr: raw,
  })
  assert.ok(!line.includes('\n') && !line.includes('\t'), '落盘行必须是单行')
  assert.equal(parseGateProgressLine(line).stderr, summary)
})

test('③ 旧格式行仍能被解析,且标为「未标注」而非 full', () => {
  const legacy = `[2026-11-03T07:41:00.000Z] ${'fail'.padEnd(5)} ${'44'.padEnd(8)} ${'1234'.padStart(6)}ms check-root-dir-clean.mjs`
  const parsed = parseGateProgressLine(legacy)
  assert.ok(parsed, '旧行必须仍可解析')
  assert.equal(parsed.labeled, false)
  assert.equal(parsed.scope, 'unlabeled', '旧行不许被当成 full')
  assert.equal(parsed.runId, null)
  assert.equal(parsed.stderr, null)
  assert.equal(parsed.script, 'check-root-dir-clean.mjs')
  assert.equal(parsed.status, 'fail')
})

test('④ 口径只认本次旗标:push > staged > full;runId 形如 <pid>-<启动ms>', () => {
  assert.equal(resolveGateProgressScope({ passStaged: true }), 'staged')
  assert.equal(resolveGateProgressScope({ pushGate: true }), 'push')
  assert.equal(resolveGateProgressScope({ passStaged: true, pushGate: true }), 'push')
  assert.equal(resolveGateProgressScope({}), 'full')
  assert.equal(resolveGateProgressScope({ passStaged: false, pushGate: false }), 'full')
  assert.match(buildGateRunId(4321, 1700000000000), /^4321-1700000000000$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
