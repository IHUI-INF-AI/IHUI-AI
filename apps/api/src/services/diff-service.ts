/**
 * 差异对比服务。
 * 支持文本文件（基于 LCS 的逐行 diff）与二进制文件（哈希对比）。
 * 零依赖实现，不引入外部 diff 库。
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';

export type DiffType = 'add' | 'delete' | 'modify' | 'equal';

export interface DiffLine {
  lineNumber: number;
  content: string;
  diffType: DiffType;
}

export interface DiffResult {
  additions: number;
  deletions: number;
  changes: number;
  fromContent: string;
  toContent: string;
  changesList: DiffLine[];
}

/** 计算文件 SHA-256 哈希。 */
export function getFileHash(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

/** 判断是否为文本文件（采样前 8KB，含 \0 视为二进制）。 */
export function isTextFile(filePath: string, sampleSize = 8192): boolean {
  try {
    const fd = readFileSync(filePath, { encoding: null });
    const chunk = fd.subarray(0, sampleSize);
    if (chunk.includes(0)) return false;
    return Buffer.from(chunk).toString('utf8') !== '';
  } catch {
    return false;
  }
}

/** 读取文件内容，返回行数组与原始字符串。 */
export function readFileContent(filePath: string): { lines: string[]; content: string } {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return { lines: content.split(/\r?\n/), content };
  } catch {
    return { lines: [], content: '' };
  }
}

/**
 * 基于 LCS 计算两段文本的逐行 diff。
 */
export function computeTextDiff(fromText: string, toText: string): DiffLine[] {
  const fromLines = fromText.split(/\r?\n/);
  const toLines = toText.split(/\r?\n/);
  const m = fromLines.length;
  const n = toLines.length;

  // LCS 动态规划表
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]!;
    const nextRow = dp[i + 1]!;
    for (let j = n - 1; j >= 0; j--) {
      row[j] = fromLines[i] === toLines[j] ? (nextRow[j + 1] ?? 0) + 1 : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let lineNum = 0;
  while (i < m && j < n) {
    const row = dp[i]!;
    const nextRow = dp[i + 1]!;
    if (fromLines[i] === toLines[j]) {
      result.push({ lineNumber: lineNum++, content: fromLines[i]!, diffType: 'equal' });
      i++;
      j++;
    } else if ((nextRow[j] ?? 0) >= (row[j + 1] ?? 0)) {
      result.push({ lineNumber: lineNum, content: fromLines[i]!, diffType: 'delete' });
      i++;
    } else {
      result.push({ lineNumber: lineNum++, content: toLines[j]!, diffType: 'add' });
      j++;
    }
  }
  while (i < m) result.push({ lineNumber: lineNum, content: fromLines[i++]!, diffType: 'delete' });
  while (j < n) result.push({ lineNumber: lineNum++, content: toLines[j++]!, diffType: 'add' });
  return result;
}

/** 比较两个文本文件。 */
export function compareTextFiles(fromPath: string, toPath: string): DiffResult {
  const { content: fromContent } = readFileContent(fromPath);
  const { content: toContent } = readFileContent(toPath);

  const diffLines = computeTextDiff(fromContent, toContent);
  const additions = diffLines.filter((d) => d.diffType === 'add').length;
  const deletions = diffLines.filter((d) => d.diffType === 'delete').length;

  return {
    additions,
    deletions,
    changes: additions + deletions,
    fromContent,
    toContent,
    changesList: diffLines.filter((d) => d.diffType !== 'equal').slice(0, 100),
  };
}

/** 比较两个二进制文件（基于哈希）。 */
export function compareBinaryFiles(fromPath: string, toPath: string): DiffResult {
  const fromHash = getFileHash(fromPath);
  const toHash = getFileHash(toPath);
  const fromSize = existsSync(fromPath) ? statSync(fromPath).size : 0;
  const toSize = existsSync(toPath) ? statSync(toPath).size : 0;

  if (fromHash === toHash) {
    return {
      additions: 0,
      deletions: 0,
      changes: 0,
      fromContent: `Binary (hash: ${fromHash.slice(0, 16)}, size: ${fromSize})`,
      toContent: `Binary (hash: ${toHash.slice(0, 16)}, size: ${toSize})`,
      changesList: [],
    };
  }

  const sizeDiff = toSize - fromSize;
  return {
    additions: Math.max(0, sizeDiff),
    deletions: Math.max(0, -sizeDiff),
    changes: 1,
    fromContent: `Binary (hash: ${fromHash.slice(0, 16)}, size: ${fromSize})`,
    toContent: `Binary (hash: ${toHash.slice(0, 16)}, size: ${toSize})`,
    changesList: [
      { lineNumber: 0, content: `Binary changed, size diff: ${sizeDiff} bytes`, diffType: 'modify' },
    ],
  };
}

/** 自动判断文件类型并比较。 */
export function compareFiles(fromPath: string, toPath: string): DiffResult {
  if (isTextFile(fromPath) && isTextFile(toPath)) {
    return compareTextFiles(fromPath, toPath);
  }
  return compareBinaryFiles(fromPath, toPath);
}

/** 计算两文件相似度（0-1）。 */
export function getSimilarity(fromPath: string, toPath: string): number {
  if (!isTextFile(fromPath) || !isTextFile(toPath)) {
    return getFileHash(fromPath) === getFileHash(toPath) ? 1.0 : 0.0;
  }
  const { lines: fromLines } = readFileContent(fromPath);
  const { lines: toLines } = readFileContent(toPath);
  if (fromLines.length === 0 && toLines.length === 0) return 1.0;
  if (fromLines.length === 0 || toLines.length === 0) return 0.0;

  // LCS 长度 / 较大行数
  const m = fromLines.length;
  const n = toLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    const row = dp[i]!;
    const nextRow = dp[i + 1]!;
    for (let j = n - 1; j >= 0; j--) {
      row[j] = fromLines[i] === toLines[j] ? (nextRow[j + 1] ?? 0) + 1 : Math.max(nextRow[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return (dp[0]?.[0] ?? 0) / Math.max(m, n);
}
