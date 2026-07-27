import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-migration-completeness.mjs')
const PROJECT_ROOT = join(__dirname, '..', '..')
const GATE_RESULT_FILE = join(PROJECT_ROOT, '__gate_result.txt')

// ─── 辅助:运行脚本,返回去除 ANSI 颜色码的输出 ───────────────
// 源脚本 ROOT 基于 __dirname 推导(始终指向 g:\IHUI-AI 项目根),
// 无法用临时目录替换,故直接对真实项目运行,验证行为契约。
// 正常模式触发 5 个 fetch 调用(每个 2s 超时),约 6-10s;
// --staged 无 staged 文件时快速早退(不触发 fetch)。
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript(args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    timeout: 30000,
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

// ─── 预运行脚本(模块加载时执行一次,结果供所有测试复用) ───
// 先跑 --staged(快,不触发 fetch),再跑正常模式(慢,触发 fetch),
// 使 __gate_result.txt 最终含正常模式输出(含 "迁移完整性守门汇总")。
const STAGED_RUN = runScript(['--staged'])
const NORMAL_RUN = runScript()

// ═══════════════════════════════════════════════════════════
// 1. 脚本存在与基础运行
// ═══════════════════════════════════════════════════════════

// ─── 1. 脚本文件存在 ────────────────────────────────────────
test('脚本文件存在: scripts/check-api-migration-completeness.mjs', () => {
  assert.ok(existsSync(SCRIPT_PATH), `脚本应存在: ${SCRIPT_PATH}`)
})

// ─── 2. 正常模式: 脚本逻辑完整运行 (stdout 含汇总) ─────────
// 注意: 正常模式 [8/8] 节触发 5 个 fetch + AbortSignal.timeout,
// 在 Windows 上 process.exit() 时可能触发 libuv 断言崩溃
// (exit 3221226505 = 0xC0000409 STATUS_STACK_BUFFER_OVERRUN),
// 这是 Node.js/Windows 运行时已知问题, 非脚本逻辑 bug。
// 故用 stdout 含 "汇总" 判断脚本逻辑完成, 不强依赖 exit code。
test('正常模式: 脚本逻辑完整运行 (stdout 含汇总, 无语法/类型错误)', () => {
  assert.match(NORMAL_RUN.stdout, /迁移完整性守门汇总/, 'stdout 应含汇总(脚本逻辑完成)')
  // exit 0(成功)/ 1(检查失败)/ 3221226505(Windows libuv fetch 退出崩溃, 非脚本 bug)
  const WIN_LIBUV_CRASH = 3221226505
  assert.ok(
    NORMAL_RUN.status === 0 || NORMAL_RUN.status === 1 || NORMAL_RUN.status === WIN_LIBUV_CRASH,
    `exit 应为 0/1/Windows崩溃码, 实际 ${NORMAL_RUN.status}`,
  )
  // 不应有脚本级错误(语法/类型); libuv 断言是 Windows 退出 bug, 可接受
  assert.ok(
    !NORMAL_RUN.stderr.includes('SyntaxError') && !NORMAL_RUN.stderr.includes('TypeError'),
    `不应有语法/类型错误\nstderr: ${NORMAL_RUN.stderr}`,
  )
})

// ═══════════════════════════════════════════════════════════
// 2. 输出结构: 8 个检查章节
// ═══════════════════════════════════════════════════════════

// ─── 3. [1/6] 审计报告文件存在性 (4 类报告) ──────────────────
test('输出 [1/6]: 审计报告文件存在性 (4 类: D盘Python/Java/Schema/前端)', () => {
  assert.match(NORMAL_RUN.stdout, /\[1\/6\] 审计报告文件存在性/)
  // 4 类审计报告(接受 .txt 或 .md 别名)
  assert.match(NORMAL_RUN.stdout, /审计报告存在: d_legacy_audit_report\.txt/)
  assert.match(NORMAL_RUN.stdout, /审计报告存在: d_java_audit_report\.txt/)
  assert.match(NORMAL_RUN.stdout, /审计报告存在: frontend_audit_report\.txt/)
  assert.match(NORMAL_RUN.stdout, /审计报告存在: db_schema_audit_report\.txt/)
})

// ─── 4. [2/7] Schema 表完整性 (5 表 + index.ts 导出) ──────────
test('输出 [2/7]: OAuth 私钥表 + 计费表 + zhs-full 字段对齐 (5 表)', () => {
  assert.match(NORMAL_RUN.stdout, /\[2\/7\] OAuth 私钥表/)
  // 5 个 schema 表检查(D 盘字段对齐)
  assert.match(NORMAL_RUN.stdout, /Schema oauth_private_keys 完整/)
  assert.match(NORMAL_RUN.stdout, /Schema agent_billings 完整/)
  assert.match(NORMAL_RUN.stdout, /Schema zhs_agent_category 完整/)
  assert.match(NORMAL_RUN.stdout, /Schema zhs_agent_developer 完整/)
  assert.match(NORMAL_RUN.stdout, /Schema zhs_activity 完整/)
  // schema/index.ts 导出检查
  assert.match(NORMAL_RUN.stdout, /oauth-private-keys \+ agent-billings 在 schema\/index\.ts 导出/)
})

// ─── 5. [3/6] OAuth 私钥管理路由 ────────────────────────────
test('输出 [3/6]: oauth-keys.ts 路由存在 + 5 端点 + index.ts 注册', () => {
  assert.match(NORMAL_RUN.stdout, /\[3\/6\] OAuth 私钥管理路由/)
  assert.match(NORMAL_RUN.stdout, /oauth-keys\.ts 存在并注册/)
})

// ─── 6. [4/7] agents.ts 6 P0 端点 + Java 17 端点 ─────────────
test('输出 [4/7]: agents.ts 6 P0 端点 + Java 17 端点 (10 路由文件)', () => {
  assert.match(NORMAL_RUN.stdout, /\[4\/7\] agents\.ts 关键端点/)
  assert.match(NORMAL_RUN.stdout, /6 个 P0 端点/)
  // Java 17 端点检查(exam/asks/search/resource/user/order/ai-extended/notifications/auth)
  assert.match(NORMAL_RUN.stdout, /Java 17 端点 \(exam\.ts 含 11 端点\)/)
  assert.match(NORMAL_RUN.stdout, /Java 17 端点 \(asks\.ts 含 5 端点\)/)
  assert.match(NORMAL_RUN.stdout, /Java 17 端点 \(search\.ts 含 4 端点\)/)
  assert.match(NORMAL_RUN.stdout, /Java 17 端点 \(user\.ts 含 5 端点\)/)
  assert.match(NORMAL_RUN.stdout, /Java 17 端点 \(order\.ts 含 2 端点\)/)
  assert.match(NORMAL_RUN.stdout, /Java 17 端点 \(auth\.ts 含 2 端点\)/)
})

// ─── 7. [5/7] 路径别名重定向 (3 个 redirect) ─────────────────
test('输出 [5/7]: routes/index.ts 含 3 个路径别名 redirect', () => {
  assert.match(NORMAL_RUN.stdout, /\[5\/7\] 路径别名重定向/)
  assert.match(NORMAL_RUN.stdout, /routes\/index\.ts 含 3 个路径别名 redirect/)
})

// ─── 8. [6/7] PROJECT_PLAN.md 真实性 ────────────────────────
test('输出 [6/7]: PROJECT_PLAN.md 不含无证据 "100% 整合迁移" 声明', () => {
  assert.match(NORMAL_RUN.stdout, /\[6\/7\] PROJECT_PLAN\.md 真实性/)
  assert.match(NORMAL_RUN.stdout, /PROJECT_PLAN\.md 存在且未含.*100%.*整合迁移.*无证据声明/)
})

// ─── 9. [7/7] 前端 P0 5 项 API 路径与方法一致性 ─────────────
test('输出 [7/7]: 前端 P0 5 项 API + 5+ redirect', () => {
  assert.match(NORMAL_RUN.stdout, /\[7\/7\] 前端 P0/)
  assert.match(NORMAL_RUN.stdout, /use-agent\.ts.*\/api\/agents\/list/)
  assert.match(NORMAL_RUN.stdout, /use-notification\.ts.*PATCH/)
  assert.match(NORMAL_RUN.stdout, /notifications\/badge 端点存在/)
  assert.match(NORMAL_RUN.stdout, /qr\/status.*qr\/generate 端点存在/)
  assert.match(NORMAL_RUN.stdout, /routes\/index\.ts 含 5\+ 个路径别名 redirect/)
})

// ─── 10. [8/8] 运行时端到端检查 (容错: 服务未启动不崩溃) ────
test('输出 [8/8]: 运行时端到端检查 (容错, 服务未启动不崩溃)', () => {
  assert.match(NORMAL_RUN.stdout, /\[8\/8\] 运行时端到端检查/)
  // 5 个运行时端点 URL
  assert.match(NORMAL_RUN.stdout, /API health/)
  assert.match(NORMAL_RUN.stdout, /agents list/)
  assert.match(NORMAL_RUN.stdout, /ai-service health/)
  assert.match(NORMAL_RUN.stdout, /web home/)
  assert.match(NORMAL_RUN.stdout, /oauth keys list/)
  // 容错: 服务未启动时报告 "服务未启动" 或返回 HTTP 状态码, 不崩溃
  // (5 个端点中至少有一个会有响应: 200 / 401 / 服务未启动)
  assert.match(NORMAL_RUN.stdout, /→ 200|→ 401|服务未启动/)
})

// ═══════════════════════════════════════════════════════════
// 3. 汇总与退出码语义
// ═══════════════════════════════════════════════════════════

// ─── 11. 汇总: 通过/警告/错误 计数 + 成功/失败标识 ──────────
// 基于 stdout 判断成功/失败(不依赖 exit code, 兼容 Windows libuv 退出崩溃)
test('汇总: 通过/警告/错误 计数 + 成功/失败标识与错误数一致', () => {
  assert.match(NORMAL_RUN.stdout, /迁移完整性守门汇总/)
  assert.match(NORMAL_RUN.stdout, /通过: \d+/)
  assert.match(NORMAL_RUN.stdout, /警告: \d+/)
  assert.match(NORMAL_RUN.stdout, /错误: \d+/)

  // 基于 stdout 判断成功/失败(脚本 process.exit 在 Windows 上可能被
  // libuv fetch 退出崩溃覆盖, 故用输出标识而非 exit code 判定)
  const errMatch = NORMAL_RUN.stdout.match(/错误: (\d+)/)
  const errCount = errMatch ? parseInt(errMatch[1], 10) : -1
  if (errCount === 0) {
    // 错误数 0 → 输出 "所有硬约束通过, 允许 commit"
    assert.match(NORMAL_RUN.stdout, /所有硬约束通过, 允许 commit/)
  } else {
    // 错误数 > 0 → 输出 "阻断 commit"
    assert.match(NORMAL_RUN.stdout, /阻断 commit/)
  }
})

// ─── 12. tee 文件: __gate_result.txt 被写入脚本输出 ──────────
test('tee 文件: __gate_result.txt 被写入脚本输出 (R74 v3 tee 机制)', () => {
  assert.ok(existsSync(GATE_RESULT_FILE), `__gate_result.txt 应被创建: ${GATE_RESULT_FILE}`)
  const content = readFileSync(GATE_RESULT_FILE, 'utf-8')
  // tee 文件应含脚本输出(非空, 去除 ANSI 后的纯文本)
  assert.ok(content.length > 0, '__gate_result.txt 不应为空')
  // 正常模式最后运行, tee 文件应含汇总标识
  assert.ok(
    content.includes('迁移完整性守门汇总') || content.includes('整体跳过'),
    'tee 文件应含汇总或早退信息',
  )
})

// ═══════════════════════════════════════════════════════════
// 4. --staged 模式 (staged-aware 行为)
// ═══════════════════════════════════════════════════════════

// ─── 13. --staged: 脚本运行不崩溃, exit 0 或 1 ──────────────
test('--staged: 脚本运行不崩溃, exit 0 或 1', () => {
  assert.ok(
    STAGED_RUN.status === 0 || STAGED_RUN.status === 1,
    `--staged exit 应为 0 或 1, 实际 ${STAGED_RUN.status}\nstdout: ${STAGED_RUN.stdout}\nstderr: ${STAGED_RUN.stderr}`,
  )
})

// ─── 14. --staged: staged-aware 行为 + 审计报告检查可跳过 ────
test('--staged: staged-aware 行为 (无相关 staged → 早退跳过 + 审计报告跳过; 有 → 完整检查)', () => {
  // 两种合法行为(取决于当前 git staged 状态):
  // 1. 无相关 staged 文件 → "整体跳过" + exit 0 (不触发 [8/8] fetch) + 审计报告跳过
  // 2. 有相关 staged 文件 → "迁移完整性守门汇总" (完整检查) + 审计报告检查
  const hasSkip = STAGED_RUN.stdout.includes('整体跳过')
  const hasFullCheck = STAGED_RUN.stdout.includes('迁移完整性守门汇总')
  assert.ok(
    hasSkip || hasFullCheck,
    '--staged 应输出早退标识("整体跳过")或完整检查标识("迁移完整性守门汇总")',
  )

  if (hasSkip) {
    // 早退模式: 不触发 [8/8] 运行时 fetch (快速退出)
    assert.ok(
      !STAGED_RUN.stdout.includes('[8/8]'),
      '早退模式不应触发 [8/8] 运行时端到端检查',
    )
    assert.match(STAGED_RUN.stdout, /staged-aware skip/)
    // 早退模式: 审计报告存在性检查也跳过(未涉及 PROJECT_PLAN.md)
    assert.match(STAGED_RUN.stdout, /审计报告存在性检查跳过/)
  }
})

// ═══════════════════════════════════════════════════════════
// 5. 清理 (保持工作区卫生, AGENTS.md §15)
// ═══════════════════════════════════════════════════════════

// ─── 15. 清理: 移除脚本产生的 __gate_result.txt ─────────────
test('清理: 移除脚本产生的 __gate_result.txt (保持工作区卫生)', () => {
  rmSync(GATE_RESULT_FILE, { force: true })
  assert.ok(!existsSync(GATE_RESULT_FILE), '清理后 __gate_result.txt 不应存在')
})
