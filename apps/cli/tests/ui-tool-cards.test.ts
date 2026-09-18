import { describe, it, expect } from 'vitest';
import chalk from 'chalk';
import {
  colorizeDiffText,
  formatToolResultForCard,
  looksLikeDiff,
  renderPlanStepsCard,
  renderTodoChecklist,
} from '../src/commands/ui-tool-cards.js';
import type { TodoItem } from '../src/tools/todo-write.js';
import type { PlanStep } from '../src/plan/structured.js';

// 测试环境非 TTY,chalk 默认 level=0 关闭色彩;强制启用以断言 ANSI 着色
chalk.level = 1;

describe('looksLikeDiff', () => {
  it('识别 unified diff 头部', () => {
    expect(looksLikeDiff('--- a/foo.ts\n+++ b/foo.ts\n@@ -1,2 +1,2 @@')).toBe(true);
  });

  it('识别 @@ hunk 行', () => {
    expect(looksLikeDiff('@@ -10,3 +10,4 @@')).toBe(true);
  });

  it('普通文本不是 diff', () => {
    expect(looksLikeDiff('普通输出\n第二行 + 号开头不算')).toBe(false);
  });
});

describe('colorizeDiffText', () => {
  it('diff 文本按行着色(+绿/-红/@@青/头部 dim)', () => {
    const out = colorizeDiffText('@@ -1,1 +1,1 @@\n-old\n+new\n context');
    const lines = out.split('\n');
    expect(lines[0]).toContain('@@');
    expect(lines[1]).toContain('-old');
    expect(lines[2]).toContain('+new');
    // ANSI 码确实注入(着色生效)
    expect(out).toContain('\x1b[');
  });

  it('非 diff 文本原样返回(零 ANSI 污染)', () => {
    const text = '普通输出';
    expect(colorizeDiffText(text)).toBe(text);
  });
});

describe('formatToolResultForCard', () => {
  it('短输出不截断', () => {
    const r = formatToolResultForCard('line1\nline2');
    expect(r.truncated).toBe(false);
    expect(r.totalLines).toBe(2);
    expect(r.text).toBe('line1\nline2');
  });

  it('多行输出截断到 4 行并带 /tool 提示', () => {
    const output = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');
    const r = formatToolResultForCard(output);
    expect(r.truncated).toBe(true);
    expect(r.totalLines).toBe(10);
    expect(r.text).toContain('line1');
    expect(r.text).not.toContain('line10');
    expect(r.text).toContain('/tool');
  });

  it('diff 输出在卡片内被着色', () => {
    const r = formatToolResultForCard('@@ -1,1 +1,1 @@\n-old\n+new\nctx\nmore\nmore2');
    expect(r.text).toContain('\x1b[');
  });
});

describe('renderTodoChecklist', () => {
  it('空清单返回空数组', () => {
    expect(renderTodoChecklist([])).toEqual([]);
  });

  it('渲染状态图标与统计行', () => {
    const todos: TodoItem[] = [
      { id: '1', content: '任务一', status: 'completed', priority: 'high' },
      { id: '2', content: '任务二', status: 'in_progress', priority: 'medium' },
      { id: '3', content: '任务三', status: 'pending', priority: 'low' },
    ];
    const lines = renderTodoChecklist(todos).join('\n');
    expect(lines).toContain('Todo 清单 · 3 项');
    expect(lines).toContain('1 pending · 1 进行 · 1 完成');
    expect(lines).toContain('#1');
    expect(lines).toContain('任务三');
  });
});

describe('renderPlanStepsCard', () => {
  it('空步骤返回空数组', () => {
    expect(renderPlanStepsCard([])).toEqual([]);
  });

  it('渲染步骤视图(状态图标 + action 标签 + file + 进度)', () => {
    const steps: PlanStep[] = [
      { id: 's1', title: '读配置', action: 'read', status: 'completed', file: 'src/a.ts' },
      { id: 's2', title: '改实现', action: 'edit', status: 'in_progress' },
      { id: 's3', title: '跑测试', action: 'verify', status: 'pending' },
    ];
    const lines = renderPlanStepsCard(steps).join('\n');
    expect(lines).toContain('计划步骤 · 3 步');
    expect(lines).toContain('[read]');
    expect(lines).toContain('src/a.ts');
    expect(lines).toContain('1/3 完成');
  });
});
