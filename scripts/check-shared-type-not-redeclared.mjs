#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 共享类型端内重声明对账
 *
 * 拦的是这一型:同一份对外契约(REST 请求/响应、实体形状)在 `packages/types` 已有一份定义,
 * 端内又手抄一份 `interface`。它没有编译期症状 —— 两边各自成立,`tsc` 全绿;漂移的表现是
 * 「同一接口在手机上少一个筛选参数」这类端间行为差异,而本仓最高频的失效形态是安静。
 *
 * 立项凭据(2026-10-16 实测,不是假想):`GET/POST/DELETE /api/memory` 的四个契约在
 * `apps/web/src/lib/memory-api.ts`、`apps/mobile-rn/src/screens/MemoryScreen.tsx`、
 * `apps/cli/src/commands/memory.ts` 各写一份,其中 `MemoryCreateInput.source` 两份可选一份必填,
 * 而后端 `apps/api/src/routes/memory.ts` 的 `createEntrySchema` 对它 `.default('api')`;
 * 同时 `packages/types` 早就导出了 `MemoryEntry/MemoryScope/MemoryEntryType`。三端三抄零判据 ⇒ 本门。
 *
 * 判据(H1)与放过通道:
 *  - **命中**:端内文件在**顶层**声明 `interface X` / `type X =`,而 `X` 在被审面的共享导出名集合里。
 *  - **放过 A(别名收回单源)**:`type X = Y` 且 `Y` 是本文件 import 进来的标识符 —— 那是把抄本改回
 *    单源时保留旧名的正当写法,不是第二份真相。
 *  - **放过 C(不在共享集合)**:端内私有类型完全不在射程(同名才算,宁漏不误报)。
 *
 * 定级:提交链走**该文件 HEAD 自身命中数**的差值棘轮 —— 现读存量非零,当场 blocking 就是一台与任何
 * 提交都无关的恒红门(AGENTS §12e),唯一结局是各会话 `--no-verify` 连带废掉链上全部对账。
 * **无行内豁免通道**:这一型只有"改 import 共享出口"一条正解,不存在合理动作被误伤的形态。
 *
 * 取材面(AGENTS §0.4 / 守门 118):全量档判 **HEAD blob**,`--staged` 判**索引 blob** 且端内射面
 * 跟着本次变更走,`--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2。共享名集合**恒取整面**
 * (按变更收窄共享面会让"少一个共享名"伪装成合规,而端内命中数恰好依赖这份名单);
 * 共享面枚举到 0 个 `.ts` 或解析出 0 个对外名 ⇒ 判死不记绿。
 *
 * 用法:`node scripts/check-shared-type-not-redeclared.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * 退出码:0 通过(含"只有存量") / 1 本次带进来的命中 / 2 无法判定。
 *
 * 接线状态(如实登记,不撒谎):**尚未接进提交链** —— 落地当轮 `scripts/guardian-runner.mjs`
 * 正被他席的未合并冲突(UU)持有,按 AGENTS §12 只报不动;在那里插注册块会和他的合并互相覆盖。
 * 今天的问责入口就是上面那条直跑命令(CI/巡检档 `--strict`);接进提交链的前置 = 该注册表
 * 回到单一写者、且用 `scripts/gate-registry-insert.mjs` 以 HEAD 为底取号插入并同枚点名。
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHARED_SRC = 'packages/types/src'
/** 端内面:会重声明共享契约的地方(共享 types 包自身与工具层不在射程)。 */
const CONSUMER_DIRS = ['apps', 'packages/app/src', 'packages/shared/src', 'packages/ui-native/src']
const SELF_EXEMPT = ['check-shared-type-not-redeclared']
const TS_RE = /\.(ts|tsx)$/
const SKIP_FILE_RE = /(\.test\.|\.spec\.|\.d\.ts$)/
const TEST_PATH_RE = /(^|\/)(?:tests?|__tests__|__mocks__|e2e)\//
/** 顶层声明:行首可选 `export` / `declare`。缩进行一律不判(嵌套型与散文都不算端内对外契约)。 */
const TOP_DECL_RE = /^(?:export\s+)?(?:declare\s+)?(interface|type)\s+([A-Za-z_$][\w$]*)\b(.*)$/
const IMPORT_RE = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g

const specOf = (face, rel) => (face === 'staged' ? `:${rel}` : `HEAD:${rel}`)
const keep = (rel) => TS_RE.test(rel) && !SKIP_FILE_RE.test(rel) && !TEST_PATH_RE.test(rel)

function gitZ(args) {
  return String(gitRaw(args, ROOT))
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 共享面整棵枚举 —— 名单必须全,所以不按变更收窄。
 * `--staged` 档仍枚举 HEAD 树上的共享文件再按索引取正文:索引里没人改的共享文件与 HEAD 同形,
 * 而 `:` 前缀取的就是索引那份,两侧同面同轮。
 */
export function listSharedPaths(face) {
  const args =
    face === 'worktree'
      ? ['ls-files', '-z', '--', SHARED_SRC]
      : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', SHARED_SRC]
  return gitZ(args).filter(keep)
}

/** 端内面:`--staged` 只咬本次变更(同守门 34/134 口径),其余档扫全树。 */
export function listConsumerPaths(face) {
  const args =
    face === 'staged'
      ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...CONSUMER_DIRS]
      : face === 'worktree'
        ? ['ls-files', '-z', '--', ...CONSUMER_DIRS]
        : ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...CONSUMER_DIRS]
  return gitZ(args).filter(keep)
}

/** 共享包导出的对外类型名。纯函数,构造面可证。 */
export function sharedTypeNames(text) {
  const names = new Set()
  for (const src of Object.values(text)) {
    if (typeof src !== 'string') continue
    for (const line of src.split(/\r?\n/)) {
      const m = TOP_DECL_RE.exec(line)
      if (!m) continue
      if (!/^\s*export\b/.test(line)) continue // 非导出 = 包内私有,不是对外契约
      names.add(m[2])
    }
  }
  return names
}

export function importedNames(src) {
  const out = new Set()
  for (const m of src.matchAll(IMPORT_RE)) {
    for (const piece of m[1].split(',')) {
      const t = piece.trim().replace(/^type\s+/, '')
      if (!t) continue
      const as = t.split(/\s+as\s+/)
      out.add((as[1] || as[0]).trim())
      out.add(as[0].trim())
    }
  }
  return out
}

/** 顶层声明清单(带别名右值,判放过 A 用)。 */
export function declarations(src) {
  const out = []
  for (const line of src.split(/\r?\n/)) {
    const m = TOP_DECL_RE.exec(line)
    if (!m) continue
    const [, kind, name, rest] = m
    const alias =
      kind === 'type'
        ? /^\s*=\s*([A-Za-z_$][\w$]*)(?:\.[\w$]+)?\s*;?\s*$/.exec(rest ?? '')
        : null
    out.push({ kind, name, alias: alias ? alias[1] : null })
  }
  return out
}

/** 判据本体:端内文件 × 共享名集合 → 命中 / 放过 / 未判定。三态绝不并桶。 */
export function judge(files, shared) {
  const hits = []
  const passed = []
  const undetermined = []
  for (const [path, src] of Object.entries(files)) {
    if (typeof src !== 'string') {
      undetermined.push({ path, why: '正文取不到 ⇒ 这一份没判(不记通过也不记违规)' })
      continue
    }
    const imports = importedNames(src)
    for (const d of declarations(src)) {
      if (!shared.has(d.name)) continue
      if (d.alias && imports.has(d.alias)) {
        passed.push({ path, name: d.name, why: `别名指向共享出口 ${d.alias}` })
        continue
      }
      hits.push({ path, name: d.name, kind: d.kind })
    }
  }
  return { hits, passed, undetermined }
}

function readFace(face, paths) {
  const out = {}
  if (!paths.length) return out
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(ROOT, p)
      if (typeof t === 'string') out[p] = t
    }
    return out
  }
  const map = catBatch(ROOT, paths.map((rel) => specOf(face, rel)))
  for (const p of paths) {
    const v = map.get(specOf(face, p))
    if (typeof v === 'string') out[p] = v
  }
  return out
}

function runSelfTest() {
  let pass = 0
  let fail = 0
  // cond 必须是**已求值布尔**:把箭头函数当 cond 传进来会恒真(门 150 票㛛那一课)。
  const t = (name, cond) => {
    if (cond === true) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.log(`  ❌ ${name} —— 实得:${JSON.stringify(cond)}`)
    }
  }
  const sharedSrc = {
    'packages/types/src/x.ts': [
      'export interface MemoryEntry { id: string }',
      'export type MemoryScope = "a" | "b"',
      'interface NotExported {}',
      'export declare interface Shadowed {}',
    ].join('\n'),
  }
  const shared = sharedTypeNames(sharedSrc)
  t('S1 收到导出的 interface 与 type', shared.has('MemoryEntry') && shared.has('MemoryScope'))
  t('S2 非导出的包内私有型不算对外契约', !shared.has('NotExported'))
  t('S2b declare 导出型同样收进来', shared.has('Shadowed'))

  const h = judge({ 'apps/web/src/a.ts': 'export interface MemoryEntry { id: string }\n' }, shared)
  t('S3 端内顶层重声明共享型 ⇒ 命中', h.hits.length === 1 && h.hits[0].name === 'MemoryEntry')

  const alias = judge(
    {
      'apps/cli/src/a.ts':
        "import type { MemoryListResponse as X } from '@ihui/types';\ntype MemoryEntry = X;\n",
    },
    new Set([...shared, 'MemoryListResponse']),
  )
  t('S4 别名收回单源 ⇒ 放过(不得把正解判成违规)', alias.hits.length === 0 && alias.passed.length === 1)

  const aliasLocal = judge({ 'apps/web/src/b.ts': 'type MemoryEntry = SomethingLocal;\n' }, shared)
  t('S5 右值不是 import 进来的 ⇒ 仍命中(别名通道不给本地型开后门)', aliasLocal.hits.length === 1)

  const priv = judge({ 'apps/web/src/c.ts': 'interface LocalThing { a: string }\n' }, shared)
  t('S6 名字不在共享集合 ⇒ 完全不在射程', priv.hits.length === 0 && priv.passed.length === 0)

  const und = judge({ 'apps/web/src/d.ts': undefined }, shared)
  t('S7 正文取不到 ⇒ 未判定,不得记通过', und.hits.length === 0 && und.undetermined.length === 1)

  const nested = judge({ 'apps/web/src/e.ts': '  interface MemoryEntry { a: string }\n' }, shared)
  t('S8 缩进的嵌套/散文声明不判(只认顶层)', nested.hits.length === 0)

  const useOnly = judge(
    { 'apps/web/src/f.ts': 'const x: MemoryEntry = 1\nfunction f(v: { MemoryEntry: string }) {}\n' },
    shared,
  )
  t('S9 使用点(非声明)不判红', useOnly.hits.length === 0)

  t(
    'S10 路径过滤:测试面/`.d.ts` 出射程,`.tsx`/`.ts` 在射程',
    [
      ['apps/web/x.test.ts', false],
      ['apps/web/tests/x.ts', false],
      ['apps/web/x.d.ts', false],
      ['apps/web/x.tsx', true],
      ['packages/types/src/x.ts', true],
    ].every(([p, want]) => keep(p) === want),
  )

  const iface = judge(
    { 'apps/web/src/g.ts': "import type { MemoryEntry as X } from '@ihui/types';\ninterface MemoryEntry { a: string }\n" },
    shared,
  )
  t('S11 导入了共享名但仍另写同名 interface ⇒ 命中(import 不遮丑)', iface.hits.length === 1)

  console.log(`\n${pass}/${pass + fail} 条通过`)
  return fail ? 1 : 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(runSelfTest())
  const asJson = argv.includes('--json')
  const strict = argv.includes('--strict')
  let face
  try {
    // ⚠️ `selectFace` 返回的是**对象**(`{face, note}`),不是面名。直接把它当字符串用会让
    // `face === 'staged'` 恒假 ⇒ `--staged` 静默改读 HEAD blob —— 本仓在
    // `check-plan-sha-resolvable.mjs` 上记过同型缺陷("三面同读 HEAD")。这里显式取 `.face`,
    // 并保留对旧签名的兜底(取不到名字就判死,绝不退化成"看起来跑过了")。
    const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
    face = typeof sel === 'string' ? sel : sel?.face
    if (!['staged', 'head', 'worktree'].includes(face)) {
      console.error(`❌ 取材面解析不出(${JSON.stringify(sel)})⇒ 无法判定,不记绿也不冒红`)
      process.exit(2)
    }
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(2)
  }

  const sharedPaths = listSharedPaths(face)
  if (!sharedPaths.length) {
    console.error(`❌ 共享面(${face})枚举到 0 个 .ts ⇒ 判死,不记绿`)
    process.exit(2)
  }
  const sharedFiles = readFace(face, sharedPaths)
  if (Object.keys(sharedFiles).length === 0) {
    console.error(`❌ 共享面正文一条都取不到(${face})⇒ 无法判定,不记绿`)
    process.exit(2)
  }
  const shared = sharedTypeNames(sharedFiles)
  if (!shared.size) {
    console.error(`❌ 共享面解析出 0 个对外类型名(${face})⇒ 判死,不记绿`)
    process.exit(2)
  }

  const consumerPaths = listConsumerPaths(face).filter(
    (p) => !SELF_EXEMPT.some((s) => p.includes(s)),
  )
  const files = readFace(face, consumerPaths)
  const { hits, passed, undetermined } = judge(files, shared)

  let red = []
  let ratcheted = 0
  if (face === 'worktree') {
    red = hits
  } else {
    const byPath = {}
    for (const h of hits) (byPath[h.path] ??= []).push(h)
    const headFiles = readFace('head', Object.keys(byPath))
    for (const [path, list] of Object.entries(byPath)) {
      const src = headFiles[path]
      // 新文件不在 HEAD 上 ⇒ 锚点 0(读不到不许 exit 2,否则每次"新增一个文件"都被恒挡)
      const allowance = typeof src === 'string' ? judge({ [path]: src }, shared).hits.length : 0
      list.forEach((h, i) => {
        if (i + 1 > allowance) red.push(h)
        else ratcheted += 1
      })
    }
  }
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          face,
          sharedNames: shared.size,
          scanned: Object.keys(files).length,
          hits: hits.length,
          // detail 是逐条清单:只有计数 ⇒ 262 处存量无人能清(清账必须先知道"哪条在哪个文件"),
          // 而让清账方自己再写一份扫描 = §22c 禁的"同一判据第二份"。red 用同一批对象引用回标,
          // 不再第二遍算棘轮。
          detail: hits.map((h) => ({
            path: h.path,
            name: h.name,
            line: h.line ?? null,
            isRed: red.includes(h),
          })),
          red,
          ratcheted,
          passed: passed.length,
          undetermined,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `判定面 ${face}:共享对外类型名 ${shared.size} 个 · 端内文件 ${Object.keys(files).length} 个`,
    )
    console.log(
      `端内重声明命中 ${hits.length} 处(本次新增判红 ${red.length} · 存量按该文件 HEAD 棘轮只报数 ${ratcheted})`,
    )
    for (const h of red.slice(0, 40)) console.log(`  ❌ ${h.path} :: ${h.kind} ${h.name}`)
    if (hits.length > red.length)
      console.log(`  ⓘ 另有 ${hits.length - red.length} 处属存量(与本次提交无关),清偿动作 = 改 import 共享出口`)
    for (const u of undetermined.slice(0, 10)) console.log(`  ? 未判定:${u.path} —— ${u.why}`)
    if (undetermined.length > 10) console.log(`  ? 其余 ${undetermined.length - 10} 条未判定同上`)
    console.log(`  ✓ 放过 ${passed.length} 处(别名指向共享出口,正当写法)`)
  }
  if (strict && undetermined.length) {
    console.error(`❌ 有 ${undetermined.length} 条未判定 ⇒ 拒绝出具合格证`)
    process.exit(2)
  }
  if (red.length) {
    console.error('❌ 端内新增了共享类型重声明 ⇒ 改 import 自 @ihui/types(AGENTS §3 共享层优先)')
    process.exit(1)
  }
  // `--json` 档的 stdout 必须只有 JSON —— 尾随一行人类读语会砸碎解析(AGENTS 记过多次:
  // 「豁免标记要在原文面数 + 新打印要分档」)。判据结论由退出码 + JSON 字段承载,这句只给人在读面看。
  if (!asJson) console.log('✅ 无新增端内重声明(存量随该文件 HEAD 棘轮只报数)')
}

// §22d 入口守卫:镜像测试 import 本模块时不得触发 CLI 主流程(裸 main() 由守门 194 判红)。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  sharedTypeNames,
  importedNames,
  declarations,
  judge,
  keep,
  specOf,
  listSharedPaths,
  listConsumerPaths,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
