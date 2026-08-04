#!/usr/bin/env node
/**
 * 复制 monaco-editor 包的 min/vs 到 apps/web/public/vs，实现 self-host Monaco Editor。
 *
 * 触发场景:
 *  - pnpm install 后自动执行(package.json postinstall)
 *  - 手动执行: node scripts/copy-monaco-to-public.mjs
 *
 * 原因: @monaco-editor/react 默认从 cdn.jsdelivr.net 加载 monaco-editor 核心,
 * GFW/网络/CSP 经常导致 vs/loader.js 加载失败,IDE 编辑器无法渲染。
 * self-host 到 /vs 路径对标 Trae/Codex,避免外部 CDN 依赖。
 *
 * 幂等: 目标目录已存在且 loader.js 存在则跳过(除非 --force)
 */
import { existsSync, mkdirSync, cpSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const force = process.argv.includes('--force')

// 源: monaco-editor 包的 min/vs 目录
// 兼容 isolated(apps/web/node_modules)与 hoisted(根 node_modules)两种模式
const webRoot = resolve(__dirname, '..')
const repoRoot = resolve(webRoot, '..', '..')
const candidateSources = [
  resolve(webRoot, 'node_modules', 'monaco-editor', 'min', 'vs'), // isolated 模式
  resolve(repoRoot, 'node_modules', 'monaco-editor', 'min', 'vs'), // hoisted 模式
]
const sourceDir = candidateSources.find((p) => existsSync(p))
if (!sourceDir) {
  console.error(`[copy-monaco] 源目录不存在,已尝试:`)
  candidateSources.forEach((p) => console.error(`  - ${p}`))
  console.error(`[copy-monaco] 请确认 monaco-editor 包已安装: pnpm --filter @ihui/web add monaco-editor`)
  process.exit(1)
}
// 目标: apps/web/public/vs
const targetDir = resolve(webRoot, 'public', 'vs')

const sourceLoader = resolve(sourceDir, 'loader.js')
if (!existsSync(sourceLoader)) {
  console.error(`[copy-monaco] 源 loader.js 不存在: ${sourceLoader}`)
  process.exit(1)
}

const targetLoader = resolve(targetDir, 'loader.js')
if (!force && existsSync(targetLoader)) {
  // 幂等: 已存在则跳过(除非 --force)
  const srcMtime = statSync(sourceLoader).mtimeMs
  const tgtMtime = statSync(targetLoader).mtimeMs
  if (srcMtime <= tgtMtime) {
    console.log(`[copy-monaco] 已是最新,跳过 (${targetDir})`)
    process.exit(0)
  }
}

mkdirSync(targetDir, { recursive: true })
cpSync(sourceDir, targetDir, { recursive: true, force: true })
console.log(`[copy-monaco] 已复制 monaco-editor min/vs → public/vs`)
