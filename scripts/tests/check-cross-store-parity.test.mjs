// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-cross-store-parity.mjs'
import { readFileSync as readFsSync } from 'node:fs'
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
  const root = mkScratch('ihui-parity-')
  mkdirSync(join(root, 'scripts'), { recursive: true })
  // 2026-09-28:本门收口为"判定面可选"并支持 `--root` 测试通道 ⇒ 不再需要把脚本(和它的
  // scripts/lib 依赖闭包)拷进夹具 —— 直接派生真脚本 + `--root <夹具>` 判磁盘面。
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
  return spawnSync(process.execPath, [SOURCE_SCRIPT, '--root', root.replace(/\\/g, '/')], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    // 绝对 node 二进制 + windowsHide + 数字 timeout(AGENTS §5b / §守门 52):
    // 裸 'node' 依赖 PATH,钩子/服务上下文里取不到;无 windowsHide 会为每次派生弹可见控制台。
    windowsHide: true,
    timeout: 120000,
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    assert.match(r.stderr, /auth-store\.ts 的 AuthStoreState 声明了 token,而 partialize 没有 Pick 键集收窄/)
  } finally {
    rmScratch(root)
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
    rmScratch(root)
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
    rmScratch(root)
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
    assert.match(r.stderr, /\[shared\] auth-store\.ts 的 AuthStoreState 声明了 token/)
    // 应输出问题总数
    assert.match(r.stderr, /❌ 发现 3 处问题/)
  } finally {
    rmScratch(root)
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
    rmScratch(root)
  }
})

/* ════════════════════════════════════════════════════════════════════════════
   partialize 判据换成语义式之后的三条"有牙 + 不放水"证明(2026-09-28)
   立因:旧判据写死字面串 `Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>`,
   G-456 把键集**收窄得更严**成 `Pick<AuthStoreState<TUser>, 'user'>` 之后,门反过来报
   "partialize 包含 token 字段(违反安全契约)"—— 一句假话,而且它挂在 pre-commit 的
   批外 blocking 步上,此后每次提交都被迫 --no-verify(§12f 的 P0 型:红在干净 HEAD 上的
   门,优先级高于一切新增)。三条各挡一个方向:
     A 阳性:真把 token 列进持久化键集 ⇒ 必红并点名(换成语义判据不等于放水)
     B 反向:比旧写法更严的收窄 ⇒ 必绿(否则同一台恒红门原地复活)
     C 真仓对照:仓库自己那份 auth-store 判出来必须是"有收窄、零 token 键"
   ════════════════════════════════════════════════════════════════════════════ */
test('A 阳性:partialize 把 accessToken 列进 Pick ⇒ exit 1 并点名该键(语义判据不是无条件放行)', () => {
  const root = createTempProject()
  try {
    const badAuth = VALID_AUTH_STORE.replace(
      "Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>",
      "Pick<AuthStoreState<TUser>, 'user' | 'accessToken'>",
    )
    writeAllValid(root)
    writeAuthStore(root, badAuth)
    const r = runScript(root)
    assert.equal(r.status, 1, `持久化 token 必须 exit 1,实际 ${r.status}`)
    assert.match(r.stderr, /把 token 材料写进存储:accessToken/)
  } finally {
    rmScratch(root)
  }
})

test('B 反向:比旧字面串更严的收窄(只留 user)必须 exit 0 —— 这正是 09-28 被误判红的那一种', () => {
  const root = createTempProject()
  try {
    const stricter = VALID_AUTH_STORE.replace(
      "Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>",
      "Pick<AuthStoreState<TUser>, 'user'>",
    )
    writeAllValid(root)
    writeAuthStore(root, stricter)
    const r = runScript(root)
    assert.equal(r.status, 0, `更严的键集收窄不该被判红(判红=一台恒红门),实际 ${r.status}:${r.stderr}`)
  } finally {
    rmScratch(root)
  }
})

test('C 真仓对照:analyzePartialize 对本仓 auth-store 的现读必须是"有 Pick 收窄 + 零 token 键"', () => {
  const src = readFsSync(
    join(__dirname, '..', '..', 'packages', 'shared', 'src', 'stores', 'auth-store.ts'),
    'utf8',
  )
  const got = G.analyzePartialize(src)
  assert.equal(got.hasPartialize, true, '本仓 auth-store 必须有 partialize;取不到先怀疑尺子')
  assert.equal(
    got.hasPickNarrowing,
    true,
    '本仓用 Pick 声明持久化键集 ⇒ 判据必须认得它(认不得就是 09-28 那台恒红门)',
  )
  assert.deepEqual(got.persistedTokenKeys, [], `本仓不应持久化任何 token 键,量到:${got.persistedTokenKeys.join(', ')}`)
  assert.ok(got.stateTokenKeys.length > 0, '阳性对照:AuthStoreState 确实声明了 token 档 —— 否则本条是在对空集判绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
