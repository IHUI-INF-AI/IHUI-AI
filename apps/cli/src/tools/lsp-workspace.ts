/**
 * LSP workspace 级工具(Wave 9,2026-07-22 立)
 *
 * 对标 OpenCode:补齐 workspace/symbol 全局符号搜索 + textDocument/rename + textDocument/codeAction。
 * 复用 lsp.ts 的 LspClient 单例管理(per workspace+language),支持 7 种语言。
 *
 * 3 个工具:
 *   - lsp_workspace_symbol:全局符号搜索(用于 "找 AuthService 在哪定义")
 *   - lsp_rename_symbol:符号重命名(预览 + 可选自动应用 edits)
 *   - lsp_code_actions:快速修复/重构建议
 */
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TextEdit, WorkspaceEdit, CodeAction, SymbolInformation } from 'vscode-languageserver-protocol';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';
import {
  getLspClientByLanguage,
  getLspClientForFile,
  symbolKindName,
  toRelPath,
  resolveAndCheckFile,
  lspUnavailableResult,
} from './lsp.js';

// ==================== Edit application helpers ====================

/** 将 LSP Position(line/character,0-based)转换为字符串偏移量 */
function positionToOffset(content: string, line: number, character: number): number {
  const lines = content.split('\n');
  let offset = 0;
  for (let i = 0; i < line && i < lines.length; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for \n
  }
  return offset + character;
}

/** 对单个文件应用 TextEdit 列表(按位置倒序应用,避免偏移量错乱) */
function applyTextEdits(content: string, edits: TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line;
    return b.range.start.character - a.range.start.character;
  });
  let result = content;
  for (const edit of sorted) {
    const start = positionToOffset(result, edit.range.start.line, edit.range.start.character);
    const end = positionToOffset(result, edit.range.end.line, edit.range.end.character);
    result = result.slice(0, start) + edit.newText + result.slice(end);
  }
  return result;
}

/** 应用 WorkspaceEdit 到磁盘文件,返回应用结果 */
function applyWorkspaceEdit(
  edit: WorkspaceEdit,
  workspacePath: string,
): { applied: number; skipped: number; errors: string[] } {
  const errors: string[] = [];
  let applied = 0;
  let skipped = 0;

  const changes = edit.changes;
  if (changes) {
    for (const [uri, edits] of Object.entries(changes)) {
      const filePath = fileURLToPath(uri);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const newContent = applyTextEdits(content, edits);
        fs.writeFileSync(filePath, newContent, 'utf-8');
        applied++;
      } catch (err) {
        skipped++;
        errors.push(`${toRelPath(uri, workspacePath)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // documentChanges(若 changes 不存在,尝试 documentChanges 中的 TextDocumentEdit)
  if (!changes && edit.documentChanges) {
    for (const docChange of edit.documentChanges) {
      if ('edits' in docChange && docChange.textDocument?.uri) {
        const uri = docChange.textDocument.uri;
        const filePath = fileURLToPath(uri);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const newContent = applyTextEdits(content, docChange.edits as TextEdit[]);
          fs.writeFileSync(filePath, newContent, 'utf-8');
          applied++;
        } catch (err) {
          skipped++;
          errors.push(`${toRelPath(uri, workspacePath)}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  return { applied, skipped, errors };
}

// ==================== Formatting helpers ====================

function formatSymbolInfo(sym: SymbolInformation, workspacePath: string): string {
  const kind = symbolKindName(sym.kind);
  const loc = sym.location;
  const relPath = toRelPath(loc.uri, workspacePath);
  const start = loc.range.start;
  const container = sym.containerName ? ` (in ${sym.containerName})` : '';
  return `  ${sym.name} [${kind}] at ${relPath}:${start.line + 1}:${start.character + 1}${container}`;
}

function formatCodeAction(action: CodeAction): string {
  const kind = action.kind ? ` [${action.kind}]` : '';
  const preferred = action.isPreferred ? ' ★' : '';
  const editInfo = action.edit ? ' (has edit)' : '';
  const cmdInfo = action.command ? ` (command: ${action.command.title})` : '';
  return `  ${action.title}${kind}${preferred}${editInfo}${cmdInfo}`;
}

function formatRenamePreview(edit: WorkspaceEdit | null, workspacePath: string): string {
  if (!edit) return '(LSP 未返回重命名 edit,可能该位置不支持 rename)';
  const changes = edit.changes;
  const lines: string[] = [];
  let totalEdits = 0;
  if (changes) {
    for (const [uri, edits] of Object.entries(changes)) {
      const relPath = toRelPath(uri, workspacePath);
      totalEdits += edits.length;
      lines.push(`  ${relPath} (${edits.length} 处修改):`);
      for (const e of edits) {
        const s = e.range.start;
        const old = `${s.line + 1}:${s.character + 1}`;
        lines.push(`    ${old} → "${e.newText}"`);
      }
    }
  }
  if (edit.documentChanges && !changes) {
    for (const docChange of edit.documentChanges) {
      if ('edits' in docChange && docChange.textDocument?.uri) {
        const relPath = toRelPath(docChange.textDocument.uri, workspacePath);
        const edits = docChange.edits as TextEdit[];
        totalEdits += edits.length;
        lines.push(`  ${relPath} (${edits.length} 处修改):`);
        for (const e of edits) {
          const s = e.range.start;
          lines.push(`    ${s.line + 1}:${s.character + 1} → "${e.newText}"`);
        }
      }
    }
  }
  if (lines.length === 0) return '(LSP 返回空 edit,无需修改)';
  return `预览:${totalEdits} 处修改\n${lines.join('\n')}`;
}

// ==================== Tool 1: lsp_workspace_symbol ====================

export const lsp_workspace_symbol: Tool = {
  name: 'lsp_workspace_symbol',
  description:
    '使用 LSP workspace/symbol 进行全局符号搜索(对标 OpenCode)。输入查询字符串,返回全工作区匹配的符号列表(name/kind/location)。用于 "找 AuthService 在哪定义" 场景。支持指定 language 限定搜索的语言 LSP server(默认 typescript)。LSP 不可用时返回空列表 + 提示。',
  dangerLevel: 'read',
  parameters: {
    query: { type: 'string', description: '符号搜索查询字符串(支持模糊匹配,如 "AuthService" / "authService" / "AuthService.login")' },
    limit: { type: 'number', description: '最大返回数量(默认 50)' },
    language: { type: 'string', description: '限定语言 LPS server(typescript/rust/go/python/java/c/csharp,默认 typescript)' },
  },
  required: ['query'],
  async execute(args, ctx): Promise<ToolResult> {
    const query = args.query as string | undefined;
    const limit = (args.limit as number | undefined) ?? 50;
    const language = (args.language as string | undefined) ?? 'typescript';

    if (!query || typeof query !== 'string') {
      return { success: false, output: '', error: '参数错误:需要 query(字符串)' };
    }

    const preResult = runPreToolCall('lsp_workspace_symbol', { query, limit, language });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const client = getLspClientByLanguage(ctx.workspacePath, language);
    if (!client) {
      return {
        success: true,
        output: `不支持的语言: ${language}。支持的语言:typescript/rust/go/python/java/c/csharp`,
      };
    }

    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let symbols: SymbolInformation[];
    try {
      symbols = await client.workspaceSymbol(query);
    } catch (err) {
      // LSP server 不支持 workspace/symbol 时优雅降级
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: true,
        output: `LSP workspace/symbol 不可用(${msg})。该 LSP server 可能不支持全局符号搜索。`,
      };
    }

    runPostToolCall('lsp_workspace_symbol', { query, language, hits: symbols.length });

    if (symbols.length === 0) {
      return { success: true, output: `未找到匹配 "${query}" 的符号(language=${language})` };
    }

    const truncated = symbols.slice(0, limit);
    const lines = truncated.map((s) => formatSymbolInfo(s, ctx.workspacePath));
    const more = symbols.length > limit ? `\n  ... 还有 ${symbols.length - limit} 个结果未显示` : '';
    return {
      success: true,
      output: `找到 ${symbols.length} 个符号${symbols.length > limit ? `(仅显示前 ${limit})` : ''}:\n${lines.join('\n')}${more}`,
    };
  },
};

// ==================== Tool 2: lsp_rename_symbol ====================

export const lsp_rename_symbol: Tool = {
  name: 'lsp_rename_symbol',
  description:
    '使用 LSP textDocument/rename 进行符号重命名(对标 OpenCode)。输入文件路径 + 0-based 行号/列号 + 新名称,返回所有受影响文件的 edits 预览。设置 apply=true + confirm=true 可自动应用 edits 到磁盘文件。危险操作(修改多文件),apply 时必须 confirm=true。LSP 不可用时降级提示。',
  dangerLevel: 'write',
  parameters: {
    file: { type: 'string', description: '文件路径(相对于工作区根目录)' },
    line: { type: 'number', description: '行号(0-based,LSP 标准,从 0 开始)' },
    character: { type: 'number', description: '列号(0-based,LSP 标准,从 0 开始)' },
    newName: { type: 'string', description: '新符号名' },
    apply: { type: 'boolean', description: 'true=自动应用 edits 到文件,false=只返回预览(默认 false)' },
    confirm: { type: 'boolean', description: 'apply=true 时必须 confirm=true 才执行应用' },
  },
  required: ['file', 'line', 'character', 'newName'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string | undefined;
    const line = args.line as number | undefined;
    const character = args.character as number | undefined;
    const newName = args.newName as string | undefined;
    const apply = args.apply === true;
    const confirm = args.confirm === true;

    if (!file || typeof line !== 'number' || typeof character !== 'number' || !newName) {
      return {
        success: false,
        output: '',
        error: '参数错误:需要 file(字符串)、line(数字)、character(数字)、newName(字符串)',
      };
    }

    const preResult = runPreToolCall('lsp_rename_symbol', { file, line, character, newName, apply, confirm });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    // apply=true 时必须 confirm=true
    if (apply && !confirm) {
      return {
        success: false,
        output: '',
        error: '安全检查:apply=true 时必须同时设置 confirm=true 才能执行文件修改',
      };
    }

    const fileCheck = resolveAndCheckFile(file, ctx.workspacePath);
    if (!fileCheck.ok) return { success: false, output: '', error: fileCheck.error };

    const client = getLspClientForFile(ctx.workspacePath, fileCheck.filePath);
    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let edit: WorkspaceEdit | null;
    try {
      edit = await client.renameSymbol(fileCheck.filePath, line, character, newName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: true,
        output: `LSP textDocument/rename 不可用(${msg})。该位置可能不支持 rename 或 LSP server 不支持此功能。`,
      };
    }

    runPostToolCall('lsp_rename_symbol', { file, line, character, newName, apply, hasEdit: !!edit });

    // 只返回预览
    if (!apply || !edit) {
      return {
        success: true,
        output: formatRenamePreview(edit, ctx.workspacePath),
      };
    }

    // 应用 edits
    const result = applyWorkspaceEdit(edit, ctx.workspacePath);
    const appliedMsg = `已应用重命名:修改了 ${result.applied} 个文件`;
    const skippedMsg = result.skipped > 0 ? `,${result.skipped} 个文件跳过` : '';
    const errorLines = result.errors.length > 0
      ? `\n错误:\n${result.errors.map((e) => `  ${e}`).join('\n')}`
      : '';
    return {
      success: result.errors.length === 0,
      output: `${appliedMsg}${skippedMsg}${errorLines}`,
      error: result.errors.length > 0 ? `${result.errors.length} 个文件应用失败` : undefined,
    };
  },
};

// ==================== Tool 3: lsp_code_actions ====================

export const lsp_code_actions: Tool = {
  name: 'lsp_code_actions',
  description:
    '使用 LSP textDocument/codeAction 获取快速修复/重构建议(对标 OpenCode)。输入文件路径 + 0-based 行号/列号,返回可用的 code action 列表(title/kind/edit/command)。可选 kind 过滤(quickfix/refactor/refactor.extract/refactor.inline/refactor.rewrite/source/source.organizeImports)。LSP 不可用时降级提示。',
  dangerLevel: 'read',
  parameters: {
    file: { type: 'string', description: '文件路径(相对于工作区根目录)' },
    line: { type: 'number', description: '行号(0-based,LSP 标准,从 0 开始)' },
    character: { type: 'number', description: '列号(0-based,LSP 标准,从 0 开始)' },
    kind: {
      type: 'string',
      description: '过滤 code action 类型(可选)',
      enum: ['quickfix', 'refactor', 'refactor.extract', 'refactor.inline', 'refactor.rewrite', 'source', 'source.organizeImports'],
    },
  },
  required: ['file', 'line', 'character'],
  async execute(args, ctx): Promise<ToolResult> {
    const file = args.file as string | undefined;
    const line = args.line as number | undefined;
    const character = args.character as number | undefined;
    const kind = args.kind as string | undefined;

    if (!file || typeof line !== 'number' || typeof character !== 'number') {
      return {
        success: false,
        output: '',
        error: '参数错误:需要 file(字符串)、line(数字)、character(数字)',
      };
    }

    const preResult = runPreToolCall('lsp_code_actions', { file, line, character, kind });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const fileCheck = resolveAndCheckFile(file, ctx.workspacePath);
    if (!fileCheck.ok) return { success: false, output: '', error: fileCheck.error };

    const client = getLspClientForFile(ctx.workspacePath, fileCheck.filePath);
    try {
      await client.ensureStarted();
    } catch (err) {
      return lspUnavailableResult(err);
    }

    let actions: CodeAction[];
    try {
      actions = await client.codeActions(fileCheck.filePath, line, character, kind);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: true,
        output: `LSP textDocument/codeAction 不可用(${msg})。该 LSP server 可能不支持 code action。`,
      };
    }

    runPostToolCall('lsp_code_actions', { file, line, character, kind, count: actions.length });

    if (actions.length === 0) {
      const kindStr = kind ? `(kind=${kind})` : '';
      return { success: true, output: `无可用 code action${kindStr}(file=${file} line=${line} char=${character})` };
    }

    const lines = actions.map((a) => formatCodeAction(a));
    return {
      success: true,
      output: `${actions.length} 个 code action:\n${lines.join('\n')}`,
    };
  },
};
