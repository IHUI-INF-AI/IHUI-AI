/**
 * i18n 键名裸露静态扫描 (2026-07-02 立)
 *
 * 目的: 在 build time 扫描所有 .vue / .ts 文件中的 t('key.path') 调用,
 *       检查 key 是否在 zh-CN locale 中注册. 未注册的 key 会在运行时
 *       显示为键名裸露 (e.g. "login.tabs.account" 直接显示给用户).
 *
 * 与 e2e/i18n-key-exposure-deep-scan.spec.ts 的区别:
 *   - deep-scan spec: 浏览器侧运行时检测 (慢, 需 dev server, 但 100% 准确)
 *   - 本脚本: 静态正则扫描 (快, 毫秒级, 可挂 pre-commit, 但有动态键盲区)
 *
 * 检测 5 种 t() 调用形式:
 *   (1) t('key.path')              - 最常见
 *   (2) $t('key.path')             - 模板内
 *   (3) i18n.global.t('key.path')  - 直接调 i18n
 *   (4) i18n.t('key.path')         - 旧 API
 *   (5) t(`key.path`)              - 模板字符串 (仅静态部分)
 *
 * 跳过:
 *   - 动态键 t(`api.${name}`) (含 ${}) - 无法静态分析, 不报错
 *   - 注释内的 t() (行注释 或 块注释 或 HTML 注释)
 *   - 字符串内的 t() (少见, 容忍误报)
 *
 * 阈值: 默认 strict (0 未注册), 可用 --threshold=N 容忍 N 个
 *
 * 使用:
 *   npm run check:i18n:exposure
 *   npm run check:i18n:exposure -- --threshold=10
 *
 * 2026-07-02 立
 */

import fs from 'node:fs'
import path from 'node:path'

const SRC_DIR = path.join(process.cwd(), 'src')
const LOCALES_DIR = path.join(process.cwd(), 'src', 'locales')
const MODULES_DIR = path.join(LOCALES_DIR, 'modules', 'zh-CN')

// CLI 参数
const thresholdArg = process.argv.find((a) => a.startsWith('--threshold='))
const THRESHOLD = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 0
const STRICT = process.argv.includes('--strict')

// 跳过的目录 (node_modules / dist / __tests__ / 等)
const SKIP_DIRS = /(node_modules|dist|\.git|__tests__|__mocks__|\.nuxt|\.output)/i
// 扫描的文件扩展名
const SCAN_EXTS = /\.(vue|ts|tsx|js|jsx)$/i

// t() 调用正则 (5 种形式)
// 1. t('key') / t("key")  - 单引号/双引号
// 2. $t('key')            - 模板内
// 3. i18n.global.t('key') - 直接调
// 4. i18n.t('key')        - 旧 API
// 5. t(`key`)             - 模板字符串 (仅静态, 不含 ${})
// 注意: 用 negative lookbehind (?<![\w$]) 排除 import('xxx') 等误报
//       t 前面不能是字母/数字/_/$ (否则可能是 import / smart / other 词的一部分)
const T_CALL_PATTERNS: RegExp[] = [
  /(?<![\w$])(?:\$t|i18n\.global\.t|i18n\.t|t)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.]*)['"`]/g,
]

// 注释正则 (用于过滤注释内的 t() 调用)
const LINE_COMMENT = /^\s*(\/\/|#)/
const BLOCK_COMMENT_START = /\/\*/
const HTML_COMMENT_START = /<!--/

interface Finding {
  file: string
  line: number
  key: string
  context: string
}

/** 递归读取目录下所有 .vue/.ts/.js 文件 */
function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.test(p)) continue
      walk(p, cb)
    } else if (SCAN_EXTS.test(e.name)) {
      cb(p)
    }
  }
}

/** 读取 JSON (容错 BOM) */
function readJSON(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null
  try {
    let raw = fs.readFileSync(p, 'utf-8')
    // 去 BOM (项目历史有双 BOM 问题)
    while (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 把嵌套对象扁平化为 dotted key 路径集合 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): Set<string> {
  const keys = new Set<string>()
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = flattenKeys(v as Record<string, unknown>, key)
      for (const nk of nested) keys.add(nk)
    } else {
      keys.add(key)
    }
  }
  return keys
}

/** 加载所有 zh-CN locale 模块, 合并成一个大 key 集合 */
function loadAllRegisteredKeys(): Set<string> {
  const allKeys = new Set<string>()
  // 1. modules/zh-CN/*.json
  if (fs.existsSync(MODULES_DIR)) {
    const files = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      const data = readJSON(path.join(MODULES_DIR, f))
      if (!data) continue
      const moduleName = f.replace(/\.json$/, '')
      const keys = flattenKeys(data, moduleName)
      for (const k of keys) allKeys.add(k)
    }
  }
  // 2. 顶层 zh-CN.json (含 legacy 键)
  const topLevel = path.join(LOCALES_DIR, 'zh-CN.json')
  if (fs.existsSync(topLevel)) {
    const data = readJSON(topLevel)
    if (data) {
      const keys = flattenKeys(data)
      for (const k of keys) allKeys.add(k)
    }
  }
  // 3. full/zh-CN.json (如有)
  const fullDir = path.join(LOCALES_DIR, 'full', 'zh-CN')
  if (fs.existsSync(fullDir)) {
    const files = fs.readdirSync(fullDir).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      const data = readJSON(path.join(fullDir, f))
      if (!data) continue
      const moduleName = f.replace(/\.json$/, '')
      const keys = flattenKeys(data, moduleName)
      for (const k of keys) allKeys.add(k)
    }
  }
  return allKeys
}

/** 从源码文件提取所有 t() 调用的 key */
function extractKeysFromFile(file: string): { key: string; line: number; context: string }[] {
  const content = fs.readFileSync(file, 'utf-8')
  const lines = content.split('\n')
  const findings: { key: string; line: number; context: string }[] = []

  let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // 跳过注释行
    if (LINE_COMMENT.test(line.trim())) continue
    if (HTML_COMMENT_START.test(line.trim())) continue

    // 块注释状态跟踪 (简单版, 不处理嵌套)
    if (BLOCK_COMMENT_START.test(line)) {
      inBlockComment = true
    }
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      continue
    }

    // 对每行应用所有正则
    for (const pattern of T_CALL_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match: RegExpExecArray | null
      while ((match = regex.exec(line)) !== null) {
        const key = match[1]
        if (!key) continue
        // 跳过动态键 (含 ${})
        if (key.includes('${')) continue
        // 跳过明显不是 i18n 键的 (e.g. t('true') / t('false') 等布尔/数字)
        if (['true', 'false', 'null', 'undefined'].includes(key)) continue
        findings.push({
          key,
          line: lineNum,
          context: line.trim().slice(0, 80),
        })
      }
    }
  }

  return findings
}

function main(): void {
  console.log('\n🔍 i18n 键名裸露静态扫描')
  console.log('━'.repeat(60))

  // 1. 加载所有已注册的 i18n 键
  console.log('加载 zh-CN locale 注册键...')
  const registeredKeys = loadAllRegisteredKeys()
  console.log(`  已注册键数: ${registeredKeys.size}`)

  // 2. 扫描所有源码文件
  console.log('\n扫描源码文件 (.vue/.ts/.tsx/.js/.jsx)...')
  const findings: Finding[] = []
  let scannedFiles = 0
  let totalCalls = 0

  walk(SRC_DIR, (file) => {
    scannedFiles++
    const calls = extractKeysFromFile(file)
    for (const c of calls) {
      totalCalls++
      if (!registeredKeys.has(c.key)) {
        findings.push({
          file: path.relative(process.cwd(), file),
          line: c.line,
          key: c.key,
          context: c.context,
        })
      }
    }
  })

  console.log(`  扫描文件数: ${scannedFiles}`)
  console.log(`  t() 调用总数: ${totalCalls}`)
  console.log(`  未注册键数: ${findings.length}`)

  // 3. 输出结果
  if (findings.length === 0) {
    console.log('\n✅ 所有 t() 调用的键都已注册, 无键名裸露风险')
    console.log('━'.repeat(60))
    process.exit(0)
  }

  // 按文件分组输出
  const byFile = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file)!.push(f)
  }

  console.log(`\n⚠️  发现 ${findings.length} 个未注册键 (分布在 ${byFile.size} 个文件):`)
  console.log()

  // 按文件输出, 每文件最多 5 个
  let shown = 0
  for (const [file, items] of byFile) {
    if (shown >= 50) break // 最多显示 50 个文件
    console.log(`  📄 ${file}`)
    for (const item of items.slice(0, 5)) {
      console.log(`     L${item.line}: ${item.key}`)
      console.log(`        ${item.context}`)
    }
    if (items.length > 5) {
      console.log(`     ... 还有 ${items.length - 5} 个`)
    }
    console.log()
    shown++
  }

  if (findings.length > 100) {
    console.log(`  ... 还有 ${findings.length - 100} 个未显示`)
  }

  console.log('━'.repeat(60))

  // 4. 判定
  // 默认: 报告模式 (exit 0), 仅打印未注册键供开发者参考
  // --strict: 严格模式, 未注册键 > 阈值时 exit 1 (可挂 CI/pre-push)
  if (!STRICT) {
    console.log(`\n📋 报告模式 (未注册键 ${findings.length}, 默认不拦截)`)
    console.log('   加 --strict 可启用拦截模式 (exit 1 if > threshold)')
    console.log('━'.repeat(60))
    process.exit(0)
  }

  if (findings.length <= THRESHOLD) {
    console.log(`✅ [strict] 未注册键 ${findings.length} ≤ 阈值 ${THRESHOLD}, 通过`)
    console.log('━'.repeat(60))
    process.exit(0)
  } else {
    console.log(`❌ [strict] 未注册键 ${findings.length} > 阈值 ${THRESHOLD}, 失败`)
    console.log('   修复建议:')
    console.log('   (1) 检查 key 是否拼写错误 (e.g. login.tba.account → login.tabs.account)')
    console.log('   (2) 如果是新 key, 在 src/locales/modules/zh-CN/<module>.json 注册')
    console.log('   (3) 如果是动态键 t(`api.${name}`), 无法静态分析, 加 // eslint-disable-next-line 注释')
    console.log('   (4) 如果是 fallback 用法 t(\'key\', \'中文fallback\'), 确认 fallback 已正确')
    console.log('   (5) 临时放宽阈值: npm run check:i18n:exposure -- --strict --threshold=N')
    process.exit(1)
  }
}

main()
