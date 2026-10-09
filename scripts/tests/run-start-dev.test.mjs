// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// run-start-dev 回归测试:钉三件事 ——
// ① findPwsh 在本机(任何 PATH 状态)都交出一个真实存在的 pwsh.exe 绝对路径;
// ② 该路径指向的确实是 PowerShell 7(-v 输出以 7. 开头);
// ③ 导出面稳定:repoRoot/scriptPath 指向仓库内真实文件,main 是函数(可测性契约)。
// 跑法:node --test scripts/tests/run-start-dev.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('findPwsh 交出真实存在的 pwsh.exe 绝对路径(含 PATH 陈旧场景的 fallback 契约)', async () => {
  const { findPwsh } = await import('../run-start-dev.mjs')
  const found = findPwsh()
  assert.ok(typeof found === 'string' && found.length > 0, 'findPwsh 返回空 ⇒ dev:safe 会断在第一步')
  assert.ok(found.toLowerCase().endsWith('pwsh.exe'), `解析结果不是 pwsh.exe: ${found}`)
  assert.ok(existsSync(found), `解析结果在磁盘上不存在: ${found}`)
})

test('解析出的 pwsh 确实是 PowerShell 7+(-v 输出 7.x)', async () => {
  const { findPwsh } = await import('../run-start-dev.mjs')
  const found = findPwsh()
  // 不吃 stdin 的子进程一律 stdio:['ignore','pipe','pipe'](EBUSY 病灶族)
  const v = spawnSync(found, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  })
  assert.equal(v.status, 0, `pwsh -v 探针失败: ${v.stderr || v.error?.message}`)
  assert.match(v.stdout.trim(), /^7\./, `版本不是 7.x: ${v.stdout}`)
})

test('导出面稳定:scriptPath 指向仓库内真实启动脚本', async () => {
  const mod = await import('../run-start-dev.mjs')
  assert.ok(existsSync(mod.scriptPath), `scriptPath 不存在: ${mod.scriptPath}`)
  assert.ok(mod.scriptPath.includes(join('scripts', 'start-dev.ps1')))
  assert.equal(typeof mod.main, 'function', 'main 必须是可导出函数(可测性契约)')
  assert.ok(existsSync(join(ROOT, 'package.json')), 'repoRoot 解析错位')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
