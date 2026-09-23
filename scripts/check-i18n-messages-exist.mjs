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
 * 根目录注入(2026-09-24 立,AGENTS.md §22c/§22d 同族):
 *   原实现 `const ROOT = process.cwd()`,自测夹具只切 cwd 不注入根 ⇒ 测试跑的是**真仓**,
 *   13 例里 10 例恒红且没人跑得动(与 scan-hardcoded-zh 同型事故)。现改为:
 *   ROOT 优先级 `--root <dir>` > 环境变量 `I18N_MESSAGES_EXIST_ROOT` > 脚本自身推导的仓库根
 *   (命名沿用仓内既有约定 `CAPABILITY_CATALOG_ROOT` / `OPENAPI_CHECK_ROOT`)。
 *   不带任何注入时仍以仓库根为准 —— 由脚本自身位置推导,不再被调用方 cwd 左右。
 *
 * 验证项：
 *   1. 全部语言包目录 × 全部语言 = N 份 JSON 全部存在且可解析为非空对象
 *   2. 端内 loader + 签入压缩产物存在且含 export;产物体积不低于下限
 *
 * 退出码：
 *   0 = 通过
 *   1 = 失败（缺失文件 / 解析失败 / 空文件 / 体积不足）
 *   2 = 脚本自身无法判定（--root 指向不存在的目录 / 检查清单为空 / --staged 与 --root 冲突）
 *
 * 用法：
 *   node scripts/check-i18n-messages-exist.mjs                 # 全量检查(仓库根)
 *   node scripts/check-i18n-messages-exist.mjs --staged        # pre-commit 模式
 *   node scripts/check-i18n-messages-exist.mjs --root <dir>    # 注入扫描根(自测/审计缝)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SELF_DIR, '..')
const ROOT_ENV_KEY = 'I18N_MESSAGES_EXIST_ROOT'

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

// 端内 loader 入口必须存在且能 export;desktop 无自有 i18n(它加载 8801 那份 web 页)
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

// 检查清单总项数:为"0 项不得报绿"守卫与结论行共用同一真相
const EXPECTED_ITEM_COUNT = ENDPOINTS.length * LOCALES.length + LOADER_TARGETS.length

/**
 * 解析扫描根:--root > 环境变量 > 脚本自身推导的仓库根。
 * 两种写法都收(2026-09-24 补:`--root=<dir>` 等号形态是本仓 CLI 的常见手写法,
 * 早期只认 `--root <dir>` 空格形态,于是 `--root=<不存在的目录>` 会被**静默忽略**、
 * 直接扫真仓报"通过" —— 正是本门要消灭的那一类假绿):
 *   --root <dir>   空格形态(与 check-pwsh-version / scan-hardcoded-zh 同口径)
 *   --root=<dir>   等号形态
 * 纯函数(argv/env 由入参给),便于 §22c 镜像测试直接断言优先级。
 */
function resolveRoot(argv, env) {
  let cli = null
  const eqToken = argv.find((a) => typeof a === 'string' && a.startsWith('--root='))
  if (eqToken !== undefined) {
    cli = eqToken.slice('--root='.length)
    if (!cli.trim()) throw new Error('--root= 缺少目录值(要么给路径,要么去掉这个参数)')
  } else {
    const i = argv.indexOf('--root')
    const flagVal = i >= 0 ? argv[i + 1] : null
    cli = flagVal && !flagVal.startsWith('-') ? flagVal : null
  }
  const fromEnv = String(env[ROOT_ENV_KEY] || '').trim() || null
  return path.resolve(cli || fromEnv || REPO_ROOT)
}

/** 暂存区里触及了哪些语言包端(目录缺失也算触及该端) */
function collectStagedEndpoints(stagedFiles, endpoints) {
  const hit = new Set()
  for (const f of stagedFiles) {
    for (const endpoint of endpoints) {
      if (f.startsWith(`${endpoint.dir}/`)) hit.add(endpoint.name)
    }
  }
  return hit
}

/** 语言包 JSON:存在 + 可解析 + 是非空对象 */
function scanMessages(root) {
  const missing = []
  const parseErrors = []
  const emptyFiles = []
  for (const endpoint of ENDPOINTS) {
    const dirAbs = path.resolve(root, endpoint.dir)
    if (!fs.existsSync(dirAbs)) {
      missing.push({ endpoint: endpoint.name, path: endpoint.dir, issue: 'directory-missing' })
      continue
    }
    for (const locale of LOCALES) {
      const relPath = path.join(endpoint.dir, endpoint.filePattern(locale))
      const absPath = path.resolve(root, relPath)
      if (!fs.existsSync(absPath)) {
        missing.push({ endpoint: endpoint.name, path: relPath, issue: 'file-missing', locale })
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
        parseErrors.push({ endpoint: endpoint.name, path: relPath, issue: 'not-a-json-object' })
        continue
      }
      if (Object.keys(parsed).length === 0) {
        emptyFiles.push({ endpoint: endpoint.name, path: relPath, issue: 'no-top-level-keys' })
      }
    }
  }
  return { missing, parseErrors, emptyFiles }
}

/** 端内 loader / 签入产物:存在 + 有导出 + 体积下限(防被清空或未生成) */
function scanLoaders(root) {
  const missing = []
  const parseErrors = []
  const emptyFiles = []
  for (const target of LOADER_TARGETS) {
    const absPath = path.resolve(root, target.file)
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
  return { missing, parseErrors, emptyFiles }
}

function main() {
  const argv = process.argv
  const isStaged = argv.includes('--staged')
  const root = resolveRoot(argv, process.env)

  // 判不了就红,绝不静默 exit 0(与"空暂存恒绿""扫不到包就报绿"同族反例)
  if (EXPECTED_ITEM_COUNT === 0) {
    console.error(
      `${C.red}[i18n-messages-exist] ❌ 检查清单为空(ENDPOINTS=${ENDPOINTS.length} LOADER_TARGETS=${LOADER_TARGETS.length}),无法判定,拒绝报绿${C.reset}`,
    )
    return 2
  }
  if (!fs.existsSync(root)) {
    console.error(`${C.red}[i18n-messages-exist] ❌ 根目录不存在: ${root}${C.reset}`)
    return 2
  }
  // --staged 读的是 git 暂存区;夹具根不是仓库根时 `git diff --cached` 会解析到**外层真仓**,
  // 结论与被检对象完全脱节(假绿/假红都可能),故直接拒绝这一组合而不是猜一个答案。
  if (isStaged && root !== REPO_ROOT) {
    console.error(
      `${C.red}[i18n-messages-exist] ❌ --staged 必须作用于仓库根(当前 --root=${root} ≠ ${REPO_ROOT}):暂存区数据来自 git 仓库,与被注入的夹具根无关${C.reset}`,
    )
    return 2
  }

  const lang = scanMessages(root)
  const loaders = scanLoaders(root)
  const missing = [...lang.missing, ...loaders.missing]
  const parseErrors = [...lang.parseErrors, ...loaders.parseErrors]
  const emptyFiles = [...lang.emptyFiles, ...loaders.emptyFiles]

  // pre-commit 模式：暂存区完全不涉及 i18n 时跳过;一旦涉及,则**全量**校验所有端
  // (2026-09-24 说明:原实现另有一层 filterByEndpoint,其判据
  //  `KNOWN_ENDPOINTS.includes(issue.endpoint)` 恒真 —— 所有 issue 的 endpoint 本就取自
  //  ENDPOINTS/LOADER_TARGETS,是个永不生效的死过滤器。行为保持"全量"不变,只把假装有
  //  的收窄删掉,免得后人误读为"staged 只查涉及的端"而据此省略检查。)
  if (isStaged) {
    let stagedFiles
    try {
      // execFileSync + 参数数组:不经 cmd.exe(既避开 shell 元字符,也少一层派生窗口)
      const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
        encoding: 'utf8',
        cwd: root,
        windowsHide: true,
        timeout: 15000,
      })
      stagedFiles = staged.split('\n').filter(Boolean)
    } catch {
      console.error(
        `${C.yellow}[i18n-messages-exist] 读取暂存区失败,降级为全量检查${C.reset}`,
      )
      stagedFiles = null
    }
    if (stagedFiles) {
      const stagedI18nDirs = collectStagedEndpoints(stagedFiles, ENDPOINTS)
      if (stagedI18nDirs.size === 0) {
        console.log(`${C.dim}[i18n-messages-exist] staged 模式: 暂存区无 i18n 改动,跳过${C.reset}`)
        return 0
      }
      console.log(
        `${C.cyan}[i18n-messages-exist] staged 模式: 涉及 ${[...stagedI18nDirs].join(', ')},执行全量检查${C.reset}`,
      )
    }
  }

  const totalIssues = missing.length + parseErrors.length + emptyFiles.length

  if (totalIssues === 0) {
    console.log(
      `${C.green}[i18n-messages-exist] ✅ 通过 (${root}) ${ENDPOINTS.length} 个语言包目录 × ${LOCALES.length} 语言 = ${ENDPOINTS.length * LOCALES.length} 份 JSON + ${LOADER_TARGETS.length} 个端内 loader/签入产物,合计 ${EXPECTED_ITEM_COUNT} 项全部存在且合法${C.reset}`,
    )
    return 0
  }

  console.error(`${C.red}[i18n-messages-exist] ❌ 发现 ${totalIssues} 处问题(${root}):${C.reset}\n`)

  if (missing.length > 0) {
    console.error(`  ${C.red}缺失文件/目录(${missing.length}个):${C.reset}`)
    for (const m of missing) console.error(`    ${C.red}[${m.endpoint}] ${m.path} (${m.issue})${C.reset}`)
    console.error('')
  }

  if (parseErrors.length > 0) {
    console.error(`  ${C.red}解析错误(${parseErrors.length}个):${C.reset}`)
    for (const p of parseErrors)
      console.error(`    ${C.red}[${p.endpoint}] ${p.path} (${p.issue})${C.reset}`)
    console.error('')
  }

  if (emptyFiles.length > 0) {
    // 原文案写"空文件警告",但这一类照样计入 totalIssues 并 exit 1 —— 文案与退出码不符,
    // 会让人误以为可忽略。改为如实标注"判失败"。
    console.error(`  ${C.yellow}空内容(${emptyFiles.length}个,判失败):${C.reset}`)
    for (const e of emptyFiles)
      console.error(`    ${C.yellow}[${e.endpoint}] ${e.path} (${e.issue})${C.reset}`)
    console.error('')
  }

  console.error(`${C.yellow}修复方法:${C.reset}`)
  console.error(
    `  1. 语言包位置:${MSG_ROOT}/<端>/<语言>.json;端内 loader 见脚本顶部 LOADER_TARGETS`,
  )
  console.error('  2. 语言包必须是可解析的 JSON **对象**,且顶级 key 数量 > 0')
  console.error('  3. 端内 loader 需含具名导出;签入产物需已生成(不低于体积下限)')

  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    process.exit(main() ?? 0)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

// AGENTS.md §22c:暴露布局与纯判据给镜像测试直接 import(夹具据此生成,禁止在测试里复制路径清单)
export const __test__ = {
  REPO_ROOT,
  ROOT_ENV_KEY,
  LOCALES,
  MSG_ROOT,
  ENDPOINTS,
  LOADER_TARGETS,
  EXPECTED_ITEM_COUNT,
  resolveRoot,
  collectStagedEndpoints,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
