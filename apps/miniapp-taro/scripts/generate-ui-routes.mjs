// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 生成小程序端「AI 可导航页面」白名单 → src/constants/ui-routes.generated.ts
// 数据源:src/app.config.ts(pages / subPackages / tabBar.list)+ 各页 *.config.ts 的
// navigationBarTitleText(页面级 config 只含标题,故它就是 describe/read 的标题来源)。
// 用法:node apps/miniapp-taro/scripts/generate-ui-routes.mjs(package.json: pnpm gen:ui-routes)
// 消费方:src/lib/ui-action-registry.ts —— AI 的 navigate 目标必须命中本清单,否则 ROUTE_NOT_ALLOWED。

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(scriptDir, '..')
const repoRoot = resolve(appRoot, '..', '..')
const srcDir = join(appRoot, 'src')
const appConfigPath = join(srcDir, 'app.config.ts')
const outFile = join(srcDir, 'constants', 'ui-routes.generated.ts')

/** 与 .prettierrc 的 printWidth 对齐,超出则按 prettier 习惯展开成多行(产物需 prettier --check 稳定) */
const PRINT_WIDTH = 100

/**
 * 把 Taro 配置文件求值成普通对象。
 *
 * 为什么不自己写 AST/正则解析:配置文件的真实形态就是 `export default defineXxxConfig({...})`,
 * 自写解析器与 Taro 语法永远有漂移风险(注释、尾逗号、嵌套对象)。这里只做两处最小改写:
 * ① 去掉 TS 字面量类型断言(app.config.ts 仅 1 处:`as 'white' | 'black'`);
 * ② `export default` → `return`。其余交给 JS 引擎自己解析,配置文件怎么写这里就怎么读。
 * 注:配置文件里的水印注释是合法 JS 注释,原样保留不影响求值。
 */
function evalConfigModule(absPath) {
  const raw = readFileSync(absPath, 'utf8')
  const js = raw.replace(/\s+as\s+[^,;}\]\n]+/g, '').replace(/^export default\s+/m, 'return ')
  return new Function('defineAppConfig', 'definePageConfig', js)(
    (c) => c,
    (c) => c,
  )
}

/** East Asian Wide/Fullwidth 字符按 2 列计,与 prettier getStringWidth 同规则 */
function columnWidth(text) {
  let w = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    const wide =
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6)
    w += wide ? 2 : 1
  }
  return w
}

/** 字符串字面量:默认单引号(prettier singleQuote),含单引号/反斜杠时改用 JSON 双引号形式 */
function literal(value) {
  if (/['\\]/.test(value)) return JSON.stringify(value)
  return `'${value}'`
}

/** 递归收集待扫描源码文件(跳过生成产物/声明文件/测试 —— 测试里的 url 不是真实导航) */
function collectSourceFiles(dir, acc) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'generated' || name === '__tests__') continue
      collectSourceFiles(abs, acc)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    if (name.endsWith('.d.ts') || name.endsWith('.generated.ts') || name.endsWith('.config.ts'))
      continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue
    acc.push(abs)
  }
  return acc
}

/**
 * 剥掉注释只留代码。
 *
 * 不剥的话,一句文档注释「例如 /pkg-ai/ai/chat?id=xx」就能把该页标成需要参数——白名单
 * 必须来自真实导航代码,不能被说明文字投票。`[^:]//` 的限定避免误伤 'https://…' 字面量;
 * 宁可有漏判不可有假判:requiresParams 只是给 AI 的提示,漏判不影响页面可跳。
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * 静态判定「哪些页面是靠 query 传参打开的」。
 * 依据:全端导航一律裸调 Taro.navigateTo/redirectTo 且把参数拼在 url 上(无集中路由表),
 * 所以「代码字面量里出现 /<path>?…」即为该页需要参数。不做人工维护表,避免与页面实现漂移。
 */
function detectParamRoutes(routePathSet) {
  const hits = new Set()
  const re = /['"`]\/((?:pages|pkg-[a-z0-9-]+)\/[A-Za-z0-9_\-/]+)\?/g
  for (const file of collectSourceFiles(srcDir, [])) {
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const m of text.matchAll(re)) {
      const path = `/${m[1]}`
      if (routePathSet.has(path)) hits.add(path)
    }
  }
  return hits
}

function buildRoutes() {
  const appConfig = evalConfigModule(appConfigPath)
  const mainPages = appConfig.pages
  const subPackages = appConfig.subPackages ?? []
  const tabList = appConfig.tabBar?.list ?? []
  const windowTitle = appConfig.window?.navigationBarTitleText ?? ''

  if (!Array.isArray(mainPages) || mainPages.length === 0) {
    throw new Error('app.config.ts 未解析出 pages 数组,拒绝生成空白名单')
  }

  const flat = [
    ...mainPages.map((page) => ({ page, root: '' })),
    ...subPackages.flatMap((sp) =>
      (sp.pages ?? []).map((page) => ({ page: `${sp.root}/${page}`, root: sp.root })),
    ),
  ]

  const tabPaths = new Set(tabList.map((item) => `/${item.pagePath}`))
  const titles = new Map()
  for (const tab of tabList) {
    titles.set(`/${tab.pagePath}`, tab.text ?? '')
  }

  const seen = new Set()
  const routes = flat.map(({ page, root }) => {
    const path = `/${page}`
    if (seen.has(path)) throw new Error(`app.config.ts 出现重复页面: ${path}`)
    seen.add(path)

    const configFile = join(srcDir, `${page}.config.ts`)
    let title = ''
    if (existsSync(configFile)) {
      const pageConfig = evalConfigModule(configFile)
      if (typeof pageConfig?.navigationBarTitleText === 'string') {
        title = pageConfig.navigationBarTitleText
      }
    }
    // 无页面 config(或 config 未写标题)时回落 app 级 window 标题;tabBar 页用 tab 文案兜底,
    // 因为 AI 拿到空标题等于拿不到可读定位信息
    if (!title) title = titles.get(path) || windowTitle

    return {
      path,
      title,
      tab: tabPaths.has(path),
      subPackageRoot: root,
      requiresParams: false, // 由 detectParamRoutes 统一回填
      hasOwnConfig: existsSync(configFile),
    }
  })

  for (const tabPath of tabPaths) {
    if (!seen.has(tabPath)) throw new Error(`tabBar.pagePath 不在 pages 清单内: ${tabPath}`)
  }

  const paramRoutes = detectParamRoutes(seen)
  for (const route of routes) route.requiresParams = paramRoutes.has(route.path)

  return {
    routes,
    mainCount: mainPages.length,
    subRootCount: subPackages.length,
    tabCount: tabPaths.size,
    windowTitle,
  }
}

function emitEntry(entry, indent) {
  const fields = [
    `path: ${literal(entry.path)}`,
    `title: ${literal(entry.title)}`,
    `tab: ${entry.tab}`,
    `subPackageRoot: ${literal(entry.subPackageRoot)}`,
    `requiresParams: ${entry.requiresParams}`,
  ]
  const single = `${indent}{ ${fields.join(', ')} },`
  if (columnWidth(single) <= PRINT_WIDTH) return [single]
  // 超出 printWidth 时按 prettier 的展开形态输出,保证产物格式化幂等
  return [`${indent}{`, ...fields.map((f) => `${indent}  ${f},`), `${indent}},`]
}

function emitFile({ routes, windowTitle }) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT. 由 apps/miniapp-taro/scripts/generate-ui-routes.mjs 生成(pnpm gen:ui-routes)',
    '// 数据源:src/app.config.ts(pages/subPackages/tabBar)+ 各页 *.config.ts 的 navigationBarTitleText;',
    '// requiresParams 由扫描源码 navigateTo url 是否带 query 得出。改页面请改 app.config.ts 后重新生成。',
    '',
    '/** AI 可导航页面条目:path 为 Taro 导航全路径(含前导斜杠,分包已拼 root) */',
    'export interface TaroUiRouteEntry {',
    '  /** Taro 导航 url,如 /pkg-ai/ai/chat */',
    '  path: string',
    '  /** navigationBarTitleText(无页面 config 时回落 app window 标题 / tabBar 文案) */',
    '  title: string',
    '  /** 是否 tabBar 页:true 必须走 Taro.switchTab(navigateTo 会直接失败) */',
    '  tab: boolean',
    "  /** 所属分包 root,主包为 ''(分包页必须用全路径才能命中) */",
    '  subPackageRoot: string',
    '  /** 源码中该页是否以 ?query 形式打开(如 /pkg-ai/ai/chat?id=xx) */',
    '  requiresParams: boolean',
    '}',
    '',
    '/** app.config.ts → window.navigationBarTitleText,页面无显式标题时的回落值 */',
    `export const TARO_APP_WINDOW_TITLE = ${literal(windowTitle)}`,
    '',
    '/** 全量页面白名单(顺序与 app.config.ts 一致,便于 diff 审查) */',
    'export const TARO_UI_ROUTES: readonly TaroUiRouteEntry[] = [',
  ]
  for (const route of routes) lines.push(...emitEntry(route, '  '))
  lines.push(']', '')
  return `${lines.join('\n')}\n`
}

function main() {
  const { routes, mainCount, subRootCount, tabCount, windowTitle } = buildRoutes()
  const withTitle = routes.filter((r) => r.hasOwnConfig).length
  const paramRoutes = routes.filter((r) => r.requiresParams).length

  const content = emitFile({ routes, windowTitle })
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, content, 'utf8')

  // 溯源水印:产物是 git 跟踪文件,受 check-watermark-coverage 门禁约束;inject 幂等,
  // 同一载荷重复生成不产生 diff(参考 gen-i18n-compressed.mjs 的实现)
  try {
    execFileSync(
      process.execPath,
      [resolve(repoRoot, 'scripts/watermark.mjs'), 'inject', outFile],
      {
        stdio: 'inherit',
        windowsHide: true,
      },
    )
  } catch (e) {
    console.error(
      `[gen:ui-routes] ❌ 溯源水印注入失败,产物会让 watermark 门禁恒红: ${e?.message ?? e}`,
    )
    process.exit(1)
  }

  console.log(
    `[gen:ui-routes] 页面 ${routes.length} 条 = 主包 ${mainCount} + 分包 ${subRootCount} 个 root 合计 ${routes.length - mainCount};tabBar ${tabCount} 页;带标题配置 ${withTitle} 页;query 传参页 ${paramRoutes} 页`,
  )
  console.log(`[gen:ui-routes] 已写入 ${outFile}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
