#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UI 路由清单生成脚本：扫描 app 下所有 page.tsx，生成路由清单 TS 模块。
 *
 * 运行： node apps/web/scripts/generate-ui-routes.mjs
 *
 * 规则：
 * - 路由分组目录（(main)/(marketing) 等括号段）不参与 URL，跳过；
 * - 动态段 [id] 记为 :id 并标记 param:true；
 * - 只认 page.tsx，route.ts 等其它文件忽略；
 * - 顶级段 sso/h5/api（SSO 回调、H5 分享、API 代理）不纳入 AI 可导航范围；
 * - 输出 src/lib/ui-routes.generated.ts（自动生成，请勿手改），
 *   供 src/lib/ui-action-registry.ts 校验 navigate 动作的跳转目标。
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { renderPin } from '../../../scripts/lib/generated-input-pin.mjs' // arch-exempt: ui-routes 派生码生成脚本属构建工具面(非运行时依赖边),须与守门 105 自述钉共用同一 renderPin 源;正解=「工具支持层」在策略表建档并降到 apps 之下 until 2026-12-28

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(webRoot, '..', '..')
const appDir = path.join(webRoot, 'app')
const outFile = path.join(webRoot, 'src', 'lib', 'ui-routes.generated.ts')
const consumerFile = path.join(webRoot, 'src', 'lib', 'ui-action-registry.ts')

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

/**
 * FIG_VERSION 同型断言(G-816040):生成前先验「消费方契约」在位。
 * 产物存在的唯一理由是被 ui-action-registry 引用;消费方不在/不再引用时生成出来的是孤儿,
 * 上游参照(zcode-cli generate-bash-command-registry.mjs:50-58)在依赖版本不符时 throw,同型。
 */
function assertConsumerContract() {
  if (!existsSync(consumerFile)) {
    throw new Error(`消费方不在位:${consumerFile} —— 拒绝生成无人消费的产物`)
  }
  if (!readFileSync(consumerFile, 'utf8').includes('ui-routes.generated')) {
    throw new Error(`消费方 ${consumerFile} 已不引用本产物(ui-routes.generated)—— 契约漂移,拒绝生成`)
  }
}

/** 生成时 HEAD 的 sha(取不到写 unknown,钉里的字段不因此缺位) */
function sourceCommit() {
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch {
    return 'unknown'
  }
}

assertConsumerContract()

// 收集并按 path 去重(同一 URL 出现多个 page 属于 Next 不允许的配置,保留先扫描到的)。
// 排除与重复计数进钉的 skipped 自述行:「哪些没搬进来」由产物自述,不靠人记。
const pageFiles = collectPageFiles(appDir)
const inputs = pageFiles.map((abs) => ({
  rel: path.relative(repoRoot, abs).split(path.sep).join('/'),
  text: readFileSync(abs, 'utf8'),
}))
let excludedTop = 0
let duplicatePaths = 0
const routeMap = new Map()
for (const file of pageFiles) {
  const route = toRoute(path.relative(appDir, file))
  if (!route) {
    excludedTop += 1
    continue
  }
  if (routeMap.has(route.path)) {
    duplicatePaths += 1
    continue
  }
  routeMap.set(route.path, route)
}

const routes = [...routeMap.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))

const routeLines = routes.map((r) => `  { path: '${r.path}', param: ${r.param}, group: '${r.group}' },`)

// 自述钉:由输入字节算出的 inputsSha256 烘进产物头(单一实现 lib/generated-input-pin.mjs)。
// 门侧同面重算同集输入即可判「产物是否按当前输入生成」;skipped 计数与输入清单同块自述。
const pinLines = renderPin({
  generator: 'apps/web/scripts/generate-ui-routes.mjs',
  sourceCommit: sourceCommit(),
  inputs,
  generatedAt: new Date().toISOString(),
  extraLines: [
    `skipped: excludedTopSegments(sso|h5|api)=${excludedTop} pages; duplicatePaths(保留先扫描到的)=${duplicatePaths}`,
  ],
})
const pinBlock = pinLines.join('\n')

const content = `// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UI 路由清单（自动生成，请勿手改）。
 *
 * 由 apps/web/scripts/generate-ui-routes.mjs 扫描 app 下的 page.tsx 生成；
 * 运行： node apps/web/scripts/generate-ui-routes.mjs
 * 供 src/lib/ui-action-registry.ts 校验 navigate 动作的跳转目标。
 */
${pinBlock}

export const UI_ROUTES: { path: string; param: boolean; group: string }[] = [
${routeLines.join('\n')}
]
`

writeFileSync(outFile, content, 'utf8')
console.log(`已生成 ${outFile}，共 ${routes.length} 条路由。`)
