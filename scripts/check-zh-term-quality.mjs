#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// 中文 UI 术语机翻残留守门(PROJECT_PLAN.md D104 / H29)
//
// 判据:键名英文词根 ∧ 值内高置信错误译法 **双条件同时命中**才报,单条件一律放过(宁漏不误报)。
// 起源:第 24 轮在竞品自家中文包抓到 list 被译成 挂牌 / 房源(同族 list.failed 却正确),
// 而我方 §19 只有 en 破碎机翻闸,zh 侧无任何术语判据。
//
// 用法:
//   node scripts/check-zh-term-quality.mjs              # 全量扫描(违规 → exit 1)
//   node scripts/check-zh-term-quality.mjs --self-test  # 判定自检(含"必须放过"的反例)

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GLOSSARY = join(ROOT, 'scripts', 'data', 'zh-term-glossary.json')
const MESSAGES_DIR = join(ROOT, 'packages', 'i18n', 'messages')
const SKIP_ENV = 'HUSKY_SKIP_ZH_TERM_GUARD'

function walk(node, path, out) {
  if (typeof node === 'string') {
    out.push({ keyPath: path.join('.'), text: node })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, [...path, `[${i}]`], out))
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, [...path, k], out)
  }
}

/** 双条件判定:返回命中的错误译法,未命中返回空数组 */
export function matchRule(keyPath, text, rule) {
  const root = rule.keyRoot.toLowerCase()
  if (!keyPath.toLowerCase().includes(root)) return []
  const bad = rule.forbidden.filter((term) => text.includes(term))
  if (bad.length === 0) return []
  // 同一条里已出现正确译法 → 视为并列用法,放过(降误报)
  if (rule.expect.some((ok) => text.includes(ok))) return []
  return bad
}

function scanTexts(namespace, locale, texts, rules) {
  const violations = []
  for (const { keyPath, text } of texts) {
    for (const rule of rules) {
      const hits = matchRule(keyPath, text, rule)
      for (const term of hits) {
        violations.push({
          namespace,
          locale,
          keyPath,
          term,
          keyRoot: rule.keyRoot,
          expect: rule.expect.join(' / '),
          note: rule.note,
        })
      }
    }
  }
  return violations
}

export function runScan({ glossary, messagesDir = MESSAGES_DIR } = {}) {
  const violations = []
  let scannedFiles = 0
  let scannedKeys = 0
  for (const ns of readdirSync(messagesDir, { withFileTypes: true })) {
    if (!ns.isDirectory()) continue
    for (const locale of glossary.localesChecked) {
      const file = join(messagesDir, ns.name, `${locale}.json`)
      if (!existsSync(file)) continue
      scannedFiles++
      const texts = []
      walk(JSON.parse(readFileSync(file, 'utf8')), [], texts)
      scannedKeys += texts.length
      violations.push(
        ...scanTexts(ns.name, locale, texts, glossary.rules).map((v) => ({
          ...v,
          relFile: `packages/i18n/messages/${ns.name}/${locale}.json`,
        })),
      )
    }
  }
  return { violations, scannedFiles, scannedKeys }
}

function selfTest() {
  const rules = [
    { keyRoot: 'list', forbidden: ['房源', '挂牌'], expect: ['列表'], note: 't' },
    { keyRoot: 'port', forbidden: ['港口'], expect: ['端口'], note: 't' },
  ]
  const cases = [
    ['双条件命中(词根 + 错译)', 'chat.list房源', '显示房源', 1],
    ['仅错译无词根 → 放过', 'chat.house', '房源充足', 0],
    ['仅词根无错译 → 放过', 'chat.listTitle', '文件列表', 0],
    ['同条含正确译法 → 放过(并列用法)', 'chat.listMode', '列表 / 房源视图', 0],
    ['嵌套大小写不敏感', 'Chat.ListX', '挂牌', 1],
  ]
  let bad = 0
  for (const [label, keyPath, text, expected] of cases) {
    const got = scanTexts('demo', 'zh-CN', [{ keyPath, text }], rules).length
    const ok = got === expected
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${got}(期望 ${expected})`)
  }
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [zh-term-quality] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const glossary = JSON.parse(readFileSync(GLOSSARY, 'utf8'))
  const { violations, scannedFiles, scannedKeys } = runScan({ glossary })
  if (violations.length === 0) {
    console.log(
      `✅ [zh-term-quality] 中文术语无机翻残留(${scannedFiles} 个语言包 / ${scannedKeys} 条文案,${glossary.rules.length} 条词根判据)`,
    )
    return 0
  }
  console.error(`❌ [zh-term-quality] ${violations.length} 处疑似中文机翻残留:`)
  for (const v of violations.slice(0, 40)) {
    console.error(
      `  ${v.relFile} → ${v.keyPath}:出现「${v.term}」(键根 ${v.keyRoot};应为 ${v.expect})—— ${v.note}`,
    )
  }
  console.error(
    `\n  💡 两种正当处置:① 确为误译 → 改成正确术语;② 确为业务用词(如真的在做房产列表)→\n     在 scripts/data/zh-term-glossary.json 里为该规则加 expect 词或调整 keyRoot 定义,并在提交说明里写清理由。\n     自检:node scripts/check-zh-term-quality.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
  )
  return 1
}

export const __test__ = { matchRule, scanTexts, runScan }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
