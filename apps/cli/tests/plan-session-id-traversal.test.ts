// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 计划文件会话 id 路径穿越回归。
 *
 * `plan-${sessionId}.json` 里的 sessionId 来自会话(不可信):`../`、绝对路径、盘符
 * 都不得把计划文件写出 `<workspace>/.ihui`;符号链接指向根外也必须拒。
 * 反向对照:合法 UUID 的路径逐字不变。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// 夹具唯一落点(AGENTS §26):一律不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

import { planFilePath } from '../src/plan/structured.js';

let tmpWorkspace: string;

beforeEach(() => {
  tmpWorkspace = mkScratch('plan-id-tr-');
});

afterEach(() => {
  rmScratch(tmpWorkspace);
});

describe('计划文件会话 id 路径穿越', () => {
  it('合法 UUID 路径逐字不变', () => {
    const id = '2f8a1c4e-5b6d-4a3f-9c1e-7d8e9f0a1b2c';
    expect(planFilePath(tmpWorkspace, id)).toBe(path.join(tmpWorkspace, '.ihui', `plan-${id}.json`));
  });

  it.each(['../../evil', '../../../escaped', '/etc/passwd', 'C:\\Windows\\evil'])(
    'id %s 的落点仍在 .ihui 内',
    (id) => {
      const root = path.resolve(tmpWorkspace, '.ihui');
      const p = planFilePath(tmpWorkspace, id);
      expect(p.startsWith(root + path.sep)).toBe(true);
      expect(path.dirname(p)).toBe(root);
    },
  );

  it('恶意 id 实际写盘也不会落到 .ihui 外', () => {
    const p = planFilePath(tmpWorkspace, '../../../escaped');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '{}', 'utf-8');
    expect(fs.existsSync(path.join(tmpWorkspace, '..', 'escaped.json'))).toBe(false);
    expect(fs.existsSync(path.join(tmpWorkspace, 'escaped.json'))).toBe(false);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('裸 `..` 直接拒绝', () => {
    expect(() => planFilePath(tmpWorkspace, '..')).toThrow(/拒绝路径段/);
    expect(() => planFilePath(tmpWorkspace, '.')).toThrow(/拒绝路径段/);
  });

  it('计划文件为指向根外的符号链接时拒绝写入', async (ctx) => {
    const outside = mkScratch('plan-id-tr-outside-');
    const outsideFile = path.join(outside, 'target.json');
    fs.writeFileSync(outsideFile, '{}', 'utf-8');
    const id = 'link-session';
    const root = path.resolve(tmpWorkspace, '.ihui');
    const target = path.join(root, `plan-${id}.json`);
    try {
      fs.mkdirSync(root, { recursive: true });
      fs.symlinkSync(outsideFile, target, 'file');
    } catch {
      rmScratch(outside);
      ctx.skip();
      return;
    }
    try {
      expect(() => planFilePath(tmpWorkspace, id)).toThrow(/符号链接解析后落在.*之外/);
    } finally {
      try {
        fs.unlinkSync(target);
      } catch {
        /* 链接已不存在 */
      }
      rmScratch(outside);
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
