// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * G-689 —— MCP stdio 子进程的 stderr **有界尾缓冲** + `error`/`exit` 监听。
 *
 * 病灶(现读改前 HEAD):`mcp-runtime.ts:599` 明写 `proc.stderr?.on('data', () => { /* 忽略 stderr *\/ })`
 * 把 stderr **整块丢弃**,且全文件 **零** `error`/`exit` 监听器 ⇒ ENOENT 走的是**异步**
 * `error` 事件而无人接,只能等满 `initialize` 的 10s 计时器,报成
 * "MCP 请求超时: initialize" —— 真凶(命令不存在 / 启动即崩 / 端口不通)一个字都留不下。
 *
 * 判据成对(正反缺一不可,否则判据恒真):
 *  ① 正:子进程写 stderr ⇒ 尾缓冲**读得到内容**,且经共享脱敏出口(凭据原文不留);
 *  ② 正:stderr **超上限** ⇒ 标 `truncated`,`bytesRead`/`sizeBytes` 是真实量值;
 *  ③ 反:stderr **为空** ⇒ 不得判成"有内容"、不得标 truncated(防恒真);
 *  ④ 反:未超上限 ⇒ **不**标 truncated(与 ② 配对,证明标注不是恒真);
 *  ⑤ 正:`command:'no-such-bin-xyz'` ⇒ 真因(ENOENT)秒回,不再由 10s 计时器兜顶;
 *  ⑥ 反:正常连接(对端健康)⇒ 尾缓冲空、连接不被误判为失败形态。
 *
 * 为什么用**真子进程**:这票判的是"进程 / 流 / 事件"层面的形状,mock 出来的假
 * EventEmitter 只会证明"我写的假对象符合我写的实现"(AGENTS §22c 的镜像测试复读机)。
 *
 * G-690(进程树回收)在 `mcp-runtime-kill-tree.test.ts`:它要把 `killProcessTree` 换成 spy,
 * 而 `vi.mock` 是模块级的,混进本文件会让这边所有用例失去真实回收能力(留一堆活子进程)。
 */
import { describe, expect, it } from 'vitest';
import {
  connectMcpServer,
  disconnectMcpConnection,
  readMcpStderrTail,
} from '../src/tools/mcp-runtime.js';
import {
  fakeMcpServer,
  FAKE_SECRET_IN_STDERR,
  FAKE_TOKEN_IN_STDERR,
} from './helpers/fake-mcp-server.js';

/** 上限与生产同源(mcp-runtime.ts 的 MCP_STDIO_STDERR_TAIL_MAX_BYTES) */
const TAIL_MAX_BYTES = 4_000;

describe('G-689 stdio 诊断:有界 stderr 尾缓冲 + error/exit 监听', () => {
  it('正例① 子进程写 stderr ⇒ 尾缓冲**读得到内容**,且经共享脱敏出口(凭据原文不留)', async () => {
    const err: unknown = await connectMcpServer(fakeMcpServer('dieWithSecret')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;

    // ① 真凶进来了:对端写在 stderr 里的启动失败正文(旧实现整块丢弃,只剩一句"请求超时")
    expect(message).toContain('startup failed');
    expect(message).toMatch(/stderr 尾=/);
    // ② 退出码被记进诊断(旧实现连 exit 事件都没监听)
    expect(message).toContain('退出码=3');
    // ③ 脱敏走共享层唯一出口 sanitizeEvidenceText:虚构凭据被盖成标记,原文一段都不留
    expect(message).toContain('[REDACTED_SECRET]');
    expect(message).not.toContain(FAKE_SECRET_IN_STDERR.slice(3, 23));
    expect(message).not.toContain(FAKE_TOKEN_IN_STDERR.slice(6));
  });

  it('正例② 超上限 ⇒ 标 truncated,bytesRead/sizeBytes 是真实量值(不是恒真、不是写死)', async () => {
    // 故意不是上限的整数倍 ⇒ 保留的尾巴不在整边界上,量值对不上就会被用例抓住
    const written = TAIL_MAX_BYTES * 2 + 517;
    const conn = await connectMcpServer(fakeMcpServer('noisy', written));
    try {
      const reading = readMcpStderrTail(conn.process);
      expect(reading).toBeDefined();
      // 真实量值:读到的总字节数 = 夹具写进去的字节数;保留量 = 上限
      expect(reading!.bytesRead).toBe(written);
      expect(reading!.sizeBytes).toBe(TAIL_MAX_BYTES);
      // 截断标注由比较得出 ⇒ 必须为真,且丢掉的字节数恰好是差额
      expect(reading!.truncated).toBe(true);
      expect(reading!.bytesRead - reading!.sizeBytes).toBe(written - TAIL_MAX_BYTES);
      // 保留的是**尾**部(丢头留尾),不是头部
      expect(reading!.text).toBe('n'.repeat(TAIL_MAX_BYTES));
    } finally {
      disconnectMcpConnection(conn);
    }
  });

  it('正例③ 截断信息也进错误消息本体(不只在内存读数上)', async () => {
    const written = TAIL_MAX_BYTES + 1;
    const err: unknown = await connectMcpServer(fakeMcpServer('noisyDie', written)).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain(`bytesRead=${written}`);
    expect(message).toContain(`sizeBytes=${TAIL_MAX_BYTES}`);
    expect(message).toContain('truncated');
  });

  it('反例① stderr **为空** ⇒ 不得判成"有内容",也不得标 truncated(防恒真)', async () => {
    // 真子进程,连接正常,但夹具一个字节都不往 stderr 写
    const conn = await connectMcpServer(fakeMcpServer('noisy', 0));
    try {
      const reading = readMcpStderrTail(conn.process);
      expect(reading).toBeDefined();
      // 空就是空:量值归零、文本空串、**没有**截断
      expect(reading!.text).toBe('');
      expect(reading!.bytesRead).toBe(0);
      expect(reading!.sizeBytes).toBe(0);
      expect(reading!.truncated).toBe(false);
    } finally {
      disconnectMcpConnection(conn);
    }
  });

  it('反例② 空 stderr 在消息里显式呈现为 <空>,不落到"看起来有内容"那一档', async () => {
    // 走 ENOENT 路径:子进程压根没起来 ⇒ stderr 必然空
    const err: unknown = await connectMcpServer({
      name: 'missing-bin',
      transport: 'stdio',
      command: 'no-such-bin-xyz',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain('stderr 尾=<空>');
    expect(message).toMatch(/bytesRead=0 sizeBytes=0/);
    expect(message).not.toContain('truncated');
  });

  it('反例③ 未超上限 ⇒ **不**标 truncated(与正例②配对,证明标注不是恒真)', async () => {
    const conn = await connectMcpServer(fakeMcpServer('noisy', 64));
    try {
      const reading = readMcpStderrTail(conn.process);
      expect(reading).toBeDefined();
      expect(reading!.truncated).toBe(false);
      // 未截断 ⇒ 两个量值必须相等(差额为 0),且都等于实际写入量
      expect(reading!.bytesRead).toBe(reading!.sizeBytes);
      expect(reading!.bytesRead).toBe(64);
      expect(reading!.text).toBe('n'.repeat(64));
    } finally {
      disconnectMcpConnection(conn);
    }
  });

  it('正例④ command 不存在 ⇒ 真因(ENOENT)秒回,不再由 10s 计时器兜成"请求超时"', async () => {
    const started = Date.now();
    const err: unknown = await connectMcpServer({
      name: 'missing-bin',
      transport: 'stdio',
      command: 'no-such-bin-xyz',
    }).catch((e: unknown) => e);

    const elapsed = Date.now() - started;
    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    // 旧形状:ENOENT 走**异步** error 事件而无人接 ⇒ 只能等满 initialize 的 10s 计时器
    expect(elapsed).toBeLessThan(5_000);
    expect(message).toMatch(/ENOENT|已终止|不可用/);
    expect(message).not.toMatch(/MCP 请求超时/);
  });

  it('反例④ 断连后本文件挂上去的 stderr/error/exit 监听器**成对摘除**(不留悬挂闭包)', async () => {
    const conn = await connectMcpServer(fakeMcpServer('noisy', 32));
    const proc = conn.process;
    if (!proc) throw new Error('夹具没产出子进程');
    // 订阅前先确认监听器确实在位(否则"摘到 0"是恒真)
    expect(proc.stderr?.listenerCount('data')).toBe(1);
    expect(proc.listenerCount('error')).toBe(1);
    expect(proc.listenerCount('exit')).toBe(1);

    disconnectMcpConnection(conn);

    expect(proc.stderr?.listenerCount('data')).toBe(0);
    expect(proc.listenerCount('error')).toBe(0);
    expect(proc.listenerCount('exit')).toBe(0);
  });
});
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
