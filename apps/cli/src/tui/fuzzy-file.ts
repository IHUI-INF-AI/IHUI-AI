/**
 * @ 文件模糊搜索 — 子序列匹配 + 路径优先级评分。
 * 输入 @ 触发,模糊匹配工作区文件,返回选中文件路径。
 * 灵感来源:OpenCode 的 @ file picker。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.output', '.wxt', 'target']);
const MAX_COLLECT = 2000;

export interface FuzzyFileResult {
  path: string;
  score: number;
}

/** 子序列模糊匹配 + 评分(连续匹配 / 早出现 / 词边界 / 短 target 加分) */
function fuzzyMatch(query: string, target: string): { matched: boolean; score: number } {
  if (query.length === 0) return { matched: true, score: 0 };
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let lastMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t.charAt(ti) === q.charAt(qi)) {
      if (ti === lastMatchIdx + 1) score += 5;
      score += Math.max(0, 10 - ti);
      if (ti === 0 || /[/_.-]/.test(t.charAt(ti - 1))) score += 8;
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi < q.length) return { matched: false, score: 0 };
  score += Math.max(0, 30 - t.length);
  return { matched: true, score };
}

/** 递归收集工作区文件(忽略 IGNORED_DIRS,上限 MAX_COLLECT) */
function collectFiles(workspacePath: string): string[] {
  const results: string[] = [];
  function walk(dir: string): void {
    if (results.length >= MAX_COLLECT) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= MAX_COLLECT) return;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        results.push(path.relative(workspacePath, path.join(dir, entry.name)));
      }
    }
  }
  walk(workspacePath);
  return results;
}

/**
 * 模糊搜索工作区文件。
 * @param workspacePath 工作区根目录
 * @param query 查询字符串(子序列匹配,空串返回空数组)
 * @param limit 返回结果上限,默认 20
 */
export function findFiles(
  workspacePath: string,
  query: string,
  limit = 20,
): FuzzyFileResult[] {
  if (!query) return [];
  const files = collectFiles(workspacePath);
  const results: FuzzyFileResult[] = [];
  for (const file of files) {
    const name = path.basename(file);
    const fullMatch = fuzzyMatch(query, file);
    const baseMatch = fuzzyMatch(query, name);
    // 文件名匹配加权(用户更常搜文件名)
    const score = Math.max(fullMatch.score, baseMatch.score + 15);
    if (fullMatch.matched || baseMatch.matched) {
      results.push({ path: file, score });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
