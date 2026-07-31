/**
 * /config REPL 内查看/修改 settings.json — 无需退出 REPL。
 *
 * 设计目标(对标 codex/claude-code/mimo code 的配置可达性):
 *   - 用户反馈"不知道在哪里切换模型配置模型 不明显"
 *   - REPL 内直接 /config 查看/修改,不用退到 shell 跑 `ihui settings init --force`
 *   - 支持 /config get <key> · /config set <key> <value> · /config list · /config edit · /config path
 *   - 修改后即时持久化到 ~/.ihui/settings.json
 *
 * 安全约束:
 *   - 不允许通过 /config 修改审计相关字段(auditEnabled 等)以防逃避审计
 *   - 不允许修改 folderTrust / sandbox 等 P0 安全字段(需手动编辑文件)
 *   - 允许修改的 key 白名单:apiUrl/apiKey/defaultModel/locale/permissionMode/maxIterations/enableMcp/planFirst/allowDangerous/sampler.*
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import {
  getSettingsPath,
  loadSettings,
  type Settings,
  type SamplerSettings,
} from './settings.js';

// === 允许通过 /config 修改的 key 白名单 ===

type ConfigValueType = 'string' | 'number' | 'boolean' | 'enum' | 'sampler';

interface ConfigFieldMeta {
  /** 字段路径(点号分隔,如 'sampler.temperature') */
  key: string;
  /** 显示名 */
  label: string;
  /** 值类型 */
  type: ConfigValueType;
  /** 当前值 getter */
  get: (s: Settings) => unknown;
  /** 枚举可选值(type === 'enum' 时有效) */
  enumValues?: readonly string[];
  /** 描述 */
  description: string;
}

const CONFIG_FIELDS: readonly ConfigFieldMeta[] = [
  {
    key: 'apiUrl',
    label: '后端 API 地址',
    type: 'string',
    get: (s) => s.apiUrl ?? '',
    description: '后端 API 地址(如 http://localhost:8802)',
  },
  {
    key: 'apiKey',
    label: 'API 密钥',
    type: 'string',
    get: (s) => (s.apiKey ? s.apiKey!.slice(0, 4) + '****' : '(空)'),
    description: 'API 密钥(用 IHUI_API_KEY 环境变量更安全)',
  },
  {
    key: 'defaultModel',
    label: '默认模型',
    type: 'string',
    get: (s) => s.defaultModel ?? 'default',
    description: '默认模型 ID(/model 可在 REPL 内临时切换)',
  },
  {
    key: 'locale',
    label: '界面语言',
    type: 'enum',
    enumValues: ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'],
    get: (s) => s.locale ?? 'zh-CN',
    description: '界面语言',
  },
  {
    key: 'permissionMode',
    label: '权限模式',
    type: 'enum',
    enumValues: ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'],
    get: (s) => s.permissionMode ?? 'default',
    description: '权限模式:default|acceptEdits|bypassPermissions|plan|manual',
  },
  {
    key: 'maxIterations',
    label: '最大工具循环',
    type: 'number',
    get: (s) => s.maxIterations ?? 25,
    description: 'Agent 单次任务最大工具循环次数(1-200)',
  },
  {
    key: 'enableMcp',
    label: 'MCP 工具',
    type: 'boolean',
    get: (s) => s.enableMcp ?? false,
    description: '启用 MCP 工具(从 ~/.ihui/mcp.json 加载)',
  },
  {
    key: 'planFirst',
    label: '强制 Plan First',
    type: 'boolean',
    get: (s) => s.planFirst ?? false,
    description: '强制 LLM 先输出 plan 块再执行工具',
  },
  {
    key: 'allowDangerous',
    label: '允许危险工具',
    type: 'boolean',
    get: (s) => s.allowDangerous ?? false,
    description: '允许危险工具自动执行(默认 false,REPL 内交互确认)',
  },
  {
    key: 'sampler.temperature',
    label: '采样温度',
    type: 'number',
    get: (s) => s.sampler?.temperature ?? 0.7,
    description: 'LLM 温度(0-2,代码任务推荐 0.2,创意任务推荐 0.7)',
  },
  {
    key: 'sampler.maxTokens',
    label: '最大生成 token',
    type: 'number',
    get: (s) => s.sampler?.maxTokens ?? 4096,
    description: 'LLM 单次最大生成 token 数(1-32768)',
  },
];

// === 工具函数 ===

function findField(key: string): ConfigFieldMeta | undefined {
  return CONFIG_FIELDS.find((f) => f.key === key);
}

/** 深写入(支持点号路径,自动创建中间对象) */
function setDeep(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]!;
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) {
      cur[k] = {};
    }
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/** 把字符串解析为对应类型的值 */
function parseValue(raw: string, type: ConfigValueType, enumValues?: readonly string[]): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = raw.trim();
  switch (type) {
    case 'string':
      return { ok: true, value: trimmed };
    case 'boolean': {
      const lower = trimmed.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return { ok: true, value: true };
      if (['false', '0', 'no', 'off'].includes(lower)) return { ok: true, value: false };
      return { ok: false, error: `布尔值需为 true/false(收到: ${raw})` };
    }
    case 'number': {
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return { ok: false, error: `数字格式无效: ${raw}` };
      return { ok: true, value: n };
    }
    case 'enum': {
      if (!enumValues || !enumValues.includes(trimmed)) {
        return { ok: false, error: `枚举值无效,可选: ${(enumValues ?? []).join(' | ')}` };
      }
      return { ok: true, value: trimmed };
    }
    case 'sampler':
      return { ok: false, error: 'sampler 类型字段不支持直接 set,用 sampler.temperature / sampler.maxTokens' };
    default:
      return { ok: false, error: `未知字段类型: ${type}` };
  }
}

/** 把当前 settings 写回 ~/.ihui/settings.json */
function saveSettings(settings: Settings): void {
  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

// === 渲染 ===

/** /config list 渲染(白名单字段 + 当前值 + 描述) */
export function renderConfigList(): string {
  const settings = loadSettings();
  const lines: string[] = [];
  lines.push(chalk.cyan(`\n╭─ 配置 · ${CONFIG_FIELDS.length} 项可修改`));
  lines.push(chalk.cyan('│'));
  lines.push(chalk.dim(`│  配置文件: ${getSettingsPath()}`));
  lines.push(chalk.cyan('│'));
  for (const f of CONFIG_FIELDS) {
    const value = f.get(settings);
    const valueStr = typeof value === 'string' ? value : String(value);
    const typeTag = chalk.dim(`[${f.type}${f.enumValues ? `: ${f.enumValues.join('|')}` : ''}]`);
    lines.push(`│  ${chalk.bold(f.key.padEnd(22))} ${chalk.green(String(valueStr).padEnd(20))} ${typeTag}`);
    lines.push(`│  ${' '.repeat(24)}${chalk.dim(f.description)}`);
  }
  lines.push(chalk.cyan('│'));
  lines.push(chalk.cyan('╰─ /config set <key> <value> 修改 · /config get <key> 查看 · /config edit 用编辑器打开'));
  lines.push('');
  return lines.join('\n');
}

/** /config get <key> 渲染 */
function renderConfigGet(key: string): string {
  const field = findField(key);
  if (!field) {
    return chalk.yellow(`未知配置项: ${key}\n  ↳ /config list 查看所有可配置项`);
  }
  const settings = loadSettings();
  const value = field.get(settings);
  const lines: string[] = [];
  lines.push(chalk.cyan(`\n╭─ ${field.label} (${field.key})`));
  lines.push(`│  ${chalk.dim('当前值:')} ${chalk.green(String(value))}`);
  lines.push(`│  ${chalk.dim('类型:  ')} ${field.type}${field.enumValues ? ` (${field.enumValues.join('|')})` : ''}`);
  lines.push(`│  ${chalk.dim('描述:  ')} ${field.description}`);
  lines.push(chalk.cyan('╰─'));
  lines.push('');
  return lines.join('\n');
}

/** /config set <key> <value> */
function handleConfigSet(key: string, valueStr: string): string {
  const field = findField(key);
  if (!field) {
    return chalk.yellow(`未知配置项: ${key}\n  ↳ /config list 查看所有可配置项`);
  }
  const parsed = parseValue(valueStr, field.type, field.enumValues);
  if (!parsed.ok) {
    return chalk.red(`✗ ${parsed.error}`);
  }
  // 数值边界校验
  if (field.key === 'maxIterations') {
    const n = parsed.value as number;
    if (n < 1 || n > 200) return chalk.red(`✗ maxIterations 需在 1-200 范围(收到: ${n})`);
  }
  if (field.key === 'sampler.temperature') {
    const n = parsed.value as number;
    if (n < 0 || n > 2) return chalk.red(`✗ temperature 需在 0-2 范围(收到: ${n})`);
  }
  if (field.key === 'sampler.maxTokens') {
    const n = parsed.value as number;
    if (n < 1 || n > 32768) return chalk.red(`✗ maxTokens 需在 1-32768 范围(收到: ${n})`);
  }
  // 写入
  const settings = loadSettings() as Settings & Record<string, unknown>;
  setDeep(settings as Record<string, unknown>, field.key, parsed.value);
  // 确保 sampler 对象存在(为 sampler.temperature/maxTokens 写入兜底)
  if (field.key.startsWith('sampler.') && !settings.sampler) {
    settings.sampler = {} as SamplerSettings;
  }
  saveSettings(settings);
  return chalk.green(`✓ ${field.key} = ${String(parsed.value)}\n  ${chalk.dim('(已写入 ' + getSettingsPath() + ')')}\n  ${chalk.dim('部分字段(如 defaultModel/locale)在下次启动 REPL 生效')}`);
}

/** /config path */
function handleConfigPath(): string {
  return chalk.cyan(getSettingsPath());
}

/** /config edit:用 $EDITOR 打开配置文件 */
function handleConfigEdit(): string {
  const editor = process.env.EDITOR || process.env.VISUAL;
  const p = getSettingsPath();
  if (!editor) {
    return chalk.yellow(`未设置 $EDITOR 环境变量,请手动编辑:\n  ${p}\n  ${chalk.dim('Windows: notepad "' + p + '"')}`);
  }
  // 不能直接 spawn(在 REPL 内会阻塞),提示用户在新终端执行
  return chalk.cyan(`请在另一个终端运行:\n  ${editor} "${p}"\n  ${chalk.dim('修改后回到 REPL 用 /config list 验证')}`);
}

/** /config help */
function renderConfigHelp(): string {
  const lines: string[] = [
    chalk.cyan('\n╭─ /config 用法'),
    chalk.cyan('│'),
    '│  /config                   显示所有配置(同 /config list)',
    '│  /config list              显示所有配置',
    '│  /config get <key>         查看指定配置项',
    `│  /config set <key> <value> 修改配置(${chalk.dim('如 /config set defaultModel gpt-4o')})`,
    '│  /config path              显示配置文件路径',
    '│  /config edit              用 $EDITOR 打开配置文件',
    '│  /config help              显示本帮助',
    chalk.cyan('│'),
    chalk.cyan('╰─ 配置持久化到 ~/.ihui/settings.json'),
    '',
  ];
  return lines.join('\n');
}

// === 命令分发 ===

/**
 * /config 命令入口,返回要打印的字符串。
 *
 * 用法:
 *   /config                  → list
 *   /config list             → list
 *   /config get <key>
 *   /config set <key> <value>
 *   /config path
 *   /config edit
 *   /config help
 */
export function handleConfigCommand(input: string): string {
  const parts = input.trim().split(/\s+/);
  const sub = parts[0] ?? 'list';

  switch (sub) {
    case '':
    case 'list':
      return renderConfigList();

    case 'get': {
      const key = parts[1];
      if (!key) return chalk.yellow('用法: /config get <key>');
      return renderConfigGet(key);
    }

    case 'set': {
      const key = parts[1];
      const value = parts.slice(2).join(' ');
      if (!key || !value) {
        return chalk.yellow('用法: /config set <key> <value>');
      }
      return handleConfigSet(key, value);
    }

    case 'path':
      return handleConfigPath();

    case 'edit':
      return handleConfigEdit();

    case 'help':
    case '?':
      return renderConfigHelp();

    default:
      return chalk.yellow(`未知子命令: ${sub}\n${renderConfigHelp()}`);
  }
}

// === Tab 补全支持 ===

/** 返回 /config 子命令列表(供 completer 使用) */
export function getConfigSubcommands(): readonly string[] {
  return ['list', 'get', 'set', 'path', 'edit', 'help'] as const;
}

/** 返回所有可配置 key(供 /config get/set 补全使用) */
export function getConfigKeys(): readonly string[] {
  return CONFIG_FIELDS.map((f) => f.key);
}
