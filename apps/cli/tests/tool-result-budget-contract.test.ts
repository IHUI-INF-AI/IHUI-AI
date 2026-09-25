// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * H-5:`ToolResultBudgetContract` 的运行时消费接线证明。
 *
 * 立票事实:契约在 `packages/types/src/tool-contract.ts` 里定义并作为 `ToolContract`
 * 的必填组存在,守门 111 还把它列为新工具必须声明的三组之一 —— 但**全仓零消费者**
 * (声明面写了也没人读)。那意味着"给工具挂结果预算"这件事只是装饰,而真正在管体积的是
 * `result-envelope/budgets.ts` 里那张手抄登记表 = 第二真相。
 *
 * 本票把信封的预算取源改成:`显式覆盖 > 工具声明的契约 > 登记表 > 默认档`,
 * 并且**契约里运行时没实现的字段必须被点名**(不允许"写了契约但静默按默认档跑")。
 *
 * 断言成对设计:每一组都有"契约生效"与"契约缺席/不认 ⇒ 退回旧面"两条,
 * 只写前者会把判据退化成"恒取契约"的自证。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ToolResultBudgetContract } from '@ihui/types';

import {
  envelopeToolResult,
  projectContractResultBudget,
  hasDeclaredToolBudget,
  listContractBudgetGaps,
  resetContractBudgetGaps,
  listToolOutputBudgets,
  CONTRACT_BYTES_PER_CHAR,
  DEFAULT_TOOL_OUTPUT_BUDGET,
} from '../src/tools/result-envelope/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_SRC = path.join(HERE, '..', 'src', 'commands', 'agent.ts');

function contract(over: Partial<ToolResultBudgetContract> = {}): ToolResultBudgetContract {
  return {
    inlineLimitBytes: 4_000,
    providerVisibleLimitBytes: 300,
    policy: 'artifact',
    preview: { bytes: 30, lines: 2, from: 'head' },
    ...over,
  };
}

/** 一段必然超限的正文 */
const BIG = 'x'.repeat(500);

const baseOpts = {
  call: { name: 'probe_tool', arguments: {} },
  workspacePath: path.join(HERE, '..', '..', '..', '.ihui-agent', 'tmp', 'h5-envelope'),
  sessionId: 'h5-test',
};

beforeEach(() => {
  resetContractBudgetGaps();
});

describe('① 量纲桥:契约按字节声明、信封按字符计量', () => {
  it('providerVisibleLimitBytes / preview.bytes 按保守档换算成字符', () => {
    const p = projectContractResultBudget(contract({ providerVisibleLimitBytes: 300, preview: { bytes: 30, lines: 2, from: 'head' } }));
    expect(p?.budget.maxChars).toBe(300 / CONTRACT_BYTES_PER_CHAR);
    expect(p?.budget.previewChars).toBe(30 / CONTRACT_BYTES_PER_CHAR);
    expect(CONTRACT_BYTES_PER_CHAR).toBe(3);
  });

  it('预览上限仍受 MAX_PREVIEW_CHARS 约束(契约写 999999 字节也不会把信封写成正文)', () => {
    const p = projectContractResultBudget(contract({ preview: { bytes: 9_999_999, lines: 1, from: 'head' } }));
    expect(p?.budget.previewChars).toBeLessThanOrEqual(4_000);
    expect(p?.budget.previewChars).toBeGreaterThan(0);
  });
});

describe('② 三档 policy 各有可区分后果(不是同一分支换名字)', () => {
  it('artifact:超限落盘 + 回灌带产物指针的信封', () => {
    const out = envelopeToolResult({
      ...baseOpts,
      result: { success: true, output: BIG },
      resultBudget: contract({ policy: 'artifact' }),
    });
    expect(out.reason).toBe('applied');
    expect(out.enveloped).toBe(true);
    expect(out.budgetSource).toBe('contract');
    expect(out.artifactPath).toBeTruthy();
    expect(out.output).toContain('完整输出:');
  });

  it('truncate:超限只截不存,且**绝不**伪造一个不存在的路径', () => {
    const out = envelopeToolResult({
      ...baseOpts,
      result: { success: true, output: BIG },
      resultBudget: contract({ policy: 'truncate' }),
    });
    expect(out.reason).toBe('truncated');
    expect(out.enveloped).toBe(false);
    expect(out.artifactPath).toBeUndefined();
    expect(out.output).not.toContain('完整输出:');
    expect(out.output).toContain('已按工具契约截断');
  });

  it('inline:整段照原样回灌(契约明确表达的意愿),reason 仍是 within-budget', () => {
    const out = envelopeToolResult({
      ...baseOpts,
      result: { success: true, output: BIG },
      resultBudget: contract({ policy: 'inline' }),
    });
    expect(out.reason).toBe('within-budget');
    expect(out.output).toBe(BIG);
    expect(out.budgetSource).toBe('contract');
  });
});

describe('③ 取源顺序:契约压过登记表,契约缺席才退回旧面', () => {
  it('登记表里已有条目的工具,声明了契约 ⇒ 以契约为准(否则声明永远比不过手抄表)', () => {
    const declared = listToolOutputBudgets()[0];
    expect(declared, '登记表非空是本组前提').toBeTruthy();
    const tableBudgetMax = declared.budget.maxChars;
    const out = envelopeToolResult({
      call: { name: declared.toolName, arguments: {} },
      result: { success: true, output: 'y'.repeat(60_000) },
      workspacePath: baseOpts.workspacePath,
      sessionId: 'h5-priority',
      resultBudget: contract({ providerVisibleLimitBytes: 300, preview: { bytes: 30, lines: 1, from: 'head' } }),
    });
    expect(out.budget.maxChars).toBe(100);
    expect(out.budget.maxChars).not.toBe(tableBudgetMax);
    expect(out.budgetSource).toBe('contract');
  });

  it('反向对照:不传契约 ⇒ 必须走登记表 / 默认档,不得凭空调用方就判成 contract', () => {
    const registered = listToolOutputBudgets()[0].toolName;
    expect(hasDeclaredToolBudget(registered)).toBe(true);
    const viaTable = envelopeToolResult({
      ...baseOpts,
      call: { name: registered, arguments: {} },
      result: { success: true, output: BIG },
    });
    expect(viaTable.budgetSource).toBe('table');
    const viaDefault = envelopeToolResult({
      ...baseOpts,
      call: { name: 'a_tool_never_registered', arguments: {} },
      result: { success: true, output: BIG },
    });
    expect(viaDefault.budgetSource).toBe('default');
    expect(viaDefault.budget.maxChars).toBe(DEFAULT_TOOL_OUTPUT_BUDGET.maxChars);
  });

  it('显式 budget 覆盖仍最高优先(测试/调优出口不得被契约抢走)', () => {
    const out = envelopeToolResult({
      ...baseOpts,
      result: { success: true, output: BIG },
      budget: { maxChars: 40, previewChars: 8 },
      resultBudget: contract({ providerVisibleLimitBytes: 300 }),
    });
    expect(out.budgetSource).toBe('override');
    expect(out.budget.maxChars).toBe(40);
  });
});

describe('④ 契约声明了但运行时没有的字段:必须点名,不得静默', () => {
  it('preview.from=tail 与 artifactRetention 各记一条缺口', () => {
    const p = projectContractResultBudget(
      contract({ preview: { bytes: 30, lines: 1, from: 'tail' }, artifactRetention: 'persistent' }),
    );
    expect(p?.unimplemented.sort()).toEqual(['artifactRetention=persistent', 'preview.from=tail']);
  });

  it('缺口在真正施加预算时被记下并可读出(不是只存在于返回值里)', () => {
    envelopeToolResult({
      ...baseOpts,
      call: { name: 'gap_probe', arguments: {} },
      result: { success: true, output: BIG },
      resultBudget: contract({ preview: { bytes: 30, lines: 1, from: 'tail' } }),
    });
    const gaps = listContractBudgetGaps();
    expect(gaps.find((g) => g.tool === 'gap_probe')?.gaps).toContain('preview.from=tail');
  });

  it('不认识的 policy 档:既不猜成 truncate 也不猜成 artifact,退回默认档 + 记缺口', () => {
    const bogus = contract({ policy: 'no-such-policy' as unknown as ToolResultBudgetContract['policy'] });
    const p = projectContractResultBudget(bogus);
    expect(p?.budget).toEqual(DEFAULT_TOOL_OUTPUT_BUDGET);
    expect(p?.unimplemented).toContain('policy=no-such-policy');
  });

  it('契约缺席(null / undefined / 非对象)一律判"没有契约",不产出假投影', () => {
    expect(projectContractResultBudget(null)).toBeNull();
    expect(projectContractResultBudget(undefined)).toBeNull();
    expect(projectContractResultBudget('' as unknown as ToolResultBudgetContract)).toBeNull();
  });
});

describe('⑤ 装车证明:声明面到执行面那条线真的连着', () => {
  it('agent 回灌边界把工具的 contract.resultBudget 喂给信封(不是写了个形参没人传)', () => {
    const src = readFileSync(AGENT_SRC, 'utf8');
    expect(src).toMatch(/envelopeToolResult\(\{[\s\S]{0,400}resultBudget:\s*getTool\(call\.name\)\?\.contract\?\.resultBudget/);
  });

  it('投影出口是唯一的:信封内部不另抄一份字节换算', () => {
    const src = readFileSync(path.join(HERE, '..', 'src', 'tools', 'result-envelope', 'index.ts'), 'utf8');
    expect(src).toContain('projectContractResultBudget(');
    expect(src).not.toMatch(/\/\s*3\b.*providerVisible|providerVisibleLimitBytes\s*\//);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
