// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-rn-compat-coverage.mjs —— 小程序端 RN 兼容层「覆盖面」对账门(2026-10-26 立)。
 *
 * 它守的是这一型事故:兼容层是为"共享屏 / RN 壳不加改动地在小程序渲染"而造的。消费面
 * 只要新增一个 `import { X } from 'react-native'`(或换图标、新路由名),而兼容层/生成物
 * 没有那一枚名字 ⇒ **babel 构建照样过**(类型位被擦除、具名导入在 CJS 互操作里读 undefined),
 * 页面运行期才炸(白屏 / undefined is not a function)。也就是"门绿而链路断"(§0.9 造好没装车=没有
 * 的对偶:装好了没覆盖=一样没有)。本门把覆盖面变成提交链上可判的三维:
 *
 *   C1 标识符覆盖 —— packages/app/src 与 apps/mobile-rn/src 从 'react-native' 具名取用的全集,
 *       必须全部是 src/rn-compat 的具名出口(类型名也算:缺了 tsc 就报 no exported member)。
 *   C2 图标覆盖   —— 消费面从 'lucide-react-native' 具名取用的全集,必须全在 icons-generated.tsx;
 *       判据 import scripts/gen-rn-compat.mjs 的 __test__(§0.6,不复制第二把尺)。
 *   C3 路由映射真值 —— rn-compat/route-map.generated.ts 里每个目标路径必须真在 app.config 的
 *       页面清单里(分包 root + page 拼接);指向不存在的页 = 声明链断了,跳过去必失败。
 *
 * 档位:三维都是**绝对零容忍**(不是差值棘轮)—— 兼容层的缺口没有"存量合理"这一说,
 * 补上即可(出口加一行 / 跑一次生成器),所以立起来当天就能是绿的;一旦红就是真断链。
 * 取不到被审面 ⇒ exit 2「未判定」(§0.3),不记绿也不冒红。
 *
 * 用法:
 *   node scripts/check-rn-compat-coverage.mjs            # 全量档(HEAD blob)
 *   node scripts/check-rn-compat-coverage.mjs --staged   # 索引 blob
 *   node scripts/check-rn-compat-coverage.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { __test__ as gen } from './gen-rn-compat.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const COMPAT_DIR = 'apps/miniapp-taro/src/rn-compat'
const CONSUMERS = ['packages/app/src', 'apps/mobile-rn/src']
/** 兼容层的出口文件集(新增文件必须在此登记,否则它导出的名字会被判成"没在册") */
const COMPAT_FILES = ['index.ts', 'primitives.tsx', 'apis.ts', 'style.ts', 'navigation.tsx', 'theme.tsx', 'storage.ts', 'platform.tsx', 'i18n.ts']
const ICONS_REL = `${COMPAT_DIR}/icons-generated.tsx`
const ROUTE_REL = `${COMPAT_DIR}/route-map.generated.ts`
const MP_CONFIG_REL = 'apps/miniapp-taro/src/app.config.ts'

/** 判定面选择一律走取材层(§0.4):两面同给当场判死 */
function faceFlags(argv) {
  return selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' }).face
}

/**
 * 面读取一律经统一取材层(§0.4 + 守门 118:门脚本不得自己派生 git 取 blob 正文):
 *  - 枚举哪些文件在消费这两个包 ⇒ git grep(只列名字,不取正文);
 *  - 正文 ⇒ face-reader 的 catBatch(全量档 HEAD / --staged 索引)或 readWorktreeFile(人工逃生舱)。
 * 取不到面 ⇒ 调用方落「未判定」,不回落另一个面。
 */
function makeReader(face) {
  const listFiles = (paths) => {
    // 只做**枚举**(哪些文件 import 了这两个包),正文一律走下面的 readMany() —— 枚举用 git grep,
    // 取正文用取材层:两者混在同一把尺里,就会出现"清单一个面、内容另一个面"的悬空判据(§0.4)。
    const args = ['grep', '-l', '-E', "from '(react-native|lucide-react-native)'"]
    if (face === 'staged') args.push('--cached')
    else if (face !== 'worktree') args.push('HEAD')
    args.push('--', ...paths)
    const out = execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return out
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => (face === 'head' ? l.replace(/^HEAD:/, '') : l))
  }
  /**
   * 批量取正文:一次 catBatch 取完整批。
   * 为什么必须批量而不是逐枚 read():消费面现读 467 个文件,逐枚起 git 进程实测把这道门
   * 拖到 2 分钟以上(超时)⇒ 门一慢就没人跑,等于没装车;而 §0.4 要求"清单与内容同面同轮",
   * 同轮正是靠一次批取完成的。取不到的路径落 null,由调用方判「未判定」。
   */
  const readMany = (rels) => {
    const uniq = [...new Set(rels)]
    if (face === 'worktree') {
      const map = new Map()
      for (const rel of uniq) map.set(rel, readWorktreeFile(ROOT, rel))
      return map
    }
    const prefix = face === 'staged' ? ':' : 'HEAD:'
    const specs = uniq.map((r) => `${prefix}${r}`)
    const got = catBatch(ROOT, specs)
    const map = new Map()
    for (const rel of uniq) map.set(rel, got.get(`${prefix}${rel}`) ?? null)
    return map
  }
  return {
    label: face === 'staged' ? '索引 blob' : face === 'worktree' ? '工作树磁盘(人工逃生舱)' : 'HEAD blob',
    listFiles,
    readMany,
  }
}

function namedImportsFrom(text, moduleName) {
  const names = new Set()
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${moduleName}(?:/[a-z-]+)?'`, 'g')
  let m
  while ((m = re.exec(text || ''))) {
    for (const raw of m[1].split(',')) {
      const t = raw
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim()
      if (t) names.add(t)
    }
  }
  return names
}

/** 兼容层具名出口集(含 `export const|function|class|let|var`、`export {A, B}`、`export type X`、`export type {A}`) */
function compatExports(contents) {
  const exported = new Set()
  for (const f of COMPAT_FILES) {
    const src = contents.get(`${COMPAT_DIR}/${f}`)
    if (!src) continue
    for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:const|function|class|let|var)\s+([A-Za-z0-9_]+)/g)) exported.add(m[1])
    for (const m of src.matchAll(/export\s+type\s+([A-Za-z0-9_]+)/g)) exported.add(m[1])
    for (const m of src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}(?:\s*from)?/g)) {
      for (const part of m[1].split(',')) {
        const name = part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .pop()
          .trim()
        if (name) exported.add(name)
      }
    }
  }
  return exported
}

export function judge(reader) {
  const findings = { c1: [], c2: [], c3: [] }
  let files
  try {
    files = reader.listFiles(CONSUMERS)
  } catch (error) {
    return { state: 'undetermined', reason: `消费面枚举失败:${String(error?.message ?? error).slice(0, 120)}`, findings }
  }
  if (files.length === 0) return { state: 'undetermined', reason: '消费面枚举到 0 个文件(判据面异常,不记绿)', findings }

  // 一次批取全部需要的正文(消费面 + 兼容层 + 生成物 + 分包清单)—— 同面同轮(§0.4)
  let contents
  try {
    contents = reader.readMany([
      ...files,
      ...COMPAT_FILES.map((f) => `${COMPAT_DIR}/${f}`),
      ICONS_REL,
      ROUTE_REL,
      MP_CONFIG_REL,
    ])
  } catch (error) {
    return { state: 'undetermined', reason: `取材失败:${String(error?.message ?? error).slice(0, 120)}`, findings }
  }
  const rnText = new Map(files.map((f) => [f, contents.get(f)]))
  if ([...rnText.values()].some((v) => v === null || v === undefined)) {
    return { state: 'undetermined', reason: '消费面有文件取不到正文(面错位,不回落另一面)', findings }
  }

  // C1 react-native 具名取用 ↔ 兼容层出口
  const rnNames = new Set()
  for (const text of rnText.values()) for (const n of namedImportsFrom(text, 'react-native')) rnNames.add(n)
  const exported = compatExports(contents)
  findings.c1 = [...rnNames].filter((n) => !exported.has(n)).sort()

  // C2 lucide 取用 ↔ 生成物。两档分别判:
  //   运行时图标名(生成器必须产出组件)—— 名字全集 import 生成器那一份实现(§0.6);
  //   类型档(如 LucideIcon)—— 只要在本文件里有具名导出即在册,它不该进组件集也不该算残名。
  // 门与生成器必须量到同一个集,否则一边绿一边红 = 又回到两把尺子各读各的。
  const faceFiles = [...rnText.entries()].map(([path, text]) => ({ path, text }))
  const runtimeIcons = new Set(gen.collectIconNames(faceFiles))
  const typeIcons = new Set()
  for (const text of rnText.values()) {
    for (const m of (text || '').matchAll(/import\s+type\s*\{([^}]*)\}\s*from\s*'lucide-react-native'/g)) {
      for (const raw of m[1].split(',')) {
        const t = raw.trim().split(/\s+as\s+/)[0].trim()
        if (t && !t.startsWith('type ')) typeIcons.add(t)
      }
    }
  }
  const iconsSrc = contents.get(ICONS_REL)
  if (iconsSrc === null) return { state: 'undetermined', reason: 'icons-generated.tsx 取不到(生成物未落地?)', findings }
  const valueExports = new Set([...iconsSrc.matchAll(/^export const ([A-Za-z0-9]+) =/gm)].map((m) => m[1]))
  const typeExports = new Set([...iconsSrc.matchAll(/^export type ([A-Za-z0-9]+) =/gm)].map((m) => m[1]))
  findings.c2 = [...runtimeIcons].filter((n) => !valueExports.has(n)).sort()
  for (const n of typeIcons) if (!typeExports.has(n) && !valueExports.has(n)) findings.c2.push(n)
  findings.c2.sort()
  // 反向:组件表里没人用的名字只报数(它由生成器按现算全集产出,残名说明生成器与被审面不同轮)
  const staleIcons = [...valueExports].filter((n) => !runtimeIcons.has(n)).sort()
  const lucideTotal = runtimeIcons.size + typeIcons.size

  // C3 路由映射目标必须真在 app.config 页面清单里
  const routeSrc = contents.get(ROUTE_REL)
  const cfgSrc = contents.get(MP_CONFIG_REL)
  if (routeSrc === null || cfgSrc === null) {
    return { state: 'undetermined', reason: '路由映射或 app.config 取不到,无法判 C3', findings }
  }
  const declared = new Set()
  for (const m of cfgSrc.matchAll(/root:\s*'([^']+)'[\s\S]*?pages:\s*\[([^\]]*)\]/g)) {
    for (const p of m[2].matchAll(/'([^']+)'/g)) declared.add(`/${m[1]}/${p[1]}`)
  }
  for (const m of cfgSrc.matchAll(/pages:\s*\[([\s\S]*?)\]/g)) {
    for (const p of m[1].matchAll(/'([^']+)'/g)) declared.add(`/${p[1]}`)
  }
  // 形态容忍两种写法:生成器原样(键带引号)与 prettier 归一后(键不带引号)——
  // lint-staged 会在提交前重排生成物,尺子按单一写法匹配就会读出 0 条并冒"没有缺口"的绿(假绿)。
  const routeEntries = [...routeSrc.matchAll(/^\s*(?:["']([A-Za-z0-9]+)["']|([A-Za-z0-9]+)):\s*["']([^"']+)["']/gm)].map(
    (m) => [m[1] ?? m[2], m[3]],
  )
  if (routeEntries.length === 0) {
    return { state: 'undetermined', reason: 'route-map.generated.ts 读到 0 条映射(表被改写或生成器没跑) ⇒ 这一维没看,不得记绿', findings }
  }
  findings.c3 = routeEntries.filter(([, path]) => !declared.has(path)).map(([name, path]) => `${name} → ${path}`)

  return {
    state: findings.c1.length + findings.c2.length + findings.c3.length > 0 ? 'red' : 'ok',
    findings,
    staleIcons,
    measured: { rnNames: rnNames.size, exported: exported.size, lucide: lucideTotal, routes: routeEntries.length, files: files.length },
  }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const cases = selfTestCases()
    let pass = 0
    for (const c of cases) {
      const got = c.got()
      const ok = got === c.want
      console.log(`${ok ? '✓' : '✗'} ${c.name}(期望 ${JSON.stringify(c.want)},实得 ${JSON.stringify(got)})`)
      if (ok) pass++
    }
    console.log(pass === cases.length ? `自检 ${pass}/${cases.length} 通过` : `❌ 自检 ${pass}/${cases.length} —— 有例不过`)
    process.exit(pass === cases.length ? 0 : 1)
  }
  const mode = faceFlags(argv)
  const reader = makeReader(mode)
  const r = judge(reader)
  console.log(`rn-compat 覆盖面对账(判定面:${reader.label})`)
  if (r.state === 'undetermined') {
    console.log(`⚠️ 未判定:${r.reason} —— 不记绿也不冒红(§0.3)`)
    process.exit(2)
  }
  const m = r.measured
  console.log(
    `  C1 标识符:消费面取用 ${m.rnNames} 个 / 兼容层出口 ${m.exported} 个 / 缺口 ${r.findings.c1.length}`,
  )
  console.log(`  C2 图标:消费面 ${m.lucide} 个 / 生成物在册 ${m.lucide - r.findings.c2.length} 个 / 缺口 ${r.findings.c2.length} / 生成物残名 ${r.staleIcons.length}(只报数)`)
  console.log(`  C3 路由:映射 ${m.routes} 条 / 指向不在册页 ${r.findings.c3.length} 条`)
  for (const [label, list] of [
    ['C1', r.findings.c1],
    ['C2', r.findings.c2],
    ['C3', r.findings.c3],
  ]) {
    if (list.length > 0) console.log(`❌ ${label} 缺口逐条:${list.join('  ')}`)
  }
  if (r.state === 'red') {
    console.log(
      '出路:C1 在 src/rn-compat 补出口(值或类型位都要补);C2 跑 `node scripts/gen-rn-compat.mjs --write`;C3 同上(路由映射由生成器按现读事实重建)。禁止为消红放宽判据。',
    )
    process.exit(1)
  }
  console.log('✅ 三维覆盖对账通过(消费面取用全集 ⊆ 兼容层/生成物,映射目标全在册)')
  process.exit(0)
}

/** 自检:用纯判据函数证明"摘掉即翻红"(§22c 同形;夹具不落盘) */
function selfTestCases() {
  const base = {
    'packages/app/src/Control.tsx': `import { View, StyleSheet } from 'react-native'\nimport { Heart } from 'lucide-react-native'\n`,
    [`${COMPAT_DIR}/index.ts`]: `export const StyleSheet = {}\nexport type ViewStyle = unknown\n`,
    [`${COMPAT_DIR}/primitives.tsx`]: `export const View = () => null\nexport const Text = () => null\n`,
    [`${COMPAT_DIR}/icons-generated.tsx`]: `export const Heart = null\n`,
    [`${COMPAT_DIR}/route-map.generated.ts`]: `export const RN_ROUTE_MAP = {\n  'Login': '/pkg-user/login/index',\n}\n`,
    'apps/miniapp-taro/src/app.config.ts': `subpackages: [{ root: 'pkg-user', pages: ['login/index'] }]\n`,
  }
  const reader = (overrides) => {
    const face = { ...base, ...overrides }
    return {
      label: '夹具',
      listFiles: () => ['packages/app/src/Control.tsx'],
      readMany: (rels) => new Map(rels.map((r) => [r, face[r] ?? null])),
    }
  }
  return [
    { name: '覆盖齐 ⇒ ok', want: 'ok', got: () => judge(reader({})).state },
    {
      name: 'C1 摘掉 StyleSheet 出口 ⇒ 点名 1 枚',
      want: 1,
      got: () =>
        judge(reader({ [`${COMPAT_DIR}/index.ts`]: `export type ViewStyle = unknown\n` })).findings.c1.length,
    },
    {
      name: 'C2 生成物换成别的图标 ⇒ 点名 1 枚',
      want: 1,
      got: () =>
        judge(reader({ [`${COMPAT_DIR}/icons-generated.tsx`]: `export const Star = null\n` })).findings.c2.length,
    },
    {
      name: 'C3 映射指向不在册页 ⇒ 点名 1 条',
      want: 1,
      got: () =>
        judge(
          reader({
            [`${COMPAT_DIR}/route-map.generated.ts`]: `export const RN_ROUTE_MAP = {\n  'Ghost': '/pkg-user/ghost/index',\n}\n`,
          }),
        ).findings.c3.length,
    },
    {
      name: '生成物不在面 ⇒ 未判定(不记绿)',
      want: 'undetermined',
      got: () =>
        judge({
          label: '夹具',
          listFiles: () => ['packages/app/src/Control.tsx'],
          readMany: (rels) => new Map(rels.map((r) => [r, r === ICONS_REL ? null : (base[r] ?? null)])),
        }).state,
    },
    {
      name: '消费面枚举 0 文件 ⇒ 未判定(不记绿)',
      want: 'undetermined',
      got: () => judge({ label: '夹具', listFiles: () => [], readMany: (rels) => new Map(rels.map((r) => [r, base[r] ?? null])) }).state,
    },
  ]
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  main()
}

export const __test__ = { judge, namedImportsFrom, compatExports, makeReader, faceFlags }
