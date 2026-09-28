// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 沙盒输出截断量纲 + "空输出+非零退出"的现场文件系统诊断测试。
 *
 * 如实登记的取证边界(重要,读结论时带上):
 *  - 本机(Windows / G: 盘)**造不出真满盘**,且 NTFS 根本不上报 inode 维度
 *    —— 现测 `fs.statfsSync('G:/IHUI-AI', { bigint: true })` 返回 files=0、ffree=0。
 *    所以 ⑦ 族"必须点名"全部走**注入面证明**(生产结算函数 settable 的 statfs 出口),
 *    **不是真机复现**;而"健康文件系统不得点名"(⑥)与漏报截断的真机形态走
 *    runSandboxed 的**真机默认探针**,两个方向各有可跑的对照。
 *  - files=0/ffree=0 一律归一为"该轴测不到"(null),不得读成 inode 已尽 ——
 *    否则 Windows 上每次空输出非零退出都会被误诊(与"判不出不得写成结论"同一条禁令)。
 *
 * 变异对照(改回旧写法必须翻红的断言):
 *  ② Buffer.byteLength 换回 `.length` ⇒ 1000 汉字 / 1KB 预算用例翻红;
 *  ③ 诊断门改成"凡空输出就诊断"(去掉 statfs 判据)⇒ 真机与注入面的"不得点名"用例翻红。
 *
 * 断言只喂生产入口(settleSpawnSyncOutcome / runSandboxed),不内联第二份归因逻辑。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runSandboxed, settleSpawnSyncOutcome, type FsSpaceProbeResult } from '../src/sandbox/index.js';
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'; // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28

let CWD = '';
beforeAll(() => {
  CWD = mkScratch('sandbox-output-loss-diagnosis-');
});
afterAll(() => {
  // teardown 尽力而为:Windows 句柄异步释放可致 EPERM(同族注释见 sandbox-exit-attribution.test.ts);
  // 失败目录由 scratch-dir 的进程退出回收 + §26 每日 Temp 体检兜底,不炸已判定的套件。
  try {
    rmScratch(CWD);
  } catch (err) {
    console.warn(`[sandbox-output-loss-diagnosis] 夹具目录清理失败(忽略,不影响判定): ${String(err)}`);
  }
});

const MIB = 1024n * 1024n;

/** 构造 statfs 读数(单位:MB 与 inode 数;null=该轴不报,与生产归一口径同形)。 */
function probeResult(availableMB: bigint | null, freeInodes: bigint | null): FsSpaceProbeResult {
  return {
    availableBytes: availableMB === null ? null : availableMB * MIB,
    freeInodes,
  };
}

/** 空输出 + 非零退出 + 无 signal 的最小形状(归因必落 failed,才会进诊断门)。 */
const emptyNonZero = { status: 1, signal: null, stdout: '', stderr: '' } as const;

function settleWith(statfs: (path: string) => FsSpaceProbeResult, outcome = emptyNonZero) {
  return settleSpawnSyncOutcome({ ...outcome }, { cwd: CWD, maxOutputBytes: 1024, statfs });
}

describe('⑤ 截断标志与 maxBuffer 同量纲(字节,不是字符数)', () => {
  it('1000 个汉字 + 1KB 预算 ⇒ truncated=true(旧 .length=1000<1024 会漏报,本行即反证)', () => {
    const han = '汉'.repeat(1000);
    // 量纲自证:字符数落在预算之下,字节数在预算之上 —— 这正是 HEAD 漏报的区间
    expect(han.length).toBe(1000);
    expect(Buffer.byteLength(han, 'utf8')).toBe(3000);
    const s = settleSpawnSyncOutcome(
      { status: 0, signal: null, stdout: han, stderr: '' },
      { cwd: CWD, maxOutputBytes: 1024 },
    );
    // Buffer.byteLength 换回 .length ⇒ 本行翻红(变异②)
    expect(s.truncated).toBe(true);
    expect(s.failureKind).toBeNull(); // 截断归截断,不借道改失败分型
  });

  it('不得放宽过头:1000 个 ASCII 字符 + 1KB 预算 ⇒ truncated=false;恰好 1024 字节 ⇒ true(>= 语义未变)', () => {
    const ascii = 'a'.repeat(1000);
    const under = settleSpawnSyncOutcome({ status: 0, signal: null, stdout: ascii, stderr: '' }, { cwd: CWD, maxOutputBytes: 1024 });
    expect(under.truncated).toBe(false);
    const exact = settleSpawnSyncOutcome({ status: 0, signal: null, stdout: 'a'.repeat(1024), stderr: '' }, { cwd: CWD, maxOutputBytes: 1024 });
    expect(exact.truncated).toBe(true);
  });

  it('真机中文输出:1000 汉字(3000B)+ 1024B 预算 ⇒ 截断成立且不再冒充超时', () => {
    // 用 \u6c49 转义保持命令行纯 ASCII,避开 cmd 码页对源串的改写
    const r = runSandboxed('node -e "process.stdout.write(\'\\u6c49\'.repeat(1000))"', {
      cwd: CWD,
      maxOutputBytes: 1024,
    });
    expect(r.truncated).toBe(true);
    expect(r.failureKind).toBe('output_limit');
    expect(r.timedOut).toBe(false);
  }, 20000);
});

describe('⑥ 正常文件系统上"空输出+非零"不得被诊断成丢失', () => {
  it('真机默认探针(本机 G: 盘健康、NTFS 不报 inode ⇒ 两轴"健康/测不到")⇒ stderr 一字不加', () => {
    const r = runSandboxed('node -e "process.exit(3)"', { cwd: CWD });
    expect(r.exitCode).toBe(3);
    expect(r.stdout).toBe('');
    expect(r.failureKind).toBe('failed');
    // 变异③("凡空输出就诊断")去掉 statfs 判据 ⇒ 本行被塞进根因文案而翻红
    expect(r.stderr).toBe('');
    expect(r.fsExhaustion).toBeUndefined();
  }, 20000);

  it('真机正常无输出命令(touch 等价:成功退出零输出)⇒ 归因正常,更不是丢失', () => {
    const r = runSandboxed('node -e "void 0"', { cwd: CWD });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.failureKind ?? null).toBeNull();
    expect(r.stderr).toBe('');
  }, 20000);

  it('注入面健康读数(512GB 空闲 / 100 万 inode)⇒ 不点名、不调用之外的任何判据', () => {
    const s = settleWith(() => probeResult(512_000n, 1_000_000n));
    expect(s.failureKind).toBe('failed');
    expect(s.fsExhaustion).toBeUndefined();
    expect(s.stderr).toBe('');
  });

  it('两轴都测不到(files=0 型文件系统归一 null)⇒ 不冒充"inode 已尽",也不点名', () => {
    const s = settleWith(() => probeResult(512_000n, null));
    expect(s.failureKind).toBe('failed');
    expect(s.stderr).toBe('');
  });

  it('阈值边界:恰好 10MB / 恰好 1000 inode ⇒ 均不判已尽(判据是严格小于)', () => {
    const s = settleWith(() => probeResult(10n, 1000n));
    expect(s.failureKind).toBe('failed');
    expect(s.stderr).toBe('');
  });
});

describe('⑦ 满盘 / inode 尽必须点名并给人话出路(注入面证明,非真机复现)', () => {
  it('空间已尽(实测 5MB < 10MB 阈)⇒ fs_exhausted/space + 具体数字 + 清理出路', () => {
    const s = settleWith(() => probeResult(5n, null), emptyNonZero);
    expect(s.failureKind).toBe('fs_exhausted');
    expect(s.fsExhaustion).toBe('space');
    expect(s.stderr).toContain('空间已尽');
    expect(s.stderr).toContain('≈5MB'); // 点名的是实测数字,不是套话
    expect(s.stderr).toContain('请清理磁盘空间后重试');
  });

  it('inode 已尽(实测 ffree=900 < 1000 阈)⇒ fs_exhausted/inodes + ffree 数字 + 出路', () => {
    const s = settleWith(() => probeResult(512_000n, 900n), emptyNonZero);
    expect(s.failureKind).toBe('fs_exhausted');
    expect(s.fsExhaustion).toBe('inodes');
    expect(s.stderr).toContain('inode 已尽');
    expect(s.stderr).toContain('ffree=900');
    expect(s.stderr).toContain('inode 配额后重试');
  });

  it('两轴都尽 ⇒ fs_exhausted/both,两条根因都在场', () => {
    const s = settleWith(() => probeResult(1n, 10n), emptyNonZero);
    expect(s.failureKind).toBe('fs_exhausted');
    expect(s.fsExhaustion).toBe('both');
    expect(s.stderr).toContain('空间已尽');
    expect(s.stderr).toContain('inode 已尽');
  });

  it('诊断量的是命令的 cwd(现场),不是随便一条路径', () => {
    const seen: string[] = [];
    settleSpawnSyncOutcome({ ...emptyNonZero }, {
      cwd: CWD,
      maxOutputBytes: 1024,
      statfs: (p) => {
        seen.push(p);
        return probeResult(512_000n, 1_000_000n);
      },
    });
    expect(seen).toEqual([CWD]);
  });

  it('SIGKILL 哨兵 137 不进诊断门(OOM-kill 另有归因,不冒充文件系统)', () => {
    let probed = 0;
    const s = settleSpawnSyncOutcome({ status: 137, signal: null, stdout: '', stderr: '' }, {
      cwd: CWD,
      maxOutputBytes: 1024,
      statfs: () => {
        probed += 1;
        return probeResult(0n, 0n);
      },
    });
    expect(probed).toBe(0);
    expect(s.failureKind).toBe('failed');
    expect(s.stderr).toBe('');
  });

  it('探针本身查不到 ⇒ 喊"未判定"并保留原错误,既不点名根因也不当作什么都没发生', () => {
    const s = settleWith(() => {
      throw new Error('EPERM: 文件系统状态不可查询');
    });
    expect(s.failureKind).toBe('failed');
    expect(s.fsExhaustion).toBeUndefined();
    expect(s.stderr).toContain('未判定');
    expect(s.stderr).toContain('文件系统状态无法查询');
    expect(s.stderr).toContain('EPERM');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
