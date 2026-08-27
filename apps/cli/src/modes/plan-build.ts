/**
 * PlanBuildCoordinator — Plan/Build/Review 三模状态机 + 状态持久化。
 * - plan: 只读调研,禁止写工具
 * - build: 全权执行修改
 * - review: 审查 diff,只读
 * 状态持久化到 <workspace>/.trae-cn/modes/plan-build-state.json(跨 session 恢复)。
 * 平台独占:仅 cli(W2-2 Plan-Build 模式,对标 OpenCode Plan/Build,增强 Review + 持久化)。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tryParseJson, isRecord } from '../util/json.js';

export type PlanBuildMode = 'plan' | 'build' | 'review';

export interface PlanBuildHistoryEntry {
  ts: number;
  from: PlanBuildMode;
  to: PlanBuildMode;
}

export interface PlanBuildState {
  mode: PlanBuildMode;
  plan: string | null;
  history: PlanBuildHistoryEntry[];
}

const VALID_MODES: ReadonlySet<PlanBuildMode> = new Set<PlanBuildMode>(['plan', 'build', 'review']);

export class PlanBuildCoordinator {
  private mode: PlanBuildMode = 'build';
  private plan: string | null = null;
  private readonly history: PlanBuildHistoryEntry[] = [];
  private readonly stateFile: string;

  constructor(workspacePath = process.cwd()) {
    this.stateFile = path.join(workspacePath, '.trae-cn', 'modes', 'plan-build-state.json');
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

  /** 设置 plan 文本(plan 模式产出)。 */
  setPlan(plan: string): void {
    this.plan = plan;
    this.save();
  }

  /** 清空 plan。 */
  clearPlan(): void {
    this.plan = null;
    this.save();
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
      history: this.history,
    };
    fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }
}
