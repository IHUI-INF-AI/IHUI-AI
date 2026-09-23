#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
          kind: 'single',
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

/** 取父级族:数组元素去下标后即为族(m.list.[0]→m.list);普通键去末段;无点返回空串(单键不成族) */
export function parentOf(keyPath) {
  const noIdx = keyPath.replace(/(?:\.\[\d+\])+$/, '')
  if (noIdx !== keyPath) return noIdx.includes('.') ? noIdx : ''
  const i = noIdx.lastIndexOf('.')
  if (i <= 0) return ''
  return noIdx.slice(0, i)
}

/**
 * 同族漂移第二判据(H29 残余①,2026-09-23):
 * 同一父级(family)下同一 keyRoot 出现"错译侧 + 正确侧"或"两种不同错译"即报一组。
 * 起源:竞品 multiAgentAction.list.* 同族内 房源 / 挂牌 / 列出未成功 三种译法并存。
 * 宁漏不误报三条:① 错译侧沿用单条豁免(含正确译法的并列用法不计入);
 * ② 单孤立错译不成组(其余同族全中性时 drift 静默,单条闸已覆盖);
 * ③ 必须同父级,跨父级同根不算(防 a.list.x + b.list.y 误伤)。
 */
export function detectFamilyDrift(texts, rules) {
  const drifts = []
  for (const rule of rules) {
    const root = rule.keyRoot.toLowerCase()
    const families = new Map()
    for (const { keyPath, text } of texts) {
      if (!keyPath.toLowerCase().includes(root)) continue
      const family = parentOf(keyPath)
      if (!family) continue
      const hasBad = rule.forbidden.filter((term) => text.includes(term))
      const hasOk = rule.expect.some((ok) => text.includes(ok))
      // 并列用法(同条又错又对)视为中性,不计入任何一侧
      if (hasBad.length > 0 && hasOk) continue
      if (!families.has(family)) {
        families.set(family, { badTerms: new Map(), okKeys: [], badKeys: [] })
      }
      const g = families.get(family)
      if (hasBad.length > 0) {
        g.badKeys.push(keyPath)
        for (const t of hasBad) {
          if (!g.badTerms.has(t)) g.badTerms.set(t, [])
          g.badTerms.get(t).push(keyPath)
        }
      } else if (hasOk) {
        g.okKeys.push(keyPath)
      }
    }
    for (const [family, g] of families) {
      const distinctBad = [...g.badTerms.keys()]
      if (g.badKeys.length === 0) continue
      const hasOkSide = g.okKeys.length > 0
      const hasTwoBad = distinctBad.length >= 2
      if (!hasOkSide && !hasTwoBad) continue
      drifts.push({
        kind: 'family-drift',
        family,
        keyRoot: rule.keyRoot,
        forbiddenTerms: distinctBad,
        witnessKeys: [...g.badKeys, ...g.okKeys].slice(0, 6),
        expect: rule.expect.join(' / '),
        note: rule.note,
      })
    }
  }
  return drifts
}

export function scanFamilyDrifts(namespace, locale, texts, rules) {
  return detectFamilyDrift(texts, rules).map((d) => ({
    kind: 'family-drift',
    namespace,
    locale,
    keyPath: `${d.family}.*`,
    term: d.forbiddenTerms.join('↔'),
    keyRoot: d.keyRoot,
    expect: d.expect,
    note: `${d.note}(同族漂移)`,
    witnessKeys: d.witnessKeys,
  }))
}

export function runScan({ glossary, messagesDir = MESSAGES_DIR } = {}) {
  const violations = []
  let scannedFiles = 0
  let scannedKeys = 0
  let singleCount = 0
  let driftCount = 0
  for (const ns of readdirSync(messagesDir, { withFileTypes: true })) {
    if (!ns.isDirectory()) continue
    for (const locale of glossary.localesChecked) {
      const file = join(messagesDir, ns.name, `${locale}.json`)
      if (!existsSync(file)) continue
      scannedFiles++
      const texts = []
      walk(JSON.parse(readFileSync(file, 'utf8')), [], texts)
      scannedKeys += texts.length
      const singles = scanTexts(ns.name, locale, texts, glossary.rules).map((v) => ({
        ...v,
        relFile: `packages/i18n/messages/${ns.name}/${locale}.json`,
      }))
      const drifts = scanFamilyDrifts(ns.name, locale, texts, glossary.rules).map((v) => ({
        ...v,
        relFile: `packages/i18n/messages/${ns.name}/${locale}.json`,
      }))
      singleCount += singles.length
      driftCount += drifts.length
      violations.push(...singles, ...drifts)
    }
  }
  return { violations, scannedFiles, scannedKeys, singleCount, driftCount }
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
  const driftCases = [
    [
      '漂移真缺陷:同族两种错译(房源↔挂牌)',
      [
        { keyPath: 'm.list.inProgress', text: '房源' },
        { keyPath: 'm.list.completed', text: '挂牌' },
        { keyPath: 'm.list.failed', text: '列出未成功' },
      ],
      1,
    ],
    [
      '漂移真缺陷:同族错译+正确侧并存',
      [
        { keyPath: 'm.list.a', text: '显示房源' },
        { keyPath: 'm.list.b', text: '文件列表' },
      ],
      1,
    ],
    ['全正确同族 → 放过', [
      { keyPath: 'm.list.a', text: '文件列表' },
      { keyPath: 'm.list.b', text: '列表视图' },
    ], 0],
    ['单孤立错译不成组(单条闸已覆盖,drift 静默)', [{ keyPath: 'm.list.a', text: '房源' }], 0],
    ['同条并列用法不计入 drift', [
      { keyPath: 'm.list.a', text: '列表 / 房源视图' },
      { keyPath: 'm.list.b', text: '文件列表' },
    ], 0],
    ['跨父级同根不算漂移', [
      { keyPath: 'a.list.x', text: '房源' },
      { keyPath: 'b.list.y', text: '文件列表' },
    ], 0],
    ['port 同族漂移(港口↔端口)', [
      { keyPath: 'net.port.a', text: '港口占用' },
      { keyPath: 'net.port.b', text: '端口占用' },
    ], 1],
  ]
  let bad = 0
  for (const [label, keyPath, text, expected] of cases) {
    const got = scanTexts('demo', 'zh-CN', [{ keyPath, text }], rules).length
    const ok = got === expected
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${got}(期望 ${expected})`)
  }
  for (const [label, texts, expected] of driftCases) {
    const got = detectFamilyDrift(texts, rules).length
    const ok = got === expected
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} [drift] ${label} → ${got}(期望 ${expected})`)
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
  const { violations, scannedFiles, scannedKeys, singleCount, driftCount } = runScan({
    glossary,
  })
  if (violations.length === 0) {
    console.log(
      `✅ [zh-term-quality] 中文术语无机翻残留(${scannedFiles} 个语言包 / ${scannedKeys} 条文案,${glossary.rules.length} 条词根判据,单条 0 / 漂移 0)`,
    )
    return 0
  }
  console.error(
    `❌ [zh-term-quality] ${violations.length} 处疑似中文机翻残留(单条 ${singleCount} / 同族漂移 ${driftCount}):`,
  )
  for (const v of violations.slice(0, 40)) {
    if (v.kind === 'family-drift') {
      console.error(
        `  ${v.relFile} → ${v.keyPath}:同族漂移「${v.term}」(键根 ${v.keyRoot};应为 ${v.expect})—— ${v.note} 见 ${(v.witnessKeys || []).join(', ')}`,
      )
    } else {
      console.error(
        `  ${v.relFile} → ${v.keyPath}:出现「${v.term}」(键根 ${v.keyRoot};应为 ${v.expect})—— ${v.note}`,
      )
    }
  }
  console.error(
    `\n  💡 两种正当处置:① 确为误译 → 改成正确术语;② 确为业务用词(如真的在做房产列表)→\n     在 scripts/data/zh-term-glossary.json 里为该规则加 expect 词或调整 keyRoot 定义,并在提交说明里写清理由。\n     自检:node scripts/check-zh-term-quality.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
  )
  return 1
}

export const __test__ = { matchRule, scanTexts, runScan, parentOf, detectFamilyDrift, scanFamilyDrifts }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
