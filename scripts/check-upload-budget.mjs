#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分片上传聚合预算棘轮门(2026-09-30,票 b76-12c-3)。
 *
 * 治「常量登记了但没消费者」同型:PROTOCOL_UPLOAD_LIMITS 里登记了跨会话聚合预算两档
 * (maxActiveSessionsPerUser / maxStagedBytesGlobal),若 routes/chunked-upload.ts 的
 * 消费检被摘掉,常量就退化成又一张死表 —— 门断言两处预算检**各 ≥1**:
 *   - begin 处(新建装配检):isPerUserSessionBudgetExceeded( 对齐上游「新建装配」半边;
 *   - 每片落盘处(追加分片检):wouldStagedBudgetOverflow( 对齐上游「追加分片」半边。
 * 同时复核两档常量确实在 upload-integrity.ts 登记(缺登记 = 上游两处检的常量蒸发)。
 *
 * 禁止项:不得用改名/搬文件/包一层再调等方式让本门的字符串判据失明 —— 若判据名演进,
 * 应同步演进本门而不是绕过它。
 *
 * 用法: node scripts/check-upload-budget.mjs [--self-test]
 * 【接线状态:已接入】注册条目已落在 scripts/guardian-runner.mjs(id 以 runner 现值为准,
 * 勿照抄本行数字):blocking + skipEnv:HUSKY_SKIP_UPLOAD_BUDGET,无 stagedTriggers。
 * —— 本段原写"本脚本刻意不接提交链(guardian-runner / package.json scripts / .husky 均不归
 * 本脚本改),接链由守门持有人统一做(AGENTS §12f)",那是立项时的实况,已过期(门早已装车);
 * 分工边界保留,接线事实按上条现读改写。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ROUTE_FILE = 'apps/api/src/routes/chunked-upload.ts'
const LIMITS_FILE = 'apps/api/src/services/upload-integrity.ts'

/** 判据(可注入源码文本,--self-test 复用):预算检与常量登记是否在位。 */
export function judgeUploadBudget(routeSrc, limitsSrc) {
  const problems = []
  if (!routeSrc || !limitsSrc) {
    problems.push('源码为空(文件不存在或未读取)')
    return { ok: false, problems }
  }
  const beginChecks = routeSrc.split('isPerUserSessionBudgetExceeded(').length - 1
  const appendChecks = routeSrc.split('wouldStagedBudgetOverflow(').length - 1
  if (beginChecks < 1) {
    problems.push(
      `begin 处(新建装配)的单用户活跃会话预算检缺失:isPerUserSessionBudgetExceeded( 出现 ${beginChecks} 次(须 ≥1)`,
    )
  }
  if (appendChecks < 1) {
    problems.push(
      `每片落盘处(追加分片)的全局暂存字节预算检缺失:wouldStagedBudgetOverflow( 出现 ${appendChecks} 次(须 ≥1)`,
    )
  }
  if (!limitsSrc.includes('maxActiveSessionsPerUser')) {
    problems.push('maxActiveSessionsPerUser 未在 PROTOCOL_UPLOAD_LIMITS 登记')
  }
  if (!limitsSrc.includes('maxStagedBytesGlobal')) {
    problems.push('maxStagedBytesGlobal 未在 PROTOCOL_UPLOAD_LIMITS 登记')
  }
  return { ok: problems.length === 0, problems, beginChecks, appendChecks }
}

function run() {
  let routeSrc
  let limitsSrc
  try {
    routeSrc = readFileSync(path.join(ROOT, ROUTE_FILE), 'utf8')
  } catch {
    routeSrc = ''
  }
  try {
    limitsSrc = readFileSync(path.join(ROOT, LIMITS_FILE), 'utf8')
  } catch {
    limitsSrc = ''
  }
  const verdict = judgeUploadBudget(routeSrc, limitsSrc)
  console.log(
    `[check-upload-budget] begin 检 ${verdict.beginChecks ?? 0} 处 / 追加检 ${verdict.appendChecks ?? 0} 处`,
  )
  if (!verdict.ok) {
    for (const p of verdict.problems) {
      console.error(`[check-upload-budget] FAIL: ${p}`)
    }
    console.error(
      '[check-upload-budget] 聚合预算两档成了「登记无消费」的死表 —— 恢复 chunked-upload.ts 的两处预算检,不得绕过本门。',
    )
    process.exitCode = 1
    return
  }
  console.log('[check-upload-budget] PASS')
}

// ---------- --self-test:内嵌用例验证判据逻辑,不触盘 ----------
function selfTest() {
  let passed = 0
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`[check-upload-budget:self-test] FAIL: ${msg}`)
      process.exitCode = 1
    } else {
      passed++
    }
  }
  const routeOk = `
    const r1 = isPerUserSessionBudgetExceeded(n)
    const r2 = wouldStagedBudgetOverflow(staged, incoming)
  `
  const limitsOk = `export const PROTOCOL_UPLOAD_LIMITS = { maxActiveSessionsPerUser: 5, maxStagedBytesGlobal: 1 }`

  const v1 = judgeUploadBudget(routeOk, limitsOk)
  assert(v1.ok === true, '两处检在位 + 两档登记 → 绿')

  const v2 = judgeUploadBudget('const x = 1', limitsOk)
  assert(v2.ok === false && v2.problems.length === 2, '两处检都缺失 → 红,报两条')

  const v3 = judgeUploadBudget(routeOk, 'export const x = 1')
  assert(v3.ok === false && v3.problems.length === 2, '两档常量未登记 → 红,报两条')

  const v4 = judgeUploadBudget('', limitsOk)
  assert(v4.ok === false, '路由源为空 → 红(不得静默记绿)')

  console.log(`[check-upload-budget:self-test] ${passed} assertions passed`)
}

if (process.argv.includes('--self-test')) {
  selfTest()
  if (process.exitCode !== 1) console.log('[check-upload-budget:self-test] ALL GREEN')
} else {
  run()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
