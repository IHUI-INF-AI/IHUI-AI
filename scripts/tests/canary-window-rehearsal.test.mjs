#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/canary-window-rehearsal.mjs` 的镜像测试(§22c:判据 import 源脚本,本文件不复制判据)。
 *
 * 钉的是「这张票为什么能翻勾」的那一格:观察窗的三态判定 + 分流契约,在**真 HTTP 夹具 +
 * 真子进程 CLI** 下能不能出结论。三件事:
 *  ① 演练策略只换地址:窗口/阈值/档位/桶口径必须逐项不变(否则量的就不是同一条判据);
 *  ② 三态端到端:canary 槽位 healthy / 500 / 429 ⇒ canary-verdict 真子进程给出 pass(0) /
 *     fail(3) / unknown(2),档位层给出 advance / rollback / hold;
 *  ③ 分流契约面:0% / 50% / 100% 与非法比例的实切比例(真进程真转发,按响应头计车道)。
 *
 * 测试用**快窗口**(ticks 少、gap 小)换运行时长,但**不动任何阈值**(maxErrorRate /
 * maxP95Ms / minSamples …全部继承真策略)—— 阈值才是判据,窗口只是采样密度。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  startFixture,
  buildRehearsalPolicy,
  sampleWindow,
  decideWindow,
  advanceStage,
  measureSplit,
} from '../canary-window-rehearsal.mjs'

const REAL_POLICY = join(import.meta.dirname, '..', 'data', 'canary-policy.json')

let scratch = null
const scratchFile = (name) => {
  if (!scratch) scratch = mkScratch('canary-rehearsal-')
  return join(scratch, name)
}

test.after(() => {
  if (scratch) {
    try {
      rmScratch(scratch)
    } catch { /* 清理失败由 §26 的每日 Temp 体检兜,不改判据结论 */ }
    scratch = null
  }
})

test('R1 演练策略:只换地址,判据字段逐项不变', () => {
  const raw = readFileSync(REAL_POLICY, 'utf8')
  const built = buildRehearsalPolicy(raw, { stablePort: 18001, canaryPort: 18002 })
  assert.deepEqual(built.same, {
    window: true,
    thresholds: true,
    stages: true,
    bucketGranularity: true,
    bucketSalt: true,
    grayEndpoints: true,
  })
  assert.equal(built.doc.traffic.slots.stable.port, 18001)
  assert.equal(built.doc.traffic.slots.canary.port, 18002)
  const web = built.doc.endpoints.find((e) => e.id === 'web-origin')
  assert.equal(web.url, 'http://127.0.0.1:18001/')
})

test('R2 三态端到端:healthy ⇒ pass/advance;500 ⇒ fail/rollback;429 ⇒ unknown/hold', async () => {
  const stable = await startFixture({ mode: 'ok' })
  const canary = await startFixture({ mode: 'ok' })
  try {
    const built = buildRehearsalPolicy(readFileSync(REAL_POLICY, 'utf8'), {
      stablePort: stable.port,
      canaryPort: canary.port,
    })
    // 快窗口:只压缩采样密度,阈值/档位原样(见头注)。
    const doc = JSON.parse(built.text)
    doc.window = { ticks: 6, gapMs: 10, timeoutMs: 2000 }
    const policyPath = scratchFile('policy.json')
    writeFileSync(policyPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')

    // 灰期策略:web-origin 改指 canary 槽位(与部署环同一条派生逻辑,真 CLI 已由自测覆盖,这里直接复用函数)
    const grayDoc = JSON.parse(JSON.stringify(doc))
    grayDoc.endpoints = grayDoc.endpoints.map((ep) =>
      ep.id === 'web-origin' ? { ...ep, url: `http://127.0.0.1:${canary.port}/` } : ep,
    )
    const grayPath = scratchFile('gray-policy.json')
    writeFileSync(grayPath, `${JSON.stringify(grayDoc, null, 2)}\n`, 'utf8')

    const ledger = scratchFile('deploy-decisions.jsonl')
    const cases = [
      { name: 'pass', mode: 'ok', verdict: 'pass', rc: 0, action: 'advance', current: 'ramp-1' },
      { name: 'fail', mode: 'error', verdict: 'fail', rc: 3, action: 'rollback', current: 'ramp-2' },
      { name: 'unknown', mode: 'throttle', verdict: 'unknown', rc: 2, action: 'hold', current: 'ramp-2' },
    ]
    for (const c of cases) {
      canary.setMode(c.mode)
      const cand = scratchFile(`candidate-${c.name}.jsonl`)
      const s = await sampleWindow({ policyPath: grayPath, stage: 'candidate', outFile: cand })
      assert.equal(s.rc, 0, `${c.name}:采样必须能跑完(夹具真应答)`)
      const d = await decideWindow({ policyPath: grayPath, candidate: cand, ledger, sha: 'rehearsal' })
      assert.equal(d.payload?.verdict, c.verdict, `${c.name}:判定`)
      assert.equal(d.rc, c.rc, `${c.name}:退出码`)
      const st = await advanceStage({
        policyPath,
        verdict: c.verdict,
        current: c.current,
        sha: 'rehearsal',
        contractPath: scratchFile(`ramp-${c.name}.json`),
      })
      assert.equal(st.payload?.action, c.action, `${c.name}:档位动作`)
    }
  } finally {
    await stable.close()
    await canary.close()
  }
})

test('R3 分流契约面:0% / 100% 边界与非法比例 fail-closed', async () => {
  const stable = await startFixture({ mode: 'ok' })
  const canary = await startFixture({ mode: 'ok' })
  const contract = (percent) => {
    const p = scratchFile(`contract-${String(percent).replace(/[^\w-]/g, '_')}-${Math.random().toString(36).slice(2)}.json`)
    writeFileSync(p, `${JSON.stringify({
      v: 1,
      stage: 'test',
      percent,
      routingKeyHeader: 'x-ihui-canary-key',
      tagHeader: 'x-canary-tag',
      bucketGranularity: 10000,
      bucketSalt: 'ihui-deploy-canary',
      slots: { stable: { port: stable.port }, canary: { port: canary.port } },
    }, null, 2)}\n`, 'utf8')
    return p
  }
  try {
    const zero = await measureSplit({ contractPath: contract(0), keys: 120 })
    assert.equal(zero.canary, 0, '0% ⇒ 一枚都不进灰度')
    const full = await measureSplit({ contractPath: contract(100), keys: 120 })
    assert.equal(full.canary, 120, '100% ⇒ 全部进灰度')
    const half = await measureSplit({ contractPath: contract(50), keys: 240 })
    assert.ok(half.canaryShare > 0.35 && half.canaryShare < 0.65, `50% ⇒ 实测 ${(half.canaryShare * 100).toFixed(1)}%`)
    const bad = await measureSplit({ contractPath: contract('abc'), keys: 120, stablePortFallback: stable.port })
    assert.equal(bad.canary, 0, '非法比例 ⇒ 契约判 null ⇒ 不回落到"放量"')
    assert.equal(bad.stable, 120, '非法比例 ⇒ 全部回 stable(200,不是 5xx/挂起)')
  } finally {
    await stable.close()
    await canary.close()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
