#!/usr/bin/env node
/**
 * audit-migration.mjs — 4 合 1 审计脚本(2026-07-25 合并)
 *
 * 合并自:audit-migration-{i18n,frontend-routes,db-fields,api-routes-v2}.mjs
 * 用法:node scripts/audit-migration.mjs --target=<i18n|frontend-routes|db-fields|api-routes>
 *
 * 原脚本保留行为:每个 target 的检查规则、白名单、输出格式 100% 保留
 */

/* eslint-disable no-console */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── 参数解析(公共 helper)─────────────────────────────────────────
/**
 * 从 argv 解析 --target / -t 参数。
 * 支持:
 *   --target=<value>
 *   -t=<value>
 *   --target <value>
 *   -t <value>
 * 大小写不敏感(返回小写形式)。
 * @param {string[]} argv
 * @returns {string|null}
 */
function parseArgs(argv) {
  const args = argv.slice(2)
  let target = null
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--target=')) {
      target = a.slice('--target='.length)
      break
    } else if (a.startsWith('-t=')) {
      target = a.slice('-t='.length)
      break
    } else if (a === '--target' || a === '-t') {
      if (i + 1 < args.length) {
        target = args[i + 1]
        i++
      }
      break
    }
  }
  return target ? target.toLowerCase() : null
}

/**
 * 显示帮助信息。
 * @param {(msg: string) => void} [stream]
 */
function showHelp(stream = console.log) {
  stream('用法: node scripts/audit-migration.mjs --target=<target>')
  stream('')
  stream('可选 target:')
  stream('  i18n              - i18n key content-level 比对(阶段 5)')
  stream('  frontend-routes   - 前端页面/路由 content-level 比对(阶段 4)')
  stream('  db-fields         - 数据库 schema 字段级比对(阶段 4)')
  stream('  api-routes        - API 端点 content-level 比对 v2(阶段 2)')
  stream('')
  stream('支持缩写: -t <target>')
  stream('大小写不敏感: --target=I18N 也能工作')
}

// ─── 1. i18n 模块(原 audit-migration-i18n.mjs)─────────────────────
function runI18n() {
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
   */
  function isI18nFile(dir, fileName) {
    const lower = fileName.toLowerCase()
    const parent = path.basename(dir).toLowerCase()
    const langCodes = ['en', 'zh', 'zh-cn', 'zh-tw', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'ar', 'pt']

    // 1. .properties 文件
    if (lower.endsWith('.properties')) {
      if (lower.startsWith('messages') ||
          /[_-](en|zh|cn|tw|ja|ko|fr|de|es|ru|ar|pt)([_-][a-z]{2})?\.properties$/.test(lower)) {
        return true
      }
      return false
    }

    // 2. .json 文件
    if (lower.endsWith('.json')) {
      if (['messages', 'locale', 'locales', 'i18n', 'lang', 'langs', 'language', 'languages'].includes(parent)) {
        return true
      }
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
    } catch {
      return []
    }
  }

  /**
   * 解析 TS i18n 文件(Vue+TS 项目 `export default {...}` 格式)。
   */
  function parseTsFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')

    const exportMatch = content.match(/export\s+default\s*\{([\s\S]*)\}\s*;?\s*$/)
    if (!exportMatch) return []

    const body = exportMatch[1]
    const keys = []

    const pathStack = [null]
    let i = 0
    const len = body.length

    while (i < len) {
      const ch = body[i]

      if (ch === '/' && body[i + 1] === '/') {
        while (i < len && body[i] !== '\n') i++
        continue
      }
      if (ch === '/' && body[i + 1] === '*') {
        i += 2
        while (i < len && !(body[i] === '*' && body[i + 1] === '/')) i++
        i += 2
        continue
      }
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

      if (ch === '{') {
        pathStack.push(null)
        i++
        continue
      }
      if (ch === '}') {
        pathStack.pop()
        i++
        continue
      }

      if (ch === ',' || ch === '\n' || ch === '\r') {
        i++
        continue
      }

      if (/[a-zA-Z_$]/.test(ch)) {
        let j = i
        while (j < len && /[a-zA-Z0-9_$]/.test(body[j])) j++
        const ident = body.slice(i, j)

        let k = j
        while (k < len && /\s/.test(body[k])) k++

        if (body[k] === ':') {
          if (pathStack.length > 0) {
            pathStack[pathStack.length - 1] = ident
            const fullKey = pathStack.filter(Boolean).join('.')
            if (fullKey) keys.push(fullKey)
          }
          i = k + 1
          continue
        }

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

  function camelToSnake(s) {
    return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').toLowerCase()
  }

  function normalizeKey(key) {
    if (!key) return { normalized: '', segments: [] }

    let segs = key.split(/[.]/)

    if (segs.length > 1 && NAMESPACE_PREFIXES.includes(segs[0].toLowerCase())) {
      segs = segs.slice(1)
    }

    const normalizedSegs = segs.map(s => {
      let snake = camelToSnake(s)
      snake = snake.replace(/^-/, '')
      return snake.toLowerCase()
    })

    return {
      normalized: normalizedSegs.join('.'),
      segments: normalizedSegs,
    }
  }

  function getKeyModule(key) {
    const { segments } = normalizeKey(key)
    return segments[0] || ''
  }

  // ─── 匹配策略 ───────────────────────────────────────────────────────

  function matchKey(legacyKey, newKeySet, newKeyNormalizedMap, newKeySuffixMap, newKeyModuleMap) {
    const { normalized: normLegacy, segments: legacySegs } = normalizeKey(legacyKey)

    if (newKeyNormalizedMap.has(normLegacy)) {
      const matched = newKeyNormalizedMap.get(normLegacy)
      return {
        status: '已迁移',
        matchedKeys: matched.slice(0, 3),
        reason: `精确匹配: ${normLegacy}`,
      }
    }

    if (legacySegs.length >= 1) {
      const lastSeg = legacySegs[legacySegs.length - 1]
      if (lastSeg && lastSeg.length >= 3) {
        const suffixMatches = newKeySuffixMap.get(lastSeg) || []
        if (suffixMatches.length > 0) {
          return {
            status: '部分迁移',
            matchedKeys: suffixMatches.slice(0, 3),
            reason: `后缀匹配: .${lastSeg}`,
          }
        }
      }
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

    return {
      status: '缺失',
      matchedKeys: [],
      reason: `无匹配: ${legacyKey}`,
    }
  }

  function findMatchingLegacyKey(newKey, legacyKeyNormalizedMap, legacyKeySuffixMap, legacyKeyModuleMap) {
    const { normalized: normNew, segments: newSegs } = normalizeKey(newKey)

    if (legacyKeyNormalizedMap.has(normNew)) {
      return { match: legacyKeyNormalizedMap.get(normNew)[0], type: 'exact' }
    }

    if (newSegs.length >= 1) {
      const lastSeg = newSegs[newSegs.length - 1]
      if (lastSeg && lastSeg.length >= 3) {
        const matches = legacyKeySuffixMap.get(lastSeg) || []
        if (matches.length > 0) return { match: matches[0], type: 'suffix' }
      }
    }

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

    console.log('\n解析 D 盘 i18n 文件...')
    const legacyKeyMap = new Map()
    const legacyFilesByType = { properties: 0, json: 0, ts: 0 }
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

    console.log('\n读取当前仓库 zh-CN.json...')
    const newKeys = parseJsonFile(NEW_ZH_CN)
    const newKeySet = new Set(newKeys)
    console.log(`  当前仓库 zh-CN.json key 总数: ${newKeySet.size}`)

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

    console.log('\n执行匹配(精确 > 后缀 > 业务模块)...')
    const auditResults = []
    const stats = {
      已迁移: 0,
      部分迁移: 0,
      缺失: 0,
      无需迁移: 0,
    }

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

    console.log('\n=== 匹配结果统计 ===')
    console.log(`已迁移: ${stats['已迁移']}`)
    console.log(`部分迁移: ${stats['部分迁移']}`)
    console.log(`缺失: ${stats['缺失']}`)
    console.log(`无需迁移(新增): ${stats['无需迁移']}`)
    console.log(`总计: ${auditResults.length}`)

    const missingResults = auditResults.filter(r => r.status === '缺失')
    const missingAnalysis = analyzeMissingKeys(missingResults, newKeyModuleMap)
    console.log('\n=== 缺失 key 分析 ===')
    console.log(`缺失总数: ${missingResults.length}`)
    console.log(`  语言迁移预期(D 盘模块在当前仓库存在): ${missingAnalysis.languageMigration}`)
    console.log(`  真实缺失(模块在当前仓库无任何 key): ${missingAnalysis.realMissing}`)
    console.log(`  无业务模块(无法判断): ${missingAnalysis.noModule}`)

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

    if (legacyKeysTotal === 0 && newKeySet.size === 0) {
      console.error('\n❌ 审计失败:无任何 key 被审计')
      process.exit(1)
    }
    console.log('\n✅ 审计完成')
    process.exit(0)
  }

  /**
   * 分析缺失 key:区分语言迁移预期 vs 真实缺失。
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
}

// ─── 2. frontend-routes 模块(原 audit-migration-frontend-routes.mjs)─
function runFrontendRoutes() {
  // ─── 配置 ───────────────────────────────────────────────────────────
  const LEGACY_ROOTS = [
    'D:\\历史项目存档\\ihui-ai-admin-frontend',
    'D:\\历史项目存档\\edu client',
    'D:\\历史项目存档\\code',
    'D:\\历史项目存档\\zhs_app-ZZ',
    'D:\\历史项目存档\\ljd-交接文件',
  ]

  const NEW_APP_ROOT = 'g:\\IHUI-AI\\apps\\web\\app'
  const REPORTS_DIR = 'g:\\IHUI-AI\\reports'

  // ─── 工具函数 ───────────────────────────────────────────────────────

  function walkFiles(dir, predicate, visited = new Set()) {
    const results = []
    if (!fs.existsSync(dir)) return results
    const real = fs.realpathSync(dir)
    if (visited.has(real)) return results
    visited.add(real)

    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return results
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', '.next', 'build', '.cache'].includes(entry.name)) continue
        results.push(...walkFiles(full, predicate, visited))
      } else if (entry.isFile() && predicate(full)) {
        results.push(full)
      }
    }
    return results
  }

  function normalizePath(p) {
    if (!p) return ''
    let s = String(p).trim()
    s = s.replace(/:([A-Za-z_]\w*)\([^)]*\)/g, ':$1')
    s = s.replace(/\[\.\.\.([A-Za-z_]\w*)\]/g, ':$1*')
    s = s.replace(/\[([A-Za-z_]\w*)\]/g, ':$1')
    s = s.replace(/\{([A-Za-z_]\w*)\}/g, ':$1')
    s = s.replace(/^\/admin\//, '/')
    s = s.replace(/^\/admin$/, '/')
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1)
    s = s.replace(/\/{2,}/g, '/')
    return s
  }

  function extractKeywords(p) {
    const normalized = normalizePath(p)
    const cleaned = normalized.replace(/:[A-Za-z_]\w*\*?/g, '')
    const segs = cleaned.split('/').filter(Boolean)
    const set = new Set()
    for (const seg of segs) {
      for (const part of seg.split(/[-_]/)) {
        if (part) set.add(part.toLowerCase())
      }
    }
    return set
  }

  function getModule(p) {
    const segs = normalizePath(p).split('/').filter(Boolean)
    for (const s of segs) {
      if (!['admin', 'api', 'new'].includes(s)) return s
    }
    return segs[0] || ''
  }

  // ─── Vue 路由扫描 ────────────────────────────────────────────────────

  function walkVueRoutes(routes, parentPath = '', parentName = '', results = []) {
    if (!Array.isArray(routes)) return results
    for (const r of routes) {
      if (!r || typeof r !== 'object') continue
      const rawPath = typeof r.path === 'string' ? r.path : ''
      const name = r.name || (r.meta && r.meta.name) || parentName || ''
      const component = typeof r.component === 'string' ? r.component : ''

      let combined
      if (!rawPath) {
        combined = parentPath
      } else if (rawPath.startsWith('/')) {
        combined = rawPath
      } else {
        combined = parentPath ? `${parentPath.replace(/\/$/, '')}/${rawPath}` : `/${rawPath}`
      }
      combined = combined.replace(/\/{2,}/g, '/')
      if (combined && !combined.startsWith('/')) combined = '/' + combined

      const hasChildren = Array.isArray(r.children) && r.children.length > 0
      const hasComponent = !!component || typeof r.component === 'function'

      if (!hasChildren && combined) {
        if (combined.includes(':pathMatch(') || combined.includes(':pathMatch')) continue
        if (r.redirect && !hasComponent) continue
        results.push({
          path: combined,
          name,
          component,
          fullPath: combined,
        })
      }

      if (hasChildren) {
        walkVueRoutes(r.children, combined, name, results)
      }
    }
    return results
  }

  function parseVueRouterFile(file) {
    let src
    try {
      src = fs.readFileSync(file, 'utf8')
    } catch {
      return []
    }

    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')

    const results = []

    const tokens = tokenize(stripped)
    const routeObjects = extractRouteObjects(tokens)
    for (const obj of routeObjects) {
      walkVueRoutes([obj], '', '', results)
    }

    return results
  }

  function tokenize(src) {
    const tokens = []
    let i = 0
    const n = src.length
    while (i < n) {
      const c = src[i]
      if (c === '"' || c === "'" || c === '`') {
        const quote = c
        let j = i + 1
        let buf = ''
        while (j < n) {
          const cj = src[j]
          if (cj === '\\') {
            buf += src[j + 1] || ''
            j += 2
            continue
          }
          if (cj === quote) {
            j++
            break
          }
          buf += cj
          j++
        }
        tokens.push({ type: 'string', value: buf })
        i = j
        continue
      }
      if (c === '{') {
        tokens.push({ type: 'lbrace' })
        i++
        continue
      }
      if (c === '}') {
        tokens.push({ type: 'rbrace' })
        i++
        continue
      }
      if (c === '[') {
        tokens.push({ type: 'lbracket' })
        i++
        continue
      }
      if (c === ']') {
        tokens.push({ type: 'rbracket' })
        i++
        continue
      }
      if (c === ',') {
        tokens.push({ type: 'comma' })
        i++
        continue
      }
      if (c === ':') {
        tokens.push({ type: 'colon' })
        i++
        continue
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i + 1
        while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++
        tokens.push({ type: 'ident', value: src.slice(i, j) })
        i = j
        continue
      }
      if (/\s/.test(c)) {
        i++
        continue
      }
      let j = i + 1
      while (j < n && !/[\s{}[\],:"'`A-Za-z_$]/.test(src[j])) j++
      tokens.push({ type: 'other', value: src.slice(i, j) })
      i = j
    }
    return tokens
  }

  function extractRouteObjects(tokens) {
    const objects = []
    let i = 0
    const n = tokens.length

    function parseObject() {
      if (tokens[i] && tokens[i].type === 'lbrace') {
        i++
      } else {
        return null
      }
      const obj = { children: [] }
      let hasPath = false
      while (i < n && tokens[i].type !== 'rbrace') {
        if (tokens[i].type === 'ident' && tokens[i + 1] && tokens[i + 1].type === 'colon') {
          const key = tokens[i].value
          i += 2
          if (key === 'path') {
            if (tokens[i] && tokens[i].type === 'string') {
              obj.path = tokens[i].value
              hasPath = true
              i++
            } else {
              skipValue()
            }
          } else if (key === 'name') {
            if (tokens[i] && tokens[i].type === 'string') {
              obj.name = tokens[i].value
              i++
            } else if (tokens[i] && tokens[i].type === 'ident') {
              obj.name = tokens[i].value
              i++
            } else {
              skipValue()
            }
          } else if (key === 'component') {
            if (tokens[i] && tokens[i].type === 'string') {
              obj.component = tokens[i].value
              i++
            } else if (tokens[i] && tokens[i].type === 'ident') {
              obj.component = tokens[i].value
              i++
            } else {
              obj.component = '<inline>'
              skipValue()
            }
          } else if (key === 'children') {
            if (tokens[i] && tokens[i].type === 'lbracket') {
              i++
              const childObjs = []
              while (i < n && tokens[i].type !== 'rbracket') {
                if (tokens[i].type === 'lbrace') {
                  const child = parseObject()
                  if (child) childObjs.push(child)
                } else {
                  i++
                }
              }
              if (tokens[i] && tokens[i].type === 'rbracket') i++
              obj.children = childObjs
            } else {
              skipValue()
            }
          } else if (key === 'redirect') {
            if (tokens[i] && tokens[i].type === 'string') {
              obj.redirect = tokens[i].value
              i++
            } else if (tokens[i] && tokens[i].type === 'ident') {
              obj.redirect = tokens[i].value
              i++
            } else if (tokens[i] && tokens[i].type === 'lbrace') {
              const r = parseObject()
              obj.redirect = r && r.path ? r.path : '<obj>'
            } else {
              skipValue()
            }
          } else {
            skipValue()
          }
          if (tokens[i] && tokens[i].type === 'comma') i++
        } else {
          i++
        }
      }
      if (tokens[i] && tokens[i].type === 'rbrace') i++
      return hasPath ? obj : null
    }

    function skipValue() {
      if (!tokens[i]) return
      const t = tokens[i]
      if (t.type === 'string' || t.type === 'ident' || t.type === 'other') {
        i++
        return
      }
      if (t.type === 'lbrace') {
        let depth = 1
        i++
        while (i < n && depth > 0) {
          if (tokens[i].type === 'lbrace') depth++
          else if (tokens[i].type === 'rbrace') depth--
          i++
        }
        return
      }
      if (t.type === 'lbracket') {
        let depth = 1
        i++
        while (i < n && depth > 0) {
          if (tokens[i].type === 'lbracket') depth++
          else if (tokens[i].type === 'rbracket') depth--
          i++
        }
        return
      }
      i++
    }

    while (i < n) {
      if (tokens[i].type === 'lbrace') {
        const obj = parseObject()
        if (obj && obj.path !== undefined) {
          objects.push(obj)
        } else {
          // 不是路由对象,继续(i 已经前进)
        }
      } else {
        i++
      }
    }
    return objects
  }

  function scanVueRoutes() {
    const allRoutes = []
    const seenKeys = new Set()

    for (const root of LEGACY_ROOTS) {
      if (!fs.existsSync(root)) continue
      const routerFiles = walkFiles(
        root,
        (f) => /[/\\]src[/\\]router[/\\][^/\\]+\.(js|ts)$/.test(f) && !f.endsWith('guard.js') && !f.endsWith('goto.js'),
      )
      for (const file of routerFiles) {
        const routes = parseVueRouterFile(file)
        for (const r of routes) {
          const key = `${file}::${r.path}`
          if (seenKeys.has(key)) continue
          seenKeys.add(key)
          allRoutes.push({
            ...r,
            sourceFile: file,
            sourceProject: detectProjectName(file, root),
            type: 'vue-router',
          })
        }
      }
    }

    for (const root of LEGACY_ROOTS) {
      if (!fs.existsSync(root)) continue
      const pagesJsonFiles = walkFiles(root, (f) => f.endsWith('pages.json'))
      for (const file of pagesJsonFiles) {
        let json
        try {
          const content = fs.readFileSync(file, 'utf8')
          const clean = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
          json = JSON.parse(clean)
        } catch {
          continue
        }
        const collectFromPages = (pages, pkgRoot = '') => {
          if (!Array.isArray(pages)) return
          for (const p of pages) {
            if (!p || typeof p.path !== 'string') continue
            let fullPath = p.path
            if (pkgRoot) fullPath = `${pkgRoot}/${p.path}`
            const asPath = '/' + fullPath.replace(/^\/+/, '')
            allRoutes.push({
              path: asPath,
              name: '',
              component: fullPath,
              fullPath: asPath,
              sourceFile: file,
              sourceProject: detectProjectName(file, root),
              type: 'uniapp-pages-json',
            })
          }
        }
        collectFromPages(json.pages)
        if (Array.isArray(json.subPackages)) {
          for (const sub of json.subPackages) {
            collectFromPages(sub.pages, sub.root)
          }
        }
      }
    }

    return allRoutes
  }

  function detectProjectName(file, root) {
    let rel = file
    if (file.startsWith(root)) {
      rel = file.slice(root.length).replace(/^[\\\/]/, '')
    }
    const segs = rel.split(/[\\\/]/)
    return segs.slice(0, 2).join('/')
  }

  // ─── Next.js 路由扫描 ────────────────────────────────────────────────

  function scanNextRoutes() {
    const routes = []
    if (!fs.existsSync(NEW_APP_ROOT)) return routes

    const pageFiles = walkFiles(
      NEW_APP_ROOT,
      (f) => /[/\\]page\.(tsx|ts|jsx|js)$/.test(f),
    )

    for (const file of pageFiles) {
      let rel = file.slice(NEW_APP_ROOT.length).replace(/^[\\\/]/, '')
      rel = rel.replace(/[/\\]page\.(tsx|ts|jsx|js)$/, '')
      rel = rel.replace(/\\/g, '/')

      const segs = rel ? rel.split('/').filter(Boolean) : []
      const pathSegs = []
      for (const seg of segs) {
        if (/^\([^)]+\)$/.test(seg)) continue
        if (seg.startsWith('@')) continue
        pathSegs.push(seg)
      }

      let asPath
      if (pathSegs.length === 0) {
        asPath = '/'
      } else {
        asPath = '/' + pathSegs.join('/')
      }

      routes.push({
        path: asPath,
        normalizedPath: normalizePath(asPath),
        file,
        type: 'next-app-router',
      })
    }

    return routes
  }

  // ─── 匹配引擎 ───────────────────────────────────────────────────────

  function matchRoute(vueRoute, nextRoute) {
    const vp = normalizePath(vueRoute.path)
    const np = nextRoute.normalizedPath
    if (!vp || !np) return null

    if (vp === np) return 'exact'

    const vSegs = vp.split('/').filter(Boolean)
    const nSegs = np.split('/').filter(Boolean)
    const minLen = Math.min(vSegs.length, nSegs.length)
    let allEqual = true
    for (let i = 0; i < minLen; i++) {
      if (vSegs[i] === nSegs[i]) continue
      if (vSegs[i].startsWith(':') && nSegs[i].startsWith(':')) continue
      allEqual = false
      break
    }
    if (allEqual && minLen > 0) {
      return 'prefix'
    }

    const vKw = extractKeywords(vueRoute.path)
    const nKw = extractKeywords(nextRoute.path)
    let sharedNonParam = 0
    for (const k of vKw) {
      if (nKw.has(k) && !k.startsWith(':')) sharedNonParam++
    }
    if (sharedNonParam >= 1 && getModule(vueRoute.path) === getModule(nextRoute.path)) {
      return 'keyword'
    }
    if (getModule(vueRoute.path) && getModule(vueRoute.path) === getModule(nextRoute.path)) {
      return 'keyword'
    }

    return null
  }

  // ─── CSV 输出 ───────────────────────────────────────────────────────

  function csvEscape(s) {
    if (s === null || s === undefined) return ''
    const str = String(s)
    if (/[",\n\r]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  function writeCsv(filePath, headers, rows) {
    const lines = [headers.map(csvEscape).join(',')]
    for (const row of rows) {
      lines.push(headers.map((h) => csvEscape(row[h])).join(','))
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
  }

  // ─── 主流程 ─────────────────────────────────────────────────────────

  function main() {
    console.log('=== 阶段 4: 前端页面/路由 content-level 比对 ===\n')

    console.log('[1/4] 扫描 D 盘 Vue 路由配置...')
    const vueRoutes = scanVueRoutes()
    console.log(`  找到 ${vueRoutes.length} 条 Vue 路由`)

    console.log('[2/4] 扫描当前仓库 Next.js App Router...')
    const nextRoutes = scanNextRoutes()
    console.log(`  找到 ${nextRoutes.length} 条 Next.js 路由`)

    console.log('[3/4] 执行 content-level 比对...')
    const migrated = []
    const partial = []
    const missing = []
    const newOnly = []

    const matchedNextIdx = new Set()
    for (const v of vueRoutes) {
      let bestMatch = null
      let bestType = null
      for (let i = 0; i < nextRoutes.length; i++) {
        if (matchedNextIdx.has(i)) continue
        const m = matchRoute(v, nextRoutes[i])
        if (!m) continue
        if (m === 'exact') {
          bestMatch = i
          bestType = 'exact'
          break
        }
        if (m === 'prefix' && bestType !== 'exact') {
          bestMatch = i
          bestType = 'prefix'
        } else if (m === 'keyword' && !bestType) {
          bestMatch = i
          bestType = 'keyword'
        }
      }

      if (bestMatch === null) {
        missing.push({
          vue_path: v.path,
          vue_normalized: normalizePath(v.path),
          vue_name: v.name || '',
          vue_component: v.component || '',
          vue_source: v.sourceFile || '',
          vue_project: v.sourceProject || '',
          vue_type: v.type,
          match_type: 'none',
          next_path: '',
          next_file: '',
          analysis: analyzeMissing(v),
        })
      } else {
        matchedNextIdx.add(bestMatch)
        const next = nextRoutes[bestMatch]
        if (bestType === 'exact') {
          migrated.push({
            vue_path: v.path,
            vue_normalized: normalizePath(v.path),
            vue_name: v.name || '',
            vue_component: v.component || '',
            vue_source: v.sourceFile || '',
            vue_project: v.sourceProject || '',
            vue_type: v.type,
            match_type: bestType,
            next_path: next.path,
            next_normalized: next.normalizedPath,
            next_file: next.file,
          })
        } else {
          partial.push({
            vue_path: v.path,
            vue_normalized: normalizePath(v.path),
            vue_name: v.name || '',
            vue_component: v.component || '',
            vue_source: v.sourceFile || '',
            vue_project: v.sourceProject || '',
            vue_type: v.type,
            match_type: bestType,
            next_path: next.path,
            next_normalized: next.normalizedPath,
            next_file: next.file,
          })
        }
      }
    }

    for (let i = 0; i < nextRoutes.length; i++) {
      if (matchedNextIdx.has(i)) continue
      const n = nextRoutes[i]
      newOnly.push({
        next_path: n.path,
        next_normalized: n.normalizedPath,
        next_file: n.file,
        analysis: analyzeNewOnly(n, vueRoutes),
      })
    }

    console.log('[4/4] 输出 CSV 与 summary.json...')
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true })
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const csvPath = path.join(REPORTS_DIR, `migration-audit-frontend-routes-${ts}.csv`)
    const summaryPath = path.join(REPORTS_DIR, 'migration-audit-frontend-routes-summary.json')

    const headers = [
      'category', 'vue_path', 'vue_normalized', 'vue_name', 'vue_component',
      'vue_source', 'vue_project', 'vue_type', 'match_type',
      'next_path', 'next_normalized', 'next_file', 'analysis',
    ]
    const rows = []
    for (const r of migrated) {
      rows.push({ category: '已迁移', ...r, analysis: '' })
    }
    for (const r of partial) {
      rows.push({ category: '部分迁移', ...r, analysis: '' })
    }
    for (const r of missing) {
      rows.push({
        category: '缺失',
        vue_path: r.vue_path,
        vue_normalized: r.vue_normalized,
        vue_name: r.vue_name,
        vue_component: r.vue_component,
        vue_source: r.vue_source,
        vue_project: r.vue_project,
        vue_type: r.vue_type,
        match_type: r.match_type,
        next_path: '',
        next_normalized: '',
        next_file: '',
        analysis: r.analysis,
      })
    }
    for (const r of newOnly) {
      rows.push({
        category: 'Next.js独有',
        vue_path: '',
        vue_normalized: '',
        vue_name: '',
        vue_component: '',
        vue_source: '',
        vue_project: '',
        vue_type: '',
        match_type: '',
        next_path: r.next_path,
        next_normalized: r.next_normalized,
        next_file: r.next_file,
        analysis: r.analysis,
      })
    }
    writeCsv(csvPath, headers, rows)

    const keyPages = ['login', 'dashboard', 'index', 'user', 'member', 'admin', 'role', 'order', 'article', 'course', 'ai']
    const keyPageStatus = []
    for (const key of keyPages) {
      const hasVue = vueRoutes.some((r) => normalizePath(r.path).includes(`/${key}`) || normalizePath(r.path) === `/${key}`)
      const hasNext = nextRoutes.some((r) => r.normalizedPath.includes(`/${key}`) || r.normalizedPath === `/${key}`)
      keyPageStatus.push({
        keyword: key,
        hasVueRoute: hasVue,
        hasNextRoute: hasNext,
        status: hasVue && hasNext ? 'both' : hasVue ? 'vue_only' : hasNext ? 'next_only' : 'neither',
      })
    }

    const missingLanguageMigration = missing.filter((r) =>
      r.analysis && r.analysis.includes('语言迁移')
    ).length
    const missingReal = missing.length - missingLanguageMigration

    const summary = {
      timestamp: ts,
      phase: '阶段 4: 前端页面/路由 content-level 比对',
      legacyRoots: LEGACY_ROOTS,
      newAppRoot: NEW_APP_ROOT,
      vueRoutesTotal: vueRoutes.length,
      nextRoutesTotal: nextRoutes.length,
      stats: {
        已迁移: migrated.length,
        部分迁移: partial.length,
        缺失: missing.length,
        'Next.js独有': newOnly.length,
      },
      percentages: {
        已迁移: vueRoutes.length > 0 ? `${((migrated.length / vueRoutes.length) * 100).toFixed(1)}%` : '0%',
        部分迁移: vueRoutes.length > 0 ? `${((partial.length / vueRoutes.length) * 100).toFixed(1)}%` : '0%',
        缺失: vueRoutes.length > 0 ? `${((missing.length / vueRoutes.length) * 100).toFixed(1)}%(相对 Vue 路由)` : '0%',
        'Next.js独有': nextRoutes.length > 0 ? `${((newOnly.length / nextRoutes.length) * 100).toFixed(1)}%(相对 Next.js 路由)` : '0%',
      },
      missingAnalysis: {
        totalMissing: missing.length,
        languageMigrationExpected: missingLanguageMigration,
        realMissing: missingReal,
        realMissingExamples: missing
          .filter((r) => !r.analysis.includes('语言迁移'))
          .slice(0, 10)
          .map((r) => ({
            path: r.vue_path,
            module: getModule(r.vue_path),
            name: r.vue_name,
            component: r.vue_component,
            sourceProject: r.vue_project,
            sourceFile: r.vue_source,
          })),
      },
      keyPagesCheck: keyPageStatus,
      nextPhaseRecommendation: missingReal > 0
        ? '需要阶段 5:对真实缺失前端页面做业务影响评估(是否需要补齐页面/组件)'
        : '所有 Vue 路由均已迁移或属于语言迁移预期差异',
      csvFile: csvPath,
    }

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')

    console.log(`\n=== 比对完成 ===`)
    console.log(`Vue 路由总数: ${vueRoutes.length}`)
    console.log(`Next.js 路由总数: ${nextRoutes.length}`)
    console.log(`已迁移: ${migrated.length}`)
    console.log(`部分迁移: ${partial.length}`)
    console.log(`缺失: ${missing.length}(语言迁移预期 ${missingLanguageMigration}, 真实缺失 ${missingReal})`)
    console.log(`Next.js 独有: ${newOnly.length}`)
    console.log(`\nCSV: ${csvPath}`)
    console.log(`Summary: ${summaryPath}`)

    console.log(`\n关键页面检查:`)
    for (const k of keyPageStatus) {
      console.log(`  ${k.keyword}: vue=${k.hasVueRoute} next=${k.hasNextRoute} → ${k.status}`)
    }
  }

  /**
   * 缺失路由分析:语言迁移 vs 真实缺失
   */
  function analyzeMissing(vueRoute) {
    const p = normalizePath(vueRoute.path)
    const module = getModule(p)

    if (vueRoute.type === 'uniapp-pages-json') {
      if (['login', 'register', 'settings', 'vip', 'agreement'].some((k) => p.includes(k))) {
        return '语言迁移(uni-app→web,部分功能在 web 已有等价路由)'
      }
      return '语言迁移(uni-app 移动端独占页面,不在 web 迁移范围)'
    }

    if (['/work-we-chat', '/ding-talk', '/unauthorized', '/404', '/401', '/redirect'].some((k) => p === k || p.startsWith(k + '/'))) {
      return '语言迁移(SSO/错误页/重定向,Next.js 中通过其他机制实现)'
    }

    if (module === 'account') {
      return '语言迁移(账号中心已合并到 user-center / settings)'
    }

    return '真实缺失(Vue 业务页面在 Next.js 中未找到对应)'
  }

  /**
   * Next.js 独有路由分析
   */
  function analyzeNewOnly(nextRoute, vueRoutes) {
    const p = nextRoute.normalizedPath
    const module = getModule(p)

    const hasVueModule = vueRoutes.some((r) => getModule(r.path) === module)
    if (hasVueModule) {
      return 'Next.js 新增(同模块下的新页面)'
    }

    if (['sso', 'forbidden', 'api-test', 'bi-dashboard', 'mcp-projects', 'ai-career', 'ai-news', 'ai-world', 'token-value', 'workflows', 'teams', 'subscriptions', 'topics', 'tags'].some((k) => p.includes(k))) {
      return 'Next.js 新增(新业务模块,Vue 中无对应)'
    }

    return 'Next.js 新增页面'
  }

  main()
}

// ─── 3. db-fields 模块(原 audit-migration-db-fields.mjs)────────────
function runDbFields() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const REPO_ROOT = resolve(__dirname, '..');

  // 旧项目源路径 (D 盘)
  const OLD_ROOT = 'D:\\历史项目存档';
  const OLD_EDU_SQL = join(OLD_ROOT, 'code', 'edu', 'service', 'service', 'init_database.sql');
  const OLD_ZHS_JAVA_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'ZHS_Server_java');
  const OLD_ZHS_PY_SQL_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'coze_zhs_py', 'sql');
  const OLD_RY_SQL_DIR = join(OLD_ROOT, 'code', 'ljd-交接文件', 'ai-smart-society-java', 'sql');

  // 新项目 schema 路径
  const NEW_SCHEMA_DIR = join(REPO_ROOT, 'packages', 'database', 'src', 'schema');

  const REPORTS_DIR = join(REPO_ROOT, 'reports');
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

  const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const CSV_PATH = join(REPORTS_DIR, `migration-audit-db-fields-${TIMESTAMP}.csv`);
  const SUMMARY_PATH = join(REPORTS_DIR, 'migration-audit-db-fields-summary.json');

  // 阶段 3 CSV (80 张 migrated 表清单来源)
  const STAGE3_CSV = join(REPORTS_DIR, 'migration-audit-db-schema-2026-07-19T12-48-44.csv');

  /**
   * 20 张抽样表 (覆盖 8 个关键业务模块)
   */
  const SAMPLE_TABLES = [
    { old: 't_user', new: 'edu_user', old_source: 'edu-init_database.sql', new_file: 'edu-full.ts', module: 'user' },
    { old: 'users', new: 'edu_user', old_source: 'ry-sql', new_file: 'edu-full.ts', module: 'user' },
    { old: 't_user_job', new: 'user_jobs', old_source: 'edu-init_database.sql', new_file: 'usercenter.ts', module: 'user' },
    { old: 'order_order', new: 'orders', old_source: 'edu-init_database.sql', new_file: 'billing.ts', module: 'order' },
    { old: 'zhs_order', new: 'orders', old_source: 'zhs-java-@Table', new_file: 'billing.ts', module: 'order' },
    { old: 't_order_item', new: 'edu_order_items', old_source: 'edu-init_database.sql', new_file: 'order.ts', module: 'order' },
    { old: 't_member_group', new: 'member_groups', old_source: 'edu-init_database.sql', new_file: 'member-extended.ts', module: 'member' },
    { old: 't_member_post', new: 'member_posts', old_source: 'edu-init_database.sql', new_file: 'member-extended.ts', module: 'member' },
    { old: 't_member_tag', new: 'member_tags', old_source: 'edu-init_database.sql', new_file: 'member-extended.ts', module: 'member' },
    { old: 't_announcement', new: 'announcements', old_source: 'edu-init_database.sql', new_file: 'content.ts', module: 'message' },
    { old: 't_notice', new: 'sys_notice', old_source: 'edu-init_database.sql', new_file: 'admin-sys.ts', module: 'message' },
    { old: 't_system_notice', new: 'message_system_notice', old_source: 'edu-init_database.sql', new_file: 'relation-tables.ts', module: 'message' },
    { old: 'zhs_agent_category', new: 'zhs_agent_category', old_source: 'zhs-py-sql', new_file: 'zhs-full.ts', module: 'ai' },
    { old: 'zhs_user_agent_free_times', new: 'zhs_user_agent_free_time', old_source: 'zhs-java-@Table', new_file: 'zhs-full.ts', module: 'ai' },
    { old: 't_role', new: 'edu_role', old_source: 'edu-init_database.sql', new_file: 'edu-full.ts', module: 'role' },
    { old: 't_role_authority', new: 'edu_role_authority', old_source: 'edu-init_database.sql', new_file: 'edu-full.ts', module: 'role' },
    { old: 'permissions', new: 'permissions', old_source: 'ry-sql', new_file: 'rbac.ts', module: 'permission' },
    { old: 't_paper', new: 'exam_papers', old_source: 'edu-init_database.sql', new_file: 'exam.ts', module: 'exam' },
    { old: 't_question', new: 'exam_questions', old_source: 'edu-init_database.sql', new_file: 'exam.ts', module: 'exam' },
    { old: 't_comment', new: 'comments', old_source: 'edu-init_database.sql', new_file: 'comments.ts', module: 'comment' },
  ];

  // ---------------------------------------------------------------------------
  // 类型与约束归一化映射
  // ---------------------------------------------------------------------------

  function canonicalSqlType(raw) {
    if (!raw) return 'unknown';
    const t = raw.toLowerCase().trim();
    if (/^int(\(\d+\))?( unsigned)?$/.test(t) || t === 'integer') return 'integer';
    if (/^bigint(\(\d+\))?( unsigned)?$/.test(t)) return 'bigint';
    if (/^smallint(\(\d+\))?( unsigned)?$/.test(t)) return 'smallint';
    if (/^tinyint(\(\d+\))?( unsigned)?$/.test(t)) return 'boolean';
    if (/^varchar\((\d+)\)$/.test(t)) return 'varchar';
    if (/^char\((\d+)\)$/.test(t)) return 'char';
    if (t === 'text' || t === 'longtext' || t === 'mediumtext' || t === 'tinytext') return 'text';
    if (t === 'timestamp') return 'timestamp';
    if (t === 'datetime') return 'timestamp';
    if (t === 'date') return 'date';
    if (t === 'time') return 'time';
    if (t === 'boolean' || t === 'bool') return 'boolean';
    if (t === 'json' || t === 'jsonb') return 'jsonb';
    if (/^decimal\(/.test(t) || /^numeric\(/.test(t)) return 'decimal';
    if (/^float/.test(t)) return 'real';
    if (/^double/.test(t)) return 'double';
    if (/^real/.test(t)) return 'real';
    if (t === 'blob' || t === 'longblob' || t === 'mediumblob') return 'blob';
    if (t === 'uuid') return 'uuid';
    return t;
  }

  function canonicalJavaType(raw) {
    if (!raw) return 'unknown';
    const t = raw.toLowerCase().trim();
    if (t === 'long') return 'bigint';
    if (t === 'integer' || t === 'int') return 'integer';
    if (t === 'string') return 'varchar';
    if (t === 'boolean') return 'boolean';
    if (t === 'date' || t === 'localdatetime' || t === 'localdate') return 'timestamp';
    if (t === 'bigdecimal') return 'decimal';
    if (t === 'double') return 'double';
    if (t === 'float') return 'real';
    if (t === 'object' || t === 'map' || t === 'list') return 'jsonb';
    return 'varchar';
  }

  function canonicalDrizzleType(fnName) {
    if (!fnName) return 'unknown';
    const t = fnName.toLowerCase().trim();
    if (t === 'serial' || t === 'bigserial') return 'integer';
    if (t === 'integer' || t === 'int4' || t === 'int') return 'integer';
    if (t === 'bigint' || t === 'int8') return 'bigint';
    if (t === 'smallint' || t === 'int2') return 'smallint';
    if (t === 'varchar') return 'varchar';
    if (t === 'char') return 'char';
    if (t === 'text') return 'text';
    if (t === 'timestamp' || t === 'timestamptz') return 'timestamp';
    if (t === 'date') return 'date';
    if (t === 'time') return 'time';
    if (t === 'boolean' || t === 'bool') return 'boolean';
    if (t === 'json' || t === 'jsonb') return 'jsonb';
    if (t === 'decimal' || t === 'numeric') return 'decimal';
    if (t === 'real' || t === 'float4') return 'real';
    if (t === 'doubleprecision' || t === 'float8') return 'double';
    if (t === 'uuid') return 'uuid';
    if (t === 'blob' || t === 'bytea') return 'blob';
    return t;
  }

  function extractLength(raw, _type) {
    if (!raw) return null;
    const m = String(raw).match(/\((\d+)\)/);
    if (m) return Number(m[1]);
    return null;
  }

  // ---------------------------------------------------------------------------
  // SQL DDL 解析器 (MySQL CREATE TABLE)
  // ---------------------------------------------------------------------------

  function parseSqlCreateTable(content, tableName) {
    const tableRe = new RegExp(
      `CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?[\`"]?${escapeRegex(tableName)}[\`"]?\\s*\\(`,
      'i',
    );
    const startMatch = tableRe.exec(content);
    if (!startMatch) return null;

    const start = startMatch.index + startMatch[0].length;
    let depth = 1;
    let end = start;
    let inString = null;
    while (end < content.length && depth > 0) {
      const ch = content[end];
      if (inString) {
        if (ch === inString && content[end - 1] !== '\\') inString = null;
      } else {
        if (ch === "'" || ch === '"' || ch === '`') inString = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      end++;
    }
    if (depth !== 0) return null;

    const body = content.slice(start, end - 1);

    const lines = splitSqlDefinition(body);

    const fields = [];
    const primaryKeys = new Set();
    const uniqueFields = new Set();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (/^(PRIMARY\s+KEY|UNIQUE\s+KEY|UNIQUE\s+INDEX|UNIQUE\s+|KEY\s+|INDEX\s+|CONSTRAINT\s+|FOREIGN\s+KEY|CHECK\s+|FULLTEXT\s+)/i.test(trimmed)) {
        const pkMatch = trimmed.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const cols = pkMatch[1].split(',').map(s => s.replace(/[`"']/g, '').trim());
          cols.forEach(c => primaryKeys.add(c));
        }
        const uqMatch = trimmed.match(/UNIQUE\s+(?:KEY|INDEX)?\s*(?:[\`"][^]+?[\`"])?\s*\(([^)]+)\)/i);
        if (uqMatch) {
          const cols = uqMatch[1].split(',').map(s => s.replace(/[`"']/g, '').trim());
          if (cols.length === 1) uniqueFields.add(cols[0]);
        }
        continue;
      }

      const fieldMatch = trimmed.match(
        /^[\`"]?([a-zA-Z0-9_]+)[\`"]?\s+([a-zA-Z]+(?:\([^)]+\))?)(.*)$/i,
      );
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const rawType = fieldMatch[2].trim();
      const rest = fieldMatch[3] || '';

      if (/^(ENGINE|CHARACTER|COLLATE|ROW_FORMAT|AUTO_INCREMENT|COMMENT)\s*=/i.test(trimmed)) continue;

      const canonicalType = canonicalSqlType(rawType);
      const length = extractLength(rawType);

      const notNull = /NOT\s+NULL/i.test(rest) && !/NULL\s+DEFAULT/i.test(rest.replace(/NOT\s+NULL/i, ''));
      const hasDefault = /DEFAULT\s+/i.test(rest);
      let defaultValue = null;
      if (hasDefault) {
        const dm = rest.match(/DEFAULT\s+('([^']*)'|"([^"]*)"|NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|[\d.]+|\w+)/i);
        if (dm) {
          defaultValue = dm[2] !== undefined ? dm[2] : (dm[3] !== undefined ? dm[3] : dm[1]);
        }
      }
      const isAutoIncrement = /AUTO_INCREMENT/i.test(rest);
      const isUnique = /UNIQUE/i.test(rest) || uniqueFields.has(fieldName);
      const isPrimaryKey = /PRIMARY\s+KEY/i.test(rest) || primaryKeys.has(fieldName);

      fields.push({
        name: fieldName,
        rawType,
        canonicalType,
        length,
        notNull: notNull || isPrimaryKey,
        hasDefault,
        defaultValue,
        isUnique,
        isPrimaryKey,
        isAutoIncrement,
      });
    }

    for (const f of fields) {
      if (primaryKeys.has(f.name)) f.isPrimaryKey = true;
      if (uniqueFields.has(f.name)) f.isUnique = true;
    }

    return fields;
  }

  function splitSqlDefinition(body) {
    const parts = [];
    let depth = 0;
    let current = '';
    let inString = null;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (inString) {
        current += ch;
        if (ch === inString && body[i - 1] !== '\\') inString = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        current += ch;
        continue;
      }
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth--; current += ch; continue; }
      if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  // ---------------------------------------------------------------------------
  // Java Entity 解析器 (@Table 注解 + 字段声明)
  // ---------------------------------------------------------------------------

  function findJavaEntityFile(tableName) {
    let out;
    try {
      out = execFileSync('rg', [
        '--no-heading', '-l',
        '--glob', '*.java',
        '-e', `@Table\\s*\\(\\s*name\\s*=\\s*["']${escapeRegex(tableName)}["']`,
        OLD_ZHS_JAVA_DIR,
      ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    } catch (err) {
      if (err.status === 1) return null;
      throw err;
    }
    if (!out || !out.trim()) return null;
    return out.split(/\r?\n/)[0].trim();
  }

  function parseJavaEntity(filePath) {
    if (!filePath || !existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8', 'utf8');

    const fields = [];
    const lines = content.split(/\r?\n/);

    let pendingColumnName = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const colMatch = trimmed.match(/@Column\s*\(\s*name\s*=\s*["']([a-zA-Z0-9_]+)["']\s*\)/i);
      if (colMatch) {
        pendingColumnName = colMatch[1];
        continue;
      }
      const isId = /@Id\b/.test(trimmed);

      const fieldMatch = trimmed.match(
        /^(?:private|protected|public)\s+(?:final\s+)?([A-Za-z][A-Za-z0-9_<>,\s]*?)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=[^;]+)?;/,
      );
      if (fieldMatch) {
        const javaType = fieldMatch[1].trim();
        const javaField = fieldMatch[2];
        const columnName = pendingColumnName || camelToSnake(javaField);
        const canonicalType = canonicalJavaType(javaType);
        fields.push({
          name: columnName,
          rawType: javaType,
          canonicalType,
          length: null,
          notNull: false,
          hasDefault: false,
          defaultValue: null,
          isUnique: false,
          isPrimaryKey: isId,
          isAutoIncrement: false,
          _javaField: javaField,
        });
        pendingColumnName = null;
      } else if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*')) {
        if (!trimmed.startsWith('@') && !trimmed.startsWith('import') && !trimmed.startsWith('package')) {
          pendingColumnName = null;
        }
      }
    }

    return fields;
  }

  function camelToSnake(s) {
    return s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Drizzle schema 解析器 (pgTable)
  // ---------------------------------------------------------------------------

  function parseDrizzleSchema(filePath, tableName) {
    if (!filePath || !existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');

    const tableRe = new RegExp(
      `pgTable\\s*\\(\\s*['"\`]${escapeRegex(tableName)}['"\`]\\s*,\\s*\\{`,
      'i',
    );
    const startMatch = tableRe.exec(content);
    if (!startMatch) return null;

    const braceStart = startMatch.index + startMatch[0].lastIndexOf('{');
    let depth = 1;
    let end = braceStart + 1;
    let inString = null;
    while (end < content.length && depth > 0) {
      const ch = content[end];
      if (inString) {
        if (ch === inString && content[end - 1] !== '\\') inString = null;
      } else {
        if (ch === "'" || ch === '"' || ch === '`') inString = ch;
        else if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      end++;
    }
    if (depth !== 0) return null;

    const body = content.slice(braceStart + 1, end - 1);

    const lines = splitTsObjectBody(body);

    const fields = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const fieldMatch = trimmed.match(
        /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z]+)\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*(,\s*\{([^}]*)\})?\s*\)([\s\S]*)$/,
      );
      if (!fieldMatch) continue;

      const propertyName = fieldMatch[1];
      const drizzleFn = fieldMatch[2];
      const columnName = fieldMatch[3];
      const optsStr = fieldMatch[5] || '';
      const chain = fieldMatch[6] || '';

      const canonicalType = canonicalDrizzleType(drizzleFn);

      let length = null;
      const lenMatch = optsStr.match(/length\s*:\s*(\d+)/);
      if (lenMatch) length = Number(lenMatch[1]);

      const notNull = /\.notNull\s*\(\s*\)/.test(chain);
      const hasDefault = /\.default\s*\(/.test(chain) || /\.defaultNow\s*\(\s*\)/.test(chain) || /\.defaultRandom\s*\(\s*\)/.test(chain);
      let defaultValue = null;
      if (hasDefault) {
        const dm = chain.match(/\.default\s*\(\s*([^)]+?)\s*\)/);
        if (dm) defaultValue = dm[1].trim();
        else if (/\.defaultNow\s*\(\s*\)/.test(chain)) defaultValue = 'now()';
        else if (/\.defaultRandom\s*\(\s*\)/.test(chain)) defaultValue = 'random()';
      }
      const isUnique = /\.unique\s*\(\s*\)/.test(chain);
      const isPrimaryKey = /\.primaryKey\s*\(\s*\)/.test(chain);
      const isAutoIncrement = drizzleFn === 'serial' || drizzleFn === 'bigserial' || /\.autoincrement\s*\(\s*\)/.test(chain);

      fields.push({
        name: columnName,
        rawType: drizzleFn,
        canonicalType,
        length,
        notNull: notNull || isPrimaryKey,
        hasDefault,
        defaultValue,
        isUnique,
        isPrimaryKey,
        isAutoIncrement,
        _propertyName: propertyName,
      });
    }

    return fields;
  }

  function splitTsObjectBody(body) {
    const parts = [];
    let depth = 0;
    let current = '';
    let inString = null;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (inString) {
        current += ch;
        if (ch === inString && body[i - 1] !== '\\') inString = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        current += ch;
        continue;
      }
      if (ch === '(' || ch === '{' || ch === '[') { depth++; current += ch; continue; }
      if (ch === ')' || ch === '}' || ch === ']') { depth--; current += ch; continue; }
      if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  // ---------------------------------------------------------------------------
  // 字段级比对
  // ---------------------------------------------------------------------------

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function typeMatch(oldField, newField) {
    if (!oldField || !newField) return false;
    const oldT = oldField.canonicalType;
    const newT = newField.canonicalType;
    if (oldT === newT) return true;
    if ((oldT === 'bigint' && newT === 'integer') || (oldT === 'integer' && newT === 'bigint')) return true;
    return false;
  }

  function constraintMatch(oldField, newField) {
    if (!oldField || !newField) return { notNull: false, hasDefault: false, isUnique: false, isPrimaryKey: false, all: false };
    const notNull = oldField.notNull === newField.notNull;
    const hasDefault = oldField.hasDefault === newField.hasDefault;
    const isUnique = oldField.isUnique === newField.isUnique;
    const isPrimaryKey = oldField.isPrimaryKey === newField.isPrimaryKey;
    const all = notNull && isPrimaryKey;
    return { notNull, hasDefault, isUnique, isPrimaryKey, all };
  }

  function compareTable(sample) {
    const { old: oldTable, new: newTable, old_source: oldSource, new_file: newFile, module } = sample;

    let oldFields = null;
    let oldFilePath = '';
    if (oldSource === 'edu-init_database.sql') {
      oldFilePath = OLD_EDU_SQL;
      if (existsSync(OLD_EDU_SQL)) {
        const content = readFileSync(OLD_EDU_SQL, 'utf8');
        oldFields = parseSqlCreateTable(content, oldTable);
      }
    } else if (oldSource === 'zhs-py-sql') {
      const sqlFiles = readdirSync(OLD_ZHS_PY_SQL_DIR).filter(f => f.endsWith('.sql'));
      for (const f of sqlFiles) {
        const fp = join(OLD_ZHS_PY_SQL_DIR, f);
        const content = readFileSync(fp, 'utf8');
        oldFields = parseSqlCreateTable(content, oldTable);
        if (oldFields) { oldFilePath = fp; break; }
      }
    } else if (oldSource === 'ry-sql') {
      const sqlFiles = readdirSync(OLD_RY_SQL_DIR).filter(f => f.endsWith('.sql'));
      for (const f of sqlFiles) {
        const fp = join(OLD_RY_SQL_DIR, f);
        const content = readFileSync(fp, 'utf8');
        oldFields = parseSqlCreateTable(content, oldTable);
        if (oldFields) { oldFilePath = fp; break; }
      }
    } else if (oldSource === 'zhs-java-@Table') {
      oldFilePath = findJavaEntityFile(oldTable) || '';
      if (oldFilePath) {
        oldFields = parseJavaEntity(oldFilePath);
      }
    }

    let newFields = null;
    const newFilePath = join(NEW_SCHEMA_DIR, newFile);
    if (existsSync(newFilePath)) {
      newFields = parseDrizzleSchema(newFilePath, newTable);
    }

    const fieldRows = [];
    const oldMap = new Map();
    const newMap = new Map();
    if (oldFields) oldFields.forEach(f => oldMap.set(f.name.toLowerCase(), f));
    if (newFields) newFields.forEach(f => newMap.set(f.name.toLowerCase(), f));

    const allNames = new Set([...oldMap.keys(), ...newMap.keys()]);
    let matchedCount = 0;
    let typeMatchedCount = 0;
    let notNullMatchedCount = 0;
    let defaultMatchedCount = 0;
    let uniqueMatchedCount = 0;
    let pkMatchedCount = 0;

    for (const name of allNames) {
      const o = oldMap.get(name);
      const n = newMap.get(name);
      let status, typeMatchStr = '', notNullMatchStr = '', defaultMatchStr = '', uniqueMatchStr = '', pkMatchStr = '';

      if (o && n) {
        status = 'matched';
        matchedCount++;
        const tm = typeMatch(o, n);
        typeMatchStr = tm ? 'yes' : 'no';
        if (tm) typeMatchedCount++;
        const cm = constraintMatch(o, n);
        notNullMatchStr = cm.notNull ? 'yes' : 'no';
        if (cm.notNull) notNullMatchedCount++;
        defaultMatchStr = cm.hasDefault ? 'yes' : 'no';
        if (cm.hasDefault) defaultMatchedCount++;
        uniqueMatchStr = cm.isUnique ? 'yes' : 'no';
        if (cm.isUnique) uniqueMatchedCount++;
        pkMatchStr = cm.isPrimaryKey ? 'yes' : 'no';
        if (cm.isPrimaryKey) pkMatchedCount++;
      } else if (o && !n) {
        status = 'missing_in_new';
      } else {
        status = 'new_in_new';
      }

      fieldRows.push({
        old_table: oldTable,
        new_table: newTable,
        module,
        field_name: name,
        status,
        old_type: o ? o.canonicalType : '',
        old_raw_type: o ? o.rawType : '',
        old_length: o && o.length ? String(o.length) : '',
        old_not_null: o ? (o.notNull ? 'yes' : 'no') : '',
        old_has_default: o ? (o.hasDefault ? 'yes' : 'no') : '',
        old_default: o ? String(o.defaultValue || '') : '',
        old_unique: o ? (o.isUnique ? 'yes' : 'no') : '',
        old_pk: o ? (o.isPrimaryKey ? 'yes' : 'no') : '',
        old_auto_inc: o ? (o.isAutoIncrement ? 'yes' : 'no') : '',
        new_type: n ? n.canonicalType : '',
        new_raw_type: n ? n.rawType : '',
        new_length: n && n.length ? String(n.length) : '',
        new_not_null: n ? (n.notNull ? 'yes' : 'no') : '',
        new_has_default: n ? (n.hasDefault ? 'yes' : 'no') : '',
        new_default: n ? String(n.defaultValue || '') : '',
        new_unique: n ? (n.isUnique ? 'yes' : 'no') : '',
        new_pk: n ? (n.isPrimaryKey ? 'yes' : 'no') : '',
        new_auto_inc: n ? (n.isAutoIncrement ? 'yes' : 'no') : '',
        type_match: typeMatchStr,
        not_null_match: notNullMatchStr,
        default_match: defaultMatchStr,
        unique_match: uniqueMatchStr,
        pk_match: pkMatchStr,
      });
    }

    const oldFieldCount = oldFields ? oldFields.length : 0;
    const newFieldCount = newFields ? newFields.length : 0;

    return {
      oldTable, newTable, oldSource, newFile, module,
      oldFilePath, newFilePath,
      oldFieldCount, newFieldCount,
      matchedCount,
      typeMatchedCount,
      notNullMatchedCount,
      defaultMatchedCount,
      uniqueMatchedCount,
      pkMatchedCount,
      fields: fieldRows,
    };
  }

  // ---------------------------------------------------------------------------
  // 主流程
  // ---------------------------------------------------------------------------

  function main() {
    console.log('=== IHUI-AI DB Schema Field-Level Migration Audit ===\n');

    console.log('[1/4] Loading stage 3 CSV...');
    if (!existsSync(STAGE3_CSV)) {
      console.error(`[fatal] Stage 3 CSV not found: ${STAGE3_CSV}`);
      process.exit(1);
    }
    const csvContent = readFileSync(STAGE3_CSV, 'utf8');
    const csvLines = csvContent.split(/\r?\n/).filter(l => l.trim());
    const migratedFromCsv = [];
    for (let i = 1; i < csvLines.length; i++) {
      const cols = parseCsvLine(csvLines[i]);
      if (cols[0] === 'migrated') {
        migratedFromCsv.push({
          old_table: cols[1], new_table: cols[2],
          old_source: cols[3], new_file: cols[4],
        });
      }
    }
    console.log(`  Stage 3 migrated tables: ${migratedFromCsv.length}\n`);

    console.log('[2/4] Validating 20 sample tables...');
    for (const s of SAMPLE_TABLES) {
      const found = migratedFromCsv.find(m =>
        m.old_table === s.old && m.new_table === s.new && m.old_source === s.old_source
      );
      if (!found) {
        console.warn(`  [warn] sample not in stage 3 migrated: ${s.old} → ${s.new} (${s.old_source})`);
      }
    }
    console.log(`  Sample size: ${SAMPLE_TABLES.length} tables\n`);

    console.log('[3/4] Field-level comparison...');
    const results = [];
    for (const s of SAMPLE_TABLES) {
      const r = compareTable(s);
      results.push(r);
      console.log(`  ${s.module.padEnd(10)} ${s.old.padEnd(28)} → ${s.new.padEnd(28)} ` +
        `old=${r.oldFieldCount}f new=${r.newFieldCount}f matched=${r.matchedCount} ` +
        `type_ok=${r.typeMatchedCount} notnull_ok=${r.notNullMatchedCount} pk_ok=${r.pkMatchedCount}`);
    }
    console.log('');

    console.log('[4/4] Writing reports...');

    const csvHeader = [
      'old_table', 'new_table', 'module', 'field_name', 'status',
      'old_type', 'old_raw_type', 'old_length', 'old_not_null', 'old_has_default', 'old_default', 'old_unique', 'old_pk', 'old_auto_inc',
      'new_type', 'new_raw_type', 'new_length', 'new_not_null', 'new_has_default', 'new_default', 'new_unique', 'new_pk', 'new_auto_inc',
      'type_match', 'not_null_match', 'default_match', 'unique_match', 'pk_match',
    ];
    const csvRows = [csvHeader.join(',')];
    for (const r of results) {
      for (const f of r.fields) {
        csvRows.push([
          f.old_table, f.new_table, f.module, f.field_name, f.status,
          f.old_type, f.old_raw_type, f.old_length, f.old_not_null, f.old_has_default, csvEscape(f.old_default), f.old_unique, f.old_pk, f.old_auto_inc,
          f.new_type, f.new_raw_type, f.new_length, f.new_not_null, f.new_has_default, csvEscape(f.new_default), f.new_unique, f.new_pk, f.new_auto_inc,
          f.type_match, f.not_null_match, f.default_match, f.unique_match, f.pk_match,
        ].join(','));
      }
    }
    writeFileSync(CSV_PATH, csvRows.join('\n') + '\n', 'utf8');
    console.log(`  CSV: ${CSV_PATH}`);

    const totalOldFields = results.reduce((s, r) => s + r.oldFieldCount, 0);
    const totalNewFields = results.reduce((s, r) => s + r.newFieldCount, 0);
    const totalMatched = results.reduce((s, r) => s + r.matchedCount, 0);
    const totalTypeMatched = results.reduce((s, r) => s + r.typeMatchedCount, 0);
    const totalNotNullMatched = results.reduce((s, r) => s + r.notNullMatchedCount, 0);
    const totalDefaultMatched = results.reduce((s, r) => s + r.defaultMatchedCount, 0);
    const totalUniqueMatched = results.reduce((s, r) => s + r.uniqueMatchedCount, 0);
    const totalPkMatched = results.reduce((s, r) => s + r.pkMatchedCount, 0);

    const missingFields = [];
    const newFields = [];
    for (const r of results) {
      for (const f of r.fields) {
        if (f.status === 'missing_in_new') {
          missingFields.push({ table: r.oldTable, field: f.field_name, old_type: f.old_type });
        } else if (f.status === 'new_in_new') {
          newFields.push({ table: r.newTable, field: f.field_name, new_type: f.new_type });
        }
      }
    }

    const fieldCoveragePct = totalMatched === 0 ? 0 :
      Math.round((totalMatched / totalOldFields) * 1000) / 10;
    const typeMatchPct = totalMatched === 0 ? 0 :
      Math.round((totalTypeMatched / totalMatched) * 1000) / 10;
    const notNullMatchPct = totalMatched === 0 ? 0 :
      Math.round((totalNotNullMatched / totalMatched) * 1000) / 10;
    const defaultMatchPct = totalMatched === 0 ? 0 :
      Math.round((totalDefaultMatched / totalMatched) * 1000) / 10;
    const uniqueMatchPct = totalMatched === 0 ? 0 :
      Math.round((totalUniqueMatched / totalMatched) * 1000) / 10;
    const pkMatchPct = totalMatched === 0 ? 0 :
      Math.round((totalPkMatched / totalMatched) * 1000) / 10;

    const moduleStats = {};
    for (const r of results) {
      if (!moduleStats[r.module]) {
        moduleStats[r.module] = {
          tables: 0, oldFields: 0, newFields: 0, matched: 0,
          typeMatched: 0, notNullMatched: 0, pkMatched: 0,
        };
      }
      const m = moduleStats[r.module];
      m.tables++;
      m.oldFields += r.oldFieldCount;
      m.newFields += r.newFieldCount;
      m.matched += r.matchedCount;
      m.typeMatched += r.typeMatchedCount;
      m.notNullMatched += r.notNullMatchedCount;
      m.pkMatched += r.pkMatchedCount;
    }

    const summary = {
      generated_at: new Date().toISOString(),
      stage: 'field-level',
      stage3_csv: STAGE3_CSV,
      stage3_migrated_total: migratedFromCsv.length,
      sample_size: SAMPLE_TABLES.length,
      sample_modules: ['user', 'order', 'member', 'message', 'ai', 'role', 'permission', 'exam', 'comment'],
      sample_tables: results.map(r => ({
        module: r.module,
        old_table: r.oldTable,
        new_table: r.newTable,
        old_source: r.oldSource,
        old_file: r.oldFilePath,
        new_file: r.newFilePath,
        old_field_count: r.oldFieldCount,
        new_field_count: r.newFieldCount,
        matched: r.matchedCount,
        type_matched: r.typeMatchedCount,
        not_null_matched: r.notNullMatchedCount,
        pk_matched: r.pkMatchedCount,
      })),
      overall: {
        total_old_fields: totalOldFields,
        total_new_fields: totalNewFields,
        total_matched_fields: totalMatched,
        field_coverage_pct: fieldCoveragePct,
        type_match_pct: typeMatchPct,
        not_null_match_pct: notNullMatchPct,
        default_match_pct: defaultMatchPct,
        unique_match_pct: uniqueMatchPct,
        pk_match_pct: pkMatchPct,
        missing_fields_count: missingFields.length,
        new_fields_count: newFields.length,
      },
      module_stats: moduleStats,
      missing_fields: missingFields,
      new_fields: newFields,
      type_mapping_rules: {
        'INT/int': 'integer',
        'BIGINT': 'bigint',
        'TINYINT(1)': 'boolean',
        'VARCHAR(N)': 'varchar',
        'TEXT/LONGTEXT/MEDIUMTEXT': 'text',
        'TIMESTAMP/DATETIME': 'timestamp',
        'DATE': 'date',
        'BOOLEAN/BOOL': 'boolean',
        'JSON': 'jsonb',
        'DECIMAL/NUMERIC': 'decimal',
        'FLOAT': 'real',
        'UUID': 'uuid',
      },
      constraint_mapping_rules: {
        'NOT NULL': 'notNull()',
        'DEFAULT xxx': 'default(xxx)',
        'UNIQUE': 'unique()',
        'PRIMARY KEY': 'primaryKey()',
        'AUTO_INCREMENT': 'serial/autoincrement()',
      },
      csv_path: CSV_PATH,
    };

    writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`  Summary: ${SUMMARY_PATH}\n`);

    console.log('=== Field-Level Audit Complete ===');
    console.log(`Sample: ${SAMPLE_TABLES.length} tables | Old fields: ${totalOldFields} | New fields: ${totalNewFields} | Matched: ${totalMatched}`);
    console.log(`Field coverage: ${fieldCoveragePct}% | Type match: ${typeMatchPct}% | NOT NULL match: ${notNullMatchPct}% | PK match: ${pkMatchPct}%`);
    console.log(`Missing fields (D-only): ${missingFields.length} | New fields (new-only): ${newFields.length}`);
  }

  /** CSV 行解析 (处理引号转义) */
  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuote = false;
        else current += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ',') { result.push(current); current = ''; }
        else current += ch;
      }
    }
    result.push(current);
    return result;
  }

  /** CSV 字段转义 */
  function csvEscape(s) {
    if (s === null || s === undefined) return '';
    s = String(s);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  main();
}

// ─── 4. api-routes 模块(原 audit-migration-api-routes-v2.mjs)───────
function runApiRoutes() {
  // ─── 配置 ───────────────────────────────────────────────────────────
  const LEGACY_ROOTS = [
    'D:\\历史项目存档\\edu server',
    'D:\\历史项目存档\\code',
    'D:\\历史项目存档\\edu client',
    'D:\\历史项目存档\\ljd-交接文件',
  ]

  const NEW_ROUTES_ROOT = 'g:\\IHUI-AI\\apps\\api\\src\\routes'
  const RULES_PATH = 'g:\\IHUI-AI\\reports\\api-prefix-mapping-rules.json'

  // v1 真实缺失基线(用于 v1 vs v2 对比)
  const V1_REAL_MISSING = 806
  const V1_TOTAL_MISSING = 970

  // 业务模块关键词清单(沿用 v1)
  const BUSINESS_KEYWORDS = [
    'user', 'auth', 'order', 'pay', 'course', 'article', 'ai', 'chat', 'model',
    'agent', 'market', 'admin', 'file', 'upload', 'message', 'notification',
    'role', 'permission', 'category', 'tag', 'comment', 'stat', 'dashboard',
    'live', 'exam', 'learn', 'topic', 'ask', 'resource', 'point', 'member',
    'video', 'search', 'setting', 'system', 'menu', 'config', 'dept', 'post',
    'notice', 'dict', 'operlog', 'logininfor', 'news', 'contact', 'storage',
    'about', 'coze', 'mcp', 'developer', 'agreement', 'invoice', 'commission',
    'distribution', 'product', 'identity', 'activity', 'withdrawal', 'version',
    'feedback', 'site', 'remote', 'device', 'audit', 'fund', 'finance',
    'billing', 'wallet', 'plaza', 'rank', 'ranking', 'token', 'profile',
    'visit', 'workwechat', 'wechat', 'oauth', 'lecturer', 'statistics',
    'usercenter', 'remind', 'plan', 'material', 'class', 'schedule', 'tbox',
    'suno', 'sora', 'kling', 'gemini', 'ali', 'tencent', 'hunyuan', 'zhipu',
    'crew', 'workspace', 'team', 'organization', 'tenant', 'share', 'social',
    'group', 'community', 'circle', 'post', 'recommendation', 'mobile',
    'advertise', 'faq', 'carousel', 'announcement', 'app-version', 'checkin',
    'gamification', 'refund', 'callback', 'webhook', 'sdks', 'tools',
    'transcode', 'srs', 'drama', 'stock', 'trader', 'tbox', 'monitor',
    'telemetry', 'canary', 'i18n', 'gdpr', 'rbac', 'openclaw', 'clawdbot',
    'customer-service', 'n8n', 'outbound', 'packages', 'pricing', 'promotions',
    'push', 'report', 'rewarded-video-ad', 'service-catalog',
    'platform-templates', 'bi-dashboard', 'feature-center', 'agentic-service',
    'frontend-stub', 'education-platform', 'edu', 'knowledge-rag',
    'llm-models', 'chat-models', 'ai-vendors', 'ai-world', 'ai-feed',
    'ai-generation', 'ai-image-edit', 'ai-audio', 'ai-callback',
    'ai-chat-stream', 'ai-education', 'ai-user-model-chat', 'ai-video-compose',
    'ai-extended', 'auth-extended', 'auth-identity', 'auth-sso',
    'content-extended', 'payment-extended', 'payment-gateway', 'payment-recurring',
    'notification-extended', 'system-extended', 'remote-extended',
    'misc-extended', 'legacy-completion', 'migration-e2e', 'developer',
    'agent-extended', 'agent-runtime', 'agent-buy', 'agent-developer',
    'agent-withdrawal-detail', 'agreements', 'ask-extended', 'edu-extended',
    'edu-public', 'edu-stubs', 'live-extended', 'mcp-extended', 'p0-audit',
    'p30-supplement', 'fund', 'finance-extended', 'system', 'apps',
    'apps-platform', 'api-platform', 'exchange-rate', 'gray-release',
    'monitoring', 'sensitive-words', 'shop', 'zone', 'sys', 'missing-routes',
    'private-letters', 'error-dashboard', 'demand-square', 'faqq',
    'agreements', 'invoicestitles', 'member-permissions', 'member-users',
    'task-developer', 'user-agent-audio', 'user-agent-image', 'video-logs',
    'zhs-activity', 'zhs-agent', 'zhs-identity', 'zhs-user', 'zhs-course',
    'zhs-organization', 'system-login-logs', 'system-operation-logs',
    'identity-proportion', 'developer-link', 'auth-user-vip', 'auth-vip-level',
    'auth-tokens', 'auth-sms-temp', 'auth-role', 'auth-info', 'auth-accounts',
    'comment-logs', 'oss-files', 'stats', 'agreements', 'api-platform',
    'demand-audit', 'online-users', 'examine', 'menu', 'auth', 'user',
  ]

  // ─── 工具函数 ───────────────────────────────────────────────────────

  function runRg(pattern, searchPath, glob, extraArgs = []) {
    const args = ['--line-number', '--no-heading', '--with-filename', '--color', 'never']
    if (glob) args.push('-g', glob)
    args.push(...extraArgs)
    args.push('--', pattern, searchPath)
    try {
      return execFileSync('rg', args, {
        encoding: 'utf8',
        maxBuffer: 200 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (e) {
      if (e.status === 1) return ''
      const stderr = e.stderr ? e.stderr.toString() : ''
      throw new Error(`rg failed in ${searchPath}: ${e.message}\nstderr: ${stderr}`)
    }
  }

  function parseRgOutput(output) {
    const results = []
    for (const line of output.split(/\r?\n/)) {
      if (!line) continue
      const match = line.match(/^([^:]+:[^:]+):(\d+):(.*)$/)
      if (match) {
        results.push({ file: match[1], line: parseInt(match[2], 10), content: match[3] })
      } else {
        const idx1 = line.indexOf(':')
        const idx2 = line.indexOf(':', idx1 + 1)
        const idx3 = line.indexOf(':', idx2 + 1)
        if (idx3 > 0) {
          results.push({
            file: line.slice(0, idx2),
            line: parseInt(line.slice(idx2 + 1, idx3), 10),
            content: line.slice(idx3 + 1),
          })
        }
      }
    }
    return results
  }

  function extractJavaPaths(annotationContent) {
    const paths = []
    const pathRegex = /"([^"]*)"/g
    let m
    while ((m = pathRegex.exec(annotationContent)) !== null) {
      paths.push(m[1])
    }
    return paths
  }

  function joinPaths(prefix, suffix) {
    if (!suffix) return prefix || ''
    if (!prefix) return suffix
    return prefix.replace(/\/+$/, '') + '/' + suffix.replace(/^\/+/, '')
  }

  // ─── Java 端点扫描(沿用 v1 逻辑)─────────────────────────────────

  function scanJavaEndpoints() {
    const endpoints = []
    const controllerFiles = new Set()

    for (const root of LEGACY_ROOTS) {
      if (!fs.existsSync(root)) continue
      const output = runRg('@RestController', root, '*.java')
      for (const entry of parseRgOutput(output)) {
        controllerFiles.add(entry.file)
      }
    }

    for (const root of LEGACY_ROOTS) {
      if (!fs.existsSync(root)) continue
      const output = runRg('@Controller\\b', root, '*.java')
      for (const entry of parseRgOutput(output)) {
        const content = fs.readFileSync(entry.file, 'utf8')
        if (!content.includes('@RestController')) {
          controllerFiles.add(entry.file)
        }
      }
    }

    console.log(`  找到 ${controllerFiles.size} 个 Java controller 文件(含重复拷贝)`)

    const seenByRelPath = new Map()

    for (const file of controllerFiles) {
      let content
      try {
        content = fs.readFileSync(file, 'utf8')
      } catch {
        continue
      }

      let relPath = file
      for (const root of LEGACY_ROOTS) {
        if (file.startsWith(root)) {
          relPath = file.slice(root.length).replace(/^[\\\/]/, '')
          break
        }
      }

      const classMatch = content.match(/(?:@RestController|@Controller)[\s\S]{0,500}?public\s+class\s+(\w+)/)
      const className = classMatch ? classMatch[1] : path.basename(file, '.java')

      let classPrefix = ''
      if (classMatch) {
        const beforeClass = content.slice(0, content.indexOf(`class ${className}`))
        const classReqMatch = beforeClass.match(/@RequestMapping\s*\(([^)]*)\)/)
        if (classReqMatch) {
          const paths = extractJavaPaths(classReqMatch[1])
          if (paths.length > 0) classPrefix = paths[0]
        }
      }

      const methodEndpoints = []
      const annotationRegex = /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(([^)]*)\)/g
      let am
      while ((am = annotationRegex.exec(content)) !== null) {
        const annotationType = am[1]
        const args = am[2]
        const lineNum = content.slice(0, am.index).split('\n').length

        if (annotationType === 'RequestMapping' && classMatch) {
          const beforeClass = content.slice(0, content.indexOf(`class ${className}`))
          if (am.index < beforeClass.length) continue
        }

        let httpMethod
        if (annotationType === 'RequestMapping') {
          const methodMatch = args.match(/method\s*=\s*(?:RequestMethod\.)?(\w+)/)
          httpMethod = methodMatch ? methodMatch[1].toUpperCase() : 'ANY'
        } else {
          httpMethod = annotationType.replace('Mapping', '').toUpperCase()
        }

        let paths = extractJavaPaths(args)
        if (paths.length === 0) {
          paths = ['']
        }

        for (const p of paths) {
          const fullPath = joinPaths(classPrefix, p)
          methodEndpoints.push({
            httpMethod,
            path: fullPath,
            rawPath: p,
            classPrefix,
            line: lineNum,
          })
        }
      }

      if (seenByRelPath.has(relPath)) {
        continue
      }
      seenByRelPath.set(relPath, { file, className, endpoints: methodEndpoints })

      for (const ep of methodEndpoints) {
        endpoints.push({
          file,
          relPath,
          className,
          httpMethod: ep.httpMethod,
          path: ep.path,
          classPrefix: ep.classPrefix,
          rawPath: ep.rawPath,
          line: ep.line,
        })
      }
    }

    return { endpoints, uniqueControllers: seenByRelPath.size }
  }

  // ─── Fastify 路由扫描(沿用 v1 逻辑)─────────────────────────────

  function scanFastifyRoutes() {
    const routes = []
    if (!fs.existsSync(NEW_ROUTES_ROOT)) {
      console.log(`  路由目录不存在: ${NEW_ROUTES_ROOT}`)
      return routes
    }

    const output = runRg(
      '\\.(get|post|put|delete|patch)\\s*\\(\\s*[\'"`]',
      NEW_ROUTES_ROOT,
      '*.ts'
    )

    for (const entry of parseRgOutput(output)) {
      const { file, line, content } = entry
      const methodMatch = content.match(/\.(\w+)\s*\(\s*['"`]/)
      if (!methodMatch) continue
      const httpMethod = methodMatch[1].toUpperCase()

      const pathMatch = content.match(/\.\w+\s*\(\s*(['"`])([^'"`]*)\1/)
      if (!pathMatch) continue
      const routePath = pathMatch[2]

      routes.push({
        file,
        relPath: path.relative(NEW_ROUTES_ROOT, file).replace(/\\/g, '/'),
        httpMethod,
        path: routePath,
        line,
      })
    }

    return routes
  }

  // ─── 路径归一化(沿用 v1)─────────────────────────────────────────

  function normalizePath(p) {
    if (!p) return ''
    let s = p.trim()
    s = s.replace(/^\/api\/v\d+\//i, '/')
    s = s.replace(/^\/api\//i, '/')
    s = s.replace(/^\/v\d+\//i, '/')
    s = s.replace(/\{(\w+)\}/g, ':$1')
    s = s.replace(/\/+$/, '')
    if (s === '') s = '/'
    return s.toLowerCase()
  }

  function getPathModule(p) {
    const norm = normalizePath(p)
    const segments = norm.split('/').filter(Boolean)
    if (segments.length === 0) return ''
    return segments[0]
  }

  function getPathSegments(p) {
    const norm = normalizePath(p)
    return norm.split('/').filter(Boolean)
  }

  // ─── v2 新增:规则加载与应用 ─────────────────────────────────────

  function loadRules() {
    if (!fs.existsSync(RULES_PATH)) {
      throw new Error(`规则文件不存在: ${RULES_PATH}`)
    }
    const rules = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'))
    console.log(`  加载路由前缀映射规则: ${rules.prefixRules.length} 条 prefixRules, ${rules.moduleRules.length} 条 moduleRules, ${rules.skipModules.length} 条 skipModules`)
    return rules
  }

  /**
   * 应用 prefix 规则:剥离或重写 Java 前缀。
   */
  function applyPrefixRules(javaPath, prefixRules) {
    if (!javaPath) return { path: javaPath, appliedRule: null }
    for (const rule of prefixRules) {
      const prefix = rule.javaPrefix
      const re = new RegExp(`^${prefix.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}(\\/|$)`)
      if (re.test(javaPath)) {
        if (rule.strategy === 'prefix_strip') {
          const rest = javaPath.slice(prefix.length).replace(/^\/+/, '')
          const newPath = rest ? '/' + rest : '/'
          return { path: newPath, appliedRule: rule }
        }
        if (rule.strategy === 'prefix_rewrite') {
          const rest = javaPath.slice(prefix.length).replace(/^\/+/, '')
          const newPath = rest ? `${rule.ihuiPrefix}/${rest}` : rule.ihuiPrefix
          return { path: newPath, appliedRule: rule }
        }
      }
    }
    return { path: javaPath, appliedRule: null }
  }

  /**
   * 应用 module 规则:替换路径第 1 段业务模块名。
   */
  function applyModuleRules(p, moduleRules) {
    if (!p) return { path: p, appliedRule: null }
    const segs = p.split('/').filter(Boolean)
    if (segs.length === 0) return { path: p, appliedRule: null }
    const firstSeg = segs[0]
    for (const rule of moduleRules) {
      if (rule.javaModule === firstSeg) {
        segs[0] = rule.ihuiModule
        const newPath = '/' + segs.join('/')
        return { path: newPath, appliedRule: rule }
      }
    }
    return { path: p, appliedRule: null }
  }

  function isSkipModule(p, skipModules) {
    if (!p) return false
    const segs = p.split('/').filter(Boolean)
    if (segs.length === 0) return false
    const firstSeg = segs[0]
    return skipModules.some(r => r.javaModule === firstSeg)
  }

  // ─── 匹配策略(沿用 v1,但用转换后的路径)───────────────────────

  function matchEndpoint(javaEndpoint, fastifyRoutes, mappedPath) {
    const normJavaPath = normalizePath(mappedPath)
    const javaMethod = javaEndpoint.httpMethod

    const exactMatches = fastifyRoutes.filter(r => {
      if (javaMethod === 'ANY') return normalizePath(r.path) === normJavaPath
      return r.httpMethod === javaMethod && normalizePath(r.path) === normJavaPath
    })
    if (exactMatches.length > 0) {
      return {
        status: '已迁移',
        matchedRoutes: exactMatches,
        reason: `精确匹配: ${javaMethod} ${normJavaPath}`,
      }
    }

    const prefixMatches = fastifyRoutes.filter(r => {
      const normRoute = normalizePath(r.path)
      if (normRoute === '/' || normJavaPath === '/') return false
      const javaSegs = getPathSegments(mappedPath)
      const routeSegs = getPathSegments(r.path)
      if (javaSegs.length === 0 || routeSegs.length === 0) return false
      if (javaSegs[0] !== routeSegs[0]) return false
      return normRoute.startsWith(normJavaPath + '/') ||
             normJavaPath.startsWith(normRoute + '/') ||
             (javaSegs.length >= 2 && routeSegs.length >= 2 && javaSegs[1] === routeSegs[1])
    })
    if (prefixMatches.length > 0) {
      return {
        status: '部分迁移',
        matchedRoutes: prefixMatches.slice(0, 3),
        reason: `路径前缀匹配: ${normJavaPath} → ${prefixMatches.length} 个候选`,
      }
    }

    const javaModule = getPathModule(mappedPath)
    if (javaModule && BUSINESS_KEYWORDS.includes(javaModule)) {
      const keywordMatches = fastifyRoutes.filter(r => {
        const routeModule = getPathModule(r.path)
        return routeModule === javaModule
      })
      if (keywordMatches.length > 0) {
        return {
          status: '部分迁移',
          matchedRoutes: keywordMatches.slice(0, 3),
          reason: `业务模块匹配: ${javaModule}`,
        }
      }
    }

    return {
      status: '缺失',
      matchedRoutes: [],
      reason: `无匹配: ${javaMethod} ${normJavaPath}`,
    }
  }

  function findMatchingJavaEndpoint(route, javaEndpoints, mappedPaths) {
    const normRoute = normalizePath(route.path)
    let m = javaEndpoints.find((e, i) => {
      if (e.httpMethod === 'ANY') return normalizePath(mappedPaths[i]) === normRoute
      return e.httpMethod === route.httpMethod && normalizePath(mappedPaths[i]) === normRoute
    })
    if (m) return { match: m, type: 'exact' }

    m = javaEndpoints.find((e, i) => {
      const normJava = normalizePath(mappedPaths[i])
      if (normJava === '/' || normRoute === '/') return false
      return normRoute.startsWith(normJava + '/') ||
             normJava.startsWith(normRoute + '/')
    })
    if (m) return { match: m, type: 'prefix' }

    const routeModule = getPathModule(route.path)
    if (routeModule && BUSINESS_KEYWORDS.includes(routeModule)) {
      m = javaEndpoints.find((e, i) => getPathModule(mappedPaths[i]) === routeModule)
      if (m) return { match: m, type: 'module' }
    }
    return null
  }

  // ─── 主流程 ─────────────────────────────────────────────────────────
  function main() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const reportsDir = path.resolve('reports')
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true })

    console.log('=== 阶段 2 v2:API 端点 content-level 比对(带路由前缀映射规则)===\n')

    console.log('加载路由前缀映射规则...')
    const rules = loadRules()

    const ruleHits = {
      prefix: new Map(),
      module: new Map(),
      skip: new Map(),
    }

    console.log('\n扫描 D 盘 Java 端点...')
    const { endpoints: javaEndpoints, uniqueControllers } = scanJavaEndpoints()
    console.log(`  Java 端点总数: ${javaEndpoints.length}`)
    console.log(`  唯一 controller 文件数(去重): ${uniqueControllers}`)

    console.log('\n扫描当前仓库 Fastify 路由...')
    const fastifyRoutes = scanFastifyRoutes()
    console.log(`  Fastify 路由总数: ${fastifyRoutes.length}`)

    const javaUnique = new Map()
    for (const ep of javaEndpoints) {
      const key = `${ep.httpMethod}||${normalizePath(ep.path)}`
      if (!javaUnique.has(key)) javaUnique.set(key, ep)
    }
    const javaEndpointsUnique = Array.from(javaUnique.values())
    console.log(`  Java 端点去重后: ${javaEndpointsUnique.length}`)

    const fastifyUnique = new Map()
    for (const r of fastifyRoutes) {
      const key = `${r.httpMethod}||${normalizePath(r.path)}||${r.relPath}`
      if (!fastifyUnique.has(key)) fastifyUnique.set(key, r)
    }
    const fastifyRoutesUnique = Array.from(fastifyUnique.values())
    console.log(`  Fastify 路由去重后: ${fastifyRoutesUnique.length}`)

    console.log('\n应用路由前缀映射规则...')
    const mappedPaths = []
    const appliedRules = []
    let prefixAppliedCount = 0
    let moduleAppliedCount = 0
    let skippedCount = 0

    for (const ep of javaEndpointsUnique) {
      const { path: afterPrefix, appliedRule: prefixRule } = applyPrefixRules(ep.path, rules.prefixRules)
      if (prefixRule) {
        prefixAppliedCount++
        ruleHits.prefix.set(prefixRule, (ruleHits.prefix.get(prefixRule) || 0) + 1)
      }

      if (isSkipModule(afterPrefix, rules.skipModules)) {
        skippedCount++
        const skipRule = rules.skipModules.find(r => {
          const segs = afterPrefix.split('/').filter(Boolean)
          return segs.length > 0 && segs[0] === r.javaModule
        })
        if (skipRule) ruleHits.skip.set(skipRule, (ruleHits.skip.get(skipRule) || 0) + 1)
        mappedPaths.push(afterPrefix)
        appliedRules.push({ prefix: prefixRule, module: null, skipped: skipRule || true })
        continue
      }

      const { path: afterModule, appliedRule: moduleRule } = applyModuleRules(afterPrefix, rules.moduleRules)
      if (moduleRule) {
        moduleAppliedCount++
        ruleHits.module.set(moduleRule, (ruleHits.module.get(moduleRule) || 0) + 1)
      }

      mappedPaths.push(afterModule)
      appliedRules.push({ prefix: prefixRule, module: moduleRule, skipped: null })
    }

    console.log(`  prefix 规则命中: ${prefixAppliedCount} 个端点`)
    console.log(`  module 规则命中: ${moduleAppliedCount} 个端点`)
    console.log(`  skip 模块跳过: ${skippedCount} 个端点`)

    console.log('\n执行匹配(精确 > 前缀 > 业务模块)...')
    const auditResults = []
    const stats = {
      已迁移: 0,
      部分迁移: 0,
      缺失: 0,
      无需迁移: 0,
      已跳过: 0,
    }

    for (let i = 0; i < javaEndpointsUnique.length; i++) {
      const ep = javaEndpointsUnique[i]
      const mappedPath = mappedPaths[i]
      const applied = appliedRules[i]

      if (applied.skipped) {
        auditResults.push({
          source: 'java',
          httpMethod: ep.httpMethod,
          path: ep.path,
          mappedPath,
          normalizedPath: normalizePath(ep.path),
          legacyFile: ep.relPath,
          legacyClass: ep.className,
          status: '已跳过',
          appliedRule: applied.skipped ? (applied.skipped.javaModule || 'skip') : '',
          matchedRoutes: '',
          reason: applied.skipped.reason || 'skip_module',
        })
        stats['已跳过']++
        continue
      }

      const match = matchEndpoint(ep, fastifyRoutesUnique, mappedPath)
      const appliedRuleDesc = [
        applied.prefix ? `prefix:${applied.prefix.javaPrefix}→${applied.prefix.ihuiPrefix || '(strip)'}` : '',
        applied.module ? `module:${applied.module.javaModule}→${applied.module.ihuiModule}` : '',
      ].filter(Boolean).join('; ')

      auditResults.push({
        source: 'java',
        httpMethod: ep.httpMethod,
        path: ep.path,
        mappedPath,
        normalizedPath: normalizePath(mappedPath),
        legacyFile: ep.relPath,
        legacyClass: ep.className,
        status: match.status,
        appliedRule: appliedRuleDesc,
        matchedRoutes: match.matchedRoutes.map(r =>
          `${r.httpMethod} ${r.path} (${r.relPath}:${r.line})`
        ).join(' | '),
        reason: match.reason,
      })
      stats[match.status] = (stats[match.status] || 0) + 1
    }

    for (const r of fastifyRoutesUnique) {
      const matched = findMatchingJavaEndpoint(r, javaEndpointsUnique, mappedPaths)
      if (!matched) {
        auditResults.push({
          source: 'fastify',
          httpMethod: r.httpMethod,
          path: r.path,
          mappedPath: r.path,
          normalizedPath: normalizePath(r.path),
          legacyFile: '',
          legacyClass: '',
          status: '无需迁移',
          appliedRule: '',
          matchedRoutes: `${r.httpMethod} ${r.path} (${r.relPath}:${r.line})`,
          reason: '当前仓库新增端点(无 Java 对应)',
        })
        stats['无需迁移']++
      }
    }

    console.log('\n=== 匹配结果统计 ===')
    console.log(`已迁移: ${stats['已迁移']}`)
    console.log(`部分迁移: ${stats['部分迁移']}`)
    console.log(`缺失: ${stats['缺失']}`)
    console.log(`已跳过(skip 模块): ${stats['已跳过']}`)
    console.log(`无需迁移(新增): ${stats['无需迁移']}`)
    console.log(`总计: ${auditResults.length}`)

    const missingResults = auditResults.filter(r => r.status === '缺失')
    const missingAnalysis = analyzeMissingEndpoints(missingResults, fastifyRoutesUnique)
    console.log('\n=== 缺失端点分析 ===')
    console.log(`缺失总数: ${missingResults.length}`)
    console.log(`  语言迁移预期(有同模块的 Fastify 路由): ${missingAnalysis.languageMigration}`)
    console.log(`  真实缺失(无任何同模块路由): ${missingAnalysis.realMissing}`)
    console.log(`  无路径端点: ${missingAnalysis.noPath}`)

    const csvPath = path.join(reportsDir, `migration-audit-api-routes-v2-${timestamp}.csv`)
    const csvLines = [
      'source,httpMethod,path,mappedPath,normalizedPath,legacyFile,legacyClass,status,appliedRule,matchedRoutes,reason',
    ]
    for (const r of auditResults) {
      const escape = s => `"${String(s).replace(/"/g, '""')}"`
      csvLines.push([
        r.source, r.httpMethod, r.path, r.mappedPath, r.normalizedPath,
        r.legacyFile, r.legacyClass, r.status, r.appliedRule, r.matchedRoutes, r.reason,
      ].map(escape).join(','))
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')
    console.log(`\n审计 CSV: ${csvPath}`)

    const summaryPath = path.join(reportsDir, `migration-audit-api-routes-v2-summary.json`)
    const totalJava = javaEndpointsUnique.length
    const totalFastify = fastifyRoutesUnique.length

    const v2RealMissing = missingAnalysis.realMissing
    const compressionRate = V1_REAL_MISSING > 0
      ? ((V1_REAL_MISSING - v2RealMissing) / V1_REAL_MISSING * 100).toFixed(1)
      : '0.0'

    const prefixRuleHits = rules.prefixRules.map(r => ({
      javaPrefix: r.javaPrefix,
      ihuiPrefix: r.ihuiPrefix,
      strategy: r.strategy,
      hits: ruleHits.prefix.get(r) || 0,
      reason: r.reason,
    }))
    const moduleRuleHits = rules.moduleRules.map(r => ({
      javaModule: r.javaModule,
      ihuiModule: r.ihuiModule,
      hits: ruleHits.module.get(r) || 0,
      reason: r.reason,
    }))
    const skipRuleHits = rules.skipModules.map(r => ({
      javaModule: r.javaModule,
      hits: ruleHits.skip.get(r) || 0,
      reason: r.reason,
    }))

    const summary = {
      timestamp,
      phase: '阶段 2 v2: API 端点 content-level 比对(带路由前缀映射规则)',
      legacyRoots: LEGACY_ROOTS,
      newRoutesRoot: NEW_ROUTES_ROOT,
      rulesPath: RULES_PATH,
      javaEndpointsTotal: javaEndpoints.length,
      javaEndpointsUnique: totalJava,
      javaUniqueControllers: uniqueControllers,
      fastifyRoutesTotal: fastifyRoutes.length,
      fastifyRoutesUnique: totalFastify,
      ruleApplicationStats: {
        prefixRuleHits: prefixAppliedCount,
        moduleRuleHits: moduleAppliedCount,
        skipModuleHits: skippedCount,
      },
      stats: {
        已迁移: stats['已迁移'],
        部分迁移: stats['部分迁移'],
        缺失: stats['缺失'],
        已跳过: stats['已跳过'],
        无需迁移: stats['无需迁移'],
      },
      missingAnalysis: {
        totalMissing: missingResults.length,
        languageMigrationExpected: missingAnalysis.languageMigration,
        realMissing: missingAnalysis.realMissing,
        noPath: missingAnalysis.noPath,
        realMissingExamples: missingAnalysis.realMissingExamples,
      },
      v1VsV2Comparison: {
        v1TotalMissing: V1_TOTAL_MISSING,
        v1RealMissing: V1_REAL_MISSING,
        v2TotalMissing: missingResults.length,
        v2RealMissing: v2RealMissing,
        realMissingReduction: V1_REAL_MISSING - v2RealMissing,
        compressionRate: `${compressionRate}%`,
        targetMet: v2RealMissing < 200,
      },
      ruleEffectiveness: {
        prefixRules: prefixRuleHits,
        moduleRules: moduleRuleHits,
        skipModules: skipRuleHits,
      },
      nextPhaseRecommendation: v2RealMissing > 0 && v2RealMissing <= 200
        ? `v2 真实缺失 ${v2RealMissing} 个已落入 100-200 阈值,可进入阶段 3:对真实缺失端点做业务影响评估`
        : v2RealMissing > 200
          ? `v2 真实缺失 ${v2RealMissing} 个仍超 200 阈值,需补充更多 module 规则或人工评估`
          : '所有缺失端点已通过规则化匹配,可考虑阶段 3 数据库表/i18n key 比对',
    }
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
    console.log(`摘要 JSON: ${summaryPath}`)

    rules.prefixRules = rules.prefixRules.map(r => ({
      ...r,
      hits: ruleHits.prefix.get(r) || 0,
    }))
    rules.moduleRules = rules.moduleRules.map(r => ({
      ...r,
      hits: ruleHits.module.get(r) || 0,
    }))
    rules.skipModules = rules.skipModules.map(r => ({
      ...r,
      hits: ruleHits.skip.get(r) || 0,
    }))
    rules.lastRunAt = timestamp
    fs.writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2), 'utf8')
    console.log(`规则命中已回写: ${RULES_PATH}`)

    if (javaEndpoints.length === 0 && fastifyRoutes.length === 0) {
      console.error('\n❌ 审计失败:无任何端点被审计')
      process.exit(1)
    }
    console.log('\n✅ 审计完成')
    console.log(`\n=== v1 vs v2 对比 ===`)
    console.log(`v1 真实缺失: ${V1_REAL_MISSING}`)
    console.log(`v2 真实缺失: ${v2RealMissing}`)
    console.log(`压缩率: ${compressionRate}%`)
    console.log(`目标 < 200: ${v2RealMissing < 200 ? '✅ 达成' : '❌ 未达成'}`)
    process.exit(0)
  }

  /**
   * 分析缺失端点(沿用 v1 逻辑,但使用 mappedPath)
   */
  function analyzeMissingEndpoints(missingResults, fastifyRoutesUnique) {
    let languageMigration = 0
    let realMissing = 0
    let noPath = 0
    const realMissingExamples = []

    const fastifyModules = new Set()
    for (const r of fastifyRoutesUnique) {
      const m = getPathModule(r.path)
      if (m) fastifyModules.add(m)
    }

    for (const r of missingResults) {
      // v2 用 mappedPath 做 module 判断
      const checkPath = r.mappedPath || r.path
      if (!checkPath || checkPath === '') {
        noPath++
        continue
      }
      const mod = getPathModule(checkPath)
      if (!mod) {
        noPath++
        continue
      }
      if (fastifyModules.has(mod) || BUSINESS_KEYWORDS.includes(mod)) {
        languageMigration++
      } else {
        realMissing++
        if (realMissingExamples.length < 30) {
          realMissingExamples.push({
            httpMethod: r.httpMethod,
            originalPath: r.path,
            mappedPath: r.mappedPath,
            module: mod,
            legacyClass: r.legacyClass,
            legacyFile: r.legacyFile,
          })
        }
      }
    }

    return { languageMigration, realMissing, noPath, realMissingExamples }
  }

  main()
}

// ─── 主入口 ─────────────────────────────────────────────────────────
const target = parseArgs(process.argv)
if (!target) {
  showHelp()
  process.exit(0)
}

switch (target) {
  case 'i18n':
    runI18n()
    break
  case 'frontend-routes':
    runFrontendRoutes()
    break
  case 'db-fields':
    runDbFields()
    break
  case 'api-routes':
    runApiRoutes()
    break
  default:
    console.error(`❌ 无效的 target: ${target}`)
    showHelp(console.error)
    process.exit(1)
}