#!/usr/bin/env node
/**
 * 检测 en.json 中的破碎机翻英文（pre-commit 第 2e 项守门）。
 *
 * 破碎模式（基于历史修复案例归纳）：
 *   1. 无空格拼接：多个英文单词首字母大写直接拼接（AgentDevPlatform / BigModelAppDev）
 *   2. 拼音混合：英文+拼音/中文拼音残留（startpeopleCTOCEO / Siningpeople）
 *   3. 大小写混乱：单词内大小写异常切换（M3SubAI / SubPay）
 *   4. 中文残留：value 中含中文字符（应该已被 scan-i18n-zh-residue.mjs 拦截，本脚本兜底）
 *   5. 单字母粘连：3+ 连续单字母大写（CTOCEO / APIHTML）
 *
 * 豁免清单（合法无空格字符串）：
 *   - 品牌/技术缩写：AI/GPT/LLM/API/HTML/CSS/SDK/IO/SaaS/PaaS/IaaS
 *   - 文件扩展名/路径：.tar.gz / .docx
 *   - 配置 key：JSON 路径如 models.nav.sort
 *   - 占位符：{var} / {{var}} / %s
 *
 * 用法：
 *   node scripts/check-i18n-broken-en.mjs                          # 全量扫描 apps/web/messages/en.json
 *   node scripts/check-i18n-broken-en.mjs --staged                 # 仅扫描 staged 改动
 *   node scripts/check-i18n-broken-en.mjs --fix                    # 输出修复建议（不写文件）
 *   node scripts/check-i18n-broken-en.mjs --readme                 # 扫描根目录 README.en.md
 *   node scripts/check-i18n-broken-en.mjs --target=extension       # 扫描 packages/i18n/messages/extension/en.json
 *
 * Markdown 模式 (--readme):
 *   扫描 README.en.md 检测破碎机翻英文，跳过:
 *     - ``` / ~~~ 代码块内容
 *     - HTML 注释 <!-- ... -->
 *     - 图片标签 ![alt](src)
 *     - 链接 URL 部分 [text](url) → 仅扫描 text
 *     - 行内代码 `code`
 *   其余行内 token 应用同样的 detectBroken 检测规则。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

// 豁免词（出现在 token 中即豁免，大小写不敏感）
const WHITELIST_TOKENS = [
  'AI', 'GPT', 'LLM', 'API', 'HTML', 'CSS', 'SDK', 'IO', 'SaaS', 'PaaS', 'IaaS',
  'JSON', 'XML', 'HTTP', 'HTTPS', 'URL', 'URI', 'UUID', 'SSO', 'OAuth', 'JWT',
  'CSV', 'PDF', 'PNG', 'JPG', 'JPEG', 'SVG', 'MP3', 'MP4', 'GIF', 'WEBP',
  'UI', 'UX', 'QA', 'QC', 'CI', 'CD', 'CRUD', 'ORM', 'SQL', 'NoSQL',
  'M3', 'M4', 'GPT4', 'GPT5', 'GPT3.5', 'DALL-E', 'DALL·E',
  'iOS', 'Android', 'macOS', 'tvOS', 'watchOS',
  'Copilot', 'ChatGPT', 'Claude', 'Gemini', 'Grok', 'Whisper',
  'TTS', 'STT', 'ASR', 'NER', 'RAG', 'MCP',
  '3D', '2D', 'VR', 'AR', 'XR', 'MR',
  'B2B', 'B2C', 'C2C', 'O2O',
  'PR', 'MR', 'CR', 'LGTM',
]

// 语言原生名称(autoglossonym)白名单 — 语言选择器中显示各语言的本名,
// 即使在非中文 locale 文件中也保留原文字符(如 en.json 中 "zhCN": "简体中文")。
// 这些值含汉字但非"中文残留",应跳过检测。
// 典型场景:extension 端语言选择器显示 "简体中文/繁體中文/日本語" 等本名。
const LANGUAGE_AUTOGLOSSONYMS = new Set([
  '简体中文', '繁體中文', '繁体中文', '中文',
  '日本語', '日本语',
])

// 检测规则（按优先级，避免误报优先）
function detectBroken(value) {
  if (!value || typeof value !== 'string') return null
  const v = value.trim()
  if (v.length < 4) return null
  // 语言原生名称白名单(语言选择器本名,非中文残留)
  if (LANGUAGE_AUTOGLOSSONYMS.has(v)) return null
  // 中文残留（兜底）
  if (/[\u4e00-\u9fff]/.test(v)) return 'zh-residue'
  // 全空格分隔的英文不检
  if (!/[A-Z]/.test(v)) return null

  // 提取所有英文 token（按空格/标点分割）
  const tokens = v.split(/[\s,.;:!?'"\-—–·/\\|()[\]{}@#$%^&*+=~`]+/).filter(t => t.length > 0)

  for (const tok of tokens) {
    if (tok.length < 4) continue
    // 豁免：纯数字
    if (/^\d+$/.test(tok)) continue
    // 豁免：纯小写
    if (/^[a-z]+$/.test(tok)) continue
    // 豁免：纯大写（任意长度，如 PLATFORM / OVERVIEW 是合法英文单词全大写形式）
    if (/^[A-Z]+$/.test(tok)) continue
    // 豁免：单词单大写开头
    if (/^[A-Z][a-z]+$/.test(tok)) continue
    // 豁免：含白名单 token
    if (WHITELIST_TOKENS.some(w => tok.toLowerCase().includes(w.toLowerCase()))) continue
    // 豁免：版本号/路径
    if (/[0-9]\.[0-9]/.test(tok) || tok.includes('/')) continue

    // 检测 1：无空格拼接 ≥3 单词（CamelCase × 3+）
    // 例：AgentDevPlatform / BigModelAppDev / IconFileing
    // 排除：2 段复合词（VIPUser / MIMEType / CADPaper / PPTDemo 等合法技术复合词）
    if (/^[A-Z][a-z]+([A-Z][a-z]+){2,}$/.test(tok)) return 'no-space-concat'

    // 检测 2：单词内大小写异常切换 ≥3 次（M3SubAI / SubPayCTO）
    // 切换定义：小写→大写 / 大写-小写-大写 / 数字→大写 / 大写-数字-大写
    const switches = (tok.match(/[a-z][A-Z]|[A-Z][a-z][A-Z]|[0-9][A-Z]|[A-Z][0-9][A-Z]/g) || []).length
    if (switches >= 3) return 'case-chaos'

    // 检测 3：拼音残留（连续小写 ≥10 字符 + 不在常见英文词清单）
    // 例：siningpeople / startpeople
    if (/^[a-z]{10,}$/.test(tok)) {
      const commonWords = new Set([
        'information', 'description', 'configuration', 'notification', 'registration',
        'authentication', 'authorization', 'administration', 'communication',
        'implementation', 'documentation', 'infrastructure', 'optimization',
        'internationalization', 'localization', 'personalization', 'subscription',
        'membership', 'partnership', 'relationship', 'achievement', 'development',
        'deployment', 'enhancement', 'improvement', 'measurement', 'management',
        'requirement', 'environment', 'equipment', 'establishment',
        'representation', 'interpretation', 'consideration', 'investigation',
        'responsibility', 'availability', 'accessibility', 'compatibility',
        'maintainability', 'extensibility', 'scalability', 'reliability',
      ])
      if (!commonWords.has(tok)) return 'possible-pinyin'
    }
  }
  return null
}

function walk(obj, pathStr, results) {
  if (typeof obj === 'string') {
    const issue = detectBroken(obj)
    if (issue) results.push({ path: pathStr, value: obj, issue })
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => walk(v, `${pathStr}[${i}]`, results))
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      walk(obj[k], pathStr ? `${pathStr}.${k}` : k, results)
    }
  }
}

function getStagedChanges(relPath) {
  try {
    const out = execSync(`git diff --cached --name-only -- ${relPath}`, { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// Markdown 模式: 扫描 README.en.md 检测破碎英文
// 跳过: ``` / ~~~ 代码块 / HTML 注释 / 图片标签 / 链接 URL / 行内代码
// 行级白名单: 中国法定 ICP 备案号(吉ICP备XXXXXXXX号)格式不可翻译,跨语言版均保留中文
const MARKDOWN_LINE_WHITELIST_EN = [
  /ICP[备备]\d+号/, // 中国 ICP 备案号(简体/繁体)
]
function scanMarkdownForBrokenEn(text) {
  const lines = text.split('\n')
  const results = []
  let inCodeFence = false
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (/^(\s*)(```|~~~)/.test(raw)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue
    if (/^\s*<!--/.test(raw)) continue
    if (MARKDOWN_LINE_WHITELIST_EN.some((re) => re.test(raw))) continue
    // 提取行内文本: 移除图片 + 链接保留 text + 移除行内代码
    const cleaned = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/`[^`]*`/g, ' ')
    // 提取所有英文 token 应用 detectBroken
    const tokens = cleaned.split(/[\s,.;:!?'"\-—–·/\\|()[\]{}@#$%^&*+=~`]+/).filter((t) => t.length > 0)
    for (const tok of tokens) {
      const issue = detectBroken(tok)
      if (issue) {
        results.push({ path: `L${i + 1}`, value: tok, issue })
      }
    }
  }
  return results
}

function main() {
  const args = process.argv.slice(2)
  const staged = args.includes('--staged')
  const fix = args.includes('--fix')
  const readme = args.includes('--readme')
  const targetArg = args.find((a) => a.startsWith('--target='))
  const target = targetArg ? targetArg.split('=')[1] : 'web'
  const isExtension = target === 'extension'

  let relPath
  if (readme) {
    relPath = 'README.en.md'
  } else if (isExtension) {
    relPath = 'packages/i18n/messages/extension/en.json'
  } else {
    relPath = 'apps/web/messages/en.json'
  }
  const targetFile = path.resolve(relPath)

  if (staged) {
    const stagedFiles = getStagedChanges(relPath)
    if (!stagedFiles.includes(relPath)) {
      console.log(`[broken-en] 跳过 (staged 模式: ${relPath} 未改动)`)
      return
    }
  }

  if (!fs.existsSync(targetFile)) {
    console.log(`[broken-en] 跳过 (文件不存在: ${targetFile})`)
    return
  }

  if (readme) {
    const text = fs.readFileSync(targetFile, 'utf8')
    const results = scanMarkdownForBrokenEn(text)
    if (results.length === 0) {
      console.log(`[broken-en] ✅ ${relPath} 通过 (0 处破碎英文)`)
      return
    }
    console.log(`[broken-en] ❌ ${relPath} 发现 ${results.length} 处破碎机翻英文:\n`)
    for (const r of results.slice(0, 50)) {
      console.log(`  ${r.path} [${r.issue}] = ${JSON.stringify(r.value).slice(0, 80)}`)
    }
    if (results.length > 50) {
      console.log(`  ... 还有 ${results.length - 50} 处`)
    }
    console.log(`\n修复:人工对照 README.md 翻译,或运行 node scripts/apply-brand-glossary.mjs --dry-run 查看品牌映射建议`)
    if (fix) {
      console.log('\n--fix 模式:仅提供诊断,不自动写文件(避免误改)')
    }
    process.exit(1)
  }

  // 原 JSON 模式逻辑保持不变
  const raw = fs.readFileSync(targetFile, 'utf8')
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    console.error(`[broken-en] ❌ ${relPath} JSON 解析失败: ${e.message}`)
    process.exit(1)
  }

  const results = []
  walk(obj, '', results)

  if (results.length === 0) {
    console.log('[broken-en] ✅ 通过 (0 处破碎英文)')
    return
  }

  console.log(`[broken-en] ❌ 发现 ${results.length} 处破碎机翻英文:\n`)
  for (const r of results.slice(0, 50)) {
    console.log(`  ${r.path} [${r.issue}] = ${JSON.stringify(r.value).slice(0, 80)}`)
  }
  if (results.length > 50) {
    console.log(`  ... 还有 ${results.length - 50} 处`)
  }
  console.log(`\n修复:人工对照 zh-CN.json 翻译,或运行 node scripts/apply-brand-glossary.mjs --dry-run 查看品牌映射建议`)

  if (fix) {
    console.log('\n--fix 模式:仅提供诊断,不自动写文件(避免误改)')
  }

  process.exit(1)
}

main()
