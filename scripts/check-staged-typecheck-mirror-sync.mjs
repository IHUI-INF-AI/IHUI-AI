#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-staged-typecheck-mirror-sync.mjs — 源/测镜像漂移防御守门
 *
 * 2026-08-18 立 | 镜像同步义务锚点
 *
 * 背景:
 *   scripts/check-staged-typecheck.mjs 的核心过滤函数
 *   (filterTscOutputForStagedFiles / getOriginalInclude / normalizePath)
 *   未从源脚本导出,测试文件 scripts/tests/check-staged-typecheck.test.mjs
 *   必须以【镜像常量】方式复制函数体才能单测。
 *   风险:有人改了源脚本的核心函数但忘了同步测试的镜像,导致
 *   "测试全绿但生产路径仍是旧逻辑" 的隐性 bug,完全绕过 typecheck 闸门。
 *
 * 检测规则(两阶段指纹比对):
 *   阶段 A:从测试文件头部「镜像同步锚点」注释块正则提取
 *          `源脚本第 X-Y 行` 行号范围,与源脚本中三个函数的实际行号比对;
 *          任一范围不一致 → exit 1。
 *   阶段 B:从源脚本对应行号区间内提取【关键指纹】(函数签名 + 关键正则/逻辑),
 *          与测试镜像对应位置的【关键指纹】正则比对;
 *          任一指纹不匹配 → exit 1。
 *
 * 检测目标(源脚本):
 *   - getOriginalInclude          源脚本第 244-256 行
 *   - normalizePath                源脚本第 284-286 行
 *   - filterTscOutputForStagedFiles 源脚本第 298-327 行
 *
 * 集成位置:
 *   - guardian-runner.mjs (blocking, 见 id '16c' 新增项)
 *   - 也可单独调用: node scripts/check-staged-typecheck-mirror-sync.mjs
 *
 * 跳过方法(应急):
 *   HUSKY_SKIP_STAGED_TYPECHECK_MIRROR_SYNC=1 git commit ...
 *   或临时把本守门改成 warn-only 起步。
 *
 * 退出码:
 *   0  通过 (源/测指纹完全一致)
 *   1  漂移 (任一指纹或行号不一致,详细诊断已打印)
 *   2  异常 (源/测文件缺失或脚本本身执行异常)
 *
 * 用法:
 *   node scripts/check-staged-typecheck-mirror-sync.mjs
 *   node scripts/check-staged-typecheck-mirror-sync.mjs --quiet   # 仅 exit code
 *   node scripts/check-staged-typecheck-mirror-sync.mjs --json    # 输出 JSON 报告
 *   node scripts/check-staged-typecheck-mirror-sync.mjs --help
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs')
const TEST_PATH = join(ROOT, 'scripts', 'tests', 'check-staged-typecheck.test.mjs')

// === 颜色(ANSI) ===
const C = {
  red: '\x1B[31m',
  green: '\x1B[32m',
  yellow: '\x1B[33m',
  cyan: '\x1B[36m',
  bold: '\x1B[1m',
  dim: '\x1B[2m',
  reset: '\x1B[0m',
}

// === 三个核心函数的【期望行号】(与测试文件头部"镜像同步锚点"注释一致) ===
// 修改本脚本或源脚本时,如行号变化需同步更新 AGENTS.md §22b + 测试文件头部注释。
const EXPECTED_RANGES = [
  { key: 'getOriginalInclude', start: 244, end: 256 },
  { key: 'normalizePath', start: 284, end: 286 },
  { key: 'filterTscOutputForStagedFiles', start: 298, end: 327 },
]

// === 关键指纹(字面量子串,避免双重转义陷阱) ===
// 用「源脚本中正则字面量本身 + 测试镜像中正则字面量」做字符串包含比对,
// 不依赖 AST,鲁棒且零依赖。下列字串必须同时出现在源脚本对应行号区间
// 与测试文件全文中,任一缺失即视为漂移。
const FINGERPRINT_STRINGS = {
  getOriginalInclude: [
    "'./src/**/*.ts'",
    "'./src/**/*.tsx'",
    "'./**/*.d.ts'",
  ],
  normalizePath: [
    'p.replace(/\\\\/g, \'/\')',
  ],
  filterTscOutputForStagedFiles: [
    'line.match(/^(.+?)\\(\\d+,\\d+\\): error TS\\d+:/)',
    'pendingIsStaged',
  ],
}

// === CLI 参数解析 ===
const argv = process.argv.slice(2)
const QUIET = argv.includes('--quiet')
const JSON_OUT = argv.includes('--json')
const SHOW_HELP = argv.includes('--help') || argv.includes('-h')

if (SHOW_HELP) {
  console.log(`
check-staged-typecheck-mirror-sync.mjs — 源/测镜像漂移防御守门

用法:
  node scripts/check-staged-typecheck-mirror-sync.mjs [选项]

选项:
  --quiet   仅返回 exit code,不打印诊断
  --json    以 JSON 格式输出报告
  --help    打印此帮助

退出码:
  0  通过 (源/测指纹完全一致)
  1  漂移 (任一指纹或行号不一致)
  2  异常 (源/测文件缺失)

检测目标:
  scripts/check-staged-typecheck.mjs:
    getOriginalInclude             L244-256
    normalizePath                   L284-286
    filterTscOutputForStagedFiles   L298-327

镜像测试文件:
  scripts/tests/check-staged-typecheck.test.mjs
`)
  process.exit(0)
}

// === 工具函数 ===

function log(level, msg) {
  if (QUIET) return
  const map = {
    info: { color: C.cyan, icon: '🔒' },
    ok: { color: C.green, icon: '✅' },
    warn: { color: C.yellow, icon: '⚠️ ' },
    err: { color: C.red, icon: '❌' },
  }
  const { color, icon } = map[level] || map.info
  console.log(`${color}${icon} ${msg}${C.reset}`)
}

function reportToJson(report) {
  return JSON.stringify(report, null, 2)
}

function extractRange(lines, start, end) {
  return lines.slice(start - 1, end).join('\n')
}

function tryParseTestAnchors(testText) {
  // 测试文件头部存在「镜像同步锚点:」注释块,内部若干「源脚本第 X-Y 行」
  // 例:`filterTscOutputForStagedFiles: 源脚本第 298-327 行`
  const anchorRegex =
    /\b(filterTscOutputForStagedFiles|getOriginalInclude|normalizePath)\b[^\n]*?源脚本第\s*(\d+)\s*-\s*(\d+)\s*行/g
  const found = []
  let m
  while ((m = anchorRegex.exec(testText)) !== null) {
    found.push({
      key: m[1],
      start: Number(m[2]),
      end: Number(m[3]),
    })
  }
  return found
}

function countContains(text, needle) {
  let n = 0
  let i = 0
  while ((i = text.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

// === 主流程 ===

function main() {
  // 1) 源/测文件存在性
  if (!existsSync(SOURCE_PATH)) {
    if (JSON_OUT) {
      console.log(
        reportToJson({
          ok: false,
          error: 'source_missing',
          sourcePath: SOURCE_PATH,
        }),
      )
    } else {
      log('err', `源脚本不存在: ${SOURCE_PATH}`)
    }
    process.exit(2)
  }
  if (!existsSync(TEST_PATH)) {
    if (JSON_OUT) {
      console.log(
        reportToJson({
          ok: false,
          error: 'test_missing',
          testPath: TEST_PATH,
        }),
      )
    } else {
      log('err', `测试文件不存在: ${TEST_PATH}`)
    }
    process.exit(2)
  }

  const sourceText = readFileSync(SOURCE_PATH, 'utf8')
  const testText = readFileSync(TEST_PATH, 'utf8')
  const sourceLines = sourceText.split(/\r?\n/)

  // 2) 阶段 A:行号范围校验
  const testAnchors = tryParseTestAnchors(testText)
  const report = {
    ok: true,
    drift: [],
    testAnchors,
    expectedRanges: EXPECTED_RANGES,
  }

  for (const expected of EXPECTED_RANGES) {
    const matched = testAnchors.find((a) => a.key === expected.key)
    if (
      !matched ||
      matched.start !== expected.start ||
      matched.end !== expected.end
    ) {
      report.ok = false
      report.drift.push({
        kind: 'line_range',
        key: expected.key,
        expected: `${expected.start}-${expected.end}`,
        actual: matched ? `${matched.start}-${matched.end}` : '<missing>',
      })
    }
  }

  // 3) 阶段 B:关键指纹比对 — 在源脚本【期望行号区间】与测试文件全文各跑一次指纹匹配。
  for (const expected of EXPECTED_RANGES) {
    const sourceRange = extractRange(
      sourceLines,
      expected.start,
      expected.end,
    )
    const strings = FINGERPRINT_STRINGS[expected.key]
    for (const s of strings) {
      const inSource = countContains(sourceRange, s) > 0
      const inTest = countContains(testText, s) > 0
      if (!inSource) {
        report.ok = false
        report.drift.push({
          kind: 'fingerprint_missing_in_source',
          key: expected.key,
          range: `${expected.start}-${expected.end}`,
          needle: s,
          hint: '源脚本对应行号区间内未匹配到关键指纹,可能行号偏移或函数体已删除',
        })
      }
      if (!inTest) {
        report.ok = false
        report.drift.push({
          kind: 'fingerprint_missing_in_test',
          key: expected.key,
          needle: s,
          hint: '测试文件中未匹配到关键指纹,镜像常量可能已丢失或被改写',
        })
      }
    }
  }

  // 4) 输出报告
  if (JSON_OUT) {
    console.log(reportToJson(report))
    process.exit(report.ok ? 0 : 1)
  }

  if (report.ok) {
    log('ok', '源/测指纹一致,无漂移')
    if (!QUIET) {
      console.log(`${C.dim}   getOriginalInclude             L244-256  ✓${C.reset}`)
      console.log(`${C.dim}   normalizePath                   L284-286  ✓${C.reset}`)
      console.log(`${C.dim}   filterTscOutputForStagedFiles   L298-327  ✓${C.reset}`)
    }
    process.exit(0)
  }

  log('err', `检测到源/测镜像漂移(${report.drift.length} 处):`)
  for (const d of report.drift) {
    console.log(`${C.red}   ✗ [${d.kind}] ${d.key}${C.reset}`)
    if (d.expected) console.log(`       期望: ${d.expected}`)
    if (d.actual) console.log(`       实际: ${d.actual}`)
    if (d.range) console.log(`       范围: ${d.range}`)
    if (d.needle) console.log(`       指纹: ${d.needle}`)
    if (d.hint) console.log(`       提示: ${d.hint}`)
  }
  console.log('')
  console.log(
    `${C.yellow}修复方法:同步更新源脚本行号 + 测试文件头部"镜像同步锚点"注释。${C.reset}`,
  )
  console.log(
    `${C.yellow}详见 AGENTS.md §22b 红线规则(2026-08-18 镜像同步义务)。${C.reset}`,
  )
  process.exit(1)
}

try {
  main()
} catch (err) {
  if (JSON_OUT) {
    console.log(
      reportToJson({
        ok: false,
        error: 'script_exception',
        message: err?.message || String(err),
      }),
    )
  } else {
    log('err', `脚本执行异常: ${err?.message || String(err)}`)
    if (err?.stack) console.error(err.stack)
  }
  process.exit(2)
}