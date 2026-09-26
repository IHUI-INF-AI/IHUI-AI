#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * IHUI AI Coding Agent CLI 入口
 * 用法:
 *   ihui                          # 交互式 REPL
 *   ihui "修复 bug"               # 直接执行任务
 *   ihui --model gpt-4o "..."     # 指定模型
 *   ihui agent "重构 auth 模块"   # Agent 模式
 *   ihui init                     # 创建 AGENTS.md 模板
 *   ihui mcp list                 # 列出 MCP 服务器
 *   ihui sessions                 # 列出历史会话
 */

import 'dotenv/config';
import { Command, type OptionValues } from 'commander';
import chalk from 'chalk';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { setBaseUrl, setTokenProvider, setDeviceFingerprintProvider, setUserAgent } from '@ihui/api-client';
import type { GoalHardCriterion } from '@ihui/api-client';
import { cliDeviceFingerprintCollector, CLI_USER_AGENT } from './lib/device-fingerprint.js';
import { grantLeaseFromFlag, releaseLeaseAfterRun } from './utils/permission-lease-flag.js';
import { tryParseJson, isRecord } from './util/json.js';
import { padCell } from './util/text-width.js';
import {
  installOutboundCredentialHeaders,
  resolveOutboundCredential,
} from './config/credentials.js';
import { startREPL } from './commands/repl.js';
import { runAgent, stopReasonToExitCode, parseOutputFormat, setupAgentTools } from './commands/agent.js';
import { loadSkills, findSkill } from './skills/index.js';
import {
  loadSession,
  getMostRecentSession,
  listSessions,
  createSession,
  type ChatMessage,
} from './commands/session.js';
import { writeAgentsMd, agentsMdExists } from './commands/template.js';
import {
  loadMcpConfig,
  addMcpServer,
  removeMcpServer,
  getMcpConfigPath,
} from './commands/mcp-config.js';
import { registerCapabilitiesCommand } from './commands/capabilities.js';
import { registerLoginCommand } from './commands/login.js';
import { registerMemoryCommand } from './commands/memory.js';
import { registerWorkflowsCommand } from './commands/workflows.js';
import { registerSpecCommand } from './commands/spec.js';
import { registerPlanCommand } from './commands/plan.js';
import { registerAgentsCommand } from './commands/agents.js';
import { registerAiSkillsCommand } from './commands/ai-skills.js';
import { attachChatSubcommands } from './commands/chat-subcommands.js';
import { registerContextCommand } from './commands/context.js';
import { registerDeveloperCommand, registerPlaygroundCommand } from './commands/developer.js';
import { registerKnowledgeCommand, registerRagCommand } from './commands/knowledge.js';
import { registerMcpMarketCommand } from './commands/mcp-market.js';
import { registerModelsCommand } from './commands/models.js';
import { registerSecurityCommand } from './commands/security.js';
import { registerCheckpointCommand } from './commands/checkpoint.js';
import { startCloudRun, completeCloudRun } from './cloud-run.js';
import { registerHooksCommand } from './commands/hooks.js';
import { registerHooksAutoCommand } from './commands/hooks-auto.js';
import { registerImportCommand } from './commands/import.js';
import { registerServeCommand } from './commands/serve.js';
import { registerConnectCommand } from './commands/connect.js';
import { startAcpServer } from './acp/server.js';
import { registerSubagentParallelCommand } from './commands/subagent-parallel.js';
import { CheckpointManager } from './checkpoints/index.js';
import {
  resolveEffectiveConfig,
  saveSettingsTemplate,
  getSettingsPath,
  loadSettings,
} from './commands/settings.js';
import { queryAuditLog } from './audit.js';
import { t, setLocale } from './i18n/index.js';
import type { Locale } from './i18n/index.js';
import { parseToolList, type PermissionRules } from './tools/permissions.js';
import { getTool } from './tools/index.js';
import { replayArgumentDeviations } from './tools/argument-validation-replay.js';
import { notifyUpdates } from './updater.js';
import { installCrashHandler } from './crash-handler.js';
import { needsFirstRunSetup, runFirstRunSetup } from './commands/first-run.js';

// P1-16 在所有模块加载后立即安装 crash handler(全局兜底未捕获异常)
installCrashHandler();

/** 从 CLI opts 解析 --tools / --disallowed-tools 为 PermissionRules */
function resolvePermissions(opts: OptionValues): PermissionRules | undefined {
  const allow = parseToolList(typeof opts.tools === 'string' ? opts.tools : undefined);
  const deny = parseToolList(typeof opts.disallowedTools === 'string' ? opts.disallowedTools : undefined);
  if (!allow && !deny) return undefined;
  return { allow, deny };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
// package.json 是随包分发的受信资产,但仍防异常逃逸与结构异常导致 CLI 启动崩溃
const pkgRaw = tryParseJson(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const pkg: { version: string } =
  isRecord(pkgRaw) && typeof pkgRaw.version === 'string' ? (pkgRaw as { version: string }) : { version: '0.0.0' };

// 帮助文本在模块顶层就被 commander 固化,故必须在构建 program 之前定好语言:
// 裸扫 argv 的 --locale > IHUI_LOCALE > settings.json(preAction 仍按解析后的 opts 复算一次)。
{
  const argvLocale = (() => {
    const argv = process.argv.slice(2);
    const inlined = argv.find((a) => a.startsWith("--locale="));
    if (inlined) return inlined.slice("--locale=".length);
    const at = argv.indexOf("--locale");
    return at >= 0 ? argv[at + 1] : undefined;
  })();
  const earlyLocale = argvLocale || process.env.IHUI_LOCALE || loadSettings().locale || '';
  if (earlyLocale) setLocale(earlyLocale as Locale);
}
const program = new Command();

program
  .name('ihui')
  .description(t('cliEntry.tagline'))
  .version(pkg.version)
  .option('-m, --model <model_id>', t('cliEntry.modelIdDesc'), 'default')
  .option('-w, --workspace <path>', t('cliEntry.workspacePathDesc'), process.cwd())
  .option('--max-iterations <n>', t('cliEntry.maxIterationsDesc'), '25')
  .option('--max-turns <n>', t('cliEntry.maxTurnsDesc'))
  .option('--api-url <url>', t('cliEntry.apiUrlDesc'), process.env.IHUI_API_URL || '')
  .option('--api-key <key>', t('cliEntry.apiKeyDesc'), process.env.IHUI_API_KEY || '')
  .option('--resume <session-id>', t('cliEntry.resumeDesc'))
  .option('--continue', t('cliEntry.continueDesc'))
  .option('--json', t('cliEntry.jsonDesc'))
  .option('--output-format <format>', t('cliEntry.outputFormatDesc'))
  .option('--mcp', t('cliEntry.mcpFlagDesc'))
  .option('--allow-dangerous', t('cliEntry.allowDangerousDesc'))
  .option('--permission-lease <tools>', t('cliEntry.permissionLeaseDesc'))
  .option('--permission-lease-ttl <minutes>', t('cliEntry.permissionLeaseTtlDesc'))
  .option('--permission-lease-turns <n>', t('cliEntry.permissionLeaseTurnsDesc'))
  .option('--plan', t('cliEntry.planDesc'))
  .option('--auto-approve-plan', t('cliEntry.autoApprovePlanDesc'))
  .option('--temperature <num>', t('cliEntry.temperatureDesc'))
  .option('--max-tokens <num>', t('cliEntry.maxTokensDesc'))
  .option('--locale <locale>', t('cliEntry.localeDesc'), process.env.IHUI_LOCALE || '')
  .option('-f, --prompt-file <path>', t('cliEntry.promptFileDesc'))
  .option('--tools <list>', t('cliEntry.toolsAllowDesc'))
  .option('--disallowed-tools <list>', t('cliEntry.toolsDenyDesc'))
  .option('--permission-mode <mode>', t('cliEntry.permissionModeDesc'))
  .option('--goal <text>', t('cliEntry.goalDesc'))
  .option('--goal-criteria <file>', t('cliEntry.goalCriteriaDesc'))
  .option('--no-update-check', t('cliEntry.noUpdateCheckDesc'))
  .option('--no-setup', t('cliEntry.noSetupDesc'));

interface ResolvedSession {
  sessionId?: string;
  history?: ChatMessage[];
}

/**
 * WP-8③ —— `--goal-criteria <file>` 的解析出口。
 *
 * 判序刻意是"读不到 / 不是数组 / 条目缺 id 或 statement ⇒ 直接停",**绝不**
 * "解析失败就当没声明指标" —— 那会把一次带验收条件的运行静默降级成无验收,
 * 而 §8 要防的正是"看起来过了"。
 */
function resolveGoalCriteria(raw: unknown): GoalHardCriterion[] | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') {
    console.error(t('cliEntry.goalCriteriaBadArg'));
    process.exit(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(raw, 'utf8').replace(/^﻿/, ''));
  } catch (err) {
    console.error(
      t('cliEntry.goalCriteriaUnreadable', {
        file: raw,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    process.exit(2);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error(t('cliEntry.goalCriteriaNotAnArray', { file: raw }));
    process.exit(2);
  }
  const bad = parsed.findIndex(
    (c) => !isRecord(c) || typeof c.id !== 'string' || typeof c.statement !== 'string',
  );
  if (bad >= 0) {
    console.error(t('cliEntry.goalCriteriaBadEntry', { index: String(bad + 1) }));
    process.exit(2);
  }
  return parsed as GoalHardCriterion[];
}

function resolveSession(opts: Record<string, unknown>): ResolvedSession {
  if (opts.continue) {
    const session = getMostRecentSession();
    if (session) {
      console.info(
        chalk.dim(
          t('cli.sessionResumed', { id: session.id, count: session.history.length }),
        ),
      );
      return { sessionId: session.id, history: session.history };
    }
    console.info(chalk.yellow(t('cli.noSessions')));
    return {};
  }
  if (opts.resume) {
    const session = loadSession(opts.resume as string);
    if (session) {
      console.info(
        chalk.dim(
          t('cli.sessionResumedWithId', { id: session.id, count: session.history.length }),
        ),
      );
      return { sessionId: session.id, history: session.history };
    }
    console.info(chalk.red(t('common.notFound', { target: opts.resume as string })));
    process.exit(1);
  }
  return {};
}

function resolveJsonMode(opts: OptionValues): boolean {
  return opts.json === true || !process.stdout.isTTY;
}

export function readPromptFile(
  filePath: string,
): { ok: true; content: string } | { ok: false; error: string } {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return { ok: false, error: t('cli.errorPathIsDir', { path: filePath }) };
    }
    const raw = readFileSync(filePath, 'utf-8');
    const content = raw.trim();
    if (content.length === 0) {
      return { ok: false, error: t('cli.errorFileEmpty', { path: filePath }) };
    }
    return { ok: true, content };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, error: t('cli.errorFileNotFound', { path: filePath }) };
    }
    return { ok: false, error: t('cli.errorReadFile', { message: (err as Error).message }) };
  }
}

function resolvePrompt(
  positional: string | undefined,
  opts: OptionValues,
): string | undefined {
  if (!opts.promptFile) {
    return positional;
  }
  const result = readPromptFile(opts.promptFile as string);
  if (!result.ok) {
    console.error(chalk.red(t('cli.errorPromptFile', { error: result.error })));
    process.exit(1);
  }
  if (positional) {
    console.warn(
      chalk.yellow(t('cliEntry.promptFileConflict')),
    );
  }
  return result.content;
}

async function runAgentAndExit(
  prompt: string,
  opts: OptionValues,
  jsonMode: boolean,
): Promise<void> {
  const cfg = resolveEffectiveConfig({
    cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
    cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
    cliModel: typeof opts.model === 'string' ? opts.model : undefined,
    cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
    cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
    // 权限租约:只有操作员显式点名才放宽 —— 三个值全缺省即整条链路逐字不变。
    cliPermissionLease: typeof opts.permissionLease === 'string' ? opts.permissionLease : undefined,
    cliPermissionLeaseTtl:
      typeof opts.permissionLeaseTtl === 'string' ? opts.permissionLeaseTtl : undefined,
    cliPermissionLeaseTurns:
      typeof opts.permissionLeaseTurns === 'string' ? opts.permissionLeaseTurns : undefined,
    cliPlan: opts.plan === true ? true : undefined,
    cliAutoApprovePlan: opts.autoApprovePlan === true ? true : undefined,
    cliMcp: opts.mcp === true ? true : undefined,
    cliTemperature: typeof opts.temperature === 'string' ? opts.temperature : undefined,
    cliMaxTokens: typeof opts.maxTokens === 'string' ? opts.maxTokens : undefined,
    cliPermissionMode: typeof opts.permissionMode === 'string' ? opts.permissionMode : undefined,
  });
  const abort = new AbortController();
  let session: ReturnType<typeof createSession> | null = null;
  const onSigint = (): void => {
    if (!abort.signal.aborted) {
      abort.abort();
      if (session && !jsonMode) {
        console.info(chalk.yellow(t('cliEntry.interruptSaving')));
      }
    }
  };
  process.on('SIGINT', onSigint);
  try {
    session = createSession(opts.workspace, cfg.model);
    // 如果 --resume/--continue,加载历史到 session.history
    const resumed = resolveSession(opts);
    if (resumed.sessionId && resumed.history) {
      session.id = resumed.sessionId;
      session.history = resumed.history;
    }
    const checkpoints = new CheckpointManager({
      sessionId: session.id,
      workspacePath: opts.workspace,
    });
    // 权限租约(--permission-lease):操作员显式点名工具清单才授予,作用域 = 本次会话这一目标。
    // 未给 flag ⇒ outcome.kind==='none',`grantPermissionLease()` 一次都不被调用,
    // `activePermissionLease()` 恒 null ⇒ 所有消费点走的仍是改造前那一份判定实现(逐字不变)。
    // 判不下来 ⇒ 失败关闭 exit 1:悄悄回落成"没给 flag 继续跑"会把操作员要的放宽模式
    // 换成另一套语义,而账面一切正常(本仓"失败必须响"同一条禁令)。
    const leaseOutcome = grantLeaseFromFlag({
      toolsRaw: cfg.permissionLease,
      ttlRaw: cfg.permissionLeaseTtl,
      turnsRaw: cfg.permissionLeaseTurns,
      target: session.id,
    });
    if (leaseOutcome.kind === 'invalid') {
      console.error(chalk.red(`✗ ${t('cliEntry.permissionLeaseInvalid', { reason: leaseOutcome.reason })}`));
      process.exitCode = 1;
      return;
    }
    if (leaseOutcome.kind === 'granted' && !jsonMode) {
      console.info(
        chalk.yellow(
          t('cliEntry.permissionLeaseGranted', {
            tools: leaseOutcome.lease.capabilities.join(', '),
            ttl: leaseOutcome.ttlMinutes,
            turns: leaseOutcome.turns,
            expiresAt: leaseOutcome.lease.expiresAt,
          }),
        ),
      );
    }
    // H4 云会话写入:CLI agent 运行记录写 ai-service(/api/cloud-runs,session_alias 绑定本会话),
    // 全程静默降级绝不影响主流程;start 与 runAgent 并发,网络等待不叠加到任务耗时。
    const cloudStartPromise = cfg.apiKey
      ? startCloudRun({
          task: prompt,
          sessionAlias: session.id,
          apiKey: cfg.apiKey,
        })
      : Promise.resolve(null);
    let cloudStatus: 'done' | 'error' = 'done';
    let cloudOutput = '';
    try {
      const result = await runAgent({
        prompt,
        modelId: cfg.model,
        workspacePath: opts.workspace,
        apiUrl: cfg.apiUrl,
        apiKey: cfg.apiKey,
        maxIterations: cfg.maxIterations,
        jsonMode,
        outputFormat: opts.outputFormat ? parseOutputFormat(opts.outputFormat) : undefined,
        checkpoints,
        enableMcp: cfg.enableMcp,
        allowDangerous: cfg.allowDangerous,
        session,
        signal: abort.signal,
        planFirst: cfg.planFirst,
        // P0-C:plan 审批门 — --auto-approve-plan / settings.autoApprovePlan 显式开启才放行(默认 fail-fast)
        autoApprovePlan: cfg.autoApprovePlan,
        sampler: cfg.sampler,
        permissions: resolvePermissions(opts),
        permissionMode: cfg.permissionMode,
        // WP-8③:goal 模式 —— 指标由 --goal-criteria 声明,文本由 --goal 给出;
        // 不声明即完全走旧路径(逐零差异),声明了就必须过独立校验才允许退 0。
        goalCriteria: resolveGoalCriteria(opts.goalCriteria),
        goal: typeof opts.goal === 'string' ? opts.goal : prompt,
      });
      process.exitCode = stopReasonToExitCode(result.stopReason);
      cloudOutput = result.assistantText;
      if (result.stopReason === 'error') {
        cloudStatus = 'error';
      }
    } catch (err) {
      cloudStatus = 'error';
      cloudOutput = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      // 租约收尾:无论成功/失败/异常都显式撤销并落 `permission_lease_revoked` 审计行。
      // 刻意放在 finally —— 放宽若在一次崩溃后被遗留在进程里,下一次调用会继续吃到它,
      // 而那正是本模块立论要排除的"永久放宽"形态(撤销不抛,可安全重放)。
      if (leaseOutcome.kind === 'granted') {
        releaseLeaseAfterRun(`agent run finished (target=${leaseOutcome.lease.scope})`);
      }
      // 云会话收尾:start 成功登记过才补写终态(失败/未登录静默跳过)
      const cloudRunId = await cloudStartPromise;
      if (cloudRunId) {
        await completeCloudRun({
          runId: cloudRunId,
          status: cloudStatus,
          output: cloudOutput,
          error: cloudStatus === 'error' ? cloudOutput : undefined,
          apiKey: cfg.apiKey,
        });
      }
    }
  } finally {
    process.off('SIGINT', onSigint);
  }
}

program.hook('preAction', async () => {
  const opts = program.opts();
  // 首次运行引导:无 ~/.ihui/settings.json 时自动跑交互式问答生成配置
  // (对标 claude / codex CLI 首次启动体验,--no-setup 可跳过)
  if (opts.setup !== false && needsFirstRunSetup()) {
    await runFirstRunSetup();
  }
  const settingsLocale = loadSettings().locale;
  const effectiveLocale =
    (typeof opts.locale === 'string' && opts.locale) ||
    process.env.IHUI_LOCALE ||
    settingsLocale ||
    '';
  if (effectiveLocale) {
    setLocale(effectiveLocale as Locale);
    if (!process.env.IHUI_LOCALE) process.env.IHUI_LOCALE = effectiveLocale;
  }
  const cfg = resolveEffectiveConfig({
    cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
    cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
  });
  setBaseUrl(cfg.apiUrl);
  setDeviceFingerprintProvider(cliDeviceFingerprintCollector);
  // 首方 UA:Node 的 fetch(undici)默认根本不发 User-Agent,直接命中后端
  // isMissingOrShortUserAgent ⇒ CLI 每个请求都被判为自动化客户端
  // (429 要求一个无法完成的 CAPTCHA + 每请求拉低出口 IP 信誉)。
  setUserAgent(CLI_USER_AGENT);
  // O12 机器凭据:出站必须同时携带 Authorization: Bearer ihui_xxx 与 X-Api-Secret: sk_xxx
  // (api-client 只负责前者)。人凭据(JWT)在此 passthrough,行为完全不变 ⇒ 零回归。
  installOutboundCredentialHeaders(
    resolveOutboundCredential({
      cliApiKey: cfg.apiKey,
      cliApiSecret: cfg.apiSecret,
      cliCredentialKind: cfg.credentialKind,
    }),
    cfg.apiUrl,
  );
  if (cfg.apiKey) {
    if (opts.apiKey && process.env.IHUI_API_KEY !== opts.apiKey) {
      console.warn(chalk.yellow(t('cliEntry.apiKeyExposedWarn')));
    }
    setTokenProvider({ getToken: () => cfg.apiKey });
  }
  // P1-15 异步触发更新检查(--no-update-check 或 IHUI_NO_UPDATE_CHECK=1 时跳过;offline 模式跳过)
  if (
    cfg.offline !== true &&
    opts.updateCheck !== false &&
    process.env.IHUI_NO_UPDATE_CHECK !== '1'
  ) {
    notifyUpdates();
  }
});

// 默认命令: 交互式 REPL 或直接执行任务
program
  .argument('[prompt]', t('cliEntry.chatArgumentDesc'))
  .action(async (prompt: string | undefined) => {
    const opts = program.opts();
    const effectivePrompt = resolvePrompt(prompt, opts);
    if (effectivePrompt) {
      const jsonMode = resolveJsonMode(opts);
      await runAgentAndExit(effectivePrompt, opts, jsonMode);
    } else {
      const cfg = resolveEffectiveConfig({
        cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
        cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
        cliModel: typeof opts.model === 'string' ? opts.model : undefined,
        cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
        cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
        cliPlan: opts.plan === true ? true : undefined,
        cliAutoApprovePlan: opts.autoApprovePlan === true ? true : undefined,
        cliMcp: opts.mcp === true ? true : undefined,
        cliPermissionMode: typeof opts.permissionMode === 'string' ? opts.permissionMode : undefined,
      });
      const session = resolveSession(opts);
      await startREPL({
        modelId: cfg.model,
        workspacePath: opts.workspace,
        apiUrl: cfg.apiUrl,
        apiKey: cfg.apiKey,
        maxIterations: cfg.maxIterations,
        sessionId: session.sessionId,
        history: session.history,
        enableMcp: cfg.enableMcp,
        allowDangerous: cfg.allowDangerous,
        planFirst: cfg.planFirst,
        autoApprovePlan: cfg.autoApprovePlan,
        permissions: resolvePermissions(opts),
        permissionMode: cfg.permissionMode,
      });
    }
  });

// chat 子命令
const chatCmd = program
  .command('chat')
  .description(t('cliEntry.chatModeDesc'))
  .action(async () => {
    const opts = program.opts();
    const cfg = resolveEffectiveConfig({
      cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
      cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
      cliModel: typeof opts.model === 'string' ? opts.model : undefined,
      cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
      cliMaxTurns: typeof opts.maxTurns === 'string' ? opts.maxTurns : undefined,
      cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
      cliPlan: opts.plan === true ? true : undefined,
      cliAutoApprovePlan: opts.autoApprovePlan === true ? true : undefined,
      cliMcp: opts.mcp === true ? true : undefined,
      cliPermissionMode: typeof opts.permissionMode === 'string' ? opts.permissionMode : undefined,
    });
    const session = resolveSession(opts);
    await startREPL({
      modelId: cfg.model,
      workspacePath: opts.workspace,
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      maxIterations: cfg.maxIterations,
      sessionId: session.sessionId,
      history: session.history,
      enableMcp: cfg.enableMcp,
      allowDangerous: cfg.allowDangerous,
      planFirst: cfg.planFirst,
      autoApprovePlan: cfg.autoApprovePlan,
      permissionMode: cfg.permissionMode,
    });
  });

// chat 子命令挂载:history/favorites/templates/settings — 对齐 Web 端 /chat 4 页功能
attachChatSubcommands(chatCmd);

// agent 子命令
program
  .command('agent [task]')
  .description(t('cliEntry.agentModeDesc'))
  .action(async (task: string | undefined) => {
    const opts = program.opts();
    const effectiveTask = resolvePrompt(task, opts);
    if (!effectiveTask) {
      console.error(chalk.red(t('cli.agentUsage')));
      process.exit(1);
    }
    const jsonMode = resolveJsonMode(opts);
    await runAgentAndExit(effectiveTask, opts, jsonMode);
  });

// init 子命令
program
  .command('init')
  .description(t('cliEntry.initDesc'))
  .option('-f, --force', t('cliEntry.forceDesc'))
  .action(async (options: { force?: boolean }) => {
    const workspace = process.cwd();
    if (agentsMdExists(workspace) && !options.force) {
      console.info(chalk.yellow(t('cli.agentsMdExists')));
      process.exit(1);
    }
    writeAgentsMd(workspace);
    console.info(chalk.green(t('cli.agentsMdCreated', { path: join(workspace, 'AGENTS.md') })));
  });

// sessions 子命令
program
  .command('sessions')
  .description(t('cliEntry.sessionsDesc'))
  .action(() => {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.info(chalk.dim(t('cli.noSessions')));
      return;
    }
    console.info(chalk.cyan(t('cliEntry.sessionsHeader')));
    for (const s of sessions) {
      const time = new Date(s.updatedAt).toLocaleString();
      console.info(`  ${chalk.bold(s.id)}  ${chalk.dim(time)}`);
      console.info(t('cliEntry.sessionsRow', { workspacePath: s.workspacePath, modelId: s.modelId, length: s.history.length }));
    }
    console.info('');
  });

// mcp 子命令组
const mcpCmd = program.command('mcp').description(t('cliEntry.mcpCmdDesc'));

mcpCmd
  .command('list')
  .description(t('cliEntry.mcpListDesc'))
  .action(() => {
    const config = loadMcpConfig();
    if (config.servers.length > 0) {
      console.info(chalk.cyan(t('cliEntry.mcpLocalHeader')));
      console.info(chalk.dim(t('cliEntry.mcpConfigPathLine', { configPath: getMcpConfigPath() })));
      for (const s of config.servers) {
        const transport = s.transport ?? 'stdio';
        if (transport === 'stdio') {
          const argStr = s.args && s.args.length > 0 ? ' ' + s.args.join(' ') : '';
          console.info(`  ${chalk.bold(s.name)} [${transport}]: ${s.command ?? ''}${argStr}`);
        } else {
          console.info(`  ${chalk.bold(s.name)} [${transport}]: ${s.url ?? ''}`);
        }
      }
    } else {
      console.info(chalk.dim(t('cliEntry.mcpLocalEmpty')));
      console.info(chalk.dim(t('cliEntry.mcpConfigPathLine', { configPath: getMcpConfigPath() })));
    }
  });

mcpCmd
  .command('add [name] [command]')
  .description(t('cliEntry.mcpAddDesc'))
  .option('-a, --args <args...>', t('cliEntry.mcpAddArgsDesc'))
  .option('-t, --transport <transport>', t('cliEntry.mcpAddTransportDesc'), 'stdio')
  .option('-u, --url <url>', t('cliEntry.mcpAddUrlDesc'))
  .option('--token <token>', t('cliEntry.mcpAddTokenDesc'))
  .action(
    (
      name: string | undefined,
      command: string | undefined,
      options: { args?: string[]; transport?: 'stdio' | 'http' | 'sse'; url?: string; token?: string },
    ) => {
      if (!name) {
        console.info(chalk.red(t('cliEntry.mcpAddUsage')));
        process.exit(1);
      }
      const auth =
        options.token ? { type: 'bearer' as const, token: options.token } : undefined;
      const server = addMcpServer(name, command, options.args, {
        transport: options.transport,
        url: options.url,
        auth,
      });
      console.info(chalk.green(t('cliEntry.mcpAdded', { name: server.name })));
      // McpServer.transport 类型为 MCPTransport | undefined,而 t() 的 params 值是
      // Record<string, string | number>(不接受 undefined)。addMcpServer 恒写入
      // `options?.transport ?? 'stdio'`,返回值运行期永不为 undefined,故此处 `?? 'stdio'`
      // 仅是与 addMcpServer 同一默认值对齐的类型收窄,不改变任何实际输出。
      console.info(t('cliEntry.mcpTransportLine', { transport: server.transport ?? 'stdio' }));
      if (server.transport === 'stdio') {
        console.info(t('cliEntry.mcpCommandLine', { command: server.command ?? '' }));
      } else {
        console.info(`  URL: ${server.url ?? ''}`);
      }
      console.info(chalk.dim(t('cliEntry.mcpConfigPathLine', { configPath: getMcpConfigPath() })));
    },
  );

mcpCmd
  .command('remove <name>')
  .description(t('cliEntry.mcpRemoveDesc'))
  .action((name: string) => {
    if (removeMcpServer(name)) {
      console.info(chalk.green(t('cliEntry.mcpRemoved', { name: name })));
    } else {
      console.info(chalk.red(t('cliEntry.mcpNotFound', { name: name })));
      process.exit(1);
    }
  });

// capabilities 子命令组
registerCapabilitiesCommand(program);

// login 子命令 — 用户名/邮箱/手机号 + 密码登录,获取 JWT 写入 settings.json
registerLoginCommand(program);

// memory 子命令组 — 对齐 Web 端 /memory(list/add/delete/clear)
registerMemoryCommand(program);

// workflows 子命令组 — 对齐 Web 端 /workflows(list/show/run/instances/instance/cancel)
registerWorkflowsCommand(program);

// spec 子命令组 — 对齐 Web 端 /spec(generate/templates/history/load/diff/variables)
registerSpecCommand(program);

// plan 子命令组 — 对齐 Web 端 /plan(init/list/show/delete 本地文档管理)
registerPlanCommand(program);

// agents 子命令组 — 对齐 Web 端 /agents(list/my/show/create/stats 5 页)
registerAgentsCommand(program);

// ai-skills 子命令组 — 对齐 Web 端 /ai-skills(list/show/invoke/install/remove)
registerAiSkillsCommand(program);

// context 子命令组 — 对齐 Web 端 /context(list/add/remove/clear 上下文文件管理)
registerContextCommand(program);

// developer 子命令组 — 对齐 Web 端 /developer(IDE/keys/logs/team)
registerDeveloperCommand(program);

// playground 子命令组 — 对齐 Web 端 /playground(AI 玩具箱)
registerPlaygroundCommand(program);

// knowledge 子命令组 — 对齐 Web 端 /knowledge-base(list/show/create/delete)
registerKnowledgeCommand(program);

// rag 子命令组 — 对齐 Web 端 /knowledge-rag(search/index)
registerRagCommand(program);

// mcp-market 子命令组 — 对齐 Web 端 /mcp-projects(list/search/show/install/remove)
registerMcpMarketCommand(program);

// models 子命令组 — 对齐 Web 端 /models(list/keys/usage/billing/groups 10+ 页)
registerModelsCommand(program);

// security 子命令组 — 对齐 Web 端 /security-audit(audit/scan/report)
registerSecurityCommand(program);

// checkpoint 子命令组
registerCheckpointCommand(program);

// hooks 子命令组
registerHooksCommand(program);

// hooks-auto 子命令组 — Wave 3 W3-4 自动发现 5 目录 hooks(对标 OpenClaw hooks 系统)
registerHooksAutoCommand(program);

// import 子命令组 — CLI 配置导入(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)
registerImportCommand(program);

// subagent-parallel 子命令 — 并行 fork N 个子 agent(真子进程并行,支持 4 拓扑)
registerSubagentParallelCommand(program);

// registry 子命令 — 资源上游同步中心(MCP/Skill/Plugin 四源拉取 + 双路径触发 + 全量自动更新)
import { registryCommand } from './commands/registry-index.js';
program.addCommand(registryCommand());

// skills 子命令 — 列出/查看已加载的 skills(从 .ihui/.agents/.claude/.cursor/skills 平面加载)
const skillsCmd = program.command('skills').description(t('cliEntry.skillsCmdDesc'));

skillsCmd
  .command('list')
  .description(t('cliEntry.skillsListDesc'))
  .action(() => {
    const skills = loadSkills({ cwd: process.cwd() });
    if (skills.length === 0) {
      console.info(chalk.dim(t('cliEntry.skillsEmpty')));
      console.info(chalk.dim('  <cwd>/.ihui/skills/   <cwd>/.agents/skills/   <cwd>/.claude/skills/   <cwd>/.cursor/skills/'));
      console.info(chalk.dim('  <repo-root>/.ihui/skills/ ...   ~/.ihui/skills/'));
      return;
    }
    console.info(chalk.cyan(t('cliEntry.skillsLoaded', { count: skills.length })));
    for (const s of skills) {
      console.info(`  ${chalk.bold(s.name)} — ${chalk.dim(s.description)}`);
      console.info(chalk.dim(t('cliEntry.skillsSourceLine', { source: s.source })));
    }
    console.info('');
  });

skillsCmd
  .command('show <name>')
  .description(t('cliEntry.skillShowDesc'))
  .action((name: string) => {
    const skills = loadSkills({ cwd: process.cwd() });
    const skill = findSkill(skills, name);
    if (!skill) {
      console.info(chalk.red(t('cliEntry.skillNotFound', { name: name })));
      process.exit(1);
    }
    console.info(chalk.cyan(`# ${skill.name}`));
    console.info(chalk.dim(t('cliEntry.skillSourceDetail', { source: skill.source })));
    console.info(chalk.dim(t('cliEntry.skillDescriptionLine', { description: skill.description })));
    console.info(skill.body);
  });

// settings 子命令组
const settingsCmd = program.command('settings').description(t('cliEntry.settingsCmdDesc'));

settingsCmd
  .command('init')
  .description(t('cliEntry.settingsInitDesc'))
  .option('-f, --force', t('cliEntry.forceDesc'))
  .action((options: { force?: boolean }) => {
    const created = saveSettingsTemplate(options.force === true);
    if (created) {
      console.info(chalk.green(t('cliEntry.settingsTemplateCreated', { settingsPath: getSettingsPath() })));
      console.info(chalk.dim(t('cliEntry.settingsEditHint')));
    } else {
      console.info(chalk.yellow(t('cliEntry.settingsAlreadyExists', { settingsPath: getSettingsPath() })));
      console.info(chalk.dim(t('cliEntry.settingsForceHint')));
    }
  });

settingsCmd
  .command('path')
  .description(t('cliEntry.settingsPathDesc'))
  .action(() => {
    console.info(getSettingsPath());
  });

// acp 子命令 — 启动 ACP (Agent Client Protocol) server,供编辑器嵌入
program
  .command('acp')
  .description(t('cliEntry.acpDesc'))
  .action(async () => {
    const opts = program.opts();
    const cfg = resolveEffectiveConfig({
      cliApiUrl: typeof opts.apiUrl === 'string' ? opts.apiUrl : undefined,
      cliApiKey: typeof opts.apiKey === 'string' ? opts.apiKey : undefined,
      cliModel: typeof opts.model === 'string' ? opts.model : undefined,
      cliMaxIterations: typeof opts.maxIterations === 'string' ? opts.maxIterations : undefined,
      cliMaxTurns: typeof opts.maxTurns === 'string' ? opts.maxTurns : undefined,
      cliAllowDangerous: opts.allowDangerous === true ? true : undefined,
      cliPlan: opts.plan === true ? true : undefined,
      cliAutoApprovePlan: opts.autoApprovePlan === true ? true : undefined,
      cliMcp: opts.mcp === true ? true : undefined,
      cliPermissionMode: typeof opts.permissionMode === 'string' ? opts.permissionMode : undefined,
    });
    const connection = startAcpServer({
      apiUrl: cfg.apiUrl,
      apiKey: cfg.apiKey,
      modelId: cfg.model,
      maxIterations: cfg.maxIterations,
      enableMcp: cfg.enableMcp,
      allowDangerous: cfg.allowDangerous,
      planFirst: cfg.planFirst,
      autoApprovePlan: cfg.autoApprovePlan,
    });
    process.on('SIGINT', () => connection.close());
    process.on('SIGTERM', () => connection.close());
    await connection.closed;
  });

// serve 子命令 — 启动 Agent 内核 HTTP/WS server,支持远程驱动(对标 OpenCode client/server 架构)
// 平台独占:仅 cli
registerServeCommand(program);

// connect 子命令 — 作为 TUI client 连接远程 Agent server(对标 OpenCode 远程驱动)
// 平台独占:仅 cli
registerConnectCommand(program);

// ============================================================================
// Wave 2 命令 — 智能深度反超(对标 OpenClaw Mem + OpenCode Plan/Build)
// ============================================================================

// undo 子命令 — 多步回滚文件改动(对标 OpenCode undo,支持多步)
program
  .command('undo [steps]')
  .description(t('cliEntry.undoDesc'))
  .option('-s, --session <id>', t('cliEntry.sessionOptDesc'))
  .action(async (stepsArg: string | undefined, opts: { session?: string }) => {
    const { UndoRedoManager } = await import('./commands/undo-redo.js');
    const steps = Number(stepsArg) || 1;
    const sessionId =
      opts.session ?? getMostRecentSession()?.id ?? 'adhoc';
    const mgr = new UndoRedoManager(process.cwd());
    const result = await mgr.undo(sessionId, steps);
    if (result.undoneSteps === 0) {
      console.info(chalk.yellow(t('cliEntry.undoNothing')));
      return;
    }
    console.info(
      chalk.green(t('cliEntry.undoDone', { undoneSteps: result.undoneSteps, remaining: result.remaining })),
    );
    for (const c of result.changes) {
      console.info(chalk.dim(`  · ${c.toolName} → ${c.filePath}`));
    }
  });

// redo 子命令 — 重做被 undo 的改动
program
  .command('redo [steps]')
  .description(t('cliEntry.redoDesc'))
  .option('-s, --session <id>', t('cliEntry.sessionOptDesc'))
  .action(async (stepsArg: string | undefined, opts: { session?: string }) => {
    const { UndoRedoManager } = await import('./commands/undo-redo.js');
    const steps = Number(stepsArg) || 1;
    const sessionId =
      opts.session ?? getMostRecentSession()?.id ?? 'adhoc';
    const mgr = new UndoRedoManager(process.cwd());
    const result = await mgr.redo(sessionId, steps);
    if (result.redoneSteps === 0) {
      console.info(chalk.yellow(t('cliEntry.redoNothing')));
      return;
    }
    console.info(
      chalk.green(t('cliEntry.redoDone', { redoneSteps: result.redoneSteps, remaining: result.remaining })),
    );
    for (const c of result.changes) {
      console.info(chalk.dim(`  · ${c.toolName} → ${c.filePath}`));
    }
  });

// share 子命令 — 生成可分享的会话快照(对标 OpenClaw share,增强 SHA-256 防篡改)
program
  .command('share [session-id]')
  .description(t('cliEntry.shareDesc'))
  .option('-f, --format <fmt>', t('cliEntry.shareFormatDesc'), 'markdown')
  .option('--no-tools', t('cliEntry.shareNoToolsDesc'))
  .option('--include-files', t('cliEntry.shareIncludeFilesDesc'))
  .option('-t, --title <title>', t('cliEntry.shareTitleDesc'))
  .action(async (sessionIdArg: string | undefined, opts: {
    format: string;
    tools: boolean;
    includeFiles?: boolean;
    title?: string;
  }) => {
    const { ShareManager } = await import('./commands/share.js');
    const sessionId = sessionIdArg ?? getMostRecentSession()?.id;
    if (!sessionId) {
      console.info(chalk.red(t('cliEntry.shareNoSession')));
      process.exit(1);
    }
    const mgr = new ShareManager(process.cwd());
    const result = await mgr.share(sessionId, {
      format: opts.format as 'markdown' | 'html' | 'json',
      includeToolCalls: opts.tools,
      includeFiles: opts.includeFiles === true,
      title: opts.title,
    });
    console.info(chalk.green(t('cliEntry.shareDone')));
    console.info(chalk.dim(t('cliEntry.shareShortUrl', { url: result.url })));
    console.info(chalk.dim(t('cliEntry.shareHash', { hash: result.hash })));
    console.info(chalk.dim(t('cliEntry.shareSize', { sizeBytes: result.sizeBytes })));
    if (result.qrCode) {
      console.info(chalk.dim(t('cliEntry.qrGenerated')));
    } else {
      console.info(chalk.dim(t('cliEntry.qrFallback')));
    }
  });

// mode 子命令 — 切换 Plan/Build/Review 交互模式(对标 OpenCode Plan/Build,增强 Review 模式)
program
  .command('mode [mode]')
  .description(t('cliEntry.modeDesc'))
  .action(async (modeArg: string | undefined) => {
    const { ModeManager } = await import('./tui/index.js');
    const mgr = new ModeManager();
    if (!modeArg) {
      console.info(chalk.cyan(t('cliEntry.modeCurrent', { mode: mgr.renderIndicator() })));
      console.info(chalk.dim(t('cliEntry.modeAvailable')));
      console.info(chalk.dim(t('cliEntry.modeUsage')));
      return;
    }
    const validModes = ['plan', 'build', 'review'] as const;
    if (!validModes.includes(modeArg as (typeof validModes)[number])) {
      console.info(chalk.red(t('cliEntry.modeUnknown', { modeArg: modeArg })));
      process.exit(1);
    }
    mgr.setMode(modeArg as (typeof validModes)[number]);
    console.info(mgr.getModeBanner());
  });

// audit 子命令组 — 查询/过滤审计日志(~/.ihui/audit.jsonl)
const auditCmd = program.command('audit').description(t('cliEntry.auditCmdDesc'));

auditCmd
  .command('query')
  .description(t('cliEntry.auditQueryDesc'))
  .option('-t, --tool <name>', t('cliEntry.auditToolFilterDesc'))
  .option('-s, --since <time>', t('cliEntry.auditSinceDesc'))
  .option('--success', t('cliEntry.auditSuccessOnlyDesc'))
  .option('--failure', t('cliEntry.auditFailureOnlyDesc'))
  .option('-l, --limit <n>', t('cliEntry.auditLimitDesc'), '50')
  .option('--json', t('cliEntry.auditJsonDesc'))
  .action((options: {
    tool?: string;
    since?: string;
    success?: boolean;
    failure?: boolean;
    limit?: string;
    json?: boolean;
  }) => {
    const success = options.success === true
      ? true
      : options.failure === true
        ? false
        : undefined;
    const limit = parseInt(options.limit ?? '50', 10);
    const result = queryAuditLog({
      tool: options.tool,
      since: options.since,
      success,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
    });

    if (options.json) {
      console.info(JSON.stringify(result, null, 2));
      return;
    }

    if (result.entries.length === 0) {
      console.info(chalk.dim(t('cliEntry.auditNoMatch', { total: result.total })));
      return;
    }

    console.info(chalk.cyan(t('cliEntry.auditListHeader', { count: result.entries.length, filtered: result.filtered, total: result.total })));
    for (const e of result.entries) {
      const icon = e.success === false ? '✗' : e.success === true ? '✓' : '?';
      const iconColor = e.success === false ? chalk.red(icon) : e.success === true ? chalk.green(icon) : chalk.dim(icon);
      const ts = new Date(e.timestamp).toLocaleString('zh-CN', { hour12: false });
      const duration = e.durationMs !== undefined ? chalk.dim(` ${e.durationMs}ms`) : '';
      console.info(`  ${iconColor} ${ts} ${chalk.bold(e.tool)}${duration}`);
      if (e.error) {
        console.info(chalk.dim(`    error: ${e.error.slice(0, 120)}`));
      }
    }
    console.info('');
  });

auditCmd
  .command('stats')
  .description(t('cliEntry.auditStatsDesc'))
  .option('-s, --since <time>', t('cliEntry.auditSinceDesc'))
  .action((options: { since?: string }) => {
    const result = queryAuditLog({ since: options.since, limit: 100_000 });

    if (result.total === 0) {
      console.info(chalk.dim(t('cliEntry.auditEmpty')));
      return;
    }

    const stats = new Map<string, { total: number; success: number; failure: number }>();
    for (const e of result.entries) {
      const s = stats.get(e.tool) ?? { total: 0, success: 0, failure: 0 };
      s.total++;
      if (e.success === true) s.success++;
      else if (e.success === false) s.failure++;
      stats.set(e.tool, s);
    }

    console.info(chalk.cyan(t('cliEntry.auditStatsHeader', { total: result.total, filtered: result.filtered })));
    console.info(
      `  ${padCell(t('cliEntry.auditColTool'), 25)} ${padCell(t('cliEntry.auditColTotal'), 8, 'right')} ${padCell(t('cliEntry.auditColSuccess'), 8, 'right')} ${padCell(t('cliEntry.auditColFailure'), 8, 'right')} ${padCell(t('cliEntry.auditColRate'), 8, 'right')}`,
    );
    for (const [tool, s] of [...stats.entries()].sort((a, b) => b[1].total - a[1].total)) {
      const rate = s.total > 0 ? ((s.success / s.total) * 100).toFixed(1) + '%' : 'N/A';
      console.info(
        `  ${padCell(tool, 25)} ${padCell(String(s.total), 8, 'right')} ${padCell(String(s.success), 8, 'right')} ${padCell(String(s.failure), 8, 'right')} ${padCell(rate, 8, 'right')}`,
      );
    }
    console.info('');
  });

// A36 第①步取证出口:把历史工具调用离线重放过入参校验器,打出偏差台账(绝不落入参值)
auditCmd
  .command('tool-args')
  .description(t('cliEntry.auditToolArgsDesc'))
  .option('-s, --since <time>', t('cliEntry.auditSinceDesc'))
  .option('--json', t('cliEntry.auditJsonDesc'))
  .option('--limit <n>', t('cliEntry.auditToolArgsLimitDesc'), '100000')
  .action(async (options: { since?: string; json?: boolean; limit?: string }) => {
    const limit = parseInt(options.limit ?? '100000', 10);
    const queried = queryAuditLog({ since: options.since, limit: Number.isFinite(limit) && limit > 0 ? limit : 100_000 });
    // 注册表与真实会话**同一入口**:setupAgentTools 先 clearTools 再按家族注册。
    // 自己拼一份"看着像"的子集,量到的偏差就是夹具不是事实 —— 漏掉的家族(如 write_file/edit_file
    // 来自 createFileEditTools 工厂)会整片算成 unknownTool,而它们是历史调用的大头。
    // 刻意不开 enableMcp / subagentParent:MCP 远端工具没有本地 parameters 可校验,
    // 它们会落进 unknownTool 并如实报数(覆盖率读数在下面)。
    await setupAgentTools({ workspacePath: process.cwd(), silent: true });
    const { totals, rows, toolsCovered } = replayArgumentDeviations(queried.entries, getTool);

    if (options.json) {
      console.info(JSON.stringify({ totals, rows, toolsCovered }, null, 2));
      return;
    }
    if (totals.matched === 0) {
      console.info(chalk.dim(t('cliEntry.auditEmpty')));
      return;
    }
    console.info(
      chalk.cyan(
        t('cliEntry.auditToolArgsHeader', {
          records: totals.records,
          matched: totals.matched,
          unknown: totals.unknownTool,
          invalid: totals.invalid,
          rows: totals.rows,
        }),
      ),
    );
    if (rows.length === 0) {
      console.info(chalk.green(t('cliEntry.auditToolArgsNone', { matched: totals.matched })));
      return;
    }
    for (const r of rows) {
      console.info(
        `  ${String(r.count).padStart(5)}×  ${r.tool}.${r.field}  ${r.reason}  expected=${r.expected}  got=${r.actualKind}`,
      );
    }
    console.info('');
    console.info(chalk.dim(t('cliEntry.auditToolArgsFooter', { coerced: totals.coercionOnly, threw: totals.validatorThrew })));
  });

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  program.parse();
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
