// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-hook-audit-health.mjs` 的镜像测试(§22c 模式:判据 import 源脚本的导出,
 * 本文件零复制判据 —— 另抄一份百分比/阈值,迟早与面板口径漂成"面板说还早、守护说快满")。
 *
 * 钉四件事:
 *   ① 上限常量**从 Python 源头现读**,器物里不许出现硬编码字节字面量(形状锁);
 *   ② 近满档与前端 `HookReadout.nearFullPct` 同档(两处读数不同档 ⇒ 人不再信任何一处);
 *   ③ 三态:absent 不算故障 / 坏行与失败率越线算 warn / 上限取不到算未判定;
 *   ④ 装车证明(§0.9 R4):guardian-runner 里确有本条登记,且是 warn + 不挂 stagedTriggers。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  readCapFromSource,
  resolveLedgerPath,
  readLedger,
  failRate,
  blameHooks,
  judge,
} from '../check-hook-audit-health.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8')

test('①上限从 Python 源头现读,器物里不许有硬编码字节字面量', () => {
  const py = read('apps/ai-service/app/core/hook_audit.py')
  const cap = readCapFromSource(py)
  assert.equal(typeof cap, 'number')
  assert.ok(cap > 0)
  const expr = /HOOK_AUDIT_MAX_BYTES[^\n=]*=\s*(\d+(?:\s*\*\s*\d+)+)/.exec(py)
  assert.ok(expr, 'Python 源头里应能读到常量表达式')
  const expected = expr[1].split('*').map((s) => Number(s.trim())).reduce((a, b) => a * b, 1)
  assert.equal(cap, expected)

  const src = read('scripts/check-hook-audit-health.mjs')
  // 形状锁只看判定层:`selfTest()` 体内的夹具故意用 `5 * 1024 * 1024` 当**期望值**,
  // 那是测试数据不是判据;把它切掉再查,否则这条锁会被自己的夹具判红。
  const judged = src.slice(0, src.indexOf('function selfTest()'))
  assert.ok(!/5242880|\b5\s*\*\s*1024\s*\*\s*1024\b/.test(judged), '器物里出现了硬编码 5MB')
  assert.ok(src.includes('apps/ai-service/app/core/hook_audit.py'), '器物应指名 Python 源头')
})

test('②近满档与前端 nearFullPct 同档(都是 90%)', () => {
  const src = read('scripts/check-hook-audit-health.mjs')
  const m = /const NEAR_FULL_PCT = (\d+)/.exec(src)
  assert.ok(m, '器物应把近满档写成具名常量')
  const web = read('apps/web/src/components/ai/hook-readout.tsx')
  const w = /pct >= (\d+)/.exec(web)
  assert.ok(w, '前端 nearFullPct 应能读到阈值')
  assert.equal(Number(m[1]), Number(w[1]))
})

test('③absent 不算故障;坏行/失败率越线算 warn;上限取不到算未判定', () => {
  const dir = mkScratch('hook-audit-health')
  try {
    const cap = 1024 * 1024
    assert.equal(judge({ state: 'absent' }, cap).state, 'absent')
    assert.equal(judge({ state: 'absent' }, null).state, 'undetermined')

    const ok = path.join(dir, 'ok.jsonl')
    writeFileSync(ok, '{"name":"a","status":"ok"}\n{"name":"b","status":"ok"}\n', 'utf8')
    assert.equal(judge(readLedger(ok), cap).state, 'healthy')

    const bad = path.join(dir, 'bad.jsonl')
    writeFileSync(bad, '{"a":1}\n{broken\n', 'utf8')
    const badVerdict = judge(readLedger(bad), cap)
    assert.equal(badVerdict.state, 'warn')
    assert.ok(/读不出 JSON/.test(badVerdict.reasons.join('')))

    // 真实台账行形:一帧一条,status/durationMs 在 hooks[] 里(顶层没有 status)
    const rows = []
    for (let i = 0; i < 20; i += 1) {
      rows.push(
        JSON.stringify({
          ts: '2026-11-21T00:00:00Z',
          toolName: 'Bash',
          hooks: [{ name: i % 2 ? 'guardian-fast' : 'lint-on-edit', status: i % 2 ? 'ok' : 'timeout', durationMs: 30 }],
        }),
      )
    }
    const f = path.join(dir, 'fail.jsonl')
    writeFileSync(f, rows.join('\n') + '\n', 'utf8')
    const fr = failRate(readLedger(f).events)
    assert.equal(fr.total, 20)
    assert.equal(fr.failed, 10)
    const blamed = blameHooks(readLedger(f).events)
    assert.equal(blamed.length, 1)
    assert.ok(blamed[0].startsWith('lint-on-edit'), '必须点名是哪条钩子,不能只给毫秒数')
    const failVerdict = judge(readLedger(f), cap)
    assert.equal(failVerdict.state, 'warn')
    assert.ok(/失败最多的是 lint-on-edit/.test(failVerdict.reasons.join('')), 'warn 文本必须落钩子名')
    // 只错一条不算:单条失败是钩子该有的行为
    const one = path.join(dir, 'one.jsonl')
    writeFileSync(one, '{"ts":"2026-11-21T00:00:00Z","hooks":[{"name":"h","status":"error"}]}\n', 'utf8')
    assert.equal(judge(readLedger(one), cap).state, 'healthy')

    const near = path.join(dir, 'near.jsonl')
    writeFileSync(near, `{"name":"pad","status":"ok","note":"${'x'.repeat(Math.floor(cap * 0.9))}"}\n`, 'utf8')
    const nearVerdict = judge(readLedger(near), cap)
    assert.equal(nearVerdict.state, 'warn')
    assert.ok(/另存|上限常量/.test(nearVerdict.reasons.join('')), 'warn 必须给可执行下一步')
    assert.equal(resolveLedgerPath({ IHUI_HOOK_AUDIT_PATH: 'D:/a/b.jsonl' }), 'D:/a/b.jsonl')
  } finally {
    rmScratch(dir)
  }
})

test('⑤派发链:git-guardian 的 daemon tick 与 main 单轮都调了它(§0.9 装车)', () => {
  const g = read('scripts/git-guardian.mjs')
  assert.ok(/export function auditHookAuditHealth/.test(g), '巡检函数必须导出')
  const calls = g.match(/\bauditHookAuditHealth\(\)/g) ?? []
  // 两处挂点(daemon tick + main 单轮):少一处则"计划任务档禁用后常驻守护永不判"
  assert.equal(calls.length, 2, `应有两个周期挂点,实际 ${calls.length}`)
  assert.ok(/HOOK_AUDIT_HEALTH_INTERVAL_MS/.test(g), '应带节流窗常量')
  // 只读尺子 ⇒ 不许在函数体里写发信(§5e-1:这类存量读数不进告警通道)
  const fnStart = g.indexOf('export function auditHookAuditHealth')
  const fnBody = g.slice(fnStart, g.indexOf('export function auditCrossEndParityDrift'))
  assert.ok(!/notifyGuardRed/.test(fnBody), '台账健康是开发动作,不该进到人告警通道')
})

test('⑥325 号门同型补齐:临时检出寿命闸也真有周期挂点', () => {
  const g = read('scripts/git-guardian.mjs')
  const calls = g.match(/\bauditTempWorktreeLifetime\(\)/g) ?? []
  assert.equal(calls.length, 2, `应有两个周期挂点,实际 ${calls.length}`)
  assert.ok(/TEMP_WORKTREE_LIFETIME_INTERVAL_MS/.test(g), '应带节流窗常量')
  // 登记处不许再写一句无法核实的"走周期派发":必须点名调度器(§0.8 不写跑不通的出路)
  const runner = read('scripts/guardian-runner.mjs')
  assert.ok(
    !/走 guardian 周期派发\(与 keepalive 一型\)/.test(runner),
    '325 号门的旧自述应改成点名真实调度器',
  )
  assert.ok(/auditTempWorktreeLifetime/.test(runner), '325 号门注释应点名 git-guardian 的调度器')
})

test('⑦第55项:三把尺子收敛到同一个派发器,且各自两个挂点', () => {
  const g = read('scripts/git-guardian.mjs')
  for (const fn of ['auditHookAuditHealth()', 'auditTempWorktreeLifetime()', 'auditMirrorFidelity()']) {
    const n = (g.match(new RegExp(`\\b${fn.replace(/[()]/g, '\\$&')}`, 'g')) ?? []).length
    assert.equal(n, 2, `${fn} 应有两个周期挂点,实际 ${n}`)
  }
  // 单一实现:三个包装器都走 runReadoutGate,不许各自再抄一份派生/节流/三态
  const wrappers = ['auditHookAuditHealth', 'auditTempWorktreeLifetime', 'auditMirrorFidelity']
  for (const w of wrappers) {
    const start = g.indexOf(`export function ${w}(`)
    assert.ok(start > 0, `${w} 必须导出`)
    const body = g.slice(start, g.indexOf('\n}', start))
    assert.ok(/return runReadoutGate\(\{/.test(body), `${w} 必须复用 runReadoutGate`)
  }
  // 尺子自述里的那句「git-guardian 巡检轮派发」现在真有落点
  const mf = read('scripts/check-miniapp-mirror-fidelity.mjs')
  assert.ok(/git-guardian/.test(mf), '该尺子头注仍自述守护派发')
})

test('④装车证明:guardian-runner 登记为 warn、不挂 stagedTriggers', () => {
  const runner = read('scripts/guardian-runner.mjs')
  const at = runner.indexOf("script: 'check-hook-audit-health.mjs'")
  assert.ok(at > 0, 'guardian-runner 未登记本门')
  // 取本条登记块:id 行之后 600 字符的窗口(逐字切 `{…},` 会被 label 里的 `${}` 干扰)
  const block = runner.slice(at, at + 600)
  assert.ok(/mode: 'warn'/.test(block), '量机器存量的门必须 warn(§0.2)')
  // 只认真的属性写法(注释里提到 `stagedTriggers` 是在解释"为什么不设",不是设了)
  assert.ok(!/^\s*stagedTriggers\s*:/m.test(block), '不依赖提交内容 ⇒ 不设 stagedTriggers,走周期派发')
  assert.ok(/HUSKY_SKIP_HOOK_AUDIT_HEALTH/.test(block), '应给应急跳过变量')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
