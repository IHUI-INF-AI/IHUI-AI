// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gen-rn-compat.mjs —— 小程序端 RN 兼容层的**图标面**生成器(默认只读预演,`--write` 才落盘)。
 *
 * 为什么必须生成而不是手写:共享层(packages/app)取图标走 `lucide-react-native` 具名导入,
 * 小程序端只要有一个名字没人产出,那一屏就整块编译失败。手写清单必然追不上屏的增长
 * (2026-10-26 现读:共享层 78 个文件用了 87 个图标名)。本器把"图标覆盖面"变成
 * 一条可重跑的生成腿 —— 新增图标只需重跑本器,不需要任何人记得登记。
 *
 * 判据零复算(§0.6):SVG 构形 import scripts/gen-taro-lucide-icons.mjs 的 __test__.generate
 * (与端内静态 svg 同一个 lucide 取源与同一段解析代码)。
 *
 * 取材:名字全集来自 **HEAD blob**(§0.4),扫 packages/app/src 与 apps/mobile-rn/src 两处
 * `import { ... } from 'lucide-react-native'`;取不到 HEAD ⇒ exit 2「未判定」,不回落工作树。
 *
 * Usage:
 *   node scripts/gen-rn-compat.mjs              # 预演:打印将产出的图标名与缺口
 *   node scripts/gen-rn-compat.mjs --write      # 写 icons-generated.tsx + route-map.generated.ts
 *   node scripts/gen-rn-compat.mjs --check      # 已产出文件与现读全集对账(供守门 import)
 */
/* eslint-disable no-console -- CLI 工具,需 console 输出预演/落地清单 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as lucide } from './gen-taro-lucide-icons.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const R = (...p) => join(ROOT, ...p)
const OUT_REL = 'apps/miniapp-taro/src/rn-compat/icons-generated.tsx'
/** lucide PascalCase 名 → kebab-case 文件名(BarChart3 → bar-chart-3;数字前后都要断) */
function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .toLowerCase()
}

/**
 * PascalCase 名 → 实际图标文件。
 * 先按 kebab 直取;取不到就按**每个图标文件自述的默认导出名**建一张权威表
 * (`export { __iconNode, Trash2 as default }`)。理由:lucide 版本升级会改名文件
 * (bar-chart-3 → chart-column 这类),按名猜文件必然腐烂;而文件里的默认导出名
 * 就是 `lucide-react` 对外出口的那个名字 —— 以它为准才叫现读,不是以我的拼写规则为准。
 */
let ICON_INDEX_CACHE = null
function iconFileIndex() {
  if (ICON_INDEX_CACHE) return ICON_INDEX_CACHE
  const map = new Map()
  for (const file of readdirSync(lucide.LUCIDE_DIR)) {
    if (!file.endsWith('.mjs')) continue
    const src = readFileSync(join(lucide.LUCIDE_DIR, file), 'utf8')
    const m = /export \{ __iconNode, ([A-Za-z0-9]+) as default \}/.exec(src)
    if (m) map.set(m[1], file.replace(/\.mjs$/, ''))
    const alias = /export \{ default \} from '\.\/([\w-]+)\.mjs;?/.exec(src)
    if (alias) map.set(file.replace(/\.mjs$/, ''), alias[1])
  }
  ICON_INDEX_CACHE = map
  return map
}

function resolveIconKey(name) {
  const direct = kebab(name)
  if (existsSync(join(lucide.LUCIDE_DIR, `${direct}.mjs`))) return direct
  const idx = iconFileIndex()
  const byPascal = idx.get(name)
  if (byPascal) return byPascal
  const kebabToPascal = new Map([...idx.entries()].map(([p, k]) => [k, p]))
  const viaKebab = kebabToPascal.get(direct)
  return viaKebab ? idx.get(viaKebab) : null
}

/** 从某个面的源码里抽出 lucide 具名导入全集 */
function collectIconNames(files) {
  const names = new Set()
  for (const { path: filePath, text } of files) {
    const re = /import\s*\{([^}]*)\}\s*from\s*'lucide-react-native'/g
    let m
    while ((m = re.exec(text))) {
      for (const raw of m[1].split(',')) {
        const t = raw.trim().split(/\s+as\s+/)[0].trim()
        if (t && !t.startsWith('type ')) names.add(t)
      }
    }
    void filePath
  }
  return [...names].sort()
}

/** 列目录(HEAD 面)再逐文件取正文 —— 与守门同口径,不读工作树 */
function readHeadFace(dirs) {
  const stdout = execFileSync('git', ['grep', '-l', 'lucide-react-native', 'HEAD', '--', ...dirs], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((spec) => ({
      path: spec.replace(/^HEAD:/, ''),
      text: execFileSync('git', ['show', spec], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 1 << 26,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    }))
}

function buildTable(names) {
  const rows = []
  const missing = []
  for (const name of names) {
    const key = resolveIconKey(name)
    if (!key) {
      missing.push(name)
      continue
    }
    // 描边固定纯黑:本层的图标是 CSS mask(只取 alpha),颜色由 background 决定 ⇒ 随主题换色
    rows.push(`  '${name}': ${JSON.stringify(lucide.generate(key, '#000000'))},`)
  }
  return { rows, missing }
}

function renderSource(names, rows) {
  const declared = rows
    .map((r) => /^  '([A-Za-z0-9]+)':/.exec(r)?.[1])
    .filter(Boolean)
    // 走 src(name) 而不是 S[name]:本仓 ts 开了 noUncheckedIndexedAccess ⇒ 直接索引会读成
    // string | undefined,而 makeIcon 的入参是 string ⇒ 216 处类型错全落在这一行模板上(2026-10-26 实测)
    .map((name) => `export const ${name} = makeIcon(${JSON.stringify(name)}, src(${JSON.stringify(name)}))`)
  return `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * ⚠️ 生成物,请勿手改 —— 重新生成:\`node scripts/gen-rn-compat.mjs --write\`
 *
 * 内容:共享层(packages/app)与 RN 端取用的全部 lucide 图标 —— 一个名字一枚具名导出,
 * 与 \`import { Heart } from 'lucide-react-native'\` 同形,所以 alias 过去后各屏零改动可用。
 * 名字全集按 HEAD 面现算:新增图标只要被任何一屏 import,重跑生成器即覆盖,不需要人工登记。
 * (缺这一格时的现场:webpack 具名导入取不到 ⇒ 该屏整块编译失败,而不是少一个图标。)
 *
 * 渲染口径:SVG 为纯黑描边,由 CSS mask 只取 alpha ⇒ 实际颜色走 background-color,
 * 与端内 LineIcon 同一手法,主题切换时随 token 换色(不会定死成黑色)。
 */
import { makeIcon } from './icons-runtime'
import type { CompatIconProps } from './icons-runtime'

/** lucide-react-native 的组件类型名(消费面有写 import type { LucideIcon } 的)—— 别名指到本文件,这个类型位也必须在这里 */
export type LucideIcon = (props: CompatIconProps) => ReturnType<typeof makeIcon>

const S = {
${rows.join('\n')}
} as const

/**
 * 按图标名取 SVG。名字与表同批生成 ⇒ 正常跑不会缺;真缺了(手动改过本文件/生成器漏名)
 * **大声告警并画占位**,而不是把 undefined 交给 makeIcon —— 那既过不了类型,也会在运行期静默少一枚图标。
 */
function src(name: string): string {
  const hit: string | undefined = S[name as keyof typeof S]
  if (hit === undefined)
    console.warn(\`[rn-compat] 图标表里没有 '\${name}' ⇒ 渲染为占位,请重跑 node scripts/gen-rn-compat.mjs --write\`)
  return hit ?? ''
}

${declared.join('\n')}
`
}

/**
 * 路由名映射(供 rn-compat/navigation 用)。
 * 两条现读事实 join,不靠名字猜:
 *   ① RN 导航器里 `<Stack.Screen name="Login" component={LoginScreen} />` + 该组件的 import 路径
 *      ⇒ 路由名 ↔ RN 壳文件;
 *   ② 跨端登记表(scripts/data/cross-end-screen-registry.json)的 rn ↔ miniapp 路由
 *      ⇒ RN 壳文件 ↔ 小程序页面路径。
 * 映射不到的名字**不进表**(运行时由 shim 点名"这一跳没执行"),而不是给一个近似路径 ——
 * 跳错页比停在原地更难查(§0.3 同源口径:取不到不冒绿)。
 */
const RN_NAVIGATOR = 'apps/mobile-rn/src/navigation/RootNavigator.tsx'
const REGISTRY = 'scripts/data/cross-end-screen-registry.json'
const ROUTE_OUT_REL = 'apps/miniapp-taro/src/rn-compat/route-map.generated.ts'

function headBlob(rel) {
  return execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function buildRouteMap() {
  const nav = headBlob(RN_NAVIGATOR)
  const registry = JSON.parse(headBlob(REGISTRY))
  const byRn = new Map(registry.entries.filter((e) => e.rn && e.miniapp).map((e) => [e.rn, e.miniapp]))
  // 组件名 → 壳文件(import X from '../screens/Y')
  const compToFile = new Map()
  for (const m of nav.matchAll(/import\s+(\w+)\s+from\s+'\.\.\/screens\/([\w/-]+)'/g)) {
    compToFile.set(m[1], `apps/mobile-rn/src/screens/${m[2]}.tsx`)
  }
  const map = new Map()
  const unmapped = []
  for (const m of nav.matchAll(/\.Screen\s*\n?\s*name=["']([\w-]+)["']\s+component=\{(\w+)\}/g)) {
    const [, routeName, comp] = [m[0], m[1], m[2]]
    const file = compToFile.get(comp)
    if (!file) continue
    const miniapp = byRn.get(file)
    if (!miniapp) {
      unmapped.push(`${routeName}(${comp})`)
      continue
    }
    map.set(routeName, `/${miniapp}`)
  }
  return { map, unmapped, total: compToFile.size }
}

function renderRouteMap(map) {
  const lines = [...map.entries()].sort().map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
  return `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * ⚠️ 生成物,请勿手改 —— 重新生成:\`node scripts/gen-rn-compat.mjs --write\`
 *
 * RN 路由名 → 小程序页面路径。判据 = RN 导航器的 Screen 登记 ∪ 跨端登记表的 rn↔miniapp 对,
 * 两条现读事实 join(取名规则猜路径必然漂移)。不在表里的路由名 = 小程序端尚无对应页,
 * 由 rn-compat/navigation 运行时点名"这一跳未执行",绝不跳到一个像的名字上去。
 */
export const RN_ROUTE_MAP: Record<string, string> = {
${lines.join('\n')}
}
`
}

/**
 * 生成物落盘后先过 prettier(按仓库自己的配置),**再**注入水印。
 * 为什么必须同轮归一:lint-staged 会在提交前重排生成物(实测把 `'AccountCancel': "/x"` 改成
 * `AccountCancel: '/x'`)⇒ 生成器下次跑就报"有变化"、门按旧形态匹配就读到 0 条 ——
 * 差异与正确性无关却常年占用改动面,还会把尺子喂成假绿(派生钉要按格式化后的最终形态重算)。
 */
async function formatWithPrettier(relPath) {
  const abs = R(relPath)
  const prettier = await import('prettier')
  const options = await prettier.resolveConfig(abs)
  const formatted = await prettier.format(readFileSync(abs, 'utf8'), {
    ...options,
    parser: relPath.endsWith('.tsx') ? 'typescript' : 'typescript',
    filepath: abs,
  })
  writeFileSync(abs, formatted, 'utf8')
}

/**
 * 生成物落盘后**紧随**注入溯源水印(§5c:生成器 writeFileSync 后必须注入,用 process.execPath +
 * 绝对路径)。不注入的后果不是"少一行注释":check-watermark-coverage 会把这一枚判成
 * 未覆盖/残迹,而它按被审面判 ⇒ 下一次提交链直接红,且红在没人写过这行的地方。
 */
function injectWatermark(relPath) {
  try {
    execFileSync(process.execPath, [R('scripts', 'watermark.mjs'), 'inject', R(relPath)], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    console.error(`❌ 水印注入失败(${relPath}):${String(error?.message ?? error).slice(0, 140)}`)
    process.exit(2)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const write = argv.includes('--write')
  const check = argv.includes('--check')
  let face
  try {
    face = readHeadFace(['packages/app/src', 'apps/mobile-rn/src'])
  } catch (error) {
    console.error(`❌ 未判定:HEAD 面取不到(${String(error).slice(0, 160)})`)
    process.exit(2)
  }
  if (face.length === 0) {
    console.error('❌ 未判定:HEAD 面枚举到 0 个 lucide 消费文件(判据面异常,不记绿)')
    process.exit(2)
  }
  const names = collectIconNames(face)
  const { rows, missing } = buildTable(names)
  const outPath = R(OUT_REL)
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : ''
  const next = renderSource(names, rows)

  console.log(`lucide 消费文件 ${face.length} 个 · 图标名 ${names.length} 个 · 可产出 ${rows.length} 个`)
  if (missing.length > 0) {
    console.log(`⚠️ lucide 词表里取不到形体的名字 ${missing.length} 个(将被渲染为占位,须人工换名):${missing.join(' ')}`)
  }
  if (check) {
    // 盘上生成物是 `export const X = makeIcon(...)` 形态(渲染器换代后已无 `  'X':` 表格)。
    // 旧尺子按表格正则取「在册」,于是永远量到"一个都没有" ⇒ --check 恒 exit 1、门 251 C2 的
    // 修复出口变成跑不通的出路(§0.8)。改成与写出口同一形态,"在册"只有这一种读法。
    const covered = new Set([...current.matchAll(/^export const ([A-Za-z0-9]+) =/gm)].map((m) => m[1]))
    const uncovered = names.filter((n) => !covered.has(n))
    if (uncovered.length > 0) {
      console.log(`❌ 已产出文件缺 ${uncovered.length} 个名字:${uncovered.join(' ')}`)
      console.log('   出路:node scripts/gen-rn-compat.mjs --write')
      process.exit(1)
    }
    console.log(`✅ 图标覆盖面与现读全集对平(${names.length} 个)`)
    return
  }
  const routeInfo = buildRouteMap()
  const routeOut = R(ROUTE_OUT_REL)
  const routeCurrent = existsSync(routeOut) ? readFileSync(routeOut, 'utf8') : ''
  const routeNext = renderRouteMap(routeInfo.map)

  // 幂等判据取**语义档**(名字集合/映射键集合),不取字节:落盘内容会先过 prettier 再注水印,
  // 拿未格式化的稿与盘上副本比字节必然永不相等 ⇒ 每轮都"有变化",改动面被无意义的重写长期占用。
  const iconNamesNew = rows.map((r) => /^  '?([A-Za-z0-9]+)'?:/.exec(r)?.[1]).filter(Boolean)
  const iconNamesOnDisk = [...current.matchAll(/^export const ([A-Za-z0-9]+) =/gm)].map((m) => m[1])
  const iconsAlreadyCovered =
    current.length > 0 &&
    iconNamesOnDisk.length >= iconNamesNew.length &&
    iconNamesNew.every((n) => iconNamesOnDisk.includes(n))
  const routeKeysNew = [...routeInfo.map.keys()]
  const routeKeysOnDisk = [...routeCurrent.matchAll(/^\s*(?:'([A-Za-z0-9]+)'|([A-Za-z0-9]+)):\s*'/gm)].map((m) => m[1] ?? m[2])
  const routesAlreadyCovered =
    routeCurrent.length > 0 &&
    routeKeysOnDisk.length >= routeKeysNew.length &&
    routeKeysNew.every((k) => routeKeysOnDisk.includes(k))
  console.log(
    `路由名映射:${routeInfo.map.size} 条在册 / 映射不到 ${routeInfo.unmapped.length} 条(运行时点名)/ 导航器壳文件 ${routeInfo.total} 个`,
  )
  if (write) {
    if (iconsAlreadyCovered) console.log(`✓ 图标无变化(盘上生成物已覆盖现读全集 ${iconNamesNew.length} 名)`)
    else {
      writeFileSync(outPath, next, 'utf8')
      await formatWithPrettier(OUT_REL)
      injectWatermark(OUT_REL)
      console.log(`✓ 已写 ${OUT_REL}(${rows.length} 个图标,已按仓库 prettier 配置归一并注入水印)`)
    }
    if (routesAlreadyCovered) console.log(`✓ 路由映射无变化(盘上已覆盖现读 ${routeKeysNew.length} 条)`)
    else {
      writeFileSync(routeOut, routeNext, 'utf8')
      await formatWithPrettier(ROUTE_OUT_REL)
      injectWatermark(ROUTE_OUT_REL)
      console.log(`✓ 已写 ${ROUTE_OUT_REL}(${routeInfo.map.size} 条路由,已归一 + 注水印)`)
    }
    return
  }
  console.log('(预演模式,未写盘;加 --write 落地)')
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isDirectRun) {
  main().catch((error) => {
    console.error(`❌ ${String(error?.message ?? error)}\n${error?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { kebab, collectIconNames, buildTable, renderSource, OUT_REL }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
