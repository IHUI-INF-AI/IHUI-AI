/**
 * PlanBuildCoordinator — Plan/Build/Review 三模状态机 + 状态持久化。
 * - plan: 只读调研,禁止写工具
 * - build: 全权执行修改
 * - review: 审查 diff,只读
 * 状态持久化到 <workspace>/.trae-cn/modes/plan-build-state.json(跨 session 恢复)。
 * 平台独占:仅 cli(W2-2 Plan-Build 模式,对标 OpenCode Plan/Build,增强 Review + 持久化)。
 *
 * 计划-执行-清单闭环(结构化计划):
 * - setPlan 接受 StructuredPlanInput:持久化到 .ihui/plan-<sessionId>.json,
 *   自动补全 todoId(todo-<sessionId>-<stepId>)并生成 .ihui/todos.json 清单(merge 语义,保留计划外旧 todo)
 * - stepStarted/stepCompleted 同步勾选计划步骤与 todo(含 summary 透传)
 * - planSessionId 随状态文件持久化,新实例可恢复结构化计划
 * - clearPlan 仅清除计划关联,不联动清除 todos.json(由 todo-write 语义管理)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryParseJson, isRecord } from '../util/json.js';
import {
  StructuredPlanStore,
  type PlanStep,
  type PlanStepStatus,
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
  /** 结构化计划会话 ID(plan-<sessionId>.json 的锚点,null 表示纯文本计划/无计划) */
  planSessionId: string | null;
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

  /**
   * 设置计划。
   * - 字符串:保持旧语义(纯文本计划,planSessionId 置空)
   * - StructuredPlanInput:持久化结构化计划 + 自动生成 todo 清单 + todoId 回填
   */
  setPlan(plan: string | StructuredPlanInput): void {
    if (typeof plan === 'string') {
      this.plan = plan;
      this.planSessionId = null;
      this.save();
      return;
    }

    const sessionId = plan.sessionId;
    const now = new Date().toISOString();
    // 补全 status/todoId(结构化计划 → todo 双向关联锚点)
    const steps: PlanStep[] = plan.steps.map((s) => ({
      id: s.id,
      title: s.title,
      file: s.file,
      action: s.action,
      todoId: s.todoId ?? `todo-${sessionId}-${s.id}`,
      status: s.status ?? 'pending',
    }));
    const structured: StructuredPlan = { sessionId, steps, createdAt: now, updatedAt: now };
    this.planStore.save(structured);
    this.planSessionId = sessionId;

    // 自动生成 todo 清单(merge 语义:保留计划外的旧 todo)
    const todoCtx = { workspacePath: this.workspacePath };
    const newTodos: TodoItem[] = steps.map((s) => ({
      id: s.todoId ?? `todo-${sessionId}-${s.id}`,
      content: s.file ? `${s.title} (${s.file})` : s.title,
      status: s.status ?? 'pending',
      priority: 'medium',
    }));
    const newIds = new Set(newTodos.map((t) => t.id));
    const preserved = readTodoList(todoCtx).filter((t) => !newIds.has(t.id));
    writeTodoList(todoCtx, [...newTodos, ...preserved]);

    // plan 文本摘要保持旧字段语义(含标题与目标文件)
    this.plan = steps
      .map((s, i) => `${i + 1}. ${s.title}${s.file ? ` (${s.file})` : ''}`)
      .join('\n');
    this.save();
  }

  /** 读取结构化计划(未设置/文件损坏返回 null)。 */
  getStructuredPlan(): StructuredPlan | null {
    if (!this.planSessionId) return null;
    return this.planStore.load(this.planSessionId);
  }

  /** 执行期:步骤开始(计划步骤 + todo 同步置 in_progress;未设结构化计划/未知步骤静默跳过)。 */
  stepStarted(stepId: string): void {
    this.syncStepStatus(stepId, 'in_progress');
  }

  /** 执行期:步骤完成(计划步骤 + todo 同步置 completed,summary 透传到 todo;静默跳过语义同上)。 */
  stepCompleted(stepId: string, summary?: string): void {
    this.syncStepStatus(stepId, 'completed', summary);
  }

  /** 清空计划(含结构化关联;不影响已生成的 todos.json)。 */
  clearPlan(): void {
    this.plan = null;
    this.planSessionId = null;
    this.save();
  }

  /** 模式切换历史(只读副本)。 */
  getHistory(): PlanBuildHistoryEntry[] {
    return [...this.history];
  }

  /** 同步勾选计划步骤与 todo(计划或步骤不存在时静默跳过)。 */
  private syncStepStatus(stepId: string, status: PlanStepStatus, summary?: string): void {
    const plan = this.getStructuredPlan();
    if (!plan) return;
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return;

    this.planStore.updateStepStatus(plan.sessionId, stepId, status);

    if (step.todoId) {
      const todoCtx = { workspacePath: this.workspacePath };
      const todos = readTodoList(todoCtx);
      const todo = todos.find((t) => t.id === step.todoId);
      if (todo) {
        todo.status = status;
        if (status === 'completed' && summary !== undefined) {
          todo.summary = summary;
        }
        writeTodoList(todoCtx, todos);
      }
    }
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
        this.planSessionId = (parsed.planSessionId as string | null) ?? null;
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
