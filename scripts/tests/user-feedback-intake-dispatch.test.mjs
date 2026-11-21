#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第 79 项接线锁:user_feedback 单源入口的巡检轮派发。
 *
 * ① 守护器导出 `dispatchUserFeedbackIntake`,main() 与 daemon tick 两处都直调;
 * ② 结论行三种 `judged=0`/`undetermined≠0` 形态一律记未判定(ok:false),`signals=N` 记绿;
 * ③ 节流 30 分钟 + 器物缺席不写戳 + 关断开关。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARDIAN = join(ROOT, 'scripts', 'git-guardian.mjs')
const SRC = readFileSync(GUARDIAN, 'utf8')
const RUN = `${process.pid}-${Date.now()}`

async function load() {
  return import('file://' + GUARDIAN.replace(/\\/g, '/'))
}
function mkTick(name) {
  const dir = mkdtempSync(join(tmpdir(), `ufi-${RUN}-${name}-`))
  return { file: join(dir, 'last.json'), dir }
}

test('① 导出 + main 与 tick 双挂点', () => {
  assert.match(SRC, /export function dispatchUserFeedbackIntake\(/)
  const mounts = SRC.split(/\r?\n/).filter((l) => /^\s*(if \(!CHECK_ONLY\) )?dispatchUserFeedbackIntake\(\)/.test(l))
  assert.ok(mounts.length >= 2, `挂点只有 ${mounts.length} 处,需 main + daemon tick 两处`)
})

test('② judged=0 / undetermined≠0 记未判定, signals=N 记绿', async () => {
  const m = await load()
  const cases = [
    ['USER-FEEDBACK-INTAKE signals=2 skipped=0 undetermined=0 records=5', true],
    ['USER-FEEDBACK-INTAKE judged=0 undetermined=1', false],
    ['USER-FEEDBACK-INTAKE signals=0 skipped=3 undetermined=2', false],
  ]
  for (const [line, expectOk] of cases) {
    const t = mkTick('c')
    const r = m.dispatchUserFeedbackIntake({
      now: 1_800_000_000_000,
      tickFile: t.file,
      logger: () => {},
      runner: () => ({ ok: true, out: line + '\n' }),
    })
    assert.equal(r.ran, true, `${line} 应已跑`)
    assert.equal(r.ok, expectOk, `${line} 的 ok 判定错`)
    rmSync(t.dir, { recursive: true, force: true })
  }
  const t = mkTick('none')
  const r = m.dispatchUserFeedbackIntake({ now: 1, tickFile: t.file, logger: () => {}, runner: () => ({ ok: false, out: '' }) })
  assert.equal(r.ok, false, '无结论行必须落未判定,不得记绿')
  rmSync(t.dir, { recursive: true, force: true })
})

test('③ 节流 + 器物缺席不写戳 + 关断开关', async () => {
  const m = await load()
  const t = mkTick('thr')
  let calls = 0
  const runner = () => { calls += 1; return { ok: true, out: 'USER-FEEDBACK-INTAKE signals=1 skipped=0 undetermined=0\n' } }
  assert.equal(m.dispatchUserFeedbackIntake({ now: 1_800_000_000_000, tickFile: t.file, logger: () => {}, runner }).ran, true)
  assert.equal(m.dispatchUserFeedbackIntake({ now: 1_800_000_000_000 + 60_000, tickFile: t.file, logger: () => {}, runner }).ran, false)
  assert.equal(m.dispatchUserFeedbackIntake({ now: 1_800_000_000_000 + 31 * 60_000, tickFile: t.file, logger: () => {}, runner }).ran, true)
  assert.equal(calls, 2)
  rmSync(t.dir, { recursive: true, force: true })

  const t2 = mkTick('kill')
  const prev = process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE
  process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE = '1'
  try {
    const r = m.dispatchUserFeedbackIntake({ now: 2, tickFile: t2.file, logger: () => {}, runner: () => { throw new Error('不该跑') } })
    assert.equal(r.ran, false)
    assert.match(String(r.why), /kill-switch/)
  } finally {
    if (prev === undefined) delete process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE
    else process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE = prev
  }
  rmSync(t2.dir, { recursive: true, force: true })

  const t3 = mkTick('absent')
  const prev2 = process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE
  delete process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE
  try {
    const r = m.dispatchUserFeedbackIntake({
      now: 3,
      tickFile: t3.file,
      scriptFile: join(t3.dir, 'nope.mjs'),
      logger: () => {},
    })
    assert.equal(r.ran, false)
    assert.match(String(r.why), /器物缺席/)
    assert.equal(existsSync(t3.file), false, '没跑不得写戳')
  } finally {
    if (prev2 !== undefined) process.env.IHUI_GUARDIAN_DISABLE_USER_FEEDBACK_INTAKE = prev2
  }
  rmSync(t3.dir, { recursive: true, force: true })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
