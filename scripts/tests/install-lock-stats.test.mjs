// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 观察期统计必须可数(2026-11-07)
//
// 判据「≥3 次真实 install、误拦 ≤1」此前只能靠回忆。本测试用合成审计日志验证:
//   installs 只数 run-end(code=0, cmd 含 install);
//   误拦 = check-block 发生时**没有活跃 run-start**(同一时刻 replay 得出);
//   有活跃安装时的 check-block 是正确拦截,不计误拦;
//   直连被守卫拒绝(guard-deny 未携带 token)单独计数,不算误拦。
// 走 IHUI_SHARED_ROOT 指到临时目录,不碰真实共享根状态。
// =============================================================================
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'lib', 'pnpm-install-lock.mjs')

test('T1 统计: installs/误拦/直连拒绝都可从日志数出', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-lock-stats-'))
  try {
    const dir = join(root, '.ihui-agent', 'state')
    mkdirSync(dir, { recursive: true })
    const events = [
      { at: '2026-11-07T01:00:00.000Z', event: 'run-start', pid: 101, cmd: 'pnpm install --frozen-lockfile', enabled: true },
      { at: '2026-11-07T01:00:01.000Z', event: 'check-block', pid: 999, holderPid: 101 },
      { at: '2026-11-07T01:00:02.000Z', event: 'run-end', pid: 101, cmd: 'pnpm install --frozen-lockfile', code: 0 },
      { at: '2026-11-07T01:00:03.000Z', event: 'check-block', pid: 998, holderPid: null },
      { at: '2026-11-07T01:00:04.000Z', event: 'check-stale', pid: 997, reason: 'pid 已死' },
      { at: '2026-11-07T01:00:05.000Z', event: 'guard-deny', pid: 996, reason: '直连安装未携带锁 token' },
      { at: '2026-11-07T01:00:06.000Z', event: 'run-start', pid: 102, cmd: 'pnpm install', enabled: false },
      { at: '2026-11-07T01:00:07.000Z', event: 'run-end', pid: 102, cmd: 'pnpm install', code: 0, enabled: false },
    ]
    writeFileSync(join(dir, 'install-lock.log'), events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
    const r = spawnSync(process.execPath, [SCRIPT, 'stats', '--since=2026-11-07', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, IHUI_SHARED_ROOT: root },
    })
    assert.equal(r.status, 1, `未达标时应 exit 1（stdout=${r.stdout} stderr=${r.stderr}）`)
    const out = JSON.parse(r.stdout)
    assert.equal(out.installs, 1, 'run-end code=0 且 cmd 含 install 应计 1')
    assert.equal(out.installsViaEmergency, 1, '应急口直跑必须单列')
    assert.equal(out.blocks, 2)
    assert.equal(out.falseBlocks, 1, '无活跃安装时的 check-block 才是误拦')
    assert.equal(out.staleRecoveries, 1)
    assert.equal(out.directDenied, 1, '直连被守卫拒绝要单独可数')
    assert.equal(out.pass, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('T2 统计: 3 次成功 install 且误拦 0 ⇒ 达标 exit 0', () => {
  const root = mkdtempSync(join(tmpdir(), 'ihui-lock-stats-'))
  try {
    const dir = join(root, '.ihui-agent', 'state')
    mkdirSync(dir, { recursive: true })
    const events = []
    for (let i = 0; i < 3; i++) {
      const pid = 200 + i
      events.push({ at: `2026-11-07T0${i}:00:00.000Z`, event: 'run-start', pid, cmd: 'pnpm install', enabled: true })
      events.push({ at: `2026-11-07T0${i}:00:01.000Z`, event: 'run-end', pid, cmd: 'pnpm install', code: 0 })
    }
    writeFileSync(join(dir, 'install-lock.log'), events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8')
    const r = spawnSync(process.execPath, [SCRIPT, 'stats', '--since=2026-11-07', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, IHUI_SHARED_ROOT: root },
    })
    assert.equal(r.status, 0, `达标应 exit 0（stderr=${r.stderr}）`)
    const out = JSON.parse(r.stdout)
    assert.equal(out.installs, 3)
    assert.equal(out.falseBlocks, 0)
    assert.equal(out.pass, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
