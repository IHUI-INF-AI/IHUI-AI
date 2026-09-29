// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 缺文件 did-you-mean(吸收 G-937974)。
 *
 * 文件工具(read_file / edit_file / delete_file)对不存在的路径报"文件不存在"时,
 * 附一个同目录里的近似名建议:模型把 `edit.ts` 打成 `edit.ts.bak`、`edt.ts` 这类
 * 近邻拼写时,一眼就能自修,不必再烧一轮 list_dir 往返。
 *
 * 规则(与上游 edit.ts/read.ts 的 findSimilarFilename 同形,只留这一份共享出口 ——
 * 上游在 edit.ts 与 read.ts 逐字重复两份,是否证 [C3] 点名的近重复结构,刻意不抄):
 *   1. 列父目录的文件与符号链接,排除目标名自身,按名称排序取稳定结果;
 *   2. **同词干优先**:候选的主干(去扩展名)与目标主干相同,或候选名恰好等于
 *      目标主干 —— 后者覆盖编辑器备份形态 `x.ts`(存在)↔ `x.ts.bak`(误写),
 *      此时双方"去一个扩展名"的主干并不相等(`edit.ts` vs `edit`),必须按
 *      "候选名 == 目标主干"才判得出;
 *   3. 否则 levenshtein 距离 ≤ 3 的第一个候选。
 * 目录列不了(不存在/无权限)一律返回 undefined:建议是尽力而为的加项,
 * 缺席时错误文案与引入前逐字相同,绝不因建议失败而改报错形状。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** 两串的 levenshtein 编辑距离(滚动数组,O(len(left)×len(right)) 内存 O(len(right))) */
export function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current: number[] = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + cost,
      );
    }
    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index]!;
    }
  }

  return previous[right.length] ?? 0;
}

/**
 * 在缺失路径的父目录里找最像的文件名;找不到/列不了目录返回 undefined。
 * @param missingAbsPath 缺失文件的绝对路径(父目录按它定位)
 */
export function findSimilarFilename(missingAbsPath: string): string | undefined {
  const parent = path.dirname(missingAbsPath);
  const targetName = path.basename(missingAbsPath);
  const targetStem = path.basename(missingAbsPath, path.extname(missingAbsPath));

  let entries: string[];
  try {
    entries = fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isFile() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .filter((name) => name !== targetName)
      .sort();
  } catch {
    return undefined;
  }

  // 同词干优先:候选主干与目标主干相同,或候选名恰等于目标主干(x.ts ↔ x.ts.bak 形态)
  const sameStem = entries.find(
    (name) => path.basename(name, path.extname(name)) === targetStem || name === targetStem,
  );
  if (sameStem) return sameStem;

  return entries.find((name) => levenshteinDistance(name, targetName) <= 3);
}

/**
 * 给"文件不存在"类错误文案追加 did-you-mean 建议(共享出口:所有文件工具的
 * 缺文件错误都从这里过,不许各写一份)。
 */
export function withMissingFileSuggestion(message: string, missingAbsPath: string): string {
  const suggestion = findSimilarFilename(missingAbsPath);
  return suggestion ? `${message} Did you mean ${suggestion}?` : message;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
