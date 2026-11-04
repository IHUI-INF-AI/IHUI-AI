// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多文件原子编辑工具 — batch_edit / batch_undo / batch_preview。
 *
 * 对标 OpenClaw multi-file atomic edit:
 *   - batch_edit: 多文件事务性提交(atomic=true 默认),任一失败回滚所有已执行操作
 *   - batch_undo: 根据 checkpointId 回滚之前的 batch_edit
 *   - batch_preview: 只生成 unified diff 预览,不实际写入
 *
 * Checkpoint 机制:.ihui/batch-checkpoints/<uuid>/ 目录存储原始文件副本 + manifest.json
 * 路径安全:禁止路径穿越(../)+ 禁止写入工作区外
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import { type Tool, type ToolResult, checkPathWritePermission } from './index.js';
import { computeUnifiedDiff, type EditToolContext } from './file-edit.js';
import type { BatchEditOperation, BatchEditResult } from '@ihui/types';
import { tryParseJson, isRecord, isJsonArray } from '../util/json.js';
// 删除保护链判据唯一真相源(goal-b49 W1-① 复现+超越:回收站 + 批量两阶段护栏 check/approve)
// —— 本端只补 IO adapter(摘要/搬运/状态目录/报告),阈值与对账判据全在 @ihui/shared/delete-guard(§0.6)。
import {
  evaluateBulkDelete,
  evaluateBulkThreshold,
  flattenTrashName,
  findTrashEntry,
  isSafeIdSegment,
  isTrashManifestShape,
  TRASH_MANIFEST_KIND,
  type BulkDeleteDecision,
  type DeleteCandidate,
  type TrashManifest,
  type TrashManifestEntry,
} from '@ihui/shared/delete-guard';

// ==================== Checkpoint 机制 ====================

const CHECKPOINT_BASE_DIR = '.ihui';
const CHECKPOINT_SUBDIR = 'batch-checkpoints';
const MAX_OPERATIONS = 100;

/** Checkpoint 清单元数据(文件维度,非操作维度) */
interface CheckpointManifest {
  id: string;
  createdAt: string;
  workspacePath: string;
  files: Array<{
    /** 绝对路径 */
    filePath: string;
    /** 相对工作区的路径 */
    relativePath: string;
    /** 操作前文件是否存在 */
    existedBefore: boolean;
    /** 备份文件路径(existedBefore=true 时有值) */
    backupPath?: string;
  }>;
}

function getCheckpointDir(workspacePath: string, checkpointId: string): string {
  return path.join(workspacePath, CHECKPOINT_BASE_DIR, CHECKPOINT_SUBDIR, checkpointId);
}

// ==================== 路径安全 ====================

/** 验证相对路径不含 .. 穿越,非绝对路径 */
function validateRelativePath(relPath: string): boolean {
  if (!relPath || typeof relPath !== 'string') return false;
  if (path.isAbsolute(relPath)) return false;
  const normalized = path.normalize(relPath);
  if (normalized === '.') return false;
  const segments = normalized.split(path.sep);
  if (segments.includes('..')) return false;
  return true;
}

/** 验证绝对路径在工作区内(不含工作区根本身) */
function isPathWithinWorkspace(absPath: string, workspacePath: string): boolean {
  const normalized = path.normalize(absPath);
  const wsNormalized = path.normalize(workspacePath);
  if (normalized === wsNormalized) return false;
  return normalized.startsWith(wsNormalized + path.sep);
}

// ==================== 删除保护链 adapter(回收站 + 两阶段护栏落地) ====================

/** 回收站相对落点根(与 `.ihui/batch-checkpoints` 同一条工作区卫生纪律,§15) */
const DELETE_TRASH_REL = path.join('.ihui', 'delete-trash');
/** 护栏状态目录:四件分离之"状态目录 + 重放文件"(check 相签发的凭据在此可凭 scanId 取回) */
const DELETE_GUARD_STATE_REL = path.join('.ihui', 'delete-guard', 'state');
/** 护栏报告路径:与状态目录分离,仅在 approve 相对账通过并执行后追加一条 */
const DELETE_GUARD_REPORT_REL = path.join('.ihui', 'delete-guard', 'report.jsonl');

/** 回收站根目录(绝对) */
export function getDeleteTrashDir(workspacePath: string): string {
  return path.join(workspacePath, DELETE_TRASH_REL);
}

/** 摘要函数的端内实现:sha256 hex(判据层不碰 node:crypto,由这里注入) */
function sha256Digest(canonical: string): string {
  return crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

/** 扫描删除候选(读取失败返回 null ⇒ 上层判 undetermined,不猜空集) */
function scanDeleteCandidates(list: readonly ValidatedOp[]): DeleteCandidate[] | null {
  try {
    return list.map((v) => {
      let sizeBytes: number | null = null;
      try {
        sizeBytes = fs.statSync(v.abs).size;
      } catch {
        sizeBytes = null;
      }
      return { path: v.op.filePath.split(path.sep).join('/'), sizeBytes };
    });
  } catch {
    return null;
  }
}

function writeTrashManifest(workspacePath: string, manifest: TrashManifest): void {
  const dir = path.join(getDeleteTrashDir(workspacePath), manifest.trashId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
}

/** 单文件回收搬运:先复制进回收站、再删原文件;复制失败即抛出 ⇒ 删除不发生(副作用未起) */
function stashFileToTrash(
  workspacePath: string,
  abs: string,
  trashId: string,
  seq: number,
): TrashManifestEntry {
  const rel = path.relative(workspacePath, abs) || path.basename(abs);
  const flat = flattenTrashName(rel, seq);
  const trashDir = path.join(getDeleteTrashDir(workspacePath), trashId);
  fs.mkdirSync(trashDir, { recursive: true });
  let sizeBytes: number | null = null;
  try {
    sizeBytes = fs.statSync(abs).size;
  } catch {
    sizeBytes = null;
  }
  fs.copyFileSync(abs, path.join(trashDir, flat));
  fs.unlinkSync(abs);
  return { originalPath: abs, relativeTrashPath: flat, sizeBytes, kind: 'file' };
}

function replayFileNameOf(scanId: string): string {
  return `pending-${scanId}.json`;
}

/**
 * batch_edit 删除路径的两阶段护栏:扫描 → 阈值判定 → (达阈值)approve 相对账。
 * - check 相(未带回传凭据):签发本次扫描凭据并重放文件写入状态目录,返回 blocked
 * - approve 相按 scanId 回传:从状态目录取回凭据;取不到 ⇒ undetermined(§0.3 不记绿)
 * - approve 相按完整凭据 JSON 回传:直接与本次重扫对账
 */
function runBulkDeleteGuard(
  workspacePath: string,
  deleteOps: readonly ValidatedOp[],
  ticketRaw: unknown,
): BulkDeleteDecision {
  const candidates = scanDeleteCandidates(deleteOps);
  const fallbackBase = evaluateBulkThreshold(candidates ?? [], { expectedCount: deleteOps.length });
  const base = candidates === null
    ? { ...fallbackBase, verdict: 'undetermined' as const, reason: '删除候选扫描失败:未判定不记绿' }
    : fallbackBase;
  if (base.verdict === 'undetermined') return base;

  let ticketInput: unknown = ticketRaw;
  if (typeof ticketRaw === 'string' && ticketRaw.length > 0 && !ticketRaw.trim().startsWith('{')) {
    // scanId 重放相
    if (!isSafeIdSegment(ticketRaw)) {
      return { ...base, verdict: 'blocked', reason: `approve 回传的 scanId 形态不合法: ${String(ticketRaw).slice(0, 40)}` };
    }
    const replayPath = path.join(workspacePath, DELETE_GUARD_STATE_REL, replayFileNameOf(ticketRaw));
    try {
      ticketInput = fs.readFileSync(replayPath, 'utf-8');
    } catch {
      return {
        ...base,
        verdict: 'undetermined',
        reason: `approve 重放凭据读取不到(${ticketRaw}):未判定不记绿,请重新 check`,
      };
    }
  }

  const decision = evaluateBulkDelete({
    candidates: candidates ?? [],
    digest: sha256Digest,
    scanId: crypto.randomUUID(),
    nowIso: new Date().toISOString(),
    ticketInput,
    expectedCount: deleteOps.length,
  });

  if (decision.verdict === 'blocked' && decision.ticket) {
    try {
      const stateDir = path.join(workspacePath, DELETE_GUARD_STATE_REL);
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(
        path.join(stateDir, replayFileNameOf(decision.ticket.scanId)),
        JSON.stringify(decision.ticket),
        'utf-8',
      );
    } catch {
      // 重放文件写不进不改变判定:approve 仍可凭 check 相输出里的完整凭据 JSON 内联回传
    }
  }
  return decision;
}

/**
 * 恢复出口(回收站 → 原位):manifest 形态坏 / 条目缺失 /  Trash 件丢失 ⇒ 一律抛错点名,
 * 不静默不硬试。文件按复制恢复(保留回收站原件),目录按 rename 归位。
 */
export function restoreTrashEntry(workspacePath: string, trashId: string, originalPath: string): string {
  if (!isSafeIdSegment(trashId)) {
    throw new Error(`恢复拒绝:trashId 形态不合法(${String(trashId).slice(0, 40)})`);
  }
  const dir = path.join(getDeleteTrashDir(workspacePath), trashId);
  const manifestPath = path.join(dir, 'manifest.json');
  let manifest: TrashManifest;
  try {
    const parsed = tryParseJson(fs.readFileSync(manifestPath, 'utf-8'));
    if (!isTrashManifestShape(parsed)) {
      throw new Error(`结构不合法`);
    }
    manifest = parsed;
  } catch (err) {
    throw new Error(
      `恢复拒绝:回收站清单读取不到或形态不合法(${err instanceof Error ? err.message : String(err)}),不硬试`,
    );
  }
  const entry = findTrashEntry(manifest, originalPath);
  if (!entry) throw new Error(`恢复拒绝:该 trashId(${trashId})下无 ${originalPath} 的条目`);
  const trashPath = path.join(dir, entry.relativeTrashPath);
  if (!fs.existsSync(trashPath)) {
    throw new Error(`恢复拒绝:回收站件丢失 ${entry.relativeTrashPath}(未判定不静默)`);
  }
  if (entry.kind === 'directory') {
    if (fs.existsSync(entry.originalPath)) {
      throw new Error(`恢复拒绝:原路径 ${entry.originalPath} 已存在,不覆盖现网现场`);
    }
    fs.mkdirSync(path.dirname(entry.originalPath), { recursive: true });
    fs.renameSync(trashPath, entry.originalPath);
  } else {
    fs.mkdirSync(path.dirname(entry.originalPath), { recursive: true });
    fs.copyFileSync(trashPath, entry.originalPath);
  }
  return entry.originalPath;
}

/**
 * 单文件删除的护栏腿(delete_file 工具用):判定 + 回收站搬运 + 独立 manifest。
 * 任何非 clean 判定 ⇒ 抛错,调用方转成失败返回 ⇒ 副作用未发生。
 */
export function recycleDeleteSingleFile(workspacePath: string, abs: string): void {
  let sizeBytes: number | null = null;
  try {
    sizeBytes = fs.statSync(abs).size;
  } catch {
    sizeBytes = null;
  }
  const rel = path.relative(workspacePath, abs).split(path.sep).join('/') || path.basename(abs);
  const decision = evaluateBulkDelete({
    candidates: [{ path: rel, sizeBytes }],
    digest: sha256Digest,
    scanId: crypto.randomUUID(),
    nowIso: new Date().toISOString(),
    expectedCount: 1,
  });
  if (decision.verdict !== 'clean') {
    throw new Error(`删除被护栏拒绝(${decision.verdict}):${decision.reason ?? '未判定不记绿'}`);
  }
  const trashId = crypto.randomUUID();
  const entry = stashFileToTrash(workspacePath, abs, trashId, 0);
  writeTrashManifest(workspacePath, {
    kind: TRASH_MANIFEST_KIND,
    trashId,
    createdAtIso: new Date().toISOString(),
    workspacePath,
    entries: [entry],
  });
}

/**
 * 目录整体回收(worktree 兜底腿用):同盘 rename 可逆 ⇒ 现场可恢复。
 * Windows 句柄占用时 renameSync 会抛(EBUSY/EPERM),调用方据此回落 rmSync —— 该兜底腿不得摘除。
 */
export function stashDirToTrash(workspacePath: string, absDir: string, label: string): string {
  const trashId = crypto.randomUUID();
  const safeLabel = (label.replace(/[^A-Za-z0-9._-]/g, '_') || 'dir').slice(0, 60);
  const trashPath = path.join(getDeleteTrashDir(workspacePath), trashId, safeLabel);
  fs.mkdirSync(path.dirname(trashPath), { recursive: true });
  fs.renameSync(absDir, trashPath);
  writeTrashManifest(workspacePath, {
    kind: TRASH_MANIFEST_KIND,
    trashId,
    createdAtIso: new Date().toISOString(),
    workspacePath,
    entries: [{ originalPath: absDir, relativeTrashPath: safeLabel, sizeBytes: null, kind: 'directory' }],
  });
  return trashPath;
}

/** approve 相对账通过后的报告腿(四件分离之"报告",与状态目录/重放文件互不混写) */
function appendGuardReport(workspacePath: string, line: Record<string, unknown>): void {
  const reportPath = path.join(workspacePath, DELETE_GUARD_REPORT_REL);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.appendFileSync(reportPath, `${JSON.stringify(line)}\n`, 'utf-8');
}

// ==================== 操作验证与执行 ====================

interface ValidatedOp {
  op: BatchEditOperation;
  abs: string;
  exists: boolean;
  error?: string;
}

/** 预检:验证单个操作 */
function validateOp(op: BatchEditOperation, ctx: EditToolContext): ValidatedOp {
  if (!op.filePath || typeof op.filePath !== 'string') {
    return { op, abs: '', exists: false, error: 'filePath 缺失或非字符串' };
  }
  if (op.type !== 'create' && op.type !== 'update' && op.type !== 'delete') {
    return { op, abs: '', exists: false, error: `未知操作类型: ${String(op.type)}` };
  }
  if (!validateRelativePath(op.filePath)) {
    return { op, abs: '', exists: false, error: `路径不合法(含 .. 或绝对路径): ${op.filePath}` };
  }
  const abs = path.resolve(ctx.workspacePath, op.filePath);
  if (!isPathWithinWorkspace(abs, ctx.workspacePath)) {
    return { op, abs, exists: false, error: `路径越界(工作区外): ${op.filePath}` };
  }
  const perm = checkPathWritePermission(op.filePath, ctx);
  if (!perm.allowed) {
    return { op, abs, exists: false, error: perm.reason };
  }
  if ((op.type === 'create' || op.type === 'update') && op.content === undefined) {
    return { op, abs, exists: false, error: `${op.type} 操作缺少 content: ${op.filePath}` };
  }
  const exists = fs.existsSync(abs);
  if (exists && fs.statSync(abs).isDirectory()) {
    return { op, abs, exists, error: `目标是目录不是文件: ${op.filePath}` };
  }
  if (op.type === 'update' && !exists) {
    return { op, abs, exists, error: `update 操作目标文件不存在: ${op.filePath}` };
  }
  if (op.type === 'delete' && !exists) {
    return { op, abs, exists, error: `delete 操作目标文件不存在: ${op.filePath}` };
  }
  return { op, abs, exists };
}

/** 解码内容(base64 → Buffer,utf-8 → string) */
function decodeContent(op: BatchEditOperation): string | Buffer {
  const encoding = op.encoding ?? 'utf-8';
  const content = op.content ?? '';
  if (encoding === 'base64') {
    return Buffer.from(content, 'base64');
  }
  return content;
}

/** 执行单个操作(已预检 + 已过两阶段护栏)。delete 走回收站搬运,不做不可逆直删 */
function applyOp(
  v: ValidatedOp,
  workspacePath: string,
  trash: { id: string; entries: TrashManifestEntry[] },
): void {
  const { op, abs } = v;
  if (op.type === 'delete') {
    trash.entries.push(stashFileToTrash(workspacePath, abs, trash.id, trash.entries.length));
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const content = decodeContent(op);
  if (typeof content === 'string') {
    fs.writeFileSync(abs, content, 'utf-8');
  } else {
    fs.writeFileSync(abs, content);
  }
}

/** 生成单个操作的 unified diff 预览 */
function diffForOp(v: ValidatedOp): string {
  const { op, abs, exists } = v;
  if (op.type === 'delete') {
    if (!exists) return '';
    const original = fs.readFileSync(abs, 'utf-8');
    return computeUnifiedDiff(original, '', op.filePath);
  }
  if (op.type === 'create') {
    const content = op.encoding === 'base64' ? '(base64 内容)' : (op.content ?? '');
    return computeUnifiedDiff('', content, op.filePath);
  }
  // update
  if (!exists) return '';
  const original = fs.readFileSync(abs, 'utf-8');
  const content = op.encoding === 'base64' ? '(base64 内容)' : (op.content ?? '');
  return computeUnifiedDiff(original, content, op.filePath);
}

// ==================== batch_edit 工具 ====================

export function createBatchEditTool(ctx: EditToolContext): Tool {
  return {
    name: 'batch_edit',
    description:
      '多文件原子编辑(事务性提交)。参数:operations(操作数组),atomic(默认 true,任一失败回滚),dryRun(只预览不写入),confirm(delete 操作或 atomic=false 时需 true),bulkApproveTicket(删除候选 ≥20 时两阶段护栏 approve 相凭据,需先 check 再回传)。返回 BatchEditResult JSON。',
    dangerLevel: 'write',
    parameters: {
      operations: {
        type: 'array',
        description: '操作数组,每项 {type:"create"|"update"|"delete", filePath:"相对路径", content?, encoding?}',
        items: {
          type: 'object',
          description: '单个文件操作',
          properties: {
            type: { type: 'string', description: 'create | update | delete' },
            filePath: { type: 'string', description: '相对工作区根目录的路径' },
            content: { type: 'string', description: '文件内容(create/update 必填)' },
            encoding: { type: 'string', description: 'utf-8(默认) | base64' },
          },
        },
      },
      atomic: { type: 'boolean', description: 'true=全部成功才提交,任一失败回滚(默认 true)' },
      dryRun: { type: 'boolean', description: 'true=只返回 diff 预览,不实际写入(默认 false)' },
      confirm: { type: 'boolean', description: 'atomic=false 或含 delete 操作时需 true' },
      bulkApproveTicket: {
        type: 'string',
        description:
          '两阶段护栏 approve 相凭据:删除候选数 ≥ 阈值(默认 20)时必填,回传 check 相输出的完整扫描凭据 JSON 或其 scanId(从状态目录重放)',
      },
    },
    required: ['operations'],
    async execute(args, execCtx): Promise<ToolResult> {
      const operationsRaw = args.operations;
      if (!Array.isArray(operationsRaw) || operationsRaw.length === 0) {
        return { success: false, output: '', error: '缺少 operations 参数或为空' };
      }
      if (operationsRaw.length > MAX_OPERATIONS) {
        return { success: false, output: '', error: `operations 数量超限(最多 ${MAX_OPERATIONS})` };
      }
      const operations = operationsRaw as BatchEditOperation[];

      const atomic = args.atomic !== false;
      const dryRun = args.dryRun === true;
      const confirm = args.confirm === true;

      // 危险操作守门:含 delete 需 confirm
      const hasDelete = operations.some((op) => op.type === 'delete');
      if (hasDelete && !confirm) {
        return { success: false, output: '', error: '包含 delete 操作需 confirm=true 才执行' };
      }
      // 非原子模式需 confirm
      if (!atomic && !confirm) {
        return { success: false, output: '', error: '非原子模式(atomic=false)需 confirm=true 才允许部分成功' };
      }

      const preResult = await runPreToolCall('batch_edit', {
        count: operations.length,
        atomic,
        dryRun,
        cwd: ctx.workspacePath,
      }, execCtx.signal);
      if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

      // 预检所有操作
      const validated: ValidatedOp[] = [];
      const preErrors: string[] = [];
      for (const op of operations) {
        const v = validateOp(op, ctx);
        validated.push(v);
        if (v.error) preErrors.push(`${op.filePath ?? '(?)'}: ${v.error}`);
      }

      // 原子模式:预检有任一失败 → 直接返回,不执行任何操作
      if (atomic && preErrors.length > 0) {
        const opResults: BatchEditResult['operations'] = validated.map((v) => ({
          filePath: v.op.filePath,
          type: v.op.type,
          status: 'skipped' as const,
          error: v.error,
        }));
        const result: BatchEditResult = {
          success: false,
          appliedCount: 0,
          totalCount: operations.length,
          operations: opResults,
        };
        return {
          success: false,
          output: JSON.stringify(result, null, 2),
          error: `预检失败(${preErrors.length} 处): ${preErrors.join('; ')}`,
        };
      }

      // dryRun:只返回 diff 预览
      if (dryRun) {
        const opResults: BatchEditResult['operations'] = validated.map((v) => {
          let diff = '';
          try {
            if (!v.error) diff = diffForOp(v);
          } catch {
            diff = '';
          }
          return {
            filePath: v.op.filePath,
            type: v.op.type,
            status: 'skipped' as const,
            error: v.error,
            diff,
          };
        });
        const result: BatchEditResult = {
          success: true,
          appliedCount: 0,
          totalCount: operations.length,
          operations: opResults,
        };
        await runPostToolCall('batch_edit', { dryRun: true, count: operations.length }, execCtx.signal);
        return { success: true, output: JSON.stringify(result, null, 2) };
      }

      // —— 两阶段批量删除护栏(goal-b49 W1-①)——
      // 插入点刻意在 checkpoint 创建与 applyOp 之前:blocked/undetermined 返回时
      // 本函数尚未产生任何文件系统副作用(测试②钉住"一个文件都没被删")。
      const deleteValidated = validated.filter((v) => !v.error && v.op.type === 'delete');
      let guardDecision: BulkDeleteDecision | null = null;
      if (deleteValidated.length > 0) {
        guardDecision = runBulkDeleteGuard(ctx.workspacePath, deleteValidated, args.bulkApproveTicket);
        if (guardDecision.verdict !== 'clean') {
          return {
            success: false,
            output: JSON.stringify(guardDecision, null, 2),
            error: `删除被护栏拒绝(${guardDecision.verdict}):${guardDecision.reason ?? '见 output'}`,
          };
        }
      }

      // 本批回收站状态(搬运件 + 清单;清单在结果返回前落盘)
      const trashId = crypto.randomUUID();
      const trashEntries: TrashManifestEntry[] = [];
      const guardNotes: string[] = [];

      // 创建 checkpoint(原子模式)— 文件维度备份原始状态
      let checkpointId: string | undefined;
      let manifest: CheckpointManifest | undefined;
      if (atomic) {
        checkpointId = crypto.randomUUID();
        const checkpointDir = getCheckpointDir(ctx.workspacePath, checkpointId);
        fs.mkdirSync(checkpointDir, { recursive: true });

        const fileMap = new Map<string, { relativePath: string; existedBefore: boolean; backupPath?: string }>();
        for (const v of validated) {
          if (v.error || fileMap.has(v.abs)) continue;
          if (v.exists) {
            const backupName = crypto.createHash('sha1').update(v.abs).digest('hex').slice(0, 16);
            const backupPath = path.join(checkpointDir, backupName);
            fs.copyFileSync(v.abs, backupPath);
            fileMap.set(v.abs, { relativePath: v.op.filePath, existedBefore: true, backupPath });
          } else {
            fileMap.set(v.abs, { relativePath: v.op.filePath, existedBefore: false });
          }
        }

        manifest = {
          id: checkpointId,
          createdAt: new Date().toISOString(),
          workspacePath: ctx.workspacePath,
          files: Array.from(fileMap.entries()).map(([filePath, info]) => ({ filePath, ...info })),
        };
        fs.writeFileSync(
          path.join(checkpointDir, 'manifest.json'),
          JSON.stringify(manifest, null, 2),
          'utf-8',
        );
      }

      // 顺序执行所有操作
      const opResults: BatchEditResult['operations'] = [];
      const appliedOps: ValidatedOp[] = [];
      let appliedCount = 0;
      let failureOccurred = false;

      for (const v of validated) {
        if (v.error) {
          // 非原子模式下,预检失败的标记为 skipped
          opResults.push({
            filePath: v.op.filePath,
            type: v.op.type,
            status: 'skipped' as const,
            error: v.error,
          });
          if (atomic) {
            failureOccurred = true;
            break;
          }
          continue;
        }
        try {
          applyOp(v, ctx.workspacePath, { id: trashId, entries: trashEntries });
          opResults.push({ filePath: v.op.filePath, type: v.op.type, status: 'success' as const });
          appliedOps.push(v);
          appliedCount++;
        } catch (err) {
          opResults.push({
            filePath: v.op.filePath,
            type: v.op.type,
            status: 'failed' as const,
            error: err instanceof Error ? err.message : String(err),
          });
          if (atomic) {
            failureOccurred = true;
            break;
          }
        }
      }

      // 原子模式回滚
      let rollbackPerformed = false;
      if (atomic && failureOccurred) {
        const m = manifest;
        if (m) {
          // 逆序恢复每个文件到原始状态
          const filesReversed = [...m.files].reverse();
          for (const entry of filesReversed) {
            try {
              if (entry.existedBefore && entry.backupPath) {
                fs.mkdirSync(path.dirname(entry.filePath), { recursive: true });
                fs.copyFileSync(entry.backupPath, entry.filePath);
              } else if (fs.existsSync(entry.filePath)) {
                // 操作前不存在 ⇒ 删除的是**本事务自己新建**的文件:没有用户前像,不进回收站
                fs.unlinkSync(entry.filePath);
              }
            } catch {
              // 单文件回滚失败不中断其余回滚
            }
          }
        }
        // 标记已执行的操作为 rolled-back
        for (const applied of appliedOps) {
          const r = opResults.find((x) => x.filePath === applied.op.filePath);
          if (r) r.status = 'rolled-back';
        }
        rollbackPerformed = true;
        appliedCount = 0;
      }

      // 回收站清单落盘(本批有搬运件才写;失败如实进 notes,不静默)
      if (trashEntries.length > 0) {
        try {
          writeTrashManifest(ctx.workspacePath, {
            kind: TRASH_MANIFEST_KIND,
            trashId,
            createdAtIso: new Date().toISOString(),
            workspacePath: ctx.workspacePath,
            entries: trashEntries,
          });
        } catch (err) {
          guardNotes.push(
            `回收站清单写入失败(件仍在、恢复出口失去索引):${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      // approve 相对账通过 ⇒ 报告腿(四件分离;与状态目录/重放文件互不混写)
      if (guardDecision?.approved && guardDecision.ticket) {
        try {
          appendGuardReport(ctx.workspacePath, {
            at: new Date().toISOString(),
            scanId: guardDecision.ticket.scanId,
            deleteCount: guardDecision.deleteCount,
            appliedCount,
            success: !failureOccurred,
            rollbackPerformed,
          });
        } catch (err) {
          guardNotes.push(
            `护栏报告追加失败(本次执行未进报告账):${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const result: BatchEditResult = {
        success: !failureOccurred,
        appliedCount,
        totalCount: operations.length,
        operations: opResults,
        rollbackPerformed,
        checkpointId: atomic && !failureOccurred ? checkpointId : undefined,
      };

      await runPostToolCall('batch_edit', {
        appliedCount,
        totalCount: operations.length,
        rollbackPerformed,
      }, execCtx.signal);

      return {
        success: result.success,
        output: JSON.stringify(
          guardDecision
            ? { ...result, deleteGuard: { verdict: guardDecision.verdict, approved: guardDecision.approved === true, trashId, notes: guardNotes } }
            : result,
          null,
          2,
        ),
        error: failureOccurred ? '部分操作失败,已回滚' : undefined,
      };
    },
  };
}

// ==================== batch_undo 工具 ====================

export function createBatchUndoTool(ctx: EditToolContext): Tool {
  return {
    name: 'batch_undo',
    description:
      '回滚之前的 batch_edit。参数:checkpointId(batch_edit 返回的 ID)。从 checkpoint 恢复所有受影响文件到原始状态。',
    dangerLevel: 'dangerous',
    parameters: {
      checkpointId: { type: 'string', description: 'batch_edit 返回的 checkpointId' },
    },
    required: ['checkpointId'],
    async execute(args, execCtx): Promise<ToolResult> {
      const checkpointId = args.checkpointId;
      if (!checkpointId || typeof checkpointId !== 'string') {
        return { success: false, output: '', error: '缺少 checkpointId 参数' };
      }
      // 路径安全:checkpointId 不含路径分隔符(防穿越)
      if (checkpointId.includes('/') || checkpointId.includes('\\') || checkpointId.includes('..')) {
        return { success: false, output: '', error: 'checkpointId 含非法字符' };
      }

      const checkpointDir = getCheckpointDir(ctx.workspacePath, checkpointId);
      const manifestPath = path.join(checkpointDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        return { success: false, output: '', error: `checkpoint 不存在: ${checkpointId}` };
      }

      const preResult = await runPreToolCall('batch_undo', { checkpointId, cwd: ctx.workspacePath }, execCtx.signal);
      if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

      let manifest: CheckpointManifest;
      try {
        const parsed = tryParseJson(fs.readFileSync(manifestPath, 'utf-8'));
        if (
          !isRecord(parsed) ||
          typeof parsed.workspacePath !== 'string' ||
          !isJsonArray(parsed.files)
        ) {
          return { success: false, output: '', error: 'manifest 解析失败: 结构不合法' };
        }
        manifest = parsed as unknown as CheckpointManifest;
      } catch (err) {
        return {
          success: false,
          output: '',
          error: `manifest 解析失败: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      // 验证 manifest 的 workspacePath 与当前一致(防跨工作区恢复)
      if (manifest.workspacePath !== ctx.workspacePath) {
        return { success: false, output: '', error: 'checkpoint workspacePath 与当前工作区不匹配' };
      }

      const results: Array<{ filePath: string; status: 'success' | 'failed'; error?: string }> = [];
      let successCount = 0;
      let failureCount = 0;

      // 逆序回滚
      const filesReversed = [...manifest.files].reverse();
      for (const entry of filesReversed) {
        try {
          if (entry.existedBefore && entry.backupPath) {
            if (!fs.existsSync(entry.backupPath)) {
              throw new Error(`备份文件不存在: ${entry.backupPath}`);
            }
            fs.mkdirSync(path.dirname(entry.filePath), { recursive: true });
            fs.copyFileSync(entry.backupPath, entry.filePath);
          } else if (fs.existsSync(entry.filePath)) {
            // 操作前不存在 → 删除
            fs.unlinkSync(entry.filePath);
          }
          results.push({ filePath: entry.relativePath, status: 'success' as const });
          successCount++;
        } catch (err) {
          results.push({
            filePath: entry.relativePath,
            status: 'failed' as const,
            error: err instanceof Error ? err.message : String(err),
          });
          failureCount++;
        }
      }

      await runPostToolCall('batch_undo', { checkpointId, successCount, failureCount }, execCtx.signal);

      const output = {
        success: failureCount === 0,
        restoredCount: successCount,
        failedCount: failureCount,
        results,
      };

      return {
        success: failureCount === 0,
        output: JSON.stringify(output, null, 2),
        error: failureCount > 0 ? `${failureCount} 个文件回滚失败` : undefined,
      };
    },
  };
}

// ==================== batch_preview 工具 ====================

export function createBatchPreviewTool(ctx: EditToolContext): Tool {
  return {
    name: 'batch_preview',
    description:
      '预览多文件编辑的 unified diff(不实际写入)。参数:operations(操作数组)。返回每个操作的 diff 预览。',
    dangerLevel: 'read',
    parameters: {
      operations: {
        type: 'array',
        description: '操作数组,同 batch_edit 的 operations',
        items: {
          type: 'object',
          description: '单个文件操作',
          properties: {
            type: { type: 'string', description: 'create | update | delete' },
            filePath: { type: 'string', description: '相对工作区根目录的路径' },
            content: { type: 'string', description: '文件内容(create/update 必填)' },
            encoding: { type: 'string', description: 'utf-8(默认) | base64' },
          },
        },
      },
    },
    required: ['operations'],
    async execute(args): Promise<ToolResult> {
      const operationsRaw = args.operations;
      if (!Array.isArray(operationsRaw) || operationsRaw.length === 0) {
        return { success: false, output: '', error: '缺少 operations 参数或为空' };
      }
      if (operationsRaw.length > MAX_OPERATIONS) {
        return { success: false, output: '', error: `operations 数量超限(最多 ${MAX_OPERATIONS})` };
      }
      const operations = operationsRaw as BatchEditOperation[];

      const opResults: BatchEditResult['operations'] = [];
      for (const op of operations) {
        const v = validateOp(op, ctx);
        let diff = '';
        try {
          if (!v.error) diff = diffForOp(v);
        } catch {
          diff = '';
        }
        opResults.push({
          filePath: op.filePath,
          type: op.type,
          status: v.error ? ('skipped' as const) : ('success' as const),
          error: v.error,
          diff,
        });
      }

      const result: BatchEditResult = {
        success: true,
        appliedCount: 0,
        totalCount: operations.length,
        operations: opResults,
      };

      return { success: true, output: JSON.stringify(result, null, 2) };
    },
  };
}

// ==================== 工具注册入口 ====================

export function createBatchEditTools(ctx: EditToolContext): Tool[] {
  return [createBatchEditTool(ctx), createBatchUndoTool(ctx), createBatchPreviewTool(ctx)];
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
