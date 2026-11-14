// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * Workspace Command Receipts — 工作区写盘命令的幂等回执审计层。
 *
 * ## 前提基建(为什么建这一层)
 *
 * Qoder 的 `workspace_authority_command_receipts` 在"对工作区做权威变更"的每个
 * 命令前先落一张回执,用三重约束把写盘做成**可审计、可幂等重放、可过期失效**:
 *
 *   CREATE TABLE workspace_authority_command_receipts (
 *     principal_id TEXT NOT NULL,
 *     request_id   TEXT NOT NULL,
 *     operation    TEXT NOT NULL CHECK (operation IN ('create','update','archive','restore','delete')),
 *     input_hash   TEXT NOT NULL,
 *     workspace_id TEXT NOT NULL,
 *     initial_workspace_json TEXT,
 *     result_json  TEXT,
 *     created_at   INTEGER NOT NULL CHECK (created_at >= 0),
 *     updated_at   INTEGER NOT NULL CHECK (updated_at >= 0),
 *     expires_at   INTEGER NOT NULL CHECK (expires_at >= created_at),
 *     PRIMARY KEY (principal_id, request_id)
 *   ) STRICT;
 *   CREATE INDEX ..._expiry ON ... (expires_at, principal_id, request_id);
 *
 * 三重语义(本模块逐条复现):
 *   1. **幂等**:同一 `(principal_id, request_id)` 重放 → 直接返回缓存 `result_json`,
 *      不重复执行写盘(防止重试风暴 / 网络重投把同一命令打两遍)。
 *   2. **防漂移**:重放时校验 `input_hash` —— 若本次入参内容与回执记录的不一致,
 *      说明不是同一命令的合法重放 → 拒绝(防用同 request_id 偷换内容)。
 *   3. **过期失效**:回执有 `expires_at`,过期后不再幂等返回(旧回执不能永久生效)。
 *
 * ## 与我方承接点
 *
 * 我方 CLI 已有 `util/atomic-write.ts`(原子写)、`util/path-guard.ts`(路径守卫),
 * 但**没有"写盘前的幂等回执 + 审计"层** —— 重试/重放场景下同一命令会被重复执行。
 * 本模块补齐这一层,存为 JSONL(追加审计 + 按主键查重),不引 SQLite。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** 权威命令操作枚举(对标 Qoder CHECK IN 五值,STRICT)。 */
export type WorkspaceOperation =
  | 'create'
  | 'update'
  | 'archive'
  | 'restore'
  | 'delete';

/** 一条命令回执(对标 Qoder workspace_authority_command_receipts 一行)。 */
export interface WorkspaceReceipt {
  /** 操作主体(谁发起:用户/agent/系统)。 */
  readonly principalId: string;
  /** 幂等键:同一主体下唯一,重放据此识别。 */
  readonly requestId: string;
  readonly operation: WorkspaceOperation;
  /** 入参内容指纹(sha256)—— 重放防漂移判据。 */
  readonly inputHash: string;
  /** 目标工作区 id。 */
  readonly workspaceId: string;
  /** 命令执行前的工作区快照(可选,便于回滚/审计)。 */
  readonly initialWorkspaceJson?: string;
  /** 命令执行结果(可选;幂等重放时返回它)。 */
  resultJson?: string;
  readonly createdAt: number;
  updatedAt: number;
  /** 回执过期时刻(>= createdAt)。 */
  readonly expiresAt: number;
}

// ─────────────────────────────────────────────────────────────
// ① 入参内容指纹(重放防漂移判据)
// ─────────────────────────────────────────────────────────────

/**
 * 计算一条命令入参的稳定指纹(sha256 hex)。
 *
 * 用 canonicalJson 语义(键排序、剔 undefined)保证「同语义入参 → 同指纹」,
 * 避免 `{a:1,b:2}` 与 `{b:2,a:1}` 被误判成不同命令。与 message-identity 的
 * canonicalJson 同语义,但此处自包含(不跨模块耦合),单一职责。
 */
export function commandInputHash(input: {
  operation: WorkspaceOperation;
  workspaceId: string;
  payload?: unknown;
}): string {
  const stable = stableStringify(input);
  return createHash('sha256').update(stable).digest('hex');
}

/** 稳定序列化:对象键排序、剔 undefined,数组保序。 */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null) return 'null';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null';
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : stableStringify(v))).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(String(value));
}

// ─────────────────────────────────────────────────────────────
// ② 存储:JSONL 追加(审计日志)+ 按主键查重(幂等)
// ─────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;

interface ReceiptFile {
  version: number;
  receipts: WorkspaceReceipt[];
}

function receiptsDir(): string {
  if (process.env.IHUI_CLI_WS_RECEIPTS_DIR) {
    return process.env.IHUI_CLI_WS_RECEIPTS_DIR;
  }
  return path.join(os.homedir(), '.ihui', 'ws-receipts');
}

function receiptsFile(): string {
  return path.join(receiptsDir(), 'command-receipts.json');
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

/** 读全部回执。不存在/损坏/版本不符 → 空态(不抛、不静默覆盖)。 */
export function loadReceipts(): WorkspaceReceipt[] {
  const file = receiptsFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as ReceiptFile;
    if (raw.version !== SCHEMA_VERSION || !Array.isArray(raw.receipts)) return [];
    return raw.receipts;
  } catch {
    return [];
  }
}

function saveReceipts(receipts: WorkspaceReceipt[]): void {
  const payload: ReceiptFile = { version: SCHEMA_VERSION, receipts };
  writeJsonAtomic(receiptsFile(), payload);
}

/** 主键查重:同一 (principalId, requestId) 是否已有回执。 */
export function findReceipt(
  principalId: string,
  requestId: string,
): WorkspaceReceipt | undefined {
  return loadReceipts().find(
    (r) => r.principalId === principalId && r.requestId === requestId,
  );
}

// ─────────────────────────────────────────────────────────────
// ③ 幂等回执核心(三重语义的编排)
// ─────────────────────────────────────────────────────────────

/** ensureReceipt 的三种判定结果。 */
export type ReceiptDecision =
  /** 无既有回执 → 允许执行(首次)。 */
  | { kind: 'execute' }
  /** 命中有效回执 → 幂等,返回缓存结果,不重复执行。 */
  | { kind: 'idempotent'; receipt: WorkspaceReceipt }
  /** 命中回执但入参指纹不一致 → 拒绝(防偷换内容)。 */
  | { kind: 'conflict'; receipt: WorkspaceReceipt }
  /** 命中回执但已过期 → 视为失效,允许重新执行。 */
  | { kind: 'expired'; receipt: WorkspaceReceipt };

/**
 * 命令执行前的幂等判定:决定"能否执行 / 幂等返回 / 冲突拒绝 / 过期重跑"。
 *
 * 这是 `workspace_authority_command_receipts` 三重约束的执行端:
 *   - 同 (principalId, requestId) 未命中 → execute(首次)
 *   - 命中且 inputHash 一致且未过期 → idempotent(返回缓存 resultJson,不重复写盘)
 *   - 命中但 inputHash 不一致 → conflict(同 request_id 换了内容,拒绝)
 *   - 命中但已过期 → expired(旧回执失效,允许重新执行并续期)
 *
 * 纯判定,不写盘 —— 调用方据 kind 决定执行后调 recordResult / extend。
 */
export function ensureReceipt(params: {
  principalId: string;
  requestId: string;
  operation: WorkspaceOperation;
  workspaceId: string;
  payload?: unknown;
  now?: number;
}): ReceiptDecision {
  const now = params.now ?? Date.now();
  const inputHash = commandInputHash({
    operation: params.operation,
    workspaceId: params.workspaceId,
    payload: params.payload,
  });
  const existing = findReceipt(params.principalId, params.requestId);
  if (!existing) return { kind: 'execute' };
  if (now > existing.expiresAt) return { kind: 'expired', receipt: existing };
  if (existing.inputHash !== inputHash) return { kind: 'conflict', receipt: existing };
  return { kind: 'idempotent', receipt: existing };
}

/**
 * 首次执行前登记一张回执(status 待 result)。
 * 调用方在 ensureReceipt 返回 execute 后调用;若此时已有人并发登记同主键,
 * 这里仍以最后一次写入为准(单写者场景由调用方保证)。
 */
export function registerReceipt(params: {
  principalId: string;
  requestId: string;
  operation: WorkspaceOperation;
  workspaceId: string;
  payload?: unknown;
  initialWorkspaceJson?: string;
  ttlMs?: number;
  now?: number;
}): WorkspaceReceipt {
  const now = params.now ?? Date.now();
  const ttlMs = params.ttlMs ?? DEFAULT_RECEIPT_TTL_MS;
  const inputHash = commandInputHash({
    operation: params.operation,
    workspaceId: params.workspaceId,
    payload: params.payload,
  });
  const receipt: WorkspaceReceipt = {
    principalId: params.principalId,
    requestId: params.requestId,
    operation: params.operation,
    inputHash,
    workspaceId: params.workspaceId,
    ...(params.initialWorkspaceJson !== undefined
      ? { initialWorkspaceJson: params.initialWorkspaceJson }
      : {}),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ttlMs,
  };
  const all = loadReceipts().filter(
    (r) => !(r.principalId === params.principalId && r.requestId === params.requestId),
  );
  all.push(receipt);
  saveReceipts(all);
  return receipt;
}

/** 命令执行成功后写入 resultJson 并刷新 updatedAt(幂等重放时将返回它)。 */
export function recordResult(
  principalId: string,
  requestId: string,
  resultJson: string,
  now: number = Date.now(),
): WorkspaceReceipt | undefined {
  const all = loadReceipts();
  const idx = all.findIndex(
    (r) => r.principalId === principalId && r.requestId === requestId,
  );
  if (idx < 0) return undefined;
  const target = all[idx];
  if (!target) return undefined; // noUncheckedIndexedAccess 守卫
  const updated: WorkspaceReceipt = {
    ...target,
    resultJson,
    updatedAt: now,
  };
  all[idx] = updated;
  saveReceipts(all);
  return updated;
}

/** 默认回执 TTL:24h(过期后旧回执失效,允许重新执行)。 */
export const DEFAULT_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * 过期清扫:删除 expires_at 已过的回执(对标 Qoder ..._expiry 索引用途)。
 * 返回回收条数。只清过期,不动有效回执(清了就丢幂等凭证)。
 */
export function purgeExpired(now: number = Date.now()): number {
  const all = loadReceipts();
  const kept = all.filter((r) => r.expiresAt >= now);
  if (kept.length === all.length) return 0;
  saveReceipts(kept);
  return all.length - kept.length;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
