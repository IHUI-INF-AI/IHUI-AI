#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn 收尾回读的接线夹具。
 *
 * 钉:`.github/workflows/mobile-rn-release.yml` 的「收尾回读」步骤曾带 `continue-on-error: true`,
 * 使「发布没落地 / 回读判不出」在工作流层面永远绿。判据两格:
 * ① 静态:该步骤块内不得出现 `continue-on-error: true`,且必须真跑 `release-mobile-rn.mjs --json`;
 * ② 行为:脚本 exitCode 契约 —— blocked ⇒ 1、unjudged ⇒ 2、ready ⇒ 0(回读步骤的退出码即由此而来)。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exitCode } from '../../scripts/release-mobile-rn.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WF = join(HERE, '..', '..', '.github', 'workflows', 'mobile-rn-release.yml')

/** 取出「收尾回读」步骤块(从 - name 行到下一条 - name 行/文件尾)。 */
function readbackStepBlock(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.includes('收尾回读'))
  assert.ok(start >= 0, 'workflow 里找不到「收尾回读」步骤')
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s{6}- (name|uses):/.test(lines[i])) {
      end = i
      break
    }
  }
  return lines
    .slice(start, end)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
}

test('T1 静态:收尾回读不得 continue-on-error,且必须真跑 --json 回读', () => {
  const block = readbackStepBlock(readFileSync(WF, 'utf8'))
  assert.ok(
    !/continue-on-error:\s*true/.test(block),
    '收尾回读仍带 continue-on-error: true ⇒ 发布没落地也永远绿',
  )
  assert.ok(/release-mobile-rn\.mjs\s+--json/.test(block), '收尾回读没跑 --json 回读')
})

test('T2 行为:回读退出码口径 blocked=1 / unjudged=2 / ready=0', () => {
  const leg = (status) => ({ id: `x-${status}`, status })
  assert.equal(exitCode([leg('ready')]), 0)
  assert.equal(exitCode([leg('blocked')]), 1)
  assert.equal(exitCode([leg('unjudged')]), 2)
  assert.equal(exitCode([leg('ready'), leg('blocked')]), 1, '任一腿 blocked ⇒ 非 0')
  assert.equal(exitCode([leg('blocked'), leg('unjudged')]), 2, 'unjudged 压过 blocked ⇒ 2')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
