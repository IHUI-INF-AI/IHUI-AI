// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回合运行态 + 目标态的持久化。
 *
 * ## 为什么单独存而不塞进 Session
 *
 * `Session`(`apps/cli/src/commands/session.ts`)存的是**历史事实**:`history: ChatMessage[]`,
 * append-only。而回合运行态是**当前状态**:同一个 turn 的 phase 会被反复覆盖。
 * 两者写频差异极大(历史每条消息写一次,状态每次迁移写一次),混在一个文件里
 * 会让高频小写把大文件反复重写 —— 这是实测过的性能坑,不是理论担忧。
 *
 * 因此本模块用**独立目录 + 每会话一个文件**:
 *   `~/.ihui/turns/<sessionId>.json`   —— 回合运行态
 *   `~/.ihui/goals/<sessionId>.json`   —— 目标态
 *
 * ## 路径安全
 *
 * 与 `session.ts` 同一处置:`segmentFilePathInside` 收敛 id 成单段名并断言落在目录内,
 * `../` / 盘符 / 绝对路径一律拒。**不复用 sessionFilePath**,因为目录不同;
 * 但复用同一个判据函数(单一真相源)。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { segmentFilePathInside } from '../util/path-guard.js';
import type { TurnPhase, TurnRecord, WakeCondition } from './turn-lifecycle.js';

/** 目标态。目标是一等实体,不是散在对话里的一句话。 */
export interface GoalRecord {
  readonly id: string;
  readonly sessionId: string;
  /** 目标陈述。必填,且不允许空串 —— 空目标等于没有目标。 */
  readonly statement: string;
  readonly status: GoalStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** 完成后由谁/什么判定达成的说明(不参与状态迁移,仅供审计)。 */
  readonly completionNote?: string;
}

export type GoalStatus = 'active' | 'achieved' | 'abandoned';

/** 一个会话的运行态快照。 */
export interface SessionRuntime {
  readonly sessionId: string;
  readonly turns: readonly TurnRecord[];
  /** 当前活跃回合 id(非终态的那一个);null = 没有进行中的回合。 */
  readonly activeTurnId: string | null;
  readonly updatedAt: number;
}

const RUNTIME_VERSION = 1;

interface RuntimeFile {
  version: number;
  sessionId: string;
  turns: TurnRecord[];
  activeTurnId: string | null;
  updatedAt: number;
}

interface GoalFile {
  version: number;
  sessionId: string;
  goals: GoalRecord[];
  updatedAt: number;
}

function turnsDir(): string {
  if (process.env.IHUI_CLI_TURNS_DIR) return process.env.IHUI_CLI_TURNS_DIR;
  return path.join(os.homedir(), '.ihui', 'turns');
}

function goalsDir(): string {
  if (process.env.IHUI_CLI_GOALS_DIR) return process.env.IHUI_CLI_GOALS_DIR;
  return path.join(os.homedir(), '.ihui', 'goals');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/**
 * 原子写:先写临时文件再 rename。
 * 直接 writeFileSync 在断电/被杀时会留下半截 JSON —— 而运行态的读者无法区分
 * "半截"与"空",会把挂起的回合当成不存在,静默丢失。
 */
function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    // 损坏不静默覆盖:返回 null 让调用方决定(与 session.ts 的处置一致)。
    return null;
  }
}

const TERMINAL: readonly TurnPhase[] = ['completed', 'failed', 'cancelled'];

/** 读一个会话的运行态。文件不存在或损坏 → 空态(而非抛错),因为"没有回合"是合法初态。 */
export function loadSessionRuntime(sessionId: string): SessionRuntime {
  const file = segmentFilePathInside(turnsDir(), sessionId, '.json', '回合运行态文件');
  const raw = readJson<RuntimeFile>(file);
  if (!raw || raw.version !== RUNTIME_VERSION || !Array.isArray(raw.turns)) {
    return { sessionId, turns: [], activeTurnId: null, updatedAt: 0 };
  }
  return {
    sessionId: raw.sessionId,
    turns: raw.turns,
    activeTurnId: raw.activeTurnId,
    updatedAt: raw.updatedAt,
  };
}

/** 写一个会话的运行态。 */
export function saveSessionRuntime(runtime: SessionRuntime): void {
  const file = segmentFilePathInside(turnsDir(), runtime.sessionId, '.json', '回合运行态文件');
  const payload: RuntimeFile = {
    version: RUNTIME_VERSION,
    sessionId: runtime.sessionId,
    turns: [...runtime.turns],
    activeTurnId: runtime.activeTurnId,
    updatedAt: runtime.updatedAt,
  };
  writeJsonAtomic(file, payload);
}

/**
 * 把一次迁移结果落盘:替换同 id 的旧记录(没有则追加)。
 * `activeTurnId` 由是否还有非终态回合决定 —— 不用调用方传,避免两边不一致。
 */
export function upsertTurn(sessionId: string, record: TurnRecord): SessionRuntime {
  const current = loadSessionRuntime(sessionId);
  const turns = current.turns.filter((t) => t.id !== record.id);
  turns.push(record);
  turns.sort((a, b) => a.ordinal - b.ordinal);
  const active = turns.filter((t) => !TERMINAL.includes(t.phase));
  const lastActive = active.length > 0 ? active[active.length - 1] : undefined;
  const next: SessionRuntime = {
    sessionId,
    turns,
    activeTurnId: lastActive ? lastActive.id : null,
    updatedAt: record.updatedAt,
  };
  saveSessionRuntime(next);
  return next;
}

/** 找出该会话下一个可用的回合序号(1 基,取 max+1)。 */
export function nextTurnOrdinal(sessionId: string): number {
  const runtime = loadSessionRuntime(sessionId);
  const max = runtime.turns.reduce((n, t) => Math.max(n, t.ordinal), 0);
  return max + 1;
}

/**
 * 列出所有"此刻可被唤醒"的回合(跨会话)。给定时驱动/启动恢复用。
 * 纯事件式挂起(`notBefore` 缺席)不在此列 —— 它只能被显式唤醒。
 */
export function listWakeableTurns(now: number): { sessionId: string; turn: TurnRecord }[] {
  const dir = turnsDir();
  if (!fs.existsSync(dir)) return [];
  const out: { sessionId: string; turn: TurnRecord }[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const raw = readJson<RuntimeFile>(path.join(dir, name));
    if (!raw || raw.version !== RUNTIME_VERSION) continue;
    for (const t of raw.turns) {
      if (t.phase !== 'parked' || !t.wake) continue;
      if (t.wake.notBefore !== undefined && t.wake.notBefore <= now) {
        out.push({ sessionId: raw.sessionId, turn: t });
      }
    }
  }
  return out;
}

/** 构造挂起条件(便于调用方少写样板)。 */
export function parkUntil(params: {
  reason: WakeCondition['reason'];
  notBefore?: number;
  note?: string;
}): WakeCondition {
  return {
    reason: params.reason,
    ...(params.notBefore === undefined ? {} : { notBefore: params.notBefore }),
    ...(params.note === undefined ? {} : { note: params.note }),
  };
}

// ── 目标态 ────────────────────────────────────────────────────────────────

/**
 * 新建目标。`statement` 不允许空白 —— 空目标会让"目标驱动"退化成空转。
 */
export function createGoal(params: {
  id: string;
  sessionId: string;
  statement: string;
  at: number;
}): GoalRecord {
  const trimmed = params.statement.trim();
  if (trimmed === '') {
    throw new Error('目标陈述不得为空:空目标等于没有目标');
  }
  return {
    id: params.id,
    sessionId: params.sessionId,
    statement: trimmed,
    status: 'active',
    createdAt: params.at,
    updatedAt: params.at,
  };
}

/** 目标状态迁移的合法路径。终态不可再迁。 */
const GOAL_TRANSITIONS: Record<GoalStatus, readonly GoalStatus[]> = {
  active: ['achieved', 'abandoned'],
  achieved: [],
  abandoned: [],
};

export function applyGoalTransition(
  goal: GoalRecord,
  next: GoalStatus,
  at: number,
  note?: string,
): { ok: true; next: GoalRecord } | { ok: false; code: string; message: string } {
  const allowed = GOAL_TRANSITIONS[goal.status];
  if (!allowed.includes(next)) {
    return {
      ok: false,
      code: goal.status === next ? 'no-op' : 'illegal-status',
      message: `目标 ${goal.id}: ${goal.status} → ${next} 不允许(允许 ${allowed.join('/') || '无'})`,
    };
  }
  if (at < goal.updatedAt) {
    return { ok: false, code: 'time-travel', message: `迁移时刻 ${at} 早于目标更新时刻 ${goal.updatedAt}` };
  }
  return {
    ok: true,
    next: {
      ...goal,
      status: next,
      updatedAt: at,
      ...(note === undefined ? {} : { completionNote: note }),
    },
  };
}

export function loadGoals(sessionId: string): GoalRecord[] {
  const file = segmentFilePathInside(goalsDir(), sessionId, '.json', '目标文件');
  const raw = readJson<GoalFile>(file);
  if (!raw || raw.version !== RUNTIME_VERSION || !Array.isArray(raw.goals)) return [];
  return raw.goals;
}

export function saveGoals(sessionId: string, goals: readonly GoalRecord[]): void {
  const file = segmentFilePathInside(goalsDir(), sessionId, '.json', '目标文件');
  const payload: GoalFile = {
    version: RUNTIME_VERSION,
    sessionId,
    goals: [...goals],
    updatedAt: Date.now(),
  };
  writeJsonAtomic(file, payload);
}

/** upsert 一个目标(同 id 覆盖)。 */
export function upsertGoal(goal: GoalRecord): GoalRecord[] {
  const current = loadGoals(goal.sessionId).filter((g) => g.id !== goal.id);
  current.push(goal);
  current.sort((a, b) => a.createdAt - b.createdAt);
  saveGoals(goal.sessionId, current);
  return current;
}
