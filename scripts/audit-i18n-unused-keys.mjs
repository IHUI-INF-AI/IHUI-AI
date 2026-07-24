#!/usr/bin/env node
/**
 * audit-i18n-unused-keys.mjs — i18n 无引用 key 审计(2026-07-25 立)
 *
 * 扫描代码中无静态引用的 i18n key,输出 markdown 审计报告。
 * 只审计不删除,主 agent 决定后续清理。
 *
 * 用法:
 *   node scripts/audit-i18n-unused-keys.mjs                              # 默认扫 web + miniapp-taro
 *   node scripts/audit-i18n-unused-keys.mjs --target=web                  # 只扫 web
 *   node scripts/audit-i18n-unused-keys.mjs --target=miniapp-taro         # 只扫小程序
 *   node scripts/audit-i18n-unused-keys.mjs --dry-run                     # 输出到 stdout
 *   node scripts/audit-i18n-unused-keys.mjs --output=<path>               # 输出到文件
 *
 * 退出码:0 = 审计完成,1 = 参数错误 / 文件不存在
 */
/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()

// ============================================================
// 目标配置
// ============================================================
// 注:任务规格中的路径(apps/web/messages/、apps/miniapp-taro/src/i18n/zh-CN.ts)
// 已于 2026-07-25 迁移到 packages/i18n/messages/{web,miniapp-taro}/zh-CN.json
// (单一来源,各端通过 @ihui/i18n 包导入)。本脚本按实际路径扫描。
const TARGET_CONFIG = {
  web: {
    name: 'web',
    messagesFile: 'packages/i18n/messages/web/zh-CN.json',
    searchDirs: ['apps/web/src', 'apps/web/app'],
    usesNamespaces: true, // next-intl: useTranslations('ns') + t('subkey') → ns.subkey
  },
  'miniapp-taro': {
    name: 'miniapp-taro',
    messagesFile: 'packages/i18n/messages/miniapp-taro/zh-CN.json',
    searchDirs: ['apps/miniapp-taro/src'],
    usesNamespaces: false, // 自定义 useI18n():t('full.path') 直传完整路径
  },
}

// ripgrep 广义匹配模式:捕获所有可能包含 i18n 引用的行
// 匹配 useTranslations / getTranslations / formatMessage / FormattedMessage / i18nKey
// 以及 t( / tt( / tList( 后跟引号(单/双/反引号)
const RG_PATTERN =
  "useTranslations|getTranslations|formatMessage|FormattedMessage|i18nKey|\\bt(?:t|List)?\\s*\\(\\s*['\"`]"

// ============================================================
// CLI 解析
// ============================================================
function parseArgs(argv) {
  const args = argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    return { help: true }
  }
  const targetArg = args.find((a) => a.startsWith('--target='))
  const target = targetArg ? targetArg.slice('--target='.length) : null
  if (target !== null && target !== 'web' && target !== 'miniapp-taro') {
    return { error: `无效的 --target 值: ${target}(可选: web | miniapp-taro)` }
  }
  const dryRun = args.includes('--dry-run')
  const outputArg = args.find((a) => a.startsWith('--output='))
  const output = outputArg ? outputArg.slice('--output='.length) : null
  // 未知参数检查
  const knownFlags = new Set(['--dry-run', '--help', '-h'])
  for (const a of args) {
    if (knownFlags.has(a)) continue
    if (a.startsWith('--target=') || a.startsWith('--output=')) continue
    return { error: `未知参数: ${a}(用 --help 查看可用选项)` }
  }
  return { target, dryRun, output }
}

function showHelp() {
  console.log(`audit-i18n-unused-keys.mjs — i18n 无引用 key 审计

用法:
  node scripts/audit-i18n-unused-keys.mjs                              # 默认扫 web + miniapp-taro
  node scripts/audit-i18n-unused-keys.mjs --target=web                  # 只扫 web
  node scripts/audit-i18n-unused-keys.mjs --target=miniapp-taro         # 只扫小程序
  node scripts/audit-i18n-unused-keys.mjs --dry-run                     # 输出到 stdout
  node scripts/audit-i18n-unused-keys.mjs --output=<path>               # 输出到文件

选项:
  --target=<web|miniapp-taro>   指定扫描目标(默认两端都扫)
  --dry-run                     输出到 stdout,不写文件
  --output=<path>               输出到指定文件(目录不存在自动创建)
  --help, -h                    显示帮助

扫描范围:
  web          基准 packages/i18n/messages/web/zh-CN.json,搜索 apps/web/src + apps/web/app
  miniapp-taro 基准 packages/i18n/messages/miniapp-taro/zh-CN.json,搜索 apps/miniapp-taro/src

退出码:
  0 = 审计完成(无论是否发现无引用 key)
  1 = 参数错误 / 文件不存在 / 解析失败`)
}

// ============================================================
// 消息文件加载与 key 收集
// ============================================================
function loadMessages(filePath) {
  const abs = path.resolve(ROOT, filePath)
  if (!fs.existsSync(abs)) {
    throw new Error(`基准文件不存在: ${filePath}`)
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch (e) {
    throw new Error(`基准文件解析失败: ${filePath} — ${e.message}`)
  }
}

// 递归收集叶子 key(点分路径)+ 顶层 key 数
function collectKeys(obj, prefix = '') {
  const leaves = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sub = collectKeys(v, p)
      leaves.push(...sub.leaves)
    } else {
      leaves.push({ key: p, value: v })
    }
  }
  return { leaves }
}

// ============================================================
// ripgrep 搜索
// ============================================================
function rgSearchLines(searchRoot, pattern) {
  const absRoot = path.resolve(ROOT, searchRoot)
  if (!fs.existsSync(absRoot)) return []
  const result = spawnSync(
    'rg',
    [
      '--no-heading',
      '-n',
      '-g',
      '*.ts',
      '-g',
      '*.tsx',
      '-g',
      '*.js',
      '-g',
      '*.jsx',
      '--',
      pattern,
      absRoot,
    ],
    {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  if (result.error) {
    console.error(`⚠️ ripgrep 搜索失败(${searchRoot}): ${result.error.message}`)
    return []
  }
  // rg exit 1 = 无匹配(正常),exit 0 = 有匹配,exit 2 = 错误
  if (result.status !== 0 && result.status !== 1) {
    console.error(`⚠️ ripgrep 退出码 ${result.status}(${searchRoot}): ${result.stderr || ''}`)
    return []
  }
  return (result.stdout || '').split('\n').filter(Boolean)
}

// ============================================================
// 从代码行中提取 key 引用
// ============================================================
// ripgrep 输出格式: <file_path>:<line_no>:<content>
const RG_LINE_RE = /^(.+?):(\d+):(.*)$/

function parseRgLine(rgLine) {
  const m = RG_LINE_RE.exec(rgLine)
  if (!m) return null
  return { file: m[1], lineNo: parseInt(m[2], 10), content: m[3] }
}

/**
 * 从代码行中提取:
 * - staticKeys:静态 key 引用(t('key') / i18nKey="key" / id: 'key' 等)
 * - dynamicWarnings:动态拼接 key(t(`...${...}`) / t('...' + ...))
 * - namespaces:useTranslations('ns') / getTranslations('ns') 命名空间
 */
function extractFromLine(content, filePath, lineNo, usesNamespaces) {
  const staticKeys = new Set()
  const dynamicWarnings = []
  const namespaces = new Set()
  let m

  // t('key') / t("key") / tt('key', ...) / tList('key')
  const re1 = /\bt(?:t|List)?\s*\(\s*['"]([^'"]+)['"]\s*[,)]/g
  while ((m = re1.exec(content)) !== null) {
    staticKeys.add(m[1])
  }

  // t(`key`) — 静态模板字面量(无 ${} 插值)
  const re2 = /\bt(?:t|List)?\s*\(\s*`([^`${}]+)`\s*[,)]/g
  while ((m = re2.exec(content)) !== null) {
    staticKeys.add(m[1])
  }

  // i18nKey="key" / i18nKey='key'
  const re3 = /i18nKey\s*=\s*['"]([^'"]+)['"]/g
  while ((m = re3.exec(content)) !== null) {
    staticKeys.add(m[1])
  }

  // id="key.path" / id='key.path' — JSX 属性(FormattedMessage 等)
  // 仅匹配含点号的值,过滤 HTML id="content" 等噪声
  const re4 = /\bid\s*=\s*['"]([^'"]*\.[^'"]+)['"]/g
  while ((m = re4.exec(content)) !== null) {
    staticKeys.add(m[1])
  }

  // id: 'key' — 对象属性(formatMessage({ id: 'key' }))
  const re5 = /\bid\s*:\s*['"]([^'"]+)['"]/g
  while ((m = re5.exec(content)) !== null) {
    staticKeys.add(m[1])
  }

  // 动态拼接:t(`...${...}...`)
  const reDyn1 = /\bt(?:t|List)?\s*\(\s*`[^`]*\$\{[^}]*\}[^`]*`/g
  while ((m = reDyn1.exec(content)) !== null) {
    dynamicWarnings.push({
      file: filePath,
      lineNo,
      line: content.trim(),
      pattern: m[0],
    })
  }

  // 动态拼接:t('...' + ...) / t("..." + ...)
  const reDyn2 = /\bt(?:t|List)?\s*\(\s*['"][^'"]*['"]\s*\+/g
  while ((m = reDyn2.exec(content)) !== null) {
    dynamicWarnings.push({
      file: filePath,
      lineNo,
      line: content.trim(),
      pattern: m[0],
    })
  }

  // 命名空间:useTranslations('ns') / getTranslations('ns')
  if (usesNamespaces) {
    const reNs = /\b(?:useTranslations|getTranslations)\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    while ((m = reNs.exec(content)) !== null) {
      namespaces.add(m[1])
    }
  }

  return { staticKeys, dynamicWarnings, namespaces }
}

// ============================================================
// 审计单个目标
// ============================================================
function auditTarget(targetKey) {
  const cfg = TARGET_CONFIG[targetKey]
  if (!cfg) throw new Error(`未知目标: ${targetKey}`)

  // 1. 加载消息文件
  const messages = loadMessages(cfg.messagesFile)
  const { leaves } = collectKeys(messages)
  const topKeyCount = Object.keys(messages).length
  const leafKeyCount = leaves.length

  // 2. ripgrep 搜索代码
  const allRgLines = []
  for (const dir of cfg.searchDirs) {
    const lines = rgSearchLines(dir, RG_PATTERN)
    allRgLines.push(...lines)
  }

  // 3. 按文件分组,提取 key 引用(单次遍历)
  const referencedKeys = new Set()
  const dynamicWarnings = []
  const fileData = new Map() // file -> { namespaces: Set, staticKeys: Set }

  for (const rgLine of allRgLines) {
    const parsed = parseRgLine(rgLine)
    if (!parsed) continue
    const { file, lineNo, content } = parsed

    const { staticKeys, dynamicWarnings: dw, namespaces } = extractFromLine(
      content,
      file,
      lineNo,
      cfg.usesNamespaces,
    )

    if (!fileData.has(file)) {
      fileData.set(file, { namespaces: new Set(), staticKeys: new Set() })
    }
    const fd = fileData.get(file)
    for (const ns of namespaces) fd.namespaces.add(ns)
    for (const k of staticKeys) fd.staticKeys.add(k)
    dynamicWarnings.push(...dw)
  }

  // 4. 解析引用 key
  // 对每个文件中的静态 key:
  //   a) 直接作为完整路径引用(无命名空间场景 / t('full.path') 场景)
  //   b) 与文件中每个命名空间拼接:ns + '.' + key(next-intl 场景)
  for (const [, fd] of fileData) {
    for (const key of fd.staticKeys) {
      referencedKeys.add(key)
      if (cfg.usesNamespaces && fd.namespaces.size > 0) {
        for (const ns of fd.namespaces) {
          referencedKeys.add(`${ns}.${key}`)
        }
      }
    }
  }

  // 5. 判定无引用 key
  const unusedKeys = leaves.filter((leaf) => !referencedKeys.has(leaf.key))

  return {
    target: targetKey,
    messagesFile: cfg.messagesFile,
    topKeyCount,
    leafKeyCount,
    unusedCount: unusedKeys.length,
    unusedKeys,
    dynamicWarningCount: dynamicWarnings.length,
    dynamicWarnings,
    referencedKeyCount: referencedKeys.size,
  }
}

// ============================================================
// Markdown 报告生成
// ============================================================
function truncate(str, max = 40) {
  if (typeof str !== 'string') str = String(str ?? '')
  if (str.length <= max) return str
  return str.slice(0, max) + '...'
}

function escapeMd(str) {
  return String(str).replace(/\|/g, '\\|')
}

function generateReport(results) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

  const lines = []
  lines.push(`# i18n 无引用 key 审计报告(${ts})`)
  lines.push('')

  const isSingle = results.length === 1

  // ── 汇总 ──
  lines.push('## 汇总')
  if (isSingle) {
    const r = results[0]
    lines.push(`- 目标端:${r.target}`)
    lines.push(`- 基准文件:${r.messagesFile}`)
    lines.push(`- 顶层 key 总数:${r.topKeyCount}`)
    lines.push(`- 递归 key 总数:${r.leafKeyCount}`)
    lines.push(`- 无引用 key 数:${r.unusedCount}`)
    const rate = r.leafKeyCount > 0 ? ((r.unusedCount / r.leafKeyCount) * 100).toFixed(1) : '0.0'
    lines.push(`- 无引用率:${r.unusedCount}/${r.leafKeyCount} = ${rate}%`)
    lines.push(`- 动态拼接 key 警告:${r.dynamicWarningCount} 处`)
  } else {
    lines.push(`- 目标端:${results.map((r) => r.target).join(' + ')}`)
    lines.push(`- 审计时间:${ts}`)
    lines.push('')
    lines.push('| 目标 | 基准文件 | 顶层 key | 递归 key | 无引用 key | 无引用率 | 动态拼接警告 |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const r of results) {
      const rate = r.leafKeyCount > 0 ? ((r.unusedCount / r.leafKeyCount) * 100).toFixed(1) : '0.0'
      lines.push(
        `| ${r.target} | ${r.messagesFile} | ${r.topKeyCount} | ${r.leafKeyCount} | ${r.unusedCount} | ${rate}% | ${r.dynamicWarningCount} |`,
      )
    }
  }
  lines.push('')

  // ── 无引用 key 列表 ──
  for (const r of results) {
    const heading = isSingle ? '## 无引用 key 列表(前 50 个)' : `## ${r.target} — 无引用 key 列表(前 50 个)`
    lines.push(heading)
    if (r.unusedKeys.length === 0) {
      lines.push('✅ 未发现无引用 key')
    } else {
      lines.push('| # | key 路径 | zh-CN 值(前 40 字符) |')
      lines.push('|---|---|---|')
      const shown = r.unusedKeys.slice(0, 50)
      shown.forEach((k, i) => {
        lines.push(`| ${i + 1} | ${escapeMd(k.key)} | ${escapeMd(truncate(k.value, 40))} |`)
      })
      if (r.unusedKeys.length > 50) {
        lines.push(`| ... | _(还有 ${r.unusedKeys.length - 50} 个省略)_ | |`)
      }
    }
    lines.push('')

    // ── 动态拼接 key 警告 ──
    const warnHeading = isSingle
      ? '## 动态拼接 key 警告(全部)'
      : `## ${r.target} — 动态拼接 key 警告(全部)`
    lines.push(warnHeading)
    if (r.dynamicWarnings.length === 0) {
      lines.push('✅ 未检测到动态拼接 key')
    } else {
      lines.push(`⚠️ 检测到 ${r.dynamicWarnings.length} 处动态拼接 key,无法静态审计,需人工甄别`)
      lines.push('')
      for (const w of r.dynamicWarnings) {
        const relFile = path.relative(ROOT, w.file).replace(/\\/g, '/')
        // 反引号在 markdown 内联代码中无法直接转义,用单引号替代显示
        const display = w.pattern.replace(/`/g, "'")
        lines.push(`- ${relFile}:${w.lineNo} \`${display}\``)
      }
    }
    lines.push('')
  }

  // ── 建议 ──
  lines.push('## 建议')
  lines.push('- 审计出的无引用 key 可能因动态拼接未识别,人工确认后再清理')
  lines.push('- 不建议批量删除,逐个 key 评估')
  lines.push('- ⚠️ 检测到动态拼接 key 时,相关命名空间下的所有 key 都不应轻易判定为无引用')
  lines.push('')

  return lines.join('\n')
}

// ============================================================
// 主函数
// ============================================================
function main() {
  const opts = parseArgs(process.argv)
  if (opts.help) {
    showHelp()
    process.exit(0)
  }
  if (opts.error) {
    console.error(`❌ ${opts.error}`)
    console.error('用 --help 查看用法')
    process.exit(1)
  }

  // 确定扫描目标
  const targets = opts.target ? [opts.target] : ['web', 'miniapp-taro']

  // 审计各目标
  const results = []
  for (const t of targets) {
    try {
      results.push(auditTarget(t))
    } catch (e) {
      console.error(`❌ 审计 ${t} 失败: ${e.message}`)
      process.exit(1)
    }
  }

  // 生成报告
  const report = generateReport(results)

  // 输出
  if (opts.output) {
    // 输出到文件
    const outAbs = path.resolve(ROOT, opts.output)
    const outDir = path.dirname(outAbs)
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }
    fs.writeFileSync(outAbs, report, 'utf8')
    // 统计信息到 stdout
    for (const r of results) {
      const rate = r.leafKeyCount > 0 ? ((r.unusedCount / r.leafKeyCount) * 100).toFixed(1) : '0.0'
      console.log(
        `[${r.target}] 递归 key ${r.leafKeyCount}, 无引用 ${r.unusedCount} (${rate}%), 动态拼接警告 ${r.dynamicWarningCount} 处`,
      )
    }
    console.log(`✅ 报告已写入: ${path.relative(ROOT, outAbs).replace(/\\/g, '/')}`)
  } else {
    // 输出到 stdout(报告本体)
    process.stdout.write(report)
    // 统计信息到 stderr(不污染 stdout 的 markdown)
    for (const r of results) {
      const rate = r.leafKeyCount > 0 ? ((r.unusedCount / r.leafKeyCount) * 100).toFixed(1) : '0.0'
      console.error(
        `[${r.target}] 递归 key ${r.leafKeyCount}, 无引用 ${r.unusedCount} (${rate}%), 动态拼接警告 ${r.dynamicWarningCount} 处`,
      )
    }
  }

  process.exit(0)
}

main()
