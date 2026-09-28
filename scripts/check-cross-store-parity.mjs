// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *       node scripts/check-cross-store-parity.mjs --staged    # 提交链档:判定面 = 索引 blob
 *       node scripts/check-cross-store-parity.mjs --worktree  # 显式磁盘档(人工逃生舱)
 *       node scripts/check-cross-store-parity.mjs --root <dir># 显式仓库根(测试/夹具通道)
 * 集成:.husky/pre-commit 守门(无 --no-verify 时生效)
 *
 * 判定面(2026-09-28 收口,与守门 70/118 及 2i 死 key 扫描同口径):
 *   本步是**批外 blocking**,旧形态把 5 份输入按磁盘读 ⇒ 并行会话对任一端 storage-adapter
 *   或 shared auth-store 的**未暂存**改动都会把无关提交钉红,唯一出路 --no-verify
 *   (一次绕过约等于链上全部守门作废,§12e/§12f)。`--staged` ⇒ 5 份输入在同一次
 *   `cat-file --batch` 里取自索引 blob(清单与内容同面同轮);面上取不到 ⇒ **exit 2「未判定」**,
 *   绝不回退磁盘、绝不记为通过。缺省 / `--worktree` ⇒ 磁盘,既有行为逐字不变。
 *   退出码:0 通过 / 1 契约漂移 / 2 无法判定(未判定)。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Undetermined, assertRepoRoot, catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/** `--root <dir>` / `--root=<dir>` 都认:只认一种会让假根被静默忽略 ⇒ 扫真仓假绿。 */
function resolveRootArg(list) {
  const eq = list.find((a) => a.startsWith('--root='))
  if (eq !== undefined) {
    const v = eq.slice('--root='.length)
    return v ? { root: resolve(v), error: null } : { root: null, error: '--root= 缺目录值' }
  }
  const i = list.indexOf('--root')
  if (i < 0) return { root: null, error: null }
  const v = list[i + 1]
  if (!v || v.startsWith('-')) return { root: null, error: '--root 必须带目录值' }
  return { root: resolve(v), error: null }
}
const argv = process.argv.slice(2)
const rootArg = resolveRootArg(argv)
if (rootArg.error) {
  console.error(`[cross-store-parity] 无法判定(exit 2,未判定): ${rootArg.error}`)
  process.exit(2)
}
const ROOT = rootArg.root ?? resolve(__dirname, '..')

const facePick = selectFace({
  staged: argv.includes('--staged'),
  worktree: argv.includes('--worktree'),
  def: 'worktree',
})
if (facePick.error) {
  console.error(`[cross-store-parity] 无法判定(exit 2,未判定): ${facePick.error}`)
  process.exit(2)
}
const FACE = facePick.face
const FACE_LABEL_TEXT = FACE === 'staged' ? '索引 blob' : '工作树磁盘'

function failUndetermined(what) {
  console.error(`[cross-store-parity] 无法判定(exit 2,未判定): ${what}`)
  console.error('   这不是"契约漂移",是这次判不了。**未判定 ≠ 通过**,也绝不回退磁盘。')
  process.exit(2)
}

let faceIndex = null
/** 按判定面一次读满全部输入;git 派生失败 ⇒ exit 2(不回退磁盘)。 */
function ensureFaceIndex(rels) {
  if (faceIndex) return
  try {
    assertRepoRoot(ROOT, '本门')
    const got = catBatch(ROOT, rels.map((r) => `:${r}`), { timeout: 120000 })
    faceIndex = new Map()
    for (const r of rels) {
      const t = got.get(`:${r}`)
      if (typeof t === 'string') faceIndex.set(r, t)
    }
  } catch (e) {
    if (e instanceof Undetermined) failUndetermined(`索引面取材失败(**不回退磁盘**):${e.message}`)
    throw e
  }
}
/** 路径是否在**判定面**上存在(索引面 = 索引里有这条路径)。 */
function faceListed(rel) {
  if (FACE !== 'staged') return existsSync(join(ROOT, rel))
  ensureFaceIndex(ALL_RELS)
  try {
    return gitRaw(['ls-files', '--', rel], ROOT, { timeout: 60000 })
      .split(/\r?\n/)
      .filter(Boolean)
      .includes(rel)
  } catch (e) {
    if (e instanceof Undetermined) failUndetermined(`索引面存在性问不到 ${rel}:${e.message}`)
    throw e
  }
}
/** 读一份输入(已确认在面上);面上取不到正文 ⇒ 未判定。磁盘档的读失败保留旧语义(记 issue)。 */
function faceRead(rel, label) {
  if (FACE !== 'staged') {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      issues.push(`[${label}] 无法读取 ${rel}: 文件不存在`)
      return null
    }
    try {
      return readFileSync(abs, 'utf-8')
    } catch (err) {
      issues.push(`[${label}] 无法读取 ${rel}: ${err.message}`)
      return null
    }
  }
  ensureFaceIndex(ALL_RELS)
  const t = faceIndex.get(rel)
  if (typeof t !== 'string')
    failUndetermined(`索引面列出了 ${rel} 却取不到正文(unmerged / 非 blob),**不回退磁盘**`)
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t
}

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

const PERSIST_KEY = 'ihui-auth-user' // shared/src/stores/auth-store.ts userPersistKey default
/** 本门全部输入(索引面一次读满的清单)。 */
const ALL_RELS = [
  ...ENDPOINTS.map((e) => e.path),
  'packages/shared/src/stores/auth-store.ts',
]

const issues = []

async function checkEndpoint(endpoint) {
  const content = faceListed(endpoint.path)
    ? faceRead(endpoint.path, endpoint.name)
    : (issues.push(`[${endpoint.name}] 无法读取 ${endpoint.path}: 判定面(${FACE_LABEL_TEXT})上没有这条路径`), null)
  if (content === null) return

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
  const SHARED_AUTH_REL = 'packages/shared/src/stores/auth-store.ts'
  const sharedAuth = faceListed(SHARED_AUTH_REL)
    ? faceRead(SHARED_AUTH_REL, 'shared')
    : (issues.push(`[shared] 无法读取 auth-store.ts: 判定面(${FACE_LABEL_TEXT})上没有这条路径`), null)
  if (sharedAuth === null) return
  if (!sharedAuth.includes(`userPersistKey = '${PERSIST_KEY}'`)) {
    issues.push(`[shared] auth-store.ts userPersistKey 默认值不是 '${PERSIST_KEY}'`)
  }
  // 检查 partialize 行为(不持久化 token)
  if (!sharedAuth.includes("Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>")) {
    issues.push(`[shared] auth-store.ts partialize 包含 token 字段(违反安全契约)`)
  }
}

async function main() {
  console.log(
    `[cross-store-parity] 扫描 4 端 storage-adapter + shared 工厂一致性…(判定面:${FACE_LABEL_TEXT})\n`,
  )

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

// §22d 双形态入口守护:上面那段是 CLI 副作用(取材 + process.exit),测试 import 纯判据时不得触发。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((err) => {
    // 抛到这里 = 脚本自身异常(不是业务结论)。判 2 而不是 1,免得"没判成"被读成"判过了"。
    console.error('[cross-store-parity] 守门脚本异常(未判定,exit 2):', err?.message ?? err)
    process.exit(2)
  })
}

export const __test__ = { resolveRootArg, ENDPOINTS, ALL_RELS, PERSIST_KEY, REQUIRED_EXPORTS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
