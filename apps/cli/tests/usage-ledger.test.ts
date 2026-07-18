/**
 * P2-5 UsageLedger 测试 — chat-state token 估算与预算追踪。
 *
 * 覆盖范围:
 *   - UsageLedger 基础功能(recordTurn / 累计 totals / turnCount / history)
 *   - 预算追踪(token / cost 预算 + isOver*Budget + *BudgetUsage)
 *   - getChatState 快照生成
 *   - averageTokensPerTurn / lastTurn
 *   - reset 清空
 *   - 边界情况(空账本 / 0 值 / undefined 预算)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UsageLedger, type ChatState } from '../src/context.js';

describe('P2-5 UsageLedger 基础功能', () => {
  let ledger: UsageLedger;

  beforeEach(() => {
    ledger = new UsageLedger();
  });

  it('空账本所有累计值为 0', () => {
    expect(ledger.promptTokens).toBe(0);
    expect(ledger.completionTokens).toBe(0);
    expect(ledger.totalTokens).toBe(0);
    expect(ledger.costUsd).toBe(0);
    expect(ledger.turnCount).toBe(0);
    expect(ledger.history).toEqual([]);
  });

  it('recordTurn 记录单轮使用', () => {
    ledger.recordTurn(100, 50, 0.001);
    expect(ledger.turnCount).toBe(1);
    expect(ledger.promptTokens).toBe(100);
    expect(ledger.completionTokens).toBe(50);
    expect(ledger.totalTokens).toBe(150);
    expect(ledger.costUsd).toBe(0.001);
  });

  it('recordTurn 多轮累计', () => {
    ledger.recordTurn(100, 50, 0.001);
    ledger.recordTurn(200, 80, 0.002);
    ledger.recordTurn(150, 70, 0.0015);
    expect(ledger.turnCount).toBe(3);
    expect(ledger.promptTokens).toBe(450);
    expect(ledger.completionTokens).toBe(200);
    expect(ledger.totalTokens).toBe(650);
    expect(ledger.costUsd).toBeCloseTo(0.0045, 6);
  });

  it('history 返回所有轮次记录(浅拷贝)', () => {
    ledger.recordTurn(100, 50, 0.001);
    ledger.recordTurn(200, 80, 0.002);
    const history = ledger.history;
    expect(history).toHaveLength(2);
    expect(history[0].turnNumber).toBe(1);
    expect(history[0].promptTokens).toBe(100);
    expect(history[0].completionTokens).toBe(50);
    expect(history[0].totalTokens).toBe(150);
    expect(history[0].estimatedCostUsd).toBe(0.001);
    expect(history[1].turnNumber).toBe(2);
    expect(history[1].promptTokens).toBe(200);
    // 浅拷贝:修改不影响内部状态
    history.push({ turnNumber: 99, promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0, timestamp: 0 });
    expect(ledger.turnCount).toBe(2);
  });

  it('history 每条记录含 timestamp', () => {
    const before = Date.now();
    ledger.recordTurn(10, 5, 0.0001);
    const after = Date.now();
    const entry = ledger.history[0];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('totalTokens = promptTokens + completionTokens', () => {
    ledger.recordTurn(123, 456, 0.01);
    expect(ledger.totalTokens).toBe(ledger.promptTokens + ledger.completionTokens);
  });

  it('TurnUsage.totalTokens = promptTokens + completionTokens(单条记录)', () => {
    ledger.recordTurn(123, 456, 0.01);
    const entry = ledger.history[0];
    expect(entry.totalTokens).toBe(entry.promptTokens + entry.completionTokens);
  });
});

describe('P2-5 UsageLedger 预算追踪', () => {
  describe('token 预算', () => {
    it('无预算时 isOverTokenBudget 返回 false', () => {
      const ledger = new UsageLedger();
      ledger.recordTurn(1_000_000, 1_000_000, 0);
      expect(ledger.isOverTokenBudget()).toBe(false);
    });

    it('无预算时 tokenBudgetUsage 返回 undefined', () => {
      const ledger = new UsageLedger({ budgetTokens: 10_000 });
      // 无记录时也无预算(这里设了预算但测试无记录场景)
      expect(ledger.tokenBudgetUsage()).toBe(0);
    });

    it('未达预算时 isOverTokenBudget 返回 false', () => {
      const ledger = new UsageLedger({ budgetTokens: 10_000 });
      ledger.recordTurn(1000, 500, 0.001);
      expect(ledger.totalTokens).toBe(1500);
      expect(ledger.isOverTokenBudget()).toBe(false);
    });

    it('达到预算时 isOverTokenBudget 返回 true', () => {
      const ledger = new UsageLedger({ budgetTokens: 1000 });
      ledger.recordTurn(500, 300, 0.001);
      ledger.recordTurn(200, 100, 0.001);
      expect(ledger.totalTokens).toBe(1100);
      expect(ledger.isOverTokenBudget()).toBe(true);
    });

    it('tokenBudgetUsage 返回 0-1 之间的值', () => {
      const ledger = new UsageLedger({ budgetTokens: 10_000 });
      ledger.recordTurn(1000, 500, 0.001);
      const usage = ledger.tokenBudgetUsage();
      expect(usage).toBeCloseTo(0.15, 4);
    });

    it('tokenBudgetUsage 为 0 时(budgetTokens=0)返回 0(避免除零)', () => {
      const ledger = new UsageLedger({ budgetTokens: 0 });
      ledger.recordTurn(1000, 500, 0.001);
      expect(ledger.tokenBudgetUsage()).toBe(0);
    });
  });

  describe('成本预算', () => {
    it('无预算时 isOverCostBudget 返回 false', () => {
      const ledger = new UsageLedger();
      ledger.recordTurn(100, 50, 1_000_000);
      expect(ledger.isOverCostBudget()).toBe(false);
    });

    it('未达预算时 isOverCostBudget 返回 false', () => {
      const ledger = new UsageLedger({ budgetCostUsd: 1.0 });
      ledger.recordTurn(100, 50, 0.1);
      expect(ledger.isOverCostBudget()).toBe(false);
    });

    it('达到预算时 isOverCostBudget 返回 true', () => {
      const ledger = new UsageLedger({ budgetCostUsd: 0.5 });
      ledger.recordTurn(100, 50, 0.3);
      ledger.recordTurn(100, 50, 0.3);
      expect(ledger.costUsd).toBeCloseTo(0.6, 6);
      expect(ledger.isOverCostBudget()).toBe(true);
    });

    it('costBudgetUsage 返回 0-1 之间的值', () => {
      const ledger = new UsageLedger({ budgetCostUsd: 1.0 });
      ledger.recordTurn(100, 50, 0.25);
      const usage = ledger.costBudgetUsage();
      expect(usage).toBeCloseTo(0.25, 4);
    });

    it('costBudgetUsage 为 0 时(budgetCostUsd=0)返回 0(避免除零)', () => {
      const ledger = new UsageLedger({ budgetCostUsd: 0 });
      ledger.recordTurn(100, 50, 0.001);
      expect(ledger.costBudgetUsage()).toBe(0);
    });
  });

  describe('预算 getter', () => {
    it('tokenBudget / costBudget 返回设置的预算值', () => {
      const ledger = new UsageLedger({ budgetTokens: 5000, budgetCostUsd: 2.5 });
      expect(ledger.tokenBudget).toBe(5000);
      expect(ledger.costBudget).toBe(2.5);
    });

    it('未设置预算时返回 undefined', () => {
      const ledger = new UsageLedger();
      expect(ledger.tokenBudget).toBeUndefined();
      expect(ledger.costBudget).toBeUndefined();
    });
  });
});

describe('P2-5 UsageLedger getChatState 快照', () => {
  it('空账本生成有效快照(全 0 值)', () => {
    const ledger = new UsageLedger();
    const state = ledger.getChatState(8000);
    expect(state.turnCount).toBe(0);
    expect(state.promptTokens).toBe(0);
    expect(state.completionTokens).toBe(0);
    expect(state.totalTokens).toBe(0);
    expect(state.estimatedCostUsd).toBe(0);
    expect(state.contextLimit).toBe(8000);
    expect(state.usageRatio).toBe(0);
    expect(state.isOverTokenBudget).toBe(false);
    expect(state.isOverCostBudget).toBe(false);
  });

  it('有记录时生成正确快照', () => {
    const ledger = new UsageLedger({ budgetTokens: 5000, budgetCostUsd: 1.0 });
    ledger.recordTurn(1000, 500, 0.1);
    ledger.recordTurn(800, 400, 0.08);
    const state = ledger.getChatState(8000);
    expect(state.turnCount).toBe(2);
    expect(state.promptTokens).toBe(1800);
    expect(state.completionTokens).toBe(900);
    expect(state.totalTokens).toBe(2700);
    expect(state.estimatedCostUsd).toBeCloseTo(0.18, 6);
    expect(state.contextLimit).toBe(8000);
    expect(state.usageRatio).toBeCloseTo(2700 / 8000, 4);
    expect(state.isOverTokenBudget).toBe(false);
    expect(state.isOverCostBudget).toBe(false);
  });

  it('超出预算时快照正确反映', () => {
    const ledger = new UsageLedger({ budgetTokens: 1000, budgetCostUsd: 0.05 });
    ledger.recordTurn(500, 300, 0.02);
    ledger.recordTurn(300, 200, 0.04);
    const state = ledger.getChatState(8000);
    expect(state.totalTokens).toBe(1300);
    expect(state.estimatedCostUsd).toBeCloseTo(0.06, 6);
    expect(state.isOverTokenBudget).toBe(true);
    expect(state.isOverCostBudget).toBe(true);
  });

  it('contextLimit=0 时 usageRatio 为 0(避免除零)', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(1000, 500, 0.1);
    const state = ledger.getChatState(0);
    expect(state.usageRatio).toBe(0);
  });

  it('ChatState 类型字段完整', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(100, 50, 0.01);
    const state: ChatState = ledger.getChatState(8000);
    // 验证所有字段都存在
    expect(state).toHaveProperty('turnCount');
    expect(state).toHaveProperty('promptTokens');
    expect(state).toHaveProperty('completionTokens');
    expect(state).toHaveProperty('totalTokens');
    expect(state).toHaveProperty('estimatedCostUsd');
    expect(state).toHaveProperty('contextLimit');
    expect(state).toHaveProperty('usageRatio');
    expect(state).toHaveProperty('isOverTokenBudget');
    expect(state).toHaveProperty('isOverCostBudget');
  });
});

describe('P2-5 UsageLedger averageTokensPerTurn', () => {
  it('空账本返回 0', () => {
    const ledger = new UsageLedger();
    expect(ledger.averageTokensPerTurn()).toBe(0);
  });

  it('单轮时返回该轮 totalTokens', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(100, 50, 0.001);
    expect(ledger.averageTokensPerTurn()).toBe(150);
  });

  it('多轮时返回平均值', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(100, 50, 0.001);   // 150
    ledger.recordTurn(200, 100, 0.002);  // 300
    ledger.recordTurn(150, 75, 0.0015);  // 225
    // 平均 (150+300+225)/3 = 225
    expect(ledger.averageTokensPerTurn()).toBe(225);
  });
});

describe('P2-5 UsageLedger lastTurn', () => {
  it('空账本返回 undefined', () => {
    const ledger = new UsageLedger();
    expect(ledger.lastTurn()).toBeUndefined();
  });

  it('返回最近一轮记录', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(100, 50, 0.001);
    ledger.recordTurn(200, 100, 0.002);
    ledger.recordTurn(150, 75, 0.0015);
    const last = ledger.lastTurn();
    expect(last).toBeDefined();
    expect(last!.turnNumber).toBe(3);
    expect(last!.promptTokens).toBe(150);
    expect(last!.completionTokens).toBe(75);
    expect(last!.totalTokens).toBe(225);
  });
});

describe('P2-5 UsageLedger reset', () => {
  it('清空所有记录和累计值', () => {
    const ledger = new UsageLedger({ budgetTokens: 5000, budgetCostUsd: 1.0 });
    ledger.recordTurn(100, 50, 0.001);
    ledger.recordTurn(200, 100, 0.002);
    expect(ledger.turnCount).toBe(2);
    expect(ledger.totalTokens).toBe(450);

    ledger.reset();

    expect(ledger.turnCount).toBe(0);
    expect(ledger.promptTokens).toBe(0);
    expect(ledger.completionTokens).toBe(0);
    expect(ledger.totalTokens).toBe(0);
    expect(ledger.costUsd).toBe(0);
    expect(ledger.history).toEqual([]);
    expect(ledger.lastTurn()).toBeUndefined();
    // 预算配置不受 reset 影响
    expect(ledger.tokenBudget).toBe(5000);
    expect(ledger.costBudget).toBe(1.0);
  });
});

describe('P2-5 UsageLedger 边界情况', () => {
  it('recordTurn(0, 0, 0) 不报错', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(0, 0, 0);
    expect(ledger.turnCount).toBe(1);
    expect(ledger.totalTokens).toBe(0);
    expect(ledger.costUsd).toBe(0);
  });

  it('负值 tokens 累计(虽然不合常理但不报错,由调用方保证传入合法值)', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(-100, -50, -0.001);
    expect(ledger.promptTokens).toBe(-100);
    expect(ledger.totalTokens).toBe(-150);
  });

  it('极大值 tokens 累计不溢出', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 0);
    expect(ledger.totalTokens).toBe(2 * Number.MAX_SAFE_INTEGER);
  });

  it('构造函数无参数时正常工作', () => {
    const ledger = new UsageLedger();
    ledger.recordTurn(100, 50, 0.001);
    expect(ledger.turnCount).toBe(1);
    expect(ledger.isOverTokenBudget()).toBe(false);
    expect(ledger.isOverCostBudget()).toBe(false);
    expect(ledger.tokenBudgetUsage()).toBeUndefined();
    expect(ledger.costBudgetUsage()).toBeUndefined();
  });
});
