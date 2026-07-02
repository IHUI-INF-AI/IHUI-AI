/**
 * i18n 翻译质量门 (2026-07-02 立, P2-1)
 *
 * 作用: 治理 modules/{en,zh-TW,ja,ko}/*.json 中"用 zh-CN 兜底"的历史遗留问题。
 *       既不丢功能 (CI 不阻塞), 又给人工/机翻提供可操作的工作流。
 *
 * 行为 (按严格度递增):
 *   - 默认 (report 模式): 仅输出统计 + 导出 CSV/JSON 待办, 不写任何文件
 *   - --apply --translations=<file>: 读取翻译文件, 把译文写回对应 module 文件
 *   - --inline '<locale>:<key>=<value>;...': 命令行直接打补丁 (小批量快速修复)
 *   - --dictionary: 内置 BRAND/产品名/SKU 词典, 命中则自动用 zh-CN 原文 (视为不可翻译)
 *   - --module=core,msg: 只处理指定 module (默认全部)
 *   - --locale=en,ja: 只处理指定 locale (默认全部 4 个非 zh-CN)
 *   - --min-length=2: 过滤掉长度 < N 的 token (默认 1, 即只跳过空串)
 *
 * 数据规模 (2026-07-02 实测):
 *   扫描 11,616 处 zh-CN 兜底, 559 module, 集中于:
 *     text: 1456, core: 1301, hardcoded: 1157, openclaw: 763, data: 587
 *
 * 用法:
 *   node scripts/fix-i18n-translate.cjs                          # 全量报告 + 导出待办
 *   node scripts/fix-i18n-translate.cjs --locale=en --module=core # 只看 en/core
 *   node scripts/fix-i18n-translate.cjs --apply --translations=./i18n-translate-pending.json
 *   node scripts/fix-i18n-translate.cjs --inline 'en:common.ok=OK;ja:common.ok=OK'
 *
 * 翻译文件 schema (JSON, 与导出格式一致):
 *   {
 *     "en": { "core.title": "Smart AI Platform", "core.tagline": "..." },
 *     "ja": { "core.title": "スマートAI", ... },
 *     "ko": { ... },
 *     "zh-TW": { ... }
 *   }
 *   路径 key 形如 "<moduleName>.<key.path.in.module>" (与 i18n-zhcn-fallback.json 一致)
 *
 * 守门配合:
 *   - 配合 check-i18n-zhcn-fallback.ts, 在 PR 描述里贴 hit 数对账
 *   - pre-commit 钩子仍只跑 key 存在性 (check:i18n:keys), 此脚本不阻塞
 *   - 当 hit 数低于阈值时 (例如 100), 可加 I18N_FAIL_FALLBACK_COUNT=100 让 CI 失败
 */

const fs = require('fs')
const path = require('path')

const CLIENT_ROOT = path.join(__dirname, '..')
const MODULES_DIR = path.join(CLIENT_ROOT, 'src', 'locales', 'modules')
const BASELINE_LOCALE = 'zh-CN'
const NON_BASELINE_LOCALES = ['en', 'zh-TW', 'ja', 'ko']
const ALL_LOCALES = [BASELINE_LOCALE, ...NON_BASELINE_LOCALES]

// ─── 解析 CLI 参数 ─────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function getArg(name, defaultValue = null) {
  const arg = args.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=').slice(1).join('=') : defaultValue
}
function hasFlag(name) {
  return args.includes(`--${name}`)
}
const APPLY_MODE = hasFlag('apply')
const DICT_MODE = hasFlag('dictionary')
const TARGET_LOCALES = getArg('locale')
  ? getArg('locale').split(',').filter((l) => ALL_LOCALES.includes(l))
  : NON_BASELINE_LOCALES
const TARGET_MODULES = getArg('module')
  ? getArg('module').split(',').filter(Boolean)
  : null
const MIN_LENGTH = parseInt(getArg('min-length', '1'), 10)
const TRANSLATIONS_FILE = getArg('translations')
const INLINE = getArg('inline')

// ─── 内置词典 (2026-07-02 立) ──────────────────────────────────────────────
// 这些 token 是品牌/产品名/SKU/技术术语, 任何语言都不翻译, 视为"不可翻译"
// 添加新条目: 直接在本对象中追加, 保持 key=value 风格
const BRAND_DICT = {
  // 平台 / 品牌
  '智汇AI': '智汇AI',
  'iHui AI': 'iHui AI',
  'iHui': 'iHui',
  'IHUI': 'IHUI',
  'IHUI-AI': 'IHUI-AI',
  'AI': 'AI',
  // 技术术语 (业内通用)
  'API': 'API',
  'SDK': 'SDK',
  'JSON': 'JSON',
  'JWT': 'JWT',
  'URL': 'URL',
  'URI': 'URI',
  'HTTP': 'HTTP',
  'HTTPS': 'HTTPS',
  'WebSocket': 'WebSocket',
  'WebRTC': 'WebRTC',
  'OAuth': 'OAuth',
  'OAuth2': 'OAuth2',
  'OpenAI': 'OpenAI',
  'GPT': 'GPT',
  'GPT-4': 'GPT-4',
  'GPT-3.5': 'GPT-3.5',
  'Claude': 'Claude',
  'Gemini': 'Gemini',
  'DeepL': 'DeepL',
  'Vue': 'Vue',
  'Vue3': 'Vue3',
  'TypeScript': 'TypeScript',
  'JavaScript': 'JavaScript',
  'SCSS': 'SCSS',
  'CSS': 'CSS',
  'HTML': 'HTML',
  'JSX': 'JSX',
  'TSX': 'TSX',
  'Node.js': 'Node.js',
  'npm': 'npm',
  'pnpm': 'pnpm',
  'GitHub': 'GitHub',
  'VSCode': 'VSCode',
  // 公司名
  '吉林省爱智汇人工智能科技有限公司': '吉林省爱智汇人工智能科技有限公司',
  // UI 元素 (单字符/图标, 不译)
  '×': '×',
  '✓': '✓',
  '✗': '✗',
  '·': '·',
  '…': '…',
  '—': '—',
  '–': '–',
  '°': '°',
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────
function readJSON(p) {
  if (!fs.existsSync(p)) return null
  try {
    let raw = fs.readFileSync(p, 'utf-8')
    // 历史双 BOM 兼容 (2026-07-02 fix)
    while (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
}

function flattenValues(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenValues(v, key))
    } else {
      out.push([key, String(v ?? '')])
    }
  }
  return out
}

function setNestedValue(obj, segs, value) {
  let cur = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]
    if (!(s in cur) || typeof cur[s] !== 'object' || cur[s] === null || Array.isArray(cur[s])) {
      cur[s] = {}
    }
    cur = cur[s]
  }
  cur[segs[segs.length - 1]] = value
}

function hasChinese(s) {
  return /[一-鿿]/.test(s)
}

function isTranslatable(s) {
  if (!s) return false
  if (!hasChinese(s)) return false
  const stripped = s.replace(/[\p{P}\p{S}\s\d]/gu, '')
  return stripped.length > 0
}

function escapeCsv(s) {
  if (s == null) return ''
  const str = String(s)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ─── 主流程 ────────────────────────────────────────────────────────────────
function collectAllModules() {
  const set = new Set()
  for (const loc of ALL_LOCALES) {
    const dir = path.join(MODULES_DIR, loc)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) set.add(f.replace('.json', ''))
    }
  }
  return Array.from(set).sort()
}

function scanFallbacks() {
  // 返回: [{ module, keyPath, locale, value, zhCnValue, length, dictHit }]
  const hits = []
  const allModules = collectAllModules()
  const filtered = TARGET_MODULES ? allModules.filter((m) => TARGET_MODULES.includes(m)) : allModules

  for (const moduleName of filtered) {
    const zhCn = readJSON(path.join(MODULES_DIR, BASELINE_LOCALE, `${moduleName}.json`))
    if (!zhCn) continue
    const zhCnValues = new Map(flattenValues(zhCn))

    for (const loc of TARGET_LOCALES) {
      const data = readJSON(path.join(MODULES_DIR, loc, `${moduleName}.json`))
      if (!data) continue
      const values = flattenValues(data)

      for (const [keyPath, value] of values) {
        const zhCnValue = zhCnValues.get(keyPath)
        if (zhCnValue === undefined) continue
        if (!isTranslatable(zhCnValue)) continue
        if (value !== zhCnValue) continue
        if (zhCnValue.length < MIN_LENGTH) continue
        const dictHit = DICT_MODE && Object.prototype.hasOwnProperty.call(BRAND_DICT, zhCnValue)
        hits.push({
          module: moduleName,
          keyPath,
          locale: loc,
          value,
          zhCnValue,
          length: zhCnValue.length,
          dictHit,
        })
      }
    }
  }
  return hits
}

function groupByModule(hits) {
  const grouped = new Map()
  for (const h of hits) {
    if (!grouped.has(h.module)) grouped.set(h.module, [])
    grouped.get(h.module).push(h)
  }
  return grouped
}

function exportPending(hits) {
  // 1. JSON: 路径 key = "<moduleName>.<keyPath>", 按 locale 拆分
  const pending = {}
  for (const loc of NON_BASELINE_LOCALES) pending[loc] = {}
  for (const h of hits) {
    if (h.dictHit) continue // 词典命中, 不需要翻译
    const pathKey = `${h.module}.${h.keyPath}`
    if (!pending[h.locale][pathKey]) {
      pending[h.locale][pathKey] = h.zhCnValue // 占位, 待翻译
    }
  }
  const jsonFile = path.join(CLIENT_ROOT, 'i18n-translate-pending.json')
  writeJSON(jsonFile, pending)
  return jsonFile
}

function exportCsv(hits) {
  // CSV 列: module, keyPath, locale, zhCnValue, length, dictHit
  const csvFile = path.join(CLIENT_ROOT, 'i18n-translate-pending.csv')
  const lines = ['module,keyPath,locale,zhCnValue,length,dictHit,need_translate']
  for (const h of hits) {
    const need = h.dictHit ? 'no' : 'yes'
    lines.push(
      [
        escapeCsv(h.module),
        escapeCsv(h.keyPath),
        escapeCsv(h.locale),
        escapeCsv(h.zhCnValue),
        h.length,
        h.dictHit,
        need,
      ].join(','),
    )
  }
  fs.writeFileSync(csvFile, lines.join('\n') + '\n', 'utf-8')
  return csvFile
}

function applyTranslations(translations, hits) {
  // translations: { en: { module.key: value }, ... }
  // hits: 用于建立命中索引, 跳过不在 pending 里的 key
  const hitIndex = new Set()
  for (const h of hits) {
    if (h.dictHit) continue
    hitIndex.add(`${h.locale}::${h.module}.${h.keyPath}`)
  }

  let updatedFiles = 0
  let updatedKeys = 0
  const errors = []
  const fileBackups = new Map() // path -> original

  for (const [loc, kvs] of Object.entries(translations)) {
    if (!NON_BASELINE_LOCALES.includes(loc)) {
      errors.push(`跳过非法 locale: ${loc}`)
      continue
    }
    if (!kvs || typeof kvs !== 'object') continue

    // 按 module 分组
    const byModule = new Map()
    for (const [pathKey, value] of Object.entries(kvs)) {
      const dotIdx = pathKey.indexOf('.')
      if (dotIdx < 0) {
        errors.push(`跳过非法 key 格式: ${loc}::${pathKey} (缺少 module 前缀)`)
        continue
      }
      const moduleName = pathKey.slice(0, dotIdx)
      const rest = pathKey.slice(dotIdx + 1)
      if (!hitIndex.has(`${loc}::${pathKey}`)) {
        // 这个 key 不在 pending 里, 可能是已翻译或拼写错, 跳过避免破坏已有翻译
        continue
      }
      if (!byModule.has(moduleName)) byModule.set(moduleName, [])
      byModule.get(moduleName).push({ keyPath: rest, value })
    }

    for (const [moduleName, updates] of byModule) {
      const filePath = path.join(MODULES_DIR, loc, `${moduleName}.json`)
      if (!fs.existsSync(filePath)) {
        errors.push(`模块文件不存在: ${filePath}`)
        continue
      }
      if (!fileBackups.has(filePath)) {
        const original = readJSON(filePath)
        fileBackups.set(filePath, original)
      }
      const obj = fileBackups.get(filePath)
      for (const { keyPath, value } of updates) {
        const segs = keyPath.split('.')
        setNestedValue(obj, segs, value)
        updatedKeys++
      }
      writeJSON(filePath, obj)
      updatedFiles++
    }
  }

  return { updatedFiles, updatedKeys, errors }
}

function applyInline(inline) {
  // 格式: "en:common.ok=OK;ja:common.ok=OK;ko:common.ok=확인"
  const updates = {}
  for (const seg of inline.split(';')) {
    const m = seg.match(/^([a-zA-Z-]+):([^=]+)=(.+)$/)
    if (!m) continue
    const [, loc, keyPath, value] = m
    if (!NON_BASELINE_LOCALES.includes(loc)) continue
    if (!updates[loc]) updates[loc] = {}
    updates[loc][keyPath.trim()] = value
  }
  return updates
}

function main() {
  console.log('\n🌐 i18n 翻译质量门 (2026-07-02)')
  console.log('━'.repeat(60))
  console.log(`模式: ${APPLY_MODE ? 'APPLY (会写文件)' : 'REPORT (只读)'}`)
  console.log(`目标 locale: ${TARGET_LOCALES.join(', ')}`)
  console.log(`目标 module: ${TARGET_MODULES ? TARGET_MODULES.join(', ') : '全部'}`)
  console.log(`词典模式: ${DICT_MODE ? '启用 (BRAND_DICT 命中视为不可翻译)' : '禁用'}`)
  console.log(`最小长度过滤: ${MIN_LENGTH}`)
  console.log()

  if (!fs.existsSync(MODULES_DIR)) {
    console.error(`❌ modules 目录不存在: ${MODULES_DIR}`)
    process.exit(1)
  }

  // 1. 扫描
  const hits = scanFallbacks()
  const effectiveHits = DICT_MODE ? hits.filter((h) => !h.dictHit) : hits
  const dictHits = DICT_MODE ? hits.filter((h) => h.dictHit) : []

  console.log(`📊 扫描结果:`)
  console.log(`  总命中: ${hits.length} 处`)
  console.log(`  - 需翻译: ${effectiveHits.length} 处`)
  console.log(`  - 词典免译: ${dictHits.length} 处`)
  console.log()

  // 2. 按 locale 统计
  const byLocale = new Map(NON_BASELINE_LOCALES.map((l) => [l, 0]))
  for (const h of effectiveHits) byLocale.set(h.locale, (byLocale.get(h.locale) || 0) + 1)
  console.log(`  按 locale (需翻译):`)
  for (const [loc, count] of byLocale) {
    const total = hits.filter((h) => h.locale === loc).length
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
    console.log(`    ${loc.padEnd(8)} ${count} / ${total} (${pct}%)`)
  }
  console.log()

  // 3. 按 module 统计 (前 20)
  const grouped = groupByModule(effectiveHits)
  const allGrouped = groupByModule(hits)
  console.log(`  按 module (前 20, 需翻译):`)
  const sorted = Array.from(grouped.entries()).sort((a, b) => b[1].length - a[1].length).slice(0, 20)
  for (const [mod, arr] of sorted) {
    const total = allGrouped.get(mod)?.length || 0
    console.log(`    ${mod.padEnd(30)} ${arr.length} / ${total} 处`)
  }
  if (grouped.size > 20) {
    console.log(`    ... 还有 ${grouped.size - 20} 个 module`)
  }
  console.log()

  // 4. 导出待办
  if (effectiveHits.length > 0) {
    const jsonFile = exportPending(effectiveHits)
    const csvFile = exportCsv(effectiveHits)
    console.log(`📁 待办文件已导出:`)
    console.log(`  - JSON: ${path.relative(CLIENT_ROOT, jsonFile)} (供机翻 API 消费)`)
    console.log(`  - CSV:  ${path.relative(CLIENT_ROOT, csvFile)} (供人工在 Excel 里翻译)`)
    console.log()
    console.log(`💡 翻译完成后, 用 --apply 写回:`)
    console.log(`  node scripts/fix-i18n-translate.cjs --apply --translations=./i18n-translate-pending.json`)
    console.log()
  }

  // 5. APPLY 模式
  if (APPLY_MODE) {
    let translations = null
    if (TRANSLATIONS_FILE) {
      translations = readJSON(TRANSLATIONS_FILE)
      if (!translations) {
        console.error(`❌ 翻译文件无法解析: ${TRANSLATIONS_FILE}`)
        process.exit(1)
      }
    } else if (INLINE) {
      translations = applyInline(INLINE)
    } else {
      console.error(`❌ --apply 必须配合 --translations=<file> 或 --inline '<...>'`)
      process.exit(1)
    }
    const { updatedFiles, updatedKeys, errors } = applyTranslations(translations, effectiveHits)
    console.log(`\n📝 APPLY 结果:`)
    console.log(`  修改文件: ${updatedFiles} 个`)
    console.log(`  更新 key: ${updatedKeys} 个`)
    if (errors.length > 0) {
      console.log(`  ⚠️  错误 (${errors.length}):`)
      for (const e of errors) console.log(`    - ${e}`)
    }
  }

  console.log('\n' + '━'.repeat(60))
  console.log(`✅ 完成 (${effectiveHits.length} 处待翻译${dictHits.length > 0 ? `, ${dictHits.length} 处词典免译` : ''})`)
  process.exit(0)
}

main()
