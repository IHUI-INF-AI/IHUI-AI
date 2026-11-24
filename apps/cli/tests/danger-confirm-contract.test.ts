// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 危险确认回调契约(`DangerousConfirmationCallback`)的显式验收。
 *
 * 立因(票 6733):`--allow-dangerous` 确认旁路仍在调用方,复核后**不是 fail-open**
 * (`tools/index.ts` 的 `resolveDangerousConfirmation` 缺回调即 `no-channel` ⇒ 拒绝),
 * 缺的是**契约声明与测试面**而不是放行逻辑。本文件把票面三条断言逐条钉在
 * `executeToolCall` 的**副作用**上(handler 真跑没跑),而不是只断言返回 `success === false` ——
 * 后者会放过"先执行再回拒绝"这一型。
 *
 * 三条断言(与 `resolveDangerousConfirmation` 的三档结局一一对应):
 *   ① 给了回调且拒绝 ⇒ 不执行,归因 `user-declined`;
 *   ② 不给回调      ⇒ 拒绝且原因可辨,归因 `no-confirmation-channel`(安全默认,不放宽);
 *   ③ 给了回调且同意 ⇒ 执行一次,并记一笔 callbackApproved 披露计数。
 * 另钉一格:影子字段 `ctx.allowDangerous=true` 而没有回调 ⇒ **仍然零执行**(契约不读影子字段)。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';

import type * as ApiClient from '@ihui/api-client';
import type * as AuditModule from '../src/audit.js';

// 审计摄入出口打桩成"未登录"(hasToken 为 null ⇒ 上报层静默跳过):
// 否则开发机上一份已登录的 ~/.ihui/settings.json 会让单测真发一次网络请求。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return { ...actual, getToken: () => null };
});
// 审计日志落 ~/.ihui/audit.jsonl:单测不写用户家目录。
vi.mock('../src/audit.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AuditModule>();
  return { ...actual, auditLog: vi.fn() };
});

import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  resolveDangerousConfirmation,
  type DangerousConfirmationCallback,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js';
import { resetDangerousApprovals, snapshotDangerousApprovals } from '../src/tools/danger-gate.js';
import { resetPermissionLeaseForTests } from '../src/tools/permission-lease.js';

/** 零 hook 前提显式钉住:命中开发机上真实 hooks 配置会让"无回调即拒"这一格依赖环境。 */
const NO_HOOKS_CONFIG = fileURLToPath(new URL('./__no_such_hooks_config__.json', import.meta.url));

function registerDangerousTool(name: string): Tool {
  const tool: Tool = {
    name,
    description: `dangerous fixture ${name}`,
    parameters: {},
    required: [],
    dangerLevel: 'dangerous',
    execute: vi.fn(async () => ({ success: true, output: 'executed' })),
  };
  registerTools([tool]);
  return tool;
}

const ctxWith = (overrides: Partial<ToolContext> = {}): ToolContext => ({
  workspacePath: process.cwd(),
  ...overrides,
});

beforeAll(() => {
  vi.stubEnv('IHUI_HOOKS_CONFIG', NO_HOOKS_CONFIG);
  vi.stubEnv('IHUI_AUDIT', '0');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  clearTools();
  resetRateLimiter();
  resetPermissionLeaseForTests();
  resetDangerousApprovals();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('契约② 不给回调 ⇒ 拒绝且原因可辨(安全默认,不放宽)', () => {
  it('零执行,decider=no-confirmation-channel,拒绝串带结构化归因与出路', async () => {
    const tool = registerDangerousTool('contract_no_channel');
    const r = await executeToolCall({ name: tool.name, arguments: { probe: 1 } }, ctxWith());

    // 副作用未发生才是判据;返回体只证明"有人拦"。
    expect(tool.execute).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(r.denial?.gate).toBe('dangerous-gate');
    expect(r.denial?.decider).toBe('no-confirmation-channel');
    // "原因可辨":人读面与结构化面同源,且出路写明没有环境变量旁路。
    expect(r.error).toContain('危险操作被拒绝(需用户确认)');
    expect(r.error).toContain('decider=no-confirmation-channel');
    expect(r.denial?.guidance).toContain('NO environment-variable bypass');
  });

  it('只有影子字段 allowDangerous=true(无回调)⇒ 仍零执行:契约不从 ctx 读旁路', async () => {
    const tool = registerDangerousTool('contract_shadow_field_only');
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ allowDangerous: true }),
    );

    expect(tool.execute).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.denial?.decider).toBe('no-confirmation-channel');
    expect(snapshotDangerousApprovals()).toEqual([]);
  });
});

describe('契约① 给了回调且拒绝 ⇒ 不执行', () => {
  it('回调恰好一次且拿到同一个 Tool 与同一份参数;handler 零调用,归因 user-declined', async () => {
    const tool = registerDangerousTool('contract_declined');
    const confirm = vi.fn<DangerousConfirmationCallback>(async () => false);
    const args = { command: 'probe-never-run' };

    const r = await executeToolCall(
      { name: tool.name, arguments: args },
      ctxWith({ confirmDangerous: confirm }),
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(tool, args);
    expect(tool.execute).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('permission_denied');
    expect(r.denial?.gate).toBe('dangerous-gate');
    expect(r.denial?.decider).toBe('user-declined');
    expect(r.error).toContain('decider=user-declined');
    expect(r.denial?.guidance).toContain('actively declined');
    // 拒绝不得记成批准。
    expect(snapshotDangerousApprovals()).toEqual([]);
  });
});

describe('契约③ 给了回调且同意 ⇒ 执行一次', () => {
  it('handler 恰好一次、无 denial 行,披露计数落 callbackApproved', async () => {
    const tool = registerDangerousTool('contract_approved');
    const confirm = vi.fn<DangerousConfirmationCallback>(async () => true);

    const r = await executeToolCall(
      { name: tool.name, arguments: { probe: 'approved' } },
      ctxWith({ confirmDangerous: confirm }),
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(tool.execute).toHaveBeenCalledTimes(1);
    expect(r.success).toBe(true);
    expect(r.denial).toBeUndefined();
    expect(snapshotDangerousApprovals()).toEqual([
      { tool: 'contract_approved', sessionFlagApproved: 0, callbackApproved: 1 },
    ]);
  });
});

describe('契约判定出口 resolveDangerousConfirmation(单源,不从布尔反推渠道)', () => {
  const tool: Tool = {
    name: 'contract_resolver_probe',
    description: '',
    parameters: {},
    required: [],
    dangerLevel: 'dangerous',
    execute: async () => ({ success: true, output: '' }),
  };

  it('三档互斥且必居其一:absent ⇒ no-channel / false ⇒ declined / true ⇒ approved', async () => {
    await expect(resolveDangerousConfirmation({}, tool, {})).resolves.toEqual({
      kind: 'no-channel',
      via: 'absent',
    });
    await expect(
      resolveDangerousConfirmation({ confirmDangerous: async () => false }, tool, {}),
    ).resolves.toEqual({ kind: 'declined', via: 'callback' });
    await expect(
      resolveDangerousConfirmation({ confirmDangerous: async () => true }, tool, {}),
    ).resolves.toEqual({ kind: 'approved', via: 'callback' });
  });

  it('回调抛错不被本出口吞成任何一档(由回调实现方按平台语义 fail-closed)', async () => {
    const boom = new Error('probe prompt failure');
    await expect(
      resolveDangerousConfirmation(
        {
          confirmDangerous: async () => {
            throw boom;
          },
        },
        tool,
        {},
      ),
    ).rejects.toBe(boom);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
