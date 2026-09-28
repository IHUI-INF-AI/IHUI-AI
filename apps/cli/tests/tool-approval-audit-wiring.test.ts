// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86H「agent 审批决策 → 审计链」CLI 侧回归(2026-09-28)。
 *
 * 四层判据,每层判的是不同的一件事,不得混为一谈:
 * A. **上报函数本体**(reportToolApprovalDecisionToAudit):事实逐字上 wire、入参原文
 *    与自报身份在任何层都不得出现、失败可见且不抛(不阻塞执行)、404 只喊一次并停止
 *    本进程重试、未登录静默跳过(没有主体不是失败)。
 * B. **生产工厂的语义**(buildAgentDangerGate = runAgent 用的那一个):flag 放行与
 *    no-prompt 拒绝都落链;silent(结构化输出档案)只关 console、不关落链;会话 ID
 *    缺省落 'cli-default'。这一层是行为断言,不是文本顺序断言。
 * C. **封闭集转发**:route 三档 × cause 四档逐档如实上 wire(不折叠、不改名)——
 *    票面判据①的 CLI 半边。route→result 的"可分辨"由服务端那半判
 *    (apps/api/tests/cli-tool-approval-audit.test.ts 按 VALUES 列位读 result 列)。
 * D. **装车证明**:runAgent 必须真用该工厂构造 confirmDangerous;上报调用的参数清单
 *    是封闭四项;两侧路径常量逐字等值。
 *
 * 覆盖面边界(如实登记,不得读成端到端已验):B 层覆盖 flag / no-prompt 两路,因为
 * runAgent 生产站点**没有** prompt 通道(真人批准发生在 acp/repl 那两个站点)。
 * approved / prompt-declined / prompt-error 三档由 tools/danger-gate.test.ts 证明
 * 闸门会产出、由本文件 C 层证明上报会转发 —— 组合成立,不在此复刻一份接线去冒充
 * 端到端。真链路(登录 CLI → audit_logs_chain 落行)随部署侧另计。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const { streamChatMock, fetchApiMock, getTokenMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn(),
  fetchApiMock: vi.fn(),
  getTokenMock: vi.fn<[], string | null>(() => 'test-access-token'),
}));

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
  fetchApi: fetchApiMock,
  getToken: getTokenMock,
}));

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

import {
  buildAgentDangerGate,
  reportToolApprovalDecisionToAudit,
  TOOL_APPROVAL_AUDIT_INGEST_PATH,
  __resetToolApprovalAuditStateForTest,
} from '../src/commands/agent.js';
import type { DangerGateDenyCause, DangerGateRoute } from '../src/tools/danger-gate.js';
import type { Tool } from '../src/tools/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_SRC = fs.readFileSync(path.resolve(HERE, '../src/commands/agent.ts'), 'utf8');

/** 深扫对象所有层的键名(泄漏判据不看顶层 —— 顶层干净、嵌套带出去才是原形) */
function collectKeys(value: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      acc.add(k);
      collectKeys(v, acc);
    }
  }
  return acc;
}

const DANGEROUS_TOOL = {
  name: 'run_command',
  description: 'dangerous probe',
  parameters: { command: { type: 'string', description: 'c' } },
  required: ['command'],
  dangerLevel: 'execute',
  execute: async () => ({ success: true, output: 'ok' }),
} as unknown as Tool;

const DANGEROUS_ARGS = { command: 'rm -rf /srv/secrets' };

const ROUTES: readonly DangerGateRoute[] = ['flag', 'approved', 'denied'];
const CAUSES: readonly DangerGateDenyCause[] = [
  'no-prompt',
  'prompt-declined',
  'prompt-empty',
  'prompt-error',
];

let stderrLines: string[] = [];

beforeEach(() => {
  fetchApiMock.mockReset();
  fetchApiMock.mockResolvedValue({ success: true, data: { requested: 1, accepted: 1, failed: 0 } });
  getTokenMock.mockReset();
  getTokenMock.mockReturnValue('test-access-token');
  __resetToolApprovalAuditStateForTest();
  stderrLines = [];
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderrLines.push(String(chunk));
    return true;
  }) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 取第 n 次 fetchApi 调用摊出的 body(默认 0);顺带钉端点与方法。 */
function bodyOfCall(n = 0): { facts: Array<Record<string, unknown>> } {
  const call = fetchApiMock.mock.calls[n] as [string, { method: string; body: string }];
  expect(call[0]).toBe(TOOL_APPROVAL_AUDIT_INGEST_PATH);
  expect(call[1].method).toBe('POST');
  return JSON.parse(call[1].body) as { facts: Array<Record<string, unknown>> };
}

// =============================================================================
// A 层:上报函数本体的四条口径
// =============================================================================

describe('A 层:上报函数本体', () => {
  it('正向:一条 approved 事实 ⇒ 打对端点,body 只有 {sessionId,toolName,route}', async () => {
    await reportToolApprovalDecisionToAudit({
      sessionId: 'sess-a',
      toolName: 'run_command',
      route: 'approved',
    });
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    expect(bodyOfCall()).toEqual({
      facts: [{ sessionId: 'sess-a', toolName: 'run_command', route: 'approved' }],
    });
  });

  it('denied 带 cause ⇒ cause 逐字上wire;不带 cause ⇒ 不得凭空造一个 null', async () => {
    await reportToolApprovalDecisionToAudit({
      sessionId: 'sess-a',
      toolName: 'run_command',
      route: 'denied',
      cause: 'prompt-declined',
    });
    expect(bodyOfCall().facts[0]).toEqual({
      sessionId: 'sess-a',
      toolName: 'run_command',
      route: 'denied',
      cause: 'prompt-declined',
    });
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-b', toolName: 'x', route: 'flag' });
    expect('cause' in bodyOfCall(1).facts[0]!).toBe(false);
  });

  it('隐私与身份:入参原文、userId/user_id 在任何一层都不得出现', async () => {
    await reportToolApprovalDecisionToAudit({
      sessionId: 'sess-a',
      toolName: 'run_command',
      route: 'approved',
      // 调用方多塞的东西也必须被丢掉:上报体的参数清单是封闭的,不是"透传整包"
      ...({ args: DANGEROUS_ARGS, userId: 'someone-else' } as Record<string, never>),
    });
    const body = bodyOfCall();
    const keys = collectKeys(body);
    for (const forbidden of ['args', 'command', 'userId', 'user_id']) {
      expect([...keys]).not.toContain(forbidden);
    }
    expect(JSON.stringify(body)).not.toContain('rm -rf');
    expect(JSON.stringify(body)).not.toContain('someone-else');
  });

  it('摄入失败不阻塞执行但必须点名:非 2xx ⇒ 函数正常返回 + stderr 喊出 status', async () => {
    fetchApiMock.mockResolvedValue({ success: false, status: 500, errorCode: 'E' });
    await expect(
      reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'flag' }),
    ).resolves.toBeUndefined();
    expect(stderrLines.join('')).toContain('[tool-approval-audit] report failed status=500');
    // 每轮都喊(不静默 catch 后当成功)
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'flag' });
    expect(stderrLines.filter((l) => l.includes('report failed'))).toHaveLength(2);
  });

  it('网络错(status 缺省)也得点名成 status=network,不得留成 undefined 的哑巴', async () => {
    fetchApiMock.mockResolvedValue({ success: false });
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'flag' });
    expect(stderrLines.join('')).toContain('status=network');
  });

  it('404 ⇒ 只喊一次并停止本进程重试;重置后可再试(状态是模块级的,测试必须能隔离)', async () => {
    fetchApiMock.mockResolvedValue({ success: false, status: 404 });
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'flag' });
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'approved' });
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    expect(stderrLines.filter((l) => l.includes('not mounted'))).toHaveLength(1);

    __resetToolApprovalAuditStateForTest();
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'flag' });
    expect(fetchApiMock).toHaveBeenCalledTimes(2);
  });

  it('未登录 ⇒ 一个请求都不发、也不喊(没有主体不是失败)', async () => {
    getTokenMock.mockReturnValue(null);
    await reportToolApprovalDecisionToAudit({ sessionId: 'sess-a', toolName: 'x', route: 'flag' });
    expect(fetchApiMock).not.toHaveBeenCalled();
    expect(stderrLines.join('')).toBe('');
  });
});

// =============================================================================
// B 层:生产工厂(runAgent 用的那一个)的语义
// =============================================================================

describe('B 层:buildAgentDangerGate 的放行语义未被接线改变', () => {
  it('flag 放行 ⇒ 返回 true 且落一行 flag 事实', async () => {
    const gate = buildAgentDangerGate({ allowDangerous: true, silent: true, sessionId: 'sess-gate' });
    expect(await gate(DANGEROUS_TOOL, DANGEROUS_ARGS)).toBe(true);
    expect(bodyOfCall().facts[0]).toEqual({
      sessionId: 'sess-gate',
      toolName: 'run_command',
      route: 'flag',
    });
  });

  it('fail-closed 未被削弱:无 flag 且无 prompt ⇒ 返回 false 且落一行 denied/no-prompt', async () => {
    const gate = buildAgentDangerGate({ allowDangerous: false, silent: true });
    expect(await gate(DANGEROUS_TOOL, DANGEROUS_ARGS)).toBe(false);
    expect(bodyOfCall().facts[0]).toEqual({
      sessionId: 'cli-default',
      toolName: 'run_command',
      route: 'denied',
      cause: 'no-prompt',
    });
  });

  it('silent(结构化输出档案)只关 console,不关落链 —— 这条是行为断言,不是文本顺序', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const gate = buildAgentDangerGate({ allowDangerous: true, silent: true, sessionId: 's' });
    expect(await gate(DANGEROUS_TOOL, DANGEROUS_ARGS)).toBe(true);
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('正向对照:text 档案既落链也保留原有中文提示(迁移逐路径等价)', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const gate = buildAgentDangerGate({ allowDangerous: true, silent: false, sessionId: 's' });
    expect(await gate(DANGEROUS_TOOL, DANGEROUS_ARGS)).toBe(true);
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0]?.[0])).toContain('自动允许危险操作');
  });

  it('被批准执行的命令行不得随决策出机(wire 里没有那条 rm -rf)', async () => {
    const gate = buildAgentDangerGate({ allowDangerous: true, silent: true, sessionId: 's' });
    await gate(DANGEROUS_TOOL, DANGEROUS_ARGS);
    expect(JSON.stringify(fetchApiMock.mock.calls[0]![1])).not.toContain('rm -rf');
  });
});

// =============================================================================
// C 层:封闭集转发(票面判据①的 CLI 半边)
// =============================================================================

describe('C 层:route 三档与 cause 四档逐档如实转发', () => {
  it.each(ROUTES)('route=%s ⇒ 原样上wire(不折叠成 success/failure,不改名)', async (route) => {
    const n = fetchApiMock.mock.calls.length;
    await reportToolApprovalDecisionToAudit({ sessionId: 's', toolName: 'x', route });
    expect(fetchApiMock).toHaveBeenCalledTimes(n + 1);
    expect(bodyOfCall(n).facts[0]!.route).toBe(route);
  });

  it.each(CAUSES)('cause=%s ⇒ 与 route=denied 同现时逐字上wire', async (cause) => {
    const n = fetchApiMock.mock.calls.length;
    await reportToolApprovalDecisionToAudit({ sessionId: 's', toolName: 'x', route: 'denied', cause });
    expect(bodyOfCall(n).facts[0]).toEqual({ sessionId: 's', toolName: 'x', route: 'denied', cause });
  });
});

// =============================================================================
// D 层:装车证明(结构,不是文本顺序)
// =============================================================================

describe('D 层:装车', () => {
  it('runAgent 必须用该工厂构造 confirmDangerous,三个输入都传进来', () => {
    expect(AGENT_SRC).toMatch(
      /confirmDangerous:\s*buildAgentDangerGate\(\{[\s\S]{0,300}?allowDangerous:[\s\S]{0,120}?silent,[\s\S]{0,120}?sessionId:/,
    );
  });

  it('工厂内部必须把决策喂给上报函数(而不是只挂 console)', () => {
    expect(AGENT_SRC).toMatch(
      /onDecision:\s*\(\s*\{[^}]*route[^}]*\}\s*\)\s*=>\s*\{[\s\S]{0,600}?reportToolApprovalDecisionToAudit\(\{/,
    );
  });

  it('上报调用的参数清单是封闭四项:sessionId / toolName / route / cause', () => {
    const callSite = /reportToolApprovalDecisionToAudit\(\{([\s\S]{0,300}?)\}\);/.exec(AGENT_SRC);
    expect(callSite, '找不到上报调用体').toBeTruthy();
    const body = callSite![1]!;
    expect(body).toMatch(/sessionId:/);
    expect(body).toMatch(/toolName:/);
    // route / cause 是简写形态(不带冒号)—— 只 match 冒号的那把尺子会静默漏掉它们,
    // 然后以"参数很少"的名义给出假绿灯。
    expect(/^[ \t]*route,[ \t]*$/m.test(body)).toBe(true);
    expect(/^[ \t]*cause,[ \t]*$/m.test(body)).toBe(true);
    expect(body).not.toMatch(/\bargs\b/);
    expect(body).not.toMatch(/userId|user_id/);
  });

  it('两侧路径常量逐字等值(CLI 常量 == 服务端注册后的完整路径)', () => {
    expect(TOOL_APPROVAL_AUDIT_INGEST_PATH).toBe('/api/cli/audit/tool-approvals');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
