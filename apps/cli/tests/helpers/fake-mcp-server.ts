// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 假 MCP stdio server —— `mcp-runtime.test.ts` 与 `mcp-runtime-kill-tree.test.ts` 共用的夹具。
 *
 * 为什么抽出来而不是两个文件各抄一份:两票的判据都跑在**同一个子进程形状**上
 * (stdio + JSON-RPC + 真 spawn),抄两份就会出现"夹具漂了而两边都还绿"那一型 ——
 * 与本仓"两处算同一件事必漂移"记过的失败型同族。
 *
 * 凭据字面量全是**虚构**值(AGENTS §15/§26 卫生:真实凭据、内部地址一律不进测试)。
 */
import type { McpServer } from '../../src/commands/mcp-config.js';

/**
 * 假 server 的模式档:
 *  - `ok`            正常应答 initialize / tools/list / ping
 *  - `isError`       tools/call 返回 `{ content, isError: true }`(G-691 第一半:错误在**结果里**)
 *  - `notFound`      tools/call 返回 JSON-RPC error -32601(对端**已应答**)
 *  - `silent`        收到请求永不回话(逼出超时路径 ⇒ G-694)
 *  - `dieWithSecret` 不接 stdin,往 stderr 写一行带虚构凭据的启动失败然后 `exit(3)`(⇒ G-689)
 *  - `withChild`     自己正常应答,但派生一个 60s 的**孙进程**(验 G-690:整棵进程树回收)
 *  - `noisy`         先往 stderr 灌 `process.argv[3]` 字节,再**正常**应答(⇒ G-689 尾缓冲:
 *                    连接成功 ⇒ 读数可断言,超上限/未超上限两档都能取到真实量值)
 *  - `noisyDie`      往 stderr 灌 `process.argv[3]` 字节后 `exit(4)`(⇒ G-689 尾缓冲**进错误消息**:
 *                    connect 失败,但消息里带 (truncated) 与 bytesRead/sizeBytes)
 */
export type FakeMcpMode =
  | 'ok'
  | 'isError'
  | 'notFound'
  | 'silent'
  | 'dieWithSecret'
  | 'withChild'
  | 'noisy'
  | 'noisyDie';

/** 虚构凭据样本:必须能被共享脱敏出口盖掉(断言用它证明"脱敏真的跑了") */
export const FAKE_SECRET_IN_STDERR = 'sk-FAKEFAKEFAKEFAKEFAKEFAKEFAKE123';
export const FAKE_TOKEN_IN_STDERR = 'token=shouldNotLeak123456';

/** 孙进程脚本:纯计时器,活 60s(足够让"断连后仍在"变成可判的失败) */
export const GRANDCHILD_SOURCE =
  "'use strict'; var stop=Date.now()+60000; setInterval(function(){ if(Date.now()>stop) process.exit(0); },100);";

/**
 * 内联源码经 `node -e` 执行(不落盘 ⇒ 夹具不在仓库或 TEMP 里留残骸)。
 * 参数约定:`process.argv[1]` = 模式档,`process.argv[2]` = 孙进程源码,
 * `process.argv[3]` = 往 stderr 灌的字节数(用 `-e` 时 argv[0] 是解释器路径,后面的才是附加参数)。
 */
export const FAKE_SERVER_SOURCE = [
  "'use strict';",
  "var mode = process.argv[1] || 'ok';",
  "var noiseBytes = Number(process.argv[3] || 0);",
  "if (noiseBytes > 0) { try { process.stderr.write('n'.repeat(noiseBytes)); } catch (e) {} }",
  'function send(obj) { process.stdout.write(JSON.stringify(obj) + "\\n"); }',
  'function reply(id, result) { send({ jsonrpc: "2.0", id: id, result: result }); }',
  'function fail(id, message) { send({ jsonrpc: "2.0", id: id, error: { code: -32601, message: message } }); }',
  'var grandchildPid = 0;',
  "if (mode === 'withChild') {",
  '  var cp = require("child_process");',
  "  var gc = cp.spawn(process.execPath, ['-e', process.argv[2] || '', 'grandchild'], { stdio: 'ignore', windowsHide: true });",
  '  grandchildPid = gc.pid || 0;',
  '}',
  'function handle(msg) {',
  '  var id = msg.id;',
  '  var m = msg.method;',
  '  if (id === undefined) return;',
  "  if (m === 'initialize') return reply(id, { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'ihui-fake-mcp', version: '0' } });",
  "  if (m === 'ping') return reply(id, {});",
  "  if (m === 'tools/list') return reply(id, { tools: [{ name: 'echo', description: 'echo it', inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] } }] });",
  "  if (m === 'tools/call') {",
  "    if (mode === 'isError') return reply(id, { content: [{ type: 'text', text: '参数缺失:msg' }], isError: true });",
  "    if (mode === 'notFound') return fail(id, 'Method not found');",
  "    if (mode === 'silent') return;",
  "    if (mode === 'withChild') return reply(id, { content: [{ type: 'text', text: 'grandchild:' + grandchildPid }] });",
  "    return reply(id, { content: [{ type: 'text', text: 'echo' }] });",
  '  }',
  "  return fail(id, 'Method not found');",
  '}',
  "if (mode === 'dieWithSecret') {",
  `  process.stderr.write('startup failed ${FAKE_SECRET_IN_STDERR} ${FAKE_TOKEN_IN_STDERR}\\n');`,
  '  setTimeout(function () { process.exit(3); }, 60);',
  "} else if (mode === 'noisyDie') {",
  '  setTimeout(function () { process.exit(4); }, 60);',
  '} else {',
  "  var buf = '';",
  "  process.stdin.setEncoding('utf8');",
  "  process.stdin.on('data', function (d) {",
  '    buf += d;',
  "    var i = buf.indexOf('\\n');",
  '    while (i >= 0) {',
  '      var line = buf.slice(0, i).trim();',
  '      buf = buf.slice(i + 1);',
  "      i = buf.indexOf('\\n');",
  '      if (line) { try { handle(JSON.parse(line)); } catch (e) {} }',
  '    }',
  '  });',
  '}',
].join('\n');

/**
 * 造一份 stdio 形态的 McpServer 配置(命令就是当前 node 解释器,跨平台免依赖)。
 * `noiseBytes` 传给夹具的 stderr 灌水量(0 = 一个字都不写 ⇒ 用来锁"空 stderr"那一档)。
 */
export function fakeMcpServer(mode: FakeMcpMode, noiseBytes = 0): McpServer {
  return {
    name: `fake-${mode}`,
    transport: 'stdio',
    command: process.execPath,
    args: ['-e', FAKE_SERVER_SOURCE, mode, GRANDCHILD_SOURCE, String(noiseBytes)],
  };
}

/** 某个 pid 是否还活着(**只读**探活,不发信号) */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM 在 POSIX 上表示"进程在,只是没权限探";ESRCH 才是"没了"
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
