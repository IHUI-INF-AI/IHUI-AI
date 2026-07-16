/**
 * 代码语法高亮 — 简化版,用 chalk 对关键字着色。
 *
 * 原计划用 cli-highlight(已装),但其依赖链断裂(highlight.js 未安装),
 * 且为 P2 功能重装依赖违反做减法原则。改用 chalk 关键字着色,零新依赖。
 */

import * as path from 'node:path';
import chalk from 'chalk';

const EXT_SUPPORTED: Record<string, boolean> = {
  '.ts': true, '.tsx': true, '.js': true, '.jsx': true,
  '.py': true, '.go': true, '.rs': true, '.java': true, '.kt': true,
  '.c': true, '.cpp': true, '.h': true, '.sh': true,
};

const KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|default|class|extends|implements|interface|type|enum|namespace|async|await|try|catch|finally|throw|new|typeof|instanceof|in|of|this|super|null|undefined|true|false|void|as|public|private|protected|readonly|static|abstract|declare|def|elif|lambda|raise|with|yield|pass|None|True|False|and|or|not|is|func|package|defer|chan|select|map|range|make|append|struct|impl|pub|use|mod|fn|mut|match|trait|where)\b/g;

const STRINGS = /(["'`])((?:\\.|(?!\1).)*)\1/g;
const COMMENTS = /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)/gm;

/** 按文件扩展名高亮代码(关键字 cyan + 字符串 green + 注释 gray),未知语言返回原文 */
export function highlightCode(code: string, filePath?: string): string {
  if (!filePath) return code;
  const ext = path.extname(filePath).toLowerCase();
  if (!EXT_SUPPORTED[ext]) return code;
  try {
    let result = code;
    result = result.replace(COMMENTS, (m) => chalk.gray(m));
    result = result.replace(STRINGS, (m) => chalk.green(m));
    result = result.replace(KEYWORDS, (m) => chalk.cyan(m));
    return result;
  } catch {
    return code;
  }
}
