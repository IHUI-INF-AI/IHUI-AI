/**
 * PlanBuildCoordinator — Plan/Build/Review 三模状态机 + 状态持久化。
 * - plan: 只读调研,禁止写工具
 * - build: 全权执行修改
 * - review: 审查 diff,只读
 * 状态持久化到 <workspace>/.trae-cn/modes/plan-build-state.json(跨 session 恢复)。
 * 计划-执行-清单闭环:
 *   - setPlan 接收结构化计划(steps),持久化到 .ihui/plan-<sessionId>.json
 *   - 自动同步生成 todo-write 清单(.ihui/todos.json,通过 todoId 双向关联)
 *   - 执行期 stepStarted/stepCompleted 勾选计划步骤与 todo 状态
 * 平台独占:仅 cli(W2-2 Plan-Build 模式,对标 OpenCode Plan/Build,增强 Review + 持久化)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryParseJson, isRecord } from '../util/json.js';
import {
  StructuredPlanStore,
  type PlanStep,
  type StructuredPlan,
  type StructuredPlanInput,
} from '../plan/structured.js';
import { readTodoList, writeTodoList, type TodoItem } from '../tools/todo-write.js';

export type PlanBuildMode = 'plan' | 'build' | 'review';

export interface PlanBuildHistoryEntry {
  ts: number;
  from: PlanBuildMode;
  to: PlanBuildMode;
}

export interface PlanBuildState {
  mode: PlanBuildMode;
  plan: string | null;
  /** 结构化计划关联的 sessionId(用于从 .ihui/plan-<sessionId>.json 恢复) */
  planSessionId?: string | null;
  history: PlanBuildHistoryEntry[];
}

const VALID_MODES: ReadonlySet<PlanBuildMode> = new Set<PlanBuildMode>(['plan', 'build', 'review']);

export class PlanBuildCoordinator {
  private mode: PlanBuildMode = 'build';
  private plan: string | null = null;
  private planSessionId: string | null = null;
  private readonly history: PlanBuildHistoryEntry[] = [];
  private readonly stateFile: string;
  private readonly workspacePath: string;
  private readonly planStore: StructuredPlanStore;

  constructor(workspacePath = process.cwd()) {
    this.workspacePath = workspacePath;
    this.stateFile = path.join(workspacePath, '.trae-cn', 'modes', 'plan-build-state.json');
    this.planStore = new StructuredPlanStore(workspacePath);
    this.load();
  }

  /** 当前模式。 */
  get currentMode(): PlanBuildMode {
    return this.mode;
  }

  /** 当前 plan 文本(plan 模式产出,build/review 参考)。 */
  get currentPlan(): string | null {
    return this.plan;
  }

  /** 当前结构化计划(从 .ihui/plan-<sessionId>.json 恢复,无则返回 null)。 */
  getStructuredPlan(): StructuredPlan | null {
    return this.planSessionId ? this.planStore.load(this.planSessionId) : null;
  }

  /** 进入只读调研模式。 */
  enterPlanning(): void {
    this.transition('plan');
  }

  /** 进入执行修改模式。 */
  enterBuilding(): void {
    this.transition('build');
  }

  /** 进入 diff 审查模式。 */
  enterReviewing(): void {
    this.transition('review');
  }

  /** 设置 plan(plan 模式产出)。接收纯文本保持旧语义;接收结构化计划则自动持久化并同步生成 todo 清单。 */
  setPlan(plan: string | StructuredPlanInput): void {
    if (typeof plan === 'string') {
      this.plan = plan;
      this.planSessionId = null;
      this.save();
      return;
    }
    // 结构化计划:补全 todoId/status → 持久化到 .ihui/plan-<sessionId>.json → 同步生成 todo 清单
    const now = new Date().toISOString();
    const steps: PlanStep[] = plan.steps.map((s) => ({
      id: s.id,
      title: s.title,
      file: s.file,
      action: s.action,
      todoId: s.todoId ?? `todo-${plan.sessionId}-${s.id}`,
      status: s.status ?? 'pending',
    }));
    const structured: StructuredPlan = { sessionId: plan.sessionId, steps, createdAt: now, updatedAt: now };
    this.planSessionId = plan.sessionId;
    this.planStore.save(structured);
    this.syncTodosFromPlan(structured);
    // plan 文本摘要(保持旧字段语义,build/review 模式可直接参考)
    this.plan = steps.map((s) => `- [${s.status}] ${s.title}${s.file ? ` (${s.file})` : ''}`).join('\n');
    this.save();
  }

  /** 清空 plan(结构化计划关联一并清除,不动 todos.json)。 */
  clearPlan(): void {
    this.plan = null;
    this.planSessionId = null;
    this.save();
  }

  /** 执行期回调:步骤开始(计划步骤与关联 todo 同步置为 in_progress)。 */
  stepStarted(stepId: string): void {
    this.updateStep(stepId, 'in_progress');
  }

  /** 执行期回调:步骤完成(计划步骤与关联 todo 同步勾选为 completed,可附总结)。 */
  stepCompleted(stepId: string, summary?: string): void {
    this.updateStep(stepId, 'completed', summary);
  }

  /** 同步生成 todo 清单:计划步骤 → todo(复用 todo-write 持久化机制,保留计划外旧 todo)。 */
  private syncTodosFromPlan(plan: StructuredPlan): void {
    const ctx = { workspacePath: this.workspacePath };
    const planTodoIds = new Set(plan.steps.map((s) => s.todoId).filter((id): id is string => Boolean(id)));
    // 保留与当前计划无关的旧 todo(非本计划的 todoId 不覆盖)
    const preserved = readTodoList(ctx).filter((t) => !planTodoIds.has(t.id));
    const todos: TodoItem[] = [
      ...plan.steps.map((s) => ({
        id: s.todoId!,
        content: s.file ? `${s.title} (${s.file})` : s.title,
        status: s.status,
        priority: 'medium' as const,
      })),
      ...preserved,
    ];
    writeTodoList(ctx, todos);
  }

  /** 更新计划步骤状态并同步勾选关联 todo(计划/步骤/todo 不存在则静默跳过)。 */
  private updateStep(stepId: string, status: PlanStep['status'], summary?: string): void {
    if (!this.planSessionId) return;
    const plan = this.planStore.load(this.planSessionId);
    if (!plan) return;
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return;
    step.status = status;
    this.planStore.save(plan);
    if (!step.todoId) return;
    const ctx = { workspacePath: this.workspacePath };
    const todos = readTodoList(ctx);
    const todo = todos.find((t) => t.id === step.todoId);
    if (!todo) return;
    todo.status = status;
    if (summary !== undefined) todo.summary = summary;
    writeTodoList(ctx, todos);
  }

  /** 模式切换历史(只读副本)。 */
  getHistory(): PlanBuildHistoryEntry[] {
    return [...this.history];
  }

  private transition(next: PlanBuildMode): void {
    if (this.mode === next) return;
    this.history.push({ ts: Date.now(), from: this.mode, to: next });
    this.mode = next;
    this.save();
  }

  private load(): void {
    if (!fs.existsSync(this.stateFile)) return;
    try {
      const parsed = tryParseJson(fs.readFileSync(this.stateFile, 'utf-8'));
      if (!isRecord(parsed)) return;
      if (typeof parsed.mode === 'string' && VALID_MODES.has(parsed.mode as PlanBuildMode)) {
        this.mode = parsed.mode as PlanBuildMode;
      }
      if (typeof parsed.plan === 'string' || parsed.plan === null) {
        this.plan = parsed.plan ?? null;
      }
      if (typeof parsed.planSessionId === 'string' || parsed.planSessionId === null) {
        this.planSessionId = parsed.planSessionId ?? null;
      }
      if (Array.isArray(parsed.history)) {
        for (const h of parsed.history) {
          if (
            isRecord(h) &&
            typeof h.ts === 'number' &&
            typeof h.from === 'string' &&
            typeof h.to === 'string' &&
            VALID_MODES.has(h.from as PlanBuildMode) &&
            VALID_MODES.has(h.to as PlanBuildMode)
          ) {
            this.history.push({ ts: h.ts, from: h.from as PlanBuildMode, to: h.to as PlanBuildMode });
          }
        }
      }
    } catch {
      // 损坏文件忽略,沿用默认状态
    }
  }

  private save(): void {
    const dir = path.dirname(this.stateFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const state: PlanBuildState = {
      mode: this.mode,
      plan: this.plan,
      planSessionId: this.planSessionId,
      history: this.history,
    };
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }
}
