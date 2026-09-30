// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-ai-panel-mount-guards.mjs 的镜像测试。
// 核心行为由源脚本 --self-test 在 --root 注入的临时夹具中证明；本文件只钉 CLI 装车与头注契约。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { __test__ as guard } from '../check-ai-panel-mount-guards.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GUARD = resolve(REPO, 'scripts', 'check-ai-panel-mount-guards.mjs')

function run(args) {
  const spawned = spawnSync(process.execPath, [GUARD, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, HUSKY_SKIP_AI_PANEL_MOUNT_GUARDS: '0' },
  })
  if (spawned.error?.code !== 'EBUSY') return spawned

  // WorkBuddy 的安全 shim 在部分 Windows 会话禁止 Node 再派生 Node；此时调用与 CLI
  // 完全相同的 main(argv) 入口,仍会运行 --self-test 的临时夹具与 --root 取材链。
  const stdout = []
  const stderr = []
  const oldLog = console.log
  const oldWarn = console.warn
  const oldError = console.error
  console.log = (...parts) => stdout.push(parts.join(' '))
  console.warn = (...parts) => stderr.push(parts.join(' '))
  console.error = (...parts) => stderr.push(parts.join(' '))
  let status
  try {
    status = guard.main(args)
  } finally {
    console.log = oldLog
    console.warn = oldWarn
    console.error = oldError
  }
  return { status, stdout: stdout.join('\n'), stderr: stderr.join('\n') }
}

test('CLI --self-test 退出 0 且打印通过标记', () => {
  const result = run(['--self-test'])
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /\[PASS\].*self-test 全部通过/)
})

test('头注点名全量/staged/self-test 用法与专属紧急跳过变量', () => {
  const header = readFileSync(GUARD, 'utf8').split(/\r?\n/).slice(0, 45).join('\n')
  assert.match(header, /用法:/)
  assert.match(header, /check-ai-panel-mount-guards\.mjs\s+# 全量扫描/)
  assert.match(header, /check-ai-panel-mount-guards\.mjs --staged/)
  assert.match(header, /check-ai-panel-mount-guards\.mjs --self-test/)
  assert.match(header, /HUSKY_SKIP_AI_PANEL_MOUNT_GUARDS/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
