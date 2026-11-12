// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-07 DBG-38 P0 回归钉(2026-11-10 复核):
// 带 remote 的 capability(default.json 覆盖 https://aizhs.top,且不含 www)不得持有
// 无路径 scope 的裸文件 I/O / 剪贴板读权限 —— 线上 XSS 即可读写本机文件、抓剪贴板。
// 这些权限在 local-fs-io.json:无 remote,只进 ExecutionContext::Local,本地 webview 仍可用。
// clipboard-set 不在收回清单。BUG-17 已把它移出 remote;本锁不要求加回,以免线上 XSS 覆写剪贴板。
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CAP_DIR = fileURLToPath(new URL('../src-tauri/capabilities/', import.meta.url))
const DEFAULT_CAP = join(CAP_DIR, 'default.json')
const LOCAL_CAP = join(CAP_DIR, 'local-fs-io.json')

// 无路径 scope 的裸文件 I/O / 剪贴板读(RCE / 凭据窃取面)。
// allow-clipboard-set(写剪贴板)不在其列,也不要求出现在 remote 面。
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

function permissionIds(caps) {
  return (caps.permissions ?? [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.identifier))
    .filter((id) => typeof id === 'string')
}

test('remote 面(default.json)不再授予任何裸文件 I/O / 剪贴板读权限', () => {
  const caps = readJson(DEFAULT_CAP)
  const perms = permissionIds(caps)
  const leaked = perms.filter((id) => DANGEROUS_FS_PERMS.includes(id))
  assert.deepEqual(
    leaked,
    [],
    `remote 授权面仍泄漏裸文件 I/O 权限(等同 RCE 面): ${leaked.join(', ')}`,
  )
})

test('收回文件权限时不删掉远程面仍需要的非文件权限', () => {
  const caps = readJson(DEFAULT_CAP)
  const perms = caps.permissions.filter((p) => typeof p === 'string')
  for (const id of [
    'core:default',
    'deep-link:default',
    'updater:default',
    'dialog:default',
    'notification:default',
    'allow-get-app-info',
    'allow-store-read-entry',
    'allow-store-write-entry',
  ]) {
    assert.equal(perms.includes(id), true, `远程面仍需要的非文件权限被删: ${id}`)
  }
  assert.equal(
    perms.includes('allow-clipboard-set'),
    false,
    'clipboard-set 已由 BUG-17 移出 remote,F-061 用户拍板:只补本地、不回 remote',
  )
})

test('带 aizhs 或 www 的 remote 能力不得再授予裸文件 I/O / 剪贴板读', () => {
  const files = readdirSync(CAP_DIR).filter((name) => name.endsWith('.json'))
  assert.ok(files.includes('default.json'), 'capabilities 目录缺少 default.json')
  for (const name of files) {
    const caps = readJson(join(CAP_DIR, name))
    const urls = Array.isArray(caps.remote?.urls) ? caps.remote.urls : []
    const hitsTrustedRemote = urls.some((url) => /aizhs\.top|www/i.test(String(url)))
    if (!hitsTrustedRemote) continue
    const perms = permissionIds(caps)
    const leaked = perms.filter((id) => DANGEROUS_FS_PERMS.includes(id))
    assert.deepEqual(leaked, [], `${name} 的 remote 受信域仍泄漏: ${leaked.join(', ')}`)
  }
})

test('裸文件 I/O 权限已迁移到 local-fs-io.json(仅本地 webview,不授予 remote)', () => {
  const caps = readJson(LOCAL_CAP)
  const perms = permissionIds(caps)
  for (const id of DANGEROUS_FS_PERMS) {
    assert.equal(perms.includes(id), true, `local-fs-io.json 缺 ${id}:迁移不完整`)
  }
  // 该能力不得再授权给 remote 线上页(否则等于没修)
  assert.equal(
    Array.isArray(caps.remote?.urls) && caps.remote.urls.length > 0,
    false,
    'local-fs-io.json 不应带 remote 授权,否则线上 XSS 面仍可达这些权限',
  )
  assert.notEqual(caps.local, false, 'local-fs-io 必须对本地 origin 生效,禁止 local:false')
  assert.deepEqual(caps.windows?.sort(), ['admin', 'main'], 'local-fs-io.json 应只作用于本地 main/admin 窗口')
})

// F-061 回归:用户拍板 —— 只把 allow-clipboard-set 补进 local-fs-io(本地 webview),
// 绝不补回 default.json 的 remote 面(BUG-17/DBG-38 已把剪贴板权限收回 remote 面,
// 线上页写剪贴板等价于 XSS 覆写用户剪贴板)。
// default.json 不含 allow-clipboard-set 由上方「收回文件权限时不删掉远程面仍需要的非文件权限」用例锁定,不重复断言。
test('F-061: local-fs-io 授予 allow-clipboard-set(本地),且仍不带 remote 面', () => {
  const caps = readJson(LOCAL_CAP)
  const perms = permissionIds(caps)
  assert.equal(
    perms.includes('allow-clipboard-set'),
    true,
    'local-fs-io.json 缺 allow-clipboard-set:本地 webview 调 clipboard_set 仍会被 ACL 拒(F-061)',
  )
  assert.equal(
    Array.isArray(caps.remote?.urls) && caps.remote.urls.length > 0,
    false,
    'F-061: allow-clipboard-set 只给本地,local-fs-io 不得带 remote 授权',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
