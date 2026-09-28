// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import chalk from 'chalk';

import {
  __resetAuditIngestClientWarnForTest,
  resolveAuditIngestClient,
} from '../utils/audit-ingest-client.js';
import { createDangerGate, type DangerGate, type DangerGateDenyCause, type DangerGateOptions, type DangerGateRoute } from './danger-gate.js';

/**
 * 86H:审批决策 → 服务端审计链(#86 维度③)。
 *
 * 缺口:`appendAuditLog` 只覆盖 FS 工作区一条链,**agent 审批决策不进链** ——
 * danger-gate 的 flag/approved/denied 三路判定此前只在进程内 onDecision 可观测,
 * 进程一退就没有"谁在什么时候让不让"的痕迹。本模块把决策事实经服务端摄入端点落进
 * `audit_logs_chain`(唯一写入器仍是 api 侧的 `recordAuditLog`)。
 *
 * 为什么住在 tools 层而不是 `commands/agent.ts`:落链站点有五个(runAgent / repl / acp /
 * agent-core / subagent),其中三个在 tools/acp/server 层 —— 让它们反向 import
 * `commands/agent.js` 会造出 import 循环,而"同一个决策怎么变成一行审计"绝不允许写五份。
 *
 * 四条不可漂的口径:
 * 1. **请求体不带任何身份字段** —— 属主由服务端从令牌主体取,strict schema 拒自报;
 * 2. **失败必须可见** —— 非 2xx / 网络错写 stderr,只回显 status/errorCode,不回显响应体
 *    (响应体可能携带任意上游内容,凭据面纪律同守门 67);
 * 3. **未登录不是失败** —— 无 token 即无可归属主体,静默跳过、不产生噪音;
 * 4. **上报与 console 静默无关**:`silent` 关的是提示文案,不关落链。结构化输出档案下
 *    把上报一起关掉,等于"没人看着就不记",而决策记录的价值恰在无人值守时。
 * wire 上只有 {sessionId, toolName, route, cause?} —— **不含被批准执行的入参原文**
 * (那属于 tool.invoke 行的指纹档,86A;决策行回答的是"让不让",不是"跑了什么")。
 */

/** apps/api 侧审批决策摄入端点(挂载见 apps/api/src/routes/index.ts 的 86H 注册块) */
export const TOOL_APPROVAL_AUDIT_INGEST_PATH = '/api/cli/audit/tool-approvals';

/** 服务端 schema 要求非空主体上下文标识;取不到会话时落这个常量而不是空串(与 runToolLoop 同法)。 */
export const TOOL_APPROVAL_AUDIT_FALLBACK_SESSION = 'cli-default';

let toolApprovalAuditIngestMissing = false;

/** 仅测试用:重置"404 停止重试 / 出口缺失只喊一次"的模块级状态。 */
export function __resetToolApprovalAuditStateForTest(): void {
  toolApprovalAuditIngestMissing = false;
  // 同步清(动态 import 会让"下一次调用"看到上一次的只喊一次记录 ⇒ 测试自锁失效)
  __resetAuditIngestClientWarnForTest('tool-approval-audit');
}

/** 一条审批决策事实(与 apps/api 服务层 toolApprovalAuditFactSchema 同集)。 */
export interface ToolApprovalAuditFact {
  sessionId: string;
  toolName: string;
  route: DangerGateRoute;
  cause?: DangerGateDenyCause;
}

/**
 * 把一次 danger-gate 决策上报到服务端审计链。
 * fire-and-forget 由调用方决定(`void` + 不 await);本函数自身 await,
 * 以便测试 await 到落定再断言。
 */
export async function reportToolApprovalDecisionToAudit(fact: ToolApprovalAuditFact): Promise<void> {
  if (toolApprovalAuditIngestMissing) return;
  const client = resolveAuditIngestClient('tool-approval-audit');
  if (!client) return;
  // 未登录:没有可归属的主体,跳过(这不是上报失败,不产生噪音)。
  if (!client.hasToken()) return;
  const body = {
    facts: [
      {
        sessionId: fact.sessionId,
        toolName: fact.toolName,
        route: fact.route,
        ...(fact.cause ? { cause: fact.cause } : {}),
      },
    ],
  };
  const res = await client.post<{ recorded: number; failed: number }>(TOOL_APPROVAL_AUDIT_INGEST_PATH, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (res.success) return;
  if (res.status === 404) {
    // 摄入路由没挂载:原因报一次就够,每轮再喊等于制造恒常噪声。
    toolApprovalAuditIngestMissing = true;
    process.stderr.write(
      chalk.yellow(
        `[tool-approval-audit] ingest endpoint not mounted (404 ${TOOL_APPROVAL_AUDIT_INGEST_PATH}); approval reporting disabled for this process\n`,
      ),
    );
    return;
  }
  // 其余失败每次都报(不静默 catch 后当成功);刻意只回显 status/errorCode。
  process.stderr.write(
    chalk.yellow(
      `[tool-approval-audit] report failed status=${res.status ?? 'network'}${res.errorCode ? ` code=${res.errorCode}` : ''} (tool=${fact.toolName} route=${fact.route})\n`,
    ),
  );
}

/** createDangerGate 的全部入参 + 审计会话标识。 */
export interface AuditedDangerGateOptions extends DangerGateOptions {
  /** 落链用的会话 ID;缺省 ⇒ TOOL_APPROVAL_AUDIT_FALLBACK_SESSION(不得发空串) */
  auditSessionId?: string | null;
}

/**
 * 带审计落链的危险闸门 —— 五个站点唯一的正确构造方式。
 *
 * 策略仍住 `createDangerGate`(唯一出口),本包装器只做一件事:**先落链,再交给调用方
 * 自己的 onDecision**(控制台提示/IDE 卡片终态等)。判序是有意的:调用方的 onDecision
 * 若抛错,不能让审计事实跟着丢。
 */
export function createAuditedDangerGate(opts: AuditedDangerGateOptions): DangerGate {
  const { auditSessionId, ...gate } = opts;
  return createDangerGate({
    ...gate,
    onDecision: (decision) => {
      void reportToolApprovalDecisionToAudit({
        sessionId: auditSessionId || TOOL_APPROVAL_AUDIT_FALLBACK_SESSION,
        toolName: decision.tool.name,
        route: decision.route,
        cause: decision.cause,
      });
      gate.onDecision?.(decision);
    },
  });
}
