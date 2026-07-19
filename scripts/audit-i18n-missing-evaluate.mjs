#!/usr/bin/env node
/**
 * i18n 缺失 key 三分类评估脚本(阶段 6)
 *
 * 输入:
 *   - reports/migration-audit-i18n-2026-07-19T12-24-24.csv(阶段 5 比对结果)
 *   - apps/web/messages/zh-CN.json(当前仓库基准语言)
 *
 * 输出:
 *   - reports/migration-audit-i18n-missing-evaluation-{timestamp}.csv(逐 key 决策)
 *   - reports/migration-audit-i18n-missing-evaluation-summary.json(统计 + 清单)
 *   - reports/i18n-missing-evaluation-report.md(人类可读报告)
 *
 * 三分类:
 *   - 补齐(补迁移):common 通用文案,当前仓库缺少该 leaf,可补到 common.*
 *   - 重写已迁移:leaf 已在当前仓库其他模块下用新 key 实现
 *   - 废弃(不迁移):已废弃组件/命名空间根标识/旧项目特有功能
 */

import fs from 'node:fs'

// ─── 路径配置 ────────────────────────────────────────────────────
const CSV_PATH = 'g:\\IHUI-AI\\reports\\migration-audit-i18n-2026-07-19T12-24-24.csv'
const ZH_CN_PATH = 'g:\\IHUI-AI\\apps\\web\\messages\\zh-CN.json'
const OUT_CSV = (ts) => `g:\\IHUI-AI\\reports\\migration-audit-i18n-missing-evaluation-${ts}.csv`
const OUT_SUMMARY = 'g:\\IHUI-AI\\reports\\migration-audit-i18n-missing-evaluation-summary.json'
const OUT_REPORT = 'g:\\IHUI-AI\\reports\\i18n-missing-evaluation-report.md'

// ─── 复用 audit-migration-i18n.mjs 的常量(保持判定一致) ──────────
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

const NAMESPACE_PREFIXES = [
  'common', 'nav', 'navbar', 'api', 'app', 'web', 'admin', 'client',
  'shared', 'global', 'general', 'main', 'page', 'pages', 'view',
  'views', 'component', 'components', 'ui', 'element', 'el', 'form',
  'table', 'list', 'button', 'message', 'dialog', 'modal',
]

// ─── 已废弃的旧组件/功能模块(高优先级 → 废弃) ──────────────────
// 这些模块在当前仓库完全不存在,且为旧项目特有的组件/功能,无需迁移
const DEPRECATED_MODULES = new Set([
  'unified_login_button', // 统一登录按钮组件(新项目用 common.login / auth.*)
  'header_search',         // 头部搜索组件(新项目用 nav.search / search.*)
  'right_toolbar',         // 右侧工具栏组件(新项目无此独立组件)
  'crontab',               // cron 表达式编辑器(新项目无此功能)
  'image_upload',          // imageUpload 命名空间根(新项目用 common.upload / fileUpload)
  'table_column',          // tableColumn 配置(新项目无独立模块)
  'validation_message',    // validationMessage 命名空间(新项目用 formValidation.*)
  'query',                 // query 命名空间(新项目用 search.*)
  'data',                  // data 命名空间(新项目无此独立模块)
])

// ─── 工具函数(复用 audit-migration-i18n.mjs 逻辑) ──────────────
function camelToSnake(s) {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
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

// ─── CSV 解析(支持引号转义) ─────────────────────────────────────
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c
    i++
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

// ─── JSON 扁平化(嵌套对象 → 点号分隔 key 列表) ─────────────────
function flattenKeys(obj, prefix = '') {
  const result = []
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return result
  for (const [k, v] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      result.push(...flattenKeys(v, newKey))
    } else {
      result.push(newKey)
    }
  }
  return result
}

// ─── 三分类评估 ─────────────────────────────────────────────────
/**
 * @param {string} legacyKey 原始 D 盘 key(如 "common.systemTip")
 * @param {string} module 归一化后的模块名(如 "system_tip")
 * @param {string} leaf 归一化后的 leaf 段
 * @param {string} originalFirstSeg 原始 legacyKey 的第一段(如 "common")
 * @param {boolean} leafExistsInCurrentRepo leaf 是否在当前仓库存在(后缀匹配)
 * @returns {{decision: string, reason: string}}
 */
function evaluate(legacyKey, module, leaf, originalFirstSeg, leafExistsInCurrentRepo) {
  // Rule 1: 单段命名空间根标识(无实际文案内容)
  if (!legacyKey.includes('.')) {
    return {
      decision: '废弃',
      reason: `命名空间根标识 "${legacyKey}" 无实际文案内容,无需迁移`,
    }
  }

  // Rule 2: 模块 ∈ DEPRECATED_MODULES(已废弃的旧组件/功能)
  if (DEPRECATED_MODULES.has(module)) {
    return {
      decision: '废弃',
      reason: `模块 "${module}" 为已废弃的旧组件/功能,新项目无对应实现`,
    }
  }

  // Rule 3: 原 common.* 命名空间(common 模块在当前仓库存在,可补迁移)
  if (originalFirstSeg === 'common') {
    if (leafExistsInCurrentRepo) {
      return {
        decision: '重写已迁移',
        reason: `common 通用文案,leaf "${leaf}" 已在当前仓库其他模块下存在,无需补迁移`,
      }
    }
    return {
      decision: '补齐',
      reason: `common 通用文案,当前仓库 common.* 缺少 leaf "${leaf}",建议补迁移`,
    }
  }

  // Rule 4: leaf 在当前仓库存在(后缀匹配,功能已用新 key 实现)
  if (leafExistsInCurrentRepo) {
    return {
      decision: '重写已迁移',
      reason: `leaf "${leaf}" 已在当前仓库其他模块下用新 key 实现,无需补迁移`,
    }
  }

  // Rule 5: 兜底(模块为旧项目特有功能,新项目无对应实现)
  return {
    decision: '废弃',
    reason: `模块 "${module}" 为旧项目特有功能,新项目无对应实现`,
  }
}

// ─── 报告生成 ───────────────────────────────────────────────────
function generateReport(summary) {
  const lines = []
  lines.push(`# i18n 缺失 key 三分类评估报告`)
  lines.push(``)
  lines.push(`> 生成时间: ${summary.timestamp}`)
  lines.push(`> 评估对象: 阶段 5 真实缺失 key(共 ${summary.totalRealMissing} 个)`)
  lines.push(`> 评估依据: 当前仓库 zh-CN.json 实际 key 集 + 模块业务语义`)
  lines.push(`> 数据来源: reports/migration-audit-i18n-2026-07-19T12-24-24.csv`)
  lines.push(``)
  lines.push(`## 1. 三分类统计`)
  lines.push(``)
  lines.push(`| 决策 | 数量 | 占比 |`)
  lines.push(`| --- | --- | --- |`)
  lines.push(`| 补齐(补迁移) | ${summary.stats.补齐} | ${summary.percentages.补齐} |`)
  lines.push(`| 重写已迁移 | ${summary.stats.重写已迁移} | ${summary.percentages.重写已迁移} |`)
  lines.push(`| 废弃(不迁移) | ${summary.stats.废弃} | ${summary.percentages.废弃} |`)
  lines.push(`| **总计** | **${summary.totalRealMissing}** | **100%** |`)
  lines.push(``)
  lines.push(`## 2. Top 10 模块决策明细`)
  lines.push(``)
  lines.push(`| 模块 | 总数 | 补齐 | 重写已迁移 | 废弃 |`)
  lines.push(`| --- | --- | --- | --- | --- |`)
  for (const m of summary.topModules) {
    lines.push(`| ${m.module} | ${m.total} | ${m.补齐} | ${m.重写已迁移} | ${m.废弃} |`)
  }
  lines.push(``)
  lines.push(`## 3. 补齐清单(可立即补迁移)`)
  lines.push(``)
  lines.push(`共 ${summary.fillList.length} 个 key,建议补迁移到当前仓库 common.* 或对应模块下:`)
  lines.push(``)
  if (summary.fillList.length > 0) {
    lines.push('```')
    for (const k of summary.fillList) lines.push(k)
    lines.push('```')
  } else {
    lines.push('(无)')
  }
  lines.push(``)
  lines.push(`## 4. 重写已迁移清单(无需补)`)
  lines.push(``)
  lines.push(`共 ${summary.rewriteList.length} 个 key,功能已在当前仓库其他模块下用新 key 实现:`)
  lines.push(``)
  if (summary.rewriteList.length > 0) {
    lines.push('```')
    for (const k of summary.rewriteList) lines.push(k)
    lines.push('```')
  } else {
    lines.push('(无)')
  }
  lines.push(``)
  lines.push(`## 5. 废弃清单(无需补)`)
  lines.push(``)
  lines.push(`共 ${summary.discardList.length} 个 key,模块/功能已废弃,新项目无对应实现:`)
  lines.push(``)
  if (summary.discardList.length > 0) {
    lines.push('```')
    for (const k of summary.discardList) lines.push(k)
    lines.push('```')
  } else {
    lines.push('(无)')
  }
  lines.push(``)
  lines.push(`## 6. 评估规则`)
  lines.push(``)
  lines.push(`| 优先级 | 规则 | 决策 |`)
  lines.push(`| --- | --- | --- |`)
  lines.push(`| 1 | 单段命名空间根标识(如 "common"、"navbar") | 废弃 |`)
  lines.push(`| 2 | 模块 ∈ DEPRECATED_MODULES(unified_login_button / header_search / right_toolbar / crontab / image_upload / table_column / validation_message / query / data) | 废弃 |`)
  lines.push(`| 3 | 原 common.* 命名空间 + leaf 在当前仓库不存在 | 补齐 |`)
  lines.push(`| 3' | 原 common.* 命名空间 + leaf 在当前仓库已存在 | 重写已迁移 |`)
  lines.push(`| 4 | leaf 在当前仓库存在(后缀匹配) | 重写已迁移 |`)
  lines.push(`| 5 | 兜底(模块为旧项目特有功能,新项目无对应实现) | 废弃 |`)
  lines.push(``)
  lines.push(`## 7. 全模块决策明细(共 ${summary.totalModules} 个模块)`)
  lines.push(``)
  lines.push(`| 模块 | 总数 | 补齐 | 重写已迁移 | 废弃 |`)
  lines.push(`| --- | --- | --- | --- | --- |`)
  const allModules = Object.entries(summary.moduleStats)
    .sort((a, b) => b[1].total - a[1].total)
  for (const [mod, s] of allModules) {
    lines.push(`| ${mod} | ${s.total} | ${s.补齐} | ${s.重写已迁移} | ${s.废弃} |`)
  }
  lines.push(``)
  return lines.join('\n')
}

// ─── 主流程 ─────────────────────────────────────────────────────
function main() {
  console.log('=== i18n 缺失 key 三分类评估(阶段 6) ===\n')

  // 1. 读取阶段 5 CSV
  console.log(`读取 CSV: ${CSV_PATH}`)
  const csvText = fs.readFileSync(CSV_PATH, 'utf-8')
  const rows = parseCSV(csvText)
  if (rows.length === 0) {
    console.error('CSV 为空,终止')
    process.exit(1)
  }
  const header = rows[0]
  console.log(`CSV header: ${header.join(', ')}`)
  const dataRows = rows.slice(1).filter(r => r.length === header.length)
  console.log(`CSV 数据行: ${dataRows.length}`)

  // 2. 筛选缺失 key(status === "缺失")
  const missingRows = dataRows
    .filter(r => r[4] === '缺失')
    .map(r => ({
      source: r[0],
      legacyKey: r[1],
      normalizedKey: r[2],
      sourceFiles: r[3],
      status: r[4],
      matchedKeys: r[5],
      reason: r[6],
    }))
  console.log(`\n缺失 key 总数: ${missingRows.length}`)

  // 3. 读取当前仓库 zh-CN.json
  console.log(`\n读取当前仓库 zh-CN.json: ${ZH_CN_PATH}`)
  const zhCn = JSON.parse(fs.readFileSync(ZH_CN_PATH, 'utf-8'))
  const currentKeys = flattenKeys(zhCn)
  const currentKeySet = new Set(currentKeys)
  console.log(`当前仓库 zh-CN.json key 总数: ${currentKeySet.size}`)

  // 4. 构建模块索引(归一化模块 → [keys])
  const newKeyModuleMap = new Map()
  for (const k of currentKeys) {
    const mod = getKeyModule(k)
    if (mod) {
      if (!newKeyModuleMap.has(mod)) newKeyModuleMap.set(mod, [])
      newKeyModuleMap.get(mod).push(k)
    }
  }

  // 5. 构建 leaf 后缀索引(leaf → [keys])
  const leafMap = new Map()
  for (const k of currentKeys) {
    const segs = k.split('.')
    const leaf = segs[segs.length - 1].toLowerCase()
    if (!leafMap.has(leaf)) leafMap.set(leaf, [])
    leafMap.get(leaf).push(k)
  }

  // 6. 应用 realMissing 过滤(复用 audit-migration-i18n.mjs 逻辑)
  //    真实缺失 = D 盘 key 的业务模块在当前仓库完全没有任何 key
  //              AND 模块不在 BUSINESS_KEYWORDS 中
  const realMissingRows = []
  for (const r of missingRows) {
    const mod = getKeyModule(r.legacyKey)
    if (!mod) continue
    const newKeysForModule = newKeyModuleMap.get(mod) || []
    if (newKeysForModule.length > 0 || BUSINESS_KEYWORDS.includes(mod)) {
      // languageMigrationExpected,跳过
      continue
    }
    realMissingRows.push({ ...r, module: mod })
  }
  console.log(`\n真实缺失 key 总数: ${realMissingRows.length}`)

  if (realMissingRows.length === 0) {
    console.error('未找到真实缺失 key,终止')
    process.exit(1)
  }

  // 7. 逐 key 三分类评估
  for (const r of realMissingRows) {
    const { segments } = normalizeKey(r.legacyKey)
    const leaf = segments[segments.length - 1] || ''
    const originalFirstSeg = r.legacyKey.split('.')[0]

    // leaf 在当前仓库后缀匹配
    const leafMatches = leafMap.get(leaf) || []
    r.leaf = leaf
    r.originalFirstSeg = originalFirstSeg
    r.currentRepoMatches = leafMatches.slice(0, 3).join(' | ')

    const result = evaluate(r.legacyKey, r.module, leaf, originalFirstSeg, leafMatches.length > 0)
    r.decision = result.decision
    r.evalReason = result.reason
  }

  // 8. 输出 CSV
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const csvOutPath = OUT_CSV(ts)
  const csvLines = [
    'module,legacyKey,normalizedKey,leaf,originalFirstSeg,currentRepoMatches,decision,evalReason',
  ]
  for (const r of realMissingRows) {
    const fields = [
      r.module,
      r.legacyKey,
      r.normalizedKey,
      r.leaf,
      r.originalFirstSeg,
      r.currentRepoMatches,
      r.decision,
      r.evalReason,
    ]
    csvLines.push(fields.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
  }
  fs.writeFileSync(csvOutPath, csvLines.join('\n'), 'utf-8')
  console.log(`\nCSV 已写入: ${csvOutPath}`)

  // 9. 输出 summary.json
  const stats = { 补齐: 0, 重写已迁移: 0, 废弃: 0 }
  for (const r of realMissingRows) stats[r.decision]++

  const moduleStats = {}
  for (const r of realMissingRows) {
    if (!moduleStats[r.module]) {
      moduleStats[r.module] = { total: 0, 补齐: 0, 重写已迁移: 0, 废弃: 0 }
    }
    moduleStats[r.module].total++
    moduleStats[r.module][r.decision]++
  }

  const topModules = Object.entries(moduleStats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([mod, s]) => ({ module: mod, ...s }))

  const fillList = realMissingRows
    .filter(r => r.decision === '补齐')
    .map(r => r.legacyKey)
  const rewriteList = realMissingRows
    .filter(r => r.decision === '重写已迁移')
    .map(r => r.legacyKey)
  const discardList = realMissingRows
    .filter(r => r.decision === '废弃')
    .map(r => r.legacyKey)

  const summary = {
    timestamp: ts,
    totalRealMissing: realMissingRows.length,
    stats: { ...stats },
    percentages: {
      补齐: ((stats.补齐 / realMissingRows.length) * 100).toFixed(1) + '%',
      重写已迁移: ((stats.重写已迁移 / realMissingRows.length) * 100).toFixed(1) + '%',
      废弃: ((stats.废弃 / realMissingRows.length) * 100).toFixed(1) + '%',
    },
    totalModules: Object.keys(moduleStats).length,
    topModules,
    moduleStats,
    fillList,
    rewriteList,
    discardList,
  }

  fs.writeFileSync(OUT_SUMMARY, JSON.stringify(summary, null, 2), 'utf-8')
  console.log(`summary 已写入: ${OUT_SUMMARY}`)

  // 10. 输出报告
  const report = generateReport(summary)
  fs.writeFileSync(OUT_REPORT, report, 'utf-8')
  console.log(`报告已写入: ${OUT_REPORT}`)

  // 11. 控制台汇总
  console.log(`\n=== 评估完成 ===`)
  console.log(`真实缺失 key: ${realMissingRows.length}`)
  console.log(`  补齐:       ${stats.补齐} (${summary.percentages.补齐})`)
  console.log(`  重写已迁移: ${stats.重写已迁移} (${summary.percentages.重写已迁移})`)
  console.log(`  废弃:       ${stats.废弃} (${summary.percentages.废弃})`)
  console.log(`模块总数:     ${summary.totalModules}`)
}

main()
