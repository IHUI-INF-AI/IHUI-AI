// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeModelCatalogFrame } from '../lib/qoder-model-catalog.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

test('非 available_models_update 帧一律 null', () => {
  assert.equal(normalizeModelCatalogFrame(null), null)
  assert.equal(normalizeModelCatalogFrame({ type: 'system', subtype: 'init' }), null)
  assert.equal(normalizeModelCatalogFrame({ type: 'assistant', subtype: 'available_models_update' }), null)
  assert.equal(normalizeModelCatalogFrame({ type: 'system', subtype: 'available_models_update' }), null)
})

test('enabled=false 剔除;同 id 去重;解析全空返回 null 不伪造空清单', () => {
  const frame = {
    type: 'system',
    subtype: 'available_models_update',
    models: [
      { value: 'auto', modelId: 'auto', displayName: 'Auto', isEnabled: true },
      { value: 'off', modelId: 'off', isEnabled: false },
      { value: 'auto', modelId: 'auto', isEnabled: true }, // 重复
      { value: '', modelId: '', isEnabled: true }, // 空 id
      null,
    ],
  }
  const r = normalizeModelCatalogFrame(frame)
  assert.ok(r)
  assert.equal(r.models.length, 1)
  assert.equal(r.models[0].id, 'auto')
  assert.equal(r.models[0].displayName, 'Auto')
  assert.ok(Number.isFinite(r.fetchedAt))
  // 全是 disabled → null
  assert.equal(
    normalizeModelCatalogFrame({
      type: 'system',
      subtype: 'available_models_update',
      models: [{ value: 'x', isEnabled: false }],
    }),
    null,
  )
})

test('modelId 缺失时回落 value;isNew 原样透传', () => {
  const r = normalizeModelCatalogFrame({
    type: 'system',
    subtype: 'available_models_update',
    models: [{ value: 'qmodel_latest', displayName: 'Qwen4-Max', isNew: true }],
  })
  assert.ok(r)
  assert.equal(r.models[0].id, 'qmodel_latest')
  assert.equal(r.models[0].isNew, true)
})

test('真实抓帧:国内版 CN 14 模型全部入清单,含 12 个 isNew 新模型', () => {
  // 夹具来自 2026-11-24 本机 CN SDK 实弹抓帧(脱敏,只留模型声明字段),随库交付,CI 可复现。
  const fixture = path.join(HERE, 'fixtures', 'qoder-available-models-20261124.json')
  const src = fs.readFileSync(fixture, 'utf8').split('\n').slice(3).join('\n') // 跳过 provenance 注释头
  const raw = JSON.parse(src)
  assert.equal(raw.subtype, 'available_models_update')
  const r = normalizeModelCatalogFrame(raw)
  assert.ok(r)
  assert.equal(r.models.length, 14)
  const ids = r.models.map((m) => m.id)
  for (const expected of ['auto', 'fast', 'qmodel_latest', 'dmodel', 'gmodel_latest', 'kmodel_latest', 'jmodel', 'mmodel']) {
    assert.ok(ids.includes(expected), `应含上游模型 ${expected}`)
  }
  assert.equal(r.models.filter((m) => m.isNew).length, 12)
})
