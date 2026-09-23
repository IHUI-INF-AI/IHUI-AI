#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 验证各端 i18n 语言包与端内 loader 的存在性、可解析性、非空性。
 *
 * 守门目的：
 *   - 防止任何端删除或重命名 i18n 文件/目录导致构建与运行期集体取不到文案
 *   - AGENTS.md §9 多端同步开发强制规则自动化检查
 *   - 保住 miniapp-taro 那份**签入 git 的压缩产物**与源 JSON 的同步关系
 *
 * 实际布局(2026-09-21 重新盘点):翻译事实源已统一到 packages/i18n/messages/,端内只留 loader。
 *   - packages/i18n/messages/{shared,web,miniapp-taro,mobile-rn,cli,extension,api}/{5 语言}.json
 *   - apps/{miniapp-taro,mobile-rn,extension}/src/i18n/index.tsx、apps/cli/src/i18n/index.ts
 *   - apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts(签入的构建产物)
 *   - desktop 无自有 i18n:它加载 8801 那份 web 页,故不校验 desktop
 *
 * 历史备注:本脚本 2026-07-20 版按 apps/<端>/src/i18n/messages/*.ts 找文件,布局迁移后
 *   会稳定报出 6-8 个"缺失文件"幻影(2026-09-21 实测),已改为按上面的真实布局判定。
 *
 * 验证项：
 *   1. 7 个语言包目录 × 5 语言 = 35 个 JSON 全部存在且可解析为非空对象
 *   2. 4 个端内 loader + 1 个压缩产物存在且含 export default;产物体积不低于下限
 *
 * 退出码：
 *   0 = 通过
 *   1 = 失败（缺失文件 / 解析失败 / 空文件）
 *
 * 用法：
 *   node scripts/check-i18n-messages-exist.mjs              # 全量检查
 *   node scripts/check-i18n-messages-exist.mjs --staged     # pre-commit 模式
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

// 实际布局(2026-09-21 重新盘点,替换 2026-07-20 那份已失真配置):
// 翻译事实源已统一到 packages/i18n/messages/<端>/<语言>.json,端内只留 loader。
// 老配置按 apps/<端>/src/i18n/messages/*.ts 去找,报出来的"缺失文件"绝大多数是幻影。
const MSG_ROOT = 'packages/i18n/messages'
const ENDPOINTS = ['shared', 'web', 'miniapp-taro', 'mobile-rn', 'cli', 'extension', 'api'].map(
  (name) => ({
    name,
    dir: `${MSG_ROOT}/${name}`,
    filePattern: (locale) => `${locale}.json`,
  }),
)

// 端内 loader 入口必须存在且能 export default;desktop 无自有 i18n(它加载 8801 那份 web 页)
const LOADER_TARGETS = [
  { name: 'miniapp-taro-loader', file: 'apps/miniapp-taro/src/i18n/index.tsx' },
  { name: 'mobile-rn-loader', file: 'apps/mobile-rn/src/i18n/index.tsx' },
  { name: 'extension-loader', file: 'apps/extension/src/i18n/index.tsx' },
  { name: 'cli-loader', file: 'apps/cli/src/i18n/index.ts' },
  // 签入 git 的压缩语言包(源 JSON 改了它必须重生成,否则端内运行时拿旧包)
  {
    name: 'miniapp-taro-generated',
    file: 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts',
    minBytes: 10000,
  },
]

const missing = []
const parseErrors = []
const emptyFiles = []

for (const endpoint of ENDPOINTS) {
  const dirAbs = path.resolve(ROOT, endpoint.dir)
  if (!fs.existsSync(dirAbs)) {
    missing.push({
      endpoint: endpoint.name,
      path: endpoint.dir,
      issue: 'directory-missing',
    })
    continue
  }

  for (const locale of LOCALES) {
    const relPath = path.join(endpoint.dir, endpoint.filePattern(locale))
    const absPath = path.resolve(ROOT, relPath)
    if (!fs.existsSync(absPath)) {
      missing.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'file-missing',
        locale,
      })
      continue
    }

    // 语言包是 JSON:校验可解析、是非空对象(不再要求 export default —— 那是端内 loader 的形态)
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'))
    } catch (e) {
      parseErrors.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: `json-parse-error: ${String(e.message).slice(0, 60)}`,
      })
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      parseErrors.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'not-a-json-object',
      })
      continue
    }
    if (Object.keys(parsed).length === 0) {
      emptyFiles.push({
        endpoint: endpoint.name,
        path: relPath,
        issue: 'no-top-level-keys',
      })
    }
  }
}

// 端内 loader / 签入产物:存在 + 能 export default + 体积下限(防被清空或未生成)
for (const target of LOADER_TARGETS) {
  const absPath = path.resolve(ROOT, target.file)
  if (!fs.existsSync(absPath)) {
    missing.push({ endpoint: target.name, path: target.file, issue: 'file-missing' })
    continue
  }
  const content = fs.readFileSync(absPath, 'utf8')
  // 端内 loader 都是**具名导出**(export function getLocale / export { messages } / export type Locale),
  // 只有压缩产物是 export const。老校验写死 `export default`,5 个入口全部误判为"无导出"。
  if (!/\bexport\s+(default\s+)?(const|function|type|interface|class|\{|\*)/.test(content)) {
    parseErrors.push({ endpoint: target.name, path: target.file, issue: 'no-export' })
    continue
  }
  if (target.minBytes && Buffer.byteLength(content, 'utf8') < target.minBytes) {
    emptyFiles.push({
      endpoint: target.name,
      path: target.file,
      issue: `too-small(<${target.minBytes}B),疑似未生成或被清空`,
    })
  }
}

// pre-commit 模式：只对暂存区涉及 i18n 的端做硬性检查，未涉及则跳过
let onlyStaged = false
if (isStaged) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      cwd: ROOT,
      windowsHide: true,
    })
    const stagedFiles = staged.split('\n').filter(Boolean)
    const stagedI18nDirs = new Set()
    for (const f of stagedFiles) {
      for (const endpoint of ENDPOINTS) {
        if (f.startsWith(`${endpoint.dir}/`)) {
          stagedI18nDirs.add(endpoint.name)
        }
      }
    }
    if (stagedI18nDirs.size === 0) {
      console.log(`${C.dim}[i18n-messages-exist] staged 模式: 暂存区无 i18n 改动,跳过${C.reset}`)
      process.exit(0)
    }
    onlyStaged = true
    console.log(
      `${C.cyan}[i18n-messages-exist] staged 模式: 检查 ${[...stagedI18nDirs].join(', ')}${C.reset}`,
    )
  } catch {
    // 忽略错误，走全量
  }
}

const KNOWN_ENDPOINTS = [...ENDPOINTS.map((e) => e.name), ...LOADER_TARGETS.map((t) => t.name)]
const filterByEndpoint = (issue) => !onlyStaged || KNOWN_ENDPOINTS.includes(issue.endpoint)

const filteredMissing = missing.filter(filterByEndpoint)
const filteredParseErrors = parseErrors.filter(filterByEndpoint)
const filteredEmpty = emptyFiles.filter(filterByEndpoint)

const totalIssues = filteredMissing.length + filteredParseErrors.length + filteredEmpty.length

if (totalIssues === 0) {
  const totalFiles = ENDPOINTS.length * LOCALES.length + LOADER_TARGETS.length
  console.log(
    `${C.green}[i18n-messages-exist] ✅ 通过 (${ENDPOINTS.length} 个语言包目录 × ${LOCALES.length} 语言 = ${ENDPOINTS.length * LOCALES.length} 份 JSON + ${LOADER_TARGETS.length} 个端内 loader/签入产物,合计 ${totalFiles} 项全部存在且合法)${C.reset}`,
  )
  process.exit(0)
}

console.error(`${C.red}[i18n-messages-exist] ❌ 发现 ${totalIssues} 处问题:${C.reset}\n`)

if (filteredMissing.length > 0) {
  console.error(`  ${C.red}缺失文件/目录(${filteredMissing.length}个):${C.reset}`)
  for (const m of filteredMissing) {
    console.error(`    ${C.red}[${m.endpoint}] ${m.path} (${m.issue})${C.reset}`)
  }
  console.error('')
}

if (filteredParseErrors.length > 0) {
  console.error(`  ${C.red}解析错误(${filteredParseErrors.length}个):${C.reset}`)
  for (const p of filteredParseErrors) {
    console.error(`    ${C.red}[${p.endpoint}] ${p.path} (${p.issue})${C.reset}`)
  }
  console.error('')
}

if (filteredEmpty.length > 0) {
  console.error(`  ${C.yellow}空文件警告(${filteredEmpty.length}个):${C.reset}`)
  for (const e of filteredEmpty) {
    console.error(`    ${C.yellow}[${e.endpoint}] ${e.path} (${e.issue})${C.reset}`)
  }
  console.error('')
}

console.error(`${C.yellow}修复方法:${C.reset}`)
console.error(
  `  1. 语言包位置:packages/i18n/messages/<端>/<语言>.json;端内 loader 见脚本顶部 LOADER_TARGETS`,
)
console.error(`  2. 从已有端复制并裁剪 messages 文件`)
console.error(`  3. 确保文件含 'export default { ... }' 结构`)
console.error(`  4. 确保顶级 key 数量 > 0`)

process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
