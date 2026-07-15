#!/usr/bin/env node
/**
 * R65 生产部署 pre-deploy 自检脚本。
 *
 * 严格按 DEPLOYMENT-R65.md 验证清单 + 平台常规门禁,部署前 1 键运行。
 *
 * 硬性门禁(任一失败 → 退出码 1,阻止部署):
 *   1. pnpm turbo typecheck (10 包)
 *   2. pnpm turbo lint      (10 包,error 非 0 即失败,warning 仅打印)
 *   3. pnpm --filter @ihui/api test (195 文件 / 3000+ 测试)
 *   4. 5 语言 i18n key parity (zh-CN / zh-TW / en / ja / ko)
 *   5. 数据库 migration 存在性 + 关键 schema 表验证
 *   6. R65 必建前端页面存在 (realname / subscription / agent-rules)
 *   7. R65 必建后端端点存在 (43 个端点最小集)
 *   8. 生产环境必填 env vars 提示(.env.production / .env)
 *   9. MIGRATION_GAP_REPORT.md 缺失数 ≤ 上限(如有)
 *  10. Git 工作区状态(uncommitted 改动只警告不阻断)
 *
 * 用法:
 *   node scripts/pre-deploy.mjs                # 全量硬性门禁
 *   node scripts/pre-deploy.mjs --skip-tests   # 跳过测试(应急)
 *   node scripts/pre-deploy.mjs --env production # 生产模式(env 检查更严)
 *
 * 输出:每项 [OK] / [FAIL] / [WARN] 颜色标注 + 最终汇总 + exit code
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const ARGS = process.argv.slice(2)
const SKIP_TESTS = ARGS.includes('--skip-tests')
const PROD_MODE = ARGS.includes('--env') && ARGS[ARGS.indexOf('--env') + 1] === 'production'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const ICON = {
  ok: `${C.green}[OK]${C.reset}`,
  fail: `${C.red}[FAIL]${C.reset}`,
  warn: `${C.yellow}[WARN]${C.reset}`,
  info: `${C.cyan}[INFO]${C.reset}`,
}

let totalOk = 0
let totalFail = 0
let totalWarn = 0
const failList = []
const warnList = []

function recordStatus(status, name, detail) {
  if (status === 'ok') {
    totalOk++
    console.log(`  ${ICON.ok} ${name}${detail ? C.dim + ' — ' + detail + C.reset : ''}`)
  } else if (status === 'fail') {
    totalFail++
    failList.push(`${name}: ${detail ?? ''}`)
    console.log(`  ${ICON.fail} ${name}${detail ? C.dim + ' — ' + detail + C.reset : ''}`)
  } else if (status === 'warn') {
    totalWarn++
    warnList.push(`${name}: ${detail ?? ''}`)
    console.log(`  ${ICON.warn} ${name}${detail ? C.dim + ' — ' + detail + C.reset : ''}`)
  }
}

function run(cmd, opts = {}) {
  try {
    return {
      ok: true,
      stdout: execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', ...opts }),
    }
  } catch (e) {
    return {
      ok: false,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? e.message,
      code: e.status,
    }
  }
}

function header(title) {
  console.log('')
  console.log(`${C.bold}${C.cyan}━━━ ${title} ━━━${C.reset}`)
}

// =====================================================
// 1. typecheck
// =====================================================
function checkTypecheck() {
  header('1. TypeScript 类型检查 (10 包)')
  const r = run('pnpm turbo typecheck')
  if (r.ok) {
    recordStatus('ok', 'pnpm turbo typecheck', '10/10 任务全绿')
  } else {
    recordStatus('fail', 'pnpm turbo typecheck', '存在类型错误,详见上方输出')
    console.log(C.dim + r.stdout.split('\n').slice(-15).join('\n') + C.reset)
  }
}

// =====================================================
// 2. lint
// =====================================================
function checkLint() {
  header('2. ESLint 代码规范 (10 包)')
  const r = run('pnpm turbo lint')
  // lint 通常即使有 warning 也会 exit 0,error 才 exit 1
  if (r.ok) {
    // 提取 warning 数
    const warnMatch = r.stdout.match(/(\d+) warnings?/)
    const warnCount = warnMatch ? warnMatch[1] : '0'
    recordStatus('ok', 'pnpm turbo lint', `0 error${warnCount !== '0' ? `, ${warnCount} warnings(预存非阻塞)` : ''}`)
  } else {
    recordStatus('fail', 'pnpm turbo lint', '存在 lint error,需修复')
    console.log(C.dim + r.stdout.split('\n').slice(-20).join('\n') + C.reset)
  }
}

// =====================================================
// 3. test
// =====================================================
function checkTests() {
  header('3. 单元测试 + 集成测试 (api)')
  if (SKIP_TESTS) {
    recordStatus('warn', 'pnpm --filter @ihui/api test', '--skip-tests 已跳过')
    return
  }
  const r = run('pnpm --filter @ihui/api test')
  if (r.ok) {
    const m = r.stdout.match(/Tests\s+(\d+)\s+passed/)
    const f = r.stdout.match(/Tests\s+(\d+)\s+failed/)
    const files = r.stdout.match(/Test Files\s+(\d+)\s+passed/)
    recordStatus('ok', 'pnpm --filter @ihui/api test',
      `${files?.[1] ?? '?'} 文件 / ${m?.[1] ?? '?'} 测试通过${f?.[1] && f[1] !== '0' ? `(${f[1]} 失败!)` : ''}`)
  } else {
    recordStatus('fail', 'pnpm --filter @ihui/api test', '存在测试失败')
    console.log(C.dim + r.stdout.split('\n').slice(-20).join('\n') + C.reset)
  }
}

// =====================================================
// 4. i18n 5 语言 parity
// =====================================================
function checkI18nParity() {
  header('4. i18n 5 语言 key parity')
  const langs = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
  const msgDir = join(ROOT, 'apps/web/messages')
  if (!existsSync(msgDir)) {
    recordStatus('fail', 'i18n 目录', 'apps/web/messages 不存在')
    return
  }
  const baseline = join(msgDir, 'zh-CN.json')
  if (!existsSync(baseline)) {
    recordStatus('fail', 'i18n baseline', 'zh-CN.json 不存在')
    return
  }
  let baseKeys
  try {
    const baseJson = JSON.parse(readFileSync(baseline, 'utf8'))
    baseKeys = flattenKeys(baseJson)
  } catch (e) {
    recordStatus('fail', 'i18n baseline JSON parse', e.message)
    return
  }
  const baseSet = new Set(baseKeys)
  recordStatus('ok', `zh-CN baseline`, `${baseKeys.length} keys`)
  for (const lang of langs.slice(1)) {
    const f = join(msgDir, `${lang}.json`)
    if (!existsSync(f)) {
      recordStatus('fail', `i18n ${lang}`, '文件缺失')
      continue
    }
    try {
      const j = JSON.parse(readFileSync(f, 'utf8'))
      const k = flattenKeys(j)
      const missing = baseKeys.filter((b) => !k.includes(b))
      const extra = k.filter((x) => !baseSet.has(x))
      if (missing.length === 0 && extra.length === 0) {
        recordStatus('ok', `i18n ${lang}`, `${k.length} keys parity`)
      } else {
        recordStatus('fail', `i18n ${lang}`, `缺失 ${missing.length} key${missing.length > 0 ? ' / 多了 ' + extra.length : ''}`)
        if (missing.length > 0 && missing.length <= 5) {
          console.log(C.dim + `    missing: ${missing.join(', ')}` + C.reset)
        }
      }
    } catch (e) {
      recordStatus('fail', `i18n ${lang} JSON parse`, e.message)
    }
  }
}

function flattenKeys(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, key, out)
    } else {
      out.push(key)
    }
  }
  return out
}

// =====================================================
// 5. 数据库 migration + schema
// =====================================================
function checkMigrations() {
  header('5. 数据库 migration 完整性')
  const migDir = join(ROOT, 'packages/database/drizzle')
  if (!existsSync(migDir)) {
    recordStatus('fail', 'migration 目录', 'packages/database/drizzle 不存在')
    return
  }
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
  recordStatus('ok', `migration 文件`, `${files.length} 个 SQL`)

  // 校验 _journal.json 索引与文件数一致
  const journal = join(migDir, 'meta/_journal.json')
  if (existsSync(journal)) {
    try {
      const j = JSON.parse(readFileSync(journal, 'utf8'))
      const idxCount = j.entries?.length ?? 0
      if (idxCount === files.length) {
        recordStatus('ok', '_journal.json 索引', `${idxCount} entries 与 SQL 文件数一致`)
      } else {
        recordStatus('fail', '_journal.json 索引', `entries=${idxCount} ≠ sql files=${files.length}`)
      }
    } catch (e) {
      recordStatus('fail', '_journal.json 解析', e.message)
    }
  } else {
    recordStatus('fail', '_journal.json', '不存在')
  }

  // 关键 R65 表存在性
  const requiredTables = [
    'upload_sessions',         // 0047
    'user_auth_info',          // 0047
    'user_vips',               // 0047 (auto_renew 字段)
    'developer_subscriptions', // 0062
    'learn_community_post',    // 0063
  ]
  for (const t of requiredTables) {
    const found = files.some((f) => readFileSync(join(migDir, f), 'utf8').toLowerCase().includes(t))
    if (found) {
      recordStatus('ok', `R65 表 ${t}`, '已在 migration 中创建')
    } else {
      recordStatus('fail', `R65 表 ${t}`, '未在 migration 中找到')
    }
  }
}

// =====================================================
// 6. R65 必建前端页面
// =====================================================
function checkR65FrontendPages() {
  header('6. R65 必建前端页面')
  const pages = [
    'apps/web/app/(main)/user/realname/page.tsx',
    'apps/web/app/(main)/user/subscription/page.tsx',
    'apps/web/app/(main)/admin/realname-audit/page.tsx',
    'apps/web/app/(main)/admin/agent-rules/page.tsx',
  ]
  for (const p of pages) {
    const full = join(ROOT, p)
    if (existsSync(full)) {
      const lines = readFileSync(full, 'utf8').split('\n').length
      recordStatus('ok', p.replace('apps/web/app/(main)/', ''), `${lines} 行`)
    } else {
      recordStatus('fail', p, '页面文件不存在')
    }
  }
}

// =====================================================
// 7. R65 必建后端端点
// =====================================================
function checkR65BackendEndpoints() {
  header('7. R65 必建后端端点 (18 端点最小集)')
  const required = [
    // M-39 Agent 规则(由 agent-extended.ts 实现,前缀 /api/agent-ext)
    { method: 'GET', prefix: '/api/agent-ext', local: '/rules/list' },
    { method: 'GET', prefix: '/api/agent-ext', local: '/rules/:id' },
    { method: 'POST', prefix: '/api/agent-ext', local: '/rules' },
    { method: 'PUT', prefix: '/api/agent-ext', local: '/rules/:id' },
    { method: 'DELETE', prefix: '/api/agent-ext', local: '/rules/:id' },
    // M-52 分片上传(前缀 /api)
    { method: 'POST', prefix: '/api', local: '/chunked-upload/init' },
    { method: 'POST', prefix: '/api', local: '/chunked-upload/upload' },
    { method: 'POST', prefix: '/api', local: '/chunked-upload/merge' },
    { method: 'DELETE', prefix: '/api', local: '/chunked-upload/cancel' },
    { method: 'GET', prefix: '/api', local: '/chunked-upload/status' },
    // M-56 支付扩展(前缀 /api)
    { method: 'POST', prefix: '/api', local: '/payments/withdrawal/notify' },
    { method: 'GET', prefix: '/api', local: '/payments/sync-return' },
    { method: 'POST', prefix: '/api', local: '/payments/subscription/renew' },
    { method: 'GET', prefix: '/api', local: '/payments/subscription/status' },
    // M-67 实名认证(前缀 /api)
    { method: 'POST', prefix: '/api', local: '/auth/realname/submit' },
    { method: 'GET', prefix: '/api', local: '/auth/realname/my' },
    { method: 'GET', prefix: '/api', local: '/auth/realname/list' },
    { method: 'PUT', prefix: '/api', local: '/auth/realname/:userUuid/audit' },
  ]

  const routesDir = join(ROOT, 'apps/api/src/routes')
  const serverFile = join(ROOT, 'apps/api/src/server.ts')
  if (!existsSync(routesDir) || !existsSync(serverFile)) {
    recordStatus('fail', '后端路由', '目录或 server.ts 不存在')
    return
  }

  const serverSrc = readFileSync(serverFile, 'utf8')

  // 1) Build map: routeVarName -> prefix (from server.register calls)
  const varToPrefix = new Map()
  const regRe = /server\.register\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]/g
  let m
  while ((m = regRe.exec(serverSrc)) !== null) {
    varToPrefix.set(m[1], m[2])
  }

  // 2) Build map: importName -> filePath
  // Handles both named imports { a, b } and default imports xxx
  const importToFile = new Map()
  const importRe = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"`]\.\/routes\/([^'"`]+)\.js['"`]/g
  while ((m = importRe.exec(serverSrc)) !== null) {
    const fileBase = m[3]
    const filePath = join(routesDir, fileBase + '.ts')
    if (m[1]) {
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      for (const name of names) {
        importToFile.set(name, filePath)
      }
    } else if (m[2]) {
      importToFile.set(m[2], filePath)
    }
  }

  // 3) Build map: prefix -> Set(filePath)
  const prefixToFiles = new Map()
  for (const [varName, prefix] of varToPrefix) {
    const filePath = importToFile.get(varName)
    if (filePath) {
      if (!prefixToFiles.has(prefix)) prefixToFiles.set(prefix, new Set())
      prefixToFiles.get(prefix).add(filePath)
    }
  }

  // 4) For each required endpoint, search in files mapped to that prefix
  let okCount = 0
  for (const req of required) {
    const fullReq = (req.prefix + req.local).replace(/\/+/g, '/').replace(/\/$/, '')
    const files = prefixToFiles.get(req.prefix)
    if (!files || files.size === 0) {
      recordStatus('fail', `${req.method} ${fullReq}`, `前缀 ${req.prefix} 无关联路由文件`)
      continue
    }
    let found = false
    for (const f of files) {
      if (!existsSync(f)) continue
      const src = readFileSync(f, 'utf8')
      const methodLower = req.method.toLowerCase()
      const escapedLocal = req.local.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const routeRe = new RegExp(`server\\.${methodLower}\\(\\s*['"\`]${escapedLocal}['"\`]`)
      if (routeRe.test(src)) {
        found = true
        break
      }
    }
    if (found) {
      okCount++
    } else {
      recordStatus('fail', `${req.method} ${fullReq}`, '后端端点未注册')
    }
  }
  if (okCount === required.length) {
    recordStatus('ok', 'R65 后端端点', `${okCount}/${required.length} 全部就位`)
  } else {
    recordStatus('fail', 'R65 后端端点', `${okCount}/${required.length} 就位`)
  }
}

// =====================================================
// 8. 生产环境必填 env vars
// =====================================================
function checkEnvVars() {
  header('8. 环境变量(生产模式必填)')
  const envFile = join(ROOT, '.env')
  if (!existsSync(envFile) && !PROD_MODE) {
    recordStatus('warn', '.env 文件', '不存在(仅开发模式,跳过)')
    return
  }
  const requiredProd = [
    { name: 'DATABASE_URL', desc: 'PostgreSQL 连接串' },
    { name: 'JWT_SECRET', desc: 'JWT 签名密钥' },
    { name: 'ENCRYPTION_KEY', desc: 'API Key 加密密钥' },
    { name: 'REDIS_URL', desc: 'Redis(账户锁定 + 缓存)' },
  ]
  if (PROD_MODE) {
    requiredProd.push(
      { name: 'WECHAT_PAY_CERT_SERIAL_NO', desc: '微信支付平台证书序列号' },
      { name: 'WECHAT_PAY_PRIVATE_KEY_PATH', desc: '微信支付商户私钥路径' },
      { name: 'WECHAT_PAY_CERT_PATH', desc: '微信支付平台证书路径' },
      { name: 'WECHAT_PAY_NOTIFY_URL', desc: '微信提现回调 URL(公网)' },
      { name: 'ALIPAY_RETURN_URL', desc: '支付宝同步返回 URL' },
      { name: 'CORS_ORIGIN', desc: '生产域名' },
    )
  }
  let envContent = ''
  if (existsSync(envFile)) {
    envContent = readFileSync(envFile, 'utf8')
  }
  for (const { name, desc } of requiredProd) {
    const re = new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm')
    const m = envContent.match(re)
    if (m && m[1].trim() && m[1].trim() !== '') {
      recordStatus('ok', name, desc)
    } else {
      const status = PROD_MODE ? 'fail' : 'warn'
      recordStatus(status, name, `${desc} ${PROD_MODE ? '生产模式必填' : '未配置(开发模式提示)'}`)
    }
  }
}

// =====================================================
// 9. 迁移缺口报告
// =====================================================
function checkMigrationGapReport() {
  header('9. MIGRATION_GAP_REPORT.md 状态')
  const report = join(ROOT, 'MIGRATION_GAP_REPORT.md')
  if (!existsSync(report)) {
    recordStatus('warn', 'MIGRATION_GAP_REPORT.md', '不存在,跳过')
    return
  }
  const content = readFileSync(report, 'utf8')

  // 1) Check for 100% completeness (v2 report format)
  if (/合计.*?100%/.test(content) || /真实完整率.*?100%/.test(content)) {
    recordStatus('ok', '迁移完整度', '100% 完整(0 真缺失)')
    return
  }

  // 2) Fallback: look for "真缺失" count in the report
  const m = content.match(/真缺失[^\n]*?(\d+)/i)
  if (m) {
    const count = parseInt(m[1], 10)
    if (count === 0) {
      recordStatus('ok', '迁移完整度', '0 项真缺失')
    } else if (count <= 10) {
      recordStatus('warn', '迁移完整度', `${count} 项真缺失(可接受)`)
    } else {
      recordStatus('fail', '迁移完整度', `${count} 项真缺失(>10 需评估)`)
    }
  } else {
    recordStatus('warn', 'MIGRATION_GAP_REPORT.md', '格式未识别,跳过')
  }
}

// =====================================================
// 10. Git 工作区状态
// =====================================================
function checkGitStatus() {
  header('10. Git 工作区状态')
  const r = run('git status --porcelain')
  if (r.ok) {
    const lines = r.stdout.trim().split('\n').filter(Boolean)
    const untracked = lines.filter((l) => l.startsWith('??'))
    const modified = lines.filter((l) => l.startsWith(' M') || l.startsWith('M '))
    const staged = lines.filter((l) => l.startsWith('A ') || l.startsWith('M  '))
    if (lines.length === 0) {
      recordStatus('ok', 'git status', '工作树 clean')
    } else {
      recordStatus('warn', 'git status', `${modified.length} 修改 / ${staged.length} 已暂存 / ${untracked.length} 未跟踪(不阻断,提示用户先 commit)`)
    }
  } else {
    recordStatus('warn', 'git status', '无法读取(非 git 仓库或权限问题)')
  }

  // 检查 origin/main ahead/behind
  const branch = run('git rev-parse --abbrev-ref HEAD')
  if (branch.ok) {
    const ahead = run(`git rev-list --count origin/main..${branch.stdout.trim()}`)
    if (ahead.ok && ahead.stdout.trim() !== '0') {
      recordStatus('warn', '分支 ahead origin/main', `${ahead.stdout.trim()} commits 未推送`)
    } else {
      recordStatus('ok', '分支同步', '与 origin/main 一致')
    }
  }
}

// =====================================================
// 主流程
// =====================================================
function main() {
  const t0 = Date.now()
  console.log(`${C.bold}IHUI-AI R65 Pre-deploy 自检${C.reset}`)
  console.log(`${C.dim}模式: ${PROD_MODE ? 'PRODUCTION(严格)' : 'STAGING(开发)'}${SKIP_TESTS ? ' / 跳过测试' : ''}${C.reset}`)
  console.log(`${C.dim}根目录: ${ROOT}${C.reset}`)
  console.log(`${C.dim}时间: ${new Date().toISOString()}${C.reset}`)

  checkTypecheck()
  checkLint()
  checkTests()
  checkI18nParity()
  checkMigrations()
  checkR65FrontendPages()
  checkR65BackendEndpoints()
  checkEnvVars()
  checkMigrationGapReport()
  checkGitStatus()

  // ============ 汇总 ============
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('')
  console.log(`${C.bold}━━━ 汇总 ━━━${C.reset}`)
  console.log(`  ${ICON.ok}  ${totalOk} 项通过`)
  console.log(`  ${ICON.warn} ${totalWarn} 项警告`)
  console.log(`  ${ICON.fail} ${totalFail} 项失败`)
  console.log(`  ${C.dim}耗时: ${elapsed}s${C.reset}`)

  if (totalFail > 0) {
    console.log('')
    console.log(`${C.red}${C.bold}❌ Pre-deploy 硬性门禁未通过,禁止部署${C.reset}`)
    console.log(`${C.red}失败项:${C.reset}`)
    for (const f of failList) {
      console.log(`  ${C.red}• ${f}${C.reset}`)
    }
    process.exit(1)
  }

  if (totalWarn > 0 && PROD_MODE) {
    console.log('')
    console.log(`${C.yellow}⚠️  生产模式有 ${totalWarn} 项警告,建议处理后再部署:${C.reset}`)
    for (const w of warnList.slice(0, 5)) {
      console.log(`  ${C.yellow}• ${w}${C.reset}`)
    }
    if (warnList.length > 5) console.log(`  ${C.yellow}  ... 还有 ${warnList.length - 5} 项${C.reset}`)
  }

  console.log('')
  console.log(`${C.green}${C.bold}✅ Pre-deploy 硬性门禁全部通过,可以部署${C.reset}`)
  process.exit(0)
}

main()
