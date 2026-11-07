// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { planStartupOutput } from '../lib/startup-output-path.mjs'

test('开关没量到时不落盘', () => {
  for (const enabled of [null, '1', 1]) {
    const verdict = planStartupOutput({ argv: [], enabled })
    assert.equal(verdict.disposition, 'unjudged')
    assert.equal(verdict.reason, 'switch-unmeasured')
    assert.equal(verdict.write, false)
  }
})

test('未开启时不落盘', () => {
  const verdict = planStartupOutput({ argv: ['--help'], enabled: false })
  assert.equal(verdict.disposition, 'off')
  assert.equal(verdict.write, false)
  assert.equal(verdict.dir, null)
})

test('开了开关但没有路径时不挑目录', () => {
  const verdict = planStartupOutput({ argv: ['--startup-prof'], enabled: false })
  assert.equal(verdict.disposition, 'unjudged')
  assert.equal(verdict.reason, 'path-unmeasured')
  assert.equal(verdict.write, false)
})

test('路径含控制字符时拒绝且不回显', () => {
  const verdict = planStartupOutput({
    argv: ['--startup-prof-dir', 'report\n.md'],
    enabled: false,
  })
  assert.equal(verdict.disposition, 'refused')
  assert.equal(verdict.reason, 'control-character')
  assert.equal(verdict.write, false)
  assert.equal(verdict.dir, null)
  assert.equal(JSON.stringify(verdict).includes('report'), false)
})

test('给出干净路径才允许写', () => {
  const verdict = planStartupOutput({
    argv: ['--startup-prof-md', '--startup-prof-dir', 'logs', '--startup-prof-name', 'boot'],
    enabled: false,
  })
  assert.deepEqual(verdict, {
    disposition: 'on',
    reason: 'opt-in',
    write: true,
    format: 'markdown',
    dir: 'logs',
    name: 'boot',
  })
})

test('缺参数值不算路径', () => {
  const verdict = planStartupOutput({ argv: ['--startup-prof-name'], enabled: true })
  assert.equal(verdict.reason, 'value-unmeasured')
  assert.equal(verdict.write, false)
})

test('不认识的画像旗标不启用', () => {
  const verdict = planStartupOutput({
    argv: ['--startup-prof-json', '--startup-prof-dir', 'logs'],
    enabled: false,
  })
  assert.equal(verdict.reason, 'flag-unknown')
  assert.equal(verdict.write, false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
