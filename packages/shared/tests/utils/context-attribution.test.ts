// 上下文占用归因分解:锁六条性质
// 1. 分解由文本自己算,provider 真值只校准总量、不参与分解;
// 2. 不可观测的段必须 observed=false 并给原因码,不得静默记 0;
// 3. 缓存命中"不改占用、只改重算量" —— 两个数必须分开;
// 4. 明细按 tokens 降序 + 上限折叠,截断数如实报;
// 5. 纯函数:同输入同输出,且键序无关;
// 6. 失败的工具结果也要计占用(否则失败被隐形)。
import { describe, expect, it } from 'vitest';

import {
  LABEL_SENTINELS,
  computeContextAttribution,
  findSegment,
  formatShare,
  type AttributionMessage,
} from '../../src/utils/context-attribution';

const LONG_CJK = '中'.repeat(600); // ≈400 token,用于制造可比较的大小关系

function msg(partial: Partial<AttributionMessage> & { role: string }): AttributionMessage {
  return { content: '', ...partial };
}

describe('按构成来源分解', () => {
  it('系统段 / 工具 schema / 技能 / 各角色各归其位', () => {
    const a = computeContextAttribution({
      systemText: LONG_CJK,
      toolSchemas: [{ name: 'read_file', description: 'read', schemaText: '{"path":1}' }],
      skills: [{ name: 'pdf', text: LONG_CJK }],
      messages: [
        msg({ role: 'system', content: LONG_CJK }),
        msg({ role: 'user', content: LONG_CJK }),
        msg({ role: 'assistant', content: LONG_CJK }),
        msg({ role: 'tool', content: LONG_CJK }),
      ],
    });
    expect(findSegment(a, 'system')?.tokens).toBeGreaterThan(0);
    expect(findSegment(a, 'toolSchema')?.count).toBe(1);
    expect(findSegment(a, 'skill')?.count).toBe(1);
    expect(findSegment(a, 'roleUser')?.count).toBe(1);
    expect(findSegment(a, 'roleAssistant')?.count).toBe(1);
    expect(findSegment(a, 'roleToolResult')?.count).toBe(1);
    // 四段等长文本 + system 多一条 → 占比最大的必是系统段
    expect(a.topKey).toBe('system');
  });

  it('占比之和(可观测段)等于 1,且各段 tokens 之和等于 attributedTokens', () => {
    const a = computeContextAttribution({
      messages: [
        msg({ role: 'user', content: 'hello there' }),
        msg({ role: 'assistant', content: LONG_CJK }),
      ],
    });
    const sum = a.segments.reduce((s, seg) => s + seg.tokens, 0);
    expect(sum).toBe(a.attributedTokens);
    const shareSum = a.segments
      .filter((s) => s.tokens > 0)
      .reduce((s, seg) => s + seg.share, 0);
    expect(shareSum).toBeCloseTo(1, 6);
  });

  it('provider 真值只校准总量并给出未归类差额,不改变各段自身', () => {
    const messages = [msg({ role: 'user', content: 'abc def' })];
    const without = computeContextAttribution({ messages });
    const withProvider = computeContextAttribution({ messages, providerPromptTokens: 500 });
    expect(findSegment(without, 'roleUser')?.tokens).toBe(findSegment(withProvider, 'roleUser')?.tokens);
    expect(without.totalTokens).toBe(without.attributedTokens);
    expect(without.residualTokens).toBe(0);
    expect(withProvider.totalTokens).toBe(500);
    expect(withProvider.residualTokens).toBe(500 - withProvider.attributedTokens);
  });

  it('真值低于归因和时差额记 0,不出现负数', () => {
    const a = computeContextAttribution({
      messages: [msg({ role: 'user', content: LONG_CJK }), msg({ role: 'assistant', content: LONG_CJK })],
      providerPromptTokens: 10,
    });
    expect(a.residualTokens).toBe(0);
    expect(a.totalTokens).toBe(10);
  });
});

describe('不可观测必须如实说', () => {
  it('浏览器端拿不到工具 schema / 技能 / 系统提示时 observed=false 而非 0 占比', () => {
    const a = computeContextAttribution({ messages: [msg({ role: 'user', content: 'hi' })] });
    for (const key of ['toolSchema', 'skill', 'system'] as const) {
      const seg = findSegment(a, key);
      expect(seg?.observed).toBe(false);
      expect(seg?.tokens).toBe(0);
    }
    expect(findSegment(a, 'toolSchema')?.unobservedCode).toBe('server-only');
    expect(findSegment(a, 'skill')?.unobservedCode).toBe('server-only');
    expect(findSegment(a, 'system')?.unobservedCode).toBe('not-supplied');
    expect(findSegment(a, 'roleUser')?.observed).toBe(true);
  });

  it('传了空数组算"可观测但确实没有",与不传区分开', () => {
    const a = computeContextAttribution({ messages: [], skills: [], toolSchemas: [] });
    expect(findSegment(a, 'skill')?.observed).toBe(true);
    expect(findSegment(a, 'toolSchema')?.observed).toBe(true);
  });

  it('注入段按 kind/label 展开到系统段明细', () => {
    const a = computeContextAttribution({
      messages: [],
      injectionSegments: [
        { kind: 'workspace_memory', text: LONG_CJK },
        { kind: 'repo_wiki', label: 'wiki', text: 'short' },
      ],
    });
    const system = findSegment(a, 'system');
    expect(system?.observed).toBe(true);
    expect(system?.count).toBe(2);
    // 按 tokens 降序:LONG_CJK 的 workspace_memory 在前,'wiki' 在后
    expect(system?.details.map((d) => d.label)).toEqual(['workspace_memory', 'wiki']);
    expect(system?.details[0]?.tokens).toBeGreaterThan(system?.details[1]?.tokens ?? 0);
  });
});

describe('缓存命中:占用与重算分开', () => {
  it('无缓存读数时 observed=false,不得用 0 冒充"一次都没命中"', () => {
    const a = computeContextAttribution({
      messages: [msg({ role: 'user', content: LONG_CJK })],
      providerPromptTokens: 1000,
    });
    expect(a.cache.observed).toBe(false);
    expect(a.cache.cacheReadTokens).toBe(0);
    expect(a.cache.hitRatio).toBe(0);
  });

  it('命中部分仍占窗口,只是不需要重新预填充', () => {
    const a = computeContextAttribution({
      messages: [msg({ role: 'user', content: LONG_CJK })],
      providerPromptTokens: 1000,
      cacheReadTokens: 700,
      cacheWriteTokens: 300,
    });
    expect(a.cache.observed).toBe(true);
    expect(a.cache.occupiedTokens).toBe(1000);
    expect(a.cache.cacheReadTokens).toBe(700);
    expect(a.cache.recomputeTokens).toBe(300);
    expect(a.cache.hitRatio).toBeCloseTo(0.7, 6);
  });

  it('缓存读数超过窗口时按窗口夹住(不给假命中率)', () => {
    const a = computeContextAttribution({
      messages: [],
      providerPromptTokens: 100,
      cacheReadTokens: 900,
    });
    expect(a.cache.cacheReadTokens).toBe(100);
    expect(a.cache.hitRatio).toBe(1);
    expect(a.cache.recomputeTokens).toBe(0);
  });
});

describe('明细与稳定性', () => {
  it('明细按 tokens 降序,超过上限折叠并如实报 truncated', () => {
    const messages = Array.from({ length: 9 }, (_, i) =>
      msg({ role: 'user', content: `m${i} ${'x'.repeat((i + 1) * 80)}` }),
    );
    const a = computeContextAttribution({ messages });
    const user = findSegment(a, 'roleUser');
    expect(user?.count).toBe(9);
    expect(user?.details).toHaveLength(6);
    expect(user?.truncated).toBe(3);
    const descending = user!.details.map((d) => d.tokens);
    expect([...descending].sort((x, y) => y - x)).toEqual(descending);
  });

  it('明细标签只放数据或 @哨兵,不放内联文案', () => {
    const a = computeContextAttribution({
      systemText: 'you are a helper',
      messages: [msg({ role: 'assistant', toolCalls: [{ toolName: 'run_command', args: { cmd: 'ls' } }] })],
    });
    const sys = findSegment(a, 'system');
    expect(sys?.details[0]?.label).toBe(LABEL_SENTINELS.systemPrompt);
    const call = findSegment(a, 'roleToolCall');
    expect(call?.details[0]?.label).toBe('run_command');
    expect(call?.details[0]?.kind).toBe('call');
  });

  it('同输入两次计算结果逐字相同(纯函数,渲染不抖)', () => {
    const input = {
      systemText: LONG_CJK,
      messages: [msg({ role: 'user', content: 'a' }), msg({ role: 'assistant', content: 'b' })],
      providerPromptTokens: 400,
    };
    expect(JSON.stringify(computeContextAttribution(input))).toBe(
      JSON.stringify(computeContextAttribution(input)),
    );
  });

  it('args 键序不同不影响工具调用段的 token', () => {
    const one = computeContextAttribution({
      messages: [msg({ role: 'assistant', toolCalls: [{ toolName: 't', args: { a: 1, b: 2 } }] })],
    });
    const other = computeContextAttribution({
      messages: [msg({ role: 'assistant', toolCalls: [{ toolName: 't', args: { b: 2, a: 1 } }] })],
    });
    expect(findSegment(one, 'roleToolCall')?.tokens).toBe(findSegment(other, 'roleToolCall')?.tokens);
  });
});

describe('边界与错误态', () => {
  it('失败的工具结果也计占用,不静默消失', () => {
    const a = computeContextAttribution({
      messages: [
        msg({
          role: 'assistant',
          toolCalls: [{ toolName: 'run_command', args: {}, error: 'boom ' + LONG_CJK }],
        }),
      ],
    });
    const results = findSegment(a, 'roleToolResult');
    expect(results?.tokens).toBeGreaterThan(0);
    expect(results?.details[0]?.kind).toBe('result');
  });

  it('标记为 error 的消息整条跳过(渲染上本就不存在)', () => {
    const a = computeContextAttribution({
      messages: [msg({ role: 'user', content: LONG_CJK, error: true })],
    });
    expect(a.attributedTokens).toBe(0);
    expect(a.topKey).toBeNull();
  });

  it('空会话不炸:占比 0、topKey null、各段齐备', () => {
    const a = computeContextAttribution({ messages: [] });
    expect(a.segments).toHaveLength(7);
    expect(a.attributedTokens).toBe(0);
    expect(a.totalTokens).toBe(0);
    expect(a.topKey).toBeNull();
    expect(a.cache.hitRatio).toBe(0);
  });

  it('role 大小写与别名(tool/function)都能落段', () => {
    const a = computeContextAttribution({
      messages: [
        msg({ role: 'USER', content: 'x' }),
        msg({ role: 'Tool', content: 'y' }),
        msg({ role: 'function', content: 'z' }),
      ],
    });
    expect(findSegment(a, 'roleUser')?.count).toBe(1);
    expect(findSegment(a, 'roleToolResult')?.count).toBe(2);
  });

  it('formatShare 夹在 0..100% 且给一位小数', () => {
    expect(formatShare(0.4126)).toBe('41.3%');
    expect(formatShare(-1)).toBe('0.0%');
    expect(formatShare(3)).toBe('100.0%');
  });
});
