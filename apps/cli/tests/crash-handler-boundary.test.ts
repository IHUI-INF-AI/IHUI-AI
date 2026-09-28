// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * crash-handler 进程级异常边界回归(G-610,2026-09-29 立)。
 *
 * 钉住三格被修复的缺陷(成因注释见 apps/cli/src/crash-handler.ts 本体):
 *  ① 同一错误对象被双通道投递 ⇒ 只产 1 份文件、Kind 唯一、打印不重复
 *     (旧:无 latch + 文件名以毫秒单键 ⇒ 后一份原地覆盖前一份,"报了两次"账面却是"一次没报全");
 *  ② 两个不同错误 ⇒ 产 2 份(latch 不得把不同故障也吞掉);
 *  ③ 打印通道自身抛(EPIPE 形态)⇒ 处理器不向外二次抛、已落盘结论不被破坏、退出码仍生效;
 *  ④ 同毫秒两个不同错误 ⇒ 两份不同文件名都在(随机段撞名防线);
 *  ⑤ 既有字段名 / 目录形态 / 打印字样与改动前逐字同形(回归对照)。
 * 另含 monitor 通道的生产时序复现(Node 先 uncaughtExceptionMonitor、后 uncaughtException):
 * monitor 先报、uncaughtException 路去重但退出码不丢。
 *
 * 测试隔离:全程 virtual fs(Map),绝不真写 ~/.ihui/crash-logs,不产生真实磁盘副作用;
 * 消息一律用哨兵字面量(SENTINEL-*),不含任何凭据或真实用户内容(§5c/§5e 同一条禁令)。
 * 入口口径:走生产入口 —— 派发 process.emit(真实触发已装监听器),测试内不内联第二份
 * latch/去重逻辑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type * as fsType from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/** 与现网日志目录存量同款的 13 位毫秒(把"同一毫秒"这一时序钉死进用例) */
const FIXED_MS = 1785473250678;

const vstate = vi.hoisted(() => ({
  dirExists: true,
  /**
   * 全路径 → 内容。Map 语义即"落盘集合":同名写入互相覆盖(缺陷①②的旧症状在这里
   * 会被量成 size 少 1),不同名各自保留 —— 断言 size 就是断言"落了几份结论"。
   */
  files: new Map<string, string>(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof fsType;
  return {
    ...actual,
    existsSync: vi.fn((p: unknown) =>
      String(p).endsWith('.log') ? vstate.files.has(String(p)) : vstate.dirExists,
    ),
    mkdirSync: vi.fn(() => undefined),
    readdirSync: vi.fn(() => [...vstate.files.keys()].map((p) => path.basename(p)) as unknown as string[]),
    statSync: vi.fn((p: unknown) => {
      // 与既有 crash-handler.test.ts 的夹具同形:prune 按 mtimeMs 排序,虚拟名给常量即可
      return { mtimeMs: vstate.files.has(String(p)) ? 1 : 0 } as unknown as fsType.Stats;
    }),
    unlinkSync: vi.fn((p: unknown) => {
      vstate.files.delete(String(p));
    }),
    writeFileSync: vi.fn((p: unknown, data: unknown) => {
      vstate.files.set(String(p), String(data));
    }),
    readFileSync: vi.fn(() => '{"version":"1.0.0-test"}'),
  };
});

import { installCrashHandler, uninstallCrashHandler } from '../src/crash-handler.js';

function firstWritten(): { filepath: string; content: string } {
  const entries = [...vstate.files.entries()];
  const [filepath = '', content = ''] = entries[0] ?? [];
  return { filepath, content };
}

describe('crash-handler 进程级异常边界(G-610)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let initialExitCode: number | undefined;
  let initialUncaught: Array<(...args: never[]) => void>;
  let initialUnhandled: Array<(...args: never[]) => void>;
  let initialMonitor: Array<(...args: never[]) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    vstate.dirExists = true;
    vstate.files.clear();

    initialUncaught = process.listeners('uncaughtException');
    initialUnhandled = process.listeners('unhandledRejection');
    initialMonitor = process.listeners('uncaughtExceptionMonitor');

    uninstallCrashHandler();
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtExceptionMonitor');

    initialExitCode = process.exitCode;
    process.exitCode = undefined;

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    uninstallCrashHandler();
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtExceptionMonitor');
    initialUncaught.forEach((l) => process.on('uncaughtException', l));
    initialUnhandled.forEach((l) => process.on('unhandledRejection', l));
    initialMonitor.forEach((l) => process.on('uncaughtExceptionMonitor', l));
    process.exitCode = initialExitCode;
    // 同时还原 Date.now 与 console.error 的 spy(vi.mock 的模块替身不受 restore 影响)
    vi.restoreAllMocks();
  });

  it('①A 同一错误对象双路触发(uncaughtException 先达)⇒ 只产 1 份文件、Kind 唯一、不重复打印', () => {
    installCrashHandler();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_MS);
    const err = new Error('SENTINEL-dual-a');

    process.emit('uncaughtException', err);
    const printedAfterFirst = consoleErrorSpy.mock.calls.length;
    process.emit('unhandledRejection', err);

    expect(vstate.files.size).toBe(1);
    const { content } = firstWritten();
    expect(content).toContain('Kind: uncaughtException\n');
    // Kind 恰出现一次且值唯一 —— "留下的那份随调度顺序变"这一型被钉死
    expect((content.match(/^Kind: /gm) ?? []).length).toBe(1);
    // 后到的通道不产第二条结论:打印次数停在第一次
    expect(consoleErrorSpy.mock.calls.length).toBe(printedAfterFirst);
    expect(process.exitCode).toBe(1);
  });

  it('①B 反向顺序(unhandledRejection 先达)⇒ 仍只 1 份,Kind=unhandledRejection,uncaughtException 路退出码仍生效', () => {
    installCrashHandler();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_MS);
    const err = new Error('SENTINEL-dual-b');

    process.emit('unhandledRejection', err);
    process.emit('uncaughtException', err);

    expect(vstate.files.size).toBe(1);
    const { content } = firstWritten();
    expect(content).toContain('Kind: unhandledRejection\n');
    // 去重只抑制"结论",不抑制退出码语义(真实异常经此路仍须 exitCode=1)
    expect(process.exitCode).toBe(1);
  });

  it('monitor 通道生产时序:monitor 先报 ⇒ Kind 留档 monitor;后续 uncaughtException 去重但退出码不丢', () => {
    installCrashHandler();
    const err = new Error('SENTINEL-monitor-path');

    process.emit('uncaughtExceptionMonitor', err, 'uncaughtException');
    expect(vstate.files.size).toBe(1);
    expect(firstWritten().content).toContain('Kind: monitor\n');

    process.emit('uncaughtException', err);
    expect(vstate.files.size).toBe(1); // 去重:不产第二份
    expect(process.exitCode).toBe(1); // 退出码语义不随去重丢失
  });

  it('② 两个不同错误 ⇒ 两份文件、两种内容都在(latch 不吞不同故障)', () => {
    installCrashHandler();

    process.emit('uncaughtException', new Error('SENTINEL-alpha'));
    process.emit('uncaughtException', new Error('SENTINEL-beta'));

    expect(vstate.files.size).toBe(2);
    const all = [...vstate.files.values()].join('\n');
    expect(all).toContain('SENTINEL-alpha');
    expect(all).toContain('SENTINEL-beta');
  });

  it('③ 打印通道自身抛(EPIPE 形态)⇒ 处理器不二次抛、已落盘结论不被破坏、退出码仍生效', () => {
    installCrashHandler();
    // 模拟 stderr 被关:console.error 一被调用就抛(旧代码此时会从监听器内部二次抛出)
    consoleErrorSpy.mockImplementation(() => {
      throw new Error('SENTINEL-EPIPE-simulated');
    });

    const err = new Error('SENTINEL-epipe-crash');
    expect(() => process.emit('uncaughtException', err)).not.toThrow();

    // 结论先落盘(写文件在打印之前),且内容完整未破坏
    expect(vstate.files.size).toBe(1);
    const { content } = firstWritten();
    expect(content).toContain('SENTINEL-epipe-crash');
    expect(content.endsWith('=== End of report ===')).toBe(true);
    // 退出码不依赖打印成功
    expect(process.exitCode).toBe(1);
  });

  it('④ 同毫秒两个不同错误 ⇒ 两个不同文件名都在(随机段撞名防线)', () => {
    installCrashHandler();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_MS);

    process.emit('uncaughtException', new Error('SENTINEL-same-ms-1'));
    process.emit('uncaughtException', new Error('SENTINEL-same-ms-2'));

    expect(vstate.files.size).toBe(2);
    const names = [...vstate.files.keys()].map((p) => path.basename(p));
    expect(new Set(names).size).toBe(2);
    for (const n of names) {
      // 既有形态不变:"crash- + 纯数字 + .log"(prune 的过滤与既有回归断言都按它识别)
      expect(n).toMatch(/^crash-\d+\.log$/);
      const digits = n.slice('crash-'.length, -'.log'.length);
      // 毫秒仍是前缀(可发现性),其后追加随机数字段 ⇒ 不再是纯毫秒单键
      expect(digits.startsWith(String(FIXED_MS))).toBe(true);
      expect(digits.length).toBeGreaterThan(String(FIXED_MS).length);
    }
  });

  it('⑤ 既有字段名与目录形态:与改动前逐字同形(回归对照)', () => {
    installCrashHandler();
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_MS);
    const err = new Error('SENTINEL-shape');
    err.stack = 'Error: SENTINEL-shape\n    at probe:1:1';

    process.emit('uncaughtException', err);

    const { filepath, content } = firstWritten();
    // 目录位置逐字同旧(~/.ihui/crash-logs),文件名仍 crash-*.log
    expect(filepath.startsWith(path.join(os.homedir(), '.ihui', 'crash-logs'))).toBe(true);
    expect(path.basename(filepath)).toMatch(/^crash-\d+\.log$/);
    // 报告字段名全部原样在位(一行不少、一列不改)
    for (const probe of [
      '=== IHUI CLI Crash Report ===',
      `Time: ${new Date(FIXED_MS).toISOString()}`,
      'Kind: uncaughtException',
      'Version: 1.0.0-test',
      '## Error',
      'Name: Error',
      'Message: SENTINEL-shape',
      'Stack:',
      'Error: SENTINEL-shape',
      'at probe:1:1',
      '## Runtime',
      `Node: ${process.version}`,
      `Platform: ${process.platform} ${process.arch}`,
      `PID: ${process.pid}`,
      `cwd: ${process.cwd()}`,
      `argv: ${process.argv.join(' ')}`,
      '=== End of report ===',
    ]) {
      expect(content).toContain(probe);
    }
    // 用户可见打印字样与旧版同(Crash log 路径行 + GitHub issue 提示)
    const printed = consoleErrorSpy.mock.calls.flat().map(String).join('\n');
    expect(printed).toContain('Crash log');
    expect(printed).toContain('GitHub issue');
    expect(printed).toContain('SENTINEL-shape');
  });

  it('throw 原始值无身份可比 ⇒ 同值两次也各自落盘(失效方向:宁多喊,不静默)', () => {
    installCrashHandler();
    const thrown = 'SENTINEL-primitive-value';

    process.emit('uncaughtException', thrown);
    process.emit('uncaughtException', thrown);

    // 非对象没有可比身份,一律照报 —— 即便同值;两份都保住靠的是随机段文件名(缺陷②防线)
    expect(vstate.files.size).toBe(2);
    expect(vstate.files.size).toBe(new Set(vstate.files.keys()).size);
  });

  it('install 幂等不因新增 monitor 通道而重复注册', () => {
    const before = process.listenerCount('uncaughtExceptionMonitor');
    installCrashHandler();
    expect(process.listenerCount('uncaughtExceptionMonitor')).toBe(before + 1);
    installCrashHandler();
    expect(process.listenerCount('uncaughtExceptionMonitor')).toBe(before + 1);
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
