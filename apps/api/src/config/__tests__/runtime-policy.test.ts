// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L06 验收面:整份拒绝、沿用上一份、who/when/why 审计、轮询热加载在 SLA 内生效。
 * 用 tmpdir 真写文件(轮询/审计落盘都是 IO 行为,桩不出来)。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_RUNTIME_POLICY,
  RUNTIME_POLICY_RELOAD_SLA_MS,
  RuntimePolicyStore,
  validateRuntimePolicy,
} from '../runtime-policy.js'

const tmpDirs: string[] = []
function makePolicyFile(content: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-rp-'))
  tmpDirs.push(dir)
  const file = path.join(dir, 'runtime-policy.json')
  if (content !== null) fs.writeFileSync(file, content, 'utf8')
  return file
}

const validDoc = (requestMs = 120_000) =>
  JSON.stringify({
    probe: { intervalMs: 30_000, timeoutMs: 1_500 },
    timeout: { requestMs },
    backgroundLimit: { maxConcurrent: 3 },
    meta: { by: 'ops/zhang', why: '线上慢查询治理' },
  })

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('L06 整份校验', () => {
  it('未知键/非整数/越界/缺段 —— 任一命中整份拒', () => {
    const base = JSON.parse(validDoc())
    for (const mutate of [
      (d: any) => (d.extra = 1),
      (d: any) => (d.probe.extra = 1),
      (d: any) => (d.timeout.requestMs = 1.5),
      (d: any) => (d.timeout.requestMs = 999_999_999),
      (d: any) => (d.backgroundLimit.maxConcurrent = 0),
      (d: any) => delete d.backgroundLimit,
    ]) {
      const doc = JSON.parse(JSON.stringify(base))
      mutate(doc)
      const v = validateRuntimePolicy(doc)
      expect(v.ok).toBe(false)
    }
    expect(validateRuntimePolicy(JSON.parse(validDoc())).ok).toBe(true)
    expect(validateRuntimePolicy(null).ok).toBe(false)
  })
})

describe('L06 热加载', () => {
  it('合法文档应用成功,审计带 by/why;非法文档沿用上一份并记 rejected', () => {
    const file = makePolicyFile(validDoc(120_000))
    const store = new RuntimePolicyStore({ filePath: file })
    expect(store.get()).toEqual(DEFAULT_RUNTIME_POLICY)
    store.reloadNow()
    expect(store.get().timeout.requestMs).toBe(120_000)
    expect(store.get().backgroundLimit.maxConcurrent).toBe(3)
    expect(store.auditTrail().at(-1)).toMatchObject({
      by: 'ops/zhang',
      why: '线上慢查询治理',
      outcome: 'applied',
    })

    fs.writeFileSync(file, validDoc(999_999_999), 'utf8') // 越界 ⇒ 整份拒
    store.reloadNow()
    expect(store.get().timeout.requestMs).toBe(120_000)
    expect(store.auditTrail().at(-1)).toMatchObject({
      outcome: 'rejected',
      reason: 'out-of-range:timeout.requestMs',
    })
    store.stop()
  })

  it('订阅回调在应用时触发', () => {
    const file = makePolicyFile(validDoc(90_000))
    const store = new RuntimePolicyStore({ filePath: file })
    const seen: number[] = []
    store.subscribe((p) => seen.push(p.timeout.requestMs))
    store.reloadNow()
    expect(seen).toEqual([90_000])
    store.stop()
  })

  it('文件后出现也能被轮询加载,且在 SLA 内', async () => {
    const file = makePolicyFile(null)
    const store = new RuntimePolicyStore({ filePath: file })
    store.start()
    expect(store.get()).toEqual(DEFAULT_RUNTIME_POLICY)
    fs.writeFileSync(file, validDoc(45_000), 'utf8')
    const started = Date.now()
    while (Date.now() - started < RUNTIME_POLICY_RELOAD_SLA_MS + 1_000) {
      if (store.get().timeout.requestMs === 45_000) break
      await new Promise((r) => setTimeout(r, 100))
    }
    const elapsed = Date.now() - started
    expect(store.get().timeout.requestMs).toBe(45_000)
    expect(elapsed).toBeLessThanOrEqual(RUNTIME_POLICY_RELOAD_SLA_MS)
    store.stop()
  })

  it('审计逐条追加到 <policy>.audit.jsonl', () => {
    const file = makePolicyFile(validDoc(60_000))
    const store = new RuntimePolicyStore({ filePath: file })
    store.reloadNow()
    fs.writeFileSync(file, '{ broken json', 'utf8')
    store.reloadNow()
    const lines = fs
      .readFileSync(`${file}.audit.jsonl`, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    expect(lines).toHaveLength(2)
    expect(lines[0].outcome).toBe('applied')
    expect(lines[1].reason).toBe('json-parse-failed')
    store.stop()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
