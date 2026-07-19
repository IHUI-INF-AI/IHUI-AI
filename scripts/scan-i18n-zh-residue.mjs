#!/usr/bin/env node
/**
 * 通用 i18n 中文残留守门工具。
 * 替代 scan-zh-tw-simp.mjs (zh-TW) 与 scan-ko-zh-residue.mjs (ko) 两个专用脚本，
 * 并可扩展到 ja / vi / th 等任意非中文 locale。
 *
 * 用法:
 *   node scripts/scan-i18n-zh-residue.mjs <locale> [--staged]
 *
 * 参数:
 *   <locale>  必填，翻译文件名 (不含 .json)，如 ko / ja / zh-TW / vi
 *   --staged  可选，仅当对应 locale 文件在 git 暂存区时检查 (pre-commit 用)
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
 * 退出码:
 *   0 = 通过 (无残留 或 仅 warn-only)
 *   1 = 失败 (有纯中文/简体字残留)
 *   2 = 用法错误 (未指定 locale)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import * as OpenCC from 'opencc-js'

// locale 配置表：mode 决定检测策略，localRe 为该语言的本地字符范围
// 未列出的非中文 locale 走默认 charRange 模式，localRe 为 null (任何汉字即纯残留)
const LOCALE_CONFIG = {
  'zh-TW': { mode: 'opencc' },
  ko: { mode: 'charRange', localRe: /[\uac00-\ud7af]/ }, // 韩语 Hangul
  // ja: 日文汉字词 (登録/確認/削除等) 太多，charRange 启发式假阳性海量 (4747+ 处)
  // 改为 warnOnly 模式：所有汉字只 warn 不阻塞，避免无效拦截
  ja: { mode: 'warnOnly' },
}

const HAN_RE = /[\u4e00-\u9fff]/
// 匹配 i18n json 行: `  "key": "value",` (value 内不含转义双引号场景，与现有脚本一致)
const LINE_RE = /^(\s+)"([^"]+)":\s+"([^"]*)"\s*,?\s*$/

function parseArgs(argv) {
  const positional = []
  let isStaged = false
  for (const arg of argv) {
    if (arg === '--staged') {
      isStaged = true
    } else if (arg.startsWith('--')) {
      // 忽略未知 flag，避免误判
    } else {
      positional.push(arg)
    }
  }
  return { locale: positional[0], isStaged }
}

function isFileStaged(relPath) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      cwd: process.cwd(),
      encoding: 'utf8',
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
    const value = m[3]
    if (!value) continue
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
    const value = m[3]
    if (!value) continue
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
    const value = m[3]
    if (!value) continue
    if (!HAN_RE.test(value)) continue
    half.push({ line: i + 1, key, value })
  }
  return { pure: [], half }
}

function main() {
  const { locale, isStaged } = parseArgs(process.argv.slice(2))

  if (!locale) {
    console.error('用法: node scripts/scan-i18n-zh-residue.mjs <locale> [--staged]')
    console.error('  <locale>: ko / ja / zh-TW / vi ...')
    process.exit(2)
  }

  const relPath = `apps/web/messages/${locale}.json`
  const file = path.resolve(relPath)

  if (isStaged) {
    if (!isFileStaged(relPath)) {
      console.log(`${locale}.json 未在暂存区，跳过中文残留扫描`)
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
  if (config.mode === 'opencc') {
    result = scanZhTw(text)
  } else if (config.mode === 'warnOnly') {
    result = scanWarnOnly(text)
  } else {
    result = scanCharRange(text, config.localRe)
  }

  const { pure, half } = result
  let failed = false

  if (pure.length > 0) {
    const label = config.mode === 'opencc' ? '简体字残留' : '纯中文残留'
    console.error(`❌ ${locale}.json 发现 ${pure.length} 处${label}:`)
    for (const it of pure) {
      console.error(`  L${it.line}: "${it.key}": "${it.value}"`)
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
    console.warn(`⚠️ ${locale}.json 发现 ${half.length} 处${label}:`)
    for (const it of half) {
      console.warn(`  L${it.line}: "${it.key}": "${it.value}"`)
    }
    console.warn('   (warn-only，可能是有意为之如日文汉字词/品牌名，不阻塞 commit)')
  }

  if (!failed && half.length === 0) {
    console.log(`✅ ${locale}.json 无中文残留`)
  }

  process.exit(failed ? 1 : 0)
}

main()
