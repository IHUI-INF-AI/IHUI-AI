// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-072 回归:技能包配额必须在**整包读入内存之前**生效。
 *
 * 判据:归档本体超过 `SKILL_ARCHIVE_MAX_BYTES` 时,`verifySkillPackage` 在
 * `fs.readFileSync` 之前就拒绝,错误码是配额超限(而不是读入后解析出来的结构错误),
 * 且明确点名"未读入内存"。
 */
import { afterAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { verifySkillPackage } from '../src/skills/packaging/verify.js';
import { SKILL_ARCHIVE_MAX_BYTES } from '../src/skills/packaging/tar.js';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f-072-'));

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('F-072 技能包归档本体上限', () => {
  it('上限与解析期展开配额同源(512 MB 展开档 + 每条目头余量)', () => {
    expect(SKILL_ARCHIVE_MAX_BYTES).toBeGreaterThan(512 * 1024 * 1024);
    expect(SKILL_ARCHIVE_MAX_BYTES).toBe(512 * 1024 * 1024 + 20_000 * 512 * 2);
    expect(Number.isInteger(SKILL_ARCHIVE_MAX_BYTES)).toBe(true);
  });

  it('超过上限的稀疏文件:直接拒绝,不读入内存', () => {
    const packagePath = path.join(tempRoot, 'huge.ihui-skill');
    fs.writeFileSync(packagePath, '');
    fs.truncateSync(packagePath, SKILL_ARCHIVE_MAX_BYTES + 1);
    expect(fs.statSync(packagePath).size).toBe(SKILL_ARCHIVE_MAX_BYTES + 1);

    // node:fs 的 ESM 命名空间不可 spy(属性不可配置),故用两条可观测证据:
    //   1. 错误码是"配额超限"(读入后才校验的话,零填充且非 512 倍数的归档只会报 ARCHIVE_INVALID);
    //   2. RSS 不随 531 MB 读入上涨(真读入至少涨数百 MB)。
    const rssBefore = process.memoryUsage().rss;
    const verdict = verifySkillPackage(packagePath);

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_ARCHIVE_QUOTA_EXCEEDED');
    expect(verdict.error?.detail.size).toBe(SKILL_ARCHIVE_MAX_BYTES + 1);
    expect(verdict.error?.detail.maxArchiveBytes).toBe(SKILL_ARCHIVE_MAX_BYTES);
    expect(String(verdict.error?.message)).toContain('未读入');
    expect(verdict.checks.map((check) => check.item)).toEqual(['archive-size']);
    expect(process.memoryUsage().rss - rssBefore).toBeLessThan(128 * 1024 * 1024);
  });

  it('文件不存在时仍走原来的 archive-read 错误(statSync 失败不误报配额)', () => {
    const verdict = verifySkillPackage(path.join(tempRoot, 'missing.ihui-skill'));

    expect(verdict.ok).toBe(false);
    expect(verdict.error?.code).toBe('SKILL_PKG_ARCHIVE_INVALID');
    expect(verdict.checks.map((check) => check.item)).toEqual(['archive-read']);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
