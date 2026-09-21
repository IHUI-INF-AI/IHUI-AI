#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UI 路由清单生成脚本：扫描 app 下所有 page.tsx，生成路由清单 TS 模块。
 *
 * 运行： node scripts/generate-ui-routes.mjs
 *
 * 规则：
 * - 路由分组目录（(main)/(marketing) 等括号段）不参与 URL，跳过；
 * - 动态段 [id] 记为 :id 并标记 param:true；
 * - 只认 page.tsx，route.ts 等其它文件忽略；
 * - 顶级段 sso/h5/api（SSO 回调、H5 分享、API 代理）不纳入 AI 可导航范围；
 * - 输出 src/lib/ui-routes.generated.ts（自动生成，请勿手改），
 *   供 src/lib/ui-action-registry.ts 校验 navigate 动作的跳转目标。
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(webRoot, 'app')
const outFile = path.join(webRoot, 'src', 'lib', 'ui-routes.generated.ts')

/** 排除的顶级段：SSO 回调、H5 分享页、API 代理路由不开放给 AI 导航 */
const EXCLUDED_TOP_SEGMENTS = new Set(['sso', 'h5', 'api'])

/** 递归收集 app 下所有 page.tsx 的绝对路径 */
function collectPageFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectPageFiles(full, out)
    } else if (entry.name === 'page.tsx') {
      out.push(full)
    }
  }
  return out
}

/**
 * 由 page.tsx 相对 app 的路径计算路由信息 { path, param, group }。
 * 顶级段命中排除名单时返回 null（不纳入清单）。
 */
function toRoute(relFromApp) {
  // Windows 下 relative 结果为反斜杠，统一按分隔符切段
  const rawSegments = relFromApp.split(/[\\/]+/)
  rawSegments.pop() // 去掉文件名 page.tsx

  const segments = []
  let param = false
  for (const seg of rawSegments) {
    if (seg.startsWith('(') && seg.endsWith(')')) continue // 分组段不参与 URL
    if (seg.startsWith('[') && seg.endsWith(']')) {
      segments.push(`:${seg.slice(1, -1)}`)
      param = true
    } else {
      segments.push(seg)
    }
  }

  if (segments.length > 0 && EXCLUDED_TOP_SEGMENTS.has(segments[0])) return null

  const routePath = segments.length === 0 ? '/' : `/${segments.join('/')}`
  return { path: routePath, param, group: segments[0] ?? '' }
}

if (!existsSync(appDir)) {
  console.error(`未找到 app 目录：${appDir}`)
  process.exit(1)
}

// 收集并按 path 去重（同一 URL 出现多个 page 属于 Next 不允许的配置，保留先扫描到的）
const routeMap = new Map()
for (const file of collectPageFiles(appDir)) {
  const route = toRoute(path.relative(appDir, file))
  if (route && !routeMap.has(route.path)) routeMap.set(route.path, route)
}

const routes = [...routeMap.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

const routeLines = routes.map((r) => `  { path: '${r.path}', param: ${r.param}, group: '${r.group}' },`)

const content = `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UI 路由清单（自动生成，请勿手改）。
 *
 * 由 scripts/generate-ui-routes.mjs 扫描 app 下的 page.tsx 生成；
 * 运行： node scripts/generate-ui-routes.mjs
 * 供 src/lib/ui-action-registry.ts 校验 navigate 动作的跳转目标。
 */

export const UI_ROUTES: { path: string; param: boolean; group: string }[] = [
${routeLines.join('\n')}
]
`

writeFileSync(outFile, content, 'utf8')
console.log(`已生成 ${outFile}，共 ${routes.length} 条路由。`)
