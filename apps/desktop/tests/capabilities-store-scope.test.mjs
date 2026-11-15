// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-11-05 桌面 store 越权 P0 回归钉:
// 远程 webview 不得再拿到任何 `store:*` 权限(尤其 store:default),只能走两条白名单应用命令。
// 上游 tauri-plugin-store 的 permissions 没有路径 scope,capability 授权面即为攻击面,
// 因此这里直接锁死声明清单,防止后续把 store:default 加回来。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CAPABILITY = fileURLToPath(new URL('../src-tauri/capabilities/default.json', import.meta.url))
const STORE_PATH = fileURLToPath(new URL('../src-tauri/src/store_path.rs', import.meta.url))

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

test('远程 capability 不再授予任何 store:* 权限', () => {
  const capability = readJson(CAPABILITY)
  const stringPermissions = capability.permissions.filter((entry) => typeof entry === 'string')
  const pluginStorePermissions = stringPermissions.filter((id) => id.startsWith('store:'))
  assert.deepEqual(
    pluginStorePermissions,
    [],
    `远程面不允许残留 plugin-store 权限: ${pluginStorePermissions.join(', ')}`,
  )
  assert.equal(stringPermissions.includes('store:default'), false, 'store:default 必须移除')
})

test('远程 capability 只放行白名单 store 应用命令', () => {
  const capability = readJson(CAPABILITY)
  const permissions = capability.permissions.filter((entry) => typeof entry === 'string')
  for (const id of ['allow-store-read-entry', 'allow-store-write-entry']) {
    assert.equal(permissions.includes(id), true, `缺 ${id}:远程保险库读写会整体失联`)
  }
  // 2026-11-14:号池「应用上架平台」需要 5 条 store-account-* 命令(开独立窗口/读 URL/读 Cookie 摘要/
  // 读保活接口/读请求分析)。它们不回传 Cookie 值:session 只回计数与到期时间,keepalive 只回脱敏 path,
  // probe 的请求头已脱敏;故仍属白名单应用命令,不是 plugin-store 权限面。
  const commandPermissions = permissions.filter((id) => id.startsWith('allow-store-'))
  assert.deepEqual(commandPermissions, [
    'allow-store-read-entry',
    'allow-store-write-entry',
    'allow-store-account-open',
    'allow-store-account-url',
    'allow-store-account-session',
    'allow-store-account-keepalive-target',
    'allow-store-account-probe',
  ])
})

test('Rust 白名单仍是最小必要文件集(不含 window-state.json)', () => {
  const source = readFileSync(STORE_PATH, 'utf8')
  const declaration = source.indexOf('pub const REMOTE_STORE_ALLOWLIST')
  assert.notEqual(declaration, -1, 'REMOTE_STORE_ALLOWLIST 声明必须存在')
  const allowlist = source.slice(declaration, source.indexOf('];', declaration))
  assert.match(allowlist, /("auth\.json",\s*&\["refresh_token"\])/, 'auth.json:refresh_token 必须保留')
  assert.match(
    allowlist,
    /("ihui-vault\.json",\s*&\["master_key"\])/,
    'ihui-vault.json:master_key 必须保留',
  )
  assert.equal(
    allowlist.includes('window-state.json'),
    false,
    'window-state.json 属 Rust 内部状态,不得出现在远程白名单',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
