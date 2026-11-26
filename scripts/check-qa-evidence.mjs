#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出判据结论 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * RP-23 / L16 取证与 QA 口径结构审计。
 *
 * 规范正文:docs/benchmark-evidence/QA-EVIDENCE-CONTRACT.md。
 * 六道判据 B1..B6 对证据 JSON 只做结构与措辞判定:
 *   B1 三档定义齐全 / B2 三档结论面齐全 / B3 产品级账本声明齐全
 *   B4 档位措辞不交叉 / B5 状态码与 refusal 不写成模型输出 / B6 phase 与 model_output 分离
 *
 * 账本文件是否存在只报 warning:缺失不等于结论造假,但不能静默。本门不重放请求、
 * 不核验账本内容真伪,不宣称"证据已被证明成立"。
 */

const TIERS = ['product_loop', 'framework_runtime', 'unknown']
export const DEFAULT_REPORT = 'docs/benchmark-evidence/2026-11/report-qa-2026-11-26.json'
const LEDGER_PATH = /^(analysis|docs)\/[^\s]+$/
const NEGATION = /未发现|不得|不是|未证明|被挡|未发|未验证|禁止|不等同/
const STATUS_TOKEN = /(202|401|403|404|refusal|authentication required)/i
const MODEL_CLAIM = /(模型输出|模型闭环|推理结果|模型返回|推理完成)/

export function fixture() {
  return {
    meta: {
      evidence_tier_definition: {
        product_loop: '真实模型输出 + 账本',
        framework_runtime: '进程/端口/状态码',
        unknown: '凭据不足或协议未打通',
      },
    },
    evidence_level_summary: {
      product_loop: [
        {
          target: '样例模型链路',
          evidence: '200 SSE delta.content=391，非回声题复核',
          boundary: '仅限该链路，不等同于工具调用闭环',
          ledgers: ['analysis/sample-2026-11-26.json'],
          ledger_verified: 'sample-2026-11-26.json 内 delta.content=391 已复核',
        },
      ],
      framework_runtime: ['端口 4318 监听且 /healthz 200'],
      unknown: ['无有效凭据，未验证模型层'],
    },
  }
}

function tierItems(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    return Array.isArray(value.entries) ? value.entries : Object.values(value)
  }
  return []
}

function textOf(item) {
  if (typeof item === 'string') return item
  try {
    return JSON.stringify(item ?? '')
  } catch {
    return ''
  }
}

/** 六判据审计;violations 判红,warnings 只提示不阻断。 */
export function checkQaEvidence(doc, options = {}) {
  const violations = []
  const warnings = []
  const root = options.repoRoot ?? process.cwd()
  const meta = doc?.meta ?? {}
  const summary = doc?.evidence_level_summary ?? {}
  const definitions = meta.evidence_tier_definition ?? {}

  for (const tier of TIERS) {
    if (typeof definitions[tier] !== 'string' || !definitions[tier].trim()) {
      violations.push(`B1 三档定义缺 ${tier}`)
    }
    if (!(tier in summary)) violations.push(`B2 三档结论面缺 ${tier}`)
  }

  const product = tierItems(summary.product_loop)
  for (const [index, item] of product.entries()) {
    const label = `product_loop[${index}]`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      violations.push(`${label} 必须是对象条目`)
      continue
    }
    if (!String(item.target ?? '').trim() || !String(item.evidence ?? '').trim()) {
      violations.push(`${label} 缺 target 或 evidence`)
    }
    const ledgers = item.ledgers
    if (!Array.isArray(ledgers) || ledgers.length === 0 || ledgers.some((v) => !LEDGER_PATH.test(String(v)))) {
      violations.push(`B3 ${label} 缺可复核账本路径声明`)
    } else {
      for (const ledger of ledgers) {
        if (!existsSync(resolve(root, String(ledger)))) {
          warnings.push(`${label} 账本文件当前不存在: ${ledger}`)
        }
      }
    }
    if (!String(item.ledger_verified ?? '').trim()) {
      violations.push(`${label} 缺 ledger_verified 复核记录`)
    }
    const body = `${item.evidence ?? ''} ${item.boundary ?? ''}`
    if (/未知|unknown/i.test(body)) violations.push(`B4 ${label} 产品级条目出现未知档措辞`)
    // 否定短语按字段判,不能让 boundary 的"不等同/未证明"替 evidence 的肯定断言洗白。
    for (const field of [item.evidence, item.boundary]) {
      const text = String(field ?? '')
      if (STATUS_TOKEN.test(text) && MODEL_CLAIM.test(text) && !NEGATION.test(text)) {
        violations.push(`B5 ${label} 把状态码/refusal 写成模型输出`)
        break
      }
    }
    if (
      item.phase_snapshot !== undefined &&
      item.model_output !== undefined &&
      JSON.stringify(item.phase_snapshot) === JSON.stringify(item.model_output)
    ) {
      violations.push(`B6 ${label} phase 快照与模型输出未分离`)
    }
  }

  for (const [index, item] of tierItems(summary.unknown).entries()) {
    const text = textOf(item)
    if (/闭环|已验证|模型输出/.test(text) && !/未闭环|不闭环|非闭环|未验证|不得/.test(text)) {
      violations.push(`unknown[${index}] 出现闭环/已验证措辞`)
    }
  }

  return { pass: violations.length === 0, violations, warnings }
}

function mutate(base, kind) {
  const doc = structuredClone(base)
  switch (kind) {
    case 'b1':
      delete doc.meta.evidence_tier_definition.unknown
      break
    case 'b2':
      delete doc.evidence_level_summary.framework_runtime
      break
    case 'b3':
      doc.evidence_level_summary.product_loop[0].ledgers = []
      break
    case 'b4':
      doc.evidence_level_summary.product_loop[0].boundary = '仍属未知'
      break
    case 'b5':
      doc.evidence_level_summary.product_loop[0].evidence = '401 即模型闭环输出'
      break
    case 'b6':
      doc.evidence_level_summary.product_loop[0].phase_snapshot = { value: '同一段' }
      doc.evidence_level_summary.product_loop[0].model_output = { value: '同一段' }
      break
    default:
      throw new Error(`未知变异: ${kind}`)
  }
  return doc
}

/** 逐条变异咬合:原始夹具必须绿,每个变异必须被对应判据判红。 */
export function selfTest() {
  const base = fixture()
  const clean = checkQaEvidence(base)
  if (!clean.pass) throw new Error(`原始夹具未通过: ${clean.violations.join('; ')}`)
  const kinds = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6']
  let bitten = 0
  for (const kind of kinds) {
    const result = checkQaEvidence(mutate(base, kind))
    if (result.pass || !result.violations.some((v) => v.startsWith(kind.toUpperCase()))) {
      throw new Error(`变异 ${kind} 未被咬合: ${JSON.stringify(result.violations)}`)
    }
    bitten += 1
  }
  console.log(`self-test ${bitten}/${kinds.length} 变异咬合通过`)
  return bitten
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    selfTest()
    return 0
  }
  const reportIndex = args.indexOf('--report')
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : DEFAULT_REPORT
  const doc = JSON.parse(readFileSync(resolve(process.cwd(), reportPath), 'utf8'))
  const result = checkQaEvidence(doc, { repoRoot: process.cwd() })
  for (const warning of result.warnings) console.log(`⚠ ${warning}`)
  if (!result.pass) {
    for (const violation of result.violations) console.error(`❌ ${violation}`)
    return 1
  }
  console.log(`✅ ${reportPath}: 三档标注、账本声明、状态码边界与 phase 分离审计通过`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
