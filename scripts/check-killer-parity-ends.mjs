#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 全端杀手锏常量同构守门(GAP-PLAN P3-11)。
//
// 真源:apps/ai-service/app/core/tunables.py;TS 镜像:packages/shared/src/constants.ts;
// Py↔TS 逐值断言:apps/ai-service/tests/test_killer_parity.py(漂移即失败)。
// 本脚本负责另一半:扫描全部 TS 端(web/cli/miniapp/desktop/extension/packages)源码中
// 的"二次写死"(绕过单源 import 直接硬编码杀手锏常量值),白名单显式列出豁免。
//
// 用法:node scripts/check-killer-parity-ends.mjs [--warn-only]
// 退出码:0 = 无违例;1 = 有违例(--warn-only 时仅告警)。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const warnOnly = process.argv.includes('--warn-only')

// 扫描范围:全部 TS 端源码(排除单源/镜像/产物/依赖)
const SCAN_ROOTS = [
  'apps/web/src',
  'apps/cli/src',
  'apps/miniapp-taro/src',
  'apps/desktop/src',
  'apps/extension/src',
  'packages',
].map((p) => path.join(ROOT, p))

const EXCLUDE_DIR_PARTS = [
  'node_modules', 'dist', '.next', 'build', 'out', 'coverage',
  'constants.ts', // packages/shared/src/constants.ts = TS 镜像本体(单源侧)
]
// 单源侧目录:packages/context-compaction 是 TS 侧压缩算法包(真源的 TS 双胞胎,允许)
const SINGLE_SOURCE_PARTS = ['context-compaction']

// 违例模式( killer 常量的典型二次写死形态)与各自豁免白名单:
const RULES = [
  {
    name: 'MCP 协议版本二次写死(须 import DEFAULT_PROTOCOL_VERSION)',
    pattern: /['"]2024-11-05['"]/,
    // 白名单:TS 镜像(SUPPORTED_PROTOCOL_VERSIONS 数组)、cli mcp-runtime(收敛注释提及旧版字符串)
    whitelist: [
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /apps[\\/]cli[\\/]src[\\/]tools[\\/]mcp-runtime\.ts$/, // 收敛历史注释中的字符串
      /\.test\.tsx?$/,
      /tests?\//,
    ],
  },
  {
    name: '压缩触发阈值 0.88 二次写死(须 import DEFAULT_TRIGGER_RATIO)',
    // 只抓赋值/兜底形态;>=、<=、>、< 比较、对象字面量(含 opacity 样式)与注释行不算
    pattern: /(?<![><!=])=\s*0\.88\b(?![.\d])|\?\?\s*0\.88\b/,
    whitelist: [
      /packages[\\/]context-compaction[\\/]/,
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /\.test\.tsx?$/,
      /tests?\//,
      /compaction-v2\.ts$/, // cli 压缩实现(已 import 单源,允许算法内部引用)
    ],
  },
  {
    name: '压缩目标比率 0.6 二次写死(须 import DEFAULT_TARGET_RATIO)',
    pattern: /(?<![><!=])=\s*0\.6\b(?![.\d])|\?\?\s*0\.6\b/,
    whitelist: [
      /packages[\\/]context-compaction[\\/]/,
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /\.test\.tsx?$/,
      /tests?\//,
      /compaction-v2\.ts$/,
    ],
  },
  {
    name: 'keep_recent=6 二次写死(须 import DEFAULT_KEEP_RECENT)',
    pattern: /KEEP_RECENT\s*=\s*6\b|keepRecent\s*[:=]\s*6\b(?![.\d])/,
    whitelist: [
      /packages[\\/]context-compaction[\\/]/,
      /packages[\\/]shared[\\/]src[\\/]constants\.ts$/,
      /\.test\.tsx?$/,
      /tests?\//,
      /compaction-cache\.ts$/, // P3-11 已收敛为 DEFAULT_KEEP_RECENT 引用(本行是赋值形态)
    ],
  },
]

// 显式豁免登记(带理由,新增豁免必须在此留痕):
// 1. apps/cli/src/commands/repl.ts triggerRatioOverride: 0.87 —— 故意覆盖(0.87 < 0.88,
//    否则 ceil(t/0.87)*0.88 恒 > t 永不触发强制压缩;API 端点同此数学),非漂移。
const EXEMPT = [
  {
    file: /apps[\\/]cli[\\/]src[\\/]commands[\\/]repl\.ts$/,
    reason: '强制压缩数学故意覆盖 0.87 < 0.88(见行内注释),非漂移',
  },
]

function* walk(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (EXCLUDE_DIR_PARTS.some((p) => e.name === p || e.name.startsWith('.'))) continue
      if (SINGLE_SOURCE_PARTS.some((p) => full.includes(p))) continue
      yield* walk(full)
    } else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
      yield full
    }
  }
}

const violations = []
let scanned = 0
for (const root of SCAN_ROOTS) {
  if (!fs.existsSync(root)) continue
  for (const file of walk(root)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    scanned++
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = text.split('\n')
    for (const rule of RULES) {
      if (rule.whitelist.some((re) => rule && re.test(rel))) continue
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (rule.pattern.test(line)) {
          // 行级豁免:纯注释行(// 或 * 或 /*)中的提及不算写死
          const trimmed = line.trim()
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
          if (EXEMPT.some((ex) => ex.file.test(rel))) continue
          violations.push(`[${rule.name}] ${rel}:${i + 1}\n    ${trimmed.slice(0, 160)}`)
        }
      }
    }
  }
}

console.log(`[check-killer-parity-ends] 扫描 ${scanned} 个 TS 源文件,违例 ${violations.length} 处`)
if (violations.length > 0) {
  console.error(violations.map((v) => `  ❌ ${v}`).join('\n'))
  console.error(
    '\n修复方式:改 import @ihui/context-compaction(压缩)或 @ihui/shared(MCP 协议)单源常量;' +
      '\n确属故意的本地参数请在此脚本 EXEMPT 登记理由,不得静默扩散硬编码。',
  )
  if (!warnOnly) process.exit(1)
  console.warn('[check-killer-parity-ends] --warn-only:仅告警不阻断')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
