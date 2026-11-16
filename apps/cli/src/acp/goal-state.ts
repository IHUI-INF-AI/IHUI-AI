// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 目标状态机(J6)—— 把「目标」提升为**一等实体**。
 *
 * 独立分析出处(2026-11-13 从 Trae `ai_agent.dll`/`harness.dll` 字符串清单逐条读出,E1 一手):
 * Trae 把目标做成持久化实体 `chat_session_goal`(表字段 goal_id / objective /
 * tokens_used / time_used_seconds / rounds_used / created_at_ms / updated_at_ms),
 * 配套三件套工具 `create_goal` / `get_goal` / `update_goal` + 模式切换 `plan_mode`
 * + 挂起唤醒 `pending_wakeup`(is_background_wakeup / agent_resume / goal_stop_hook)。
 * 这构成「长任务可中断可恢复」的闭环:目标带资源预算,跑不完挂起、条件满足后台唤醒继续。
 *
 * ## 与 goal-loop.ts / goal-run.ts 的分工(不重复造轮子,单一真相源)
 *  - `goal-loop.ts` 管「还该不该再来一轮」(迭代判据骨架,三档结论 achieved/exhausted/timed-out/aborted);
 *  - `goal-run.ts` 管「每轮真的跑 agent + 空转检测」(把骨架接上 runToolLoop);
 *  - **本模块管「目标本身的生命周期」**(目标态持久化 + 模式切换 + 挂起唤醒),
 *    是上面两者的**上游调用方**:先 createGoal 拿实体 → 用 goal-run 驱动 → 遇阻塞
 *    suspendGoal 记下 wakeup 条件 → 条件满足后 resumeGoal 继续。判据层不在本模块重写。
 *
 * ## 三条硬约束
 *  ① **目标必须带预算**:objective 空串拒绝、预算非正拒绝 —— 无目标/无预算的循环是事故;
 *  ② **挂起必须记条件**:suspendGoal 不带 reason/条件 = 丢失"为什么停",不允许;
 *  ③ **唤醒必须校验条件**:resumeGoal 只在挂起态 + 条件满足时才推进,否则拒(防误唤醒)。
 */

/** 工作模式(Trae plan_mode / is_in_spec_mode / is_in_code_mode / is_solo_mode)。 */
export type GoalMode = 'plan' | 'spec' | 'code' | 'solo';

/** 目标运行态:在跑 / 挂起 / 达成 / 放弃。 */
export type GoalStatus = 'active' | 'suspended' | 'achieved' | 'abandoned';

/**
 * 挂起唤醒条件(Trae pending_wakeup):记录「为什么停 + 什么条件满足才继续」。
 * 这是闭环的关键 —— 挂起不带条件 = 丢失"为什么停",唤醒就无据可依。
 */
export interface WakeupCondition {
  /** 挂起原因(人可读)。 */
  readonly reason: string;
  /**
   * 唤醒条件描述。满足该条件才可 resumeGoal。
   * 形态由调用方约定(如"用户确认了 X"、"某个文件出现了"),本模块只做**非空校验 + 透传**。
   */
  readonly resumeWhen: string;
  /** 挂起时刻(ms)。 */
  readonly suspendedAt: number;
  /** 是否后台唤醒(Trae is_background_wakeup):true = 满足条件后自动唤醒,不需人工。 */
  readonly background: boolean;
}

/**
 * 目标实体(Trae chat_session_goal 对齐):一等状态,带资源预算与使用计数。
 * `tokensUsed/timeUsedMs/roundsUsed` 由调用方在每轮后经 `recordUsage` 累加 —— 本模块不猜。
 */
export interface GoalEntity {
  readonly goalId: string;
  /** 目标描述(非空)。 */
  readonly objective: string;
  readonly mode: GoalMode;
  readonly status: GoalStatus;
  /** 资源预算上限(任一可为 undefined = 不限该项)。 */
  readonly budget: {
    readonly maxTokens?: number;
    readonly maxTimeMs?: number;
    readonly maxRounds?: number;
  };
  /** 已使用计数(累加)。 */
  readonly tokensUsed: number;
  readonly timeUsedMs: number;
  readonly roundsUsed: number;
  /** 挂起时记录的唤醒条件;非挂起态为 undefined。 */
  readonly wakeup?: WakeupCondition;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** createGoal 入参(budget 可选,但至少给一项;objective 必非空)。 */
export interface CreateGoalInput {
  readonly goalId: string;
  readonly objective: string;
  readonly mode?: GoalMode;
  readonly budget?: {
    readonly maxTokens?: number;
    readonly maxTimeMs?: number;
    readonly maxRounds?: number;
  };
}

/** 挂起/唤醒/更新出错的统一结论:成功或带原因拒绝(不抛,便于上层三态判定)。 */
export type GoalTransition =
  | { ok: true; goal: GoalEntity }
  | { ok: false; reason: string };

/** now 注入(测试用),默认 Date.now。 */
export type NowFn = () => number;

/**
 * 创建目标(①):objective 非空、budget 至少一项、goalId 非空。
 * 创建即 active;预算在 create 时锁定,后续不可改(防中途放宽烧穿)。
 */
export function createGoal(
  input: CreateGoalInput,
  now: NowFn = Date.now,
): GoalTransition {
  if (!input.goalId || input.goalId.trim() === '') {
    return { ok: false, reason: 'goalId 不能为空' };
  }
  if (!input.objective || input.objective.trim() === '') {
    return { ok: false, reason: 'objective 不能为空 —— 无目标的循环是事故' };
  }
  const b = input.budget ?? {};
  const hasBudget =
    b.maxTokens !== undefined || b.maxTimeMs !== undefined || b.maxRounds !== undefined;
  if (!hasBudget) {
    return { ok: false, reason: 'budget 至少给一项(maxTokens/maxTimeMs/maxRounds)—— 无预算目标不允许' };
  }
  for (const [k, v] of Object.entries(b) as [string, number | undefined][]) {
    if (v !== undefined && (!Number.isInteger(v) || v <= 0)) {
      return { ok: false, reason: `budget.${k} 必须是正整数(收到 ${String(v)})` };
    }
  }
  const t = now();
  const goal: GoalEntity = {
    goalId: input.goalId,
    objective: input.objective,
    mode: input.mode ?? 'code',
    status: 'active',
    budget: b,
    tokensUsed: 0,
    timeUsedMs: 0,
    roundsUsed: 0,
    createdAt: t,
    updatedAt: t,
  };
  return { ok: true, goal };
}

/**
 * 挂起目标(②):记下 wakeup 条件。
 * 只有 active 才能挂起(suspended/终态再挂起 = 重复或误操作,拒)。
 * reason 与 resumeWhen 都必填 —— 丢一个就丢"为什么停 / 什么条件继续"。
 */
export function suspendGoal(
  goal: GoalEntity,
  cond: { reason: string; resumeWhen: string; background?: boolean },
  now: NowFn = Date.now,
): GoalTransition {
  if (goal.status !== 'active') {
    return { ok: false, reason: `只能挂起 active 目标(当前 ${goal.status})` };
  }
  if (!cond.reason || cond.reason.trim() === '') {
    return { ok: false, reason: '挂起必须带 reason —— 否则丢失"为什么停"' };
  }
  if (!cond.resumeWhen || cond.resumeWhen.trim() === '') {
    return { ok: false, reason: '挂起必须带 resumeWhen 唤醒条件 —— 否则无法恢复' };
  }
  const t = now();
  const next: GoalEntity = {
    ...goal,
    status: 'suspended',
    wakeup: {
      reason: cond.reason,
      resumeWhen: cond.resumeWhen,
      suspendedAt: t,
      background: cond.background ?? false,
    },
    updatedAt: t,
  };
  return { ok: true, goal: next };
}

/**
 * 唤醒目标(③):只在 suspended + 条件满足时推进回 active。
 * `conditionMet` 由调用方判定(它知道业务条件是否成立),本模块只把
 * 「挂起态 + 条件满足」作为放行的必要门槛(防误唤醒/重复唤醒)。
 * 非挂起态拒;条件不满足拒;后台唤醒走同一路径(background 只影响上层调度,不改变状态语义)。
 */
export function resumeGoal(
  goal: GoalEntity,
  conditionMet: boolean,
  now: NowFn = Date.now,
): GoalTransition {
  if (goal.status !== 'suspended') {
    return { ok: false, reason: `只能唤醒 suspended 目标(当前 ${goal.status})` };
  }
  if (!goal.wakeup) {
    return { ok: false, reason: '挂起记录丢失 wakeup 条件 —— 数据不一致,拒绝唤醒' };
  }
  if (!conditionMet) {
    return { ok: false, reason: `唤醒条件未满足(${goal.wakeup.resumeWhen})` };
  }
  const t = now();
  const next: GoalEntity = {
    ...goal,
    status: 'active',
    wakeup: undefined,
    updatedAt: t,
  };
  return { ok: true, goal: next };
}

/** 达成(终态):任意非终态可达成;终态(achieved/abandoned)不可再变。 */
export function achieveGoal(
  goal: GoalEntity,
  now: NowFn = Date.now,
): GoalTransition {
  if (goal.status === 'achieved' || goal.status === 'abandoned') {
    return { ok: false, reason: `目标已是终态(${goal.status}),不可再改` };
  }
  const t = now();
  return {
    ok: true,
    goal: { ...goal, status: 'achieved', wakeup: undefined, updatedAt: t },
  };
}

/** 放弃(终态):与 achieved 区分 —— abandoned 是"决定不做了",不是"做成了"。 */
export function abandonGoal(
  goal: GoalEntity,
  reason: string,
  now: NowFn = Date.now,
): GoalTransition {
  if (goal.status === 'achieved' || goal.status === 'abandoned') {
    return { ok: false, reason: `目标已是终态(${goal.status}),不可再改` };
  }
  if (!reason || reason.trim() === '') {
    return { ok: false, reason: '放弃必须带 reason(审计需要知道为什么半途而废)' };
  }
  void reason; // reason 进审计层,本函数只校验非空;真正落审计由调用方做
  const t = now();
  return {
    ok: true,
    goal: { ...goal, status: 'abandoned', wakeup: undefined, updatedAt: t },
  };
}

/**
 * 累加使用计数(Trae tokens_used/time_used_seconds/rounds_used)。
 * 任意非终态可累加;超出预算不在这里拦(那是 goal-loop 判据的事),
 * 本函数只如实累加,提供 `withinBudget` 供调用方判断。
 */
export function recordUsage(
  goal: GoalEntity,
  usage: { tokens?: number; timeMs?: number; rounds?: number },
  now: NowFn = Date.now,
): GoalTransition {
  if (goal.status === 'achieved' || goal.status === 'abandoned') {
    return { ok: false, reason: `目标已是终态(${goal.status}),不再累加使用` };
  }
  const t = now();
  return {
    ok: true,
    goal: {
      ...goal,
      tokensUsed: goal.tokensUsed + (usage.tokens ?? 0),
      timeUsedMs: goal.timeUsedMs + (usage.timeMs ?? 0),
      roundsUsed: goal.roundsUsed + (usage.rounds ?? 0),
      updatedAt: t,
    },
  };
}

/** 切换模式(Trae enter_plan_mode/exit_plan_mode):只在非终态可切。 */
export function setMode(
  goal: GoalEntity,
  mode: GoalMode,
  now: NowFn = Date.now,
): GoalTransition {
  if (goal.status === 'achieved' || goal.status === 'abandoned') {
    return { ok: false, reason: `目标已是终态(${goal.status}),不可切模式` };
  }
  if (mode === goal.mode) {
    return { ok: true, goal }; // 幂等:切到当前模式,原样返回
  }
  const t = now();
  return { ok: true, goal: { ...goal, mode, updatedAt: t } };
}

/**
 * 预算是否还有余量(供调用方决定要不要继续/加预算)。
 * 任一项超限即 false;undefined 项视为不限。
 */
export function withinBudget(goal: GoalEntity): boolean {
  const b = goal.budget;
  if (b.maxTokens !== undefined && goal.tokensUsed >= b.maxTokens) return false;
  if (b.maxTimeMs !== undefined && goal.timeUsedMs >= b.maxTimeMs) return false;
  if (b.maxRounds !== undefined && goal.roundsUsed >= b.maxRounds) return false;
  return true;
}

/** 一句话摘要(给审计/展示)。不把 suspended 说成失败。 */
export function describeGoal(goal: GoalEntity): string {
  const used = `${goal.roundsUsed}轮/${goal.tokensUsed}tok/${goal.timeUsedMs}ms`;
  switch (goal.status) {
    case 'active':
      return `[${goal.goalId}] ${goal.objective} · ${goal.mode} · 运行中 · 已用 ${used}`;
    case 'suspended':
      return goal.wakeup
        ? `[${goal.goalId}] ${goal.objective} · 挂起(${goal.wakeup.reason})· 唤醒条件:${goal.wakeup.resumeWhen}${goal.wakeup.background ? '(后台)' : ''}`
        : `[${goal.goalId}] 挂起(wakeup 记录丢失)`;
    case 'achieved':
      return `[${goal.goalId}] 达成 · 已用 ${used}`;
    case 'abandoned':
      return `[${goal.goalId}] 放弃 · 已用 ${used}`;
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
