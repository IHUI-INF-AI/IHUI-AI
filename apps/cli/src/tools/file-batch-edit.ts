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

/** 执行单个操作(已预检通过) */
function applyOp(v: ValidatedOp): void {
  const { op, abs } = v;
  if (op.type === 'delete') {
    fs.unlinkSync(abs);
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
      '多文件原子编辑(事务性提交)。参数:operations(操作数组),atomic(默认 true,任一失败回滚),dryRun(只预览不写入),confirm(delete 操作或 atomic=false 时需 true)。返回 BatchEditResult JSON。',
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

      const preResult = runPreToolCall('batch_edit', {
        count: operations.length,
        atomic,
        dryRun,
        cwd: ctx.workspacePath,
      });
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
        runPostToolCall('batch_edit', { dryRun: true, count: operations.length });
        return { success: true, output: JSON.stringify(result, null, 2) };
      }

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
          applyOp(v);
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
                // 操作前不存在 → 删除新建的文件
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

      const result: BatchEditResult = {
        success: !failureOccurred,
        appliedCount,
        totalCount: operations.length,
        operations: opResults,
        rollbackPerformed,
        checkpointId: atomic && !failureOccurred ? checkpointId : undefined,
      };

      runPostToolCall('batch_edit', {
        appliedCount,
        totalCount: operations.length,
        rollbackPerformed,
      });

      return {
        success: result.success,
        output: JSON.stringify(result, null, 2),
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
    async execute(args): Promise<ToolResult> {
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

      const preResult = runPreToolCall('batch_undo', { checkpointId, cwd: ctx.workspacePath });
      if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

      let manifest: CheckpointManifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as CheckpointManifest;
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

      runPostToolCall('batch_undo', { checkpointId, successCount, failureCount });

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
