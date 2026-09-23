#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通用 i18n 中文残留守门工具。
 * 替代 scan-zh-tw-simp.mjs (zh-TW) 与 scan-ko-zh-residue.mjs (ko) 两个专用脚本，
 * 并可扩展到 ja / vi / th 等任意非中文 locale。
 *
 * 用法:
 *   node scripts/scan-i18n-zh-residue.mjs <locale> [--staged] [--readme] [--target=web|extension]
 *
 * 参数:
 *   <locale>  必填，翻译文件名 (不含 .json)，如 ko / ja / zh-TW / vi
 *   --staged  可选，仅当对应 locale 文件在 git 暂存区时检查 (pre-commit 用)
 *   --readme  可选，扫描根目录 README.<locale>.md 而非 apps/web/messages/<locale>.json
 *   --target  可选，扫描目标 web(默认 apps/web/messages/) | extension(packages/i18n/messages/extension/) | shared(packages/i18n/messages/shared/)
 *             与 --readme 互斥(--readme 优先扫描 README)
 *
 * 检测逻辑 (按 locale 分支):
 *   - zh-TW: 用 opencc-js 简→繁字形转换检测 (字形变化即简体字残留)
 *       纯简体字残留: converted !== value → exit 1
 *   - ko / 其他非中文 locale: 字符范围检测
 *       纯中文残留: value 含汉字 [\u4e00-\u9fff] 且不含该语言本地字符 → exit 1
 *       半翻译:     value 同时含汉字和本地字符 (warn-only) → exit 0
 *       无 localRe 的 locale: 任何含汉字即视为纯中文残留 → exit 1
 *   - ja (warnOnly 模式): 日文汉字词 (登録/確認/削除等) 数量太多，
 *       字符范围启发式不可靠 (假阳性海量)，所有汉字只 warn 不阻塞 → exit 0
 *
 * Markdown 模式 (--readme):
 *   扫描 README.<locale>.md 检测中文残留，跳过:
 *     - ``` 代码块内容
 *     - HTML 注释 <!-- ... -->
 *     - 图片标签 ![alt](src)
 *     - 链接 URL 部分 [text](url) → 仅扫描 text
 *   其余行内任何汉字按 locale 分支同样的策略判断。
 *
 * 退出码:
 *   0 = 通过 (无残留 或 仅 warn-only)
 *   1 = 失败 (有纯中文/简体字残留)
 *   2 = 用法错误 (未指定 locale)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as OpenCC from 'opencc-js'

// locale 配置表：mode 决定检测策略，localRe 为该语言的本地字符范围
// 未列出的非中文 locale 走默认 charRange 模式，localRe 为 null (任何汉字即纯残留)
const LOCALE_CONFIG = {
  'zh-TW': { mode: 'opencc' },
  ko: { mode: 'charRange', localRe: /[\uac00-\ud7af]/ }, // 韩语 Hangul
  // ja: 2026-09-23 起改 **joyo 精确判据**(旧 warnOnly 把"任何汉字"都报,实测 15132 处噪音,等于没判)。
  // 嫌疑 = 字形与繁体不同(中国简化字特征)∧ 不在 2010 版常用汉字表 2136 字内。
  // 表源 `scripts/joyo-kanji.json`(文化庁官方 PDF 主源 + 两源交叉,对称差仅 𠮟/叱 一对)。
  // 之所以必须带表:気/会/図/点/写/台 等日本新字体与中文简化字**同码位**,只看字形会满天假阳。
  ja: { mode: 'joyo' },
}

const HAN_RE = /[\u4e00-\u9fff]/
// 中国法定备案/登记号:跨语言必须保持原文(ICP 备案号 / 公安备案号),不算"未翻译残留"
const LEGAL_REGISTRATION_RE = /(ICP|icp)[备備]\d+号|公網安備\d+号|公安网安备\d+号/
// 逐字枚举用(含 Ext-A 与兼容表意文字;常用汉字表唯一的非 BMP 字种 𠮟 U+20B9F 落在扩展区,
// 不在本字符类内 ⇒ 只会被"跳过"而非误报,方向安全)
const HAN_ALL_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g
const HERE = path.dirname(fileURLToPath(import.meta.url))
/**
 * 匹配 i18n json 行: `  "key": "value",`
 * 取值部分必须允许 **转义双引号** `\"`。旧写法 `[^"]*` 遇到含引号的值(如
 * `確認刪除「{name}」?` 里嵌的 `\"記賬\"`)整行匹配失败 ⇒ 该行**永久漏检**,
 * 而"已清零"的结论看着是全绿的(2026-09-23 实测:门报 10 处,值级 opencc 全扫 11 处)。
 * 放宽后按 decode 再比对,否则会拿 `"台賬\"記賬\""` 这种带反斜杠的原文去过 opencc/白名单。
 */
const LINE_RE = /^(\s+)"([^"]+)":\s+"((?:[^"\\]|\\.)*)"\s*,?\s*$/
/** 把 JSON 字符串字面量的内容解回真实文本;解不动就原样返回(宁可多报也不漏检) */
function decodeJson(raw) {
  try {
    return JSON.parse(`"${raw}"`)
  } catch {
    return raw
  }
}

// 语言原生名称(autoglossonym)白名单 — 语言选择器中显示各语言的本名,
// 即使在非中文 locale 文件中也保留原文字符(如 ko.json 中 "ja": "日本語")。
// 这些值含汉字但非"中文残留",应跳过检测。
// 典型场景:extension 端语言选择器显示 "简体中文/繁體中文/日本語" 等本名。
const LANGUAGE_AUTOGLOSSONYMS = new Set([
  '简体中文',
  '繁體中文',
  '繁体中文',
  '中文',
  '日本語',
  '日本语',
])

// 品牌名白名单(从 scripts/brand-glossary.json 的 brands 段加载)
// 任何含白名单品牌名的 value 视为合法(如 en.json 保留 "智汇 AI" 作 SEO/双语对照)。
// 加载失败时白名单为空,不影响主检测流程。
let BRAND_WHITELIST = new Set()
try {
  const glossaryPath = path.resolve('scripts/brand-glossary.json')
  if (fs.existsSync(glossaryPath)) {
    const glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf8'))
    if (glossary.brands && typeof glossary.brands === 'object') {
      BRAND_WHITELIST = new Set(Object.keys(glossary.brands))
    }
  }
} catch {
  /* 加载失败时白名单为空,不影响主检测流程 */
}

function isWhitelistedBrand(value) {
  if (BRAND_WHITELIST.size === 0) return false
  for (const brand of BRAND_WHITELIST) {
    if (value.includes(brand)) return true
  }
  return false
}

function parseArgs(argv) {
  const positional = []
  let isStaged = false
  let isReadme = false
  let target = 'web'
  for (const arg of argv) {
    if (arg === '--staged') {
      isStaged = true
    } else if (arg === '--readme') {
      isReadme = true
    } else if (arg.startsWith('--target=')) {
      const val = arg.split('=')[1]
      // 未知 target 以前会被静默丢掉 → 变成"扫 web",还打印"web/xx.json 无中文残留",
      // 让人以为已经校验过 mobile-rn / miniapp-taro(2026-09-21 两个会话先后踩到)。
      // 现在:支持全部语言包目录,未知值直接报错退出。
      const ALLOWED = ['web', 'extension', 'shared', 'miniapp-taro', 'mobile-rn', 'cli', 'api']
      if (ALLOWED.includes(val)) target = val
      else {
        console.error(`未知 --target=${val};可选:${ALLOWED.join(' | ')}(不再静默回落到 web)`)
        process.exit(2)
      }
    } else if (arg.startsWith('--')) {
      // 忽略未知 flag，避免误判
    } else {
      positional.push(arg)
    }
  }
  return { locale: positional[0], isStaged, isReadme, target }
}

function isFileStaged(relPath) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
    })
    return staged.split('\n').some((l) => l.trim() === relPath)
  } catch {
    return false
  }
}

// zh-TW: opencc-js 简→繁字形转换检测 (与 scan-zh-tw-simp.mjs 等价)
function scanZhTw(text) {
  // 'cn' → 'tw': 简体→繁体 (台湾字形，不改用词)
  // 不同于 'twp' (会改用词如 智能→智慧)，'tw' 只做字形转换
  const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })
  const lines = text.split('\n')
  const issues = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE)
    if (!m) continue
    const key = m[2]
    const value = decodeJson(m[3])
    if (!value) continue
    if (LANGUAGE_AUTOGLOSSONYMS.has(value)) continue
    if (!HAN_RE.test(value)) continue
    const converted = converter(value)
    if (converted !== value) {
      issues.push({ line: i + 1, key, value, converted })
    }
  }
  return { pure: issues, half: [] }
}

// ko/ja/其他: 字符范围检测 (与 scan-ko-zh-residue.mjs 等价)
function scanCharRange(text, localRe) {
  const lines = text.split('\n')
  const pure = []
  const half = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE)
    if (!m) continue
    const key = m[2]
    const value = decodeJson(m[3])
    if (!value) continue
    if (LANGUAGE_AUTOGLOSSONYMS.has(value)) continue
    if (isWhitelistedBrand(value)) continue
    if (!HAN_RE.test(value)) continue
    if (localRe && localRe.test(value)) {
      // 含汉字且含本地字符 → 半翻译
      half.push({ line: i + 1, key, value })
    } else {
      // 含汉字但不含本地字符 (或该 locale 无 localRe) → 纯中文残留
      pure.push({ line: i + 1, key, value })
    }
  }
  return { pure, half }
}

// ja 等 warnOnly 模式 locale: 任何含汉字都只 warn 不阻塞 (避免假阳性)
function scanWarnOnly(text) {
  const lines = text.split('\n')
  const half = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE)
    if (!m) continue
    const key = m[2]
    const value = decodeJson(m[3])
    if (!value) continue
    if (LANGUAGE_AUTOGLOSSONYMS.has(value)) continue
    if (isWhitelistedBrand(value)) continue
    if (!HAN_RE.test(value)) continue
    half.push({ line: i + 1, key, value })
  }
  return { pure: [], half }
}

// ── ja 精确判据(2026-09-23)──────────────────────────────────────────────
// 常用汉字表(2010 版 2136 字)。缺文件/缺字符时**不猜**:整轮回退到旧 warnOnly 并如实说明。
let _joyo = null
function joyoSet() {
  if (_joyo) return _joyo
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(HERE, 'joyo-kanji.json'), 'utf8'))
    const set = new Set([...raw.chars])
    if (set.size < 2000) return null
    _joyo = { set, converter: OpenCC.Converter({ from: 'cn', to: 'tw' }) }
    return _joyo
  } catch {
    return null
  }
}

/** 一值内的"中国简化字残留"字种集合:字形与繁体不同 ∧ 不在常用汉字表内 */
function joyoSuspects(value, tab) {
  const out = []
  for (const c of new Set(value.match(HAN_ALL_RE) || [])) if (!tab.set.has(c) && tab.converter(c) !== c) out.push(c)
  return out
}

function scanJoyo(text) {
  const tab = joyoSet()
  if (!tab) return { pure: [], half: scanWarnOnly(text).half }
  const lines = text.split('\n')
  const pure = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_RE)
    if (!m) continue
    const value = decodeJson(m[3])
    if (!value || !HAN_RE.test(value)) continue
    if (LANGUAGE_AUTOGLOSSONYMS.has(value) || isWhitelistedBrand(value)) continue
    // 中国法定备案/登记号在**任何语言里都必须保持原文**(ICP 备案号、公安备案号),
    // 与 markdown 侧既有 MARKDOWN_LINE_WHITELIST 同口径;JSON 侧此前没有这道豁免,
    // 导致 `吉ICP备2025027274号-7A`、`粤公網安備44010602000001号` 被判成"日文里残留中文"。
    if (LEGAL_REGISTRATION_RE.test(value)) continue
    const s = joyoSuspects(value, tab)
    if (s.length) pure.push({ line: i + 1, key: m[2], value, suspects: s.join('') })
  }
  return { pure, half: [] }
}

// Markdown 模式: 扫描 README.<locale>.md 检测中文残留
// 跳过: ``` 代码块 / HTML 注释 / 图片标签 / 链接 URL 部分(仅扫描 [text])
// 策略与 JSON 模式一致:
//   - opencc (zh-TW): converter(line) !== line → 简体字残留
//   - charRange (ko 等): 含汉字且不含本地字符 → 纯中文残留; 含本地字符 → warn
//   - warnOnly (ja): 任何含汉字 → warn (日文汉字词启发式不可靠)
// 行级白名单: 中国法定 ICP 备案号(吉ICP备XXXXXXXX号)格式不可翻译,跨语言版均保留中文
const MARKDOWN_LINE_WHITELIST = [
  /ICP[备备]\d+号/, // 中国 ICP 备案号(简体/繁体)
]
function scanMarkdown(text, config) {
  const lines = text.split('\n')
  const pure = []
  const half = []
  let inCodeFence = false
  let converter = null
  if (config.mode === 'opencc') {
    converter = OpenCC.Converter({ from: 'cn', to: 'tw' })
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    // 代码块边界 (``` 或 ~~~)
    if (/^(\s*)(```|~~~)/.test(raw)) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue
    // 跳过 HTML 注释行 (单行或多行注释开始)
    if (/^\s*<!--/.test(raw)) continue
    // 行级白名单 (如 ICP 备案号)
    if (MARKDOWN_LINE_WHITELIST.some((re) => re.test(raw))) continue
    // 提取行内文本: 移除图片 + 链接保留 text + 移除行内代码
    const cleaned = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片整体移除
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留 text
      .replace(/`[^`]*`/g, ' ') // 行内代码移除
    if (!HAN_RE.test(cleaned)) continue
    const trimmed = cleaned.trim()
    if (!trimmed) continue

    if (config.mode === 'opencc') {
      const converted = converter(trimmed)
      if (converted !== trimmed) {
        pure.push({ line: i + 1, key: '(markdown)', value: trimmed.slice(0, 120), converted })
      }
    } else if (config.mode === 'warnOnly') {
      half.push({ line: i + 1, key: '(markdown)', value: trimmed.slice(0, 120) })
    } else if (config.mode === 'joyo') {
      // 与 JSON 侧同一判据;缺表时不报(不得把日文汉字当残留)
      const tab = joyoSet()
      if (tab) {
        const s = joyoSuspects(trimmed, tab)
        if (s.length) pure.push({ line: i + 1, key: '(markdown)', value: trimmed.slice(0, 120), suspects: s.join('') })
      }
    } else {
      // charRange 模式
      if (config.localRe && config.localRe.test(cleaned)) {
        half.push({ line: i + 1, key: '(markdown)', value: trimmed.slice(0, 120) })
      } else {
        pure.push({ line: i + 1, key: '(markdown)', value: trimmed.slice(0, 120) })
      }
    }
  }
  return { pure, half }
}

function main() {
  const { locale, isStaged, isReadme, target } = parseArgs(process.argv.slice(2))

  if (!locale) {
    console.error(
      '用法: node scripts/scan-i18n-zh-residue.mjs <locale> [--staged] [--readme] [--target=web|extension|shared]',
    )
    console.error('  <locale>: ko / ja / zh-TW / vi ...')
    console.error('  --readme: 扫描根目录 README.<locale>.md')
    console.error('  --target: web (默认) | extension | shared')
    process.exit(2)
  }

  // --readme 优先扫描 README.<locale>.md;否则按 target 选择 JSON 路径
  let relPath
  let fileLabel
  if (isReadme) {
    relPath = `README.${locale}.md`
    fileLabel = `README.${locale}.md`
  } else if (target === 'web') {
    // 2026-07-25 i18n 单一来源:web 翻译迁移到 packages/i18n/messages/web/
    relPath = `packages/i18n/messages/web/${locale}.json`
    fileLabel = `web/${locale}.json`
  } else {
    // 其余端(shared / extension / miniapp-taro / mobile-rn / cli / api)同构:
    // packages/i18n/messages/<target>/<locale>.json。以前只有 3 个 target 有分支,
    // 传 miniapp-taro / mobile-rn 会静默落到 web 路径并报"无残留"。
    relPath = `packages/i18n/messages/${target}/${locale}.json`
    fileLabel = `${target}/${locale}.json`
  }
  const file = path.resolve(relPath)

  if (isStaged) {
    if (!isFileStaged(relPath)) {
      console.log(`${fileLabel} 未在暂存区，跳过中文残留扫描`)
      process.exit(0)
    }
  }

  if (!fs.existsSync(file)) {
    console.error(`❌ 文件不存在: ${file}`)
    process.exit(1)
  }

  const config = LOCALE_CONFIG[locale] || { mode: 'charRange', localRe: null }
  const text = fs.readFileSync(file, 'utf8')

  let result
  if (isReadme) {
    result = scanMarkdown(text, config)
  } else if (config.mode === 'opencc') {
    result = scanZhTw(text)
  } else if (config.mode === 'warnOnly') {
    result = scanWarnOnly(text)
  } else if (config.mode === 'joyo') {
    result = scanJoyo(text)
  } else {
    result = scanCharRange(text, config.localRe)
  }

  const { pure, half } = result
  let failed = false

  if (pure.length > 0) {
    const label =
      config.mode === 'opencc'
        ? '简体字残留'
        : config.mode === 'joyo'
          ? '中文简体字残留(判据 = 字形与繁体不同 ∧ 不在常用汉字表 2136 字内)'
          : '纯中文残留'
    console.error(`❌ ${fileLabel} 发现 ${pure.length} 处${label}:`)
    for (const it of pure) {
      console.error(`  L${it.line}: "${it.key}": "${it.value}"`)
      if (it.suspects) console.error(`       嫌疑字: ${it.suspects}`)
      if (it.converted) {
        console.error(`       → "${it.converted}"`)
      }
    }
    failed = true
  }

  if (half.length > 0) {
    const label =
      config.mode === 'warnOnly'
        ? '汉字残留 (warn-only，ja 汉字词启发式不可靠)'
        : '半翻译 (本地字符+汉字混合)'
    console.warn(`⚠️ ${fileLabel} 发现 ${half.length} 处${label}:`)
    // warn-only 模式输出截断(ja README 可能数百处日文汉字词,日志爆炸)
    const WARN_LIMIT = 20
    const showList = half.slice(0, WARN_LIMIT)
    for (const it of showList) {
      console.warn(`  L${it.line}: "${it.key}": "${it.value}"`)
    }
    if (half.length > WARN_LIMIT) {
      console.warn(`  ... 还有 ${half.length - WARN_LIMIT} 处 (截断显示,总数 ${half.length})`)
    }
    console.warn('   (warn-only，可能是有意为之如日文汉字词/品牌名，不阻塞 commit)')
  }

  if (!failed && half.length === 0) {
    console.log(`✅ ${fileLabel} 无中文残留`)
  }

  process.exit(failed ? 1 : 0)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
