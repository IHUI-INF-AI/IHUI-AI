// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * did-you-mean 共享出口测试(吸收 G-937974)。
 *
 * 钉住四件事:
 *  ① 同词干优先:编辑器备份形态 `x.ts.bak`(误写)⇒ `x.ts`(存在)—— 此时双方
 *     "剥一层扩展名"的主干并不相等,必须靠"候选名 == 目标主干"这条才判得出;
 *  ② 无同词干时退 levenshtein ≤ 3(`edt.ts` ⇒ `edit.ts`);
 *  ③ 距离 > 3 / 目录条目 / 父目录列不了 ⇒ undefined,绝不硬造建议;
 *  ④ withMissingFileSuggestion 有建议追加、无建议原文逐字返回 ——
 *     建议是尽力而为的加项,缺席时错误文案与引入前一致。
 */
import { describe, expect, it, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  findSimilarFilename,
  levenshteinDistance,
  withMissingFileSuggestion,
} from '../src/util/file-suggest.js';

let workDir: string | undefined;

afterEach(() => {
  if (workDir) {
    fs.rmSync(workDir, { recursive: true, force: true });
    workDir = undefined;
  }
});

describe('levenshteinDistance', () => {
  it('经典对:kitten → sitting 距离 3', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  it('相同串 0;单字符增删 1;空串 = 对端长度', () => {
    expect(levenshteinDistance('edit.ts', 'edit.ts')).toBe(0);
    expect(levenshteinDistance('edt.ts', 'edit.ts')).toBe(1);
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });
});

/** 每次调用新建一个临时目录(注册进 afterEach 的清理名单) */
const mk = (): string => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-file-suggest-'));
  return workDir;
};

describe('findSimilarFilename(临时目录)', () => {
  it('同词干:备份形态 real.ts.bak ⇒ real.ts(候选名 == 目标主干分支)', () => {
    const dir = mk();
    fs.writeFileSync(path.join(dir, 'real.ts'), 'x');
    expect(findSimilarFilename(path.join(dir, 'real.ts.bak'))).toBe('real.ts');
  });

  it('同词干:候选主干与目标主干相同(app.ts ⇒ app.js),无关候选不让位', () => {
    const dir = mk();
    fs.writeFileSync(path.join(dir, 'app.js'), 'x');
    fs.writeFileSync(path.join(dir, 'other.md'), 'x');
    expect(findSimilarFilename(path.join(dir, 'app.ts'))).toBe('app.js');
  });

  it('无同词干时退 levenshtein ≤ 3(edt.ts ⇒ edit.ts)', () => {
    const dir = mk();
    fs.writeFileSync(path.join(dir, 'edit.ts'), 'x');
    fs.writeFileSync(path.join(dir, 'zzzzzzzz.qqq'), 'x');
    expect(findSimilarFilename(path.join(dir, 'edt.ts'))).toBe('edit.ts');
  });

  it('同词干多个候选 ⇒ 排序后取第一个(结果稳定可复现)', () => {
    const dir = mk();
    fs.writeFileSync(path.join(dir, 'config.yml'), 'x');
    fs.writeFileSync(path.join(dir, 'config.yaml'), 'x');
    expect(findSimilarFilename(path.join(dir, 'config.json'))).toBe('config.yaml');
  });

  it('距离 > 3 的候选不硬造建议 ⇒ undefined', () => {
    const dir = mk();
    fs.writeFileSync(path.join(dir, 'completely-unrelated-name.pdf'), 'x');
    expect(findSimilarFilename(path.join(dir, 'zzzzzz.docx'))).toBe(undefined);
  });

  it('目录条目不是候选(只列 file/symlink;距离 1 也救不回) ⇒ undefined', () => {
    const dir = mk();
    fs.mkdirSync(path.join(dir, 'adirectory'));
    expect(findSimilarFilename(path.join(dir, 'adirectoryx'))).toBe(undefined);
  });

  it('父目录不存在 ⇒ undefined(尽力而为,不抛错)', () => {
    const dir = mk();
    expect(findSimilarFilename(path.join(dir, 'no-such-dir', 'a.txt'))).toBe(undefined);
  });
});

describe('withMissingFileSuggestion(共享出口)', () => {
  it('有建议 ⇒ 追加 "Did you mean …?";无建议 ⇒ 原文逐字返回', () => {
    const dir = mk();
    fs.writeFileSync(path.join(dir, 'real.ts'), 'x');
    expect(withMissingFileSuggestion('文件不存在: real.ts.bak', path.join(dir, 'real.ts.bak'))).toBe(
      '文件不存在: real.ts.bak Did you mean real.ts?',
    );
    expect(withMissingFileSuggestion('文件不存在: nothing-here', path.join(dir, 'nothing-here'))).toBe(
      '文件不存在: nothing-here',
    );
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
