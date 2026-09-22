#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui/i18n ICU 语法跨端可用性闸门(AGENTS.md §19 / PROJECT_PLAN.md D101 第⑤项)
//
// 为什么需要:next-intl 只挂在 apps/web,其余端走 @ihui/i18n 的 ICU 子集解释器,
// cli 端仍是自写 {name}/{{name}} 替换。语言包里出现某端不支持的 ICU 形态时,
// 界面会直接显示 `{state, select, …}` 语法残迹,或与 web 静默渲染成不同文本 ——
// 这类错误只有真机上看得到,故按"命名空间 × 语法形态"在提交前拦住。
//
// 用法:
//   node scripts/check-icu-locale-support.mjs             # 全量扫描(violation → exit 1)
//   node scripts/check-icu-locale-support.mjs --self-test # 跑内置判定自检

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_DIR = join(ROOT, 'packages', 'i18n', 'messages')

/** 共享子集解释器(icu.ts)支持的四形;web=next-intl 全量 ICU,天然四形皆可 */
const SUPPORTED_TYPES = new Set(['plural', 'select', 'selectordinal', 'number'])
/** 仍自带插值器、渲染不了 ICU 的端。cli 已于 D101 第④步收编为共享 formatIcu 故清空;
 *  新端若自带插值器,把命名空间登记在此即可复用同一判据。 */
const NO_ICU_NAMESPACES = new Set()
const WEB_NAMESPACE = 'web'
const ARG_RE = /\{\s*([\w$]+)\s*,\s*([\w$-]+)/gu

/** 抽出一段文案里的所有 ICU 参数位:类型 + 可选 style(含 `::` skeleton) */
export function scanIcu(text) {
  const found = []
  ARG_RE.lastIndex = 0
  let match
  while ((match = ARG_RE.exec(text)) !== null) {
    const tail = text.slice(match.index + match[0].length)
    const styleMatch = tail.match(/^\s*,\s*([^{}]+)/u)
    found.push({
      type: match[2],
      style: styleMatch ? styleMatch[1].trim() : '',
      unknownType: !SUPPORTED_TYPES.has(match[2]),
    })
  }
  return found
}

function walkValues(node, path, out) {
  if (typeof node === 'string') {
    out.push({ keyPath: path.join('.'), text: node })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item, idx) => walkValues(item, [...path, `[${idx}]`], out))
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      walkValues(value, [...path, key], out)
    }
  }
}

function listMessageFiles(dir) {
  if (!existsSync(dir)) return []
  const files = []
  for (const ns of readdirSync(dir, { withFileTypes: true })) {
    if (!ns.isDirectory()) continue
    for (const locale of readdirSync(join(dir, ns.name))) {
      if (locale.endsWith('.json')) files.push({ namespace: ns.name, file: join(dir, ns.name, locale) })
    }
  }
  return files
}

/** 返回违规清单;每项 {namespace, relFile, keyPath, reason} */
export function evaluateTexts(namespace, relFile, texts) {
  const violations = []
  // web 走 next-intl 全量 ICU,只有"该端不支持"这一维对它不适用;其余端受子集解释器约束
  const subsetBound = namespace !== WEB_NAMESPACE
  for (const { keyPath, text } of texts) {
    for (const icu of scanIcu(text)) {
      if (NO_ICU_NAMESPACES.has(namespace)) {
        violations.push({
          namespace,
          relFile,
          keyPath,
          reason: `该端取词实现不支持 ICU(${icu.type}),界面会显示语法残迹 —— 见 D101 第④项(先收编为共享 loader)再加此类键`,
        })
        continue
      }
      if (!subsetBound) continue
      if (icu.unknownType) {
        violations.push({
          namespace,
          relFile,
          keyPath,
          reason: `未知 ICU 类型「${icu.type}」:非 web 端降级为原文、web 端(next-intl)直接抛错,属两端不一致`,
        })
        continue
      }
      if (icu.style.startsWith('::')) {
        violations.push({
          namespace,
          relFile,
          keyPath,
          reason: `ICU skeleton「${icu.style}」共享子集解释器不支持(退化为默认分组),与 web 静默不一致 —— 用四种 plain style 或改分键`,
        })
      }
    }
  }
  return violations
}

export function runScan(messagesDir = MESSAGES_DIR) {
  const all = []
  let icuKeyCount = 0
  for (const { namespace, file } of listMessageFiles(messagesDir)) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      all.push({
        namespace,
        relFile: file.slice(ROOT.length + 1).replace(/\\/gu, '/'),
        keyPath: '(file)',
        reason: `JSON 解析失败:${err instanceof Error ? err.message : String(err)}`,
      })
      continue
    }
    const relFile = file.slice(ROOT.length + 1).replace(/\\/gu, '/')
    const texts = []
    walkValues(parsed, [], texts)
    const violations = evaluateTexts(namespace, relFile, texts)
    icuKeyCount += texts.filter((t) => scanIcu(t.text).length > 0).length
    all.push(...violations)
  }
  return { violations: all, icuKeyCount }
}

function selfTest() {
  const cases = [
    ['cli', 'zh-CN', '{a, select, x {1} other {2}}', 0],
    ['miniapp-taro', 'zh-CN', '{a, select, x {1} other {2}}', 0],
    ['shared', 'en', '{n, plural, one {# file} other {# files}}', 0],
    ['extension', 'zh-CN', '{x, number, ::percent}', 1],
    ['mobile-rn', 'ja', '{x, foo, a{b}}', 1],
    ['web', 'zh-CN', '{x, number, ::percent}', 0],
    ['cli', 'en', '普通 {name} 插值', 0],
  ]
  let bad = 0
  for (const [ns, locale, text, expected] of cases) {
    const got = evaluateTexts(ns, `${ns}/${locale}.json`, [{ keyPath: 'k', text }]).length
    const ok = got === expected
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${ns} :: ${text} → ${got}(期望 ${expected})`)
  }
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const { violations, icuKeyCount } = runScan()
  if (violations.length === 0) {
    console.log(`✅ [icu-locale-support] 语言包 ICU 语法与两端能力一致(含 ICU 键 ${icuKeyCount} 个)`)
    return 0
  }
  console.error(`❌ [icu-locale-support] ${violations.length} 处 ICU 语法在该端不支持:`)
  for (const v of violations.slice(0, 40)) {
    console.error(`  ${v.relFile} → ${v.keyPath}:${v.reason}`)
  }
  if (violations.length > 40) console.error(`  …另有 ${violations.length - 40} 处`)
  return 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
