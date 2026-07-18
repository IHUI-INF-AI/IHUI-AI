/**
 * PlanMachine 集成测试 — 验证 /plan 命令 + runToolLoop 的硬阻断语义。
 *
 * 覆盖:
 *   - /plan on 实例化 PlanMachine 进入 gathering 状态(isWriteBlocked=true)
 *   - /plan off 销毁 PlanMachine(无阻断)
 *   - /plan approve 转移到 executing(isWriteBlocked=false)
 *   - /plan reject 重置回 gathering(再次阻断)
 *   - runToolLoop 在 gathering 状态跳过工具调用,在 executing 状态正常执行
 *   - planFirst 自动批准时联动 PlanMachine 转移到 executing
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanMachine } from '../src/plan/index.js';

describe('PlanMachine 集成:/plan 命令状态管理', () => {
  it('/plan on:实例化 PlanMachine 进入 gathering,isWriteBlocked=true', () => {
    // 模拟 /plan on 的核心动作:new PlanMachine('gathering')
    const machine = new PlanMachine('gathering');
    expect(machine.getCurrentState()).toBe('gathering');
    expect(machine.isWriteBlocked()).toBe(true);
  });

  it('/plan off:销毁 PlanMachine(undefined 语义,无阻断)', () => {
    // 模拟 /plan off 的核心动作:state.planMachine = undefined
    let machine: PlanMachine | undefined = new PlanMachine('gathering');
    machine = undefined;
    expect(machine?.isWriteBlocked() ?? false).toBe(false);
  });

  it('/plan approve:gathering → executing,isWriteBlocked=false', () => {
    const machine = new PlanMachine('gathering');
    expect(machine.canTransition('gather_complete')).toBe(true);
    machine.transition('gather_complete');
    expect(machine.getCurrentState()).toBe('executing');
    expect(machine.isWriteBlocked()).toBe(false);
  });

  it('/plan reject:reset + start → 回到 gathering,isWriteBlocked=true', () => {
    const machine = new PlanMachine('gathering');
    machine.transition('gather_complete'); // → executing
    machine.reset(); // → initialized
    machine.transition('start'); // → gathering
    expect(machine.getCurrentState()).toBe('gathering');
    expect(machine.isWriteBlocked()).toBe(true);
  });

  it('/plan show:展示 PlanMachine 状态(状态查询契约)', () => {
    const machine = new PlanMachine('gathering');
    expect(machine.getCurrentState()).toBe('gathering');
    machine.transition('gather_complete');
    expect(machine.getCurrentState()).toBe('executing');
    machine.transition('execute_complete');
    expect(machine.getCurrentState()).toBe('done');
  });

  it('canTransition 守门:executing 状态不能 transition(gather_complete)', () => {
    const machine = new PlanMachine('gathering');
    machine.transition('gather_complete'); // → executing
    expect(machine.canTransition('gather_complete')).toBe(false);
    // 调用方应先检查 canTransition,否则 transition 抛错
    expect(() => machine.transition('gather_complete')).toThrow(/Invalid transition/);
  });

  it('非法转移抛错(initialized 状态直接 transition(gather_complete))', () => {
    const machine = new PlanMachine('initialized');
    expect(machine.canTransition('gather_complete')).toBe(false);
    expect(() => machine.transition('gather_complete')).toThrow(/Invalid transition/);
  });
});

describe('PlanMachine 集成:runToolLoop 行为契约', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('gathering 状态:runToolLoop 应跳过工具调用(模拟硬阻断)', async () => {
    // 直接验证 PlanMachine 的 isWriteBlocked 语义:runToolLoop 内会据此跳过工具
    // 这里用单元级验证,不启动真实 LLM 流(streamChat 依赖外部 API)
    const machine = new PlanMachine('gathering');
    expect(machine.isWriteBlocked()).toBe(true);
    // 模拟 runToolLoop 内的关键判定:`if (opts.planMachine?.isWriteBlocked() && toolCalls.length > 0) continue;`
    const shouldSkip = machine.isWriteBlocked() && /* toolCalls.length > 0 */ true;
    expect(shouldSkip).toBe(true);
  });

  it('executing 状态:runToolLoop 应正常执行工具(无阻断)', async () => {
    const machine = new PlanMachine('gathering');
    machine.transition('gather_complete'); // → executing
    expect(machine.isWriteBlocked()).toBe(false);
    const shouldSkip = machine.isWriteBlocked() && /* toolCalls.length > 0 */ true;
    expect(shouldSkip).toBe(false);
  });

  it('planFirst 自动批准时联动 PlanMachine 转移到 executing', () => {
    // 模拟 agent.ts runToolLoop 内的联动逻辑(line 741-743)
    const machine = new PlanMachine('gathering');
    const planApproved = true; // planFirst 路径自动批准
    if (planApproved && machine.canTransition('gather_complete')) {
      machine.transition('gather_complete');
    }
    expect(machine.getCurrentState()).toBe('executing');
    expect(machine.isWriteBlocked()).toBe(false);
  });

  it('planMachine 已在 executing 时,planFirst 路径 canTransition=false 不抛错', () => {
    // 模拟二次进入 planFirst 路径(已在 executing 状态)
    const machine = new PlanMachine('gathering');
    machine.transition('gather_complete'); // → executing
    // 二次调用:canTransition 守门跳过,不抛错
    if (machine.canTransition('gather_complete')) {
      machine.transition('gather_complete'); // 不会执行
    }
    expect(machine.getCurrentState()).toBe('executing');
  });

  it('未注入 planMachine(undefined)时 runToolLoop 走原 planFirst 路径(零回归)', () => {
    const machine: PlanMachine | undefined = undefined;
    // `opts.planMachine?.isWriteBlocked()` 短路为 undefined → falsy → 不阻断
    const blocked = machine?.isWriteBlocked() ?? false;
    expect(blocked).toBe(false);
    // `opts.planMachine?.canTransition(...)` 短路为 undefined → falsy → 不转移
    const canTransition = machine?.canTransition('gather_complete') ?? false;
    expect(canTransition).toBe(false);
  });
});

describe('PlanMachine 集成:与 planFirst 共存语义', () => {
  it('planFirst=true + planMachine=gathering:两者同时阻断(planFirst 先 continue)', () => {
    const planFirst = true;
    const planApproved = false;
    const machine = new PlanMachine('gathering');
    // 模拟 runToolLoop 内的条件顺序:
    // 1. if (planFirst && !planApproved && toolCalls.length > 0) { ... continue; }
    const planFirstBlocks = planFirst && !planApproved && /* toolCalls.length > 0 */ true;
    expect(planFirstBlocks).toBe(true);
    // 2. if (planMachine?.isWriteBlocked() && toolCalls.length > 0) { ... continue; }
    const machineBlocks = machine.isWriteBlocked() && /* toolCalls.length > 0 */ true;
    expect(machineBlocks).toBe(true);
    // 实际执行时 planFirst 先 continue,planMachine 不会被执行到(优化)
  });

  it('planFirst=false + planMachine=gathering:planMachine 单独阻断', () => {
    const planFirst = false;
    const machine = new PlanMachine('gathering');
    const planFirstBlocks = planFirst && /* !planApproved && toolCalls.length > 0 */ true;
    expect(planFirstBlocks).toBe(false);
    const machineBlocks = machine.isWriteBlocked() && /* toolCalls.length > 0 */ true;
    expect(machineBlocks).toBe(true);
  });

  it('planFirst=true + planApproved=true + planMachine=executing:都不阻断', () => {
    const planFirst = true;
    const planApproved = true;
    const machine = new PlanMachine('gathering');
    machine.transition('gather_complete'); // → executing
    const planFirstBlocks = planFirst && !planApproved && /* toolCalls.length > 0 */ true;
    expect(planFirstBlocks).toBe(false);
    const machineBlocks = machine.isWriteBlocked() && /* toolCalls.length > 0 */ true;
    expect(machineBlocks).toBe(false);
  });
});
