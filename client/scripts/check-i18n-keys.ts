/**
 * i18n key 存在性检查 (CI 守门)
 *
 * 作用: 扫描所有源码 t('xxx.yyy') 调用, 比对 modules/zh-CN/ 中是否存在对应模块文件 + key 路径
 * 目的: 防止键名裸露 (UI 显示 "home.xxx" 而非翻译文本) 再次回归
 *
 * 背景:
 *   - 现有 check-i18n.ts 只检查各语言覆盖率对比, 不检查 t() key 是否实际存在
 *   - 历史上 modules 文件严重不完整 (覆盖率仅 22%), 导致 8851/11409 key 裸露
 *   - 本脚本填补该盲区, 作为 CI 守门
 *
 * 用法:
 *   tsx scripts/check-i18n-keys.ts                 # 严格模式, 缺失即 fail
 *   I18N_KEYS_THRESHOLD=100 tsx scripts/check-i18n-keys.ts  # 允许 100 个缺失
 *
 * 跳过:
 *   - 动态 key (含 ${} 或变量)
 *   - 纯变量 (无点号)
 *   - 测试文件 / mock / 文档
 *   - 非 ASCII 字符的 key (中文内容误匹配)
 */

import fs from 'node:fs'
import path from 'node:path'

const CLIENT_ROOT = process.cwd()
const MODULES_DIR = path.join(CLIENT_ROOT, 'src', 'locales', 'modules')
const ZH_CN_DIR = path.join(MODULES_DIR, 'zh-CN')
const SOURCE_DIRS = [
  path.join(CLIENT_ROOT, 'src'),
  path.join(CLIENT_ROOT, 'miniapp', 'src'),
]

/** 跳过的目录
 *  - node_modules/dist/.git/locales/test/mock: 常规排除
 *  - uniCloud-aliyun/uni_modules: 小程序第三方/云函数打包代码 (含 browserify 打包产物, 会被正则误匹配)
 */
const SKIP_DIRS = [
  'node_modules', 'dist', '.git', 'locales',
  'test', '__tests__', 'mock', '__mocks__',
  'uniCloud-aliyun', 'uni_modules',
]

/** 跳过的文件名包含 */
const SKIP_FILES = ['.md', '.json', '.snap', 'README', '.test.', '.spec.', 'auto-translate-i18n']

/** 命令行参数 */
const args = process.argv.slice(2)

/** 阈值 (默认 0 = 严格). 通过环境变量可放宽 */
const THRESHOLD = parseInt(process.env.I18N_KEYS_THRESHOLD || '0', 10)

/** dump 明细到 JSON 文件 (可选): --dump=path.json */
const dumpArg = args.find((a) => a.startsWith('--dump='))
const dumpFile = dumpArg ? dumpArg.split('=')[1] : null

interface MissingKey {
  file: string
  line: number
  key: string
  reason: 'module_not_found' | 'key_not_found'
  detail: string
}

/** 读取 JSON (容错) */
function readJSON(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

/** 检查 key 路径是否存在 */
function hasKeyPath(obj: Record<string, unknown>, segments: string[]): boolean {
  let cur: unknown = obj
  for (const seg of segments) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return false
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur !== undefined
}

/** 缓存: 模块名 → 已加载内容 (避免重复 IO) */
const moduleCache = new Map<string, Record<string, unknown> | null>()

function getModule(moduleName: string): Record<string, unknown> | null {
  if (moduleCache.has(moduleName)) return moduleCache.get(moduleName) || null
  const p = path.join(ZH_CN_DIR, `${moduleName}.json`)
  const obj = readJSON(p)
  moduleCache.set(moduleName, obj)
  return obj
}

/** 提取 t() 调用的静态 key */
function extractTCallKeys(content: string): Array<{ key: string; line: number }> {
  const results: Array<{ key: string; line: number }> = []
  const lines = content.split('\n')

  // 匹配 t('xxx.yyy') 或 t("xxx.yyy"), 支持点号嵌套
  // 不匹配: 含 ${} 的模板字符串, 含变量的拼接
  const re = /\bt\(\s*['"]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"]/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳过注释行
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue

    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(line)) !== null) {
      const key = m[1]
      // 跳过含中文/日韩文/特殊字符的误匹配 (key 应为纯 ASCII 标识符)
      if (!/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(key)) continue
      results.push({ key, line: i + 1 })
    }
  }

  return results
}

/** 递归扫描目录 */
function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.includes(e.name)) continue
      walk(p, cb)
    } else {
      cb(p)
    }
  }
}

/** 主检查逻辑 */
function check(): MissingKey[] {
  const missing: MissingKey[] = []

  for (const root of SOURCE_DIRS) {
    if (!fs.existsSync(root)) continue
    walk(root, (file) => {
      if (!/\.(vue|ts|tsx|js|jsx)$/.test(file)) return
      if (SKIP_FILES.some((s) => file.includes(s))) return

      const content = fs.readFileSync(file, 'utf-8')
      const keys = extractTCallKeys(content)

      for (const { key, line } of keys) {
        const segments = key.split('.')
        const moduleName = segments[0]
        const keyPath = segments.slice(1)

        const mod = getModule(moduleName)
        if (!mod) {
          missing.push({
            file, line, key,
            reason: 'module_not_found',
            detail: `模块文件 modules/zh-CN/${moduleName}.json 不存在`,
          })
          continue
        }

        if (!hasKeyPath(mod, segments)) {
          missing.push({
            file, line, key,
            reason: 'key_not_found',
            detail: `modules/zh-CN/${moduleName}.json 中无 key 路径 ${keyPath.join('.')}`,
          })
        }
      }
    })
  }

  return missing
}

/** 去重 (同 file+line+key 只报一次) */
function dedupe(items: MissingKey[]): MissingKey[] {
  const seen = new Set<string>()
  const out: MissingKey[] = []
  for (const m of items) {
    const k = `${m.file}:${m.line}:${m.key}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(m)
  }
  return out
}

function main(): void {
  console.log('\n🔐 i18n key 存在性检查 (CI 守门)')
  console.log('━'.repeat(60))
  console.log(`基准: modules/zh-CN/*.json`)
  console.log(`扫描目录: ${SOURCE_DIRS.filter(fs.existsSync).map((p) => path.relative(CLIENT_ROOT, p)).join(', ')}`)
  console.log(`阈值: ${THRESHOLD} (0 = 严格)`)
  console.log()

  if (!fs.existsSync(ZH_CN_DIR)) {
    console.error(`❌ modules/zh-CN 目录不存在: ${ZH_CN_DIR}`)
    process.exit(1)
  }

  const missing = dedupe(check())

  // 按模块名分组统计
  const byModule = new Map<string, number>()
  const byReason = { module_not_found: 0, key_not_found: 0 }
  for (const m of missing) {
    const modName = m.key.split('.')[0]
    byModule.set(modName, (byModule.get(modName) || 0) + 1)
    byReason[m.reason]++
  }

  console.log('📊 缺失统计:')
  console.log(`  总缺失: ${missing.length} 处`)
  console.log(`  - 模块文件不存在: ${byReason.module_not_found} 处`)
  console.log(`  - key 路径不存在: ${byReason.key_not_found} 处`)

  if (byModule.size > 0) {
    console.log('\n📋 按模块分组 (前 20):')
    const sorted = Array.from(byModule.entries()).sort((a, b) => b[1] - a[1])
    for (const [mod, count] of sorted.slice(0, 20)) {
      console.log(`  ${mod.padEnd(30)} ${count} 处`)
    }
    if (sorted.length > 20) {
      console.log(`  ... 还有 ${sorted.length - 20} 个模块`)
    }
  }

  if (missing.length > 0) {
    console.log('\n🔍 缺失明细 (前 30):')
    for (const m of missing.slice(0, 30)) {
      const rel = path.relative(CLIENT_ROOT, m.file)
      console.log(`  ${rel}:${m.line}  t('${m.key}')  [${m.reason}] ${m.detail}`)
    }
    if (missing.length > 30) {
      console.log(`  ... 还有 ${missing.length - 30} 处`)
    }
  }

  console.log('\n' + '━'.repeat(60))

  // dump 全部明细到 JSON (供分析用)
  if (dumpFile) {
    const dumpPath = path.isAbsolute(dumpFile) ? dumpFile : path.join(CLIENT_ROOT, dumpFile)
    fs.writeFileSync(dumpPath, JSON.stringify(missing, null, 2) + '\n', 'utf-8')
    console.log(`📁 全部明细已 dump: ${path.relative(CLIENT_ROOT, dumpPath)} (${missing.length} 条)`)
  }

  if (missing.length <= THRESHOLD) {
    console.log(`✅ i18n key 检查通过 (缺失 ${missing.length} ≤ 阈值 ${THRESHOLD})`)
    process.exit(0)
  } else {
    console.log(`❌ i18n key 检查未通过 (缺失 ${missing.length} > 阈值 ${THRESHOLD})`)
    console.log(`   修复方法: 在对应 modules/zh-CN/{moduleName}.json 中补充缺失的 key`)
    console.log(`   或运行: npm run i18n:sync  (从顶层 {locale}.json 同步缺失 key 到 modules)`)
    process.exit(1)
  }
}

main()
