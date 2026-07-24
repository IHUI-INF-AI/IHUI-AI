/**
 * ihui registry webhook — 管理 webhook 触发记录(管理员)。
 *
 * 用法:
 *   ihui registry webhook list [--source <github|npm|mcp_marketplace|custom>] [--status <pending|processed|failed|ignored>] [--page <n>] [--size <n>]
 *   ihui registry webhook trigger <source> [--payload '<json>']
 *
 * 网络失败时输出错误但不退出非零(降级处理,与 registry-list 一致)。
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolveEffectiveConfig } from './settings.js';
import type {
  RegistryWebhookTriggerRecord,
  RegistryWebhookResponse,
  RegistryUpstreamSource,
} from '@ihui/types';

const FETCH_TIMEOUT_MS = 15_000;

type WebhookStatus = 'pending' | 'processed' | 'failed' | 'ignored';

/** webhook 列表响应(API 未导出命名类型,此处本地定义,字段与 registry-queries.ts 对齐) */
interface WebhookListResponse {
  triggers: RegistryWebhookTriggerRecord[];
  total: number;
}

interface ListOpts {
  source?: RegistryUpstreamSource;
  status?: WebhookStatus;
  page?: string;
  size?: string;
}

interface TriggerOpts {
  payload?: string;
}

function colorWebhookStatus(status: WebhookStatus): string {
  switch (status) {
    case 'processed':
      return chalk.green(status);
    case 'failed':
      return chalk.red(status);
    case 'pending':
      return chalk.yellow(status);
    case 'ignored':
      return chalk.gray(status);
    default:
      return status;
  }
}

export function webhookCommand(): Command {
  const cmd = new Command('webhook');
  cmd.description('管理 webhook 触发记录(list / trigger)');

  // registry webhook list
  const listCmd = new Command('list');
  listCmd
    .description('列出 webhook 触发记录(管理员)')
    .option('--source <source>', '上游源: github|npm|mcp_marketplace|custom')
    .option('--status <status>', '处理状态: pending|processed|failed|ignored')
    .option('--page <n>', '页码(默认 1)', '1')
    .option('--size <n>', '每页条数(默认 20)', '20')
    .action(async (options: ListOpts) => {
      const cfg = resolveEffectiveConfig({});
      const headers: Record<string, string> = cfg.apiKey
        ? { Authorization: `Bearer ${cfg.apiKey}` }
        : {};

      const page = parseInt(options.page ?? '1', 10);
      const size = parseInt(options.size ?? '20', 10);
      const safePage = Number.isFinite(page) && page > 0 ? page : 1;
      const safeSize = Number.isFinite(size) && size > 0 ? size : 20;

      const qs = new URLSearchParams();
      if (options.source) qs.set('source', options.source);
      if (options.status) qs.set('status', options.status);
      qs.set('page', String(safePage));
      qs.set('pageSize', String(safeSize));

      let result: WebhookListResponse | null = null;
      try {
        const res = await fetch(
          `${cfg.apiUrl}/api/registry/webhooks?${qs.toString()}`,
          {
            headers,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: WebhookListResponse };
          result = json.data ?? null;
        }
      } catch {
        result = null;
      }

      if (!result) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务(或无管理员权限)。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      if (result.triggers.length === 0) {
        console.info(chalk.dim('未找到匹配的 webhook 触发记录。'));
        return;
      }

      console.info(
        chalk.cyan(`\n🔔 Webhook 触发记录(共 ${result.total} 条):`),
      );
      const rows = result.triggers.map((t: RegistryWebhookTriggerRecord) => ({
        NAME: t.name,
        EVENT_TYPE: t.eventType,
        SOURCE: t.source,
        STATUS: colorWebhookStatus(t.status),
        RECEIVED_AT: t.receivedAt,
        PROCESSED_AT: t.processedAt ?? '-',
      }));
      console.table(rows);
      console.info('');
    });
  cmd.addCommand(listCmd);

  // registry webhook trigger <source>
  const triggerCmd = new Command('trigger');
  triggerCmd
    .description('手动触发 webhook 同步(管理员)')
    .argument('<source>', '上游源: github|npm|mcp_marketplace|custom')
    .option('--payload <json>', '自定义 payload(JSON 字符串,默认 {})')
    .action(async (source: RegistryUpstreamSource, options: TriggerOpts) => {
      const cfg = resolveEffectiveConfig({});
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

      let payload: Record<string, unknown> = {};
      if (options.payload) {
        try {
          const parsed = JSON.parse(options.payload);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            payload = parsed as Record<string, unknown>;
          } else {
            console.info(chalk.red('✗ --payload 必须是 JSON 对象。'));
            return;
          }
        } catch {
          console.info(chalk.red('✗ --payload JSON 解析失败。'));
          return;
        }
      }

      console.info(chalk.cyan(`\n触发 webhook 同步(source=${source})...`));

      let result: RegistryWebhookResponse | null = null;
      try {
        const res = await fetch(
          `${cfg.apiUrl}/api/registry/webhook/${source}`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as { data?: RegistryWebhookResponse };
          result = json.data ?? null;
        }
      } catch {
        result = null;
      }

      if (!result) {
        console.info(chalk.yellow('⚠ 无法连接到 registry 服务,触发失败。'));
        console.info(chalk.dim(`  API: ${cfg.apiUrl}`));
        console.info('');
        return;
      }

      console.info(chalk.green(`✓ ${result.message}`));
      console.info(chalk.dim(`  triggerId: ${result.triggerId}`));
      console.info(chalk.dim(`  syncTriggered: ${result.syncTriggered}`));
      console.info('');
    });
  cmd.addCommand(triggerCmd);

  return cmd;
}
