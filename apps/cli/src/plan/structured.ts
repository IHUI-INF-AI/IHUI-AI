/**
 * 结构化计划(Structured Plan)— 计划-执行-清单闭环的数据层。
 *
 * 做减法:
 *   - 计划 = steps 数组,每步含 id/title/file?/action/todoId?/status
 *   - 持久化到 <workspace>/.ihui/plan-<sessionId>.json(跨轮/跨会话恢复)
 *   - 通过 todoId 与 todo-write 的 .ihui/todos.json 双向关联(闭环关键)
 *   - 损坏文件降级为 null,不抛错(沿用 plan-build 的容错风格)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryParseJson, isRecord, isJsonArray } from '../util/json.js';

/** 计划步骤状态(与 todo-write 的 TodoItem.status 同词表,可直接映射) */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed';

/** 计划步骤操作类型 */
export type PlanStepAction = 'create' | 'edit' | 'delete' | 'read' | 'run' | 'verify';

export interface PlanStep {
  id: string;
  title: string;
  /** 目标文件(可选,相对工作区路径) */
  file?: string;
  /** 操作类型(create/edit/delete/read/run/verify) */
  action: PlanStepAction;
  /** 关联的 todo id(与 .ihui/todos.json 双向关联,勾选 todo 的锚点) */
  todoId?: string;
  status: PlanStepStatus;
}

export interface StructuredPlan {
  sessionId: string;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
}

/** setPlan 的结构化入参(status/todoId 可省略,由协调器补全) */
export interface StructuredPlanInput {
  sessionId: string;
  steps: Array<Omit<PlanStep, 'status' | 'todoId'> & Partial<Pick<PlanStep, 'status' | 'todoId'>>>;
}

const VALID_ACTIONS: ReadonlySet<string> = new Set(['create', 'edit', 'delete', 'read', 'run', 'verify']);
const VALID_STATUSES: ReadonlySet<string> = new Set(['pending', 'in_progress', 'completed']);

/** 计划持久化路径:<workspace>/.ihui/plan-<sessionId>.json */
export function planFilePath(workspacePath: string, sessionId: string): string {
  return path.join(workspacePath, '.ihui', `plan-${sessionId}.json`);
}

/** 解析持久化 JSON 为 StructuredPlan(结构非法/损坏返回 null) */
export function parseStructuredPlan(raw: string): StructuredPlan | null {
  const parsed = tryParseJson(raw);
  if (!isRecord(parsed)) return null;
  if (typeof parsed.sessionId !== 'string' || !isJsonArray(parsed.steps)) return null;
  const steps: PlanStep[] = [];
  for (const s of parsed.steps) {
    if (!isRecord(s)) return null;
    if (typeof s.id !== 'string' || s.id.length === 0) return null;
    if (typeof s.title !== 'string' || s.title.length === 0) return null;
    if (typeof s.action !== 'string' || !VALID_ACTIONS.has(s.action)) return null;
    const status = s.status ?? 'pending';
    if (typeof status !== 'string' || !VALID_STATUSES.has(status)) return null;
    steps.push({
      id: s.id,
      title: s.title,
      file: typeof s.file === 'string' ? s.file : undefined,
      action: s.action as PlanStepAction,
      todoId: typeof s.todoId === 'string' ? s.todoId : undefined,
      status: status as PlanStepStatus,
    });
  }
  return {
    sessionId: parsed.sessionId,
    steps,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
  };
}

/** 结构化计划持久化仓库(load/save/updateStepStatus,零外部依赖) */
export class StructuredPlanStore {
  private readonly workspacePath: string;

  constructor(workspacePath = process.cwd()) {
    this.workspacePath = workspacePath;
  }

  /** 保存计划(自动创建 .ihui 目录,刷新 updatedAt) */
  save(plan: StructuredPlan): void {
    const p = planFilePath(this.workspacePath, plan.sessionId);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
  }

  /** 读取计划(不存在/损坏返回 null) */
  load(sessionId: string): StructuredPlan | null {
    const p = planFilePath(this.workspacePath, sessionId);
    try {
      if (!fs.existsSync(p)) return null;
      return parseStructuredPlan(fs.readFileSync(p, 'utf-8'));
    } catch {
      return null;
    }
  }

  /** 更新步骤状态并持久化(计划或步骤不存在返回 null) */
  updateStepStatus(sessionId: string, stepId: string, status: PlanStepStatus): PlanStep | null {
    const plan = this.load(sessionId);
    if (!plan) return null;
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return null;
    step.status = status;
    this.save(plan);
    return step;
  }
}
