// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ask_user_question 求助升级预算测试 — 票 G-937962。
 *
 * 上游机制(escalate: timeout kind:"none" + per-ask 上限 3)的机制等价验收点:
 *  - per-ask 预算 3 次:窗口内第 4 次调用被拒,且 refused 是**普通结果**(success=true、
 *    无 error 字段),不是 ToolHandlerFailure 式的 error tool_result;
 *  - 第 4 次 reason=预算:文案写明预算已尽、应自行判断;
 *  - 等待路径不施默认超时:execBudget.notInterruptible ⇒ resolveToolExecBudgetMs 返回
 *    undefined(连定时器都不建),取消除外;
 *  - headless 分支在进 prompt 前返回,不消耗预算;
 *  - 预算只在开窗(子代理 ask)域生效;主 loop 域不计数。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
// ask-user.ts 对 inquirer 是动态 import;vi.mock 对动态导入同样生效。
// mock 工厂会被提升,故用 vi.hoisted 共享 mock 实例。
const { promptMock } = vi.hoisted(() => ({
  promptMock: vi.fn<() => Promise<{ selected: string }>>(),
}));
vi.mock('inquirer', () => ({ default: { prompt: promptMock } }));
import {
  ASK_USER_ESCALATION_BUDGET,
  ask_user_question,
  beginAskUserEscalationBudget,
  endAskUserEscalationBudget,
} from '../src/tools/ask-user.js';
import { resolveToolExecBudgetMs } from '../src/tools/index.js';

function setTTY(v: boolean): void {
  Object.defineProperty(process.stdin, 'isTTY', { value: v, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: v, configurable: true });
}

function clearTTY(): void {
  delete (process.stdin as { isTTY?: boolean }).isTTY;
  delete (process.stdout as { isTTY?: boolean }).isTTY;
}

const ARGS = {
  question: '选哪个方案?',
  options: [
    { label: 'A' },
    { label: 'B' },
  ],
};

async function callOnce(): Promise<{ success: boolean; output: string; error?: string }> {
  return ask_user_question.execute(ARGS, { workspacePath: '.' });
}

describe('ask_user_question 求助升级预算', () => {
  beforeEach(() => {
    promptMock.mockReset();
    promptMock.mockResolvedValue({ selected: 'A' });
    setTTY(true);
    endAskUserEscalationBudget();
  });

  afterEach(() => {
    endAskUserEscalationBudget();
    clearTTY();
  });

  it('预算常量为 3(与上游 escalate per-ask 上限一致)', () => {
    expect(ASK_USER_ESCALATION_BUDGET).toBe(3);
  });

  it('窗口未开(主 loop 域)不计数:连续 5 次都正常回答', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await callOnce();
      expect(r.success).toBe(true);
      expect(r.output).toContain('用户选择');
    }
    expect(promptMock).toHaveBeenCalledTimes(5);
  });

  it('开窗后 per-ask 预算 3 次;第 4 次 refused 且是普通结果(非 error)', async () => {
    beginAskUserEscalationBudget();
    for (let i = 0; i < ASK_USER_ESCALATION_BUDGET; i++) {
      const r = await callOnce();
      expect(r.success).toBe(true);
      expect(r.error).toBeUndefined();
      expect(r.output).toContain('用户选择');
    }
    expect(promptMock).toHaveBeenCalledTimes(ASK_USER_ESCALATION_BUDGET);

    const refused = await callOnce();
    // refused 是普通结果,不是 error:success=true、无 error 字段
    expect(refused.success).toBe(true);
    expect(refused.error).toBeUndefined();
    // 第 4 次 reason=预算:文案写明预算已尽与下一步(自行判断)
    expect(refused.output).toContain('budget');
    expect(refused.output).toContain('3/3');
    expect(refused.output).toContain('own best judgement');
    // refused 不再打开等待面(prompt 不会被第 4 次触发)
    expect(promptMock).toHaveBeenCalledTimes(ASK_USER_ESCALATION_BUDGET);
  });

  it('串行新 ask 独立预算:end 后重新 begin,预算重置', async () => {
    beginAskUserEscalationBudget();
    for (let i = 0; i < ASK_USER_ESCALATION_BUDGET; i++) await callOnce();
    expect((await callOnce()).output).toContain('budget');
    endAskUserEscalationBudget();
    beginAskUserEscalationBudget();
    for (let i = 0; i < ASK_USER_ESCALATION_BUDGET; i++) {
      const r = await callOnce();
      expect(r.output).toContain('用户选择');
    }
    expect((await callOnce()).output).toContain('budget');
  });

  it('begin 在窗口已开时是 no-op(并发兄弟 dispatch 共享同一 ask 窗口,不互相重置)', async () => {
    beginAskUserEscalationBudget();
    for (let i = 0; i < ASK_USER_ESCALATION_BUDGET; i++) await callOnce();
    beginAskUserEscalationBudget(); // 模拟并发兄弟开窗
    expect((await callOnce()).output).toContain('budget');
  });

  it('headless 分支在预算判定之前返回,不消耗预算', async () => {
    beginAskUserEscalationBudget();
    setTTY(false);
    const r = await callOnce();
    expect(r.success).toBe(false);
    expect(r.errorType).toBe('not_interactive');
    setTTY(true);
    for (let i = 0; i < ASK_USER_ESCALATION_BUDGET; i++) {
      expect((await callOnce()).output).toContain('用户选择');
    }
  });

  it('参数校验失败不消耗预算', async () => {
    beginAskUserEscalationBudget();
    const bad = await ask_user_question.execute(
      { question: 'x', options: [{ label: 'only-one' }] },
      { workspacePath: '.' },
    );
    expect(bad.success).toBe(false);
    for (let i = 0; i < ASK_USER_ESCALATION_BUDGET; i++) {
      expect((await callOnce()).output).toContain('用户选择');
    }
  });

  it('等待路径不施默认超时:notInterruptible ⇒ 预算框架对该工具连定时器都不建(取消除外)', () => {
    expect(ask_user_question.execBudget && 'notInterruptible' in ask_user_question.execBudget).toBe(true);
    expect(resolveToolExecBudgetMs(ask_user_question)).toBeUndefined();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
