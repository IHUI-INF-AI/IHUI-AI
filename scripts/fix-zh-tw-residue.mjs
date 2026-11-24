#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 *   node scripts/fix-zh-tw-residue.mjs --target=web              (修复 packages/i18n/messages/web/zh-TW.json)
 *   node scripts/fix-zh-tw-residue.mjs --target=miniapp-taro     (修复 packages/i18n/messages/miniapp-taro/zh-TW.json)
 *   node scripts/fix-zh-tw-residue.mjs --target=extension        (修复 packages/i18n/messages/extension/zh-TW.json)
 *   node scripts/fix-zh-tw-residue.mjs --target=all              (修复全部七个面)
 *   node scripts/fix-zh-tw-residue.mjs --dry-run                 (只打印改动,不写文件)
 *
 * 2026-10-05 修:三个面指向 2026-07-25 i18n 单一来源迁移**之前**的旧址
 * (apps/web/messages/ · apps/extension/messages/ · apps/miniapp-taro/src/i18n/zh-TW.ts),
 * 全部命中"跳过(不存在)",末行却打"总计: 0 个文件, 0 行改动" —— 与"无残留"同形,
 * 于是这台正牌出口静默失效,残留只能靠人手改。现面清单与路径拼法取自
 * lib/i18n-message-faces.mjs(与扫描器同一份);目标文件不存在一律 **报错退出**,不再跳过。
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
import { I18N_MESSAGE_FACES, faceMessageRelPath, isKnownFace } from './lib/i18n-message-faces.mjs'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'shared'

// 面清单与路径拼法取自 lib/i18n-message-faces.mjs —— 与扫描器同一份,不得在此另写一套。
// 本器只修 zh-TW(简→繁字形),故 locale 恒为 'zh-TW'。
const TARGETS = Object.fromEntries(
  I18N_MESSAGE_FACES.map((f) => [f, faceMessageRelPath(f, 'zh-TW')]),
)

function pickTargets(arg) {
  if (arg === 'all') return Object.values(TARGETS)
  if (!isKnownFace(arg)) {
    console.error(
      `未知 --target=${arg};可选:all | ${I18N_MESSAGE_FACES.join(' | ')}(不再静默回落到 shared)`,
    )
    process.exit(2)
  }
  return [TARGETS[arg]]
}

const files = pickTargets(targetArg)

const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

// 匹配 "key": "value", 形式的行(value 不能含未转义 ")
// 允许 value 含 \" (匹配 [^"\\]*(?:\\.[^"\\]*)*)
// 注意:value 中允许换行符 \n(序列),但原始物理换行要保留
const LINE_RE = /^(\s*)("[^"]+"\s*:\s*)"((?:[^"\\]|\\.)*)"([,}\s].*)$/

let totalFiles = 0
let totalChanges = 0
/** 目标文件缺失清单 —— 非空则整体判"未判定"并退出非零,禁止当成通过。 */
const missingTargets = []

for (const relPath of files) {
  const absPath = join(ROOT, relPath)
  if (!existsSync(absPath)) {
    // 2026-10-05 起:不存在 = **未判定**,不是"无需修"。静默跳过会让末行那句
    // "总计: 0 个文件, 0 行改动"读起来与"无残留"同形,正是本器失效三个月的外衣。
    console.error(`❌ 目标文件不存在(未判定,不得读作"无残留"): ${relPath}`)
    missingTargets.push(relPath)
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
if (missingTargets.length) {
  console.error(
    `❌ 未判定:${missingTargets.length} 个目标文件不存在 —— 本轮读数不构成"无残留"结论,先修路径或补文件:\n` +
      missingTargets.map((p) => `   - ${p}`).join('\n'),
  )
  process.exit(2)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
