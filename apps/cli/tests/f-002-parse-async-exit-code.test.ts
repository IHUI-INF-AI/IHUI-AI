// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-002 回归:子命令 async action 失败时退出码必须是 1。
 *
 * 缺陷形态:`program.parse()` 是同步 API,commander 把 `_parseCommand` 的 Promise 丢弃,
 * async action 内的抛错只剩 `unhandledRejection`,而 crash-handler 旧代码只给
 * `uncaughtException` 落 `process.exitCode = 1` ⇒ CI/脚本把失败读成成功。
 *
 * 本仓 HEAD 已修(parseAsync + 两通道对称 exitCode),本文件是**本批补测**:把修复钉成
 * 源码形状断言,防止回退到同步 parse 或单通道退出码。
 * 不跑真实子进程:CLI 入口需 TS 变换与完整依赖图,形状断言已能覆盖两处失效点。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

function readSrc(rel: string): string {
  return readFileSync(join(SRC_DIR, rel), 'utf-8');
}

describe('F-002 async 子命令失败退出码', () => {
  const indexSrc = readSrc('index.ts');
  const crashSrc = readSrc('crash-handler.ts');

  it('index.ts 必须 await program.parseAsync(),不得再用同步 program.parse()', () => {
    expect(indexSrc).toContain('await program.parseAsync()');
    // 同步 parse 会把 async action 的 Promise 丢掉 —— 出现即缺陷回归。
    expect(/(^|[^A-Za-z])program\.parse\(\)/.test(indexSrc)).toBe(false);
  });

  it('index.ts 的 catch 统一把退出码钉成 1(不依赖 crash-handler 时序)', () => {
    const catchBlock = indexSrc.match(/catch\s*\([^)]*\)\s*\{[\s\S]{0,400}?process\.exitCode\s*=\s*1[\s\S]{0,200}?\}/);
    expect(catchBlock).not.toBeNull();
    // 该 catch 内不得用 process.exit 硬切(会丢 stdout 刷新与退出钩子;
    // 文件其余位置既有的 process.exit 属交互命令行为,不在本票范围)。
    expect(catchBlock![0]).not.toMatch(/process\.exit\(/);
  });

  it('crash-handler 的 unhandledRejection 通道也设 exitCode = 1(两通道对称)', () => {
    // 去重分支与正常收尾分支各一处:只要有一处只认 uncaughtException,CI 就会再读成成功。
    const guards =
      crashSrc.match(
        /source === 'uncaughtException' \|\| source === 'unhandledRejection'[\s\S]{0,240}?process\.exitCode\s*=\s*1/g,
      ) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });

  it('crash-handler 安装有 latch,重复调用不重复注册监听器', () => {
    expect(crashSrc).toMatch(/if \(installed\) return/);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
