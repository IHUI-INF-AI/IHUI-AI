// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 生成 RN 端「AI 可导航 Screen」白名单 → src/constants/ui-routes.generated.ts
// 数据源:src/navigation/RootNavigator.tsx
//   ① 已登录分支的 <RootStack.Screen name="…" />(未登录分支的 3 个 Screen 在桥接挂载时根本不存在,列进去等于给 AI 假目标)
//   ② <MainTabs.Screen name="…" />(Main 容器的 5 个 tab,必须走 navigate('Main', { screen }))
//   ③ RootStackParamList 的参数类型(必填键 → requiresParams + requiredParams)
//   ④ src/navigation/linking.ts 的 ':param' 路径模式(deep link 才有的参数名补进 requiredParams)
// 用法:node apps/mobile-rn/scripts/generate-ui-routes.mjs(package.json: pnpm gen:ui-routes)
// 消费方:src/lib/ui-action-registry.ts —— AI 的 navigate 目标必须命中本清单,否则 ROUTE_NOT_ALLOWED。
// 与 miniapp-taro 同名脚本的差异:RN 没有 app.config.ts 页面清单,路由真相在导航器源码里,
// 故解析对象是 TSX/TS 而非 JSON 配置;幂等性与产物水印注入两处约定保持一致。

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(scriptDir, '..')
const repoRoot = resolve(appRoot, '..', '..')
const navDir = join(appRoot, 'src', 'navigation')
const navigatorFile = join(navDir, 'RootNavigator.tsx')
const linkingFile = join(navDir, 'linking.ts')
const outFile = join(appRoot, 'src', 'constants', 'ui-routes.generated.ts')

/**
 * 剥掉注释只留代码(单遍字符扫描:字符串/模板字面量内的双斜杠与块注释起点不算注释)。
 *
 * 为什么不像 miniapp-taro 同名脚本那样用两条正则"先删块、再删行":本仓库的行注释里
 * 写着 `镜像 miniapp pages/teacher/*、…`,其中的块注释起点会让先跑的那条正则一路吞到
 * 下一个块注释终点,把中间几百行真实代码连带删掉(实测产物只剩 24k/42k 字符)。扫描器按
 * 从左到右的上下文判定,行注释整体消失,其内的星号斜杠组合不再被误认成块注释起点。
 * 已知残留:正则字面量里的双斜杠会被当注释 —— 消费的两个源文件没有,刻意不上 AST。
 */
function stripComments(text) {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const ch = text[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ch
      i += 1
      while (i < n) {
        if (text[i] === '\\') {
          out += text[i] + (text[i + 1] ?? '')
          i += 2
          continue
        }
        out += text[i]
        if (text[i] === ch) {
          i += 1
          break
        }
        i += 1
      }
      continue
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i += 1
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** 字符串字面量:默认单引号(prettier singleQuote),含单引号/反斜杠时改用 JSON 双引号形式 */
function literal(value) {
  if (/['\\]/.test(value)) return JSON.stringify(value)
  return `'${value}'`
}

/** 与 .prettierrc 的 printWidth 对齐:超出则按 prettier 习惯展开成多行(产物需 prettier --check 稳定) */
const PRINT_WIDTH = 100

function emitEntry(entry) {
  const keys = entry.requiredParams.map((k) => literal(k)).join(', ')
  const fields = [
    `name: ${literal(entry.name)}`,
    `tab: ${entry.tab}`,
    `requiresParams: ${entry.requiresParams}`,
    `requiredParams: [${keys}]`,
  ]
  const single = `  { ${fields.join(', ')} },`
  // screen name 与参数键都来自 TS 标识符(纯 ASCII),故 .length 与 prettier 的列宽等价,
  // 不需要 miniapp-taro 那套 East Asian Width 计宽
  if (single.length <= PRINT_WIDTH) return [single]
  return ['  {', ...fields.map((f) => `    ${f},`), '  },']
}

/** 返回 `{}` 配对完整的块体(不含首尾花括号),花括号不闭合即抛错(宁可不生成也不产半成品) */
function braceBlock(text, openBraceIndex) {
  let depth = 0
  for (let i = openBraceIndex; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return text.slice(openBraceIndex + 1, i)
    }
  }
  throw new Error('花括号未闭合,无法定位块体边界')
}

/**
 * 已登录分支的 JSX 片段:RootStack.Navigator 里 `{token ? ( … ) : ( … )}` 的第一段。
 * 定位失败必须抛错 —— 静默降级成"全量 Screen"会让 AI 拿到未登录态根本挂不上的路由。
 */
function extractAuthedBranch(src) {
  const open = /\{\s*token\s*\?\s*\(/.exec(src)
  if (!open) throw new Error('RootNavigator.tsx 未找到 `{token ? (` 已登录分支,拒绝生成白名单')
  const close = /\)\s*:\s*\(/.exec(src.slice(open.index))
  if (!close) throw new Error('RootNavigator.tsx 的 token 三元未找到 `) : (` 收口,拒绝生成白名单')
  return src.slice(open.index + open[0].length, open.index + close.index)
}

function collectNames(text, pattern) {
  const found = []
  for (const match of text.matchAll(pattern)) found.push(match[1])
  return found
}

/**
 * RootStackParamList → 每个 Screen 的必填参数键。
 * 条目按"深度 0 换行"切分:值里的嵌套 `{}` / `()` 会抬升深度,所以跨行对象不会被切散。
 * 刻意不跟踪尖括号 —— `NavigatorScreenParams<MainStackParamList>` 与 `=> void` 里的
 * `<` `>` 不配对,跟了会把深度算负、切分错位。
 */
function parseRequiredParams(paramListBody) {
  const entries = []
  let depth = 0
  let current = ''
  for (const ch of paramListBody) {
    if (ch === '{' || ch === '(' || ch === '[') depth += 1
    else if (ch === '}' || ch === ')' || ch === ']') depth -= 1
    if (ch === '\n' && depth <= 0) {
      entries.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  entries.push(current)

  const required = new Map()
  for (const entry of entries) {
    const kv = /^\s*([A-Za-z_][\w]*)\s*:\s*([\s\S]+)$/.exec(entry)
    if (!kv) continue
    const [, name, rawValue] = kv
    const value = rawValue.trim()
    // `undefined` / `{…} | undefined`:参数可缺省(历史调用方不传也能进),不算必填
    if (value === 'undefined' || /\|\s*undefined\b/.test(value)) continue
    const brace = value.indexOf('{')
    if (brace < 0) continue
    const objectBody = value.slice(brace + 1, value.lastIndexOf('}'))
    const keys = []
    for (const keyMatch of objectBody.matchAll(/([A-Za-z_][\w]*)\s*(\??)\s*:/g)) {
      if (keyMatch[2] !== '?' && !keys.includes(keyMatch[1])) keys.push(keyMatch[1])
    }
    if (keys.length > 0) required.set(name, keys)
  }
  return required
}

/** linking.ts 里形如 `TopicDetail: 'topic/:id'` 的模式 → { TopicDetail: ['id'] } */
function parseLinkingParams(linkingSrc) {
  const out = new Map()
  const cleaned = stripComments(linkingSrc)
  for (const match of cleaned.matchAll(/([A-Za-z_][\w]*)\s*:\s*'([^']*)'/g)) {
    const [, name, path] = match
    if (!path.includes(':')) continue
    const keys = [...path.matchAll(/:([A-Za-z_][\w]*)/g)].map((m) => m[1])
    if (keys.length > 0) out.set(name, keys)
  }
  return out
}

function buildRoutes() {
  const rawSrc = readFileSync(navigatorFile, 'utf8')
  const src = stripComments(rawSrc)
  const authed = extractAuthedBranch(stripComments(rawSrc))

  const stackNames = collectNames(authed, /<RootStack\.Screen\s+name="([^"]+)"/g)
  const tabNames = collectNames(src, /<MainTabs\.Screen\s+name="([^"]+)"/g)
  if (stackNames.length === 0)
    throw new Error('已登录分支未解析到任何 <RootStack.Screen name>,拒绝生成空白名单')

  const seen = new Set()
  for (const name of stackNames) {
    if (seen.has(name)) throw new Error(`已登录分支出现重复 Screen: ${name}`)
    seen.add(name)
  }
  for (const name of tabNames) {
    if (seen.has(name)) throw new Error(`Tab 与 Stack 同名 Screen: ${name}`)
    seen.add(name)
  }

  const paramListMatch = /export type RootStackParamList\s*=\s*\{/.exec(src)
  if (!paramListMatch) throw new Error('RootNavigator.tsx 未找到 RootStackParamList 类型定义')
  const requiredByType = parseRequiredParams(
    braceBlock(src, src.indexOf('{', paramListMatch.index + paramListMatch[0].length - 1)),
  )
  const requiredByLinking = parseLinkingParams(readFileSync(linkingFile, 'utf8'))

  const toEntry = (name, tab) => {
    const keys = []
    for (const key of [
      ...(requiredByType.get(name) ?? []),
      ...(requiredByLinking.get(name) ?? []),
    ]) {
      if (!keys.includes(key)) keys.push(key)
    }
    return { name, tab, requiredParams: keys, requiresParams: keys.length > 0 }
  }

  return {
    entries: [
      ...stackNames.map((n) => toEntry(n, false)),
      ...tabNames.map((n) => toEntry(n, true)),
    ],
    stackCount: stackNames.length,
    tabCount: tabNames.length,
  }
}

function emitFile({ entries, stackCount, tabCount }) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT. 由 apps/mobile-rn/scripts/generate-ui-routes.mjs 生成(pnpm gen:ui-routes)',
    '// 数据源:RootNavigator.tsx 已登录分支的 <RootStack.Screen name/> + <MainTabs.Screen name/>',
    '//        + RootStackParamList 必填参数键 + navigation/linking.ts 的 :param 模式。',
    '// 改路由请改 RootNavigator.tsx 后重新生成。',
    '',
    '/** AI 可导航 Screen 条目:name 是 react-navigation 的 screen name(不是 URL 路径) */',
    'export interface RnUiRouteEntry {',
    "  /** Screen name,如 'Wallet';navigate 白名单就是它 */",
    '  name: string',
    "  /** 是否 Main(Bottom Tabs)的子 tab:true 必须走 navigate('Main', { screen: name }) */",
    '  tab: boolean',
    '  /** 该 Screen 的参数类型里是否存在必填键(必填页缺参数时注册表按此报错并点名缺哪个键) */',
    '  requiresParams: boolean',
    '  /** requiresParams 的具体键名,如 ["id"];给 AI 的报错文案用,避免它反复试错 */',
    '  requiredParams: string[]',
    '}',
    '',
    `/** 全量白名单:前 ${stackCount} 条是已登录分支 RootStack.Screen,后 ${tabCount} 条是 Main Tab */`,
    'export const RN_UI_ROUTES: readonly RnUiRouteEntry[] = [',
  ]
  for (const entry of entries) lines.push(...emitEntry(entry))
  lines.push(']', '')
  return `${lines.join('\n')}\n`
}

function main() {
  const { entries, stackCount, tabCount } = buildRoutes()
  const paramRoutes = entries.filter((r) => r.requiresParams).length

  const content = emitFile({ entries, stackCount, tabCount })
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, content, 'utf8')

  // 溯源水印:产物是 git 跟踪文件,受 check-watermark-coverage 门禁约束;inject 幂等,
  // 同一载荷重复生成不产生 diff(参考 miniapp-taro/scripts/generate-ui-routes.mjs)
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

  console.info(
    `[gen:ui-routes] Screen ${entries.length} 条 = RootStack ${stackCount} + Main Tab ${tabCount};需参数页 ${paramRoutes} 条`,
  )
  console.info(`[gen:ui-routes] 已写入 ${outFile}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
