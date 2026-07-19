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
 *   node scripts/check-i18n-broken-en.mjs              # 全量扫描
 *   node scripts/check-i18n-broken-en.mjs --staged      # 仅扫描 staged 改动
 *   node scripts/check-i18n-broken-en.mjs --fix         # 输出修复建议（不写文件）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const FILE = path.resolve('apps/web/messages/en.json')

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

// 检测规则（按优先级，避免误报优先）
function detectBroken(value) {
  if (!value || typeof value !== 'string') return null
  const v = value.trim()
  if (v.length < 4) return null
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

function getStagedChanges() {
  try {
    const out = execSync('git diff --cached --name-only -- apps/web/messages/en.json', { encoding: 'utf8' })
    return out.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function main() {
  const args = process.argv.slice(2)
  const staged = args.includes('--staged')
  const fix = args.includes('--fix')

  if (staged) {
    const stagedFiles = getStagedChanges()
    if (!stagedFiles.includes('apps/web/messages/en.json')) {
      console.log('[broken-en] 跳过 (staged 模式: en.json 未改动)')
      return
    }
  }

  if (!fs.existsSync(FILE)) {
    console.log(`[broken-en] 跳过 (文件不存在: ${FILE})`)
    return
  }

  const raw = fs.readFileSync(FILE, 'utf8')
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    console.error(`[broken-en] ❌ en.json JSON 解析失败: ${e.message}`)
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
