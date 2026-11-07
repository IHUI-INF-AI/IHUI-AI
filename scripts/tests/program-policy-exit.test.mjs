// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * judgeProgramPolicy 的行为锁。
 * 未量到与未配置都不得执行；退出码 0 只在 broker 可达、已配置、程序未禁用三件齐备时出现。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgeProgramPolicy } from '../lib/program-policy-exit.mjs'

test('broker 不是布尔 → broker-unmeasured，不得 admitted', () => {
  const cases = [
    { brokerReachable: null, configured: true, programDisabled: false },
    { configured: true, programDisabled: false },
    { brokerReachable: 'true', configured: true, programDisabled: false },
  ]
  for (const input of cases) {
    const result = judgeProgramPolicy(input)
    assert.equal(result.disposition, 'unjudged')
    assert.equal(result.reason, 'broker-unmeasured')
    assert.equal(result.exitCode, null)
    assert.equal(result.action, 'none')
    assert.notEqual(result.disposition, 'admitted')
  }
})

test('broker 不可达 → refused policy-unavailable exitCode 13', () => {
  const result = judgeProgramPolicy({
    brokerReachable: false,
    configured: true,
    programDisabled: false,
  })
  assert.equal(result.disposition, 'refused')
  assert.equal(result.reason, 'policy-unavailable')
  assert.equal(result.exitCode, 13)
  assert.equal(result.action, 'none')
})

test('程序禁用标志不是布尔 → program-unmeasured', () => {
  const cases = [
    { brokerReachable: true, configured: true, programDisabled: null },
    { brokerReachable: true, configured: true },
    { brokerReachable: true, configured: true, programDisabled: 'yes' },
  ]
  for (const input of cases) {
    const result = judgeProgramPolicy(input)
    assert.equal(result.disposition, 'unjudged')
    assert.equal(result.reason, 'program-unmeasured')
    assert.equal(result.exitCode, null)
    assert.equal(result.action, 'none')
  }
})

test('程序被禁用 → exitCode 126，即使 broker 可达且已配置', () => {
  const result = judgeProgramPolicy({
    brokerReachable: true,
    configured: true,
    programDisabled: true,
  })
  assert.equal(result.disposition, 'refused')
  assert.equal(result.reason, 'program-disabled')
  assert.equal(result.exitCode, 126)
  assert.equal(result.action, 'none')
})

test('未配置 → policy-unconfigured，exitCode 不是 0', () => {
  const result = judgeProgramPolicy({
    brokerReachable: true,
    configured: false,
    programDisabled: false,
  })
  assert.equal(result.disposition, 'unjudged')
  assert.equal(result.reason, 'policy-unconfigured')
  assert.notEqual(result.exitCode, 0)
  assert.equal(result.exitCode, null)
  assert.equal(result.action, 'none')
})

test('配置标志不是布尔 → config-unmeasured', () => {
  const result = judgeProgramPolicy({
    brokerReachable: true,
    programDisabled: false,
  })
  assert.equal(result.disposition, 'unjudged')
  assert.equal(result.reason, 'config-unmeasured')
  assert.equal(result.exitCode, null)
  assert.equal(result.action, 'none')
})

test('三件齐 → admitted exitCode 0 action execute', () => {
  const result = judgeProgramPolicy({
    brokerReachable: true,
    configured: true,
    programDisabled: false,
  })
  assert.equal(result.disposition, 'admitted')
  assert.equal(result.reason, 'policy-allow')
  assert.equal(result.exitCode, 0)
  assert.equal(result.action, 'execute')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
