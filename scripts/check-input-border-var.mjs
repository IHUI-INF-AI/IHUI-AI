#!/usr/bin/env node
/**
 * CSS 颜色 token 嵌套守门(2026-07-19 立)
 * 防止新增 `hsl(var(--xxx))` / `rgb(var(--xxx))` 嵌套形式
 *
 * 根因: Tailwind v4 @theme 把 --color-* 序列化为 hsl(...),外层再包裹 hsl() 或 rgb()
 *      会变成 hsl(hsl(...)) 非法值,被浏览器静默丢弃,导致颜色/描边/阴影等样式失效
 *
 * 正确写法: 直接 var(--color-*) 引用
 *           需要透明度用 color-mix(in srgb, var(--xxx) 60%, transparent)
 *
 * 用法: node scripts/check-input-border-var.mjs [--staged]
 *   --staged: 仅检查 staged 文件 (pre-commit 用)
 *   无参数:   全量检查所有 .tsx/.css/.scss
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const isStaged = process.argv.includes('--staged')

// 匹配 hsl(var(--xxx)) / rgb(var(--xxx)) 嵌套形式
// 必须包含 var(--xxx) 才算嵌套,纯 hsl(120 50% 50%) 不算
const NESTED_RE = /\b(hsl|rgb|hsla|rgba|hwb|lab|lch|oklab|oklch|color)\(\s*var\(\s*--/g

// 白名单: 某些场景明确允许嵌套(目前没有)
const ALLOWLIST_FILES = new Set([
  // 例: 'apps/web/src/styles/legacy-color-tokens.css',
])

const EXT_ALLOW = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.scss', '.mjs'])

function getTargetFiles() {
  if (isStaged) {
    try {
      const out = execSync(
        'git diff --cached --name-only --diff-filter=ACMR',
        { encoding: 'utf-8' },
      )
      return out
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f && EXT_ALLOW.has(path.extname(f)))
    } catch (e) {
      console.error('[check-input-border-var] git diff --cached 失败:', e.message)
      process.exit(2)
    }
  }
  // 全量模式: 递归扫描 apps/web/src + packages/ui/src + apps/web/app + src/styles
  const roots = [
    'apps/web/src',
    'apps/web/app',
    'apps/web/src/styles',
    'packages/ui/src',
  ]
  const files = []
  for (const root of roots) {
    const abs = path.resolve(root)
    if (!fs.existsSync(abs)) continue
    walk(abs, files)
  }
  return files
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk(full, out)
    } else if (EXT_ALLOW.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
}

let violations = 0
const targets = getTargetFiles()

for (const file of targets) {
  const rel = file.replace(/\\/g, '/').replace(/^.*?IHUI-AI\//, '')
  if (ALLOWLIST_FILES.has(rel)) continue

  const abs = isStaged ? path.resolve(file) : file
  if (!fs.existsSync(abs)) continue

  const content = fs.readFileSync(abs, 'utf-8')
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    // 跳过单行注释
    const trimmed = line.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('<!--')
    ) {
      return
    }
    NESTED_RE.lastIndex = 0
    const matches = [...line.matchAll(NESTED_RE)]
    if (matches.length > 0) {
      violations += 1
      const fn = matches[0][1]
      console.error(
        `❌ ${rel}:${i + 1}  ${fn}(var(--*)) 嵌套形式 (Tailwind v4 序列化为 hsl(hsl(...)) 非法被丢弃)`,
      )
      console.error(`     ${line.trim().substring(0, 120)}`)
      console.error(`     💡 改为 var(--xxx) 引用,或 color-mix(in srgb, var(--xxx) 60%, transparent)`)
    }
  })
}

if (violations > 0) {
  console.error(`\n[check-input-border-var] ❌ 找到 ${violations} 处 CSS 颜色 token 嵌套违规`)
  console.error('参考: apps/web/src/styles/design-tokens.css 与 globals.css 的 --color-* 写法')
  process.exit(1)
}

console.log(`[check-input-border-var] ✅ 通过 (扫描 ${targets.length} 文件, 0 处违规)`)
process.exit(0)
