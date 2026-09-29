// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b75-4#8:原子写 tmp 独占创建守卫测试(O_EXCL 撞车拒绝 / POSIX O_NOFOLLOW ELOOP refuse /
 * symlink refuse 既有拒绝面不放松 / 全流程可用性不回归)。真文件 + 临时目录,不 mock。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { __test__, captureWriteBaseline, commitAtomicWrite } from '../src/util/atomic-write.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

const itPosix = process.platform === 'win32' ? it.skip : it;

let CWD = '';
beforeAll(() => {
  CWD = mkScratch('atomic-write-write-guards-');
});
afterAll(() => {
  // teardown 尽力而为:Windows 句柄异步释放可致 EPERM(同族注释见 sandbox-output-loss-diagnosis.test.ts)
  try {
    rmScratch(CWD);
  } catch (err) {
    console.warn(`[atomic-write-write-guards] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

describe('b75-4#8 tmp 独占创建守卫(O_EXCL|O_NOFOLLOW)', () => {
  it('O_EXCL:同一 tmp 路径第二次创建必须 EEXIST,绝不静默截断既有文件', () => {
    const target = path.join(CWD, 'out.txt');
    const tmp = __test__.tmpPathFor(target);
    const fd = __test__.openTmpExclusive(tmp);
    expect(fd).toBeGreaterThanOrEqual(0);
    fs.writeSync(fd, 'reserved');
    fs.closeSync(fd);
    let caught: NodeJS.ErrnoException | null = null;
    try {
      __test__.openTmpExclusive(tmp);
    } catch (e) {
      caught = e as NodeJS.ErrnoException;
    }
    expect(caught?.code).toBe('EEXIST');
    expect(fs.readFileSync(tmp, 'utf-8')).toBe('reserved'); // 先到者的内容完好
    fs.rmSync(tmp, { force: true });
  });

  it('tmp 命名约定未破坏:同目录、点前缀、带 pid(不跨卷 rename)', () => {
    const target = path.join(CWD, 'doc.txt');
    const tmp = __test__.tmpPathFor(target);
    expect(path.dirname(tmp)).toBe(CWD);
    expect(path.basename(tmp).startsWith('.doc.txt.tmp-')).toBe(true);
    expect(path.basename(tmp)).toContain(String(process.pid));
  });

  it('常规 commitAtomicWrite 全流程在守卫下依旧可用(新写 + 覆写)', () => {
    const f = path.join(CWD, 'doc.txt');
    commitAtomicWrite(captureWriteBaseline(f), 'v1');
    expect(fs.readFileSync(f, 'utf-8')).toBe('v1');
    commitAtomicWrite(captureWriteBaseline(f), 'v2');
    expect(fs.readFileSync(f, 'utf-8')).toBe('v2');
  });

  it('symlink refuse 依旧:写入目标是文件符号链接 ⇒ SymlinkTargetError(拒绝面不放松)', () => {
    const real = path.join(CWD, 'real.txt');
    fs.writeFileSync(real, 'x');
    const link = path.join(CWD, 'link.txt');
    let created = false;
    try {
      fs.symlinkSync(real, link, 'file');
      created = true;
    } catch {
      // 无特权/开发者模式缺失建不了链接:该用例在具备特权的 CI 处兑现
    }
    if (!created) return;
    let err: unknown = null;
    try {
      captureWriteBaseline(link);
    } catch (e) {
      err = e;
    }
    expect((err as Error)?.name).toBe('SymlinkTargetError');
  });

  itPosix('O_NOFOLLOW:tmp 分量被换成符号链接 ⇒ ELOOP 映射为 SymlinkTargetError(Windows 由 lstat 判据承担)', () => {
    const real = path.join(CWD, 'eloop-real.txt');
    fs.writeFileSync(real, 'x');
    const link = path.join(CWD, 'eloop-link.txt');
    fs.symlinkSync(real, link, 'file');
    let err: unknown = null;
    try {
      __test__.openTmpExclusive(link);
    } catch (e) {
      err = e;
    }
    expect((err as Error)?.name).toBe('SymlinkTargetError');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
