// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 17 批:凭据文件写入口(0600 的真实语义)。
 *
 * 本批要钉住的**不是**"有没有传 mode",而是那条容易被忽略的平台事实:
 *   `fs.writeFileSync(p, data, { mode: 0o600 })` 的 mode **只在文件不存在时生效**;
 *   文件已存在时一个权限位都不改。
 * 于是"给 writeFileSync 加 mode"这种改法对**存量** settings.json 完全无效 ——
 * 而 settings.json 里住的是 accessToken / refreshToken / apiKey,绝大多数机器上
 * 这个文件早就以默认 0644 落过盘。第 14 批那三处就是这么改的,本轮实测推翻。
 *
 * 用例:
 *  A 新建 ⇒ 权限 0600(POSIX;Windows 无 POSIX 位,只断言写入成功并点名原因)
 *  B **已存在的 0644 文件**被写后收到 0600 —— 摘掉 chmodSync 这一步即翻红(变异自证目标)
 *  C 内容逐字写入(改权限不得顺手改坏数据)
 *  D 回归面:CLI 全仓不得再有"写 settings.json 只给 mode 不 chmod"的形态
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writePrivateFile } from '../src/lib/private-file.js';

const isPosix = process.platform !== 'win32';
const modeBits = (p: string): number => fs.statSync(p).mode & 0o777;

describe('writePrivateFile(凭据落盘唯一写入口)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-private-file-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('A 新建文件按 0600 落盘', () => {
    const p = path.join(tmpDir, 'settings.json');
    writePrivateFile(p, '{"apiKey":"k"}\n');
    expect(fs.existsSync(p)).toBe(true);
    if (isPosix) {
      expect(modeBits(p)).toBe(0o600);
    }
  });

  it('B 已存在的 0644 文件被写后收到 0600(writeFileSync 的 mode 做不到这一格)', () => {
    const p = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(p, '{"legacy":true}\n', { mode: 0o644 });
    if (isPosix) {
      // 前置事实必须先成立,否则这一格只是在测"文件系统不给 0644"
      expect(modeBits(p)).toBe(0o644);
    }

    writePrivateFile(p, '{"apiKey":"k"}\n');

    if (isPosix) {
      expect(modeBits(p)).toBe(0o600);
    }
    expect(fs.readFileSync(p, 'utf-8')).toBe('{"apiKey":"k"}\n');
  });

  it('C 内容逐字写入,不被权限步骤改坏', () => {
    const p = path.join(tmpDir, 'nested', 'settings.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const text = JSON.stringify({ apiKey: '中文与 emoji 🔐', n: 1 }, null, 2) + '\n';
    writePrivateFile(p, text);
    expect(fs.readFileSync(p, 'utf-8')).toBe(text);
  });
});

describe('回归面:settings.json 写点必须走唯一入口', () => {
  const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

  /** 列出仍裸 `fs.writeFileSync(settingsPath, …)` 的凭据写点(排除入口自身)。 */
  function offenders(): string[] {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === 'node_modules' || ent.name === 'dist') continue;
          walk(full);
        } else if (/\.tsx?$/.test(ent.name)) {
          files.push(full);
        }
      }
    };
    walk(path.join(root, 'src'));
    const hits: string[] = [];
    for (const f of files) {
      if (f.endsWith(path.join('lib', 'private-file.ts'))) continue;
      const src = fs.readFileSync(f, 'utf-8');
      src.split('\n').forEach((line, i) => {
        // 判据只认凭据文件那一个变量名。曾经也匹配裸 `p`,把 state-store / todo-write
        // 这类同名局部变量的非凭据写入一起算成违规 —— 那是误伤,不是漏洞。
        if (/writeFileSync\(\s*settingsPath\b/.test(line)) {
          hits.push(`${path.relative(root, f)}:${i + 1}`);
        }
      });
    }
    return hits;
  }

  it('src 下不再有裸 writeFileSync(settingsPath, …) 的凭据写点', () => {
    expect(offenders()).toEqual([]);
  });

  it('本入口自身确实执行了 chmod(判据不是"看起来调用了")', () => {
    const src = fs.readFileSync(path.join(root, 'src', 'lib', 'private-file.ts'), 'utf-8');
    expect(src).toContain('chmodSync');
    expect(src).toContain('mode: 0o600');
  });

  it('变异自证夹具:把 chmodSync 摘掉后,B 组断言的依据消失', () => {
    // 只读校验:证明"仅 writeFileSync + mode"这一形态在已存在文件上不改权限
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-cli-mutation-'));
    try {
      const p = path.join(dir, 's.json');
      fs.writeFileSync(p, 'x', { mode: 0o644 });
      fs.writeFileSync(p, 'y', { mode: 0o600 }); // 不带 chmod 的那条路
      if (isPosix) {
        expect(modeBits(p)).toBe(0o644);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
