// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TUI client — 连接远程 Agent server(WebSocket),发送消息,渲染流式响应。
 *
 * 用 createRequire 动态加载 ws 包(Node 内置 WebSocket 全局为浏览器风格 API,与本实现不兼容),
 * 运行时若 ws 包未安装,connectToServer 抛出友好错误。
 *
 * 交互模式:startTuiInteractive 启动 readline 循环,输入 /quit 退出。
 */

import { createRequire } from 'node:module';
import * as readline from 'node:readline';
import chalk from 'chalk';
import type { AgentEvent } from '../server/agent-core.js';
import { tryParseJson, isRecord } from '../util/json.js';
// W13 远程渲染增强:复用 REPL 同源 markdown 渲染器与工具卡片着色(单一事实源)
import { createMarkdownRenderer } from '../commands/markdown-renderer.js';
import { formatToolResultForCard } from '../commands/ui-tool-cards.js';
// G-701:工具入参回显必须走键名档出口(裸 slice(0,100) 会原样带出 {"api_key":"…"} 这类明文凭据)
import { redactObjectDeepKeyed } from '../redact.js';
// G-814408:事件流的单一写者判定 —— 装写者只能经这一处出口,角色与并存声明都在这里对账。
import {
  claimResidentWriter,
  releaseStreamWriters,
  runPerTurnSink,
  type CoexistenceDeclaration,
} from '../event-stream-ownership.js';

const dynamicRequire = createRequire(import.meta.url);

interface WsClientSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'open', listener: () => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
}

type WsClientCtor = new (url: string) => WsClientSocket;

export interface TuiClientOptions {
  url: string;
  token?: string;
}

/**
 * G-814408:客户端事件流的**写者接口**。
 *
 * 旧形态只有一个 `on('event', cb)`:只加不减、也不问"谁已经在写这条流" —— 于是
 * `remote-adapter.ts` 的 per-turn sink 被永久装进同一个 fan-out 集合,第二次 send
 * 就有两个写者各写一遍同一条事件,而账面看不出装了几份。
 *
 * 现在把"装写者"这一步交给唯一出口 `event-stream-ownership`:
 *  - `attachResidentWriter` = 跨回合存活的常驻写者(交互渲染用这一条);
 *  - `runWithPerTurnSink`   = 只活过一次调用的 per-turn sink(sendUnified 用这一条,
 *    finally 里必定摘钩 —— 上游 `submitPrompt` 的那一条纪律)。
 * 两者对同一条流**二选一**:第二条写者接入必须带 `coexist{reason, with}` 显式声明,
 * 否则当场抛 `StreamWriterConflictError`(而不是静默并存,也不是装完再去重)。
 */
export interface StreamWriterAttachOptions {
  /** 调用点自述:报告与冲突信息里点名"是谁在写" */
  label: string;
  /** 并存声明 —— 只有确实需要第二条写者时才带,且必须指向当前在位的写者 label */
  coexist?: CoexistenceDeclaration;
}

export interface TuiClient {
  /** 这条事件流的稳定标识(单一写者判定的作用域) */
  readonly streamId: string;
  send(text: string): Promise<void>;
  /** 装常驻写者;返回摘钩函数(幂等)。第二条未声明的写者会被拒。 */
  attachResidentWriter(
    cb: (event: AgentEvent) => void,
    opts: StreamWriterAttachOptions,
  ): () => void;
  /** 在一次调用内装 per-turn sink,并在 finally 摘钩 + 释放租约。 */
  runWithPerTurnSink<T>(
    cb: (event: AgentEvent) => void,
    body: () => Promise<T>,
    opts: StreamWriterAttachOptions,
  ): Promise<T>;
  close(): void;
}

/** 流标识计数:每条连接一条流,`remote-client#<n>` 稳定可查。 */
let streamSeq = 0;
function nextStreamId(): string {
  streamSeq += 1;
  return `remote-client#${streamSeq}`;
}

function loadWsClient(): WsClientCtor | null {
  try {
    const mod = dynamicRequire('ws') as { WebSocket?: WsClientCtor };
    return mod.WebSocket ?? null;
  } catch {
    return null;
  }
}

export async function connectToServer(opts: TuiClientOptions): Promise<TuiClient> {
  const WsCtor = loadWsClient();
  if (!WsCtor) {
    throw new Error(
      'ws 包未安装,TUI client 无法启动。请运行:pnpm --filter @ihui/cli add ws && pnpm --filter @ihui/cli add -D @types/ws',
    );
  }

  const wsUrl = new URL(opts.url);
  if (opts.token) {
    wsUrl.searchParams.set('token', opts.token);
  }

  const ws = new WsCtor(wsUrl.toString());
  const streamId = nextStreamId();
  /**
   * 写者槽(不是 Set)。用 Set 装回调会把"同一函数第二次 attach"静默折成一份,
   * 于是登记面写着两个写者、投递面只投一次 —— 声明与事实又分叉了。数组让每一份
   * 声明都对应一次真实投递,`attachCount` 才是可核的账。
   */
  const slots: Array<{ cb: (event: AgentEvent) => void }> = [];
  const attachSlot = (cb: (event: AgentEvent) => void): (() => void) => {
    const slot = { cb };
    slots.push(slot);
    return () => {
      const i = slots.indexOf(slot);
      if (i >= 0) slots.splice(i, 1);
    };
  };
  const pendingResolvers: Array<() => void> = [];

  return new Promise<TuiClient>((resolve, reject) => {
    ws.on('open', () => {
      resolve({
        streamId,
        send: (text: string) =>
          new Promise<void>((res) => {
            pendingResolvers.push(res);
            ws.send(JSON.stringify({ type: 'message', text }));
          }),
        attachResidentWriter: (cb, writerOpts) => {
          // 先判定再装钩:被拒的 attach 必须在投递面上也没痕迹(否则"判红但已装上")。
          const lease = claimResidentWriter(streamId, writerOpts.label, writerOpts.coexist);
          const detach = attachSlot(cb);
          return () => {
            detach();
            lease.release();
          };
        },
        runWithPerTurnSink: (cb, body, writerOpts) => {
          let detach: (() => void) | null = null;
          return runPerTurnSink({
            streamId,
            label: writerOpts.label,
            coexist: writerOpts.coexist,
            attach: () => {
              detach = attachSlot(cb);
            },
            detach: () => {
              const d = detach;
              detach = null;
              if (d) d();
            },
            body,
          });
        },
        close: () => {
          // 断开连接 = 这条流不再有人写:槽位整片清空,租约整片释放(两侧同摘,不留僵尸账)。
          slots.length = 0;
          releaseStreamWriters(streamId);
          try {
            ws.close();
          } catch {
            // ignore
          }
        },
      });
    });

    ws.on('error', (err: Error) => {
      reject(err);
    });

    ws.on('message', (data: Buffer) => {
      const raw = tryParseJson(data.toString('utf-8'));
      if (!isRecord(raw) || typeof raw.type !== 'string') return;
      const event = raw as unknown as AgentEvent;
      // 复制一份再投递:写者在回调里摘钩(sendUnified 的 finally)会让 splice 影响正被遍历的数组。
      for (const slot of [...slots]) slot.cb(event);
      if (raw.type === 'done' || raw.type === 'error' || raw.type === 'result') {
        const r = pendingResolvers.shift();
        if (r) r();
      }
    });

    ws.on('close', () => {
      for (const r of pendingResolvers) r();
      pendingResolvers.length = 0;
    });
  });
}

export async function startTuiInteractive(opts: TuiClientOptions): Promise<void> {
  const client = await connectToServer(opts);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // W13:流式 markdown 渲染器(与 REPL 同源)+ 残片缓冲
  const mdRenderer = createMarkdownRenderer();
  let mdPending = '';

  // G-814408:这一条是**常驻写者**(整个交互会话期间都在渲染同一条流),所以走
  // attachResidentWriter 而不是旧的裸 `on('event', …)` —— 第二个写者(例如有人再拿同一个
  // client 去走 per-turn sink)会被单一写者判据当场拒掉,而不是静默并存。
  const renderEvent = (event: AgentEvent): void => {
    switch (event.type) {
      case 'token': {
        // W13:token 流经 markdown 渲染器(与 REPL 同源,五色语法高亮/代码块/表格)
        mdPending += event.text;
        let nl: number;
        while ((nl = mdPending.indexOf('\n')) !== -1) {
          const line = mdPending.slice(0, nl);
          mdPending = mdPending.slice(nl + 1);
          for (const r of mdRenderer.pushLine(line)) console.info(r);
        }
        break;
      }
      case 'tool_call': {
        // flush 残留 markdown 行,避免代码块未闭合进入工具卡片
        if (mdPending) {
          for (const r of mdRenderer.pushLine(mdPending)) console.info(r);
          mdPending = '';
        }
        // G-701:原为裸 `JSON.stringify(event.args)` 再 slice(0,100) —— 截断不等于脱敏,
        // 前 100 字符里照样可能出现键名档凭据;先过键名档出口再截断。
        const argsJson = JSON.stringify(redactObjectDeepKeyed(event.args));
        const argDisplay = argsJson.length > 100 ? `${argsJson.slice(0, 100)}…` : argsJson;
        console.info(chalk.cyan(`\n  ┌─ 🔧 ${chalk.bold(event.name)}`));
        console.info(chalk.cyan(`  │  ${chalk.dim('参数:')} ${argDisplay}`));
        break;
      }
      case 'tool_result': {
        const card = formatToolResultForCard(event.output);
        const icon = event.success ? chalk.green('✓') : chalk.red('✗');
        console.info(chalk.cyan(`  │  ${icon} ${chalk.dim('结果:')} ${card.text.replace(/\n/g, '\n  │  ')}`));
        console.info(chalk.cyan(`  └─ ${event.success ? chalk.green('成功') : chalk.red('失败')}`));
        break;
      }
      case 'iteration':
        process.stdout.write(chalk.dim(`\n  [轮次 ${event.count}/${event.max}]\n`));
        break;
      case 'error':
        process.stdout.write(chalk.red(`\n❌ ${event.message}\n`));
        break;
      case 'done':
        // flush 渲染器残留(未闭合代码块等)后收尾
        for (const r of mdRenderer.flush()) console.info(r);
        mdPending = '';
        process.stdout.write(
          chalk.green(`\n✨ 完成 (${event.iterations} 轮, ${event.stopReason})\n`),
        );
        break;
    }
  };
  client.attachResidentWriter(renderEvent, { label: 'tui-interactive-render' });

  process.stdout.write(chalk.dim(`🤖 IHUI TUI Client → ${opts.url}\n`));
  process.stdout.write(chalk.dim('输入消息发送,/quit 退出\n'));

  for await (const line of rl) {
    const text = line.trim();
    if (!text) continue;
    if (text === '/quit' || text === '/exit') {
      client.close();
      rl.close();
      break;
    }
    process.stdout.write(chalk.dim('→ '));
    await client.send(text);
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
