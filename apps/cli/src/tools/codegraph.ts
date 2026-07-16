/**
 * Codebase Intelligence — 符号依赖图 + 定义跳转 + 引用查找。
 *
 * 灵感来源:cli 的 cli-lsp crate + Codebase Intelligence 系统。
 * 做减法(零外部 LSP 依赖,纯正则解析,覆盖 90% 场景):
 *   - codegraph:扫描 .ts/.tsx/.js/.jsx 文件,解析 import 语句,构建文件依赖图
 *   - goto_definition:基于符号名搜索 function/const/let/var/class/interface/type/enum 定义
 *   - find_references:反向查找符号所有引用(import 语句 + 同文件使用)
 *
 * 不实现(需要完整 AST + 类型系统,简化版无价值):
 *   - 跨文件类型推断
 *   - 符号重命名(只会做查找,不做实际改名)
 *   - 重载/泛型的精确解析
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Tool, ToolResult } from './index.js';
import { runPreToolCall, runPostToolCall } from '../hooks/index.js';

const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '.output', '.wxt',
  'target', 'build', '.turbo', '.cache', 'coverage',
]);

const MAX_RESULTS = 50;
const MAX_FILES = 1000;

interface FileEntry {
  /** 相对工作区的路径(POSIX 风格) */
  rel: string;
  abs: string;
}

interface DependencyEdge {
  from: string;
  to: string;
  /** 导入方式: relative(相对路径)/ bare(裸模块名)/ dynamic(动态 import) */
  kind: 'relative' | 'bare' | 'dynamic';
}

interface DefinitionHit {
  file: string;
  line: number;
  column: number;
  kind: string;
  preview: string;
}

interface ReferenceHit {
  file: string;
  line: number;
  column: number;
  kind: 'import' | 'usage';
  preview: string;
}

/** 递归扫描工作区,返回所有代码文件(相对路径 POSIX 风格)。 */
function scanCodeFiles(workspacePath: string): FileEntry[] {
  const out: FileEntry[] = [];
  const stack: string[] = [workspacePath];
  while (stack.length > 0 && out.length < MAX_FILES) {
    const cur = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) {
        // 允许 .ts/.tsx 等,但跳过 .git/.cache 等隐藏目录
        if (e.isDirectory() && !IGNORED_DIRS.has(e.name)) {
          stack.push(path.join(cur, e.name));
        }
        continue;
      }
      if (e.isDirectory()) {
        if (IGNORED_DIRS.has(e.name)) continue;
        stack.push(path.join(cur, e.name));
      } else if (e.isFile() && CODE_EXTS.has(path.extname(e.name).toLowerCase())) {
        out.push({
          rel: path.relative(workspacePath, path.join(cur, e.name)).replace(/\\/g, '/'),
          abs: path.join(cur, e.name),
        });
        if (out.length >= MAX_FILES) break;
      }
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

// import 语句匹配模式(覆盖 ES modules + CommonJS + dynamic import)
const IMPORT_PATTERNS: Array<{ re: RegExp; kind: 'relative' | 'bare' | 'dynamic' }> = [
  // import x from './path'
  // import { x } from './path'
  // import * as x from './path'
  // import './path'
  { re: /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g, kind: 'relative' },
  // import('path')
  { re: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, kind: 'dynamic' },
  // require('path')
  { re: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, kind: 'relative' },
];

/** 解析单个文件的 import 语句,返回 (源文件, 目标路径, 类型) 三元组列表。 */
function parseImports(file: FileEntry): Array<{ to: string; kind: 'relative' | 'bare' | 'dynamic' }> {
  let content: string;
  try {
    content = fs.readFileSync(file.abs, 'utf-8');
  } catch {
    return [];
  }
  const results: Array<{ to: string; kind: 'relative' | 'bare' | 'dynamic' }> = [];
  const seen = new Set<string>();
  for (const { re, kind } of IMPORT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const target = m[1]!;
      const isRelative = target.startsWith('./') || target.startsWith('../') || target.startsWith('/');
      const resolvedKind = isRelative ? kind : 'bare';
      const key = `${resolvedKind}:${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ to: target, kind: resolvedKind });
    }
  }
  return results;
}

/** 尝试将相对 import 路径解析为实际文件(支持省略扩展名和 index 文件)。 */
function resolveImport(file: FileEntry, importPath: string, allFiles: Map<string, FileEntry>): string | null {
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) return null;
  const baseDir = path.dirname(file.rel);
  const normalized = path.posix.normalize(path.posix.join(baseDir, importPath)).replace(/\\/g, '/');
  // 直接匹配
  if (allFiles.has(normalized)) return normalized;
  // 尝试加扩展名
  for (const ext of CODE_EXTS) {
    if (allFiles.has(normalized + ext)) return normalized + ext;
  }
  // 尝试 index 文件
  for (const ext of CODE_EXTS) {
    const idx = `${normalized}/index${ext}`;
    if (allFiles.has(idx)) return idx;
  }
  return null;
}

// 符号定义模式
const DEFINITION_PATTERNS: Array<{ re: RegExp; kind: string }> = [
  { re: new RegExp(`\\bexport\\s+(async\\s+)?function\\s+({SYMBOL})\\b`), kind: 'function' },
  { re: new RegExp(`\\bexport\\s+(async\\s+)?function\\s+\\*\\s*({SYMBOL})\\b`), kind: 'generator' },
  { re: new RegExp(`\\b(async\\s+)?function\\s+({SYMBOL})\\b`), kind: 'function' },
  { re: new RegExp(`\\bexport\\s+const\\s+({SYMBOL})\\b`), kind: 'const' },
  { re: new RegExp(`\\bconst\\s+({SYMBOL})\\s*=`), kind: 'const' },
  { re: new RegExp(`\\blet\\s+({SYMBOL})\\s*=`), kind: 'let' },
  { re: new RegExp(`\\bvar\\s+({SYMBOL})\\s*=`), kind: 'var' },
  { re: new RegExp(`\\bexport\\s+class\\s+({SYMBOL})\\b`), kind: 'class' },
  { re: new RegExp(`\\bclass\\s+({SYMBOL})\\b`), kind: 'class' },
  { re: new RegExp(`\\bexport\\s+interface\\s+({SYMBOL})\\b`), kind: 'interface' },
  { re: new RegExp(`\\binterface\\s+({SYMBOL})\\b`), kind: 'interface' },
  { re: new RegExp(`\\bexport\\s+type\\s+({SYMBOL})\\b`), kind: 'type' },
  { re: new RegExp(`\\btype\\s+({SYMBOL})\\s*=`), kind: 'type' },
  { re: new RegExp(`\\bexport\\s+enum\\s+({SYMBOL})\\b`), kind: 'enum' },
  { re: new RegExp(`\\benum\\s+({SYMBOL})\\b`), kind: 'enum' },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDefinitions(symbol: string, files: FileEntry[]): DefinitionHit[] {
  const hits: DefinitionHit[] = [];
  const sym = escapeRegex(symbol);
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file.abs, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const { re: reTemplate, kind } of DEFINITION_PATTERNS) {
        const re = new RegExp(reTemplate.source.replace('{SYMBOL}', sym), 'g');
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) {
          const col = m.index + m[0].indexOf(symbol);
          hits.push({
            file: file.rel,
            line: i + 1,
            column: col + 1,
            kind,
            preview: line.trim().slice(0, 120),
          });
          break; // 同一行只算一次命中
        }
      }
      if (hits.length >= MAX_RESULTS) return hits;
    }
  }
  return hits;
}

function findReferences(symbol: string, files: FileEntry[]): ReferenceHit[] {
  const hits: ReferenceHit[] = [];
  const sym = escapeRegex(symbol);
  // import 中的引用模式
  const importRe = new RegExp(
    `import\\s+(?:([^'"]+?)\\s+from\\s+)?['"][^'"]+['"]|import\\s*\\(\\s*['"][^'"]+['"]\\s*\\)|require\\s*\\(\\s*['"][^'"]+['"]\\s*\\)`,
    'g',
  );
  // 简化:任何出现在代码中的 symbol 词
  const usageRe = new RegExp(`\\b${sym}\\b`, 'g');
  const defRe = new RegExp(
    `\\b(?:function|const|let|var|class|interface|type|enum)\\s+${sym}\\b`,
  );

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file.abs, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // 跳过定义语句本身(只找引用)
      if (defRe.test(line)) continue;
      // 检查 import 行
      importRe.lastIndex = 0;
      const isImport = importRe.test(line);
      usageRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = usageRe.exec(line)) !== null) {
        hits.push({
          file: file.rel,
          line: i + 1,
          column: m.index + 1,
          kind: isImport ? 'import' : 'usage',
          preview: line.trim().slice(0, 120),
        });
        if (hits.length >= MAX_RESULTS) return hits;
      }
    }
  }
  return hits;
}

// ==================== 工具实现 ====================

export const codegraph: Tool = {
  name: 'codegraph',
  description:
    '构建工作区代码符号依赖图(扫描 .ts/.tsx/.js/.jsx 文件的 import 语句)。输出每个文件的依赖列表 + 反向依赖(谁依赖我)。用于理解代码结构、影响面分析。零外部依赖,纯正则解析,覆盖 90% 场景。',
  dangerLevel: 'read',
  parameters: {
    file: {
      type: 'string',
      description: '只查看指定文件的依赖(可选,省略则输出全局统计)',
    },
    reverse: {
      type: 'boolean',
      description: '查看反向依赖(谁依赖我,默认 false 输出正向依赖)',
    },
  },
  required: [],
  async execute(args, ctx): Promise<ToolResult> {
    const preResult = runPreToolCall('codegraph', args);
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const files = scanCodeFiles(ctx.workspacePath);
    if (files.length === 0) {
      return { success: true, output: '工作区无代码文件(.ts/.tsx/.js/.jsx)' };
    }
    const fileMap = new Map<string, FileEntry>(files.map((f) => [f.rel, f]));
    const edges: DependencyEdge[] = [];
    for (const file of files) {
      const imports = parseImports(file);
      for (const imp of imports) {
        if (imp.kind === 'bare') {
          edges.push({ from: file.rel, to: imp.to, kind: 'bare' });
        } else {
          const resolved = resolveImport(file, imp.to, fileMap);
          edges.push({
            from: file.rel,
            to: resolved ?? imp.to,
            kind: resolved ? imp.kind : 'bare',
          });
        }
      }
    }

    runPostToolCall('codegraph', { files: files.length, edges: edges.length });

    const targetFile = args.file as string | undefined;
    const reverse = args.reverse === true;

    if (targetFile) {
      const normalized = targetFile.replace(/\\/g, '/');
      if (reverse) {
        const dependents = edges.filter((e) => e.to === normalized).map((e) => e.from);
        const unique = Array.from(new Set(dependents)).sort();
        if (unique.length === 0) {
          return { success: true, output: `无文件依赖 ${normalized}` };
        }
        return {
          success: true,
          output: `反向依赖 ${normalized}(${unique.length} 个文件):\n${unique.map((f) => `  ← ${f}`).join('\n')}`,
        };
      }
      const deps = edges.filter((e) => e.from === normalized);
      if (deps.length === 0) {
        return { success: true, output: `${normalized} 无依赖` };
      }
      const lines = deps.map((e) => `  → ${e.to} [${e.kind}]`);
      return {
        success: true,
        output: `${normalized} 的依赖(${deps.length} 条):\n${lines.join('\n')}`,
      };
    }

    // 全局统计
    const bareImports = new Set<string>();
    for (const e of edges) {
      if (e.kind === 'bare') bareImports.add(e.to);
    }
    const mostDeps = files
      .map((f) => ({ file: f.rel, count: edges.filter((e) => e.from === f.rel).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const mostDependents = files
      .map((f) => ({ file: f.rel, count: edges.filter((e) => e.to === f.rel).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const lines: string[] = [
      `代码文件: ${files.length}`,
      `依赖边: ${edges.length}(其中裸模块 ${edges.filter((e) => e.kind === 'bare').length} 条)`,
      `裸模块依赖: ${bareImports.size} 个`,
      '',
      '依赖最多的 10 个文件:',
      ...mostDeps.map((x) => `  ${x.count} → ${x.file}`),
      '',
      '被依赖最多的 10 个文件(核心模块):',
      ...mostDependents.map((x) => `  ${x.count} ← ${x.file}`),
    ];
    return { success: true, output: lines.join('\n') };
  },
};

export const goto_definition: Tool = {
  name: 'goto_definition',
  description:
    '查找符号定义位置(基于正则扫描 function/const/let/var/class/interface/type/enum 定义模式)。返回 file:line:col + 上下文。零 LSP 依赖,适合快速定位符号定义。',
  dangerLevel: 'read',
  parameters: {
    symbol: { type: 'string', description: '要查找的符号名(标识符)' },
  },
  required: ['symbol'],
  async execute(args, ctx): Promise<ToolResult> {
    const symbol = (args.symbol as string | undefined)?.trim();
    if (!symbol) return { success: false, output: '', error: '缺少参数 symbol' };
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol)) {
      return { success: false, output: '', error: 'symbol 必须是合法标识符' };
    }
    const preResult = runPreToolCall('goto_definition', { symbol });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const files = scanCodeFiles(ctx.workspacePath);
    const hits = findDefinitions(symbol, files);
    runPostToolCall('goto_definition', { symbol, hits: hits.length });

    if (hits.length === 0) {
      return { success: true, output: `未找到符号 "${symbol}" 的定义` };
    }
    const lines = hits.map(
      (h) => `  ${h.file}:${h.line}:${h.column} [${h.kind}] ${h.preview}`,
    );
    return {
      success: true,
      output: `找到 ${hits.length} 处 "${symbol}" 定义:\n${lines.join('\n')}`,
    };
  },
};

export const find_references: Tool = {
  name: 'find_references',
  description:
    '查找符号所有引用位置(import 语句 + 代码内使用,排除定义本身)。用于评估重命名影响面、查找未使用符号。返回 file:line:col + 引用类型 + 上下文。',
  dangerLevel: 'read',
  parameters: {
    symbol: { type: 'string', description: '要查找的符号名(标识符)' },
  },
  required: ['symbol'],
  async execute(args, ctx): Promise<ToolResult> {
    const symbol = (args.symbol as string | undefined)?.trim();
    if (!symbol) return { success: false, output: '', error: '缺少参数 symbol' };
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(symbol)) {
      return { success: false, output: '', error: 'symbol 必须是合法标识符' };
    }
    const preResult = runPreToolCall('find_references', { symbol });
    if (!preResult.proceed) return { success: false, output: '', error: preResult.reason };

    const files = scanCodeFiles(ctx.workspacePath);
    const hits = findReferences(symbol, files);
    runPostToolCall('find_references', { symbol, hits: hits.length });

    if (hits.length === 0) {
      return {
        success: true,
        output: `符号 "${symbol}" 无引用(可能是未使用符号或定义不存在)`,
      };
    }
    const imports = hits.filter((h) => h.kind === 'import');
    const usages = hits.filter((h) => h.kind === 'usage');
    const lines = hits.map(
      (h) => `  ${h.file}:${h.line}:${h.column} [${h.kind}] ${h.preview}`,
    );
    return {
      success: true,
      output: `找到 ${hits.length} 处引用(${imports.length} import + ${usages.length} usage):\n${lines.join('\n')}`,
    };
  },
};

export const CODEGRAPH_TOOLS: Tool[] = [codegraph, goto_definition, find_references];
