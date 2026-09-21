// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui serve — 启动 Agent 内核 HTTP/WS server,支持远程驱动。
 * 端口 8841(strictPort:占用即失败,不回退到其他端口)。
 * GET /health 返回 200;WS 桥 /ws 推送实时事件。
 * 复用 server/http-server.ts(node:http 创建 server)+ server/ws-bridge.ts(WS 桥)。
 * 平台独占:仅 cli(W1-2 Client/Server 架构,对标 OpenCode client/server)。
 *
 * O12 机器凭据接入:
 *   - 入站:除既有 IHUI_AGENT_TOKEN 外,还可放行服务端 API Key(`Bearer ihui_xxx`
 *     + `X-Api-Secret: sk_xxx`),按端点 scope 做能力闸。
 *   - 出站:凭据种类(api_key / jwt)决定 api 调用携带哪些头;机器凭据经
 *     installOutboundCredentialHeaders 自动补 `X-Api-Secret`。
 *   - 可观测:`--json`(或非 TTY)输出 NDJSON 生命周期事件,凭据异常带 `errorCode`;
 *     `--check-credential` 只做预检并据结果给退出码(0 正常 / 1 错误,沿用既有语义)。
 *   - 卫生:token / secret 明文**永不**进入任何输出行,统一 `maskSecret` 前 6 后 2。
 */
import type { Command } from 'commander';
import chalk from 'chalk';
import { AgentCore, startAgentServer, attachWsBridge } from '../server/index.js';
import { loadSettings, resolveEffectiveConfig } from './settings.js';
import { envBool } from '../config/env.js';
import {
  installOutboundCredentialHeaders,
  machineKeysFromSettings,
  maskSecret,
  parseMachineKeyList,
  preflightCredentialCheck,
  resolveOutboundCredential,
  setCapabilityGate,
  type AuthErrorCode,
  type MachineKeyEntry,
  type ResolvedCredential,
} from '../config/credentials.js';
import type { ApiKeyPermission } from '@ihui/types';

interface ServeOptions {
  port: string;
  workspace: string;
  model: string;
  apiUrl: string;
  apiKey: string;
  apiSecret?: string;
  credentialKind?: string;
  token?: string;
  machineKey?: string[];
  allowSecretlessMachineKeys?: boolean;
  json?: boolean;
  checkCredential?: boolean;
}

/** NDJSON 生命周期事件(agent 消费面;凭据字段恒为脱敏态)。 */
type ServeLifecycleEvent =
  | {
      type: 'ready';
      port: number;
      outbound: { kind: string; token?: string; secret?: string };
      inbound: { agentTokenConfigured: boolean; machineKeys: number; requireApiSecret: boolean };
    }
  | { type: 'warning'; errorCode: AuthErrorCode; message: string }
  | {
      type: 'error';
      /** 鉴权类错误用 AuthErrorCode;启动失败用 SERVER_START_FAILED */
      errorCode: AuthErrorCode | 'SERVER_START_FAILED';
      message: string;
      exitCode: number;
    };

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('启动 Agent 内核 HTTP/WS server,支持远程驱动(端口 8841,strictPort)')
    .option('-p, --port <port>', '端口(strictPort,占用即失败不回退)', '8841')
    .option('-w, --workspace <path>', '工作区路径', process.cwd())
    .option('-m, --model <model>', '模型 ID', 'default')
    .option('--api-url <url>', '后端 API 地址', process.env.IHUI_API_URL || 'http://localhost:8803')
    .option('--api-key <key>', 'API 密钥(ihui_ 前缀=机器凭据,否则按人 JWT 处理)', process.env.IHUI_API_KEY || '')
    .option('--api-secret <secret>', '机器凭据配套 secret(sk_xxx),出站以 X-Api-Secret 携带')
    .option('--credential-kind <kind>', '强制声明凭据种类:auto|api_key|jwt(默认 auto 按前缀推断)')
    .option('--token <token>', '鉴权 Bearer token', process.env.IHUI_AGENT_TOKEN)
    .option(
      '--machine-key <entry>',
      '入站放行的机器凭据,可重复:ihui_xxx=sk_yyy=chat:write,chat:read',
      (v: string, prev: string[] = []) => [...prev, v],
      [],
    )
    .option('--allow-secretless-machine-keys', '过渡期允许机器凭据不带 X-Api-Secret(等价 API_KEY_REQUIRE_SECRET=false)')
    .option('--json', 'NDJSON 输出生命周期事件(非 TTY 自动启用)')
    .option('--check-credential', '只做凭据预检并退出,不启动 server')
    .action(async (opts: ServeOptions) => {
      const jsonMode = opts.json === true || !process.stdout.isTTY;
      const emit = (event: ServeLifecycleEvent): void => {
        if (jsonMode) process.stdout.write(JSON.stringify(event) + '\n');
      };
      const note = (text: string, kind: 'info' | 'warn' = 'info'): void => {
        if (!jsonMode) console[kind === 'warn' ? 'warn' : 'info'](text);
      };

      // 装配能力闸(判据与服务端 requireCapability 同一份 @ihui/types 能力目录)。
      // 动态 import 而非静态:@ihui/types 桶内存在 src/*.ts → '@ihui/types' 的自引用循环,
      // 静态引入会把该环扩散进 serve 的模块图(实测污染 CLI 测试的模块初始化顺序)。
      // 装载失败不致命:本地退化为"仅 scopes 闸",M2M 判定仍由服务端权威把关。
      try {
        const { API_KEY_PERMISSION_SET, isM2MAllowed } = await import('@ihui/types');
        setCapabilityGate({
          isRegistered: (scope) => API_KEY_PERMISSION_SET.has(scope),
          isM2MAllowed: (scope) =>
            API_KEY_PERMISSION_SET.has(scope) && isM2MAllowed(scope as ApiKeyPermission),
        });
      } catch {
        note(chalk.yellow('⚠ 能力目录未装载:入站机器凭据仅校验 scopes,M2M 判定由服务端负责'), 'warn');
      }

      const settings = loadSettings();
      const cfg = resolveEffectiveConfig({
        cliApiUrl: opts.apiUrl,
        cliApiKey: opts.apiKey,
        cliApiSecret: opts.apiSecret,
        cliCredentialKind: opts.credentialKind,
      });
      const outbound = resolveOutboundCredential({
        cliApiKey: cfg.apiKey,
        cliApiSecret: cfg.apiSecret,
        cliCredentialKind: cfg.credentialKind,
      });

      // 入站机器凭据:settings.serve.machineKeys → env → CLI flag(后者叠加,按 key 去重)
      const machineKeys = dedupeMachineKeys([
        ...machineKeysFromSettings(settings.serve),
        ...parseMachineKeyList(process.env.IHUI_SERVE_MACHINE_KEYS),
        ...parseMachineKeyList((opts.machineKey ?? []).join(';')),
      ]);
      // requireApiSecret 一条开关管两个方向,因为两者同源于服务端 API_KEY_REQUIRE_SECRET:
      //   出站 = 本机用 ihui_ Key 调 api 时是否必须带 X-Api-Secret(预检告警口径)
      //   入站 = 本机 serve 放行机器凭据时是否必须见到 X-Api-Secret
      // 部署与服务端同步处于过渡期(API_KEY_REQUIRE_SECRET=false)时,这里一并放宽。
      const requireApiSecret =
        opts.allowSecretlessMachineKeys === true
          ? false
          : (envBool('IHUI_SERVE_REQUIRE_API_SECRET') ?? settings.serve?.requireApiSecret ?? true);

      // ---- 预检:本地可判定的凭据问题必须成为 agent 可判别输出 ----
      const check = preflightCredentialCheck(outbound, {
        requireSecret: requireApiSecret,
      });
      if (opts.checkCredential === true) {
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ type: 'credential-check', ...check }) + '\n');
        } else if (check.ok) {
          console.info(chalk.green(`✓ 凭据可用:kind=${check.kind} token=${check.maskedToken ?? '-'} secret=${check.maskedSecret ?? 'absent'}`));
        } else {
          console.error(chalk.red(`✗ ${check.errorCode}: ${check.message}`));
        }
        process.exit(check.ok ? 0 : 1);
      }
      if (!check.ok && check.errorCode) {
        // 不阻断启动(保持既有"无凭据也能起本地 server"语义),但必须显式报警
        emit({ type: 'warning', errorCode: check.errorCode, message: check.message ?? '' });
        note(chalk.yellow(`⚠ ${check.errorCode}: ${check.message}`), 'warn');
      }

      const port = parseInt(opts.port, 10);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        console.error(chalk.red(`无效端口: ${opts.port}`));
        process.exit(1);
      }

      // 出站机器凭据 → api 调用自动补 X-Api-Secret(JWT 通道 passthrough,零回归)
      installOutboundCredentialHeaders(outbound, cfg.apiUrl);

      const core = new AgentCore({
        workspacePath: opts.workspace,
        model: opts.model,
        apiUrl: cfg.apiUrl,
        apiKey: outbound?.token,
      });
      try {
        const handle = await startAgentServer(core, {
          port,
          token: opts.token,
          machineKeys,
          requireApiSecret,
        });
        await attachWsBridge(core, {
          server: handle.server,
          token: opts.token,
          machineKeys,
          requireApiSecret,
        });
        const inboundSummary = {
          agentTokenConfigured: Boolean(opts.token ?? process.env.IHUI_AGENT_TOKEN),
          machineKeys: machineKeys.length,
          requireApiSecret,
        };
        emit({
          type: 'ready',
          port: handle.port,
          outbound: describeCredentialForLog(outbound),
          inbound: inboundSummary,
        });
        if (!jsonMode) {
          console.info(chalk.green(`✓ IHUI Agent server listening on http://localhost:${handle.port}`));
          console.info(chalk.dim('  GET  /health       健康检查'));
          console.info(chalk.dim('  POST /message      SSE 流式对话'));
          console.info(chalk.dim('  WS   /ws           WebSocket 实时事件桥'));
          console.info(
            chalk.dim(
              `  凭据:出站 ${outbound ? outbound.kind : 'none'} / 入站 agentToken=${inboundSummary.agentTokenConfigured} machineKeys=${inboundSummary.machineKeys}`,
            ),
          );
          console.info(
            chalk.dim(
              `  出站凭据 ${outbound ? `${maskSecret(outbound.token)} secret=${maskSecret(outbound.secret) ?? 'absent'}` : '未配置'}`,
            ),
          );
          console.info(chalk.dim('  Ctrl+C 停止'));
        }
        const shutdown = async (): Promise<void> => {
          try {
            await handle.close();
          } catch {
            // ignore close errors
          }
          process.exit(0);
        };
        process.on('SIGINT', () => void shutdown());
        process.on('SIGTERM', () => void shutdown());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`✗ 启动失败(端口 ${port} 可能被占用): ${msg}`));
        emit({ type: 'error', errorCode: 'SERVER_START_FAILED', message: msg, exitCode: 1 });
        process.exit(1);
      }
    });
}

/** 按 key 去重(后者不覆盖前者的 scopes,首个出现的条目生效)。 */
function dedupeMachineKeys(entries: MachineKeyEntry[]): MachineKeyEntry[] {
  const byKey = new Map<string, MachineKeyEntry>();
  for (const entry of entries) {
    if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  }
  return [...byKey.values()];
}

/** NDJSON / 日志用的凭据摘要:恒脱敏,不含明文 token 或 secret。 */
function describeCredentialForLog(
  cred: ResolvedCredential | null,
): { kind: string; token?: string; secret?: string } {
  if (!cred) return { kind: 'none' };
  const summary: { kind: string; token?: string; secret?: string } = { kind: cred.kind };
  const maskedToken = maskSecret(cred.token);
  const maskedSecret = maskSecret(cred.secret);
  if (maskedToken) summary.token = maskedToken;
  if (maskedSecret) summary.secret = maskedSecret;
  return summary;
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
