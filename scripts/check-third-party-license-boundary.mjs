#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-third-party-license-boundary.mjs —— Apache-2.0 商业仓的许可证边界机器守门
 *
 * 目的:阻止 AGPL / CC-BY-NC / 无授权代码被粘进本仓。台账(provenance-ledger)回答
 * "这份外部内容是谁、什么许可、登记在哪",本门回答"当前树里有没有越过许可证边界的入件"。
 *
 * 三条规则:
 *   R1 第三方目录 / SPDX 头双候选:
 *      - 路径位于名为 vendor / third_party / third-party 的目录下;或
 *      - 文件正文携带 `SPDX-License-Identifier:` 头。
 *      候选必须同时满足:① 许可证在允许集 {Apache-2.0, MIT, BSD-2-Clause, BSD-3-Clause, ISC};
 *      ② 路径能在 config/third-party-provenance/*.json 的 roots 中找到登记。任一不满足判红。
 *      许可证取值:文件自带 SPDX 头优先;无文件头时回退到台账条目的 license.spdx;两者都取不到判红。
 *   R2 被拒项目标识只认代码形态:
 *      源码(.ts/.tsx/.js/.mjs/.py/.ps1)出现被拒项目标识
 *      (wcferry、WeChatFerry、pywechat、pyweixin、wx4py、WeChatPadGo、weflow、AstrBot、chatlab)
 *      且呈现导入 / require / 动态 import / Python import / 直接调用 / 成员访问形态才判红;
 *      注释、文档文案、UI 描述里的同名提及不算入件。白名单仅 docs/licensing/** 与本脚本及测试自身。
 *   R3 传染 / 非商业许可原文:
 *      非 docs/licensing 面出现 GNU AFFERO / AGPL-SPDX / CC BY-NC 许可原文判红。
 *
 * 取材口径:默认判 HEAD 跟踪清单(git ls-tree,与 provenance-ledger 同面);--root 指向非 git
 * 目录时走磁盘递归。排除 node_modules、dist、.turbo、.git(并沿用共享排除清单的其余构建/缓存产物)。
 * 二进制文件(含 NUL 字节)不参与文本判定。
 *
 * CLI:
 *   node scripts/check-third-party-license-boundary.mjs [--check] [--root <dir>]
 *   node scripts/check-third-party-license-boundary.mjs --self-test
 *   node scripts/check-third-party-license-boundary.mjs --help
 * 退出码:0 通过 / 1 违规 / 2 无法判定 / 129 用法错(未知开关不得静默掉进默认档)。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

import { listFaceFiles, Undetermined } from './lib/face-reader.mjs'
import { EXCLUDE_DIRS } from './lib/exclude-dirs.mjs'
import { requireFlagValue } from './lib/flag-value.mjs'

const SELF = fileURLToPath(import.meta.url)
const DEFAULT_ROOT = resolve(dirname(SELF), '..')

/** 台账目录与四本账(与 provenance-ledger / third-party-roots 同口径,只读 roots 与 spdx)。 */
const LEDGER_DIR = 'config/third-party-provenance'
const LEDGER_FILES = ['embedded.json', 'copied.json', 'overrides.json', 'mechanisms.json']

/** R1 允许集:宽松商业许可,可进 Apache-2.0 商业仓。 */
const ALLOWED_SPDX = ['Apache-2.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']

/** R2 被拒项目标识(选型审计中已判不兼容或无授权的项目)。 */
const REJECTED_IDENTIFIERS = [
  'wcferry',
  'WeChatFerry',
  'pywechat',
  'pyweixin',
  'wx4py',
  'WeChatPadGo',
  'weflow',
  'AstrBot',
  'chatlab',
]

/** R2 射程内的源码扩展名。 */
const SOURCE_EXTS = ['.ts', '.tsx', '.js', '.mjs', '.py', '.ps1']

/** R1 第三方目录名形态(任务口径:vendor / third_party / third-party,大小写不敏感)。 */
const VENDOR_DIR_NAMES = new Set(['vendor', 'third_party', 'third-party'])

/** 扫描排除目录:任务硬指定四项 + 共享清单其余依赖/构建/缓存/虚拟环境产物。 */
const EXCLUDED_DIR_NAMES = new Set([...EXCLUDE_DIRS, 'node_modules', 'dist', '.turbo', '.git'])

/**
 * 精确白名单(逐条登记,不整条关闭规则)。
 * - prefix:命中前缀即放行;exact:路径全等才放行。
 * - note:写明放行理由,后人复盘时能知道这条豁免不是漏判。
 */
const WHITELIST = [
  {
    rel: 'docs/licensing/',
    kind: 'prefix',
    rules: ['R2', 'R3'],
    note: '许可选型审计文档:被拒项目的事实只作参照记录,不进代码面(R2/R3)',
  },
  {
    rel: 'scripts/check-third-party-license-boundary.mjs',
    kind: 'exact',
    rules: ['R1', 'R2'],
    note: '本守门脚本自身:--self-test 夹具字符串携带 SPDX 头与被拒项目名,不是入件(R1/R2)',
  },
  {
    rel: 'scripts/tests/check-third-party-license-boundary.test.mjs',
    kind: 'exact',
    rules: ['R1', 'R2'],
    note: '本守门测试自身:夹具字符串携带 SPDX 头与被拒项目名(R1/R2)',
  },
  {
    rel: 'scripts/provenance-ledger.mjs',
    kind: 'exact',
    rules: ['R1'],
    note: '既有台账守门:--self-test 夹具字符串携带 SPDX 头,非第三方入件(仅 R1 放行,R2/R3 不豁免)',
  },
  {
    rel: 'scripts/tests/provenance-ledger.test.mjs',
    kind: 'exact',
    rules: ['R1'],
    note: '既有台账守门测试:夹具字符串携带 SPDX 头(仅 R1 放行,R2/R3 不豁免)',
  },
]

function normalize(rel) {
  return String(rel).replaceAll('\\', '/')
}

/** 路径在指定规则下是否命中精确白名单(prefix 前缀 / exact 全等;按规则分别豁免)。 */
function inWhitelist(rel, rule) {
  const n = normalize(rel)
  return WHITELIST.some(
    (w) =>
      (!rule || w.rules.includes(rule)) &&
      (w.kind === 'prefix' ? n === w.rel || n.startsWith(w.rel) : n === w.rel),
  )
}

/** 读台账四本账,收集 roots 与其登记的 SPDX 许可证。 */
function loadLedger(root) {
  const declared = []
  for (const file of LEDGER_FILES) {
    const abs = join(root, LEDGER_DIR, file)
    if (!existsSync(abs)) continue
    let doc
    try {
      doc = JSON.parse(readFileSync(abs, 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(doc.entries)) continue
    for (const entry of doc.entries) {
      const spdx = entry?.license?.spdx ?? null
      const id = entry?.id ?? '(无 id)'
      for (const r of entry.roots ?? []) {
        if (typeof r === 'string' && r) declared.push({ root: normalize(r), spdx, id, source: file })
      }
    }
  }
  return declared
}

/** rel 是否被某条台账 root 覆盖(前缀语义:目录 root 吞其子树)。 */
function coveredByLedger(rel, ledger) {
  return ledger.find((l) => rel === l.root || rel.startsWith(`${l.root}/`)) ?? null
}

/** 从正文抽取全部 SPDX 标识符(支持双许可行、OR/AND 表达式)。 */
function parseSpdxTokens(text) {
  const tokens = new Set()
  for (const m of text.matchAll(/SPDX-License-Identifier:\s*([^\n\r\\'"]+)/gi)) {
    for (const part of m[1].split(/[\s()]+/)) {
      const t = part.replace(/^(?:AND|OR|WITH)\s*/i, '').trim()
      if (/^[A-Za-z0-9.\-+]+$/.test(t)) tokens.add(t)
    }
  }
  return [...tokens]
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * R2 判据:标识是否呈导入 / 依赖 / 调用形态。
 * 只认代码结构,不认注释或散文里的同名提及;标识两侧用词边界钉住,避免 ChatLabel 这类
 * 含 "chatlab" 子串的自造词被误命中。
 */
function rejectedMatch(ident, text) {
  const id = escapeRe(ident)
  const patterns = [
    // ESM:import ... from '<含标识的说明符>'
    new RegExp(`\\bimport\\b[\\s\\S]{0,80}?\\bfrom\\s*['"][^'"]*\\b${id}\\b`, 'i'),
    // CommonJS:require('<含标识的说明符>')
    new RegExp(`\\brequire\\s*\\(\\s*['"][^'"]*\\b${id}\\b`, 'i'),
    // 动态 import('<含标识的说明符>')
    new RegExp(`\\bimport\\s*\\(\\s*['"][^'"]*\\b${id}\\b`, 'i'),
    // Python:from <pkg> import ...
    new RegExp(`^\\s*from\\s+\\b${id}\\b\\s+import\\b`, 'mi'),
    // Python:import <pkg>[, ...]
    new RegExp(`^\\s*import\\s+\\b${id}\\b(?:\\s|,|$)`, 'mi'),
    // 直接调用:<ident>(...)
    new RegExp(`\\b${id}\\s*\\(`, 'i'),
    // 成员访问:<ident>.<member>
    new RegExp(`\\b${id}\\s*\\.\\s*[A-Za-z_]`, 'i'),
  ]
  return patterns.some((p) => p.test(text))
}

/** R1 判据:第三方目录 / SPDX 头候选,许可证必须在允许集且已在台账登记。 */
function checkR1(rel, text, ledger) {
  if (inWhitelist(rel, 'R1')) return null
  const parts = rel.split('/')
  const dirParts = parts.slice(0, -1)
  const vendorDir = dirParts.find((d) => VENDOR_DIR_NAMES.has(d.toLowerCase()))
  const fileTokens = parseSpdxTokens(text)
  if (!vendorDir && fileTokens.length === 0) return null

  const entry = coveredByLedger(rel, ledger)
  if (!entry) {
    return {
      rule: 'R1',
      rel,
      reason: vendorDir
        ? `位于未登记的第三方目录 "${vendorDir}/",台账 ${LEDGER_DIR}/*.json 无对应 roots 登记`
        : '文件携带 SPDX-License-Identifier 头,但未在台账登记来源与许可',
    }
  }

  const ledgerTokens = entry.spdx ? parseSpdxTokens(`SPDX-License-Identifier: ${entry.spdx}`) : []
  const tokens = fileTokens.length ? fileTokens : ledgerTokens
  if (tokens.length === 0) {
    return {
      rule: 'R1',
      rel,
      reason: `登记条目 ${entry.id} 与文件均未给出可解析的 SPDX 许可证,无法判定兼容性`,
    }
  }
  const bad = tokens.filter((t) => !ALLOWED_SPDX.includes(t))
  if (bad.length) {
    return {
      rule: 'R1',
      rel,
      reason: `许可证 ${bad.join('、')} 不在允许集 ${ALLOWED_SPDX.join('/')}(登记条目 ${entry.id})`,
    }
  }
  return null
}

/** R2 判据:源码面被拒项目标识的导入 / 依赖 / 调用形态。 */
function checkR2(rel, text) {
  if (!SOURCE_EXTS.includes(extname(rel).toLowerCase())) return null
  if (inWhitelist(rel, 'R2')) return null
  for (const ident of REJECTED_IDENTIFIERS) {
    if (rejectedMatch(ident, text)) {
      return { rule: 'R2', rel, reason: `源码中出现被拒项目「${ident}」的导入 / 依赖 / 调用形态` }
    }
  }
  return null
}

/** R3 判据:非 docs/licensing 面的传染 / 非商业许可原文。 */
const R3_MARKERS = [
  { re: /GNU AFFERO GENERAL PUBLIC LICENSE/i, why: 'GNU AGPL 许可原文' },
  { re: /SPDX-License-Identifier:\s*AGPL/i, why: 'SPDX 声明为 AGPL 许可证' },
  { re: /CC\s?BY-NC(?:-SA)?/i, why: 'CC BY-NC(NC 非商业)许可文本' },
  { re: /Creative Commons Attribution-NonCommercial/i, why: 'Creative Commons 非商业许可文本' },
]

function checkR3(rel, text) {
  if (inWhitelist(rel, 'R3')) return null
  const hit = R3_MARKERS.find((m) => m.re.test(text))
  if (!hit) return null
  return { rule: 'R3', rel, reason: `非 docs/licensing 面出现${hit.why},与 Apache-2.0 商业仓不兼容` }
}

/** 磁盘递归枚举(非 git 根 / 自测夹具用);排除清单见 EXCLUDED_DIR_NAMES。 */
function listDiskFiles(root) {
  const out = []
  const walk = (absDir, prefix) => {
    let entries
    try {
      entries = readdirSync(absDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (EXCLUDED_DIR_NAMES.has(e.name)) continue
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) walk(join(absDir, e.name), rel)
      else if (e.isFile()) out.push(rel)
    }
  }
  walk(root, '')
  return out
}

/**
 * 主判据出口。
 * @param {string} root 仓库根
 * @param {{files?: string[]}} opts files 注入时跳过枚举(自测夹具用)
 */
function runCheck(root, opts = {}) {
  const files =
    opts.files ?? (existsSync(join(root, '.git')) ? listFaceFiles(root, 'head') : listDiskFiles(root))
  const ledger = loadLedger(root)
  const violations = []
  let scanned = 0
  for (const rel0 of files) {
    const rel = normalize(rel0)
    if (EXCLUDED_DIR_NAMES.has(rel.split('/')[0])) continue
    const abs = join(root, rel)
    let buf
    try {
      buf = readFileSync(abs)
    } catch {
      continue
    }
    if (buf.includes(0)) continue
    const text = buf.toString('utf8')
    scanned++
    for (const check of [checkR1(rel, text, ledger), checkR2(rel, text), checkR3(rel, text)]) {
      if (check) violations.push(check)
    }
  }
  const counts = { R1: 0, R2: 0, R3: 0 }
  for (const v of violations) counts[v.rule]++
  return { root, violations, scanned, counts, ledgerRoots: ledger.map((l) => l.root) }
}

function report(result) {
  if (result.violations.length === 0) {
    return `✅ 许可证边界守门通过:扫描 ${result.scanned} 个文件,无越界入件`
  }
  const lines = result.violations.map((v) => `❌ [${v.rule}] ${v.rel} —— ${v.reason}`)
  return [
    `❌ 许可证边界守门判红:${result.violations.length} 条违规(扫描 ${result.scanned} 个文件;R1 ${result.counts.R1} / R2 ${result.counts.R2} / R3 ${result.counts.R3})`,
    ...lines,
  ].join('\n')
}

// ---------------------------------------------------------------- self-test

const FIXTURE_FILES = {
  // R1 阴性:已登记 + 允许集许可证
  'vendor/good-pkg/index.js': '// SPDX-License-Identifier: MIT\nexport const x = 1\n',
  'third-party/mit-pkg/util.js': '// SPDX-License-Identifier: BSD-3-Clause\nexport const y = 2\n',
  // R1 阳性:未登记的 vendor 目录,AGPL 头
  'vendor/evil-tool/main.py': '# SPDX-License-Identifier: AGPL-3.0\nimport os\n',
  // R1 阳性:未登记的 third_party 目录(无 SPDX 头)
  'third_party/ghost/thing.js': 'export const z = 3\n',
  // R1 阳性:许可证在允许集但未登记(登记条件独立判红)
  'vendor/mit-ghost/a.js': '// SPDX-License-Identifier: MIT\nexport const w = 4\n',
  // R2 阴性:注释 / 文案里的同名提及,不呈代码形态
  'src/notes.ts': '// 备注:曾评估 WeChatFerry / AstrBot,仅作文档参照\nexport const ok = true\n',
  // R2 阳性:Python 导入
  'src/bot.py': 'import AstrBot\n',
  // R2 阳性:CommonJS require
  'src/bridge.js': "const w = require('pywechat')\n",
  // R2 阳性:直接调用形态
  'src/call.ts': 'wx4py.init()\n',
  // R3 阳性:AGPL 许可原文
  'licenses/evil/LICENSE': 'GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n',
  // R3 阳性:CC BY-NC 文本(非 docs/licensing 面)
  'legal/cc-note.txt': 'This work is licensed CC BY-NC-SA 4.0.\n',
  // R2/R3 阴性:docs/licensing 白名单面
  'docs/licensing/report.md': '# 选型记录\nAstrBot 为 AGPL-3.0;WeFlow 为 CC BY-NC-SA 4.0\n',
}

const FIXTURE_LEDGER = {
  schemaVersion: 1,
  entries: [
    { id: 'good-pkg', license: { spdx: 'MIT' }, roots: ['vendor/good-pkg'] },
    { id: 'mit-pkg', license: { spdx: 'BSD-3-Clause' }, roots: ['third-party/mit-pkg'] },
  ],
}

/** 每条夹具期望命中的规则集(未列入者按全阴性处理)。 */
const EXPECTED = {
  'vendor/evil-tool/main.py': ['R1', 'R3'],
  'third_party/ghost/thing.js': ['R1'],
  'vendor/mit-ghost/a.js': ['R1'],
  'src/bot.py': ['R2'],
  'src/bridge.js': ['R2'],
  'src/call.ts': ['R2'],
  'licenses/evil/LICENSE': ['R3'],
  'legal/cc-note.txt': ['R3'],
}

function writeFixture(root, rel, content) {
  const abs = join(root, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function sameRuleSet(got, expected) {
  const g = [...got].sort()
  const e = [...expected].sort()
  return g.length === e.length && g.every((v, i) => v === e[i])
}

function selfTest() {
  let pass = 0
  let fail = 0
  const failures = []
  const check = (name, cond, detail) => {
    if (cond) pass++
    else {
      fail++
      failures.push(`${name}${detail ? `: ${detail}` : ''}`)
    }
  }

  const root = mkdtempSync(join(tmpdir(), 'license-boundary-selftest-'))
  try {
    writeFixture(root, `${LEDGER_DIR}/copied.json`, JSON.stringify(FIXTURE_LEDGER, null, 2))
    for (const [rel, content] of Object.entries(FIXTURE_FILES)) writeFixture(root, rel, content)

    const result = runCheck(root, { files: listDiskFiles(root) })
    const byRule = new Map()
    for (const v of result.violations) {
      if (!byRule.has(v.rel)) byRule.set(v.rel, [])
      byRule.get(v.rel).push(v.rule)
    }

    for (const [rel, expected] of Object.entries(EXPECTED)) {
      const got = byRule.get(rel) ?? []
      check(
        `阳性夹具 ${rel}`,
        sameRuleSet(got, expected),
        `期望 [${expected.join(',')}],实得 [${got.join(',')}]`,
      )
    }
    for (const rel of Object.keys(FIXTURE_FILES)) {
      if (EXPECTED[rel]) continue
      const got = byRule.get(rel) ?? []
      check(`阴性夹具 ${rel} 无违规`, got.length === 0, `实得 [${got.join(',')}]`)
    }

    // 纯函数级对照:允许集 / 白名单 / 标识匹配不随夹具腐烂。
    check('允许集不含 AGPL-3.0', !ALLOWED_SPDX.includes('AGPL-3.0'))
    check('允许集不含 CC-BY-NC-4.0', !ALLOWED_SPDX.includes('CC-BY-NC-4.0'))
    check('白名单覆盖 docs/licensing/', inWhitelist('docs/licensing/third-party-audit.md'))
    check('白名单覆盖本脚本自身', inWhitelist('scripts/check-third-party-license-boundary.mjs'))
    check('散文提及不命中 R2', !rejectedMatch('WeChatFerry', '// WeChatFerry 仅作文档参照'))
    check('导入形态命中 R2', rejectedMatch('pywechat', "const x = require('pywechat-sdk')"))
    check('成员访问形态命中 R2', rejectedMatch('AstrBot', 'AstrBot.someMethod()'))
    check('SPDX 双许可表达式可解析', sameRuleSet(parseSpdxTokens('// SPDX-License-Identifier: MIT OR Apache-2.0'), ['Apache-2.0', 'MIT']))
    check('非允许集令牌被识别', !ALLOWED_SPDX.includes(parseSpdxTokens('# SPDX-License-Identifier: AGPL-3.0')[0]))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }

  console.log(`\n[check-third-party-license-boundary --self-test] 通过 ${pass} / 失败 ${fail}`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  return fail === 0 ? 0 : 1
}

// ---------------------------------------------------------------- CLI

const ALLOWED_FLAGS = new Set(['--check', '--self-test', '--root', '--help', '-h'])

async function main(argv) {
  const args = argv.slice(2)
  for (const f of args) {
    if (!f.startsWith('-')) continue
    const name = f.split('=')[0]
    if (!ALLOWED_FLAGS.has(name)) {
      process.stderr.write(
        `用法错:未知开关 ${f}(白名单:${[...ALLOWED_FLAGS].join(' ')});拒绝按默认档跑\n`,
      )
      return 129
    }
  }
  const rootArg = requireFlagValue(args, '--root', { noun: '目录参数', fallback: null })
  if (rootArg.error) {
    console.error(`❌ 无法判定:${rootArg.error}`)
    return 2
  }
  const root = rootArg.value !== null ? resolve(rootArg.value) : DEFAULT_ROOT

  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      '用法: node scripts/check-third-party-license-boundary.mjs [--check] [--root <dir>]\n' +
        '  --check     零副作用判定(默认),判 HEAD 跟踪清单\n' +
        '  --root <dir>  指定仓库根(非 git 目录走磁盘递归)\n' +
        '  --self-test  临时目录造 R1/R2/R3 阳性 / 阴性夹具取证\n' +
        '退出码: 0 通过 / 1 违规 / 2 无法判定 / 129 用法错',
    )
    return 0
  }
  if (args.includes('--self-test')) return selfTest()

  try {
    const result = runCheck(root)
    console.log(report(result))
    return result.violations.length > 0 ? 1 : 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定:${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常(不按判据失败处理):${e?.stack ?? e}`)
    return 2
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv).then((code) => {
    if (code !== 0) process.exit(code)
  })
}

export const __test__ = {
  runCheck,
  checkR1,
  checkR2,
  checkR3,
  rejectedMatch,
  parseSpdxTokens,
  loadLedger,
  inWhitelist,
  listDiskFiles,
  ALLOWED_SPDX,
  REJECTED_IDENTIFIERS,
  SOURCE_EXTS,
  VENDOR_DIR_NAMES,
  WHITELIST,
  LEDGER_DIR,
  EXPECTED,
  FIXTURE_FILES,
  FIXTURE_LEDGER,
}
