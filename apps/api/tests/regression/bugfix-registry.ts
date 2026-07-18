/**
 * Bug 修复回归测试注册表
 *
 * 整理旧架构 17 轮 bug 修复(test_bug_fixes_round2-18.py)的关键场景,
 * 映射到新架构的回归测试文件,便于追溯。
 *
 * 状态说明:
 * - migrated: 已有对应测试文件
 * - pending:  场景已识别但测试文件待创建(列入后续补齐计划)
 */

export interface BugFixRecord {
  /** Bug ID(与旧架构 test_bug_fixes_roundN.py 对应) */
  bugId: string
  /** Bug 描述 */
  description: string
  /** 修复轮次(2-18) */
  round: number
  /** 对应的回归测试文件路径(相对 apps/api/src/),pending 状态时为计划路径 */
  testFile: string
  /** 验证场景简述 */
  scenario: string
  /** 迁移状态:migrated 已迁移 / pending 待创建 */
  status: 'migrated' | 'pending'
}

/**
 * 17 轮 bug 修复回归测试注册表
 * 来源:旧架构 server/tests/test_bug_fixes_round2-18.py
 *
 * 注:核查发现旧架构 17 轮 bug 修复测试**均未迁移**到新架构,
 * 此注册表记录场景与计划路径,后续按优先级创建测试文件。
 */
export const BUG_FIXES: BugFixRecord[] = [
  {
    bugId: 'BUG-R3-XSS',
    description: 'XSS 攻击防护:用户输入未转义导致脚本注入',
    round: 3,
    testFile: 'plugins/__tests__/xss-protection.test.ts',
    scenario: '提交含 <script> 标签的内容,验证被净化',
    status: 'pending',
  },
  {
    bugId: 'BUG-R5-CSRF',
    description: 'CSRF 双提交 Cookie 模式:token 未校验',
    round: 5,
    testFile: 'plugins/__tests__/csrf.test.ts',
    scenario: 'POST 请求无 csrf-token cookie,验证被拒绝',
    status: 'pending',
  },
  {
    bugId: 'BUG-R7-IDOR',
    description: 'IDOR 越权:用户 A 可访问用户 B 的资源',
    round: 7,
    testFile: 'plugins/__tests__/idor-guard.test.ts',
    scenario: '用户 A 请求 /api/users/B-id/profile,验证 403',
    status: 'pending',
  },
  {
    bugId: 'BUG-R9-PROMPT-INJECTION',
    description: 'Prompt 注入:用户输入劫持 LLM 系统提示词',
    round: 9,
    testFile: 'services/__tests__/prompt-injection-guard.test.ts',
    scenario: '提交 "ignore previous instructions",验证被过滤',
    status: 'pending',
  },
  {
    bugId: 'BUG-R11-UPLOAD-SCAN',
    description: '文件上传漏洞:未扫描恶意文件',
    round: 11,
    testFile: 'plugins/__tests__/upload-scanner.test.ts',
    scenario: '上传伪装为 .jpg 的 .exe,验证被拒绝',
    status: 'pending',
  },
  {
    bugId: 'BUG-R13-AUDIT-CHAIN',
    description: '审计日志链断裂:操作日志未完整记录',
    round: 13,
    testFile: 'services/__tests__/audit-chain.test.ts',
    scenario: '执行 5 次操作,验证审计日志连续无断点',
    status: 'pending',
  },
  {
    bugId: 'BUG-R15-BLOOM-GUARD',
    description: 'Bloom 过滤器误判:去重逻辑失效',
    round: 15,
    testFile: 'services/__tests__/bloom-guard.test.ts',
    scenario: '插入 1000 条重复 key,验证误判率 < 1%',
    status: 'pending',
  },
  {
    bugId: 'BUG-R16-DEADLOCK-RETRY',
    description: '数据库死锁:并发更新未自动重试',
    round: 16,
    testFile: 'services/__tests__/deadlock-retry.test.ts',
    scenario: '模拟 deadlock 错误,验证自动重试 3 次后成功',
    status: 'pending',
  },
  {
    bugId: 'BUG-R17-DB-FAILOVER',
    description: '数据库故障切换:主库宕机未切换到从库',
    round: 17,
    testFile: 'services/__tests__/db-failover.test.ts',
    scenario: '模拟主库连接超时,验证切换到从库',
    status: 'pending',
  },
  {
    bugId: 'BUG-R18-CHAOS',
    description: '混沌工程:网络分区下服务可用性',
    round: 18,
    testFile: 'services/__tests__/chaos-injector.test.ts',
    scenario: '注入 500ms 网络延迟,验证降级策略生效',
    status: 'pending',
  },
  {
    bugId: 'BUG-R18-P0-AUDIT',
    description: 'P0 审计缺口:多模块权限校验缺失',
    round: 18,
    testFile: 'routes/__tests__/p0-audit-gaps.test.ts',
    scenario: '遍历所有 admin 端点,验证均要求管理员权限',
    status: 'pending',
  },
]

/**
 * 查找指定 bug ID 的回归测试记录
 */
export function findBugFix(bugId: string): BugFixRecord | undefined {
  return BUG_FIXES.find((b) => b.bugId === bugId)
}

/**
 * 列出指定轮次的 bug 修复记录
 */
export function listBugFixesByRound(round: number): BugFixRecord[] {
  return BUG_FIXES.filter((b) => b.round === round)
}

/**
 * 列出所有 pending 状态的 bug 修复(测试文件待创建)
 */
export function listPendingBugFixes(): BugFixRecord[] {
  return BUG_FIXES.filter((b) => b.status === 'pending')
}

/**
 * 列出所有 migrated 状态的 bug 修复(测试文件已存在)
 */
export function listMigratedBugFixes(): BugFixRecord[] {
  return BUG_FIXES.filter((b) => b.status === 'migrated')
}
