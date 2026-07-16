/**
 * 统一配置 — ~/.ihui/settings.json,合并优先级:CLI flag > settings.json > env > 默认。
 *
 * 灵感来源:cli 的配置管理 + Claude Code 的 settings.json。
 * 策略:
 *   - 字段全部可选,缺省回退到 env / 默认值
 *   - 加载失败不阻塞启动,降级到默认
 *   - 提供 loadSettings / getSettingsPath / saveSettingsTemplate 接口
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface SandboxSettings {
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
}

export function getSettingsPath(): string {
  return path.join(os.homedir(), '.ihui', 'settings.json');
}

export function loadSettings(): Settings {
  const p = getSettingsPath();
  try {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as Settings;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
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
    sandbox: { allowedPaths: [], commandAllowlist: [], blockedEnvVars: [] },
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
  cliAllowDangerous?: boolean;
  cliPlan?: boolean;
  cliMcp?: boolean;
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

  const maxIterationsRaw = args.cliMaxIterations
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

  const sandboxAllowedPaths = settings.sandbox?.allowedPaths ?? [];
  const sandboxCommandAllowlist = settings.sandbox?.commandAllowlist ?? [];
  const sandboxBlockedEnvVars = settings.sandbox?.blockedEnvVars ?? [];

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
  };
}
