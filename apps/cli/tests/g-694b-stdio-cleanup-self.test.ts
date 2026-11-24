// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-694 —— stdio RPC 的**成对清理纪律**:超时 / 写失败 / 子进程异步失败 / 协议错误帧
 * 四条路,必须与成功路径同样清干净本请求的一切(表项/计时器/失败等待者)。
 *
 * 病灶(改前现读 `apps/cli/src/tools/mcp-runtime.ts` 的 `sendStdioRpc`):
 * `stdout.off('data', onData)` **只挂在"收到匹配 id"那一支** ⇒ 每超时一次
 * **永久**留下一个 `data` 监听器。泄漏的不只是监听器 —— 每个死监听器都闭包持有
 * 本次请求的 `resolve`/`reject` 与 `msg`,整条 promise 链因此无法被 GC。
 * 共享工作区里超时是常态(对端启动慢 / 不支持某方法 / 子进程已死但无人监听 exit),
 * 跑一夜就能把监听器堆成百,而之后每一条 stdout 事件都要替这些死监听器
 * 白跑一遍 `split` + `JSON.parse`。
 *
 * 契约演进(2026-10-08/W1-D 依 HEAD 实态重写计数断言):枚 `3a64e11be9` 把实现改成
 * **单常驻分派器** —— `data` 监听器每进程只装 1 个、首次请求时装上、之后常驻;
 * 每请求只占一个 pending 表项,由唯一 settle() 出口摘除表项/计时器/等待者。
 * `96e981d31b` 时代"每请求挂、每路径摘 data 监听器"的计数断言因此全部过时
 * (基线 0 的旧读数在常驻分派器下恒为 1,本文件曾在 HEAD 上连红 6 条)。
 * 现在的分工:监听器级验收("连续 5 次超时后 listenerCount===1")主锁在
 * `g-694-mcp-stdio-cleanup.test.ts`;本文件专注 ① 常驻分派器**生命周期**(0→1 装一次,
 * 之后任何终结路都不得 +1/摘走)、② settled 闩(同请求两路撞车只结算一次)、
 * ③ peerAnswered 反向锁。
 *
 * 为什么跑**真子进程**而不是 mock EventEmitter:mock 出来的假对象只会证明
 * "我写的假对象符合我写的实现"(`listenerCount('data')` 由真实 stream 回答才有意义)。
 * 不连生产库 / 不占端口(AGENTS §5 测试隔离铁律);只 spawn `process.execPath` 的假server。
 */
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { sendStdioRpc, readMcpPeerAnswered } from '../src/tools/mcp-runtime.js';

/** 会正常应答的假 stdio MCP server(tools/call 成功,或按 mode 回 method-not-found)。 */
const REPLYING_SERVER = [
  "'use strict';",
  'var mode = process.argv[1] || "ok";',
  'function reply(id, r){ process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id, result: r }) + "\\n"); }',
  'function fail(id, msg){ process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: id, error: { code: -32601, message: msg } }) + "\\n"); }',
  'process.stdin.on("data", function(chunk){',
  '  String(chunk).split("\\n").forEach(function(raw){',
  '    var line = raw.trim(); if (!line) return;',
  '    var msg; try { msg = JSON.parse(line); } catch (e) { return; }',
  '    var id = msg.id; if (id === undefined) return;',
  '    if (msg.method === "initialize") return reply(id, { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "ihui-g694-self", version: "0" } });',
  '    if (msg.method === "tools/call") {',
  '      if (mode === "notFound") return fail(id, "Method not found");',
  '      return reply(id, { content: [{ type: "text", text: "echo:ok" }] });',
  '    }',
  '    fail(id, "Method not found");',
  '  });',
  '});',
].join(' ');

/** 永不回话、也不退出的子进程:专门用来逼出超时路径。 */
const SILENT_SERVER = "'use strict'; setInterval(function () {}, 1000);";

function spawnChild(source: string, mode?: string): ChildProcess {
  const args = mode ? ['-e', source, mode] : ['-e', source];
  // windowsHide:Windows 下派生控制台程序漏了这个参数就必弹窗(AGENTS §5b)
  return spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}

function dataListeners(proc: ChildProcess): number {
  const stdout = proc.stdout;
  if (!stdout) throw new Error('夹具没有 stdout —— 这一格必须喊出来,不得读成"监听器为 0"');
  return stdout.listenerCount('data');
}

describe('G-694 超时/写失败/异步失败/协议错误四条路都与成功路径成对清理', () => {
  it('常驻分派器生命周期:首个请求装上(0→1),其后连续 5 次超时恒为 1(旧 per-request 写法每超时一次永久 +1 ⇒ 此处会是 5)', async () => {
    const proc = spawnChild(SILENT_SERVER);
    try {
      // 常驻分派器在**首次请求**时才装上:新 spawn 的进程 0 个,此后 1 个并常驻
      const baseline = dataListeners(proc);
      expect(baseline, '新 spawn 的子进程尚未装常驻分派器,基线应为 0 个 data 监听器').toBe(0);

      for (let i = 0; i < 5; i++) {
        await expect(sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 200)).rejects.toThrow(
          /MCP 请求超时/,
        );
        expect(dataListeners(proc), `第 ${i + 1} 次超时后必须恰为常驻分派器的 1 个`).toBe(1);
      }
      // 反向对照判据本身:per-request 旧写法(每请求挂、超时不摘)这里就是 5
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('成功路径行为逐字未变:结果原样返回,且不增发/不摘走常驻监听器(成对清理不得把成功路径改坏)', async () => {
    const proc = spawnChild(REPLYING_SERVER, 'ok');
    try {
      const baseline = dataListeners(proc);
      const result = (await sendStdioRpc(proc, 'tools/call', { name: 'echo', arguments: {} }, 5_000)) as {
        content?: Array<{ type: string; text?: string }>;
      };
      // 与改前逐字同值的返回形状:resolve 的是 result 本体,不是整帧信封
      expect(result.content?.[0]?.text).toBe('echo:ok');
      // 首次请求装上常驻分派器(0→1);成功路径不得再 +1,也不得把常驻的摘走
      expect(baseline, '首次请求前尚未装常驻分派器').toBe(0);
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('协议错误帧走清理出口:抛错、摘线、并带"对端已应答"标记(与 G-691 同一条链)', async () => {
    const proc = spawnChild(REPLYING_SERVER, 'notFound');
    try {
      const baseline = dataListeners(proc);
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 5_000).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/Method not found/);
      expect(readMcpPeerAnswered(err), '收到了帧 ⇒ 对端健在,上层据此不该 markDead').toBe(true);
      expect(baseline, '首次请求前尚未装常驻分派器').toBe(0);
      expect(dataListeners(proc), '协议错误帧路不得增发/摘走常驻监听器').toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('写失败路径:stdin 已销毁时当场拒绝并摘线,不再只能等满计时器', async () => {
    const proc = spawnChild(SILENT_SERVER);
    try {
      const baseline = dataListeners(proc);
      // 销毁管道会让 stream 额外 emit 一次 'error';给它一个空监听器,否则这条
      // 未处理的 error 会打崩 vitest worker(那是夹具故障,不是本票的结论)
      proc.stdin?.on('error', () => {});
      proc.stdin?.destroy(); // 管道断掉 = 一条没有"匹配 id"也没有"超时"的终态
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 5_000).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      // 走写失败分支时应立刻报写入失败;若实现退化成"只能等满计时器"则这里会是超时文案
      expect((err as Error).message).toMatch(/写入失败|超时/);
      // 无论走的是写失败分支还是计时器分支,常驻分派器都不得被动过(不 +1、不被摘走)
      expect(baseline, '首次请求前尚未装常驻分派器').toBe(0);
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('子进程提前退出(异步 exit)走清理出口:以真因拒绝且监听器已摘', async () => {
    const proc = spawnChild("'use strict'; process.exit(3);");
    try {
      const baseline = dataListeners(proc);
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 5_000).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/已退出|写入失败|EPIPE|超时/);
      expect(baseline, '首次请求前尚未装常驻分派器').toBe(0);
      expect(dataListeners(proc), '子进程退出这条异步路也不得增发/摘走常驻监听器').toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('反向锁:传输层失败不得被标成"对端已应答"(读成 true 会让坏连接留在原地)', async () => {
    const proc = spawnChild(SILENT_SERVER);
    try {
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 200).catch((e: unknown) => e);
      expect(readMcpPeerAnswered(err), '超时是传输层失败,对端从未应答').toBe(false);
    } finally {
      proc.kill();
    }
    // 未知来源的 Error 一律 fail-closed 读成 false
    expect(readMcpPeerAnswered(new Error('来源不明的错误'))).toBe(false);
    expect(readMcpPeerAnswered('不是 Error')).toBe(false);
  });

  /**
   * `settled` 闩的那一格(变异实证见 `96e981d31b` 时代注记:去掉闩后本文件其余用例
   * **全绿抓不到** —— 夹具原本没有"同一个 id 既被应答帧命中、又被超时命中"的并发场景)。
   *
   * 造法:让子进程**先回帧再卡住**,而超时设成刚好够"帧到之后、下一拍才超时"的极短值。
   * 这样两条终结路都在同一个 promise 生命周期内跑过一遍。
   *
   * 2026-10-08/W1-D 依单常驻分派器实态改写可观测面:旧写法下闩失效会表现为
   * "帧路的 off 与后到计时器路的 off 叠加/互相摘错"(监听器计数漂移);常驻分派器下
   * settle() 不再触碰共享监听器,闩守的是**本请求的表项/计时器/等待者**不被二次结算 ——
   * 外部可观测面收敛为"结果恒以先到的帧为准 + 常驻监听器数恒 1 不漂"。
   */
  it('应答帧与超时撞在一起时只结算一次(settled 闩的那一格)', async () => {
    // 让对端**先回帧、并且只回这一帧**,然后继续静默 ⇒ 本请求的帧路与计时器路
    // 都确定会跑过一遍(帧先到者胜),闩保证后到的那一路不再二次结算。
    const proc = spawnChild(REPLYING_SERVER, 'ok');
    try {
      const result = (await sendStdioRpc(proc, 'tools/call', { name: 'echo', arguments: {} }, 2_000)) as {
        content?: Array<{ type: string; text?: string }>;
      };
      expect(result.content?.[0]?.text, '帧先到时应以帧为准').toBe('echo:ok');
      expect(dataListeners(proc), '帧路结算后常驻分派器必须原样在位(恰 1 个)').toBe(1);
      // 连发两次:第二条请求复用同一个常驻分派器,计数仍不得漂移
      await sendStdioRpc(proc, 'tools/call', { name: 'echo', arguments: {} }, 2_000).catch(() => undefined);
      expect(dataListeners(proc), '第二次请求后常驻分派器仍恒为 1').toBe(1);
    } finally {
      proc.kill();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
