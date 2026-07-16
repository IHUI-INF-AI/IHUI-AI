/**
 * Agent 执行模块 — 非交互式单次执行。
 * 通过 @ihui/api-client 的 streamChat (SSE) 流式接收回复。
 *
 * Headless 模式(--json 或非 TTY):输出 NDJSON 事件流,CI/CD 友好。
 *   事件类型:start / message_delta / error / complete
 * Exit code:0=成功 / 1=失败 / 2=部分完成 / 130=中断(由调用方处理)
 */

import chalk from 'chalk';
import { streamChat, setBaseUrl, setTokenProvider } from '@ihui/api-client';

export interface AgentOptions {
  prompt: string;
  modelId: string;
  workspacePath: string;
  apiUrl: string;
  apiKey?: string;
  maxIterations: number;
  jsonMode?: boolean;
}

export type AgentStopReason = 'end_turn' | 'cancelled' | 'max_iterations' | 'error';

export interface AgentResult {
  stopReason: AgentStopReason;
  assistantText: string;
}

type HeadlessEvent =
  | { type: 'start'; prompt: string; model: string; workspace: string }
  | { type: 'message_delta'; text: string }
  | { type: 'error'; message: string }
  | { type: 'complete'; stopReason: AgentStopReason };

export async function runAgent(opts: AgentOptions): Promise<AgentResult> {
  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  const jsonMode = opts.jsonMode === true;
  const emit = (event: HeadlessEvent): void => {
    if (jsonMode) process.stdout.write(JSON.stringify(event) + '\n');
  };

  if (jsonMode) {
    emit({ type: 'start', prompt: opts.prompt, model: opts.modelId, workspace: opts.workspacePath });
  } else {
    console.info(chalk.dim(`\n🤖 IHUI Agent — ${opts.workspacePath}\n`));
    console.info(chalk.dim(`任务: ${opts.prompt}\n`));
  }

  let assistantText = '';
  let hadError = false;

  try {
    await streamChat({
      model: opts.modelId,
      messages: [{ role: 'user', content: opts.prompt }],
      onDelta: (delta) => {
        assistantText += delta;
        if (jsonMode) emit({ type: 'message_delta', text: delta });
        else process.stdout.write(delta);
      },
      onError: (err) => {
        hadError = true;
        if (jsonMode) emit({ type: 'error', message: err });
        else console.error(chalk.red(`\n❌ ${err}`));
      },
      onDone: () => {
        if (!jsonMode) console.info(chalk.green('\n\n✨ 完成\n'));
      },
    });
  } catch (err) {
    hadError = true;
    const msg = err instanceof Error ? err.message : String(err);
    if (jsonMode) emit({ type: 'error', message: msg });
    else console.error(chalk.red(`\n❌ ${msg}`));
  }

  const stopReason: AgentStopReason = hadError ? 'error' : 'end_turn';
  emit({ type: 'complete', stopReason });
  return { stopReason, assistantText };
}

export function stopReasonToExitCode(reason: AgentStopReason): number {
  switch (reason) {
    case 'end_turn':
      return 0;
    case 'error':
      return 1;
    case 'max_iterations':
      return 2;
    case 'cancelled':
      return 130;
    default:
      return 1;
  }
}
