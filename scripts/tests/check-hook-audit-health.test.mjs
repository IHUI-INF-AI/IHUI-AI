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

    const rows = []
    for (let i = 0; i < 20; i += 1) rows.push(JSON.stringify({ name: 'h', status: i % 2 ? 'ok' : 'timeout' }))
    const f = path.join(dir, 'fail.jsonl')
    writeFileSync(f, rows.join('\n') + '\n', 'utf8')
    const fr = failRate(readLedger(f).events)
    assert.equal(fr.total, 20)
    assert.equal(fr.failed, 10)
    assert.equal(judge(readLedger(f), cap).state, 'warn')
    // 只错一条不算:单条失败是钩子该有的行为
    const one = path.join(dir, 'one.jsonl')
    writeFileSync(one, '{"name":"h","status":"error"}\n', 'utf8')
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
