// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 判据配置文件族的通用形态闸(2026-11-03 立):scripts/data 下每个 .json 必须
// 非空、JSON.parse 成功、顶层是对象或数组。防的是「判据文件被写短/写坏/清空」这类
// 结构性事故(如 cross-end-screen-registry.json 曾两次 −60% 体积骤降)。
// 不建新基础设施、不联网、不读外部基线,纯本地形态断言。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url))

test('形态闸:scripts/data/*.json 逐个非空、可解析、顶层为对象或数组', () => {
  const all = readdirSync(DATA_DIR).filter((f) => statSync(join(DATA_DIR, f)).isFile())
  const jsons = all.filter((f) => f.endsWith('.json'))
  // 非 .json 形态(.jsonl 逐行 JSON、.md 说明文档)不是单文档 JSON ⇒ 跳过并列出清单
  const skipped = all.filter((f) => !f.endsWith('.json'))
  console.log(
    `形态闸覆盖 ${jsons.length} 枚 .json;跳过清单(非单文档 JSON): ${skipped.join(', ') || '(无)'}`,
  )
  assert.ok(jsons.length > 0, 'scripts/data 下没有任何 .json ⇒ 目录被误删/路径写错,拒绝空跑变绿')
  const failures = []
  for (const f of jsons) {
    const raw = readFileSync(join(DATA_DIR, f), 'utf8')
    if (!raw.trim()) {
      failures.push(`${f}: 文件为空`)
      continue
    }
    let v
    try {
      v = JSON.parse(raw)
    } catch (e) {
      failures.push(`${f}: JSON.parse 失败(${e.message})`)
      continue
    }
    if (v === null || typeof v !== 'object') {
      failures.push(`${f}: 顶层是 ${v === null ? 'null' : typeof v},不是对象/数组`)
    }
  }
  assert.deepEqual(failures, [], `形态闸红灯:\n${failures.join('\n')}`)
})
