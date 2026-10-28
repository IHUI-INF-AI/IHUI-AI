// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 输出被长度上限截断时,用户必须看得见(**每次**截断各喊一行;G-425 拍板@2026-10-07 后
 * 截断还会触发有界续写 —— 续写语义由 g-425-output-token-continuation.test.ts 钉,
 * 本文件只钉"可见性":无论截断后是续写还是收口,残句都不得伪装成完整回答)。
 *
 * 病灶:本地 provider 的流解析(`src/provider/local.ts`)早就把 `choice.finish_reason` 收进了
 * 结果,但唯一消费点 `src/commands/agent.ts` 的 `sampleOnceLocal` 只取 `result.error`,
 * 结束原因被原地丢弃 —— 于是"模型说到一半就没词了"与"模型正常说完"在终端上**逐字同形**,
 * 用户把残缺回复当完整回复用。这一型属本仓反复登记的"判据失效的表现永远是安静"。
 *
 * 判据为什么必须走生产入口:`runToolLoop` 一路(取 provider 档 → 解析流 → 记账 → 打印)才是
 * 这件事的真实链条。在测试里另抄一份 `finishReason === 'length'` 再对它断言,证明的是测试
 * 自己而不是产品(§22c"镜像测试只复读实现就是复读机"同一条)。所以这里只 mock **外部世界**:
 * fetch(Ollama 兼容端点)、settings 里的 provider 档、api-client、audit;判定与打印全走真码。
 *
 * 夹具形态取自 `tests/provider-offline.test.ts` 的 `mockFetchResponse`(读它、复用其风格,
 * 不改那个文件);settings 注入取自 `tests/native-fc-config.test.ts`。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { clearTools } from '../src/tools/index.js';
import type { Settings } from '../src/commands/settings.js';

// ---- 外部世界桩:不发真实网络、不读写 ~/.ihui、不写审计文件 ----
type StreamChatFn = (opts: unknown) => Promise<void>;

const { streamChatMock, settingsState, fetchMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
  settingsState: { value: {} as Record<string, unknown> },
  fetchMock: vi.fn(),
}));

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  // 部分 mock:保留本文件自己列出的桩(真发网络/真写盘的那几个),其余导出走真实实现。
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
    // 本用例走本地 provider 支路,结构上碰不到 streamChat;留桩只为避免真实网络与重依赖在 worker 内加载。
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
  }
});

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}));

// loadSettings 只换"读到的档位",其余导出保留原实现(与 native-fc-config.test.ts 同法)。
vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    loadSettings: () => settingsState.value as Settings,
  };
});

import { runToolLoop } from '../src/commands/agent.js';

/**
 * 构造一条 OpenAI 兼容 SSE 流:每个入参是一块 `choices[0]`,输出成
 * `data: {"choices":[{...}]}` 后跟 `data: [DONE]`。
 * read() 必须自增游标并在耗尽后 done:true,否则消费方死循环撑爆内存(同 provider-offline 注)。
 */
function sseResponse(choices: Array<Record<string, unknown>>): unknown {
  const encoder = new TextEncoder();
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
            return { value: encoder.encode(line), done: false } as {
              value: Uint8Array;
              done: boolean;
            };
          },
        };
      },
    },
  };
}

/** 一轮纯文本回复;`finishReason === null` = 上游**根本没发** finish_reason(第 ④ 对照) */
function textStream(finishReason: string | null): Array<Record<string, unknown>> {
  const last: Record<string, unknown> = { index: 0, delta: { content: '后半句' } };
  if (finishReason !== null) last.finish_reason = finishReason;
  return [{ index: 0, delta: { content: '前半句' }, finish_reason: null }, last];
}

/** 把一轮 runToolLoop 跑完,回传它写进 stderr 的全部内容 + 循环结论 */
async function driveOneTurn(
  choices: Array<Record<string, unknown>>,
  maxIterations = 2,
): Promise<{ stderr: string; stopReason: string; text: string }> {
  let stderr = '';
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  }) as never);
  fetchMock.mockImplementation(async () => sseResponse(choices));
  vi.stubGlobal('fetch', fetchMock);

  const result = await runToolLoop({
    modelId: 'qwen2.5:7b',
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: '说一句长话' },
    ],
    ctx: { workspacePath: '.' },
    maxIterations,
  });
  return { stderr, stopReason: result.stopReason, text: result.assistantText };
}

/**
 * 提示行的稳定锚:标签 `[truncated]` 是界面 chrome(与本文件既有的 `[context-guard]`
 * / `[doom-loop]` 同族),正文取词走 `cli.truncatedByLength` 五语言词表。
 */
const TAG = '[truncated]';
const countTag = (stderr: string): number => stderr.split('\n').filter((l) => l.includes(TAG)).length;

describe('输出长度截断的可见提示(本地 provider 面,生产入口 runToolLoop)', () => {
  beforeEach(() => {
    clearTools();
    fetchMock.mockReset();
    streamChatMock.mockReset();
    // provider='ollama' 才走 streamOpenAiCompatible 那条真链路(resolveProvider 的判据)
    settingsState.value = { provider: 'ollama' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('① finish_reason=length ⇒ 每次截断各喊一行,且触发有界续写(第二次请求真的发出)', async () => {
    const { stderr, stopReason, text } = await driveOneTurn(textStream('length'));
    // G-425 拍板后截断触发续写:maxIterations=2 ⇒ 首答 + 一次续写,两条流各自截断、各自喊一行
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(countTag(stderr)).toBe(2);
    // 键名不得漏到界面(取词失败会回显 'cli.truncatedByLength',那就等于没提示)
    expect(stderr).not.toContain('cli.truncatedByLength');
    // 措辞要能定位问题:说"被长度上限截断",不是"发生错误"
    expect(stderr).toContain('长度上限被截断');
    expect(stderr).not.toContain('[error]');
    // 每段的正文都不被提示吞掉:首答 + 续写段都进正文
    expect(text).toBe('前半句后半句' + '前半句后半句');
    expect(stopReason).toBe('max_iterations');
  });

  it('② finish_reason=stop ⇒ 一声不响(正常说完,不得误报)', async () => {
    const { stderr, stopReason } = await driveOneTurn(textStream('stop'));
    expect(countTag(stderr)).toBe(0);
    expect(stopReason).toBe('end_turn');
  });

  it('③ finish_reason=tool_calls ⇒ 一声不响(那是正常收尾,不是截断)', async () => {
    const { stderr } = await driveOneTurn(textStream('tool_calls'));
    expect(countTag(stderr)).toBe(0);
  });

  /**
   * ④ 上游没发 finish_reason。
   * 注意:这一档断的是**"不喊"**,不是"兜底成 stop" —— `streamOpenAiCompatible` 的
   * `acc.finishReason` 初值是 `'error'`(truthy),于是 local.ts 末尾那句
   * `if (!acc.finishReason) acc.finishReason = toolCalls.length ? 'tool_calls' : 'stop'`
   * 结构上永不成立,是**死代码**。这条不属于本票(禁改 local.ts 的解析语义),已如实登记;
   * 它不影响本判据的正确性:兜底档既不是 'length',所以不会误报。
   */
  it('④ 上游没发 finish_reason ⇒ 与改动前逐字相同(不喊,且正文照旧)', async () => {
    const { stderr, stopReason, text } = await driveOneTurn(textStream(null));
    expect(countTag(stderr)).toBe(0);
    expect(stopReason).toBe('end_turn');
    expect(text).toBe('前半句后半句');
  });

  it('⑤ 轮次耗尽时两轮各截断 ⇒ 各喊一次(每轮的事实各自交代,不合并、不刷屏)', async () => {
    // maxIterations=1:跑满一轮即以 max_iterations 收口 —— 一轮一条流,一行提示
    const { stderr, stopReason } = await driveOneTurn(textStream('length'), 1);
    expect(countTag(stderr)).toBe(1);
    expect(stopReason).toBe('max_iterations');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
