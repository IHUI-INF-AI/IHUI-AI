#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 * 本脚本仅支持 3 个 target(--target=web|extension|shared,不带 --target 默认 web)。
 * 传入其它 target(含 packages/i18n/messages/ 下确实存在 en.json 但本脚本未覆盖的
 * api / cli / miniapp-taro / mobile-rn)一律报错退出,绝不回落去扫 web ——
 * 守门脚本的假绿比不判更糟(2026-10-06 fail-closed 修复)。
 *
 * 用法：
 *   node scripts/check-i18n-broken-en.mjs                          # 扫 packages/i18n/messages/web/en.json
 *   node scripts/check-i18n-broken-en.mjs --staged                 # 仅扫描 staged 改动
 *   node scripts/check-i18n-broken-en.mjs --fix                    # 输出修复建议（不写文件）
 *   node scripts/check-i18n-broken-en.mjs --readme                 # 扫描根目录 README.en.md
 *   node scripts/check-i18n-broken-en.mjs --target=web             # 同默认
 *   node scripts/check-i18n-broken-en.mjs --target=extension       # 扫描 packages/i18n/messages/extension/en.json
 *   node scripts/check-i18n-broken-en.mjs --target=shared          # 扫描 packages/i18n/messages/shared/en.json
 *
 * 入口形态（§22d，2026-10-08 台账家族票 G-1058651 收口）：
 *   修前本文件在模块顶层裸调 `main()` —— 于是 `import` 它就等于跑一遍扫描（有输出、还能把
 *   宿主进程的 exitCode 改掉），镜像测试无从取用生产判据，只能照 §22c 的反面"自己抄一份"。
 *   现 `main()` 只在 `isDirectRun`（真被 CLI 直跑）时执行，且**返回**退出码而不是自己
 *   `process.exit`：CLI 面的退出码契约不变（0 通过 / 1 违规或未知 target），
 *   判据本体（detectBroken / scanMarkdownForBrokenEn / SUPPORTED_TARGETS …）经
 *   `export const __test__` 单点导出，镜像测试 import 它，不再手写第二份 target 清单。
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
// §22d 入口守卫:Windows 下 process.argv[1] 是反斜杠绝对路径,与手拼的 'file:///…' 永不相等,
// 必须用 node:url 的 pathToFileURL 归一后再比 —— 与仓内已收口的门体(check-test-judge-not-replicated
// 等)同一份写法,不在本文件另创第二形。
import { pathToFileURL } from 'node:url'

// 豁免词（完整 token 等于 或 按 -/_/. 分段后任一段等于，大小写不敏感）
// 注意：不用子串包含匹配，避免 "M3" 误豁免 "M3SubAI" 等 CamelCase token
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
const WHITELIST_SET = new Set(WHITELIST_TOKENS.map(w => w.toLowerCase()))
// 完整 token 等于白名单项，或按 -/_/. 分段后任一段等于（合法复合词如 GPT-4 / DALL-E / iOS-15 / GPT_4）
// 不用子串包含：避免 "M3" 误豁免 "M3SubAI"、"ORM" 误豁免 "AgentDevPlatform"
function isWhitelistedToken(tok) {
  if (WHITELIST_SET.has(tok.toLowerCase())) return true
  const parts = tok.split(/[-_.]+/).filter(Boolean)
  return parts.some(p => WHITELIST_SET.has(p.toLowerCase()))
}

// 语言原生名称(autoglossonym)白名单 — 语言选择器中显示各语言的本名,
// 即使在非中文 locale 文件中也保留原文字符(如 en.json 中 "zhCN": "简体中文")。
// 这些值含汉字但非"中文残留",应跳过检测。
// 典型场景:extension 端语言选择器显示 "简体中文/繁體中文/日本語" 等本名。
const LANGUAGE_AUTOGLOSSONYMS = new Set([
  '简体中文', '繁體中文', '繁体中文', '中文',
  '日本語', '日本语',
])

// 跨语言品牌名标注白名单(2026-07-26 立)
// en.json 中允许在括号内附中文品牌名做 SEO 标注(IHUI AI / 智汇 AI 双名标注),
// 这是 i18n §19 brand-glossary.json 规则允许的"品牌名/公司名优先 canonical 英文名"
// 的合理扩展。豁免:整体 value 含此白名单中的品牌名。
// 注意:仅豁免"括号内引用"形式(value 含 `品牌名` 但周围是括号或"(Chinese: 品牌名)"形式),
// 避免把整句中文误判放过。
const BRAND_NAME_ZH = ['智汇 AI', '智汇AI']
function isBrandNameInParens(v) {
  // 匹配 (智汇 AI) / (Chinese: 智汇 AI) / （智汇 AI） 三种形式
  for (const name of BRAND_NAME_ZH) {
    if (v.includes(name)) {
      // 中文外必须被括号包裹
      const re = new RegExp(`[(\uff08][^)）]*?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^)）]*?[)）]`)
      if (re.test(v)) return true
    }
  }
  return false
}

// 检测规则（按优先级，避免误报优先）
function detectBroken(value) {
  if (!value || typeof value !== 'string') return null
  const v = value.trim()
  if (v.length < 4) return null
  // 语言原生名称白名单(语言选择器本名,非中文残留)
  if (LANGUAGE_AUTOGLOSSONYMS.has(v)) return null
  // 中文残留（兜底）
  if (/[\u4e00-\u9fff]/.test(v)) {
    // 豁免:跨语言品牌名标注(括号内附中文品牌名,如 "IHUI AI (智汇 AI)")
    if (isBrandNameInParens(v)) return null
    return 'zh-residue'
  }
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
    // 豁免：含白名单 token（完整等于 或 按 -/_/. 分段后任一段等于）
    if (isWhitelistedToken(tok)) continue
    // 豁免：版本号/路径
    if (/[0-9]\.[0-9]/.test(tok) || tok.includes('/')) continue

    // 检测 1：无空格拼接 ≥3 单词（CamelCase × 3+）
    // 例：AgentDevPlatform / BigModelAppDev / IconFileing
    // 排除：2 段复合词（VIPUser / MIMEType / CADPaper / PPTDemo 等合法技术复合词）
    if (/^[A-Z][a-z]+([A-Z][a-z]+){2,}$/.test(tok)) return 'no-space-concat'

    // 检测 2：单词内大小写异常切换 ≥3 次（M3SubAI / SubPayCTO）
    // 切换定义：小写→大写 / 大写-小写-大写 / 数字→大写 / 大写-数字-大写
    // 分次独立计数：单次 match(/g) 不抓重叠（"M3S" 会吞掉 "3S"），拆成 4 次允许重叠计数
    const switches =
      (tok.match(/[a-z][A-Z]/g) || []).length +
      (tok.match(/[A-Z][a-z][A-Z]/g) || []).length +
      (tok.match(/[0-9][A-Z]/g) || []).length +
      (tok.match(/[A-Z][0-9][A-Z]/g) || []).length
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
    const out = execSync(`git diff --cached --name-only -- ${relPath}`, {
      encoding: 'utf8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
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

// 本脚本真实支持的 target 白名单(fail-closed:不在表内 ⇒ 报错退出,绝不回落 web)
const SUPPORTED_TARGETS = ['web', 'extension', 'shared']

/**
 * 扫描主流程。**返回**退出码(0 通过 / 1 违规或未知 target),不在内部 `process.exit` ——
 * 裸 exit 会把 import 本模块的宿主(测试运行器)一起带走。
 * @returns {Promise<number>}
 */
async function main() {
  const args = process.argv.slice(2)
  const staged = args.includes('--staged')
  const fix = args.includes('--fix')
  const readme = args.includes('--readme')
  const targetArg = args.find((a) => a.startsWith('--target='))
  const target = targetArg ? targetArg.slice('--target='.length) : 'web'

  // fail-closed 校验(2026-06-06):未知 target 绝不静默回落扫 web。
  // 原缺陷:--target=api / --target=zzz / 不带参数 三种跑法输出逐字相同都报"✅ 通过" ⇒ 假绿。
  if (!SUPPORTED_TARGETS.includes(target)) {
    const known = SUPPORTED_TARGETS.join(' / ')
    console.error(
      [
        `[broken-en] ❌ 未知 --target=${target === '' ? '(空)' : target}`,
        `  本脚本仅支持: --target=${known}(不带 --target 默认 web)`,
        `  拒绝回落去扫 web —— 未知 target 静默回 web 会制造假绿(守门脚本假绿比不判更糟)。`,
        `  注:packages/i18n/messages/ 下 api / cli / miniapp-taro / mobile-rn 的 en.json`,
        `      确实存在,但本脚本尚未覆盖,它们仍无人用本门禁管(已知缺口,非本脚本职责)。`,
      ].join('\n'),
    )
    return 1
  }

  const isExtension = target === 'extension'
  const isShared = target === 'shared'

  let relPath
  if (readme) {
    relPath = 'README.en.md'
  } else if (isExtension) {
    relPath = 'packages/i18n/messages/extension/en.json'
  } else if (isShared) {
    relPath = 'packages/i18n/messages/shared/en.json'
  } else {
    // 2026-07-25 i18n 单一来源:web 翻译迁移到 packages/i18n/messages/web/
    // 此分支现在只在 target==='web'(含不带 --target 的默认)时可达,
    // 未知 target 已在上面的白名单校验处 exit,不会落到这里。
    relPath = 'packages/i18n/messages/web/en.json'
  }
  const targetFile = path.resolve(relPath)

  if (staged) {
    const stagedFiles = getStagedChanges(relPath)
    if (!stagedFiles.includes(relPath)) {
      console.log(`[broken-en] 跳过 (staged 模式: ${relPath} 未改动)`)
      return 0
    }
  }

  if (!fs.existsSync(targetFile)) {
    console.log(`[broken-en] 跳过 (文件不存在: ${targetFile})`)
    return 0
  }

  if (readme) {
    const text = fs.readFileSync(targetFile, 'utf8')
    const results = scanMarkdownForBrokenEn(text)
    if (results.length === 0) {
      console.log(`[broken-en] ✅ ${relPath} 通过 (0 处破碎英文)`)
      return 0
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
    return 1
  }

  // 原 JSON 模式逻辑保持不变
  const raw = fs.readFileSync(targetFile, 'utf8')
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    console.error(`[broken-en] ❌ ${relPath} JSON 解析失败: ${e.message}`)
    return 1
  }

  const results = []
  walk(obj, '', results)

  if (results.length === 0) {
    console.log('[broken-en] ✅ 通过 (0 处破碎英文)')
    return 0
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

  return 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (code !== 0) process.exit(code)
    })
    .catch((e) => {
      console.error(`[broken-en] ❌ 脚本自身异常: ${e && e.stack ? e.stack : e}`)
      process.exit(2)
    })
}

// §22c:导出的是**判据本身**,不是给测试的第二份复制品。镜像测试 import 它,
// 就不再需要在自己文件里重写一份 target 清单 / 检测规则。
export const __test__ = {
  SUPPORTED_TARGETS,
  WHITELIST_TOKENS,
  WHITELIST_SET,
  LANGUAGE_AUTOGLOSSONYMS,
  BRAND_NAME_ZH,
  MARKDOWN_LINE_WHITELIST_EN,
  isWhitelistedToken,
  isBrandNameInParens,
  detectBroken,
  walk,
  scanMarkdownForBrokenEn,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
