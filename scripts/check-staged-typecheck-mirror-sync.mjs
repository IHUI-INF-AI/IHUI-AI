#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-staged-typecheck-mirror-sync.mjs — 源/测 export 锚点回归测试
 *
 * 2026-08-18 立 | 2026-08-18 降级 (从镜像漂移检测 → export 锚点回归)
 *
 * 背景(第一阶段, 已退役):
 *   scripts/check-staged-typecheck.mjs 的核心过滤函数
 *   (filterTscOutputForStagedFiles / getOriginalInclude / normalizePath)
 *   未从源脚本导出, 测试文件用「镜像常量」复制函数体单测。
 *   风险: 有人改了源函数但忘了同步测试镜像, 导致"测试全绿但生产路径仍是
 *   旧逻辑"的隐性 bug。守门脚本用两阶段指纹比对(行号范围 + 字面量子串)
 *   检测漂移。
 *
 * 第二阶段(当前, 2026-08-18 根治镜像常量):
 *   源脚本新增 `export const __test__ = { ... }`(L399 附近, main() 之前),
 *   测试改为直接 `import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'`,
 *   镜像常量已全部删除, 不存在「源/测字面量子串漂移」的可能性。
 *
 *   本脚本同步降级为「export 锚点回归测试」, 仅校验:
 *     A) 源脚本包含 `export const __test__` 关键字;
 *     B) `__test__` 包含三个期望键名:
 *        getOriginalInclude / normalizePath / filterTscOutputForStagedFiles;
 *     C) 测试文件包含 import 引用:
 *        `import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'`。
 *
 *   失败信息: 「源/测 export 锚点漂移, 请检查:
 *             1) 源脚本 __test__ 导出未变;
 *             2) 测试 import 路径未变。」(详见修复指南段)
 *
 * 检测目标:
 *   - 源脚本 scripts/check-staged-typecheck.mjs 的 __test__ 导出
 *   - 测试文件 scripts/tests/check-staged-typecheck.test.mjs 的 import 引用
 *
 * 集成位置:
 *   - guardian-runner.mjs (blocking, 见 id '16c' 守门项, AGENTS.md §25)
 *   - 也可单独调用: node scripts/check-staged-typecheck-mirror-sync.mjs
 *
 * 跳过方法(应急):
 *   HUSKY_SKIP_STAGED_TYPECHECK_MIRROR_SYNC=1 git commit ...
 *   或临时把本守门改成 warn-only 起步。
 *
 * 退出码:
 *   0  通过 (源/测 export 锚点完全一致)
 *   1  漂移 (任一锚点缺失或被改名, 详细诊断已打印)
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

// === 期望的 export 锚点(三个核心函数键名) ===
// 修改源脚本核心函数体允许, 但 export 键名不允许重命名。
// 修改源脚本允许重命名键时, 必须同步更新本常量 + 测试 import + AGENTS.md §22b + §22c。
const EXPECTED_KEYS = [
  'getOriginalInclude',
  'normalizePath',
  'filterTscOutputForStagedFiles',
]

// === CLI 参数解析 ===
const argv = process.argv.slice(2)
const QUIET = argv.includes('--quiet')
const JSON_OUT = argv.includes('--json')
const SHOW_HELP = argv.includes('--help') || argv.includes('-h')

if (SHOW_HELP) {
  console.log(`
check-staged-typecheck-mirror-sync.mjs — 源/测 export 锚点回归测试

用法:
  node scripts/check-staged-typecheck-mirror-sync.mjs [选项]

选项:
  --quiet   仅返回 exit code,不打印诊断
  --json    以 JSON 格式输出报告
  --help    打印此帮助

退出码:
  0  通过 (源/测 export 锚点完全一致)
  1  漂移 (任一锚点缺失或被改名)
  2  异常 (源/测文件缺失)

检测目标:
  源脚本 scripts/check-staged-typecheck.mjs:
    export const __test__ = {
      getOriginalInclude,
      normalizePath,
      filterTscOutputForStagedFiles,
    }

镜像测试文件:
  scripts/tests/check-staged-typecheck.test.mjs
    import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'
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

/**
 * 从源脚本文本中提取 __test__ export 对象字面量。
 * 用花括号配对扫描: 从 "export const __test__" 起, 找到下一个等量匹配的 '}',
 * 截取中间内容作为"键定义区"。
 * 鲁棒处理: 允许 { 后换行/空格; 允许键名后跟 ',' 或 '}'; 不依赖 AST。
 * @returns {string|null} 提取的键定义区字符串 (例: "  getOriginalInclude,\n  normalizePath,\n  ...")
 */
function extractTestExportKeys(sourceText) {
  const idx = sourceText.indexOf('export const __test__')
  if (idx === -1) return null
  // 从 export 关键字之后开始找第一个 '{'
  let i = sourceText.indexOf('{', idx)
  if (i === -1) return null
  // 花括号配对扫描 (深度计数, 跳过字符串字面量)
  let depth = 0
  const start = i
  let inStr = null // 当前字符串引号 (' " `), null 表示不在字符串内
  let escape = false
  for (; i < sourceText.length; i++) {
    const ch = sourceText[i]
    if (escape) {
      escape = false
      continue
    }
    if (inStr) {
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === inStr) {
        inStr = null
      }
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '{') {
      depth++
      continue
    }
    if (ch === '}') {
      depth--
      if (depth === 0) {
        return sourceText.slice(start + 1, i)
      }
    }
  }
  return null
}

/**
 * 从键定义区字符串中识别"标识符 token"(忽略空白/逗号/换行)。
 * @returns {string[]}
 */
function extractKeyNames(keysBlock) {
  const names = []
  const re = /[A-Za-z_$][A-Za-z0-9_$]*/g
  let m
  while ((m = re.exec(keysBlock)) !== null) {
    // 过滤掉 JS 关键字 (虽然 export const __test__ = { ... } 内不会有, 但稳妥)
    if (
      m[0] === 'true' ||
      m[0] === 'false' ||
      m[0] === 'null' ||
      m[0] === 'undefined'
    )
      continue
    names.push(m[0])
  }
  return names
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

  const report = {
    ok: true,
    drift: [],
    checks: {
      sourceHasExportConstTest: false,
      sourceKeys: [],
      testHasImportFromSource: false,
    },
  }

  // 2) 阶段 A: 源脚本 export const __test__ 关键字存在性
  const hasExportConstTest =
    /export\s+const\s+__test__\b/.test(sourceText)
  report.checks.sourceHasExportConstTest = hasExportConstTest
  if (!hasExportConstTest) {
    report.ok = false
    report.drift.push({
      kind: 'source_export_missing',
      needle: 'export const __test__',
      hint: '源脚本未导出 __test__ 别名; 测试文件无法 import 源函数, 已退化为不可编译',
    })
  }

  // 3) 阶段 B: 源脚本 __test__ 包含三个期望键
  const keysBlock = extractTestExportKeys(sourceText)
  const actualKeys = keysBlock ? extractKeyNames(keysBlock) : []
  report.checks.sourceKeys = actualKeys
  for (const expected of EXPECTED_KEYS) {
    if (!actualKeys.includes(expected)) {
      report.ok = false
      report.drift.push({
        kind: 'source_key_missing',
        key: expected,
        actualKeys,
        hint: `源脚本 __test__ 未包含键 "${expected}"; 键名重命名会破坏测试 import`,
      })
    }
  }

  // 4) 阶段 C: 测试文件 import 引用存在性
  // 检测两种合法形式: `import { __test__ }` 与 `import { __test__ as ... }`
  const hasImportTest =
    /import\s*\{[^}]*\b__test__\b[^}]*\}\s*from\s*['"]\.\.\/check-staged-typecheck\.mjs['"]/.test(
      testText,
    )
  report.checks.testHasImportFromSource = hasImportTest
  if (!hasImportTest) {
    report.ok = false
    report.drift.push({
      kind: 'test_import_missing',
      needle:
        "import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'",
      hint: '测试文件未 import __test__ 别名; 测试已退化为不可解析',
    })
  }

  // 5) 输出报告
  if (JSON_OUT) {
    console.log(reportToJson(report))
    process.exit(report.ok ? 0 : 1)
  }

  if (report.ok) {
    log('ok', '源/测 export 锚点一致, 无漂移')
    if (!QUIET) {
      console.log(`${C.dim}   source  export const __test__           ✓${C.reset}`)
      console.log(`${C.dim}   source  keys: getOriginalInclude           ✓${C.reset}`)
      console.log(`${C.dim}   source  keys: normalizePath                 ✓${C.reset}`)
      console.log(`${C.dim}   source  keys: filterTscOutputForStagedFiles ✓${C.reset}`)
      console.log(`${C.dim}   test    import { __test__ } from ...         ✓${C.reset}`)
    }
    process.exit(0)
  }

  log('err', `检测到源/测 export 锚点漂移(${report.drift.length} 处):`)
  for (const d of report.drift) {
    console.log(`${C.red}   ✗ [${d.kind}]${C.reset}`)
    if (d.key) console.log(`       缺失键: ${d.key}`)
    if (d.actualKeys) console.log(`       实际键: ${d.actualKeys.join(', ') || '(无)'}`)
    if (d.needle) console.log(`       期望字串: ${d.needle}`)
    if (d.hint) console.log(`       提示: ${d.hint}`)
  }
  console.log('')
  console.log(
    `${C.yellow}修复方法: 1) 源脚本 __test__ 导出未变(三个键名: ${EXPECTED_KEYS.join(' / ')});${C.reset}`,
  )
  console.log(
    `${C.yellow}          2) 测试 import 路径未变 ('../check-staged-typecheck.mjs');${C.reset}`,
  )
  console.log(
    `${C.yellow}          3) 详见 AGENTS.md §22b 红线规则 + §22c 镜像常量守门模式。${C.reset}`,
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
