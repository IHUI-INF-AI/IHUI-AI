// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 记忆写入触发策略测试 — 6 类触发各一正例 + 负例(寒暄/纯查询/失败未修复/单文件修复/过短决策)。
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateMemoryWriteTriggers,
  type MemoryTurnSignals,
  type MemoryToolCall,
} from '../src/memory/write-triggers.js';

function signals(overrides: Partial<MemoryTurnSignals> = {}): MemoryTurnSignals {
  return {
    userText: '',
    assistantText: '',
    toolCalls: [],
    filesChanged: [],
    turnOrdinal: 1,
    ...overrides,
  };
}

function tool(name: string, ok: boolean): MemoryToolCall {
  return { name, ok };
}

describe('evaluateMemoryWriteTriggers', () => {
  describe('6 类正例', () => {
    it('决策落定 → decision', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '那就按方案 B 来吧。',
          assistantText: '决定了,采用方案 B:把写入触发与蒸馏拆成两个纯函数模块,后续都按这个结构扩展。',
          toolCalls: [tool('edit', true)],
          filesChanged: ['apps/cli/src/memory/write-triggers.ts', 'apps/cli/src/memory/distill.ts'],
        }),
      );
      expect(decision.shouldWrite).toBe(true);
      expect(decision.triggers).toContain('decision');
      expect(decision.reason).toContain('decision');
    });

    it('用户纠错 → correction(强信号,不受文本长度门槛限制)', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '不对,应该是 feats 分支而不是 main。',
          assistantText: '明白,已切到 feats 分支。',
          userCorrected: true,
        }),
      );
      expect(decision.shouldWrite).toBe(true);
      expect(decision.triggers).toContain('correction');
    });

    it('项目约定 → convention', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '项目约定:所有包统一用 pnpm,禁止直接跑 npm install 安装依赖。',
          assistantText: '已记录到项目规范,后续一律走 pnpm。',
        }),
      );
      expect(decision.shouldWrite).toBe(true);
      expect(decision.triggers).toContain('convention');
    });

    it('可复用根因 → root-cause(失败后有成功调用且跨 ≥2 个文件)', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '测试又挂了,帮我看看为什么。',
          assistantText: '根因是归一化前后 token 集合口径不一致,修复后测试全绿。',
          toolCalls: [tool('vitest', false), tool('edit', true), tool('vitest', true)],
          filesChanged: ['apps/cli/src/memory/distill.ts', 'apps/cli/src/memory/write-triggers.ts'],
        }),
      );
      expect(decision.shouldWrite).toBe(true);
      expect(decision.triggers).toContain('root-cause');
    });

    it('用户偏好 → preference', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '我更喜欢简洁的中文注释,不要写太多废话。',
          assistantText: '收到,后续注释保持精简。',
        }),
      );
      expect(decision.shouldWrite).toBe(true);
      expect(decision.triggers).toContain('preference');
    });

    it('明确要求记住 → explicit-remember', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '请记住:这个仓库禁止 force push。',
          assistantText: '已记住该约束。',
          explicitRemember: true,
        }),
      );
      expect(decision.shouldWrite).toBe(true);
      expect(decision.triggers).toContain('explicit-remember');
    });
  });

  describe('负例', () => {
    it('寒暄不写', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '你好!',
          assistantText: '你好,有什么可以帮你的吗?',
        }),
      );
      expect(decision.shouldWrite).toBe(false);
      expect(decision.triggers).toEqual([]);
    });

    it('纯查询不写', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '这个函数定义在哪里?',
          assistantText: '在 apps/cli/src/memory/long-term.ts 的 load 方法里。',
        }),
      );
      expect(decision.shouldWrite).toBe(false);
      expect(decision.triggers).toEqual([]);
    });

    it('工具失败但未修复不写', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '跑一下测试看看。',
          assistantText: '测试跑失败了,我先看看报错,还没定位到原因。',
          toolCalls: [tool('vitest', false)],
        }),
      );
      expect(decision.shouldWrite).toBe(false);
      expect(decision.reason).toContain('失败未修复');
    });

    it('单文件修复(改动文件数不足)不写', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '修一下这个测试。',
          assistantText: '根因是断言写错了,修复后测试通过。',
          toolCalls: [tool('vitest', false), tool('edit', true), tool('vitest', true)],
          filesChanged: ['apps/cli/tests/one.test.ts'],
        }),
      );
      expect(decision.shouldWrite).toBe(false);
      expect(decision.triggers).toEqual([]);
    });

    it('文本过短的决策信号不写(弱信号受长度门槛约束)', () => {
      const decision = evaluateMemoryWriteTriggers(
        signals({
          userText: '就按 A 吧。',
          assistantText: '好。',
        }),
      );
      expect(decision.shouldWrite).toBe(false);
      expect(decision.triggers).toEqual([]);
    });
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
