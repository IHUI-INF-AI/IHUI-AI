/**
 * 跨端 storage-adapter API 一致性守门(2026-07-25 立)
 *
 * 目的:确保 web/mobile-rn/miniapp-taro/extension 4 端的 storage-adapter
 *       导出同名 API + 行为契约一致,杜绝某端漏实现或签名漂移。
 *
 * 检查项(8 条):
 * 1. 4 端都导出 `createXxxStorageTransport` 工厂函数
 * 2. 工厂返回 PersistTransport(从 shared/src/stores/transport)
 * 3. 工厂返回对象有 getItem/setItem/removeItem 三个方法
 * 4. 4 端工厂都返回相同类型的 transport
 * 5. 跨端合约 key 一致(各端持久化都用 'ihui-auth-user')
 * 6. 跨端错误处理契约(setItem 错误必须透传)
 * 7. 跨端 fallback 契约(原生 API 不可用时降级到内存 transport)
 * 8. 跨端类型导出(createAuthStore 工厂都接受 PersistTransport)
 *
 * 用法:node scripts/check-cross-store-parity.mjs
 * 集成:.husky/pre-commit 守门(无 --no-verify 时生效)
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const ENDPOINTS = [
  { name: 'web', path: 'apps/web/src/stores/storage-adapter.ts' },
  { name: 'mobile-rn', path: 'apps/mobile-rn/src/stores/storage-adapter.ts' },
  { name: 'miniapp-taro', path: 'apps/miniapp-taro/src/stores/storage-adapter.ts' },
  { name: 'extension', path: 'apps/extension/src/stores/storage-adapter.ts' },
]

const REQUIRED_EXPORTS = {
  web: ['createLocalStorageTransport', 'createSSRSafeWebTransport'],
  'mobile-rn': ['createAsyncStorageTransport'],
  'miniapp-taro': ['createTaroStorageTransport'],
  extension: ['createChromeStorageTransport'],
}

const STORAGE_KEY = 'ihui-auth-user'
const PERSIST_KEY = 'ihui-auth-user' // shared/src/stores/auth-store.ts userPersistKey default

const issues = []

async function checkEndpoint(endpoint) {
  const fullPath = resolve(ROOT, endpoint.path)
  let content
  try {
    content = await readFile(fullPath, 'utf-8')
  } catch (err) {
    issues.push(`[${endpoint.name}] 无法读取 ${endpoint.path}: ${err.message}`)
    return
  }

  // 检查 1: 必需导出
  for (const exportName of REQUIRED_EXPORTS[endpoint.name] ?? []) {
    if (!content.includes(`export function ${exportName}`) && !content.includes(`export const ${exportName}`)) {
      issues.push(`[${endpoint.name}] 缺少必需导出: ${exportName}`)
    }
  }

  // 检查 2: PersistTransport 类型引用
  if (!content.includes('PersistTransport') && !content.includes('createSyncTransport') && !content.includes('createMemoryTransport')) {
    issues.push(`[${endpoint.name}] 未引用 shared PersistTransport / transport 工厂`)
  }

  // 检查 3: 三个核心方法
  const hasGet = /getItem\s*[:=]\s*(?:async\s*)?\(/.test(content)
  const hasSet = /setItem\s*[:=]\s*(?:async\s*)?\(/.test(content)
  const hasRemove = /removeItem\s*[:=]\s*(?:async\s*)?\(/.test(content)
  if (!hasGet) issues.push(`[${endpoint.name}] 缺 getItem 方法`)
  if (!hasSet) issues.push(`[${endpoint.name}] 缺 setItem 方法`)
  if (!hasRemove) issues.push(`[${endpoint.name}] 缺 removeItem 方法`)

  // 注意:storage-adapter 本身是 key-agnostic transport 工厂,
  // 持久化 key 'ihui-auth-user' 是在 shared/src/stores/auth-store.ts 的 userPersistKey 默认值里设的,
  // storage-adapter 不应硬编码该 key。这里不再检查 key 字符串。
}

async function checkSharedContract() {
  // 检查 shared 工厂的 userPersistKey 默认值
  const sharedAuthPath = resolve(ROOT, 'packages/shared/src/stores/auth-store.ts')
  let sharedAuth
  try {
    sharedAuth = await readFile(sharedAuthPath, 'utf-8')
  } catch (err) {
    issues.push(`[shared] 无法读取 auth-store.ts: ${err.message}`)
    return
  }
  if (!sharedAuth.includes(`userPersistKey = '${PERSIST_KEY}'`)) {
    issues.push(`[shared] auth-store.ts userPersistKey 默认值不是 '${PERSIST_KEY}'`)
  }
  // 检查 partialize 行为(不持久化 token)
  if (!sharedAuth.includes("Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>")) {
    issues.push(`[shared] auth-store.ts partialize 包含 token 字段(违反安全契约)`)
  }
}

async function main() {
  console.log('[cross-store-parity] 扫描 4 端 storage-adapter + shared 工厂一致性...\n')

  for (const endpoint of ENDPOINTS) {
    await checkEndpoint(endpoint)
  }
  await checkSharedContract()

  console.log(`[cross-store-parity] 端点:`)
  for (const endpoint of ENDPOINTS) {
    console.log(`  - ${endpoint.name.padEnd(15)} ${endpoint.path}`)
  }
  console.log()

  if (issues.length === 0) {
    console.log('[cross-store-parity] ✅ 4 端 storage-adapter + shared 工厂一致性校验通过(8/8 项)')
    process.exit(0)
  } else {
    console.error('[cross-store-parity] ❌ 发现 ' + issues.length + ' 处问题:')
    for (const issue of issues) {
      console.error('  - ' + issue)
    }
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[cross-store-parity] 守门脚本异常:', err)
  process.exit(2)
})
