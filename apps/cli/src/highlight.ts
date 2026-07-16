/**
 * 代码语法高亮 — 封装 cli-highlight(已装但闲置)。
 *
 * 灵感来源:grok-build 用 syntect crate 做 terminal ANSI 高亮。
 * 做减法:复用已有 cli-highlight 依赖,按扩展名映射语言,失败降级原文。
 */

import * as path from 'node:path';
import { highlight } from 'cli-highlight';

const EXT_LANG_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx',
  '.js': 'javascript', '.jsx': 'jsx',
  '.py': 'python', '.json': 'json',
  '.css': 'css', '.scss': 'scss',
  '.html': 'html', '.xml': 'xml',
  '.md': 'markdown', '.markdown': 'markdown',
  '.yml': 'yaml', '.yaml': 'yaml',
  '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.kt': 'kotlin',
  '.c': 'c', '.cpp': 'cpp',
  '.sh': 'bash', '.sql': 'sql',
};

/** 按文件扩展名高亮代码,未知语言或失败返回原文 */
export function highlightCode(code: string, filePath?: string): string {
  if (!filePath) return code;
  const ext = path.extname(filePath).toLowerCase();
  const lang = EXT_LANG_MAP[ext];
  if (!lang) return code;
  try {
    return highlight(code, { language: lang });
  } catch {
    return code;
  }
}

/** 从文件路径推断语言名(供其他模块用) */
export function detectLang(filePath: string): string | undefined {
  return EXT_LANG_MAP[path.extname(filePath).toLowerCase()];
}
