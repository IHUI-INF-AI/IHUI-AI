// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { DAEMON_SUPERVISOR_COMMANDS, decideDaemonSupervisor } from '../lib/daemon-supervisor.mjs'

test('三命令清单被冻结', () => {
  assert.deepEqual([...DAEMON_SUPERVISOR_COMMANDS], ['start', 'restart', 'install'])
  assert.equal(Object.isFrozen(DAEMON_SUPERVISOR_COMMANDS), true)
})

test('命令没量到', () => {
  for (const command of [null, '', '  ']) {
    assert.deepEqual(decideDaemonSupervisor({ command, supervisorState: 'absent' }), {
      disposition: 'unjudged',
      reason: 'command-unmeasured',
      spawn: false,
      accept: false,
    })
  }
})

test('没取到的命令名不得当成安全跳过', () => {
  const result = decideDaemonSupervisor({ command: 'stop', supervisorState: 'live' })
  assert.equal(result.disposition, 'unjudged')
  assert.equal(result.reason, 'command-unknown')
  assert.equal(result.accept, false)
  assert.equal(result.spawn, false)
})

test('监管状态没量到', () => {
  assert.deepEqual(decideDaemonSupervisor({ command: 'start', supervisorState: null }), {
    disposition: 'unjudged',
    reason: 'supervisor-unmeasured',
    spawn: false,
    accept: false,
  })
})

test('监管失败时拒绝且不抛', () => {
  const run = () => decideDaemonSupervisor({ command: 'start', supervisorState: 'failed' })
  assert.doesNotThrow(run)
  assert.deepEqual(run(), {
    disposition: 'refused',
    reason: 'supervisor-down',
    spawn: false,
    accept: false,
  })
})

test('失败态不重试派生', () => {
  for (const command of DAEMON_SUPERVISOR_COMMANDS) {
    const result = decideDaemonSupervisor({ command, supervisorState: 'failed' })
    assert.equal(result.disposition, 'refused')
    assert.equal(result.reason, 'supervisor-down')
    assert.equal(result.spawn, false)
    assert.equal(result.accept, false)
  }
})

test('监管不在时三个命令都派生', () => {
  for (const command of DAEMON_SUPERVISOR_COMMANDS) {
    assert.deepEqual(decideDaemonSupervisor({ command, supervisorState: 'absent' }), {
      disposition: 'admitted',
      reason: 'supervisor-create',
      spawn: true,
      accept: true,
    })
  }
})

test('监管已活着时 start 与 install 不再派生', () => {
  for (const command of ['start', 'install']) {
    assert.deepEqual(decideDaemonSupervisor({ command, supervisorState: 'live' }), {
      disposition: 'admitted',
      reason: 'supervisor-live',
      spawn: false,
      accept: true,
    })
  }
})

test('监管已活着时 restart 仍然派生替换', () => {
  assert.deepEqual(decideDaemonSupervisor({ command: 'restart', supervisorState: 'live' }), {
    disposition: 'admitted',
    reason: 'supervisor-replace',
    spawn: true,
    accept: true,
  })
})

test('入参缺失也不抛', () => {
  assert.doesNotThrow(() => decideDaemonSupervisor(null))
  assert.equal(decideDaemonSupervisor(undefined).reason, 'command-unmeasured')
  assert.equal(decideDaemonSupervisor(undefined).accept, false)
  assert.equal(decideDaemonSupervisor(undefined).spawn, false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
