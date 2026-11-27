// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tool-host 托管的 MCP stdio 子进程适配器（W4-06 MCP migration）。
 *
 * 宿主管子进程生命周期；本适配器只把宿主导出的 loopback raw relay 包装成
 * ChildProcess 形状的 stdin/stdout/stderr，让既有 MCP runtime 的 framing、
 * id 分派、notification 处理原样复用。它不是第二套 MCP 客户端。
 *
 * pid 故意暴露为 0：MCP 子进程属于 tool-host，CLI 的 killProcessTree 不得
 * 绕过宿主直接 taskkill；断连走 `kill()` → `service/McpClose`，由宿主回收。
 */

import { EventEmitter } from 'node:events';
import { connect, type Socket } from 'node:net';
import { PassThrough, Writable } from 'node:stream';

const CONNECT_TIMEOUT_MS = 5_000;

export interface ToolHostMcpSessionInfo {
  host: string;
  port: number;
  stderrPort?: number;
  token: string;
  pid: number;
}

export interface ToolHostMcpProcessOptions {
  /** 关闭宿主侧 session；由 `kill()` 触发一次。 */
  close: () => Promise<void>;
}

export class ToolHostMcpProcess extends EventEmitter {
  readonly stdin: Writable;
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  /** 宿主管的子进程 PID，仅诊断用；不暴露为 ChildProcess.pid，避免被 CLI 进程树回收绕过宿主。 */
  readonly mcpPid: number;
  readonly pid = 0;
  killed = false;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  private closed = false;

  constructor(
    private readonly socket: Socket,
    private readonly options: ToolHostMcpProcessOptions,
    mcpPid: number,
    private readonly stderrSocket?: Socket,
  ) {
    super();
    this.mcpPid = mcpPid;
    this.stdin = new Writable({
      write: (chunk: Buffer | string, encoding, callback) => {
        this.socket.write(chunk, encoding as BufferEncoding, callback);
      },
    });
    this.socket.on('data', (chunk: Buffer) => {
      this.stdout.write(chunk);
    });
    this.socket.on('error', (error: Error) => {
      this.emit('error', error);
      this.finish();
    });
    this.socket.on('close', () => this.finish());
    if (stderrSocket) {
      stderrSocket.on('data', (chunk: Buffer) => {
        this.stderr.write(chunk);
      });
      stderrSocket.on('error', () => {
        // stderr 是诊断通道；断了不影响 MCP 主通道，也不把断连归因到请求失败。
      });
      stderrSocket.on('close', () => this.stderr.end());
    }
    this.stdin.on('error', (error: Error) => this.emit('error', error));
  }

  kill(_signal?: NodeJS.Signals): boolean {
    if (this.closed) return false;
    this.killed = true;
    this.closed = true;
    this.socket.destroy();
    this.stderrSocket?.destroy();
    this.stdout.end();
    this.stderr.end();
    this.emit('exit', null, 'SIGTERM');
    void this.options.close().catch(() => {
      // 宿主 session 已随连接断开；关闭失败不应把断连变成未处理 rejection。
    });
    return true;
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.stdout.end();
    this.stderr.end();
    this.emit('exit', this.exitCode, this.signalCode);
  }
}

/** 连接宿主已经启动的 MCP raw relay；握手首行必须与宿主返回的 token 一致。 */
export async function connectToolHostMcp(
  session: ToolHostMcpSessionInfo,
  options: ToolHostMcpProcessOptions,
): Promise<ToolHostMcpProcess> {
  const socket = await connectSocket(session.host, session.port, session.token);
  let stderrSocket: Socket | undefined;
  if (session.stderrPort) {
    try {
      stderrSocket = await connectSocket(session.host, session.stderrPort, session.token);
    } catch {
      // 诊断通道失败不阻断 MCP 主通道；stderr 留空，主通道诊断仍可用。
    }
  }
  return new ToolHostMcpProcess(socket, options, session.pid, stderrSocket);
}

function connectSocket(host: string, port: number, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`连接 tool-host MCP relay 超时: ${host}:${port}`));
    }, CONNECT_TIMEOUT_MS);
    timer.unref?.();
    const onError = (error: Error): void => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      reject(error);
    };
    const onConnect = (): void => {
      clearTimeout(timer);
      socket.off('error', onError);
      socket.setNoDelay(true);
      socket.write(`${token}\n`);
      resolve(socket);
    };
    socket.once('error', onError);
    socket.once('connect', onConnect);
  });
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
