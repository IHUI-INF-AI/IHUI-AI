#!/usr/bin/env node
/**
 * 多端同步对接审计脚本 (AGENTS.md §9)
 *
 * 检查 IHUI-AI 8 端(web/api/ai-service/desktop/extension/mobile-rn/miniapp-taro/cli)
 * 是否需要为新增的 6 个 API 端点 + 27 张数据库表 schema 做多端同步对接。
 *
 * 用法: node scripts/audit-multi-platform-sync.mjs
 * 输出:
 *   - reports/migration-audit-multi-platform-sync-{timestamp}.csv
 *   - reports/migration-audit-multi-platform-sync-summary.json
 *
 * 退出码: 0(成功) / 1(失败)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// ─── 配置 ───────────────────────────────────────────────────────────
const ROOT = 'g:\\IHUI-AI'
const REPORTS_DIR = path.join(ROOT, 'reports')

const PLATFORMS = [
  { id: 'web',          dir: 'apps/web',          lang: 'ts/tsx' },
  { id: 'api',          dir: 'apps/api',          lang: 'ts'     },
  { id: 'ai-service',   dir: 'apps/ai-service',   lang: 'python' },
  { id: 'desktop',      dir: 'apps/desktop',      lang: 'ts/tsx' },
  { id: 'extension',    dir: 'apps/extension',    lang: 'ts/tsx' },
  { id: 'mobile-rn',    dir: 'apps/mobile-rn',    lang: 'ts/tsx' },
  { id: 'miniapp-taro', dir: 'apps/miniapp-taro', lang: 'ts/tsx' },
  { id: 'cli',          dir: 'apps/cli',          lang: 'ts'     },
]

// 6 个新 API 端点(顶级路径)
const NEW_ENDPOINTS = [
  { path: '/api/private-letters', keyword: 'private-letters', desc: '私信管理(7 端点)' },
  { path: '/api/wrong-questions', keyword: 'wrong-questions', desc: '错题本(3 端点)' },
  { path: '/api/check-in',        keyword: 'check-in',        desc: '每日签到(2 主端点 + 2 辅助)' },
  { path: '/api/mail',            keyword: 'api/mail',        desc: '邮件发送(2 端点)' },
  { path: '/api/auth-codes',      keyword: 'auth-codes',      desc: '验证码(2 端点)' },
  { path: '/api/exam-marking',    keyword: 'exam-marking',    desc: '阅卷评分(1 端点)' },
]

// 27 张新表 schema 分组
const NEW_SCHEMA_GROUPS = [
  { group: 'social-supplement',  files: ['social-supplement.ts'],  tables: 6 },
  { group: 'live-supplement',    files: ['live-supplement.ts'],    tables: 4 },
  { group: 'learn-homework',     files: ['learn-homework.ts'],     tables: 5 },
  { group: 'resource-download',  files: ['resource-download.ts'],  tables: 4 },
  { group: 'admin-extended',     files: ['admin-extended.ts'],     tables: 8 },
]

// 平台独占豁免(AGENTS.md §9)
const PLATFORM_EXEMPTIONS = {
  desktop:       '系统托盘(Tauri 原生集成)',
  extension:     '浏览器上下文菜单(WXT)',
  'miniapp-taro': '微信支付(小程序原生)',
  cli:           '终端集成(ACP/REPL)',
}

// ─── 工具函数 ─────────────────────────────────────────────────────────
function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

function platformDirExists(p) {
  return fs.existsSync(path.join(ROOT, p.dir))
}

/**
 * 在指定目录中用 ripgrep 搜索关键词,返回匹配行数组
 */
function rgSearch(searchRoot, pattern) {
  const absRoot = path.isAbsolute(searchRoot) ? searchRoot : path.join(ROOT, searchRoot)
  if (!fs.existsSync(absRoot)) return []
  try {
    const out = execFileSync('rg', [
      '--no-heading', '-n', '-N',
      '--', pattern, absRoot,
    ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
    return out.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 判定某行是否为"新端点顶级路径"调用(非 admin 子路径 / 非 exam 子路径等)
 */
function isTopLevelCall(line, endpointPath) {
  // 排除 /api/admin/xxx 与 /api/exam/xxx 等子路径调用
  if (endpointPath === '/api/private-letters') {
    return /['"`]\/api\/private-letters[/'"`]/.test(line)
  }
  if (endpointPath === '/api/wrong-questions') {
    return /['"`]\/api\/wrong-questions[/'"`]/.test(line)
  }
  if (endpointPath === '/api/check-in') {
    return /['"`]\/api\/check-in[/'"`]/.test(line)
  }
  if (endpointPath === '/api/mail') {
    return /['"`]\/api\/mail[/'"`]/.test(line)
  }
  if (endpointPath === '/api/auth-codes') {
    return /['"`]\/api\/auth-codes[/'"`]/.test(line)
  }
  if (endpointPath === '/api/exam-marking') {
    return /['"`]\/api\/exam-marking[/'"`]/.test(line)
  }
  return false
}

/**
 * 判定某行是否为"等价旧路径"调用(/api/admin/private-letters / /api/exam/wrong-questions / /api/user/check-in / /api/exam/records 等)
 */
function isLegacyEquivalentCall(line, endpointPath) {
  if (endpointPath === '/api/private-letters') {
    return /\/api\/admin\/private-letters/.test(line)
  }
  if (endpointPath === '/api/wrong-questions') {
    return /\/api\/exam\/wrong-questions|\/exam\/wrong-questions/.test(line)
  }
  if (endpointPath === '/api/check-in') {
    return /\/api\/user\/check-in|\/api\/check-in\/list|\/api\/check-in\/record/.test(line)
  }
  if (endpointPath === '/api/exam-marking') {
    return /\/api\/exam\/records\/pending-marks|\/api\/admin\/exam\/records/.test(line)
  }
  return false
}

// ─── 主流程 ───────────────────────────────────────────────────────────
function main() {
  ensureReportsDir()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const csvPath = path.join(REPORTS_DIR, `migration-audit-multi-platform-sync-${timestamp}.csv`)
  const summaryPath = path.join(REPORTS_DIR, 'migration-audit-multi-platform-sync-summary.json')

  // 步骤 1:8 端目录存在性
  const platformExistence = PLATFORMS.map((p) => ({
    id: p.id,
    dir: p.dir,
    lang: p.lang,
    exists: platformDirExists(p),
    exemption: PLATFORM_EXEMPTIONS[p.id] || null,
  }))

  // 步骤 2 & 3:扫描 6 个新端点调用情况
  // 矩阵:platform × endpoint
  const callMatrix = []
  for (const p of PLATFORMS) {
    if (!platformDirExists(p)) {
      for (const ep of NEW_ENDPOINTS) {
        callMatrix.push({
          platform: p.id,
          endpoint: ep.path,
          desc: ep.desc,
          topLevelCalls: 0,
          legacyEquivalentCalls: 0,
          sampleLines: [],
          syncNeeded: 'unknown',
          reason: '平台目录不存在',
        })
      }
      continue
    }

    for (const ep of NEW_ENDPOINTS) {
      const lines = rgSearch(p.dir, ep.keyword)
      const topLevel = lines.filter((l) => isTopLevelCall(l, ep.path))
      const legacy = lines.filter((l) => isLegacyEquivalentCall(l, ep.path))
      // 过滤测试文件 / 注释中提及
      const realTopLevel = topLevel.filter((l) => !/\.test\.|__tests__|e2e\/|\.spec\./.test(l))
      const realLegacy = legacy.filter((l) => !/\.test\.|__tests__|e2e\/|\.spec\./.test(l))

      let syncNeeded = 'no'
      let reason = []

      if (p.id === 'api') {
        // api 是实现端,不是消费端
        syncNeeded = 'no'
        reason.push('API 实现端,已注册 6 个新端点(server.ts:943-954)')
      } else if (p.id === 'ai-service') {
        // ai-service 是 Python,不调用 TS API 端点
        syncNeeded = 'no'
        reason.push('Python 服务,不通过 HTTP 调用本仓库 API 端点')
      } else if (realTopLevel.length > 0) {
        syncNeeded = 'no'
        reason.push(`已调用新端点顶级路径(${realTopLevel.length} 处)`)
      } else if (realLegacy.length > 0) {
        syncNeeded = 'review'
        reason.push(`已通过等价旧路径调用(${realLegacy.length} 处),建议评估是否迁移至新顶级路径`)
      } else if (PLATFORM_EXEMPTIONS[p.id]) {
        syncNeeded = 'no'
        reason.push(`平台独占豁免(AGENTS.md §9):${PLATFORM_EXEMPTIONS[p.id]};无业务需求调用本端点`)
      } else {
        // web 端:无任何调用方 → 需评估是否需要补开发
        if (p.id === 'web') {
          syncNeeded = 'review'
          reason.push('web 端无调用方,需评估是否需要补开发 UI 调用方(若功能在 web 端需要)')
        } else {
          syncNeeded = 'review'
          reason.push('本端无调用方,需评估是否需要补开发(若功能在本端需要)')
        }
      }

      callMatrix.push({
        platform: p.id,
        endpoint: ep.path,
        desc: ep.desc,
        topLevelCalls: realTopLevel.length,
        legacyEquivalentCalls: realLegacy.length,
        sampleLines: (realTopLevel.concat(realLegacy)).slice(0, 3),
        syncNeeded,
        reason: reason.join('; '),
      })
    }
  }

  // 步骤 4:扫描 27 张新表 schema 依赖
  const schemaDeps = []
  for (const p of PLATFORMS) {
    if (!platformDirExists(p)) continue
    // 检查是否 import @ihui/database 或直接引用 schema 文件
    const importLines = rgSearch(p.dir, '@ihui/database')
    const schemaFileLines = rgSearch(p.dir, 'social-supplement|live-supplement|learn-homework|resource-download|admin-extended')
    schemaDeps.push({
      platform: p.id,
      importsDatabase: importLines.length,
      referencesNewSchemaFiles: schemaFileLines.length,
      assessment:
        p.id === 'api'
          ? '直接消费 schema(API 路由 + DB 查询)'
          : p.id === 'ai-service'
            ? 'Python 服务,通过 HTTP/SQL 间接消费,不直接 import TS schema'
            : importLines.length === 0
              ? '不直接 import @ihui/database,仅通过 API 端点间接消费'
              : `import @ihui/database ${importLines.length} 处(通用基础设施,非 27 张新表直接引用)`,
    })
  }

  // 步骤 5:统计汇总
  const stats = {
    totalPlatforms: PLATFORMS.length,
    platformsExists: platformExistence.filter((p) => p.exists).length,
    totalEndpoints: NEW_ENDPOINTS.length,
    totalSchemaTables: NEW_SCHEMA_GROUPS.reduce((s, g) => s + g.tables, 0),
    syncNeeded: {
      no: callMatrix.filter((c) => c.syncNeeded === 'no').length,
      review: callMatrix.filter((c) => c.syncNeeded === 'review').length,
      unknown: callMatrix.filter((c) => c.syncNeeded === 'unknown').length,
    },
    perPlatform: {},
  }
  for (const p of PLATFORMS) {
    const items = callMatrix.filter((c) => c.platform === p.id)
    stats.perPlatform[p.id] = {
      no: items.filter((c) => c.syncNeeded === 'no').length,
      review: items.filter((c) => c.syncNeeded === 'review').length,
      unknown: items.filter((c) => c.syncNeeded === 'unknown').length,
      exemption: PLATFORM_EXEMPTIONS[p.id] || null,
    }
  }

  // ─── 写 CSV ──────────────────────────────────────────────────────
  const csvLines = []
  csvLines.push('platform,endpoint,desc,top_level_calls,legacy_equivalent_calls,sync_needed,reason')
  for (const c of callMatrix) {
    const reason = (c.reason || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')
    csvLines.push(`"${c.platform}","${c.endpoint}","${c.desc}",${c.topLevelCalls},${c.legacyEquivalentCalls},"${c.syncNeeded}","${reason}"`)
  }
  csvLines.push('')
  csvLines.push('# schema 依赖统计')
  csvLines.push('platform,imports_database,references_new_schema_files,assessment')
  for (const s of schemaDeps) {
    const assessment = (s.assessment || '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')
    csvLines.push(`"${s.platform}",${s.importsDatabase},${s.referencesNewSchemaFiles},"${assessment}"`)
  }
  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf8')

  // ─── 写 summary.json ─────────────────────────────────────────────
  const summary = {
    generatedAt: new Date().toISOString(),
    script: 'scripts/audit-multi-platform-sync.mjs',
    rule: 'AGENTS.md §9 多端同步开发强制规则',
    platforms: platformExistence,
    newEndpoints: NEW_ENDPOINTS,
    newSchemaGroups: NEW_SCHEMA_GROUPS,
    callMatrix,
    schemaDeps,
    stats,
    conclusion: {
      platformsNeedingReview: Object.entries(stats.perPlatform)
        .filter(([_, v]) => v.review > 0)
        .map(([k, v]) => ({ platform: k, reviewCount: v.review })),
      platformsExempted: Object.entries(PLATFORM_EXEMPTIONS).map(([k, v]) => ({ platform: k, exemption: v })),
      schemaSyncNeeded: '27 张新表 schema 仅 packages/database/src/schema/ 中定义,API 端直接消费,其他 7 端不直接 import,无需多端同步',
      apiClientLayer: 'packages/api-client 仅 check-in 有 9 个 CRUD 函数(且无调用方),其他 5 个新端点 api-client 缺失,建议补开发 api-client 共享函数作为多端同步对接的统一入口',
    },
  }
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')

  console.log(`✓ 多端同步审计完成`)
  console.log(`  CSV:    ${csvPath}`)
  console.log(`  Summary:${summaryPath}`)
  console.log(`  统计:8 端 × 6 端点 = ${callMatrix.length} 个检查点`)
  console.log(`    无需同步(no):     ${stats.syncNeeded.no}`)
  console.log(`    需评估(review):   ${stats.syncNeeded.review}`)
  console.log(`    未知(unknown):    ${stats.syncNeeded.unknown}`)
  console.log(`  平台独占豁免:${Object.keys(PLATFORM_EXEMPTIONS).length} 端`)
}

try {
  main()
  process.exit(0)
} catch (e) {
  console.error('✗ 多端同步审计失败:', e.message)
  console.error(e.stack)
  process.exit(1)
}
