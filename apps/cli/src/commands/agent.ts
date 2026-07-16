/**
 * Agent 执行模块 — 非交互式单次执行。
 * 通过 @ihui/api-client 的 streamChat (SSE) 流式接收回复。
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
}

export async function runAgent(opts: AgentOptions): Promise<void> {
  setBaseUrl(opts.apiUrl);
  if (opts.apiKey) {
    setTokenProvider({ getToken: () => opts.apiKey ?? null });
  }

  console.info(chalk.dim(`\n🤖 IHUI Agent — ${opts.workspacePath}\n`));
  console.info(chalk.dim(`任务: ${opts.prompt}\n`));

  await streamChat({
    model: opts.modelId,
    messages: [{ role: 'user', content: opts.prompt }],
    onDelta: (delta) => process.stdout.write(delta),
    onError: (err) => console.error(chalk.red(`\n❌ ${err}`)),
    onDone: () => console.info(chalk.green('\n\n✨ 完成\n')),
  });
}
