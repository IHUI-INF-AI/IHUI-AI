/**
 * i18n 同步工具 (永久维护脚本)
 *
 * 作用: 把翻译源同步到 modules/{locale}/*.json
 *       只补充 modules 中缺失的 key, 不覆盖已有值
 *
 * 数据源 (按优先级):
 *   1. src/locales/full/{locale}/*.json  (按模块拆分的全量包, 最完整)
 *   2. src/locales/{locale}.json         (顶层全量包, 作为补充)
 *
 * 背景:
 *   - full/{locale}/ 是历史全量翻译包, 按模块拆分 (每个文件可含多个顶层 key)
 *   - 顶层 {locale}.json 是另一个历史全量包 (合并所有模块在一个文件)
 *   - i18n 实际从 modules/{locale}/*.json 加载 (按需/路由触发)
 *   - 当源码新增 t('xxx.yyy') 调用但 modules 里没有时, 会键名裸露
 *   - 本脚本从源同步缺失 key 到 modules, 一键修复
 *
 * 用法:
 *   node scripts/sync-i18n.cjs              # 同步所有语言
 *   node scripts/sync-i18n.cjs --locale=zh-CN  # 只同步 zh-CN
 *   node scripts/sync-i18n.cjs --dry-run    # 试运行 (不写文件)
 *
 * 约定:
 *   - modules 文件结构: { "moduleName": { ... } } (顶层 key 必须与文件名一致)
 *   - full 文件可能含多个顶层 key (如 my.json 含 my + memberMenu)
 *   - 每个 topKey 对应一个 modules/{locale}/{topKey}.json 文件
 *   - 大小写敏感 (Linux CI 兼容)
 */

const fs = require('fs')
const path = require('path')

const CLIENT_ROOT = path.join(__dirname, '..')
const LOCALES_DIR = path.join(CLIENT_ROOT, 'src', 'locales')
const MODULES_DIR = path.join(LOCALES_DIR, 'modules')
const FULL_DIR = path.join(LOCALES_DIR, 'full')
const ALL_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']

// 解析命令行参数
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const localeArg = args.find((a) => a.startsWith('--locale='))
const locales = localeArg ? [localeArg.split('=')[1]] : ALL_LOCALES

const stats = {
  filesCreated: 0,
  filesUpdated: 0,
  keysAdded: 0,
  errors: [],
}

function log(msg) {
  console.log(msg)
}

/** 深度合并: 把 source 的 key 补充到 target (只补充 target 里没有的, 不覆盖) */
function mergeMissing(target, source) {
  let added = 0
  for (const [k, v] of Object.entries(source)) {
    if (target[k] === undefined) {
      target[k] = v
      added++
    } else if (
      typeof target[k] === 'object' &&
      target[k] !== null &&
      !Array.isArray(target[k]) &&
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v)
    ) {
      added += mergeMissing(target[k], v)
    }
    // 否则: target 已有非空值, 不覆盖
  }
  return added
}

/** 读取 JSON (容错) */
function readJSON(p) {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch (e) {
    return null
  }
}

/** 写 JSON (统一格式: 2 空格缩进 + 末尾换行) */
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
}

/** 计算叶子节点数 */
function countLeafKeys(obj) {
  if (obj === null || obj === undefined) return 0
  if (typeof obj !== 'object') return 1
  if (Array.isArray(obj)) return obj.length
  let n = 0
  for (const v of Object.values(obj)) {
    n += countLeafKeys(v)
  }
  return n
}

/** 把一个顶层 key 同步到 modules 文件
 * @param locale 语言
 * @param topKey 顶层 key (如 memberMenu)
 * @param topValue 顶层 key 的值
 */
function syncTopKey(locale, topKey, topValue) {
  const modDir = path.join(MODULES_DIR, locale)
  const modFile = path.join(modDir, `${topKey}.json`)

  if (!fs.existsSync(modDir)) {
    if (!dryRun) fs.mkdirSync(modDir, { recursive: true })
  }

  if (!fs.existsSync(modFile)) {
    // 创建新文件
    const expectedContent = { [topKey]: topValue }
    if (!dryRun) writeJSON(modFile, expectedContent)
    stats.filesCreated++
    stats.keysAdded += countLeafKeys(topValue)
    log(`    [create] ${locale}/${topKey}.json (${countLeafKeys(topValue)} keys)`)
    return
  }

  // 合并到现有文件
  const existing = readJSON(modFile)
  if (!existing) {
    stats.errors.push(`parse fail: ${modFile}`)
    return
  }

  // 如果 existing 顶层没有 topKey, 补上
  if (!Object.prototype.hasOwnProperty.call(existing, topKey)) {
    existing[topKey] = topValue
    if (!dryRun) writeJSON(modFile, existing)
    stats.filesUpdated++
    stats.keysAdded += countLeafKeys(topValue)
    log(`    [update] ${locale}/${topKey}.json: 补顶层 key ${topKey} (${countLeafKeys(topValue)} keys)`)
    return
  }

  // 深度合并
  const before = countLeafKeys(existing)
  const merged = JSON.parse(JSON.stringify(existing)) // 深拷贝
  const added = mergeMissing(merged[topKey], topValue)
  if (added > 0) {
    if (!dryRun) writeJSON(modFile, merged)
    stats.filesUpdated++
    stats.keysAdded += added
    log(`    [update] ${locale}/${topKey}.json: +${added} keys (${before} → ${before + added})`)
  }
}

/** 从 full/{locale}/ 目录同步 (优先源) */
function syncFromFull(locale) {
  const fullLocaleDir = path.join(FULL_DIR, locale)
  if (!fs.existsSync(fullLocaleDir)) {
    log(`  [skip] full/${locale}/ 目录不存在`)
    return
  }

  const files = fs.readdirSync(fullLocaleDir).filter((f) => f.endsWith('.json'))
  log(`  源1: full/${locale}/ (${files.length} 个文件)`)

  for (const file of files) {
    const filePath = path.join(fullLocaleDir, file)
    const obj = readJSON(filePath)
    if (!obj) {
      stats.errors.push(`parse fail: ${filePath}`)
      continue
    }

    // 每个文件可能含多个顶层 key
    const topKeys = Object.keys(obj)
    for (const topKey of topKeys) {
      syncTopKey(locale, topKey, obj[topKey])
    }
  }
}

/** 从顶层 {locale}.json 同步 (补充源) */
function syncFromTop(locale) {
  const topFile = path.join(LOCALES_DIR, `${locale}.json`)
  if (!fs.existsSync(topFile)) {
    log(`  [skip] 顶层 ${locale}.json 不存在`)
    return
  }

  const topObj = readJSON(topFile)
  if (!topObj) {
    stats.errors.push(`parse fail: ${topFile}`)
    return
  }

  const topKeys = Object.keys(topObj)
  log(`  源2: ${locale}.json (${topKeys.length} 个顶层 key)`)

  for (const topKey of topKeys) {
    syncTopKey(locale, topKey, topObj[topKey])
  }
}

/** 同步单个语言 */
function syncLocale(locale) {
  if (!fs.existsSync(MODULES_DIR)) {
    fs.mkdirSync(MODULES_DIR, { recursive: true })
  }

  // 源1: full/{locale}/ (更完整)
  syncFromFull(locale)

  // 源2: 顶层 {locale}.json (补充)
  syncFromTop(locale)
}

// === 执行 ===
log('=== i18n 同步工具 ===')
log(`模式: ${dryRun ? '试运行 (不写文件)' : '正式 (写文件)'}`)
log(`语言: ${locales.join(', ')}`)
log('')

for (const locale of locales) {
  log(`\n[${locale}]`)
  syncLocale(locale)
}

log('\n=== 统计 ===')
log(`文件创建: ${stats.filesCreated}`)
log(`文件更新: ${stats.filesUpdated}`)
log(`key 补充: ${stats.keysAdded}`)
if (stats.errors.length > 0) {
  log(`错误: ${stats.errors.length}`)
  stats.errors.forEach((e) => log(`  - ${e}`))
}
log('\n=== 完成 ===')
if (!dryRun && stats.keysAdded > 0) {
  log('提示: 运行 npm run check:i18n:keys 验证 key 存在性')
}
