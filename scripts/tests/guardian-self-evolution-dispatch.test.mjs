// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import {
  dispatchDeployOutcomeIntake,
  dispatchDeployFeedback,
  dispatchExportUserFeedback,
  dispatchE2eAutofill,
} from '../git-guardian.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(path.join(__dirname, '..', 'git-guardian.mjs'), 'utf8')

// 排除行首 // 注释行后的源码(装车锁:不能靠注释冒充调用点)
function codeOnly(src) {
  return src.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n')
}

const FNS = [dispatchDeployOutcomeIntake, dispatchDeployFeedback, dispatchExportUserFeedback, dispatchE2eAutofill]
const NAMES = ['dispatchDeployOutcomeIntake', 'dispatchDeployFeedback', 'dispatchExportUserFeedback', 'dispatchE2eAutofill']
const DISABLE_ENVS = [
  'IHUI_GUARDIAN_DISABLE_DEPLOY_OUTCOME',
  'IHUI_GUARDIAN_DISABLE_DEPLOY_FEEDBACK',
  'IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_EXPORT',
  'IHUI_GUARDIAN_DISABLE_E2E_AUTOFILL',
]

test('自进化四腿均已导出为 dispatch 函数', () => {
  for (const fn of FNS) assert.equal(typeof fn, 'function', `期望导出函数,实际 ${typeof fn}`)
})

test('自进化四腿均真接进派发轮(非注释死代码)', () => {
  const code = codeOnly(SRC)
  for (const name of NAMES) assert.ok(code.includes(`${name}(`), `${name} 未接进派发轮调用点`)
})

test('存在性守卫生效:器物缺席时返回 ran:false 且不抛', () => {
  for (const fn of FNS) {
    const r = fn({ exists: () => false, now: Date.now() + 10 ** 12 })
    assert.equal(r.ran, false)
    assert.match(r.why, /器物缺席/)
  }
})

test('env 关闭生效:IHUI_GUARDIAN_DISABLE_*=1 时返回 ran:false', () => {
  for (let i = 0; i < FNS.length; i++) {
    const env = DISABLE_ENVS[i]
    const prev = process.env[env]
    process.env[env] = '1'
    try {
      const r = FNS[i]({ exists: () => true, now: Date.now() + 10 ** 12 })
      assert.equal(r.ran, false, `${env} 关闭时仍 ran:true`)
      assert.match(r.why, /env 关闭/)
    } finally {
      if (prev === undefined) delete process.env[env]
      else process.env[env] = prev
    }
  }
})

test('接通后真执行注入的 runner(装车行为钉死,且不写仓库 tick)', () => {
  let called = false
  const runner = () => {
    called = true
    return { ok: true, out: 'produced 3 incident-signals' }
  }
  const tmpTick = path.join(os.tmpdir(), `guardian-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
  const r = dispatchDeployOutcomeIntake({
    exists: () => true,
    now: Date.now() + 10 ** 12,
    tickFile: tmpTick,
    runner,
  })
  assert.equal(called, true, 'runner 未被调用 ⇒ 未真接通派发')
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
