// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠



/**
 * Skill Evolution — 可自修改技能资产的内容指纹 + 进化提议状态机。
 *
 * ## 前提基建(为什么先建这一层)
 *
 * Qoder 的 `skill_evolution_suggestions` 把"技能进化"建在一个前提上:
 * **技能是一份有内容指纹的活文件,进化 = 改写它**。它的提议表用
 * `baseline_hash` / `hash_invalidated` 跟踪技能内容 —— 当技能本体在提议生效前
 * 被外部改动(指纹不再等于提议记录的 baseline)时,提议自动作废,防止把过期
 * 改写盖到一个已漂移的技能上。
 *
 * 我方 CLI 此前的技能体系(`ai-skills.ts`)只存 `{installed: string[]}` —— 只登记
 * id,**不存内容哈希、无版本、无进化状态**。这正是本模块要补齐的前提基建:
 *   1. **内容指纹**:对技能目录确定性哈希(复用 `skill-package.ts` 同源的
 *      `createHash('sha256')`),作为"技能此刻是什么"的锚。
 *   2. **进化提议状态机**:七态 `pending → starting → evolving → evolved` /
 *      `dismissed / expired / hash_invalidated`,提议绑定 baseline_hash,技能漂移
 *      即作废。
 *
 * ## 与 Qoder 逐项对标
 *
 *   skill_evolution_suggestions        →  本模块
 *   ─────────────────────────────────────────────────────────
 *   status 七态                          →  SuggestionStatus 同七态
 *   baseline_hash / hash_invalidated    →  baselineHash + reconcile() 指纹失效自动作废
 *   expires_at(pending 超时)           →  expiresAt + expirePending() 到期作废
 *   evolution_session_id(可恢复会话)   →  evolutionSessionId(可选)
 *   source_session_id / created_at      →  sourceSessionId / createdAt
 *   提议按 source 溯源 + 状态流转       →  原样复现
 *
 * ## 做减法(对齐本仓"不引入新依赖 / 单写者")
 *
 *   - 存储:每技能一个 JSON(`~/.ihui/skill-evolution/<skillId>.json`),不引 SQLite
 *   - 确定性目录哈希:递归收文件相对路径 + 内容,排序后统一 sha256,跨平台稳定
 *   - 状态流转全部纯函数 + 显式非法迁移抛错(可测、可断言),持久化只是薄封装
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { segmentFilePathInside } from '../util/path-guard.js';
import { markDeleted, isDeleted, DeletedResourceError } from './deletion-tombstones.js';

/** 进化提议七态(对标 Qoder status CHECK IN 七值)。
 *
 * 主链:pending(待处理)→ starting(已启动进化)→ evolving(进行中)→ evolved(已生效)
 * 终态/旁路:dismissed(人手动弃)、expired(pending 超时)、hash_invalidated(技能漂移作废)
 */
export type SuggestionStatus =
  | 'pending'
  | 'starting'
  | 'evolving'
  | 'evolved'
  | 'dismissed'
  | 'expired'
  | 'hash_invalidated';

/** 合法状态迁移表:键 = 当前态,值 = 允许迁往的态。
 *
 * 设计要点:hash_invalidated / expired / dismissed / evolved 都是**终态**(空集),
 * 不可再迁移 —— 防止把已作废的提议偷偷复活(对标 Qoder cleanup 索引只清终态)。
 */
const ALLOWED_TRANSITIONS: Record<SuggestionStatus, readonly SuggestionStatus[]> = {
  pending: ['starting', 'dismissed', 'expired', 'hash_invalidated'],
  starting: ['evolving', 'dismissed', 'hash_invalidated'],
  evolving: ['evolved', 'dismissed', 'hash_invalidated'],
  evolved: [],
  dismissed: [],
  expired: [],
  hash_invalidated: [],
};

/** 一条进化提议(对标 Qoder skill_evolution_suggestions 一行)。 */
export interface EvolutionSuggestion {
  readonly id: string;
  /** 目标技能 id(此提议要进化哪个技能)。 */
  readonly skillId: string;
  /** 提议记录时的技能内容指纹 —— 技能漂移判据。 */
  readonly baselineHash: string;
  /** 溯源:这条提议从哪个会话/来源产生。 */
  readonly sourceSessionId?: string;
  /** 进化过程承载的会话 id(可恢复,可选)。 */
  readonly evolutionSessionId?: string;
  /** 人类可读的进化意图(改什么、为什么)。 */
  readonly intent: string;
  /** 进化要落到技能里的新内容(文本形式;由上层决定如何写回文件)。 */
  readonly proposedChange: string;
  readonly status: SuggestionStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** pending 超时时刻(可选;对标 expires_at)。 */
  readonly expiresAt?: number;
  /** 提议生效(evolved)时刻。 */
  readonly evolvedAt?: number;
}

// ─────────────────────────────────────────────────────────────
// ① 内容指纹:确定性目录哈希(前提基建的核心锚)
// ─────────────────────────────────────────────────────────────

/** 忽略的文件/目录名(与技能无关的元数据,不参与指纹)。 */
const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'package-lock.json',
]);

/** 递归收集 dir 下所有文件的「相对路径 → 内容字节」(忽略 IGNORED_NAMES)。
 *
 * 返回按相对路径排序的条目,保证同内容同布局 → 同指纹(跨平台稳定)。
 */
function collectSkillFiles(
  dir: string,
  prefix = '',
): { relPath: string; bytes: Buffer }[] {
  const out: { relPath: string; bytes: Buffer }[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_NAMES.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...collectSkillFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push({ relPath: rel, bytes: fs.readFileSync(abs) });
    }
  }
  return out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
}

/**
 * 计算一个技能目录的确定性内容指纹(sha256 hex)。
 *
 * 与 `commands/skill-package.ts` 同源用 `createHash('sha256')` —— 单一真相源是
 * node:crypto,不在本模块重造哈希。
 *
 * 稳定性保证:先按相对路径排序,再逐个喂入 `relPath\0` + 内容字节 + 分隔符,
 * 因此「同内容同布局 → 同指纹」「任一文件内容/增删/改名 → 指纹变」。
 * 空目录 → 仍返回一个合法 sha256(空集指纹),不抛错。
 */
export function skillContentHash(skillDir: string): string {
  const hash = createHash('sha256');
  const files = collectSkillFiles(skillDir);
  for (const f of files) {
    hash.update(f.relPath);
    hash.update('\0');
    hash.update(f.bytes);
    hash.update('\u0001'); // 条目分隔
  }
  return hash.digest('hex');
}

// ─────────────────────────────────────────────────────────────
// ② 状态流转纯函数(显式非法迁移抛错,可测可断言)
// ─────────────────────────────────────────────────────────────

/** 非法状态迁移错误。 */
export class IllegalTransitionError extends Error {
  constructor(
    readonly from: SuggestionStatus,
    readonly to: SuggestionStatus,
  ) {
    super(`非法状态迁移:${from} → ${to}(允许:${ALLOWED_TRANSITIONS[from].join(', ') || '无/终态'})`);
    this.name = 'IllegalTransitionError';
  }
}

/** 判断 from → to 是否合法迁移(纯函数)。 */
export function canTransition(
  from: SuggestionStatus,
  to: SuggestionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** 应用一次状态迁移:合法则返回新态,非法则抛 IllegalTransitionError。 */
export function transition(
  from: SuggestionStatus,
  to: SuggestionStatus,
): SuggestionStatus {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
  return to;
}

/**
 * 指纹失效判定:技能当前指纹是否仍等于提议记录的 baseline。
 * 不等 ⇒ 该提议已 hash_invalidated(技能在提议生效前被外部改动)。
 */
export function isHashInvalidated(
  suggestion: EvolutionSuggestion,
  currentSkillHash: string,
): boolean {
  // 已终态的不重复判(终态本身就是结局)
  if (suggestion.status === 'evolved' || suggestion.status === 'dismissed') return false;
  return suggestion.baselineHash !== currentSkillHash;
}

// ─────────────────────────────────────────────────────────────
// ③ 持久化存储(每技能一个 JSON;单写者;原子写 + 版本校验)
// ─────────────────────────────────────────────────────────────

const STORE_VERSION = 1;

/** 一个技能的进化提议集(对标 Qoder 按 skill 聚合的提议行)。 */
export interface SkillEvolutionStore {
  readonly skillId: string;
  /** 安装/最近 reconcile 时的技能内容指纹。 */
  readonly installedHash: string;
  readonly suggestions: EvolutionSuggestion[];
  readonly updatedAt: number;
}

interface StoreFile {
  version: number;
  skillId: string;
  installedHash: string;
  suggestions: EvolutionSuggestion[];
  updatedAt: number;
}

function storeDir(): string {
  if (process.env.IHUI_CLI_SKILL_EVOLUTION_DIR) {
    return process.env.IHUI_CLI_SKILL_EVOLUTION_DIR;
  }
  return path.join(os.homedir(), '.ihui', 'skill-evolution');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** 原子写(与 turn-store / agent-inbox 同一处置:临时文件 + rename,防半截 JSON)。 */
function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function storeFile(skillId: string): string {
  return segmentFilePathInside(storeDir(), skillId, '.json', '技能进化存储文件');
}

/** 读一个技能的进化存储。不存在/损坏/版本不符 → 空态(而非抛错)。 */
export function loadStore(skillId: string): SkillEvolutionStore {
  const file = storeFile(skillId);
  if (!fs.existsSync(file)) {
    return { skillId, installedHash: '', suggestions: [], updatedAt: 0 };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as StoreFile;
    if (raw.version !== STORE_VERSION || !Array.isArray(raw.suggestions)) {
      return { skillId, installedHash: '', suggestions: [], updatedAt: 0 };
    }
    return {
      skillId: raw.skillId,
      installedHash: raw.installedHash ?? '',
      suggestions: raw.suggestions,
      updatedAt: raw.updatedAt ?? 0,
    };
  } catch {
    // 损坏不静默覆盖:回落空态让调用方决定(与 turn-store / inbox 一致)。
    return { skillId, installedHash: '', suggestions: [], updatedAt: 0 };
  }
}

function saveStore(store: SkillEvolutionStore): void {
  const payload: StoreFile = {
    version: STORE_VERSION,
    skillId: store.skillId,
    installedHash: store.installedHash,
    suggestions: [...store.suggestions],
    updatedAt: Date.now(),
  };
  writeJsonAtomic(storeFile(store.skillId), payload);
}

// ─────────────────────────────────────────────────────────────
// ④ 编排操作(登记 / 流转 / reconcile / 过期)
// ─────────────────────────────────────────────────────────────

/**
 * 登记一条进化提议(status=pending)。
 * baselineHash 取此刻技能内容指纹 —— 这是后续漂移判据的锚。
 * 传入 installedHash(调用方已算过)可避免重复扫盘;缺省自动算。
 */
export function propose(params: {
  skillId: string;
  skillDir: string;
  id: string;
  intent: string;
  proposedChange: string;
  sourceSessionId?: string;
  evolutionSessionId?: string;
  ttlMs?: number;
  now?: number;
  installedHash?: string;
}): { store: SkillEvolutionStore; suggestion: EvolutionSuggestion } {
  // ⓪ 墓碑守卫:同 id 曾被 compact 硬删并立碑 ⇒ 显式拒绝(对标 Qoder
  //    guard_deleted_* 触发器 RAISE(ABORT))。否则会静默 append 一条注定被
  //    applySuggestion 墓碑守卫挡住的僵尸 pending(留 store、被列出、永不可 apply)。
  //    正确复活路径 = 先 removeTombstone 显式清碑,再 propose。
  const tombstone = { scope: 'skill-evolution' as const, type: 'suggestion' as const, id: params.id };
  if (isDeleted(tombstone)) {
    throw new DeletedResourceError(tombstone);
  }
  const now = params.now ?? Date.now();
  const installedHash =
    params.installedHash ?? skillContentHash(params.skillDir);
  const suggestion: EvolutionSuggestion = {
    id: params.id,
    skillId: params.skillId,
    baselineHash: installedHash,
    ...(params.sourceSessionId !== undefined
      ? { sourceSessionId: params.sourceSessionId }
      : {}),
    ...(params.evolutionSessionId !== undefined
      ? { evolutionSessionId: params.evolutionSessionId }
      : {}),
    intent: params.intent,
    proposedChange: params.proposedChange,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ...(params.ttlMs !== undefined ? { expiresAt: now + params.ttlMs } : {}),
  };
  const store = loadStore(params.skillId);
  const next: SkillEvolutionStore = {
    ...store,
    installedHash,
    suggestions: [...store.suggestions, suggestion],
    updatedAt: now,
  };
  saveStore(next);
  return { store: next, suggestion };
}

/**
 * 推进一条提议的状态(from → to)。
 * 合法迁移则落盘;非法迁移抛 IllegalTransitionError(不静默)。
 * evolved 时打 evolvedAt。
 */
export function advance(
  skillId: string,
  suggestionId: string,
  to: SuggestionStatus,
  now: number = Date.now(),
): SkillEvolutionStore {
  const store = loadStore(skillId);
  const idx = store.suggestions.findIndex((s) => s.id === suggestionId);
  if (idx < 0) return store; // 找不到 → 原样返回(与 inbox markDelivered 找不到同处置)
  const cur = store.suggestions[idx];
  if (!cur) return store; // noUncheckedIndexedAccess 守卫
  transition(cur.status, to); // 非法则抛,不写盘
  const updated: EvolutionSuggestion = {
    ...cur,
    status: to,
    updatedAt: now,
    ...(to === 'evolved' ? { evolvedAt: now } : {}),
  };
  const suggestions = store.suggestions.map((s, i) => (i === idx ? updated : s));
  const next: SkillEvolutionStore = { ...store, suggestions, updatedAt: now };
  saveStore(next);
  return next;
}

/** 人手动弃一条提议(pending/starting/evolving → dismissed)。 */
export function dismiss(
  skillId: string,
  suggestionId: string,
  now: number = Date.now(),
): SkillEvolutionStore {
  return advance(skillId, suggestionId, 'dismissed', now);
}

/**
 * 把一条提议沿主链推进到 evolved(幂等)。
 *
 * 状态机不允许跳迁(pending → evolved 非法),而"应用一次进化"语义上就是
 * 把提议从任意可应用态推到终点。本函数逐步 advance 经过 starting/evolving,
 * 已达的中间态跳过 —— 使 applySuggestion 不必关心提议当前在第几步。
 * 仅对 pending/starting/evolving 有意义;其他态由调用方先做 ILLEGAL_STATE 判定。
 */
export function forceEvolve(
  skillId: string,
  suggestionId: string,
  now: number = Date.now(),
): SkillEvolutionStore {
  const cur = loadStore(skillId).suggestions.find((s) => s.id === suggestionId);
  if (!cur) return loadStore(skillId);
  if (cur.status === 'pending') advance(skillId, suggestionId, 'starting', now);
  const mid = loadStore(skillId).suggestions.find((s) => s.id === suggestionId);
  if (mid && mid.status === 'starting') advance(skillId, suggestionId, 'evolving', now);
  return advance(skillId, suggestionId, 'evolved', now);
}

/** reconcile:对齐技能当前指纹,把因技能漂移而失效的提议标记为 hash_invalidated。
 *
 * 对标 Qoder hash_invalidated:提议生效前技能被外部改动 → 提议自动作废,
 * 防止把过期改写盖到一个已漂移的技能上。返回被作废的提议 id 列表。
 * currentHash 缺省时自动算(调用方已算过可显式传,避免重复扫盘)。
 */
export function reconcile(
  skillId: string,
  skillDir: string,
  currentHash?: string,
  now: number = Date.now(),
): { store: SkillEvolutionStore; invalidatedIds: string[] } {
  const store = loadStore(skillId);
  const hash = currentHash ?? skillContentHash(skillDir);
  const invalidatedIds: string[] = [];
  const suggestions = store.suggestions.map((s) => {
    if (isHashInvalidated(s, hash) && s.status !== 'hash_invalidated') {
      invalidatedIds.push(s.id);
      return { ...s, status: 'hash_invalidated' as const, updatedAt: now };
    }
    return s;
  });
  const next: SkillEvolutionStore = {
    ...store,
    installedHash: hash,
    suggestions,
    updatedAt: now,
  };
  saveStore(next);
  return { store: next, invalidatedIds };
}

/** expirePending:把已过 expiresAt 的 pending 提议标记为 expired。
 *
 * 对标 Qoder expires_at / expiry_idx(WHERE status='pending')—— 只过期 pending,
 * 已启动进化的不因挂钟过期(进化进行中不该被打断)。
 */
export function expirePending(
  skillId: string,
  now: number = Date.now(),
): { store: SkillEvolutionStore; expiredIds: string[] } {
  const store = loadStore(skillId);
  const expiredIds: string[] = [];
  const suggestions = store.suggestions.map((s) => {
    if (
      s.status === 'pending' &&
      s.expiresAt !== undefined &&
      now > s.expiresAt
    ) {
      expiredIds.push(s.id);
      return { ...s, status: 'expired' as const, updatedAt: now };
    }
    return s;
  });
  if (expiredIds.length === 0) return { store, expiredIds };
  const next: SkillEvolutionStore = { ...store, suggestions, updatedAt: now };
  saveStore(next);
  return { store: next, expiredIds };
}

/** 取某技能仍活跃(可继续推进)的提议:pending/starting/evolving。
 * 可选传 currentHash 做指纹守卫:已漂移的(本应 invalidate)不返回 —— 调用方
 * 若没先 reconcile,这里兜底过滤,避免拿到过期提议去推进。
 */
export function activeSuggestions(
  skillId: string,
  currentHash?: string,
): EvolutionSuggestion[] {
  const store = loadStore(skillId);
  const activeStatuses: readonly SuggestionStatus[] = [
    'pending',
    'starting',
    'evolving',
  ];
  return store.suggestions.filter((s) => {
    if (!activeStatuses.includes(s.status)) return false;
    if (currentHash !== undefined && isHashInvalidated(s, currentHash)) return false;
    return true;
  });
}

/** 回收已终态(evolved/dismissed/expired/hash_invalidated)的提议,返回回收条数。
 *
 * 对标 Qoder cleanup_idx(WHERE evolution_session_id IS NULL AND status IN 终态)。
 * 只清终态,不动活跃提议(清了就丢进行中的进化)。
 */
export function compact(skillId: string): number {
  const store = loadStore(skillId);
  const before = store.suggestions.length;
  const terminal: readonly SuggestionStatus[] = [
    'evolved',
    'dismissed',
    'expired',
    'hash_invalidated',
  ];
  const dropped = store.suggestions.filter((s) => terminal.includes(s.status));
  const kept = store.suggestions.filter((s) => !terminal.includes(s.status));
  if (kept.length === before) return 0;
  // 硬删终态记录时逐条立碑:防止被删记录被迟到 apply / 重新 propose 复活
  // (对标 Qoder deletion_blocker:删了就记墓碑,复活前必先清碑)。
  for (const s of dropped) {
    markDeleted({ scope: 'skill-evolution', type: 'suggestion', id: s.id });
  }
  const next: SkillEvolutionStore = { ...store, suggestions: kept, updatedAt: Date.now() };
  saveStore(next);
  return before - kept.length;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
