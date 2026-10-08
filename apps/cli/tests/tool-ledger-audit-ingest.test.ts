// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86A「证据流水的写入源投影」的 CLI 侧回归(2026-09-28)。
 *
 * 钉四件事,每条都是本仓记过的高频失效型:
 * 1. **投影纪律**:审计事实只带无归因的对账字段 —— callId=dedupeKey、
 *    fingerprint 为 16 hex;**args / userId / user_id 在 wire 上逐层不得出现**
 *    (深扫断言,不是只看顶层键 —— "顶层没有、嵌套里带出去"是这类泄漏的原形)。
 * 2. **生产消费者真的在跑**:runToolLoop 的每一轮快照必须打到 fetchApi
 *    (此前"记了但没人取"就是零消费者;"外部回调传了才算接上"的旧形态,
 *    会被下一个不传 opts 的入口静默旁路 —— 审计接缝独立于回调接缝)。
 * 3. **失败可见**:404 只喊一次并停止重试(原因报过、不当恒常噪声);
 *    其余非 2xx 每轮都喊;未登录静默跳过(没有主体,不是失败)。
 * 4. **截断不静默**:超上限丢弃必须进 stderr 点名 dropped 数。
 *
 * 反向证明(交付物③)以运行方式取证:把 agent.ts finalizeLedger 里的
 * `void reportToolLedgerSnapshotToAudit(snap)` 注掉 ⇒ 本文件"生产消费者"用例
 * 必须红;还原后复绿。两次输出贴在交付报告,不在此重复。
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
  runToolLoop,
  reportToolLedgerSnapshotToAudit,
  TOOL_LEDGER_AUDIT_INGEST_PATH,
  __resetToolLedgerAuditStateForTest,
} from '../src/commands/agent.js';
import type { ChatMessage } from '../src/context.js';
import {
  StreamToolLedger,
  buildToolLedgerAuditIngest,
  projectLedgerEntryToAuditFact,
  TOOL_LEDGER_AUDIT_MAX_FACTS,
} from '../src/stream-tool-ledger.js';
import { registerTools, clearTools, disableToolHub, type Tool } from '../src/tools/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const FIXTURE_ROOT = path.join(REPO_ROOT, '.ihui-agent', 'tmp');

const TOOL_NAME = 'audit_ingest_probe';
const CALL_ARGS = { path: 'notes.md', secret: 'do-not-egress' };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function startEvent(): Parameters<NonNullable<Parameters<typeof streamChatMock>[0]['onToolCall']>>[0] {
  return { type: 'tool-call-start', toolCallId: 'call-1', toolName: TOOL_NAME, args: { ...CALL_ARGS } };
}

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

function makeLedger(): StreamToolLedger {
  return new StreamToolLedger({ turn: 1, streamId: 't1-abc', mayRunEarly: () => false });
}

describe('写入源投影(fingerprint 作摘要、args 不出机)', () => {
  it('settled 条目 ⇒ callId=dedupeKey、state/ok 同形、args 在任何层都不出现', async () => {
    const ledger = makeLedger();
    const entry = ledger.register({ toolCallId: 'c1', toolName: TOOL_NAME, args: { ...CALL_ARGS } });
    await ledger.runOnce(entry, async () => 'v');
    const fact = projectLedgerEntryToAuditFact(ledger.entries()[0]!);
    expect(fact.callId).toBe(entry.dedupeKey);
    expect(fact.state).toBe('settled');
    expect(fact.ok).toBe(true);
    expect(fact.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(fact.seq).toBe(1);
    // 摘要即 fingerprint,入参原文不出机:
    expect(JSON.stringify(fact)).not.toContain('notes.md');
    expect(JSON.stringify(fact)).not.toContain('do-not-egress');
  });

  it('lost 条目 ⇒ state=lost 且 skipReason 随事实上报(未知项必须如实列出)', () => {
    const ledger = makeLedger();
    ledger.register({ toolName: TOOL_NAME, args: { ...CALL_ARGS } });
    ledger.markEndOfStream();
    const fact = projectLedgerEntryToAuditFact(ledger.entries()[0]!);
    expect(fact.state).toBe('lost');
    expect(fact.skipReason).toBeTruthy();
  });

  it('超上限截断 ⇒ dropped>0 明说,不静默变短', () => {
    const ledger = makeLedger();
    for (let i = 0; i < TOOL_LEDGER_AUDIT_MAX_FACTS + 3; i++) {
      ledger.register({ toolName: TOOL_NAME, args: { i } });
    }
    const built = buildToolLedgerAuditIngest(ledger.snapshot());
    expect(built.dropped).toBe(3);
    expect(built.ingest.facts).toHaveLength(TOOL_LEDGER_AUDIT_MAX_FACTS);
  });
});

describe('生产写入源(runToolLoop → fetchApi 审计入口)', () => {
  let workspace = '';
  let stderrSpy: { calls: unknown[][] };

  function probeTool(): Tool {
    return {
      name: TOOL_NAME,
      description: 'audit probe',
      parameters: { path: { type: 'string', description: 'p' } },
      required: ['path'],
      dangerLevel: 'read',
      execute: async () => ({ success: true, output: 'X' }),
    } as Tool;
  }

  beforeEach(() => {
    disableToolHub();
    clearTools();
    streamChatMock.mockReset();
    fetchApiMock.mockReset();
    fetchApiMock.mockResolvedValue({ success: true, data: { recorded: 1, failed: 0 } });
    getTokenMock.mockReset();
    getTokenMock.mockReturnValue('test-access-token');
    __resetToolLedgerAuditStateForTest();
    stderrSpy = { calls: [] };
    vi.spyOn(process.stderr, 'write').mockImplementation(((s: unknown) => {
      stderrSpy.calls.push([s]);
      return true;
    }) as never);
    fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
    workspace = fs.mkdtempSync(path.join(FIXTURE_ROOT, 'ledger-audit-'));
    registerTools([probeTool()]);
  });

  afterEach(() => {
    clearTools();
    vi.restoreAllMocks();
    if (fs.existsSync(workspace)) fs.rmSync(workspace, { recursive: true, force: true });
  });

  /** 一轮"提前执行已落地、随后断流"的循环:快照必须在收尾时打到审计入口 */
  async function runOneMidStreamErrorTurn() {
    streamChatMock.mockImplementation(async (o: {
      onToolCall?: (e: unknown) => void;
      onError?: (m: string) => void;
    }) => {
      o.onToolCall?.(startEvent());
      await tick();
      o.onError?.('connection reset mid-stream');
    });
    const promise = runToolLoop({
      modelId: 'test',
      messages: [{ role: 'user', content: 'go' } as ChatMessage],
      ctx: { workspacePath: workspace },
      sessionId: 'ledger-audit',
      maxIterations: 2,
    });
    await promise;
    await tick(); // 冲刷 fire-and-forget 的 await 链
  }

  it('runToolLoop 不传任何回调也必须把快照上报到审计入口(生产接缝独立于外部回调)', async () => {
    await runOneMidStreamErrorTurn();
    expect(fetchApiMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchApiMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe(TOOL_LEDGER_AUDIT_INGEST_PATH);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body) as {
      version: number;
      turn: number;
      streamId: string;
      facts: { toolName: string; state: string }[];
    };
    expect(body.version).toBe(1);
    expect(body.turn).toBe(1);
    expect(body.facts).toHaveLength(1);
    expect(body.facts[0]!.toolName).toBe(TOOL_NAME);
    expect(body.facts[0]!.state).toBe('settled');
    // 上报体逐层无身份字段(§5:属主只能取令牌主体,客户端不得自带)
    const keys = collectKeys(body);
    expect(keys.has('userId')).toBe(false);
    expect(keys.has('user_id')).toBe(false);
    expect(keys.has('args')).toBe(false);
  });

  it('未登录(getToken=null)⇒ 不静默失败也不上报:直接跳过', async () => {
    getTokenMock.mockReturnValue(null);
    await runOneMidStreamErrorTurn();
    expect(fetchApiMock).not.toHaveBeenCalled();
    expect(stderrSpy.calls.join('')).not.toContain('tool-ledger-audit');
  });

  it('404(入口尚未挂载)⇒ 点名一次并停止本进程重试,不制造每轮噪声', async () => {
    fetchApiMock.mockResolvedValue({ success: false, status: 404, error: 'Route not found' });
    const ledger = makeLedger();
    ledger.register({ toolName: TOOL_NAME, args: { ...CALL_ARGS } });
    const snap = ledger.snapshot();
    await reportToolLedgerSnapshotToAudit(snap);
    const firstRound = stderrSpy.calls.flat().join('');
    expect(firstRound).toContain('not mounted');
    await reportToolLedgerSnapshotToAudit(snap);
    expect(fetchApiMock).toHaveBeenCalledTimes(1); // 第二次不再投
    expect(stderrSpy.calls.flat().join('').match(/not mounted/g)).toHaveLength(1);
  });

  it('非 404 的失败每轮都喊出来(不得 catch 后当成功)', async () => {
    fetchApiMock.mockResolvedValue({ success: false, status: 500, error: 'boom-body' });
    const ledger = makeLedger();
    ledger.register({ toolName: TOOL_NAME, args: { ...CALL_ARGS } });
    const snap = ledger.snapshot();
    await reportToolLedgerSnapshotToAudit(snap);
    await reportToolLedgerSnapshotToAudit(snap);
    expect(fetchApiMock).toHaveBeenCalledTimes(2);
    const out = stderrSpy.calls.flat().join('');
    expect((out.match(/report failed status=500/g) ?? []).length).toBe(2);
    // 不回显服务端响应体(error 文本不外溢到 stderr)
    expect(out).not.toContain('boom-body');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
