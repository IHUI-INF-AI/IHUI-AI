import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import { buildRewindChoices } from '../src/commands/ui-tool-cards.js';
import type { ChatMessage } from '../src/commands/session.js';

// 测试环境非 TTY,chalk 默认 level=0;强制启用保证断言一致
chalk.level = 1;

function msg(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: `m-${Math.random().toString(36).slice(2)}`, role, content };
}

describe('buildRewindChoices(W12 /rewind 可视化选择)', () => {
  it('空栈返回空数组(REPL 走旧行为 steps=1)', () => {
    expect(buildRewindChoices([])).toEqual([]);
  });

  it('最近快照在前,steps 从 1 递增(与 rewindHistory 语义一致)', () => {
    const stack: ChatMessage[][] = [
      [msg('user', '第一个任务:重构登录模块')],
      [msg('user', '第二个任务:修复导航卡顿')],
      [msg('assistant', '只有 assistant 的快照')],
    ];
    const choices = buildRewindChoices(stack);
    expect(choices).toHaveLength(3);
    expect(choices[0]!.steps).toBe(1);
    expect(choices[1]!.steps).toBe(2);
    expect(choices[2]!.steps).toBe(3);
    // 标签含预览文本(最近快照=choices[0]=只含 assistant → 降级标签;最早快照=choices[2])
    expect(choices[0]!.label).toContain('无 user 消息');
    expect(choices[1]!.label).toContain('第二个任务');
    expect(choices[2]!.label).toContain('第一个任务');
  });

  it('预览截断到 60 字符并压缩空白', () => {
    const long = 'x'.repeat(100);
    const stack: ChatMessage[][] = [[msg('user', `  ${long}  `)]];
    const choices = buildRewindChoices(stack);
    expect(choices[0]!.label).toContain('…');
    expect(choices[0]!.label).not.toContain('  '.repeat(2));
  });
});
