#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-web-rn-gap-ratchet.mjs 的判据镜像测试(P0-2,4 条)。
 * §22c:直接 import 源 `__test__`;覆盖口径不在此重算,只喂合成读数验证「退化必红」。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-web-rn-gap-ratchet.mjs')
const { __test__ } = await import(pathToFileURL(SCRIPT).href)
const { judgeRatchet, serializeBaseline, writeBaselineIfChanged, PREFIX_HITS_CAP } = __test__

const green = {
  unmapped: 0,
  judgedGap: 0,
  prefixHits: PREFIX_HITS_CAP,
  prefixExpired: 0,
  alignedRows: [{ web: 'pages/a', data: { kind: 'direct' } }],
}

test('全绿:五项读数都在闸内 ⇒ ok', () => {
  const v = judgeRatchet(green, { prefixCap: PREFIX_HITS_CAP })
  assert.equal(v.ok, true)
  assert.deepEqual(v.failures, [])
  assert.equal(v.aligned, 1)
})

test('unmapped 退化:任一 web 路由失去承载 ⇒ 判红点名', () => {
  const v = judgeRatchet({ ...green, unmapped: 1 }, { prefixCap: PREFIX_HITS_CAP })
  assert.equal(v.ok, false)
  const hit = v.failures.find((f) => f.rule === 'unmapped')
  assert.ok(hit)
  assert.match(hit.detail, /unmapped=1/)
})

test('prefixHits 超基线:424 > 423 ⇒ 判红;基线写入两次字节一致(幂等)', () => {
  const v = judgeRatchet({ ...green, prefixHits: 424 }, { prefixCap: PREFIX_HITS_CAP })
  assert.equal(v.ok, false)
  const hit = v.failures.find((f) => f.rule === 'prefixHits')
  assert.ok(hit)
  assert.match(hit.detail, /424 > 容量 423/)

  const dir = mkScratch('p0-2-baseline-')
  try {
    const path = join(dir, 'baseline.json')
    const readings = { ...green, prefixHits: 423 }
    const first = writeBaselineIfChanged(readings, 'head', path)
    const firstBytes = readFileSync(path, 'utf8')
    const second = writeBaselineIfChanged(readings, 'head', path)
    const secondBytes = readFileSync(path, 'utf8')
    assert.equal(first.text, second.text, '两次写盘的内容必须字节一致(幂等)')
    assert.equal(firstBytes, secondBytes, '落盘字节必须一致(幂等)')
    assert.equal(secondBytes, serializeBaseline(readings, 'head'))
    assert.equal(serializeBaseline(readings, 'head'), serializeBaseline(readings, 'head'))
  } finally {
    rmScratch(dir)
  }
})

test('aligned 缺 data.kind:任一条无合法 kind ⇒ 判红并列行', () => {
  const v = judgeRatchet(
    {
      ...green,
      alignedRows: [
        { web: 'pages/a', data: { kind: 'direct' } },
        { web: 'pages/b', data: {} },
      ],
    },
    { prefixCap: PREFIX_HITS_CAP },
  )
  assert.equal(v.ok, false)
  const hit = v.failures.find((f) => f.rule === 'aligned-data-kind')
  assert.ok(hit)
  assert.equal(hit.rows.length, 1)
  assert.equal(hit.rows[0].web, 'pages/b')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
