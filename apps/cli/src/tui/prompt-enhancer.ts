/**
 * 提示增强器 — 把 @ 文件引用替换为文件内容片段、把图片 dataURL 注入消息。
 * enhancePrompt:正则匹配 @path 引用,读文件头 100 行,替换为 ```path\n<内容>\``` 块。
 * enhanceWithImage:把图片 dataURL 拼到消息内容(多模态格式)。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ImageInput } from './image-input.js';

const MAX_FILE_LINES = 100;
const MAX_FILE_BYTES = 32 * 1024; // 单文件截断 32KB

export interface EnhancedPrompt {
  text: string;
  images?: ImageInput[];
}

const EXT_TO_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.json': 'json', '.css': 'css', '.scss': 'scss', '.html': 'html',
  '.md': 'markdown', '.yml': 'yaml', '.yaml': 'yaml', '.sh': 'bash',
  '.xml': 'xml', '.toml': 'toml', '.ini': 'ini', '.txt': 'text',
};

function resolveWorkspacePath(workspacePath: string, ref: string): string {
  return path.isAbsolute(ref) ? ref : path.resolve(workspacePath, ref);
}

/** 读取文件片段(头 100 行,二进制检测,超长截断) */
function readSnippet(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const buf = fs.readFileSync(filePath);
    // 简单二进制检测:前 1000 字节有 null byte 视为二进制
    if (buf.subarray(0, Math.min(1000, buf.length)).includes(0)) return null;
    const content = buf.toString('utf-8');
    const allLines = content.split('\n');
    const lines = allLines.slice(0, MAX_FILE_LINES);
    let snippet = lines.join('\n');
    if (content.length > MAX_FILE_BYTES) {
      snippet = snippet.slice(0, MAX_FILE_BYTES) + `\n... (截断,共 ${allLines.length} 行)`;
    }
    return snippet;
  } catch {
    return null;
  }
}

/**
 * 增强提示词:把 @path 引用替换为文件内容片段(markdown fenced 块)。
 * 匹配规则:@ 后跟含扩展名的文件路径,以空白或行首为边界。
 * 不存在的文件保留原引用并标注 [文件不存在]。
 */
export function enhancePrompt(text: string, workspacePath: string): EnhancedPrompt {
  // (^|\s) 确保不匹配 email 中的 @;路径必须含 .ext
  const pattern = /(^|\s)@([\w./\\-]+\.[\w]+)/g;
  const enhanced = text.replace(pattern, (_m, leading, ref) => {
    const fullPath = resolveWorkspacePath(workspacePath, ref);
    const snippet = readSnippet(fullPath);
    if (snippet === null) {
      return `${leading}@${ref} [文件不存在]`;
    }
    const ext = path.extname(ref).toLowerCase();
    const lang = EXT_TO_LANG[ext] ?? '';
    return `${leading}\`\`\`${lang} ${ref}\n${snippet}\n\`\`\``;
  });
  return { text: enhanced };
}

/**
 * 把图片 dataURL 注入消息内容(多模态格式)。
 * 返回 {text, images},repl.ts 后续组装为多模态 content 数组。
 */
export function enhanceWithImage(text: string, images: ImageInput[]): EnhancedPrompt {
  if (images.length === 0) return { text };
  return { text, images };
}
