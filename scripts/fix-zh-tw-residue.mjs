#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * zh-TW 简体字残留批量修复(2026-08-19 立)
 *
 * 背景:
 *   §2j-shared / §2b 守门用 scan-i18n-zh-residue.mjs 检测 zh-TW.json 简体字残留,
 *   opencc-js 'cn'→'tw' 字形转换后与原文不一致即报警。常见残留:
 *     - 平台 → 平臺
 *     - 台灣 → 臺灣
 *     - 关註/关注 → 關注(单字多义 opencc 选择"註")
 *     - 存储 → 儲存(单独 value 时,但"加密儲存"中"储"已是繁)
 *   之前需要人工逐处 sed,28 处要改 5+ 分钟。本脚本用 opencc-js 自动批转
 *   zh-TW.json 的所有 value 字段。
 *
 * 用法:
 *   node scripts/fix-zh-tw-residue.mjs                          (修复 shared/zh-TW.json)
 *   node scripts/fix-zh-tw-residue.mjs --target=web              (修复 apps/web/messages/zh-TW.json)
 *   node scripts/fix-zh-tw-residue.mjs --target=miniapp-taro     (修复 apps/miniapp-taro/src/i18n/zh-TW.ts)
 *   node scripts/fix-zh-tw-residue.mjs --target=extension        (修复 apps/extension/messages/zh-TW.json)
 *   node scripts/fix-zh-tw-residue.mjs --target=all              (修复所有目标)
 *   node scripts/fix-zh-tw-residue.mjs --dry-run                 (只打印改动,不写文件)
 *
 * 依赖:opencc-js(仓库根 node_modules,pnpm 已就绪)
 *
 * 安全:
 *   - 只转换 JSON value 字段(string),不动 key / 注释 / 结构
 *   - 保留 \n \t \" \\ 等 JSON 转义
 *   - value 包含 /https?:// 时跳过 URL 内容
 *   - --dry-run 不写文件
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import OpenCC from 'opencc-js'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'shared'

const TARGETS = {
  shared: 'packages/i18n/messages/shared/zh-TW.json',
  web: 'apps/web/messages/zh-TW.json',
  'miniapp-taro': 'apps/miniapp-taro/src/i18n/zh-TW.ts',
  extension: 'apps/extension/messages/zh-TW.json',
}

function pickTargets(arg) {
  if (arg === 'all') return Object.values(TARGETS)
  return [TARGETS[arg] || TARGETS.shared]
}

const files = pickTargets(targetArg)

const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

// 匹配 "key": "value", 形式的行(value 不能含未转义 ")
// 允许 value 含 \" (匹配 [^"\\]*(?:\\.[^"\\]*)*)
// 注意:value 中允许换行符 \n(序列),但原始物理换行要保留
const LINE_RE = /^(\s*)("[^"]+"\s*:\s*)"((?:[^"\\]|\\.)*)"([,}\s].*)$/

let totalFiles = 0
let totalChanges = 0

for (const relPath of files) {
  const absPath = join(ROOT, relPath)
  if (!existsSync(absPath)) {
    console.log(`⏭  跳过(不存在): ${relPath}`)
    continue
  }
  const text = readFileSync(absPath, 'utf8')
  const lines = text.split('\n')
  let changedLines = 0
  const newLines = lines.map((line) => {
    const m = line.match(LINE_RE)
    if (!m) return line
    const [, indent, keyPart, rawValue, tail] = m
    // 反转义,得到真正的字符串内容
    let actualValue
    try {
      actualValue = JSON.parse(`"${rawValue}"`)
    } catch {
      return line
    }
    // 跳过 URL 类 / markdown 链接等(尽量减少误伤)
    if (/^https?:\/\//i.test(actualValue)) return line
    // 跳过纯英文/数字
    if (!/[\u4e00-\u9fff]/.test(actualValue)) return line
    const converted = converter(actualValue)
    if (converted === actualValue) return line
    changedLines++
    // 重新转义回 JSON string
    const escaped = JSON.stringify(converted).slice(1, -1)
    return `${indent}${keyPart}"${escaped}"${tail}`
  })
  if (changedLines === 0) {
    console.log(`✅ 无残留: ${relPath}`)
    continue
  }
  totalFiles++
  totalChanges += changedLines
  if (isDryRun) {
    console.log(`🔍 [dry-run] ${relPath}: ${changedLines} 行待改`)
  } else {
    writeFileSync(absPath, newLines.join('\n'), 'utf8')
    console.log(`✅ 已修复 ${relPath}: ${changedLines} 行`)
  }
}

console.log(`\n📊 总计: ${totalFiles} 个文件, ${totalChanges} 行改动${isDryRun ? ' (dry-run)' : ''}`)