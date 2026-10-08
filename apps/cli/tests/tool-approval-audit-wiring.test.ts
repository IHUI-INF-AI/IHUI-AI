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

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:保留本文件自己列出的桩(真发网络/真写盘的那几个),其余导出走真实实现。
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
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
  }
});

vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));

import {
  buildAgentDangerGate,
} from '../src/commands/agent.js';
import {
  reportToolApprovalDecisionToAudit,
  createAuditedDangerGate,
  TOOL_APPROVAL_AUDIT_INGEST_PATH,
  TOOL_APPROVAL_AUDIT_FALLBACK_SESSION,
  __resetToolApprovalAuditStateForTest,
} from '../src/tools/danger-gate-audit.js';
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

describe('D 层:装车(五个站点共用一份实现,谁都不许绕过包装器)', () => {
  const SRC_FILES = [
    '../src/commands/agent.ts',
    '../src/commands/repl.ts',
    '../src/acp/server.ts',
    '../src/server/agent-core.ts',
    '../src/tools/subagent.ts',
  ];

  it('五个生产站点必须全部经带审计的包装器构造 confirmDangerous', () => {
    for (const rel of SRC_FILES) {
      const src = fs.readFileSync(path.resolve(HERE, rel), 'utf8');
      if (rel === '../src/commands/agent.ts') {
        // runAgent 这一站多包一层工厂(为了让 silent 语义可被行为断言钉),所以两条分开判:
        // 站点用工厂、工厂内部用包装器。合成一条跨度正则会在这次挪动函数顺序时无辜变红。
        expect(src).toMatch(/confirmDangerous:\s*buildAgentDangerGate\(\{/);
        expect(src).toMatch(/return createAuditedDangerGate\(\{/);
      } else {
        expect(src, `站点 ${rel} 未用带审计的包装器`).toMatch(
          /confirmDangerous:\s*createAuditedDangerGate\(\{/,
        );
      }
    }
  });

  it('反向锁:站点不得再直连 createDangerGate(直连 = 决策静默不落链,而账面全绿)', () => {
    for (const rel of SRC_FILES) {
      const src = fs.readFileSync(path.resolve(HERE, rel), 'utf8');
      expect(src, `站点 ${rel} 又直连了 createDangerGate`).not.toMatch(/createDangerGate\s*\(/);
    }
  });

  it('runAgent 那一站仍把三个输入传进工厂(silent 语义未被接线改变)', () => {
    expect(AGENT_SRC).toMatch(
      /confirmDangerous:\s*buildAgentDangerGate\(\{[\s\S]{0,300}?allowDangerous:[\s\S]{0,120}?silent,[\s\S]{0,120}?sessionId:/,
    );
  });

  it('行为判序:调用方 onDecision 抛错时,审计事实必须已经发出(包装器不吞也不前置)', async () => {
    const gate = createAuditedDangerGate({
      allowDangerous: true,
      silent: true,
      auditSessionId: 'sess-order',
      onDecision: () => {
        throw new Error('caller hook blew up');
      },
    });
    // 不替调用方吞异常(吞了就是"提示层炸掉 ⇒ 放行结论也一起变"),但落链发生在它之前
    await expect(gate(DANGEROUS_TOOL, DANGEROUS_ARGS)).rejects.toThrow('caller hook blew up');
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    expect(bodyOfCall(0).facts[0]).toMatchObject({ route: 'flag', sessionId: 'sess-order' });
  });

  it('会话 ID 缺省必须落 fallback 常量(服务端 schema 要求非空,不得发空串)', async () => {
    const gate = createAuditedDangerGate({ allowDangerous: true, silent: true });
    await gate(DANGEROUS_TOOL, DANGEROUS_ARGS);
    expect(bodyOfCall().facts[0]!.sessionId).toBe(TOOL_APPROVAL_AUDIT_FALLBACK_SESSION);
  });

  it('上报调用的参数清单是封闭四项:sessionId / toolName / route / cause', () => {
    const auditSrc = fs.readFileSync(
      path.resolve(HERE, '../src/tools/danger-gate-audit.ts'),
      'utf8',
    );
    const callSite = /reportToolApprovalDecisionToAudit\(\{([\s\S]{0,400}?)\}\);/.exec(auditSrc);
    expect(callSite, '找不到上报调用体').toBeTruthy();
    const body = callSite![1]!;
    // 按**键名集合**判,而不是"某几个子串在不在":多塞一个 key(哪怕叫 args 或 userId)
    // 当场红;少一个 key(比如把 cause 删了)也当场红 —— 只 match 冒号的旧写法会漏掉
    // 简写形态,而只 match 简写的会漏掉属性形态,两种形态都见过。
    const keys = [...body.matchAll(/(?:^|[,{\s])([A-Za-z_]\w*)\s*:/g)].map((m) => m[1]);
    expect([...new Set(keys)].sort()).toEqual(['cause', 'route', 'sessionId', 'toolName']);
    expect(body).not.toMatch(/\bargs\b/);
    expect(body).not.toMatch(/userId|user_id|token|secret|password/i);
  });

  it('两侧路径常量逐字等值(CLI 常量 == 服务端注册后的完整路径)', () => {
    expect(TOOL_APPROVAL_AUDIT_INGEST_PATH).toBe('/api/cli/audit/tool-approvals');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
