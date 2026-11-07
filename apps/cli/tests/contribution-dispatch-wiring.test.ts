// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * goal-b49 / Z1 — contributor 两族的**派发腿**装车证明(2026-11-05)。
 *
 * 断言的不是"registry 返回了什么",而是**这条声明最后真的被派发到了模型请求里 / 插件回调上**:
 *   ① 消费者层两枚出口的正反两面(无声明 ⇒ 连 runner 都不叫、也不进注入台账);
 *   ② `runToolLoop` 全真链路(桩形态沿用 tests/agent-no-progress.test.ts,同一套 SSE 夹具):
 *      turnStart 的正文确实出现在**下发给模型的那一次请求**里,而持久历史里没有它;
 *      turnEnd 的回调真被调用一次。
 * 对账腿到人前那一格另立文件 `tests/contribution-audit-to-person.test.ts`(§3 单文件预算,
 * 不是"两段测试各写一半判据" —— 判据只有一份,分的是**测哪条链路**)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Settings } from '../src/commands/settings.js';
import type { PluginDefinition, TurnContributorContext } from '../src/plugins/types.js';
import { PluginRegistry } from '../src/plugins/registry.js';
import {
  buildPluginTurnInputSection,
  dispatchPluginCommandContributors,
} from '../src/plugins/declaration-consumers.js';
import { PLUGIN_TURN_INPUT_SECTION_ID } from '../src/plugins/turn-input-framing.js';
import { injectionLedger, resetInjectionLedger } from '../src/utils/prompt-injection-registry.js';

type StreamChatFn = (opts: unknown) => Promise<void>;

const { fetchMock, settingsState } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  settingsState: { value: {} as Record<string, unknown> },
}));

import type * as ApiClient from '@ihui/api-client';
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    streamChat: vi.fn<StreamChatFn>(),
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    formatSSEError: (err: unknown) => ({
      severity: 'unknown' as const,
      title: 'error',
      message: err instanceof Error ? err.message : String(err),
      rawMessage: err instanceof Error ? err.message : String(err),
      requireReauth: false,
    }),
  };
});
vi.mock('../src/audit.js', () => ({ auditLog: vi.fn() }));
vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, loadSettings: () => settingsState.value as Settings };
});

import { runToolLoop } from '../src/commands/agent.js';
import { clearTools } from '../src/tools/index.js';

const CTX: TurnContributorContext = { workingDir: '/work', turnNumber: 3, maxTurns: 8, sessionId: 's-1' };

function registryWith(def: PluginDefinition): PluginRegistry {
  const registry = new PluginRegistry({ workingDir: '/work' });
  registry.register(def);
  return registry;
}

describe('① 消费者层的正反两面(声明为空必须连 runner 都不叫)', () => {
  beforeEach(() => resetInjectionLedger());

  it('registry 缺席 ⇒ 空串 / 0(交互式默认路径零回归)', async () => {
    expect(await buildPluginTurnInputSection(undefined, CTX)).toBe('');
    expect(await dispatchPluginCommandContributors(null, CTX)).toBe(0);
  });

  it('只有声明、没有回调(JSON 清单那一型)⇒ 不注入,且**不进**注入台账', async () => {
    const registry = registryWith({ name: 'json-shape', version: '1.0.0', turnInputContributors: ['ctx'] });
    expect(await buildPluginTurnInputSection(registry, CTX)).toBe('');
    expect(injectionLedger().some((e) => e.id === PLUGIN_TURN_INPUT_SECTION_ID)).toBe(false);
  });

  it('声明 + 回调 ⇒ 正文带宿主填的出处标签进 reference_data 档,并记上一笔账', async () => {
    const registry = registryWith({
      name: 'p-ctx',
      version: '1.0.0',
      turnInputContributors: ['ctx-loader'],
      onTurnInputContribute: (c) => `turn=${c.turnNumber} dir=${c.workingDir}`,
    });
    const section = await buildPluginTurnInputSection(registry, CTX);
    expect(section).toContain('turn=3 dir=/work');
    expect(section).toContain('ctx-loader');
    expect(section).toContain('<ihui-skill role="reference-data">');
    const record = injectionLedger().find((e) => e.id === PLUGIN_TURN_INPUT_SECTION_ID);
    expect(record?.status).toBe('injected');
    expect((record?.bytes ?? 0) > 0).toBe(true);
  });

  it('命令贡献:回调真被叫到、拿到本轮上下文;只声明不回调 ⇒ 0 次', async () => {
    const seen: number[] = [];
    const registry = registryWith({
      name: 'p-lint',
      version: '1.0.0',
      commandContributors: ['lint'],
      onCommandContribute: (c) => {
        seen.push(c.turnNumber);
      },
    });
    expect(await dispatchPluginCommandContributors(registry, CTX)).toBe(1);
    expect(seen).toEqual([3]);
    const inert = registryWith({ name: 'p-lint2', version: '1.0.0', commandContributors: ['lint'] });
    expect(await dispatchPluginCommandContributors(inert, CTX)).toBe(0);
    expect(seen).toEqual([3]);
  });
});

describe('② runToolLoop 全真链路:贡献正文进的是这一次请求', () => {
  const encoder = new TextEncoder();
  function sseResponse(choices: Array<Record<string, unknown>>) {
    const lines = [...choices.map((c) => `data: ${JSON.stringify({ choices: [c] })}\n`), 'data: [DONE]\n'];
    return {
      ok: true,
      status: 200,
      text: async () => '',
      body: {
        getReader: () => {
          let i = 0;
          return {
            read: async () => {
              if (i >= lines.length) return { value: undefined, done: true };
              const line = lines[i];
              i += 1;
              return { value: encoder.encode(line), done: false } as { value: Uint8Array; done: boolean };
            },
          };
        },
      },
    };
  }

  async function drive(registry: PluginRegistry | undefined) {
    const requestBodies: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (_url: unknown, init: { body?: string }) => {
      requestBodies.push(JSON.parse(String(init?.body ?? '{}')));
      return sseResponse([
        { index: 0, delta: { content: '本轮做完了' }, finish_reason: null },
        { index: 0, delta: {}, finish_reason: 'stop' },
      ]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const messages = [
      { role: 'system' as const, content: 'sys' },
      { role: 'user' as const, content: '把这格接上' },
    ];
    const result = await runToolLoop({
      modelId: 'qwen2.5:7b',
      messages,
      ctx: { workspacePath: '/work' },
      // 2 而不是 1:迭代预算耗尽会把 stopReason 判成 max_iterations(那是收口档,不是本轮的结束方式),
      // 本用例要钉的是"end_turn 这条路径真走了 turnStart 注入 + turnEnd 派发"。
      maxIterations: 2,
      plugins: registry,
    });
    return { requestBodies, messages, result };
  }

  beforeEach(() => {
    clearTools();
    settingsState.value = { provider: 'ollama' };
    resetInjectionLedger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('turnStart 注入进请求、不进历史;turnEnd 贡献被调用一次', async () => {
    const contributed: number[] = [];
    const registry = registryWith({
      name: 'p-loop',
      version: '1.0.0',
      turnInputContributors: ['ctx-loop'],
      onTurnInputContribute: () => 'PLUGIN-CTX-MARKER',
      commandContributors: ['lint-loop'],
      onCommandContribute: (c) => {
        contributed.push(c.turnNumber);
      },
    });
    const { requestBodies, messages, result } = await drive(registry);
    expect(result.stopReason).toBe('end_turn');

    const sent = requestBodies[0]!.messages;
    const last = sent[sent.length - 1]!;
    expect(last.role).toBe('user');
    expect(last.content).toContain('PLUGIN-CTX-MARKER');
    expect(last.content).toContain('ctx-loop');
    // 只进本轮下发视图:持久历史(会话落库 / --resume 读的那一份)里结构性没有它
    expect(messages.some((m) => String(m.content).includes('PLUGIN-CTX-MARKER'))).toBe(false);
    expect(contributed).toEqual([1]);
  });

  it('反向对照:同一个 drive 不给 registry ⇒ 请求里没有贡献段、零记账(零回归)', async () => {
    const { requestBodies } = await drive(undefined);
    const flat = JSON.stringify(requestBodies);
    expect(flat).not.toContain('PLUGIN-CTX-MARKER');
    expect(injectionLedger().some((e) => e.id === PLUGIN_TURN_INPUT_SECTION_ID)).toBe(false);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠