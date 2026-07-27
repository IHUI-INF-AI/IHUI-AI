// check-cross-store-parity.mjs 测试
//
// 测试策略:
//   源脚本用 import.meta.url 推导 ROOT(= 脚本所在目录的父目录),
//   因此把脚本复制到临时目录的 scripts/ 下,即可在临时目录的
//   apps/<端>/src/stores/storage-adapter.ts 和
//   packages/shared/src/stores/auth-store.ts 创建 fixture 供脚本读取,
//   不污染真实项目。
//
// 覆盖核心规则:
//   - 检查 1: 必需导出(export function / export const 两种形式)
//   - 检查 2: PersistTransport / createSyncTransport / createMemoryTransport 引用
//   - 检查 3: getItem / setItem / removeItem 三个核心方法(同步 + async 形式)
//   - 检查 shared: userPersistKey 默认值 + partialize Pick 类型
//   - 退出码: 0(通过)/ 1(发现问题)/ 2(异常,不在此测试)
//   - 边界: 文件缺失 / 多重失败合并报告 / 端点列表输出
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-cross-store-parity.mjs')

// ─── 4 端 storage-adapter 路径映射(与源脚本 ENDPOINTS 一致) ─
const ADAPTER_PATHS = {
  'web': 'apps/web/src/stores/storage-adapter.ts',
  'mobile-rn': 'apps/mobile-rn/src/stores/storage-adapter.ts',
  'miniapp-taro': 'apps/miniapp-taro/src/stores/storage-adapter.ts',
  'extension': 'apps/extension/src/stores/storage-adapter.ts',
}

const SHARED_AUTH_PATH = 'packages/shared/src/stores/auth-store.ts'

// ─── 辅助:创建临时项目(含 scripts/ 下的脚本副本) ────────
// 关键:脚本用 import.meta.url 推导 ROOT,复制后 ROOT 变为临时目录
function createTempProject() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-parity-'))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(root, 'scripts', 'check-cross-store-parity.mjs'))
  return root
}

// ─── 辅助:写入某端 storage-adapter ───────────────────────
function writeAdapter(root, endpoint, content) {
  const fullPath = join(root, ADAPTER_PATHS[endpoint])
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

// ─── 辅助:写入 shared auth-store ─────────────────────────
function writeAuthStore(root, content) {
  const fullPath = join(root, SHARED_AUTH_PATH)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}

// ─── 辅助:运行脚本(从临时项目根目录) ───────────────────
function runScript(root) {
  const scriptPath = join(root, 'scripts', 'check-cross-store-parity.mjs')
  return spawnSync('node', [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 合规 fixture:4 端 + shared 全部满足 8 条检查 ────────
const VALID_ADAPTERS = {
  // web: 2 个必需导出 + PersistTransport 引用 + 3 个同步方法
  'web': `import { PersistTransport } from '@ihui/shared/stores/transport'
export function createLocalStorageTransport(): PersistTransport {
  return { getItem: (k) => null, setItem: (k, v) => {}, removeItem: (k) => {} }
}
export function createSSRSafeWebTransport(): PersistTransport {
  return createLocalStorageTransport()
}
`,
  // mobile-rn: 1 个必需导出 + PersistTransport + 3 个 async 方法
  'mobile-rn': `import { PersistTransport } from '@ihui/shared/stores/transport'
export function createAsyncStorageTransport(): PersistTransport {
  return { getItem: async (k) => null, setItem: async (k, v) => {}, removeItem: async (k) => {} }
}
`,
  // miniapp-taro: 1 个必需导出 + createMemoryTransport 引用(无 PersistTransport)
  // 注意:源脚本检查 3 用正则扫文件内容的 getItem/setItem/removeItem,
  // 因此即使委托给 createMemoryTransport,也需在文件里出现方法名
  'miniapp-taro': `import { createMemoryTransport } from '@ihui/shared/stores/transport'
export function createTaroStorageTransport() {
  const t = createMemoryTransport()
  return {
    getItem: (k) => t.getItem(k),
    setItem: (k, v) => t.setItem(k, v),
    removeItem: (k) => t.removeItem(k),
  }
}
`,
  // extension: 1 个必需导出 + createSyncTransport 引用(无 PersistTransport)
  'extension': `import { createSyncTransport } from '@ihui/shared/stores/transport'
export function createChromeStorageTransport() {
  const t = createSyncTransport()
  return {
    getItem: (k) => t.getItem(k),
    setItem: (k, v) => t.setItem(k, v),
    removeItem: (k) => t.removeItem(k),
  }
}
`,
}

// shared auth-store:userPersistKey 默认值 + partialize Pick 类型
const VALID_AUTH_STORE = `import type { PersistTransport } from './transport'
export interface AuthStoreState<TUser> { user: TUser; token: string; isAuthenticated: boolean }
export const userPersistKey = 'ihui-auth-user'
export function createAuthStore<TUser>(transport: PersistTransport) {
  return {
    partialize: (s: AuthStoreState<TUser>): Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'> => ({
      user: s.user, isAuthenticated: s.isAuthenticated,
    }),
  }
}
`

// ─── 辅助:写入全部 4 端 + shared(合规快照) ─────────────
function writeAllValid(root) {
  for (const [ep, content] of Object.entries(VALID_ADAPTERS)) {
    writeAdapter(root, ep, content)
  }
  writeAuthStore(root, VALID_AUTH_STORE)
}

// ═══════════════════════════════════════════════════════════
// 检查 1: 必需导出
// ═══════════════════════════════════════════════════════════

// ─── 1. golden path: 4 端 + shared 全部合规 → exit 0 ──────
test('golden path: 4 端 + shared 全部合规 → exit 0', () => {
  const root = createTempProject()
  try {
    writeAllValid(root)
    const r = runScript(root)
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /✅/, '应输出 ✅ 标识通过')
    assert.match(r.stdout, /一致性校验通过/, '应输出"一致性校验通过"')
    assert.match(r.stdout, /8\/8 项/, '应输出 8/8 项')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 检查 1: export const 形式也接受(不只 export function) ─
test('检查 1: export const 形式也接受 → exit 0', () => {
  const root = createTempProject()
  try {
    // web 用 export const 替代 export function
    const webConst = `import { PersistTransport } from '@ihui/shared/stores/transport'
export const createLocalStorageTransport = (): PersistTransport => {
  return { getItem: (k) => null, setItem: (k, v) => {}, removeItem: (k) => {} }
}
export const createSSRSafeWebTransport = (): PersistTransport => createLocalStorageTransport()
`
    writeAdapter(root, 'web', webConst)
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 0, `export const 形式应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. 检查 1: 缺必需导出 createLocalStorageTransport → exit 1 ─
test('检查 1: web 缺 createLocalStorageTransport → exit 1', () => {
  const root = createTempProject()
  try {
    // 去掉 export 关键字,让脚本检测不到
    const badWeb = VALID_ADAPTERS['web'].replace(
      'export function createLocalStorageTransport',
      'function createLocalStorageTransport',
    )
    writeAdapter(root, 'web', badWeb)
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `缺必需导出应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[web\] 缺少必需导出: createLocalStorageTransport/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 检查 1: mobile-rn 缺 createAsyncStorageTransport → exit 1 ─
test('检查 1: mobile-rn 缺 createAsyncStorageTransport → exit 1', () => {
  const root = createTempProject()
  try {
    const badMobile = VALID_ADAPTERS['mobile-rn'].replace(
      'export function createAsyncStorageTransport',
      'export function _createAsyncStorageTransport',
    )
    writeAdapter(root, 'web', VALID_ADAPTERS['web'])
    writeAdapter(root, 'mobile-rn', badMobile)
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `mobile-rn 缺导出应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[mobile-rn\] 缺少必需导出: createAsyncStorageTransport/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 检查 2: PersistTransport / transport 工厂引用
// ═══════════════════════════════════════════════════════════

// ─── 5. 检查 2: 三选一引用均接受(createSyncTransport / createMemoryTransport) ──
test('检查 2: createSyncTransport / createMemoryTransport 三选一引用均接受 → exit 0', () => {
  const root = createTempProject()
  try {
    // miniapp-taro 用 createMemoryTransport,extension 用 createSyncTransport
    // 都不含 PersistTransport 字符串 → 应通过(已在 golden path 验证,此处显式断言)
    writeAdapter(root, 'web', VALID_ADAPTERS['web'])
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 0, `三选一引用应 exit 0,实际 ${r.status}`)
    // 确保两个 fixture 确实不含 PersistTransport 字符串
    assert.ok(!VALID_ADAPTERS['miniapp-taro'].includes('PersistTransport'))
    assert.ok(!VALID_ADAPTERS['extension'].includes('PersistTransport'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 检查 2: 缺所有 transport 引用 → exit 1 ────────────
test('检查 2: web 无 PersistTransport / createSyncTransport / createMemoryTransport → exit 1', () => {
  const root = createTempProject()
  try {
    // web 完全不引用任何 transport 工厂/类型
    const badWeb = `export function createLocalStorageTransport() {
  return { getItem: (k) => null, setItem: (k, v) => {}, removeItem: (k) => {} }
}
export function createSSRSafeWebTransport() {
  return createLocalStorageTransport()
}
`
    writeAdapter(root, 'web', badWeb)
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `缺 transport 引用应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[web\] 未引用 shared PersistTransport \/ transport 工厂/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 检查 3: getItem / setItem / removeItem 三个核心方法
// ═══════════════════════════════════════════════════════════

// ─── 7. 检查 3: 缺 getItem 方法 → exit 1 ──────────────────
test('检查 3: web 缺 getItem 方法 → exit 1', () => {
  const root = createTempProject()
  try {
    const badWeb = VALID_ADAPTERS['web'].replace('getItem: (k) => null, ', '')
    writeAdapter(root, 'web', badWeb)
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `缺 getItem 应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[web\] 缺 getItem 方法/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 检查 3: 缺 setItem 方法 → exit 1 ──────────────────
test('检查 3: mobile-rn 缺 setItem 方法 → exit 1', () => {
  const root = createTempProject()
  try {
    const badMobile = VALID_ADAPTERS['mobile-rn'].replace('setItem: async (k, v) => {}, ', '')
    writeAdapter(root, 'web', VALID_ADAPTERS['web'])
    writeAdapter(root, 'mobile-rn', badMobile)
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `缺 setItem 应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[mobile-rn\] 缺 setItem 方法/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 检查 3: 缺 removeItem 方法 → exit 1 ───────────────
test('检查 3: mobile-rn 缺 removeItem 方法 → exit 1', () => {
  const root = createTempProject()
  try {
    const badMobile = VALID_ADAPTERS['mobile-rn'].replace('removeItem: async (k) => {}', '')
    writeAdapter(root, 'web', VALID_ADAPTERS['web'])
    writeAdapter(root, 'mobile-rn', badMobile)
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `缺 removeItem 应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[mobile-rn\] 缺 removeItem 方法/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 检查 3: async 方法形式被正则接受 → exit 0 ────────
test('检查 3: async 方法形式(getItem: async ())被正则接受 → exit 0', () => {
  const root = createTempProject()
  try {
    // mobile-rn 用 async 形式(golden path 已含),此处显式验证 async 正则分支
    writeAdapter(root, 'web', VALID_ADAPTERS['web']) // 同步形式
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn']) // async 形式
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 0, `async 方法形式应被接受,实际 ${r.status}\nstderr: ${r.stderr}`)
    // 验证 mobile-rn fixture 确实用 async 形式
    assert.match(VALID_ADAPTERS['mobile-rn'], /getItem:\s*async\s*\(/)
    assert.match(VALID_ADAPTERS['mobile-rn'], /setItem:\s*async\s*\(/)
    assert.match(VALID_ADAPTERS['mobile-rn'], /removeItem:\s*async\s*\(/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 检查 shared: userPersistKey + partialize Pick
// ═══════════════════════════════════════════════════════════

// ─── 11. 检查 shared: userPersistKey 默认值不是 'ihui-auth-user' → exit 1 ─
test('检查 shared: userPersistKey 默认值错误 → exit 1', () => {
  const root = createTempProject()
  try {
    const badAuth = VALID_AUTH_STORE.replace(
      "userPersistKey = 'ihui-auth-user'",
      "userPersistKey = 'wrong-key'",
    )
    writeAllValid(root)
    writeAuthStore(root, badAuth) // 覆盖
    const r = runScript(root)
    assert.equal(r.status, 1, `userPersistKey 错误应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[shared\] auth-store\.ts userPersistKey 默认值不是 'ihui-auth-user'/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 检查 shared: 缺 partialize Pick 类型 → exit 1 ────
test('检查 shared: 缺 partialize Pick 类型(违反安全契约)→ exit 1', () => {
  const root = createTempProject()
  try {
    const badAuth = VALID_AUTH_STORE.replace(
      "Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>",
      'AuthStoreState<TUser>',
    )
    writeAllValid(root)
    writeAuthStore(root, badAuth)
    const r = runScript(root)
    assert.equal(r.status, 1, `缺 partialize Pick 应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[shared\] auth-store\.ts partialize 包含 token 字段/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 边界: 文件缺失 / 多重失败 / 端点列表输出
// ═══════════════════════════════════════════════════════════

// ─── 13. 边界: web adapter 文件不存在 → exit 1 ─────────────
test('边界: web/storage-adapter.ts 不存在 → exit 1(报告无法读取)', () => {
  const root = createTempProject()
  try {
    // 只写 3 端,跳过 web
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, VALID_AUTH_STORE)
    const r = runScript(root)
    assert.equal(r.status, 1, `文件缺失应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[web\] 无法读取 apps\/web\/src\/stores\/storage-adapter\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. 边界: shared auth-store 文件不存在 → exit 1 ──────
test('边界: packages/shared/src/stores/auth-store.ts 不存在 → exit 1', () => {
  const root = createTempProject()
  try {
    writeAdapter(root, 'web', VALID_ADAPTERS['web'])
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    // 不写 shared auth-store
    const r = runScript(root)
    assert.equal(r.status, 1, `shared 文件缺失应 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /\[shared\] 无法读取 auth-store\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. 边界: 多重失败合并报告(2+ issues 一次列出)→ exit 1 ─
test('边界: 多重失败(web 缺导出 + 缺 getItem + shared 缺 Pick)→ exit 1 全部列出', () => {
  const root = createTempProject()
  try {
    // web 同时缺导出 + 缺方法
    const badWeb = `import { PersistTransport } from '@ihui/shared/stores/transport'
function createLocalStorageTransport(): PersistTransport {
  return { setItem: (k, v) => {}, removeItem: (k) => {} }
}
export function createSSRSafeWebTransport(): PersistTransport {
  return createLocalStorageTransport()
}
`
    // shared 缺 Pick
    const badAuth = VALID_AUTH_STORE.replace(
      "Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>",
      'AuthStoreState<TUser>',
    )
    writeAdapter(root, 'web', badWeb)
    writeAdapter(root, 'mobile-rn', VALID_ADAPTERS['mobile-rn'])
    writeAdapter(root, 'miniapp-taro', VALID_ADAPTERS['miniapp-taro'])
    writeAdapter(root, 'extension', VALID_ADAPTERS['extension'])
    writeAuthStore(root, badAuth)
    const r = runScript(root)
    assert.equal(r.status, 1, `多重失败应 exit 1,实际 ${r.status}`)
    // 应同时报告 3 处问题
    assert.match(r.stderr, /\[web\] 缺少必需导出: createLocalStorageTransport/)
    assert.match(r.stderr, /\[web\] 缺 getItem 方法/)
    assert.match(r.stderr, /\[shared\] auth-store\.ts partialize 包含 token 字段/)
    // 应输出问题总数
    assert.match(r.stderr, /❌ 发现 3 处问题/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. 输出: 列出 4 端端点列表(web/mobile-rn/miniapp-taro/extension) ──
test('输出: 列出 4 端端点列表 → exit 0', () => {
  const root = createTempProject()
  try {
    writeAllValid(root)
    const r = runScript(root)
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}`)
    // 4 端路径都应出现在 stdout 端点列表
    assert.match(r.stdout, /apps\/web\/src\/stores\/storage-adapter\.ts/)
    assert.match(r.stdout, /apps\/mobile-rn\/src\/stores\/storage-adapter\.ts/)
    assert.match(r.stdout, /apps\/miniapp-taro\/src\/stores\/storage-adapter\.ts/)
    assert.match(r.stdout, /apps\/extension\/src\/stores\/storage-adapter\.ts/)
    // 端点名都应出现
    assert.match(r.stdout, /\bweb\b/)
    assert.match(r.stdout, /\bmobile-rn\b/)
    assert.match(r.stdout, /\bminiapp-taro\b/)
    assert.match(r.stdout, /\bextension\b/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
