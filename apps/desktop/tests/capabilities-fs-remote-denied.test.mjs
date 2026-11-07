// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-07 DBG-38 P0 回归钉:
// remote 授权面(default.json,同时覆盖 https://aizhs.top 线上页)不得再持有任何
// 无路径 scope 的裸文件 I/O / 剪贴板读权限 —— 这些权限使线上前端任一 XSS 即等效 RCE。
// 这些权限已迁移到 local-fs-io.json(仅本地 webview 生效,线上 XSS 面不可达)。
// 本地消费面经全仓 grep 确认零引用(apps/desktop/src 无 readTextFile/writeTextFile/
// readDir/listDir/statFile/clipboardReadText 调用),故 remote 面移除后功能无损。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const DEFAULT_CAP = fileURLToPath(new URL('../src-tauri/capabilities/default.json', import.meta.url))
const LOCAL_CAP = fileURLToPath(new URL('../src-tauri/capabilities/local-fs-io.json', import.meta.url))

// 这六个是 DBG-38 点名的无路径 scope 裸文件 I/O / 剪贴板读权限(RCE 面)。
// 注意:allow-clipboard-set(写剪贴板)不在其列 —— 写剪贴板非窃取面,且 agent-control 在用,保留。
const DANGEROUS_FS_PERMS = [
  'allow-read-text-file',
  'allow-read-binary-file',
  'allow-write-text-file',
  'allow-list-dir',
  'allow-stat-file',
  'allow-clipboard-get',
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

test('remote 面(default.json)不再授予任何裸文件 I/O / 剪贴板读权限', () => {
  const caps = readJson(DEFAULT_CAP)
  const perms = caps.permissions.filter((p) => typeof p === 'string')
  const leaked = perms.filter((id) => DANGEROUS_FS_PERMS.includes(id))
  assert.deepEqual(
    leaked,
    [],
    `remote 授权面仍泄漏裸文件 I/O 权限(等同 RCE 面): ${leaked.join(', ')}`,
  )
})

test('remote 面仍保留 clipboard-set(写剪贴板,非窃取面,agent-control 在用)', () => {
  const caps = readJson(DEFAULT_CAP)
  const perms = caps.permissions.filter((p) => typeof p === 'string')
  assert.equal(perms.includes('allow-clipboard-set'), true, 'clipboard-set 被误删,agent-control 粘贴功能会失联')
})

test('裸文件 I/O 权限已迁移到 local-fs-io.json(仅本地 webview,不授予 remote)', () => {
  const caps = readJson(LOCAL_CAP)
  const perms = caps.permissions.filter((p) => typeof p === 'string')
  for (const id of DANGEROUS_FS_PERMS) {
    assert.equal(perms.includes(id), true, `local-fs-io.json 缺 ${id}:迁移不完整`)
  }
  // 该能力不得再授权给 remote 线上页(否则等于没修)
  assert.equal(
    Array.isArray(caps.remote?.urls) && caps.remote.urls.length > 0,
    false,
    'local-fs-io.json 不应带 remote 授权,否则线上 XSS 面仍可达这些权限',
  )
  assert.deepEqual(caps.windows?.sort(), ['admin', 'main'], 'local-fs-io.json 应只作用于本地 main/admin 窗口')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
