// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-026 —— GBK(936 代码页)子进程输出被硬解成 UTF-8 的回归测试。
 *
 * 缺陷面:`chunk.toString('utf-8')` 把 GBK 中文解成 U+FFFD(路径/错误不可读)。
 * 修法面:两处解码点复用 `tools/sandbox/platform/output-encoding.ts` 的**流式**解码器
 * (`createStreamDecoder`):跨 chunk 被切两半的多字节序列先攒 pending,判不出 UTF-8
 * 才走 legacy 回退链。
 *
 * 覆盖:
 *   ① 后台任务捕获(`registerTask` 的 stdout 双窗口)—— GBK 中文、UTF-8 不回归;
 *   ② 跨 chunk 切分(0xD6 | 0xD0 0xCE 0xC4)—— 第一块不得吐 U+FFFD,拼齐后出"中文";
 *   ③ 终端降级路径(`terminal.ts` 的 spawnFallback,强制 node-pty 缺席)—— GBK 中文。
 *
 * 编码判定钉死用既有覆盖键 `IHUI_WINDOWS_OUTPUT_ENCODING=gb18030`(回退链 override 档),
 * 不依赖本机 chcp/locale,任何机器上结论一致。
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type * as nodeModule from 'node:module';
import type { ChildProcess } from 'node:child_process';

// 强制 node-pty 缺席 ⇒ terminal_open 走 spawnFallback(child_process),那才是本票改的解码点。
vi.mock('node:module', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof nodeModule;
  return {
    ...actual,
    createRequire: (url: string) => {
      const realRequire = actual.createRequire(url);
      return (id: string) => {
        if (id === 'node-pty') throw new Error('F-026:强制走 spawn 降级路径');
        return realRequire(id);
      };
    },
  };
});

// terminal_open 的安全闸门不是本票被测面:放行为免确认,执行链桩只留一条。
vi.mock('../src/tools/command-safety.js', () => ({
  gateCommandExecution: () => ({ dangerousPattern: null, autoApprovable: true, alwaysConfirm: false, destructive: false }),
  describeCommandBlock: () => null,
}));

// hooks 其余导出(background-registry 用的 runHook)照常真实,只拦 pre-tool 钩子。
vi.mock('../src/hooks/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, runPreToolCall: async () => ({ proceed: true }) };
});

import { registerTask, getTaskOutput, clearAllTasks } from '../src/tools/background-registry.js';
import { terminal_open, terminal_read, terminal_close } from '../src/tools/terminal.js';

/** 936 代码页下"中文"的字节 */
const GBK_ZHONGWEN = Buffer.from([0xd6, 0xd0, 0xce, 0xc4]);

const ENV_KEY = 'IHUI_WINDOWS_OUTPUT_ENCODING';
let origOverride: string | undefined;
const createdSessionIds: string[] = [];
const ctx = { workspacePath: process.cwd() };

beforeEach(() => {
  clearAllTasks();
  createdSessionIds.length = 0;
  origOverride = process.env[ENV_KEY];
  process.env[ENV_KEY] = 'gb18030';
});

afterEach(async () => {
  for (const id of createdSessionIds) {
    try {
      await terminal_close.execute({ sessionId: id }, ctx);
    } catch {
      /* 会话可能已退出 */
    }
  }
  clearAllTasks();
  if (origOverride === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = origOverride;
});

/** 与注册表捕获面同形的假子进程:stdout/stderr 是可 emit 的流 */
function fakeChild(): ChildProcess & { stdout: Readable; stderr: Readable } {
  const child = new EventEmitter() as unknown as ChildProcess & { stdout: Readable; stderr: Readable };
  child.stdout = new Readable({ read() {} });
  child.stderr = new Readable({ read() {} });
  return child;
}

describe('F-026 后台任务输出解码', () => {
  it('GBK 中文按 gb18030 解出,不出现 U+FFFD', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake gbk stdout');
    child.stdout.emit('data', GBK_ZHONGWEN);
    const out = getTaskOutput(id)!;
    expect(out.stdout).toBe('中文');
    expect(out.stdout).not.toContain('\uFFFD');
  });

  it('UTF-8 正常路径不回归', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake utf8 stdout');
    child.stdout.emit('data', Buffer.from('中文', 'utf8'));
    child.stderr.emit('data', Buffer.from('错误:文件不存在', 'utf8'));
    const out = getTaskOutput(id)!;
    expect(out.stdout).toBe('中文');
    expect(out.stderr).toBe('错误:文件不存在');
  });

  it('GBK 双字节被 chunk 边界切两半:前半截攒 pending 不吐 U+FFFD,拼齐后才是「中文」', () => {
    const child = fakeChild();
    const id = registerTask(child, 'fake gbk split');
    child.stdout.emit('data', Buffer.from([0xd6]));
    // 实际行为:半个字符判"结构不完整 ⇒ 等下一块",此处不产出任何文本(更没有 U+FFFD)
    expect(getTaskOutput(id)!.stdout).toBe('');
    child.stdout.emit('data', Buffer.from([0xd0, 0xce, 0xc4]));
    const out = getTaskOutput(id)!;
    expect(out.stdout).toBe('中文');
    expect(out.stdout).not.toContain('\uFFFD');
  });
});

describe('F-026 终端降级路径输出解码', () => {
  it('spawn 降级会话吐 GBK 中文时 terminal_read 读出「中文」而非 U+FFFD', async () => {
    // 用绝对路径起子进程(降级路径是 shell:true,绝对路径不吃 PATH 过滤)
    const script = 'process.stdout.write(Buffer.from([0xd6,0xd0,0xce,0xc4]))';
    const command = `"${process.execPath}" -e "${script}"`;
    const opened = await terminal_open.execute({ command }, ctx);
    expect(opened.success).toBe(true);
    const sessionId = opened.output.match(/sessionId:\s*(\S+)/)?.[1];
    expect(sessionId).toBeTruthy();
    createdSessionIds.push(sessionId!);

    const read = await terminal_read.execute({ sessionId, timeout: 8000 }, ctx);
    expect(read.success).toBe(true);
    expect(read.output).toContain('中文');
    expect(read.output).not.toContain('\uFFFD');
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
