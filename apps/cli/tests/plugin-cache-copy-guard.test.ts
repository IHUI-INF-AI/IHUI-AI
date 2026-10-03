// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-3#3:copyFileGuarded 守卫测试。
 *   - 字节相同二连写:第二次跳写,目标 mtime 不被触碰(读 mtimeNs 精确到纳秒对比);
 *   - 不同内容:正常写入;
 *   - EBUSY 瞬时占用:按 [25,50,100]ms 退避重试后成功;
 *   - 结构性错误(封闭集外):不模糊重试,原样上抛。
 *
 * EBUSY 用 vi.mock 部分模拟注入(仓内既有形态,见 tests/updater.test.ts);
 * 其余走真实现 + 临时目录真文件。
 */
import { afterAll, beforeAll, describe, expect, it, vi, type Mock } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { copyFileGuarded } from '../src/plugins/cache.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, copyFileSync: vi.fn(actual.copyFileSync) };
});

let CWD = '';
beforeAll(() => {
  CWD = mkScratch('plugin-cache-copy-guard-');
});
afterAll(() => {
  // teardown 尽力而为:Windows 句柄异步释放可致 EPERM(同族注释见 sandbox-output-loss-diagnosis.test.ts)
  try {
    rmScratch(CWD);
  } catch (err) {
    console.warn(`[plugin-cache-copy-guard] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

/** 被占位 vi.fn 包住的真实 copyFileSync(默认委托真实现,测试可注入一次性失败)。 */
function copyFn(): Mock {
  return fs.copyFileSync as unknown as Mock;
}

describe('copyFileGuarded(b75-3#3)', () => {
  it('同内容二连写:第二次跳写,copyFileSync 一次都不调,mtime 纳秒级不变', () => {
    const src = path.join(CWD, 'a.txt');
    const dest = path.join(CWD, 'b.txt');
    fs.writeFileSync(src, 'same-content');
    fs.writeFileSync(dest, 'same-content');
    const mtimeBefore = fs.statSync(dest, { bigint: true }).mtimeNs;
    copyFn().mockClear();
    copyFileGuarded(src, dest);
    expect(copyFn()).not.toHaveBeenCalled(); // 跳写 = 写路径根本没走
    expect(fs.statSync(dest, { bigint: true }).mtimeNs).toBe(mtimeBefore);
  });

  it('不同内容:正常写入,内容替换', () => {
    const src = path.join(CWD, 'a.txt');
    const dest = path.join(CWD, 'b.txt');
    fs.writeFileSync(dest, 'same-content');
    const mtimeBefore = fs.statSync(dest, { bigint: true }).mtimeNs;
    fs.writeFileSync(src, 'new-content');
    copyFn().mockClear();
    copyFileGuarded(src, dest);
    expect(copyFn()).toHaveBeenCalledTimes(1); // 内容不同 ⇒ 必须真写
    expect(fs.readFileSync(dest, 'utf-8')).toBe('new-content');
    // 不断言 mtime 前进:Windows FILETIME 实际分辨率粗(~15ms),快速连续写可能落同一
    // tick,not.toBe 偶发翻红是平台噪声非回归;跳写守卫的 mtime 不变证据由上一用例承担
    // (copyFileSync 零调用 + 同 tick 内 mtime 必不变,那里是不变量)。
    void mtimeBefore;
  });

  it('EBUSY 瞬时占用:退避重试后成功,总写入次数 = 必要次数', () => {
    const src = path.join(CWD, 'c.txt');
    const dest = path.join(CWD, 'd.txt');
    fs.writeFileSync(src, 'retry-content');
    fs.rmSync(dest, { force: true });
    copyFn().mockClear();
    copyFn().mockImplementationOnce(() => {
      throw Object.assign(new Error('EBUSY: resource busy'), { code: 'EBUSY' });
    });
    copyFileGuarded(src, dest);
    expect(copyFn()).toHaveBeenCalledTimes(2); // 第一次 EBUSY,退避 25ms 后第二次成功
    expect(fs.readFileSync(dest, 'utf-8')).toBe('retry-content');
  });

  it('结构性错误不模糊吞错:目标是个目录 ⇒ 最终上抛(POSIX EISDIR 一次即抛;Windows 报 EPERM 属票面重试集,退避耗尽后上抛)', () => {
    const src = path.join(CWD, 'a.txt');
    const destDir = path.join(CWD, 'dir-dest');
    fs.mkdirSync(destDir, { recursive: true });
    copyFn().mockClear();
    expect(() => copyFileGuarded(src, destDir)).toThrow();
    // Windows 对"目标是目录"的 copyFileSync 报 EPERM(在 [EACCES,EBUSY,EPERM] 重试集内)
    // ⇒ 走满 4 次退避再抛;POSIX 报 EISDIR(封闭集外)⇒ 一次即抛。两平台都收敛,次数不同。
    expect([1, 4]).toContain(copyFn().mock.calls.length);
  });

  it('源不存在(ENOENT):statSync 预检先拦,原样上抛且写调用根本不发生', () => {
    copyFn().mockClear();
    expect(() => copyFileGuarded(path.join(CWD, 'no-such-src.txt'), path.join(CWD, 'any-dest.txt'))).toThrow();
    // 源存在性是复制的前置:statSync(src) 预检直接拦下,copyFileSync 一次都不该被调
    expect(copyFn()).not.toHaveBeenCalled();
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠