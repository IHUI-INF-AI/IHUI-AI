#!/usr/bin/env node
/**
 * 阶段 5: i18n key content-level 比对
 *
 * 比对 D:\历史项目存档\ 下 Java+Vue 项目 i18n key vs 当前 IHUI-AI 仓库 apps/web/messages/zh-CN.json
 * 输出 4 类对照表 CSV: 已迁移 / 部分迁移 / 缺失 / 无需迁移
 *
 * D 盘扫描范围:
 *   - .properties 文件 (Java messages_*.properties)
 *   - messages/ 下的 .json
 *   - locale/ 下的 .json 和 .ts (Vue+TS)
 *   - i18n/ 下的 .json 和 .ts
 *   - lang/ 下的 .json 和 .ts
 *
 * 用法: node scripts/audit-migration-i18n.mjs
 * 输出: reports/migration-audit-i18n-{timestamp}.csv
 *       reports/migration-audit-i18n-summary.json
 */
import fs from 'node:fs'
import path from 'node:path'

// ─── 配置 ───────────────────────────────────────────────────────────
const LEGACY_ROOTS = [
  'D:\\历史项目存档\\edu server',
  'D:\\历史项目存档\\code',
  'D:\\历史项目存档\\edu client',
  'D:\\历史项目存档\\ljd-交接文件',
  'D:\\历史项目存档\\ihui-ai-admin-frontend',
  'D:\\历史项目存档\\zhs_app-ZZ',
]

const NEW_ZH_CN = 'g:\\IHUI-AI\\apps\\web\\messages\\zh-CN.json'

// 业务模块关键词清单(用于业务模块匹配,按优先级排序)
const BUSINESS_KEYWORDS = [
  'user', 'login', 'register', 'password', 'home', 'dashboard', 'save',
  'cancel', 'confirm', 'delete', 'edit', 'add', 'list', 'search',
  'loading', 'error', 'success', 'warning', 'info', 'yes', 'no',
  'action', 'status', 'role', 'menu', 'dept', 'post', 'notice',
  'dict', 'config', 'permission', 'profile', 'avatar', 'logout',
  'upload', 'download', 'export', 'import', 'submit', 'reset',
  'back', 'close', 'refresh', 'view', 'detail', 'operation',
  'create', 'update', 'modify', 'remove', 'select', 'filter',
  'sort', 'order', 'pay', 'course', 'article', 'ai', 'chat',
  'model', 'agent', 'market', 'admin', 'file', 'message',
  'notification', 'category', 'tag', 'comment', 'stat', 'live',
  'exam', 'learn', 'topic', 'ask', 'resource', 'point', 'member',
  'video', 'setting', 'system', 'news', 'contact', 'storage',
  'about', 'coze', 'mcp', 'developer', 'agreement', 'invoice',
  'commission', 'distribution', 'product', 'identity', 'activity',
  'withdrawal', 'version', 'feedback', 'site', 'remote', 'device',
  'audit', 'fund', 'finance', 'billing', 'wallet', 'plaza', 'rank',
  'ranking', 'token', 'visit', 'wechat', 'oauth', 'lecturer',
  'statistics', 'usercenter', 'remind', 'plan', 'material',
  'class', 'schedule', 'monitor', 'telemetry', 'i18n', 'rbac',
  'n8n', 'outbound', 'packages', 'pricing', 'promotions', 'push',
  'report', 'service', 'platform', 'templates', 'knowledge', 'rag',
  'llm', 'vendor', 'feed', 'generation', 'image', 'audio', 'video',
  'callback', 'stream', 'education', 'workflow', 'workspace',
  'team', 'organization', 'tenant', 'share', 'social', 'group',
  'community', 'circle', 'recommendation', 'mobile', 'advertise',
  'faq', 'carousel', 'announcement', 'checkin', 'gamification',
  'refund', 'webhook', 'sdks', 'tools', 'transcode', 'monitor',
  'drama', 'stock', 'trader', 'tbox', 'gdpr', 'customer',
  'banner', 'popup', 'modal', 'drawer', 'table', 'form', 'button',
  'navbar', 'header', 'sidebar', 'footer', 'breadcrumb', 'pagination',
  'tab', 'wizard', 'stepper', 'toast', 'skeleton', 'empty', 'validation',
  'rule', 'enum', 'placeholder', 'label', 'tip', 'tooltip', 'popover',
  'dropdown', 'combobox', 'datepicker', 'timepicker', 'slider', 'switch',
  'radio', 'checkbox', 'toggle', 'badge', 'chip', 'avatar', 'icon',
  'image-upload', 'file-upload', 'rich-text', 'editor', 'preview',
  'print', 'scan', 'qr', 'barcode', 'signature', 'captcha',
  'verify', 'approval', 'process', 'flow', 'state', 'machine',
  'history', 'log', 'record', 'trace', 'debug', 'test', 'demo',
  'sample', 'example', 'template', 'snippet', 'module', 'plugin',
  'extension', 'addon', 'integration', 'connector', 'gateway',
  'proxy', 'bridge', 'adapter', 'wrapper', 'factory', 'builder',
  'singleton', 'observer', 'strategy', 'decorator', 'composite',
  'facade', 'mediator', 'memento', 'command', 'visitor', 'iterator',
]

// 命名空间前缀(归一化时去除,以便跨项目匹配)
const NAMESPACE_PREFIXES = [
  'common', 'nav', 'navbar', 'api', 'app', 'web', 'admin', 'client',
  'shared', 'global', 'general', 'main', 'page', 'pages', 'view',
  'views', 'component', 'components', 'ui', 'element', 'el', 'form',
  'table', 'list', 'button', 'message', 'dialog', 'modal',
]

// ─── 工具函数 ───────────────────────────────────────────────────────

/**
 * 递归扫描目录,返回所有匹配的 i18n 文件路径。
 * @param {string} root
 * @returns {string[]} 绝对路径列表
 */
function scanLegacyI18nFiles(root) {
  const results = []
  if (!fs.existsSync(root)) return results

  const stack = [root]
  const visited = new Set()
  while (stack.length > 0) {
    const dir = stack.pop()
    let stat
    try {
      stat = fs.statSync(dir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    if (visited.has(dir.toLowerCase())) continue
    visited.add(dir.toLowerCase())

    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      // 跳过常见无关目录
      const lowerName = entry.name.toLowerCase()
      if (entry.isDirectory()) {
        if (lowerName === 'node_modules' || lowerName === '.git' ||
            lowerName === 'target' || lowerName === 'dist' ||
            lowerName === 'build' || lowerName === '.idea' ||
            lowerName === '.vscode' || lowerName === '__macosx' ||
            lowerName === 'logs' || lowerName === '.mvn') {
          continue
        }
        stack.push(path.join(dir, entry.name))
      } else if (entry.isFile()) {
        if (isI18nFile(dir, entry.name)) {
          results.push(path.join(dir, entry.name))
        }
      }
    }
  }
  return results
}

/**
 * 判断是否为 i18n 文件。
 * 规则:
 *   - *.properties (Java messages_*.properties)
 *   - *.json 在 messages/locale/i18n/lang 目录下
 *   - *.ts 在 locale/lang 目录下(且文件名是语言代码)
 *   - 文件名是语言代码(en/zh-CN/zh-CN/ja/ko/zh-TW)或 messages_xx_XX 形式
 */
function isI18nFile(dir, fileName) {
  const lower = fileName.toLowerCase()
  const parent = path.basename(dir).toLowerCase()
  const langCodes = ['en', 'zh', 'zh-cn', 'zh-tw', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'ar', 'pt']

  // 1. .properties 文件
  if (lower.endsWith('.properties')) {
    // messages*.properties 或 *_zh_CN.properties 等
    if (lower.startsWith('messages') ||
        /[_-](en|zh|cn|tw|ja|ko|fr|de|es|ru|ar|pt)([_-][a-z]{2})?\.properties$/.test(lower)) {
      return true
    }
    return false
  }

  // 2. .json 文件
  if (lower.endsWith('.json')) {
    // 在 messages/locale/i18n/lang 目录下
    if (['messages', 'locale', 'locales', 'i18n', 'lang', 'langs', 'language', 'languages'].includes(parent)) {
      return true
    }
    // 文件名是语言代码
    const baseName = lower.replace(/\.json$/, '')
    if (langCodes.includes(baseName)) return true
    if (/^messages?[_-]/.test(baseName)) return true
    if (/[_-](en|zh|cn|tw|ja|ko)([_-][a-z]{2})?$/.test(baseName)) return true
    return false
  }

  // 3. .ts 文件在 locale/lang 目录下且文件名是语言代码(Vue+TS i18n)
  if (lower.endsWith('.ts')) {
    if (['locale', 'locales', 'lang', 'langs', 'language', 'languages', 'i18n'].includes(parent)) {
      const baseName = lower.replace(/\.ts$/, '')
      if (langCodes.includes(baseName)) return true
    }
    return false
  }

  return false
}

/**
 * 解析 .properties 文件,提取 key 集合(扁平 key,用 . 拼接)。
 * 格式:
 *   key1=value1
 *   key2.subkey=value2
 *   # 注释
 */
function parsePropertiesFile(filePath) {
  const keys = []
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    const eqIdx = trimmed.indexOf('=')
    const colonIdx = trimmed.indexOf(':')
    let sepIdx = -1
    if (eqIdx >= 0 && colonIdx >= 0) sepIdx = Math.min(eqIdx, colonIdx)
    else if (eqIdx >= 0) sepIdx = eqIdx
    else sepIdx = colonIdx
    if (sepIdx <= 0) continue
    const key = trimmed.slice(0, sepIdx).trim()
    if (!key) continue
    keys.push(key)
  }
  return keys
}

/**
 * 解析 JSON 文件,提取嵌套 key(用 . 拼接)。
 * 容错:JSON.parse 失败时返回空数组(避免重复 key 导致脚本崩溃)。
 */
function parseJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const obj = JSON.parse(content)
    return extractKeysFromObject(obj, '')
  } catch (e) {
    // 重复 key 时 JSON.parse 仍会成功(取最后值),但 PowerShell 会失败;Node 没问题
    // 其他解析错误:返回空
    return []
  }
}

/**
 * 解析 TS i18n 文件(Vue+TS 项目 `export default {...}` 格式)。
 * 用正则提取所有 `key:` 形式的字段名,并根据缩进推断层级。
 * 这是简化方案 - 不执行 TS 代码,只静态分析。
 */
function parseTsFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')

  // 提取 `export default {` 到最后一个 `}` 之间的内容
  const exportMatch = content.match(/export\s+default\s*\{([\s\S]*)\}\s*;?\s*$/)
  if (!exportMatch) return []

  const body = exportMatch[1]
  const keys = []

  // 用栈解析嵌套对象,记录路径
  // 简化策略:逐字符扫描,遇到 `key:` 时记为字段名,遇到 `{` 入栈,遇到 `}` 出栈
  // 跳过字符串字面量和注释
  // 初始化 path = [null] 表示外层对象占位(因为 body 已剥掉 export default { 的外层 {)
  const path = [null]
  let i = 0
  const len = body.length

  while (i < len) {
    const ch = body[i]

    // 跳过单行注释
    if (ch === '/' && body[i + 1] === '/') {
      while (i < len && body[i] !== '\n') i++
      continue
    }
    // 跳过块注释
    if (ch === '/' && body[i + 1] === '*') {
      i += 2
      while (i < len && !(body[i] === '*' && body[i + 1] === '/')) i++
      i += 2
      continue
    }
    // 跳过字符串(单引号/双引号/反引号)
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      i++
      while (i < len) {
        if (body[i] === '\\') { i += 2; continue }
        if (body[i] === quote) { i++; break }
        i++
      }
      continue
    }

    // 进入对象
    if (ch === '{') {
      path.push(null) // 占位,后续会被字段名替换
      i++
      continue
    }
    // 退出对象
    if (ch === '}') {
      path.pop()
      i++
      continue
    }

    // 识别字段名:行首或逗号后的标识符 + :
    // 模式:可选空白 + (标识符或字符串) + 可选空白 + :
    if (ch === ',' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    // 尝试匹配字段名
    if (/[a-zA-Z_$]/.test(ch)) {
      // 读取标识符
      let j = i
      while (j < len && /[a-zA-Z0-9_$]/.test(body[j])) j++
      const ident = body.slice(i, j)

      // 跳过空白,看下一个非空字符
      let k = j
      while (k < len && /\s/.test(body[k])) k++

      // 可选冒号(对象字段) - 也可选方括号(计算属性,跳过)
      if (body[k] === ':') {
        // 这是字段名
        // 替换栈顶占位为字段名
        if (path.length > 0) {
          path[path.length - 1] = ident
          const fullKey = path.filter(Boolean).join('.')
          if (fullKey) keys.push(fullKey)
        }
        i = k + 1
        continue
      }

      // 关键字或值,跳过
      i = j
      continue
    }

    i++
  }

  return keys
}

/**
 * 递归提取对象所有 key(嵌套用 . 拼接)。
 */
function extractKeysFromObject(obj, prefix) {
  const keys = []
  if (obj === null || typeof obj !== 'object') return keys
  if (Array.isArray(obj)) {
    // 数组的 i18n 通常用 index 作 key,但多数情况数组元素是字符串不是 key
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i]
      if (v !== null && typeof v === 'object') {
        keys.push(...extractKeysFromObject(v, prefix ? `${prefix}.${i}` : String(i)))
      }
    }
    return keys
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') {
      keys.push(...extractKeysFromObject(v, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

/**
 * 解析 i18n 文件,根据扩展名分发。
 */
function parseI18nFile(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.properties')) return parsePropertiesFile(filePath)
  if (lower.endsWith('.json')) return parseJsonFile(filePath)
  if (lower.endsWith('.ts')) return parseTsFile(filePath)
  return []
}

// ─── key 归一化 ─────────────────────────────────────────────────────

/**
 * 驼峰转下划线:camelCase → camel_case
 */
function camelToSnake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase()
}

/**
 * 下划线转驼峰:snake_case → snakeCase
 */
function snakeToCamel(s) {
  return s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

/**
 * 归一化 key:
 *   - 全小写
 *   - 驼峰 ↔ 下划线 统一为下划线形式(便于比较)
 *   - 去除命名空间前缀(common. / nav. / api. 等)
 *   - 拆分为段数组
 *
 * 返回 { normalized: 'full.normalized.key', segments: ['full', 'normalized', 'key'] }
 */
function normalizeKey(key) {
  if (!key) return { normalized: '', segments: [] }

  // 拆分原始段(支持 . / _ - 作为分隔符)
  let segs = key.split(/[.]/)

  // 去除命名空间前缀(只去第一段)
  if (segs.length > 1 && NAMESPACE_PREFIXES.includes(segs[0].toLowerCase())) {
    segs = segs.slice(1)
  }

  // 每段:camelCase → snake_case,然后全小写
  const normalizedSegs = segs.map(s => {
    // 处理 camelCase(但不处理已经是 snake_case 的)
    let snake = camelToSnake(s)
    // 处理 PascalCase
    snake = snake.replace(/^-/, '')
    return snake.toLowerCase()
  })

  return {
    normalized: normalizedSegs.join('.'),
    segments: normalizedSegs,
  }
}

/**
 * 提取 key 的最后一段(后缀匹配用)。
 */
function getKeySuffix(key) {
  const segs = key.split(/[.]/)
  return segs[segs.length - 1].toLowerCase()
}

/**
 * 提取 key 的业务模块(第一段或去除命名空间后的第一段)。
 */
function getKeyModule(key) {
  const { segments } = normalizeKey(key)
  return segments[0] || ''
}

// ─── 匹配策略 ───────────────────────────────────────────────────────

/**
 * 匹配 D 盘 key 与当前仓库 key。
 * 优先级:精确匹配 > 后缀匹配 > 业务模块匹配
 *
 * 返回:
 *   - { status: '已迁移', matchedKeys: [...], reason: '...' }
 *   - { status: '部分迁移', matchedKeys: [...], reason: '...' }
 *   - { status: '缺失', matchedKeys: [], reason: '...' }
 */
function matchKey(legacyKey, newKeySet, newKeyNormalizedMap, newKeySuffixMap, newKeyModuleMap) {
  const { normalized: normLegacy, segments: legacySegs } = normalizeKey(legacyKey)

  // 1. 精确匹配:归一化后完全相同
  if (newKeyNormalizedMap.has(normLegacy)) {
    const matched = newKeyNormalizedMap.get(normLegacy)
    return {
      status: '已迁移',
      matchedKeys: matched.slice(0, 3),
      reason: `精确匹配: ${normLegacy}`,
    }
  }

  // 2. 后缀匹配:最后 1-2 段相同
  if (legacySegs.length >= 1) {
    const lastSeg = legacySegs[legacySegs.length - 1]
    if (lastSeg && lastSeg.length >= 3) { // 太短的段不参与后缀匹配
      const suffixMatches = newKeySuffixMap.get(lastSeg) || []
      if (suffixMatches.length > 0) {
        return {
          status: '部分迁移',
          matchedKeys: suffixMatches.slice(0, 3),
          reason: `后缀匹配: .${lastSeg}`,
        }
      }
    }
    // 末两段
    if (legacySegs.length >= 2) {
      const lastTwo = legacySegs.slice(-2).join('.')
      const twoMatches = newKeySuffixMap.get(lastTwo) || []
      if (twoMatches.length > 0) {
        return {
          status: '部分迁移',
          matchedKeys: twoMatches.slice(0, 3),
          reason: `后缀匹配: .${lastTwo}`,
        }
      }
    }
  }

  // 3. 业务模块关键词匹配
  const legacyModule = getKeyModule(legacyKey)
  if (legacyModule && BUSINESS_KEYWORDS.includes(legacyModule)) {
    const moduleMatches = newKeyModuleMap.get(legacyModule) || []
    if (moduleMatches.length > 0) {
      return {
        status: '部分迁移',
        matchedKeys: moduleMatches.slice(0, 3),
        reason: `业务模块匹配: ${legacyModule}`,
      }
    }
  }

  // 4. 缺失
  return {
    status: '缺失',
    matchedKeys: [],
    reason: `无匹配: ${legacyKey}`,
  }
}

/**
 * 反向匹配:当前仓库 key 是否在 D 盘有对应(用于"无需迁移"分类)
 */
function findMatchingLegacyKey(newKey, legacyKeyNormalizedMap, legacyKeySuffixMap, legacyKeyModuleMap) {
  const { normalized: normNew, segments: newSegs } = normalizeKey(newKey)

  // 1. 精确
  if (legacyKeyNormalizedMap.has(normNew)) {
    return { match: legacyKeyNormalizedMap.get(normNew)[0], type: 'exact' }
  }

  // 2. 后缀
  if (newSegs.length >= 1) {
    const lastSeg = newSegs[newSegs.length - 1]
    if (lastSeg && lastSeg.length >= 3) {
      const matches = legacyKeySuffixMap.get(lastSeg) || []
      if (matches.length > 0) return { match: matches[0], type: 'suffix' }
    }
  }

  // 3. 业务模块
  const newModule = getKeyModule(newKey)
  if (newModule && BUSINESS_KEYWORDS.includes(newModule)) {
    const matches = legacyKeyModuleMap.get(newModule) || []
    if (matches.length > 0) return { match: matches[0], type: 'module' }
  }
  return null
}

// ─── 主流程 ─────────────────────────────────────────────────────────
function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportsDir = path.resolve('reports')
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

  console.log('=== 阶段 5:i18n key content-level 比对 ===\n')

  // 1. 扫描 D 盘 i18n 文件
  console.log('扫描 D 盘 i18n 文件...')
  const legacyFiles = []
  for (const root of LEGACY_ROOTS) {
    if (!fs.existsSync(root)) {
      console.log(`  跳过(不存在): ${root}`)
      continue
    }
    console.log(`  扫描: ${root}`)
    const files = scanLegacyI18nFiles(root)
    console.log(`    找到 ${files.length} 个 i18n 文件`)
    legacyFiles.push(...files)
  }

  // 去重(按文件名 + 大小,避免相同文件的多个拷贝重复计算)
  const uniqueLegacyFiles = new Map()
  for (const f of legacyFiles) {
    try {
      const stat = fs.statSync(f)
      const baseName = path.basename(f).toLowerCase()
      const key = `${baseName}||${stat.size}`
      if (!uniqueLegacyFiles.has(key)) {
        uniqueLegacyFiles.set(key, f)
      }
    } catch {
      // ignore
    }
  }
  const dedupedLegacyFiles = Array.from(uniqueLegacyFiles.values())
  console.log(`\n  D 盘 i18n 文件总数(原始): ${legacyFiles.length}`)
  console.log(`  D 盘 i18n 文件去重后: ${dedupedLegacyFiles.length}`)

  // 2. 解析所有 D 盘 i18n 文件,提取 key
  console.log('\n解析 D 盘 i18n 文件...')
  const legacyKeyMap = new Map() // key → Set<filePath>(来源文件)
  let legacyFilesByType = { properties: 0, json: 0, ts: 0 }
  for (const file of dedupedLegacyFiles) {
    const lower = file.toLowerCase()
    if (lower.endsWith('.properties')) legacyFilesByType.properties++
    else if (lower.endsWith('.json')) legacyFilesByType.json++
    else if (lower.endsWith('.ts')) legacyFilesByType.ts++

    const keys = parseI18nFile(file)
    for (const k of keys) {
      if (!legacyKeyMap.has(k)) legacyKeyMap.set(k, new Set())
      legacyKeyMap.get(k).add(file)
    }
  }
  const legacyKeysTotal = legacyKeyMap.size
  console.log(`  文件类型分布: properties=${legacyFilesByType.properties}, json=${legacyFilesByType.json}, ts=${legacyFilesByType.ts}`)
  console.log(`  D 盘 i18n key 总数(唯一): ${legacyKeysTotal}`)

  // 3. 读取当前仓库 zh-CN.json
  console.log('\n读取当前仓库 zh-CN.json...')
  const newKeys = parseJsonFile(NEW_ZH_CN)
  const newKeySet = new Set(newKeys)
  console.log(`  当前仓库 zh-CN.json key 总数: ${newKeySet.size}`)

  // 4. 构建 index map(归一化 → 原始 key 列表 / 后缀 → 原始 key 列表 / 模块 → 原始 key 列表)
  // D 盘
  const legacyKeyNormalizedMap = new Map()
  const legacyKeySuffixMap = new Map()
  const legacyKeyModuleMap = new Map()
  for (const k of legacyKeyMap.keys()) {
    const { normalized, segments } = normalizeKey(k)
    if (!legacyKeyNormalizedMap.has(normalized)) legacyKeyNormalizedMap.set(normalized, [])
    legacyKeyNormalizedMap.get(normalized).push(k)

    if (segments.length >= 1) {
      const lastSeg = segments[segments.length - 1]
      if (lastSeg) {
        if (!legacyKeySuffixMap.has(lastSeg)) legacyKeySuffixMap.set(lastSeg, [])
        legacyKeySuffixMap.get(lastSeg).push(k)
      }
      // 末两段
      if (segments.length >= 2) {
        const lastTwo = segments.slice(-2).join('.')
        if (!legacyKeySuffixMap.has(lastTwo)) legacyKeySuffixMap.set(lastTwo, [])
        legacyKeySuffixMap.get(lastTwo).push(k)
      }
    }

    const mod = getKeyModule(k)
    if (mod) {
      if (!legacyKeyModuleMap.has(mod)) legacyKeyModuleMap.set(mod, [])
      legacyKeyModuleMap.get(mod).push(k)
    }
  }

  // 当前仓库
  const newKeyNormalizedMap = new Map()
  const newKeySuffixMap = new Map()
  const newKeyModuleMap = new Map()
  for (const k of newKeySet) {
    const { normalized, segments } = normalizeKey(k)
    if (!newKeyNormalizedMap.has(normalized)) newKeyNormalizedMap.set(normalized, [])
    newKeyNormalizedMap.get(normalized).push(k)

    if (segments.length >= 1) {
      const lastSeg = segments[segments.length - 1]
      if (lastSeg) {
        if (!newKeySuffixMap.has(lastSeg)) newKeySuffixMap.set(lastSeg, [])
        newKeySuffixMap.get(lastSeg).push(k)
      }
      if (segments.length >= 2) {
        const lastTwo = segments.slice(-2).join('.')
        if (!newKeySuffixMap.has(lastTwo)) newKeySuffixMap.set(lastTwo, [])
        newKeySuffixMap.get(lastTwo).push(k)
      }
    }

    const mod = getKeyModule(k)
    if (mod) {
      if (!newKeyModuleMap.has(mod)) newKeyModuleMap.set(mod, [])
      newKeyModuleMap.get(mod).push(k)
    }
  }

  // 5. 匹配
  console.log('\n执行匹配(精确 > 后缀 > 业务模块)...')
  const auditResults = []
  const stats = {
    已迁移: 0,
    部分迁移: 0,
    缺失: 0,
    无需迁移: 0,
  }

  // 5a. D 盘 key → 当前仓库匹配
  for (const [legacyKey, sourceFiles] of legacyKeyMap.entries()) {
    const match = matchKey(legacyKey, newKeySet, newKeyNormalizedMap, newKeySuffixMap, newKeyModuleMap)
    auditResults.push({
      source: 'legacy',
      legacyKey,
      normalizedKey: normalizeKey(legacyKey).normalized,
      sourceFiles: Array.from(sourceFiles).map(f => path.relative('D:\\历史项目存档', f).replace(/\\/g, '/')).join(' | '),
      status: match.status,
      matchedKeys: match.matchedKeys.join(' | '),
      reason: match.reason,
    })
    stats[match.status] = (stats[match.status] || 0) + 1
  }

  // 5b. 当前仓库中无对应 D 盘的 key → 无需迁移(新增)
  for (const k of newKeySet) {
    const matched = findMatchingLegacyKey(k, legacyKeyNormalizedMap, legacyKeySuffixMap, legacyKeyModuleMap)
    if (!matched) {
      auditResults.push({
        source: 'new',
        legacyKey: '',
        normalizedKey: normalizeKey(k).normalized,
        sourceFiles: '',
        status: '无需迁移',
        matchedKeys: k,
        reason: '当前仓库新增 key(无 D 盘对应)',
      })
      stats['无需迁移']++
    }
  }

  // 6. 统计输出
  console.log('\n=== 匹配结果统计 ===')
  console.log(`已迁移: ${stats['已迁移']}`)
  console.log(`部分迁移: ${stats['部分迁移']}`)
  console.log(`缺失: ${stats['缺失']}`)
  console.log(`无需迁移(新增): ${stats['无需迁移']}`)
  console.log(`总计: ${auditResults.length}`)

  // 7. 缺失 key 分析(语言迁移 vs 真实缺失)
  const missingResults = auditResults.filter(r => r.status === '缺失')
  const missingAnalysis = analyzeMissingKeys(missingResults, newKeyModuleMap)
  console.log('\n=== 缺失 key 分析 ===')
  console.log(`缺失总数: ${missingResults.length}`)
  console.log(`  语言迁移预期(D 盘模块在当前仓库存在): ${missingAnalysis.languageMigration}`)
  console.log(`  真实缺失(模块在当前仓库无任何 key): ${missingAnalysis.realMissing}`)
  console.log(`  无业务模块(无法判断): ${missingAnalysis.noModule}`)

  // 8. 关键 key 完整性检查
  const criticalKeys = [
    'login', 'save', 'cancel', 'confirm', 'delete', 'edit', 'add',
    'error', 'success', 'warning', 'loading', 'search', 'submit',
    'logout', 'register', 'password', 'username',
  ]
  console.log('\n=== 关键 key 完整性检查 ===')
  const criticalCheck = []
  for (const crit of criticalKeys) {
    const newMatch = newKeyModuleMap.get(crit) || newKeySuffixMap.get(crit) || []
    const legacyMatch = legacyKeyModuleMap.get(crit) || legacyKeySuffixMap.get(crit) || []
    const status = newMatch.length > 0 ? '✓' : '✗'
    console.log(`  ${status} ${crit}: 当前仓库=${newMatch.length} 个, D盘=${legacyMatch.length} 个`)
    criticalCheck.push({
      key: crit,
      newRepoCount: newMatch.length,
      legacyCount: legacyMatch.length,
      migrated: newMatch.length > 0,
      examples: newMatch.slice(0, 3),
    })
  }

  // 9. 输出 CSV
  const csvPath = path.join(reportsDir, `migration-audit-i18n-${timestamp}.csv`)
  const csvLines = [
    'source,legacyKey,normalizedKey,sourceFiles,status,matchedKeys,reason',
  ]
  for (const r of auditResults) {
    const escape = s => `"${String(s).replace(/"/g, '""')}"`
    csvLines.push([
      r.source, r.legacyKey, r.normalizedKey, r.sourceFiles,
      r.status, r.matchedKeys, r.reason,
    ].map(escape).join(','))
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')
  console.log(`\n审计 CSV: ${csvPath}`)

  // 10. 输出 summary JSON
  const summaryPath = path.join(reportsDir, `migration-audit-i18n-summary.json`)
  const totalLegacy = legacyKeysTotal
  const totalNew = newKeySet.size
  const migratedPct = totalLegacy > 0 ? ((stats['已迁移'] / totalLegacy) * 100).toFixed(1) : '0.0'
  const partialPct = totalLegacy > 0 ? ((stats['部分迁移'] / totalLegacy) * 100).toFixed(1) : '0.0'
  const missingPct = totalLegacy > 0 ? ((stats['缺失'] / totalLegacy) * 100).toFixed(1) : '0.0'
  const noNeedPct = totalNew > 0 ? ((stats['无需迁移'] / totalNew) * 100).toFixed(1) : '0.0'

  const summary = {
    timestamp,
    phase: '阶段 5: i18n key content-level 比对',
    legacyRoots: LEGACY_ROOTS,
    newZhCnFile: NEW_ZH_CN,
    legacyI18nFilesTotal: legacyFiles.length,
    legacyI18nFilesUnique: dedupedLegacyFiles.length,
    legacyFilesByType: legacyFilesByType,
    legacyKeysTotal: totalLegacy,
    newKeysTotal: totalNew,
    stats: {
      已迁移: stats['已迁移'],
      部分迁移: stats['部分迁移'],
      缺失: stats['缺失'],
      无需迁移: stats['无需迁移'],
    },
    percentages: {
      已迁移: `${migratedPct}%`,
      部分迁移: `${partialPct}%`,
      缺失: `${missingPct}%(相对 D 盘 key)`,
      无需迁移: `${noNeedPct}%(相对当前仓库 key)`,
    },
    missingAnalysis: {
      totalMissing: missingResults.length,
      languageMigrationExpected: missingAnalysis.languageMigration,
      realMissing: missingAnalysis.realMissing,
      noModule: missingAnalysis.noModule,
      realMissingExamples: missingAnalysis.realMissingExamples,
    },
    criticalKeyCheck: criticalCheck,
    nextPhaseRecommendation: missingAnalysis.realMissing > 0
      ? '需要阶段 6:对真实缺失 key 做业务影响评估(是否需要补齐)'
      : '语言迁移完成度高,可考虑阶段 6 数据库 schema/共享类型比对',
  }
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  console.log(`摘要 JSON: ${summaryPath}`)

  // 11. 退出码
  if (legacyKeysTotal === 0 && newKeySet.size === 0) {
    console.error('\n❌ 审计失败:无任何 key 被审计')
    process.exit(1)
  }
  console.log('\n✅ 审计完成')
  process.exit(0)
}

/**
 * 分析缺失 key:区分语言迁移预期 vs 真实缺失。
 * 语言迁移预期 = D 盘 key 的业务模块在当前仓库有 key(只是 key 名不同)
 * 真实缺失 = D 盘 key 的业务模块在当前仓库完全没有任何 key
 */
function analyzeMissingKeys(missingResults, newKeyModuleMap) {
  let languageMigration = 0
  let realMissing = 0
  let noModule = 0
  const realMissingExamples = []

  for (const r of missingResults) {
    const mod = getKeyModule(r.legacyKey)
    if (!mod) {
      noModule++
      continue
    }
    // 检查当前仓库是否有该模块的 key
    const newKeysForModule = newKeyModuleMap.get(mod) || []
    if (newKeysForModule.length > 0 || BUSINESS_KEYWORDS.includes(mod)) {
      languageMigration++
    } else {
      realMissing++
      if (realMissingExamples.length < 10) {
        realMissingExamples.push({
          legacyKey: r.legacyKey,
          module: mod,
          sourceFiles: r.sourceFiles,
        })
      }
    }
  }

  return { languageMigration, realMissing, noModule, realMissingExamples }
}

main()
