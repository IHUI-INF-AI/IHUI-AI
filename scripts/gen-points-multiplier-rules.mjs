// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 积分倍数规则派生器(2026-11-23 立)。
 *
 * 单一真相源 = `packages/shared/src/constants/points-multiplier-rules.json`。
 * 本脚本把它派生成两端的**纯数据模块**(各端只 import 生成物,不解析 JSON):
 *   - `packages/shared/src/constants/points-multiplier-rules-data.ts`(TS:api/web 直接消费)
 *   - `apps/ai-service/app/services/points_multiplier_rules.py`(Python:ai-service 消费)
 *
 * 为什么不用 TS 直接 import JSON:shared 编译成 ESM 后由 node 运行时加载,
 * `import data from './x.json'` 会抛 `ERR_IMPORT_ATTRIBUTE_MISSING`,线上首次请求即崩。
 * 派生 + `--check` 与 design-tokens 派生同一条纪律:只认源头,手改生成物即红。
 *
 * 用法:
 *   node scripts/gen-points-multiplier-rules.mjs           # 写盘
 *   node scripts/gen-points-multiplier-rules.mjs --check   # 只比对,不一致 exit 1
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import prettier from 'prettier'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SOURCE = resolve(ROOT, 'packages/shared/src/constants/points-multiplier-rules.json')
const TS_TARGET = resolve(ROOT, 'packages/shared/src/constants/points-multiplier-rules-data.ts')
const PY_TARGET = resolve(ROOT, 'apps/ai-service/app/services/points_multiplier_rules.py')

const BANNER_TS = `// GENERATED FILE — DO NOT EDIT.
// 来源: packages/shared/src/constants/points-multiplier-rules.json
// 重新生成: node scripts/gen-points-multiplier-rules.mjs(改动请改 JSON)
`

const BANNER_PY = `"""GENERATED FILE — DO NOT EDIT.

来源: packages/shared/src/constants/points-multiplier-rules.json
重新生成: node scripts/gen-points-multiplier-rules.mjs(改动请改 JSON)

积分消耗倍数关键词推断的规则数据(与 TS 侧同一份 JSON 派生,跨语言一致性由
scripts/tests/points-multiplier-parity.test.mjs 与 ai-service pytest 双重钉住)。
"""
`

function loadRules() {
  const raw = JSON.parse(readFileSync(SOURCE, 'utf8'))
  const tiers = raw.tiers
  for (const key of ['free', 'economy', 'standard', 'premium', 'flagship', 'fallback']) {
    if (typeof tiers?.[key] !== 'number') throw new Error(`tiers.${key} 缺失或非数字`)
  }
  if (!Array.isArray(raw.orderedRules) || raw.orderedRules.length === 0) {
    throw new Error('orderedRules 缺失或为空')
  }
  for (const layer of raw.orderedRules) {
    if (!['free', 'economy', 'standard', 'premium', 'flagship'].includes(layer.tier)) {
      throw new Error(`未知档位: ${layer.tier}`)
    }
    const hasAny = Array.isArray(layer.containsAny) && layer.containsAny.length > 0
    const hasAll = Array.isArray(layer.containsAll) && layer.containsAll.length > 0
    if (!hasAny && !hasAll) throw new Error(`规则层无匹配条件: ${JSON.stringify(layer)}`)
  }
  if (!raw.ihuiModelMap || typeof raw.ihuiModelMap !== 'object') {
    throw new Error('ihuiModelMap 缺失')
  }
  return raw
}

function renderTs(raw) {
  const body = JSON.stringify(raw.tiers, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join('\n')
  const rules = raw.orderedRules
    .map((layer) => {
      const parts = [`    tier: ${JSON.stringify(layer.tier)},`]
      if (layer.containsAny) {
        parts.push(
          `    containsAny: [${layer.containsAny.map((k) => JSON.stringify(k)).join(', ')}],`,
        )
      }
      if (layer.containsAll) {
        parts.push(
          `    containsAll: [${layer.containsAll.map((k) => JSON.stringify(k)).join(', ')}],`,
        )
      }
      if (Array.isArray(layer.keywordExclusions) && layer.keywordExclusions.length > 0) {
        const exclusions = layer.keywordExclusions
          .map(
            (item) =>
              `{ keyword: ${JSON.stringify(item.keyword)}, unlessContainsAnyOf: [${item.unlessContainsAnyOf
                .map((k) => JSON.stringify(k))
                .join(', ')}] }`,
          )
          .join(', ')
        parts.push(`    keywordExclusions: [${exclusions}],`)
      }
      if (layer.why) parts.push(`    why: ${JSON.stringify(layer.why)},`)
      return `  {\n${parts.join('\n')}\n  },`
    })
    .join('\n')
  const map = Object.entries(raw.ihuiModelMap)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${value},`)
    .join('\n')
  return `${BANNER_TS}
export const POINTS_MULTIPLIER_RULES_DATA = {
  version: ${raw.version},
  tiers: ${body},
  ihuiModelMap: {
${map}
  },
  orderedRules: [
${rules}
  ],
} as const
`
}

function pyTuple(items) {
  if (items.length === 0) return '()'
  return `(${items.map((item) => JSON.stringify(item)).join(', ')},)`
}

function renderPy(raw) {
  const tierLines = Object.entries(raw.tiers)
    .map(([key, value]) => `    ${JSON.stringify(key)}: ${Number(value).toFixed(1)},`)
    .join('\n')
  const mapLines = Object.entries(raw.ihuiModelMap)
    .map(([key, value]) => `    ${JSON.stringify(key)}: ${Number(value).toFixed(1)},`)
    .join('\n')
  const ruleLines = raw.orderedRules
    .map((layer) => {
      const exclusions = Array.isArray(layer.keywordExclusions) ? layer.keywordExclusions : []
      const exclusionLiteral = exclusions.length
        ? `(${exclusions
            .map(
              (item) => `(${JSON.stringify(item.keyword)}, ${pyTuple(item.unlessContainsAnyOf)})`,
            )
            .join(', ')},)`
        : '()'
      return `    RuleLayer(
        tier=${JSON.stringify(layer.tier)},
        contains_any=${pyTuple(layer.containsAny ?? [])},
        contains_all=${pyTuple(layer.containsAll ?? [])},
        exclusions=${exclusionLiteral},
    ),`
    })
    .join('\n')
  return `${BANNER_PY}
from __future__ import annotations

from typing import NamedTuple


class RuleLayer(NamedTuple):
    """一条关键词规则层:命中即返回该档(元组顺序 = 判定优先级)。"""

    tier: str
    contains_any: tuple[str, ...]
    contains_all: tuple[str, ...]
    exclusions: tuple[tuple[str, tuple[str, ...]], ...]


TIERS: dict[str, float] = {
${tierLines}
}

IHUI_MODEL_MAP: dict[str, float] = {
${mapLines}
}

# 顺序敏感:免费 → 经济(轻量后缀优先) → 旗舰 → 高级(gemini pro) → 高级 → 标准。
ORDERED_RULES: tuple[RuleLayer, ...] = (
${ruleLines}
)
`
}

/** 生成物必须同时是 prettier 产物,否则 `--check` 会与 `prettier --check` 互相打架。 */
async function formatTs(text, filepath) {
  const config = await prettier.resolveConfig(filepath)
  return prettier.format(text, { ...config, filepath, parser: 'typescript' })
}

async function main() {
  const check = process.argv.includes('--check')
  const raw = loadRules()
  const outputs = [
    { path: TS_TARGET, content: await formatTs(renderTs(raw), TS_TARGET) },
    { path: PY_TARGET, content: renderPy(raw) },
  ]
  let drift = 0
  for (const out of outputs) {
    const rel = out.path.slice(ROOT.length + 1)
    let current = ''
    try {
      current = readFileSync(out.path, 'utf8')
    } catch {
      current = ''
    }
    if (current === out.content) {
      console.log(`[points-multiplier-rules] ${rel} → up-to-date`)
      continue
    }
    if (check) {
      console.error(`[points-multiplier-rules] ${rel} → DRIFT(与 JSON 源不一致)`)
      drift += 1
      continue
    }
    mkdirSync(dirname(out.path), { recursive: true })
    writeFileSync(out.path, out.content, 'utf8')
    console.log(`[points-multiplier-rules] ${rel} → written`)
  }
  if (drift > 0) process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((error) => {
    console.error('[points-multiplier-rules] 派生失败:', error)
    process.exit(1)
  })
}

export const __test__ = { loadRules, renderTs, renderPy }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
