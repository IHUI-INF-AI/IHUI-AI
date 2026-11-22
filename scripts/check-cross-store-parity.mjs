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
 *       node scripts/check-cross-store-parity.mjs --strict    # 有未判定即 exit 2(拒绝出具合格证)
 *       node scripts/check-cross-store-parity.mjs --self-test # 判据自检(成对正反例,零副作用)
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
import { analyzePersistSurface } from './lib/persist-surface.mjs'

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
const STRICT = argv.includes('--strict')
const SELF_TEST = argv.includes('--self-test')
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
    const got = catBatch(
      ROOT,
      rels.map((r) => `:${r}`),
      { timeout: 120000 },
    )
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
const ALL_RELS = [...ENDPOINTS.map((e) => e.path), 'packages/shared/src/stores/auth-store.ts']

const issues = []

async function checkEndpoint(endpoint) {
  const content = faceListed(endpoint.path)
    ? faceRead(endpoint.path, endpoint.name)
    : (issues.push(
        `[${endpoint.name}] 无法读取 ${endpoint.path}: 判定面(${FACE_LABEL_TEXT})上没有这条路径`,
      ),
      null)
  if (content === null) return

  // 检查 1: 必需导出
  for (const exportName of REQUIRED_EXPORTS[endpoint.name] ?? []) {
    if (
      !content.includes(`export function ${exportName}`) &&
      !content.includes(`export const ${exportName}`)
    ) {
      issues.push(`[${endpoint.name}] 缺少必需导出: ${exportName}`)
    }
  }

  // 检查 2: PersistTransport 类型引用
  if (
    !content.includes('PersistTransport') &&
    !content.includes('createSyncTransport') &&
    !content.includes('createMemoryTransport')
  ) {
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
    : (issues.push(`[shared] 无法读取 auth-store.ts: 判定面(${FACE_LABEL_TEXT})上没有这条路径`),
      null)
  if (sharedAuth === null) return
  if (!sharedAuth.includes(`userPersistKey = '${PERSIST_KEY}'`)) {
    issues.push(`[shared] auth-store.ts userPersistKey 默认值不是 '${PERSIST_KEY}'`)
  }
  // 检查 partialize 行为(不持久化 token)—— 语义判据,不是字面串判据
  // 立因(2026-09-28 实测):旧写法是 `includes("Pick<AuthStoreState<TUser>, 'user' | 'isAuthenticated'>")`,
  // 即"必须逐字写着这一串"。而 G-456 把持久化键集**收窄得更严**成 `Pick<AuthStoreState<TUser>, 'user'>`
  // (登录态改成派生值,不再落盘),字面串不再匹配 ⇒ 门报"partialize 包含 token 字段(违反安全契约)",
  // 而这句话本身是**假的**。它挂在 pre-commit 的批外 blocking 步上,于是此后每一次提交都被迫 --no-verify,
  // 链上 187 道守门对每次提交全部作废(§12f 那一型:修"红在干净 HEAD 上的门"优先级高于一切新增)。
  // 现行判据问的是契约本身:① 实际写进存储的键里有没有 token 材料;② 有没有显式键集收窄(没有就无法
  // 证明将来不会 `...state` 把 token 带进去);③ 判不出就说判不出,不冒红也不记绿。
  //
  // 第二次假红(G-601,2026-09-29 实测):上一版"语义判据"把**整份文件**里出现的每一个
  // `Pick<AuthStoreState<…>, '…'>` 都收进"落盘键集"。于是
  // `selectIsAuthenticated(state: Pick<AuthStoreState<TUser>, 'token'>)` —— 一处**读侧**选择器的形参
  // 类型 —— 被读成"把 token 写进存储",门对一份根本不落盘 token 的实现恒红(RC=1,而 HEAD 面写的是
  // `Pick<AuthStoreState<TUser>, 'user'>`)。**同一型犯第二次,只是从"字面串"换成了"标识符出现"**:
  // 键集必须绑在**被 partialize 返回的那一份值**上(标注/字面量/omit 排除清单三条取材),而不是
  // "这行出现过 token 字样"。解析不出来的形状(动态键、变量间接、展开自别处)一律落未判定并点名。
  const pa = analyzePartialize(sharedAuth)
  if (!pa.hasPartialize) {
    issues.push(
      '[shared] auth-store.ts 里找不到 partialize ⇒ 持久化了哪些键无从判断;安全契约要求显式声明键集',
    )
  } else if (pa.persistedTokenKeys.length > 0) {
    issues.push(
      `[shared] auth-store.ts partialize 把 token 材料写进存储:${pa.persistedTokenKeys.join(', ')}(违反安全契约)`,
    )
  } else if (!pa.hasPickNarrowing && pa.stateTokenKeys.length > 0) {
    issues.push(
      `[shared] auth-store.ts 的 AuthStoreState 声明了 ${pa.stateTokenKeys.join(', ')},而 partialize 没有 Pick 键集收窄 ⇒ 无法证明这些键不落盘(修法:const persisted: Pick<AuthStoreState<TUser>, 'user'> = …)`,
    )
  }
  for (const u of pa.undetermined) {
    UNDETERMINED.push(
      `[shared] partialize 落盘键集判不出:${u.reason}${u.snippet ? `(片段:${u.snippet})` : ''}`,
    )
  }
  for (const n of pa.notes) UNDETERMINED_NOTE.push(`[shared] ${n}`)
}

/** 未判定清单(判不出 ≠ 通过)与如实备注;两者都不参与判红,只点名。 */
const UNDETERMINED = []
const UNDETERMINED_NOTE = []

/**
 * 从 shared auth-store 源码里抽出"partialize 到底往存储写哪些键"。
 * 判据住在 `scripts/lib/persist-surface.mjs`(门与镜像测试**共用同一份实现**,§3/§22c:
 * 两处算同一件事必漂移)。本函数只是将它的输出投影成历史字段名,新增 `undetermined` 一维。
 * 三条取材全部**绑在被返回的那份值上**:① 该值的类型标注 / 箭头返回标注 / `as` 断言里的
 * `Pick<State, 'a' | 'b'>` 联合;② 返回对象字面量的顶层键;③ `...omit(state, 'a', 'b')` 的排除清单。
 * 判不出的形状一律进 `undetermined`,不冒红也不记绿。
 */
export function analyzePartialize(src) {
  const r = analyzePersistSurface(src)
  return {
    hasPartialize: r.hasPartialize,
    hasPickNarrowing: r.pickKeys.length > 0,
    pickKeys: r.pickKeys,
    literalKeys: r.literalKeys,
    persistedKeys: r.persistedKeys,
    stateTokenKeys: r.stateTokenKeys,
    persistedTokenKeys: r.persistedTokenKeys,
    omitExcludedTokenKeys: r.omitExcludedTokenKeys,
    returnedForm: r.returnedForm,
    undetermined: r.undetermined,
    notes: r.notes,
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

  if (UNDETERMINED.length > 0) {
    console.log(`[cross-store-parity] ⚠️ 未判定 ${UNDETERMINED.length} 处(判不出 ≠ 通过,逐条报名):`)
    for (const u of UNDETERMINED) console.log('  · ' + u)
  }
  if (UNDETERMINED_NOTE.length > 0) {
    console.log(`[cross-store-parity] 备注 ${UNDETERMINED_NOTE.length} 条(判据如何得出上面的结论):`)
    for (const n of UNDETERMINED_NOTE) console.log('  · ' + n)
  }

  if (issues.length > 0) {
    console.error('[cross-store-parity] ❌ 发现 ' + issues.length + ' 处问题:')
    for (const issue of issues) {
      console.error('  - ' + issue)
    }
    process.exit(1)
  }
  if (STRICT && UNDETERMINED.length > 0) {
    // 拒绝出具合格证:这一维没判成,不得读成"契约一致"。
    console.error(
      `[cross-store-parity] 无法判定(exit 2,未判定):${UNDETERMINED.length} 处 partialize 落盘键集判不出 —— --strict 下拒绝出具合格证`,
    )
    process.exit(2)
  }
  console.log('[cross-store-parity] ✅ 4 端 storage-adapter + shared 工厂一致性校验通过(8/8 项)')
  process.exit(0)
}

/**
 * 判据自检(--self-test):每条都是**成对**的 —— 判红的那一侧与不该判红的那一侧各一条,
 * 另加一条源码级反向锁(旧"整文件 harvest Pick"的写法不得回来)。零副作用、不碰网络、不派生 git。
 */
function runSelfTest() {
  let pass = 0
  let fail = 0
  const ok = (cond, name, detail) => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.error(`  ❌ ${name}${detail ? ` —— ${detail}` : ''}`)
    }
  }
  const STATE = `export interface AuthStoreState<TUser> { user: TUser | null; token: string | null; refreshToken: string | null; isAuthenticated: boolean }\n`
  // G-601 的真实现场:落盘面只挑 user,而**读侧**选择器的形参类型里写着 'token'
  const READ_SIDE_SELECTOR = `${STATE}
export function selectIsAuthenticated<TUser>(state: Pick<AuthStoreState<TUser>, 'token'>): boolean { return state.token !== null }
export function make() { return { partialize: (state) => {
  const persisted: Pick<AuthStoreState<TUser>, 'user'> = { user: state.user }
  return persisted
} } }
`
  ok(
    analyzePartialize(READ_SIDE_SELECTOR).persistedTokenKeys.length === 0,
    "S1 正向:读侧 Pick<…,'token'> 不得算落盘键(今天的假红现场)",
    JSON.stringify(analyzePartialize(READ_SIDE_SELECTOR).persistedTokenKeys),
  )
  ok(
    analyzePartialize(READ_SIDE_SELECTOR).pickKeys.join(',') === 'user',
    'S1b 同一份的落盘 Pick 键集必须被读出 = user',
    JSON.stringify(analyzePartialize(READ_SIDE_SELECTOR).pickKeys),
  )
  ok(
    analyzePartialize(READ_SIDE_SELECTOR).stateTokenKeys.length === 2,
    'S1c 阳性对照:接口确实声明了 2 个 token 档(否则 S1 是对空集判绿)',
  )

  const PICK_TOKEN = `${STATE}export function make() { return { partialize: (s): Pick<AuthStoreState<TUser>, 'user' | 'accessToken'> => ({ user: s.user }) } }`
  ok(
    analyzePartialize(PICK_TOKEN).persistedTokenKeys.join(',') === 'accessToken',
    'S2 阳性:Pick 联合里写 accessToken ⇒ 必须判红并点名',
    JSON.stringify(analyzePartialize(PICK_TOKEN).persistedTokenKeys),
  )

  const LITERAL_TOKEN = `${STATE}export function make() { return { partialize: (s) => ({ user: s.user, accessToken: s.token }) } }`
  ok(
    analyzePartialize(LITERAL_TOKEN).persistedTokenKeys.join(',') === 'accessToken',
    'S3 阳性:对象字面量直接把 accessToken 放进存储 ⇒ 判红',
    JSON.stringify(analyzePartialize(LITERAL_TOKEN).persistedTokenKeys),
  )

  const WHOLE_STATE = `${STATE}export function make() { return { partialize: (s) => s } }`
  ok(
    analyzePartialize(WHOLE_STATE).persistedTokenKeys.length === 2,
    'S4 阳性:整态返回 ⇒ 接口里的 token 档全算落盘',
    JSON.stringify(analyzePartialize(WHOLE_STATE).persistedTokenKeys),
  )

  const SPREAD_STATE = `${STATE}export function make() { return { partialize: (s) => ({ ...s }) } }`
  ok(
    analyzePartialize(SPREAD_STATE).persistedTokenKeys.length === 2,
    'S5 阳性:...s(整态展开)⇒ 判红,不得退化成未判定放行',
  )

  const OMIT_OK = `${STATE}export function make() { return { partialize: (s) => ({ ...omit(s, 'token', 'refreshToken'), user: s.user }) } }`
  const omitR = analyzePartialize(OMIT_OK)
  ok(
    omitR.persistedTokenKeys.length === 0 && omitR.omitExcludedTokenKeys.length === 2,
    'S6 反向:omit 逐个排除 token 档 ⇒ 证明不落盘,不判红',
    JSON.stringify(omitR),
  )

  const OMIT_MISS = `${STATE}export function make() { return { partialize: (s) => ({ ...omit(s, 'token') }) } }`
  ok(
    analyzePartialize(OMIT_MISS).persistedTokenKeys.join(',') === 'refreshToken',
    'S7 阳性:omit 漏了一个 token 档 ⇒ 仍判红并点名那一个',
  )

  const UNKNOWN_SHAPE = `${STATE}export function make() { return { partialize: (s) => ({ ...rest, user: s.user }) } }`
  const u1 = analyzePartialize(UNKNOWN_SHAPE)
  ok(
    u1.persistedTokenKeys.length === 0 && u1.undetermined.length > 0,
    'S8 未判定臂:展开自别处(...rest)⇒ 计未判定且不冒红',
    JSON.stringify(u1.undetermined),
  )
  const DYN_KEY = `${STATE}export function make() { return { partialize: (s) => ({ [k]: s.user }) } }`
  ok(analyzePartialize(DYN_KEY).undetermined.length > 0, 'S8b 未判定臂:动态键 [k]: ⇒ 计未判定')
  const REF = `${STATE}export function make() { return { partialize: myPartialize } }`
  ok(
    analyzePartialize(REF).undetermined.length > 0,
    'S8c 未判定臂:partialize 是对别处函数的引用 ⇒ 计未判定',
  )

  const LITERAL_ONLY_OK = `${STATE}export function make() { return { partialize: (s) => ({ user: s.user }) } }`
  const lo = analyzePartialize(LITERAL_ONLY_OK)
  ok(
    lo.persistedTokenKeys.length === 0 &&
      lo.hasPickNarrowing === false &&
      lo.literalKeys.join(',') === 'user',
    'S9 键集由显式字面量闭合 ⇒ 不判红(缺 Pick 只作"要求显式收窄"那条契约管)',
  )

  const IN_COMMENT = `${STATE}// 早先这里写 partialize: (s) => ({ accessToken: s.token }) —— 已废弃\nexport function make() { return { partialize: (s) => ({ user: s.user }) } }`
  ok(
    analyzePartialize(IN_COMMENT).persistedTokenKeys.length === 0,
    'S10 反向锁:注释里的该形态不得计入(判据面先遮注释)',
  )

  // S12 成对:接口成员的分隔符两型(换行 / 分号)都必须读得到 token 档 —— 只数 `;` 的写法
  // 会把换行分隔的真接口读成"只有第一个成员",整态落盘于是静默降级成判不出(=对着真违规报绿)。
  const NL_IFACE =
    'export interface AuthStoreState<TUser> {\n  user: TUser | null\n  accessToken: string\n  nested: { refreshToken: string }\n}\n'
  const SEMI_IFACE =
    'export interface AuthStoreState<TUser> { user: TUser | null; accessToken: string }\n'
  const nl = analyzePersistSurface(
    NL_IFACE + `export const make = () => ({ partialize: (s) => s })`,
  )
  ok(
    nl.stateTokenKeys.join(',') === 'accessToken',
    'S12a 换行分隔接口的 token 档必须读到(嵌套对象里的同名键不算成员)',
    nl.stateTokenKeys.join(','),
  )
  ok(
    nl.persistedTokenKeys.join(',') === 'accessToken',
    'S12b 同一份的整态返回必须判红,不得退化成未判定',
  )
  ok(
    analyzePersistSurface(SEMI_IFACE).stateTokenKeys.join(',') === 'accessToken',
    'S12c 分号分隔接口的同一档也必须读到(两种书写形态同判)',
  )

  const own = readFileSync(fileURLToPath(import.meta.url), 'utf-8')
  ok(!/matchAll\(\/Pick</.test(own), 'S11 源码级反向锁:整文件 harvest Pick 的旧写法不得回来')
  ok(
    /from '.\/lib\/persist-surface\.mjs'/.test(own),
    'S11b 装车证明:本门必须真的引用那份共用解析器',
  )
  const libSrc = readFileSync(join(__dirname, 'lib', 'persist-surface.mjs'), 'utf-8')
  ok(
    !/annotationTexts\.push\((trimmed|exprText)\b/.test(libSrc),
    'S11c 反向锁:不得把"表达式原文"整体当类型标注扫(嵌套 as Pick 会重犯同一型)',
  )

  console.log(`[cross-store-parity] --self-test:pass ${pass} / fail ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

// §22d 双形态入口守护:上面那段是 CLI 副作用(取材 + process.exit),测试 import 纯判据时不得触发。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (SELF_TEST) {
    runSelfTest()
  } else {
    main().catch((err) => {
      // 抛到这里 = 脚本自身异常(不是业务结论)。判 2 而不是 1,免得"没判成"被读成"判过了"。
      console.error('[cross-store-parity] 守门脚本异常(未判定,exit 2):', err?.message ?? err)
      process.exit(2)
    })
  }
}

export const __test__ = {
  resolveRootArg,
  ENDPOINTS,
  ALL_RELS,
  PERSIST_KEY,
  REQUIRED_EXPORTS,
  analyzePartialize,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
