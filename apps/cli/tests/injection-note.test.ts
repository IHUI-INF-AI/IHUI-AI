// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D34/D39 第 47 轮:cli 端此前对 injection_applied / retry_scheduled 两帧 0 命中。
// 锁住三条最容易被回退的性质:措辞出自本端词表(不是后端中文)、未知 kind 有兜底、
// 立即重试不写成"0 秒后继续"。
import { describe, expect, it } from 'vitest';

import {
  createTaskStatusLine,
  injectionNoteText,
  retryNoteText,
} from '../src/commands/task-status-line.js';

describe('injectionNoteText(D34)', () => {
  it('已知 kind 出本端词表措辞', () => {
    const line = injectionNoteText({
      kind: 'developer_instructions',
      collapsed: '自定义指令 2 条',
    });
    expect(line).toContain('自定义指令');
    expect(line).toContain('本轮参考上下文');
    // 后端中文只作兜底:已知 kind 时不得把 collapsed 拼进界面
    expect(line).not.toContain('自定义指令 2 条');
  });

  it('auto_context 用 count 出段数', () => {
    const line = injectionNoteText({
      kind: 'auto_context',
      collapsed: 'auto 5',
      count: 5,
    });
    expect(line).toContain('5 段检索上下文');
  });

  it('未知 kind 回落 collapsed(不回显键名、不留空)', () => {
    const line = injectionNoteText({ kind: 'brand_new_source', collapsed: '某种新来源' });
    expect(line).toContain('某种新来源');
    expect(line).not.toContain('injectionSrc');
  });
});

describe('retryNoteText(D39)', () => {
  it('退避重试报秒数', () => {
    const line = retryNoteText({ attempt: 2, maxRetries: 3, retryInMs: 4000 });
    expect(line).toContain('2/3');
    expect(line).toContain('4');
  });

  it('retryInMs=0 说"立即",不写"0 秒后继续"', () => {
    const line = retryNoteText({ attempt: 1, maxRetries: 2, retryInMs: 0 });
    expect(line).toContain('立即');
    expect(line).not.toMatch(/0\s*秒/);
  });
});

describe('TaskStatusLine.noteLine', () => {
  it('非 TTY 不写任何字符(管道输出保持干净)', () => {
    const out: string[] = [];
    const line = createTaskStatusLine({
      write: (text) => out.push(text),
      enabled: () => false,
      columns: () => 60,
    });
    line.noteLine('本轮参考上下文：工作区记忆');
    expect(out.join('')).toBe('');
  });

  it('TTY 下写一行并压平换行', () => {
    const out: string[] = [];
    const line = createTaskStatusLine({
      write: (text) => out.push(text),
      enabled: () => true,
      columns: () => 60,
    });
    line.noteLine('  本轮参考上下文：\n工作区记忆  ');
    expect(out).toHaveLength(1);
    expect(out[0]).toBe('本轮参考上下文： 工作区记忆\n');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
