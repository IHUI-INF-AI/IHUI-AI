// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 生成 extension 端「AI 可导航路由」白名单 → lib/ext-ui-routes.generated.ts
// 数据源:entrypoints/sidepanel/SidepanelApp.tsx 的 <Route path="…"> 清单
//   (MemoryRouter 路由表,含末尾兼容重定向路由,不含 `*` 通配)。
// 用法:node apps/extension/scripts/generate-ext-ui-routes.mjs(package.json: pnpm gen:ui-routes)
// 消费方:lib/ui-action-registry.ts —— AI 的 ext_ui_navigate 目标必须命中本清单,否则 ROUTE_NOT_ALLOWED。
// 立因(G-816040/CONTEXT.md §4):本产物此前自称「生成常量,非手写维护」却没有任何写它的脚本,
//   这一格靠人记。本脚本把「重跑生成器 + 逐字节等值」的上游补齐,门侧由 scripts/check-miniapp-generated.mjs
//   的 ui-routes 组(守门 105 同一张表)用自述钉对账。

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 自述钉唯一实现(G-816040):inputsSha256 烘进产物头,门侧同面重算同集输入判陈旧
import { renderPin } from '../../../scripts/lib/generated-input-pin.mjs' // arch-exempt: ui-routes 派生码生成脚本属构建工具面(非运行时依赖边),须与守门 105 自述钉共用同一 renderPin 源;正解=「工具支持层」在策略表建档并降到 apps 之下 until 2026-12-28

const scriptDir = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(scriptDir, '..')
const repoRoot = resolve(appRoot, '..', '..')
const sidepanelFile = join(appRoot, 'entrypoints', 'sidepanel', 'SidepanelApp.tsx')
const outFile = join(appRoot, 'lib', 'ext-ui-routes.generated.ts')
const consumerFile = join(appRoot, 'lib', 'ui-action-registry.ts')

/**
 * 剥掉注释只留代码(单遍字符扫描:字符串/模板字面量内的双斜杠与块注释起点不算注释)。
 * 同 apps/mobile-rn/scripts/generate-ui-routes.mjs 的实现 —— 文档注释里的 `<Route path>`
 * 例子不得被当成路由真相投票,而两条正则的剥法会把块注释起点一路吞到下一个终点(实测教训)。
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

/**
 * 从(已剥注释的)SidepanelApp 源码按声明顺序提取 <Route path="…">。
 * `*` 通配与动态路径(path={变量})不入白名单,计数进钉的 skipped 自述行。
 */
function extractRoutes(stripped) {
  const paths = []
  let wildcard = 0
  let dynamic = 0
  for (const m of stripped.matchAll(/<Route\s+path="([^"]*)"/g)) {
    const p = m[1]
    if (p === '*') {
      wildcard += 1
    } else if (p.includes('${')) {
      dynamic += 1
    } else {
      paths.push(p)
    }
  }
  if (paths.length === 0) throw new Error('SidepanelApp.tsx 未解析到任何 <Route path>,拒绝生成空白名单')
  const seen = new Set()
  for (const p of paths) {
    if (seen.has(p)) throw new Error(`SidepanelApp.tsx 出现重复路由: ${p}`)
    seen.add(p)
  }
  return { paths, wildcard, dynamic }
}

/** FIG_VERSION 同型断言(G-816040):消费方契约必须在位,否则产物是孤儿 */
function assertConsumerContract() {
  if (!existsSync(consumerFile)) {
    throw new Error(`消费方不在位:${consumerFile} —— 拒绝生成无人消费的产物`)
  }
  if (!readFileSync(consumerFile, 'utf8').includes('ext-ui-routes.generated')) {
    throw new Error(`消费方 ${consumerFile} 已不引用本产物(ext-ui-routes.generated)—— 契约漂移,拒绝生成`)
  }
}

/** 生成时 HEAD 的 sha(取不到写 unknown,钉里的字段不因此缺位) */
function sourceCommit() {
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true, // §5b:GUI 宿主/计划任务下派生控制台程序不补这个参数必弹新窗口(守门 52)
    })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

function emitFile({ paths, pinLines }) {
  const lines = [
    '// GENERATED FILE — DO NOT EDIT. 由 apps/extension/scripts/generate-ext-ui-routes.mjs 生成(pnpm gen:ui-routes)',
    '// 数据源:entrypoints/sidepanel/SidepanelApp.tsx 的 <Route path="…"> 清单(MemoryRouter 路由表,',
    '//        含末尾兼容重定向路由,不含 `*` 通配)。改路由请改 SidepanelApp.tsx 后重新生成。',
    '',
  ]
  // 自述钉紧跟数据源头注:「产物按哪份输入生成」与「数据源是谁」同块自述
  lines.push(...pinLines, '')
  lines.push(
    '/** ext_ui navigate 路由白名单(生成常量,非手写维护):与 web 端 ui-route-index.ts 的站内白名单语义对齐 */',
    'export const EXT_UI_ROUTES: readonly string[] = [',
  )
  for (const p of paths) lines.push(`  '${p}',`)
  lines.push(']', '')
  return `${lines.join('\n')}\n`
}

function main() {
  assertConsumerContract()

  const raw = readFileSync(sidepanelFile, 'utf8')
  const { paths, wildcard, dynamic } = extractRoutes(stripComments(raw))

  // 钉输入清单 = 生成器实际读的那一份,逐字同集;门侧从同一面重算同集输入判陈旧(G-680 同款口径)
  const pinLines = renderPin({
    generator: 'apps/extension/scripts/generate-ext-ui-routes.mjs',
    sourceCommit: sourceCommit(),
    inputs: [{ rel: 'apps/extension/entrypoints/sidepanel/SidepanelApp.tsx', text: raw }],
    generatedAt: new Date().toISOString(),
    extraLines: [
      `skipped: wildcardRoutes=${wildcard}(\`*\` 通配,万物兜底不导航); dynamicPaths=${dynamic}(path 为动态表达式)`,
    ],
  })

  const content = emitFile({ paths, pinLines })
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, content, 'utf8')

  // 溯源水印:产物是 git 跟踪文件,受 check-watermark-coverage 门禁约束;inject 幂等,
  // 同一载荷重复生成不产生 diff(参考 apps/miniapp-taro/scripts/generate-ui-routes.mjs)
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

  // 产物生成器的收尾信息一律 console.info:extension 的 lint 跑 `--max-warnings 0`
  // 而 no-console 只放行 warn/error/info —— 用 console.log 会把 main 的 CI 直接判红。
  console.info(
    `[gen:ui-routes] 路由 ${paths.length} 条(含兼容重定向;排除 \`*\` 通配 ${wildcard} 条、动态路径 ${dynamic} 条)。`,
  )
  console.info(`[gen:ui-routes] 已写入 ${outFile}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
