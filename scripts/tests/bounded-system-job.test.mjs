// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 有截止窗的系统级调用包装。判据只 import 生产函数，测试内零复制。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { judgeBoundedJob, runBoundedJob } from '../lib/bounded-system-job.mjs'

const manual = 'schtasks /Query /TN \\Microsoft\\Windows\\AppID\\PolicyConverter'

test('正常 exit 0 是 ok', async () => {
  const verdict = await runBoundedJob(async () => ({ exitCode: 0 }), {
    deadlineMs: 1_000,
    manualCommand: manual,
  })
  assert.deepEqual(verdict, { verdict: 'ok', reason: 'exited', manualCommand: null })
})

test('exit 4 是 breach，不是 unjudged', async () => {
  const verdict = await runBoundedJob(async () => ({ exitCode: 4 }), {
    deadlineMs: 1_000,
    manualCommand: manual,
  })
  assert.notEqual(verdict.verdict, 'unjudged')
  assert.deepEqual(verdict, {
    verdict: 'breach',
    reason: 'nonzero',
    exitCode: 4,
    manualCommand: manual,
  })
})

test('跑过截止窗即使 exitCode 0 也是 unjudged', () => {
  const verdict = judgeBoundedJob({
    started: true,
    finished: true,
    exitCode: 0,
    deadlineMs: 1_000,
    elapsedMs: 1_000,
    manualCommand: manual,
  })
  assert.deepEqual(verdict, {
    verdict: 'unjudged',
    reason: 'deadline-exceeded',
    manualCommand: manual,
  })
})

test('deadlineMs 缺失是 unjudged，不用默认毫秒冒充', () => {
  for (const deadlineMs of [null, undefined, 0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const verdict = judgeBoundedJob({
      started: true,
      finished: true,
      exitCode: 0,
      deadlineMs,
      elapsedMs: 0,
      manualCommand: undefined,
    })
    assert.equal(verdict.verdict, 'unjudged', String(deadlineMs))
    assert.equal(verdict.reason, 'deadline-unmeasured', String(deadlineMs))
    assert.equal(verdict.manualCommand, null, String(deadlineMs))
  }
})

test('永不结束的作业在短截止窗内是 unjudged，并带回手工命令', { timeout: 2_000 }, async () => {
  const verdict = await runBoundedJob(() => new Promise(() => {}), {
    deadlineMs: 50,
    manualCommand: manual,
  })
  assert.deepEqual(verdict, {
    verdict: 'unjudged',
    reason: 'deadline-exceeded',
    manualCommand: manual,
  })
})

test('start 抛错是 unjudged / start-threw，不当成功', async () => {
  const verdict = await runBoundedJob(
    async () => {
      throw new Error('boom')
    },
    { deadlineMs: 1_000, manualCommand: manual },
  )
  assert.deepEqual(verdict, { verdict: 'unjudged', reason: 'start-threw', manualCommand: manual })
})

test('没开始、退出码没量到，各自是未判定', () => {
  assert.deepEqual(
    judgeBoundedJob({
      started: false,
      finished: false,
      exitCode: 0,
      deadlineMs: 500,
      elapsedMs: 1,
      manualCommand: null,
    }),
    { verdict: 'unjudged', reason: 'not-started', manualCommand: null },
  )
  assert.deepEqual(
    judgeBoundedJob({
      started: true,
      finished: true,
      exitCode: null,
      deadlineMs: 500,
      elapsedMs: 12,
      manualCommand: manual,
    }),
    { verdict: 'unjudged', reason: 'exit-unmeasured', manualCommand: manual },
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
