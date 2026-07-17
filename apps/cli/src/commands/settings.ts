/**
 * 统一配置 — ~/.ihui/settings.json,合并优先级:CLI flag > settings.json > env > 默认。
 *
 * 灵感来源:grok-build 的配置管理 + Claude Code 的 settings.json。
 * 策略:
 *   - 字段全部可选,缺省回退到 env / 默认值
 *   - 加载失败不阻塞启动,降级到默认
 *   - 提供 loadSettings / getSettingsPath / saveSettingsTemplate 接口
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { resolveSandboxOptions } from '../sandbox/index.js';
import { parsePermissionMode, type PermissionMode } from '../tools/permissions.js';

export interface SandboxSettings {
  /** 沙盒预设 profile,优先级低于显式配置的字段 */
  profile?: 'readonly' | 'limited' | 'trusted' | 'open' | 'full';
  /** 额外允许的路径白名单(cwd 始终允许) */
  allowedPaths?: string[];
  /** 命令白名单(只允许这些命令执行,空数组=允许全部,向后兼容) */
  commandAllowlist?: string[];
  /** 屏蔽的环境变量名(子进程不会继承这些变量) */
  blockedEnvVars?: string[];
}

export interface Settings {
  /** 后端 API 地址 */
  apiUrl?: string;
  /** API 密钥(优先级低于 env IHUI_API_KEY) */
  apiKey?: string;
  /** 默认模型 ID */
  defaultModel?: string;
  /** 最大工具循环次数 */
  maxIterations?: number;
  /** 是否启用审计日志(默认 true) */
  auditEnabled?: boolean;
  /** 沙盒配置 */
  sandbox?: SandboxSettings;
  /** 允许危险工具自动执行 */
  allowDangerous?: boolean;
  /** 强制 plan-first 模式 */
  planFirst?: boolean;
  /** 启用 MCP 工具 */
  enableMcp?: boolean;
  /** LLM 采样参数 */
  sampler?: SamplerSettings;
  /** 路径信任映射 */
  folderTrust?: Record<string, 'trusted' | 'read-only' | 'forbidden'>;
  /** 界面语言(zh-CN/en/ja/ko/zh-TW),优先级低于 --locale flag 与 IHUI_LOCALE 环境变量 */
  locale?: string;
  /** 权限模式(对齐 Claude Code --permission-mode):default|acceptEdits|bypassPermissions|plan|manual */
  permissionMode?: PermissionMode;
}

export interface SamplerSettings {
  /** 温度(0-2,代码任务推荐 0.2,创意任务推荐 0.7) */
  temperature?: number;
  /** top-p 采样(0-1) */
  topP?: number;
  /** top-k 采样(0-1000) */
  topK?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 停止序列 */
  stop?: string[];
  /**
   * P1-3 reasoning_effort(对齐 OpenAI o1/o3 + Claude Sonnet 4):
   * - 'minimal' / 'low' / 'medium' / 'high'(部分模型支持)
   * - 当前 streamChat 协议不直接透传,作为 metadata 字段保留,后续 API 支持后接入
   */
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

/**
 * 合并 sampler 配置:CLI flag(非 undefined)覆盖 settings.sampler 对应字段。
 * 两者都为空时返回 undefined。
 */
export function resolveSamplerSettings(
  cli?: Partial<SamplerSettings>,
  settings?: SamplerSettings,
): SamplerSettings | undefined {
  const merged: SamplerSettings = { ...(settings ?? {}), ...(cli ?? {}) };
  const cleaned: SamplerSettings = {};
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined) (cleaned as Record<string, unknown>)[k] = v;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/** 多源扫描目录(高→低):workspace 三级 → home 三级 */
const SETTINGS_SOURCE_DIRS = ['.ihui', '.claude', '.cursor'];

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function listSettingsConfigPaths(cwd: string): string[] {
  const home = getHomeDir();
  const paths: string[] = [];
  for (const d of SETTINGS_SOURCE_DIRS) paths.push(path.join(cwd, d, 'settings.json'));
  for (const d of SETTINGS_SOURCE_DIRS) paths.push(path.join(home, d, 'settings.json'));
  return paths;
}

/**
 * 深合并两个 Settings:b 覆盖 a。
 * 对象字段(sampler/sandbox/folderTrust)做一层浅合并(b 的键覆盖 a);标量与数组由 b 覆盖。
 */
export function deepMergeSettings(a: Settings, b: Settings): Settings {
  const result: Settings = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    const av = (a as Record<string, unknown>)[k];
    if (
      av && typeof av === 'object' && !Array.isArray(av) &&
      typeof v === 'object' && !Array.isArray(v)
    ) {
      (result as Record<string, unknown>)[k] = { ...(av as Record<string, unknown>), ...(v as Record<string, unknown>) };
    } else {
      (result as Record<string, unknown>)[k] = v;
    }
  }
  return result;
}

export function getSettingsPath(): string {
  return path.join(getHomeDir(), '.ihui', 'settings.json');
}

/**
 * 多源加载 settings.json,按优先级深合并(高优先级覆盖低优先级)。
 * 扫描顺序(高→低):<cwd>/.{ihui,claude,cursor} → ~/.{ihui,claude,cursor}。
 */
export function loadSettings(): Settings {
  const paths = listSettingsConfigPaths(process.cwd());
  let acc: Settings = {};
  for (const p of [...paths].reverse()) {
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      const parsed = JSON.parse(raw) as Settings;
      if (parsed && typeof parsed === 'object') {
        acc = deepMergeSettings(acc, parsed);
      }
    } catch {
      // 损坏文件忽略,继续下一源
    }
  }
  return acc;
}

export function saveSettingsTemplate(overwrite = false): boolean {
  const p = getSettingsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(p) && !overwrite) return false;
  const template: Settings = {
    apiUrl: 'http://localhost:8000',
    defaultModel: 'default',
    maxIterations: 25,
    auditEnabled: true,
    allowDangerous: false,
    planFirst: false,
    enableMcp: false,
    sandbox: { profile: 'trusted' },
    sampler: {
      temperature: 0.7,
      maxTokens: 4096,
    },
    folderTrust: {
      '.env': 'forbidden',
      '.env.*': 'forbidden',
      'package.json': 'read-only',
      'package-lock.json': 'read-only',
      'pnpm-lock.yaml': 'read-only',
      'src/*': 'trusted',
      'tests/*': 'trusted',
    },
    locale: 'zh-CN',
    permissionMode: 'default',
  };
  fs.writeFileSync(p, JSON.stringify(template, null, 2) + '\n', 'utf-8');
  return true;
}

/**
 * 合并配置优先级:CLI flag(非 undefined)> settings.json > env > 默认值。
 * CLI flag 为 undefined 表示用户未显式传入(注意:commander 对 --flag 无值时为 true,有值时为字符串)。
 */
export function resolveEffectiveConfig(args: {
  cliApiUrl?: string;
  cliApiKey?: string;
  cliModel?: string;
  cliMaxIterations?: string;
  cliMaxTurns?: string;
  cliAllowDangerous?: boolean;
  cliPlan?: boolean;
  cliMcp?: boolean;
  cliTemperature?: string;
  cliMaxTokens?: string;
  cliPermissionMode?: string;
}): {
  apiUrl: string;
  apiKey: string;
  model: string;
  maxIterations: number;
  allowDangerous: boolean;
  planFirst: boolean;
  enableMcp: boolean;
  auditEnabled: boolean;
  sandboxAllowedPaths: string[];
  sandboxCommandAllowlist: string[];
  sandboxBlockedEnvVars: string[];
  sampler?: SamplerSettings;
  permissionMode: PermissionMode;
} {
  const settings = loadSettings();

  const apiUrl =
    args.cliApiUrl ||
    settings.apiUrl ||
    process.env.IHUI_API_URL ||
    'http://localhost:8000';

  const apiKey =
    args.cliApiKey ||
    settings.apiKey ||
    process.env.IHUI_API_KEY ||
    '';

  const model = args.cliModel || settings.defaultModel || 'default';

  const maxIterationsRaw = args.cliMaxTurns
    ? parseInt(args.cliMaxTurns, 10)
    : args.cliMaxIterations
      ? parseInt(args.cliMaxIterations, 10)
      : settings.maxIterations ?? 25;
  const maxIterations = Number.isFinite(maxIterationsRaw) && maxIterationsRaw > 0
    ? maxIterationsRaw
    : 25;

  const allowDangerous =
    args.cliAllowDangerous ?? settings.allowDangerous ?? false;

  const planFirst = args.cliPlan ?? settings.planFirst ?? false;

  const enableMcp = args.cliMcp ?? settings.enableMcp ?? false;

  const auditEnabled = settings.auditEnabled ?? true;

  const sandboxResolved = resolveSandboxOptions(
    settings.sandbox?.profile,
    settings.sandbox ?? {}
  );
  const sandboxAllowedPaths = sandboxResolved.allowedPaths ?? [];
  const sandboxCommandAllowlist = sandboxResolved.commandAllowlist ?? [];
  const sandboxBlockedEnvVars = sandboxResolved.blockedEnvVars ?? [];

  const cliSampler: Partial<SamplerSettings> = {};
  if (args.cliTemperature) {
    const t = parseFloat(args.cliTemperature);
    if (Number.isFinite(t)) cliSampler.temperature = t;
  }
  if (args.cliMaxTokens) {
    const m = parseInt(args.cliMaxTokens, 10);
    if (Number.isFinite(m) && m > 0) cliSampler.maxTokens = m;
  }
  const sampler = resolveSamplerSettings(cliSampler, settings.sampler);

  // 优先级:CLI flag > settings.permissionMode > 'default'
  const permissionMode: PermissionMode =
    parsePermissionMode(args.cliPermissionMode) ?? settings.permissionMode ?? 'default';

  return {
    apiUrl,
    apiKey,
    model,
    maxIterations,
    allowDangerous,
    planFirst,
    enableMcp,
    auditEnabled,
    sandboxAllowedPaths,
    sandboxCommandAllowlist,
    sandboxBlockedEnvVars,
    sampler,
    permissionMode,
  };
}
