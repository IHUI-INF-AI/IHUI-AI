// R76 全面独立审计 — 不依赖历史修复
// 写入磁盘 (沙箱 stdout 不可用),便于 Read 验证
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(__filename), '..')

const OUT = path.join(ROOT, '__r76_audit_full.txt')
writeFileSync(OUT, '')
function log(line) {
  writeFileSync(OUT, readFileSync(OUT, 'utf8') + line + '\n', 'utf8')
}

log('=== R76 全面独立审计 — 不依赖历史修复 ===\n')
log(`时间: ${new Date().toISOString()}`)
log(`根: ${ROOT}\n`)

// --- 1. PROJECT_PLAN.md 100% 行扫描
log('\n## 1. PROJECT_PLAN.md 100% 行扫描 (寻找未带 R76 撤销的)\n')
const planPath = path.join(ROOT, 'PROJECT_PLAN.md')
const plan = readFileSync(planPath, 'utf8')
const planLines = plan.split('\n')
const patterns = [/100%/, /零遗漏/]
const findings = []
for (let i = 0; i < planLines.length; i++) {
  const line = planLines[i]
  let matched = false
  for (const p of patterns) {
    if (p.test(line)) { matched = true; break }
  }
  if (!matched) continue
  const ctx = [planLines[i - 2] || '', planLines[i - 1] || '', line, planLines[i + 1] || '', planLines[i + 2] || ''].join(' ')
  const hasRevoke = /R76 撤销|实际综合|实际整体|实际 R68|94%|8 项真实缺口|~94%/.test(ctx)
  if (!hasRevoke) {
    findings.push({ lineNo: i + 1, content: line.substring(0, 240) })
  }
}
log(`未带 R76 撤销的 100%/零遗漏 行数: ${findings.length}`)
findings.slice(0, 50).forEach((f) => log(`L${f.lineNo}: ${f.content}`))
if (findings.length > 50) log(`... 还有 ${findings.length - 50} 条`)

// --- 2. use-ai-talk.ts TODO/M-63 计数
log('\n## 2. use-ai-talk.ts M-63 备注\n')
const useAiTalkPath = path.join(ROOT, 'apps/web/src/hooks/use-ai-talk.ts')
if (existsSync(useAiTalkPath)) {
  const useAiTalk = readFileSync(useAiTalkPath, 'utf8')
  const m63Count = (useAiTalk.match(/M-63/g) || []).length
  const todoCount = (useAiTalk.match(/TODO/g) || []).length
  const placeholderCount = (useAiTalk.match(/placeholder/gi) || []).length
  log(`M-63 出现次数: ${m63Count}`)
  log(`TODO 出现次数: ${todoCount}`)
  log(`placeholder 出现次数: ${placeholderCount}`)
} else {
  log('use-ai-talk.ts 不存在')
}

// --- 3. use-ai-websocket.ts TODO
log('\n## 3. use-ai-websocket.ts TODO\n')
const wsPath = path.join(ROOT, 'apps/web/src/hooks/use-ai-websocket.ts')
if (existsSync(wsPath)) {
  const ws = readFileSync(wsPath, 'utf8')
  log(`TODO: ${(ws.match(/TODO/g) || []).length}`)
  log(`placeholder: ${(ws.match(/placeholder/gi) || []).length}`)
  log(`占位: ${(ws.match(/占位/g) || []).length}`)
  log(`stub: ${(ws.match(/stub/gi) || []).length}`)
  log(`总行数: ${ws.split('\n').length}`)
}

// --- 4. zhs-full.ts 关键字段核对
log('\n## 4. zhs-full.ts 关键字段/索引核对\n')
const zhsPath = path.join(ROOT, 'packages/database/src/schema/zhs-full.ts')
if (existsSync(zhsPath)) {
  const zhs = readFileSync(zhsPath, 'utf8')
  const checks = [
    ['zhs_developer_link.expiresAt', /expiresAt:\s*timestamp/],
    ['zhs_developer_link.field1', /field1:\s*varchar/],
    ['zhs_developer_link.field2', /field2:\s*varchar/],
    ['zhs_developer_link.assigner', /assigner:\s*varchar/],
    ['zhs_developer_link.allocateTime', /allocateTime:\s*timestamp/],
    ['zhs_developer_link.isDel', /isDel:\s*integer/],
    ['zhs_developer_link.type', /type:\s*integer/],
    ['zhs_agent_settlement.issueNo', /issueNo:\s*integer/],
    ['uq zhs_order_out_trade_no_uq', /zhs_order_out_trade_no_uq/],
    ['uq zhs_course_pay_order_no_uq', /zhs_course_pay_order_no_uq/],
    ['uq zhs_exchange_rate_pair_uq', /zhs_exchange_rate_pair_uq/],
    ['idx zhs_course_creator_idx', /zhs_course_creator_idx/],
    ['idx zhs_course_new_creator_idx', /zhs_course_new_creator_idx/],
    ['idx zhs_agent_settlement_agent_id_idx', /zhs_agent_settlement_agent_id_idx/],
  ]
  for (const [name, re] of checks) {
    log(`  ${re.test(zhs) ? '✓' : '✗'} ${name}`)
  }
  log(`总行数: ${zhs.split('\n').length}`)
}

// --- 5. seed/index.ts:6 import ai-fresh-2026
log('\n## 5. seed/index.ts:6 import 验证\n')
const seedIdxPath = path.join(ROOT, 'packages/database/seed/index.ts')
if (existsSync(seedIdxPath)) {
  const idx = readFileSync(seedIdxPath, 'utf8')
  const l6 = idx.split('\n')[5]
  log(`L6: ${l6}`)
  log(`L6 包含 ai-fresh-2026: ${l6 && l6.includes('ai-fresh-2026')}`)
  log(`ai-fresh-2026.ts 存在: ${existsSync(path.join(ROOT, 'packages/database/seed/ai-fresh-2026.ts'))}`)
}

// --- 6. admin.ts 修复持久化
log('\n## 6. admin.ts Top 5 修复持久化\n')
const adminPath = path.join(ROOT, 'apps/api/src/routes/admin.ts')
if (existsSync(adminPath)) {
  const a = readFileSync(adminPath, 'utf8')
  const checks = [
    ["POST /users/:id/resetPwd", a.includes("'/users/:id/resetPwd'")],
    ["GET /dept/list", a.includes("'/dept/list'")],
    ["GET /agreements", a.includes("server.get('/agreements'")],
    ["GET /advertise", a.includes("server.get('/advertise'")],
    ["GET /article", a.includes("server.get('/article'")],
  ]
  for (const [n, ok] of checks) log(`  ${ok ? '✓' : '✗'} ${n}`)
  log(`总行数: ${a.split('\n').length}`)
}

// --- 7. admin 端点 vs frontend-stub-admin-routes.ts 桩
log('\n## 7. admin-audit-report 中剩余缺失端点\n')
const adminReportPath = path.join(ROOT, 'admin-audit-report.md')
if (existsSync(adminReportPath)) {
  const ar = readFileSync(adminReportPath, 'utf8')
  // 简单计数: 找完全缺失行
  const missing = (ar.match(/\*\*完全缺失\*\*/g) || []).length
  const partial = (ar.match(/\*\*部分缺失\*\*/g) || []).length
  const stub = (ar.match(/✱ 桩函数/g) || []).length
  log(`完全缺失标记: ${missing}`)
  log(`部分缺失标记: ${partial}`)
  log(`桩函数标记: ${stub}`)
}

// --- 8. admin.ts vs frontend-stub-admin-routes.ts 对比
log('\n## 8. 路由注册完整性\n')
const serverPath = path.join(ROOT, 'apps/api/src/server.ts')
if (existsSync(serverPath)) {
  const s = readFileSync(serverPath, 'utf8')
  const regCount = (s.match(/adminRoutes|registerAdminRoutes|admin.*Routes/g) || []).length
  log(`server.ts 中 admin 路由注册引用: ${regCount}`)
}

log('\n=== 审计完成 ===')
log(`结果文件: ${OUT}`)
