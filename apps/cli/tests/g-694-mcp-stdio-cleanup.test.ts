// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-694 —— stdio RPC 的**成对清理纪律**:超时 / 取消 / 错误路径必须与成功路径同样清理
 * (摘 pending 表项、摘诊断等待者、停计时器),且 `stdout` 上的 `data` 监听器数
 * **不随请求次数增长**。
 *
 * 病灶(现读 HEAD 的 `sendStdioRpc`):`stdout.off('data', onData)` 只挂在"收到匹配 id"那一支,
 * 于是每超时一次就**永久**留下一个 'data' 监听器 —— 泄漏之外,之后每一条 stdout 事件都要替
 * 这些死监听器白跑一遍 split+JSON.parse。共享工作区里超时是常态(对端启动慢 / 不支持某方法 /
 * 子进程已死但无人监听 exit),这条链跑一夜就能把监听器堆成百。
 *
 * 形态演进(两代):第一版修复是"每请求挂、任何终态都摘"(泄漏止住,但仍是每请求一个监听器);
 * 验收判据(mcp-runtime.test.ts)随后把形状钉死为**单常驻分派器** —— 每个子进程的 stdout 上
 * 恒只有一个 `data` 监听器,在途请求以 pending 表项挂在分派器上,断连时成对摘除。本文件
 * 与验收判据同形:断言恒为 1(新 spawn 基线 0 → 首个 RPC 惰性挂载后 1),而不是"归零 0"。
 *
 * 为什么跑**真子进程**而不是 mock EventEmitter:mock 出来的假对象只会证明
 * "我写的假对象符合我写的实现"(AGENTS §22c 那条"镜像测试只复读实现就是复读机");
 * `listenerCount('data')` 必须由真实 stream 来回答。
 * 夹具是本文件内联的(不依赖 `tests/helpers/` 里他人未入库的那份 —— 它在不在、怎么改,
 * 都不是本票能假设的事实)。
 *
 * 不连生产库 / 不占端口(AGENTS §5 测试隔离铁律);只 spawn `process.execPath` 的假 server。
 */
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { sendStdioRpc, readMcpPeerAnswered } from '../src/tools/mcp-runtime.js';

/** 会正常应答的假 stdio MCP server(initialize / tools/list / tools/call / ping)。 */
const REPLYING_SERVER = [
  "'use strict';",
  "var mode = process.argv[1] || 'ok';",
  'function send(o){ process.stdout.write(JSON.stringify(o) + "\\n"); }',
  'function reply(id, r){ send({ jsonrpc: "2.0", id: id, result: r }); }',
  'process.stdin.on("data", function(chunk){',
  '  String(chunk).split("\\n").forEach(function(raw){',
  '    var line = raw.trim(); if (!line) return;',
  '    var msg; try { msg = JSON.parse(line); } catch (e) { return; }',
  '    var id = msg.id; if (id === undefined) return;',
  "    if (msg.method === 'initialize') return reply(id, { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'ihui-g694', version: '0' } });",
  "    if (msg.method === 'ping') return reply(id, {});",
  "    if (msg.method === 'tools/list') return reply(id, { tools: [{ name: 'echo', inputSchema: { type: 'object', properties: {} } }] });",
  "    if (msg.method === 'tools/call') {",
  "      if (mode === 'notFound') return send({ jsonrpc: '2.0', id: id, error: { code: -32601, message: 'Method not found' } });",
  '      return reply(id, { content: [{ type: "text", text: "echo:ok" }] });',
  '    }',
  '    send({ jsonrpc: "2.0", id: id, error: { code: -32601, message: "Method not found" } });',
  '  });',
  '});',
].join(' ');

/** 永不回话、也不退出的子进程:专门用来逼出超时路径。 */
const SILENT_SERVER = "'use strict'; setInterval(function () {}, 1000);";

function spawnChild(source: string, mode?: string): ChildProcess {
  const args = mode ? ['-e', source, mode] : ['-e', source];
  // windowsHide:Windows 下 detached/派生控制台程序漏了这个参数就必弹窗(AGENTS §5b / 守门 52)
  return spawn(process.execPath, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}

function dataListeners(proc: ChildProcess): number {
  const stdout = proc.stdout;
  if (!stdout) throw new Error('夹具没有 stdout —— 这一格必须喊出来,不得读成"监听器为 0"');
  return stdout.listenerCount('data');
}

describe('G-694 成对清理:每条终态路径都清干净,监听器数不随请求次数增长', () => {
  it('连续 5 次超时之后 data 监听器仍恒为常驻分派器的 1 个(旧写法每超时一次永久 +1 ⇒ 此处会是 5)', async () => {
    const proc = spawnChild(SILENT_SERVER);
    try {
      const stdout = proc.stdout;
      if (!stdout) throw new Error('夹具没有 stdout');
      // 新 spawn 的子进程 stdout 上是 0 个:分派器在首个 RPC 到来时才惰性挂载
      const baseline = dataListeners(proc);
      expect(baseline, '新 spawn 的子进程基线应为 0 个 data 监听器').toBe(0);

      for (let i = 0; i < 5; i++) {
        await expect(sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 200)).rejects.toThrow(/MCP 请求超时/);
        expect(dataListeners(proc), `第 ${i + 1} 次超时后必须只剩常驻分派器 1 个`).toBe(1);
      }
      // 反向对照判据本身:旧写法(每请求挂、超时不摘)这里就是 5
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('成功路径行为逐字未变:结果原样返回,表项同样摘除(成对清理不得把成功路径改坏)', async () => {
    const proc = spawnChild(REPLYING_SERVER, 'ok');
    try {
      const result = (await sendStdioRpc(proc, 'tools/call', { name: 'echo', arguments: {} }, 5_000)) as {
        content?: Array<{ type: string; text?: string }>;
      };
      // 与改前逐字同值的返回形状:resolve 的是 result 本体,不是整帧信封
      expect(result.content?.[0]?.text).toBe('echo:ok');
      // 分派器形状:成功终态后 stdout 上仍是常驻分派器 1 个(请求只占表项,不占监听器)
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('协议错误帧同样走清理出口:抛错、表项摘除、并带"对端已应答"标记(G-691 与本票同一条链)', async () => {
    const proc = spawnChild(REPLYING_SERVER, 'notFound');
    try {
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 5_000).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/Method not found/);
      expect(readMcpPeerAnswered(err)).toBe(true); // 收到了帧 ⇒ 对端健在
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });

  it('取消/写失败路径:stdin 已销毁时当场拒绝并清干净,不再只能等满计时器', async () => {
    const proc = spawnChild(SILENT_SERVER);
    try {
      // 销毁管道会让 stream 额外 emit 一次 'error';给它一个空监听器,否则这条
      // 未处理的 error 会打崩 vitest worker(那是夹具故障,不是本票的结论)
      proc.stdin?.on('error', () => {});
      proc.stdin?.destroy(); // 管道断掉 = 一条没有"匹配 id"也没有"超时"的终态
      const err: unknown = await sendStdioRpc(proc, 'tools/call', { name: 'echo' }, 5_000).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/写入失败|超时/);
      // 写失败终态同样只留常驻分派器 1 个(表项/等待者/计时器都被唯一终态出口摘掉)
      expect(dataListeners(proc)).toBe(1);
    } finally {
      proc.kill();
    }
  });
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
