/**
 * Plan Mode 状态机 — 4 态主链 + cancelled 终态,参考行业 Agent 框架的强制阻断式 Plan Mode。
 *
 * 做减法:
 *   - 转移规则用嵌套 Record 表达,零分支
 *   - isWriteBlocked 仅在 gathering 返回 true(强制阻断写操作,核心阻断语义)
 *   - 非法转移抛 Error,不静默忽略
 *   - ctx 参数为未来钩子扩展预留,当前转移规则纯静态
 */

import type { PlanContext, PlanEvent, PlanState } from './types.js';

const TRANSITIONS: Readonly<Record<PlanState, Partial<Record<PlanEvent, PlanState>>>> = {
  initialized: { start: 'gathering', cancel: 'cancelled' },
  gathering: { gather_complete: 'executing', cancel: 'cancelled' },
  executing: { execute_complete: 'done', cancel: 'cancelled' },
  done: { reset: 'initialized', cancel: 'cancelled' },
  cancelled: { reset: 'initialized', cancel: 'cancelled' },
};

export class PlanMachine {
  private state: PlanState;

  constructor(initialState: PlanState = 'initialized') {
    this.state = initialState;
  }

  transition(event: PlanEvent, _ctx?: PlanContext): PlanState {
    const next = TRANSITIONS[this.state][event];
    if (!next) {
      throw new Error(`Invalid transition: ${this.state} + ${event}`);
    }
    this.state = next;
    return this.state;
  }

  canTransition(event: PlanEvent): boolean {
    return Boolean(TRANSITIONS[this.state][event]);
  }

  isWriteBlocked(): boolean {
    return this.state === 'gathering';
  }

  getCurrentState(): PlanState {
    return this.state;
  }

  reset(): void {
    this.state = 'initialized';
  }
}
