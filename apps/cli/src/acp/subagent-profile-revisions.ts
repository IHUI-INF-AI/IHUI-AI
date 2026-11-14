// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent Profile Revisions — subagent/团队配置的版本链 + 执行时版本锁定。
 *
 * ## 前提基建(对标 Qoder agent_profile_revisions / team_definition_revisions)
 *
 * Qoder 的多 agent 执行有一个容易被当成"产品细节"而漏掉的通用机制:
 * **配置版本链 + 执行时版本锁定**。
 *
 *   CREATE TABLE agent_profile_revisions (
 *     revision_id   TEXT PRIMARY KEY,
 *     agent_profile_id TEXT NOT NULL,
 *     revision      INTEGER NOT NULL CHECK (revision > 0),
 *     snapshot_json TEXT NOT NULL,
 *     created_at    INTEGER NOT NULL,
 *     UNIQUE (agent_profile_id, revision)
 *   );
 *   -- team_definition_revisions 同构(revision + snapshot_json + UNIQUE(profile,revision))
 *   -- agent_team_executions.execution 引用 team_definition_revision_id(锁版本)
 *
 * 语义:每次 profile / 团队定义变更都生成一条**不可变快照**(snapshot_json + 单调
 * revision),而一次 agent 执行**引用某个 revision_id**。于是:
 *   - 即使 profile 之后被改,历史执行仍指向它当时用的那一版 → **可复现 / 可审计**
 *   - 同一 profile 可并列多个版本,UNIQUE(profile_id, revision) 保证单调不冲突
 *   - 团队定义通过 leader_agent_profile_revision_id 精确指向某版 leader 配置
 *
 * ## 我方承接点(为什么这是真缺口)
 *
 * 我方 `tools/subagent.ts` 的 `PERSONAS` 是**静态常量 `Record<SubagentPersona, PersonaConfig>`** ——
 * profile 无版本、无快照、无历史。并行/协作派发时用的是"此刻的常量",若常量被改,
 * 历史派发无法复现(不知道当时用的是哪版配置)。
 *
 * 本模块把版本链抽成独立可复用层:任何 `snapshot`(profile / 团队定义 / 将来的
 * 其他配置)都能建链、取最新、按版本取、按 revision_id 取 —— 供执行侧锁定。
 *
 * ## 做减法
 *
 *   - 存储每链一个 JSON(`~/.ihui/profile-revisions/<chainId>.json`),不引 SQLite
 *   - 原子写 + 版本校验 + 损坏回落空态(与 turn-store / inbox / skill-evolution 同处置)
 *   - revision 单调自增,UNIQUE(profile,revision) 用"取 max+1"保证
 *   - 快照不可变:已写入的 revision 永不修改(只追加),这是"可复现"的根基
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { segmentFilePathInside } from '../util/path-guard.js';

/** 一条不可变的配置版本快照(对标 Qoder agent_profile_revisions 一行)。 */
export interface ProfileRevision {
  /** 版本身份(全局唯一,执行侧引用它来锁定"用哪版配置")。 */
  readonly revisionId: string;
  /** 这条版本属于哪个配置链(如某个 profile / 团队定义的 id)。 */
  readonly chainId: string;
  /** 链内单调递增版本号(1 基,UNIQUE(chainId, revision))。 */
  readonly revision: number;
  /** 配置快照(整份 JSON;写入后永不修改 —— 可复现的根基)。 */
  readonly snapshotJson: string;
  readonly createdAt: number;
}

/** 一个配置链的版本注册表(对标 Qoder 按 agent_profile_id 聚合的 revisions)。 */
export interface RevisionChain {
  readonly chainId: string;
  readonly revisions: readonly ProfileRevision[];
  readonly updatedAt: number;
}

// ─────────────────────────────────────────────────────────────
// 存储:每链一个 JSON(原子写 + 版本校验 + 损坏回落空态)
// ─────────────────────────────────────────────────────────────

const STORE_VERSION = 1;

interface ChainFile {
  version: number;
  chainId: string;
  revisions: ProfileRevision[];
  updatedAt: number;
}

function storeDir(): string {
  if (process.env.IHUI_CLI_PROFILE_REVISIONS_DIR) {
    return process.env.IHUI_CLI_PROFILE_REVISIONS_DIR;
  }
  return path.join(os.homedir(), '.ihui', 'profile-revisions');
}

function chainFile(chainId: string): string {
  return segmentFilePathInside(storeDir(), chainId, '.json', '配置版本链文件');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** 原子写(临时文件 + rename,防半截 JSON;与 turn-store / inbox / skill-evolution 同处置)。 */
function writeJsonAtomic(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** 读一个配置链。不存在/损坏/版本不符 → 空态(不抛、不静默覆盖)。 */
export function loadChain(chainId: string): RevisionChain {
  const file = chainFile(chainId);
  if (!fs.existsSync(file)) {
    return { chainId, revisions: [], updatedAt: 0 };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as ChainFile;
    if (raw.version !== STORE_VERSION || !Array.isArray(raw.revisions)) {
      return { chainId, revisions: [], updatedAt: 0 };
    }
    return {
      chainId: raw.chainId,
      revisions: raw.revisions,
      updatedAt: raw.updatedAt ?? 0,
    };
  } catch {
    return { chainId, revisions: [], updatedAt: 0 };
  }
}

function saveChain(chain: RevisionChain): void {
  const payload: ChainFile = {
    version: STORE_VERSION,
    chainId: chain.chainId,
    revisions: [...chain.revisions],
    updatedAt: Date.now(),
  };
  writeJsonAtomic(chainFile(chain.chainId), payload);
}

// ─────────────────────────────────────────────────────────────
// 版本链操作:建版(不可变追加)+ 取版本
// ─────────────────────────────────────────────────────────────

/** 建版结果:新建 or 复用既有(快照未变时幂等)。 */
export type CommitResult =
  | { created: true; revision: ProfileRevision; chain: RevisionChain }
  | { created: false; revision: ProfileRevision; chain: RevisionChain };

/**
 * 提交一版配置快照。
 *
 * - revision = 链内当前 max + 1(单调,UNIQUE(chainId,revision) 由此保证)
 * - **快照内容未变则复用最新版**(幂等):不因重复提交同内容而刷版本号,
 *   这样"每次执行都锁一次版"不会制造版本噪声。
 * - 已写入的 revision 永不修改(只追加)—— 可复现的根基。
 *
 * @param chainId  配置链 id(如 profile id / 团队定义 id)
 * @param snapshot 配置对象(将被稳定序列化成 snapshotJson)
 */
export function commitRevision(params: {
  chainId: string;
  snapshot: unknown;
  now?: number;
}): CommitResult {
  const now = params.now ?? Date.now();
  const snapshotJson = stableStringify(params.snapshot);
  const chain = loadChain(params.chainId);

  // 幂等:快照内容未变 → 复用最新版,不刷版本号
  const latest = latestRevision(params.chainId);
  if (latest && latest.snapshotJson === snapshotJson) {
    return { created: false, revision: latest, chain };
  }

  const nextRevision =
    chain.revisions.reduce((n, r) => Math.max(n, r.revision), 0) + 1;
  const revision: ProfileRevision = {
    revisionId: `${params.chainId}@r${nextRevision}`,
    chainId: params.chainId,
    revision: nextRevision,
    snapshotJson,
    createdAt: now,
  };
  const next: RevisionChain = {
    ...chain,
    revisions: [...chain.revisions, revision],
    updatedAt: now,
  };
  saveChain(next);
  return { created: true, revision, chain: next };
}

/** 取某链最新一版(无版本 → undefined)。 */
export function latestRevision(chainId: string): ProfileRevision | undefined {
  const revisions = loadChain(chainId).revisions;
  if (revisions.length === 0) return undefined;
  return revisions.reduce((a, b) => (b.revision > a.revision ? b : a));
}

/** 取某链指定版本号(无 → undefined)。 */
export function revisionAt(
  chainId: string,
  revision: number,
): ProfileRevision | undefined {
  return loadChain(chainId).revisions.find((r) => r.revision === revision);
}

/** 按 revisionId 精确取一版(跨链查找;执行侧引用 revision_id 时用)。
 *
 * revisionId 形如 `<chainId>@r<N>`,解析出链 id 与版本号后定位。
 * 找不到 → undefined。
 */
export function revisionById(
  revisionId: string,
): ProfileRevision | undefined {
  const at = revisionId.lastIndexOf('@r');
  if (at < 0) return undefined;
  const chainId = revisionId.slice(0, at);
  const revision = Number.parseInt(revisionId.slice(at + 2), 10);
  if (!Number.isInteger(revision) || revision <= 0) return undefined;
  const hit = revisionAt(chainId, revision);
  // 校验 revisionId 一致(防解析出错的链/版本号拼错)
  return hit && hit.revisionId === revisionId ? hit : undefined;
}

/**
 * 锁版执行包装器:取(或建)当前最新版,用**快照里的配置**执行 fn,返回结果 + 用的哪版。
 *
 * 这是"执行时版本锁定"的落地:无论调用方传什么,实际执行用的是**锁定的那一版快照**,
 * 并把 revisionId 记进结果 —— 历史执行可复现(知道用的是哪版配置)。
 *
 * @param chainId 配置链 id
 * @param fn      用解析后的配置执行;配置从 snapshotJson 反序列化(保证是锁定版内容)
 */
export function withLockedRevision<T>(params: {
  chainId: string;
  snapshot: unknown;
  fn: (config: unknown, revisionId: string) => T;
  now?: number;
}): { result: T; revisionId: string; revision: number } {
  const { revision } = commitRevision({
    chainId: params.chainId,
    snapshot: params.snapshot,
    now: params.now,
  });
  const config = JSON.parse(revision.snapshotJson) as unknown;
  return {
    result: params.fn(config, revision.revisionId),
    revisionId: revision.revisionId,
    revision: revision.revision,
  };
}

// ─────────────────────────────────────────────────────────────
// 稳定序列化(快照不可变的根基:同语义 → 同 snapshotJson)
// ─────────────────────────────────────────────────────────────

/** 稳定序列化:对象键排序、剔 undefined,数组保序(与 workspace-receipts 同语义)。 */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
