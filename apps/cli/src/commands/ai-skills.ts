/**
 * AI Skills CLI — AI 技能 TOP 查询与管理命令,对标 Web 端 /ai-skills 2 页功能(列表 + 详情)。
 *
 * 对接后端 apps/ai-service/app/routers/ai_skills.py(/api/ai-skills 端点,ai-service 8803 端口):
 *  - GET /api/ai-skills         → AiSkillMeta[](19 个 skill 元数据,含状态/分类/标签)
 *  - GET /api/ai-skills/:id     → AiSkillMeta(单个 skill 详情,含 promptTemplate)
 *
 * 端点为公开接口(Python 路由无鉴权依赖),无需登录即可查询;
 * 若本地存在 access token 则附带 Authorization 头(兼容未来加鉴权场景)。
 *
 * install/remove 为 CLI 本地操作(管理 ~/.ihui/ai-skills.json 已安装清单),
 * 对标 Web 端无对应功能,作为 CLI 增强:用户可标记常用 skill。
 *
 * 实现模板复用 memory.ts 的 resolveBaseUrl / resolveApiKeyAsync / apiRequest / extractData / handleError。
 *
 * 用法:
 *   ihui ai-skills list [--category <c>] [--json]
 *   ihui ai-skills show <id> [--json]
 *   ihui ai-skills install <id> [--json]
 *   ihui ai-skills remove <id> [--json]
 */

import type { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { createApiRequest, extractData, handleError, printJson, resolveApiKeyAsync, resolveBaseUrl } from './http-utils.js';

const API_PREFIX = '/api/ai-skills';
const DEFAULT_TIMEOUT_MS = 30_000;
const apiRequest = createApiRequest(API_PREFIX, DEFAULT_TIMEOUT_MS);
const TEXT_TRUNCATE_LEN = 60;

const CATEGORIES = ['code', 'media', 'ai-top'] as const;
type SkillCategory = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  code: '代码',
  media: '媒体',
  'ai-top': 'AI TOP',
};

// === 请求 / 响应类型(本地定义,与 @ihui/api-client/endpoints/ai-skills.ts 对齐) ===

interface AiSkillMeta {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SkillCategory;
  tags: string[];
  source: 'builtin' | 'auto' | 'ai-top';
  sourceUrl: string;
  available: boolean;
  promptTemplate: string;
}

// === 本地已安装清单(~/.ihui/ai-skills.json) ===

interface InstalledSkillsData {
  installed: string[];
}

// === CLI options 类型 ===

interface ListOptions {
  category?: string;
  json?: boolean;
}

interface ShowOptions {
  json?: boolean;
}

interface InstallOptions {
  json?: boolean;
}

interface RemoveOptions {
  json?: boolean;
}

// === 类型守卫 ===

function isSkillCategory(v: unknown): v is SkillCategory {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

function isAiSkillMeta(v: unknown): v is AiSkillMeta {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as { id: unknown }).id === 'string' &&
    'name' in v &&
    typeof (v as { name: unknown }).name === 'string' &&
    'description' in v &&
    'available' in v &&
    typeof (v as { available: unknown }).available === 'boolean'
  );
}

function isAiSkillList(v: unknown): v is AiSkillMeta[] {
  return Array.isArray(v) && v.every(isAiSkillMeta);
}

// === 本地已安装清单读写 ===

function getInstalledSkillsPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  return path.join(home, '.ihui', 'ai-skills.json');
}

function loadInstalledSkills(): Set<string> {
  const p = getInstalledSkillsPath();
  try {
    if (!fs.existsSync(p)) return new Set();
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as InstalledSkillsData;
    if (parsed && Array.isArray(parsed.installed)) {
      return new Set(parsed.installed.filter((s): s is string => typeof s === 'string'));
    }
  } catch {
    // 损坏文件忽略,降级为空集合
  }
  return new Set();
}

function saveInstalledSkills(ids: Set<string>): void {
  const p = getInstalledSkillsPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data: InstalledSkillsData = { installed: [...ids] };
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// === 参数校验 ===

function parseCategory(v: string | undefined): SkillCategory | undefined {
  if (v === undefined) return undefined;
  if (isSkillCategory(v)) return v;
  throw new Error(`无效的 category "${v}",合法值: ${CATEGORIES.join(' / ')}`);
}

// ==================== list ====================

async function listSkills(
  baseUrl: string,
  category: SkillCategory | undefined,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  const resp = await apiRequest(baseUrl, '', { apiKey });

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAiSkillList(data)) {
    console.error(chalk.red('✗ 响应格式异常,期望 AI Skill 数组'));
    process.exitCode = 1;
    return;
  }

  const filtered = category ? data.filter((s) => s.category === category) : data;
  // 已上线优先 + 同状态按 name 升序(对齐 Web 端排序逻辑)
  const sorted = [...filtered].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (sorted.length === 0) {
    console.info(chalk.dim('(暂无 AI 技能)'));
    return;
  }

  const installed = loadInstalledSkills();
  console.info('');
  for (const s of sorted) {
    const mark = installed.has(s.id) ? chalk.green('✓') : chalk.dim('○');
    const status = s.available ? chalk.green('已上线') : chalk.dim('即将上线');
    const desc = (s.description ?? '').slice(0, TEXT_TRUNCATE_LEN);
    const cat = CATEGORY_LABEL[s.category] ?? s.category;
    console.info(
      `${mark} [${chalk.cyan(s.id)}] ${chalk.bold(s.name)} ${status} ${chalk.dim(cat)} ${desc}`,
    );
  }
  const availableCount = sorted.filter((s) => s.available).length;
  console.info(chalk.dim(`\n共 ${sorted.length} 个技能(${availableCount} 个已上线,${installed.size} 个已标记)`));
}

// ==================== show ====================

async function showSkill(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, `/${encodeURIComponent(id)}`, { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: 'AI 技能不存在', data: null });
        return;
      }
      console.error(chalk.red(`✗ 未找到技能 id=${id}`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  if (asJson) {
    printJson(resp);
    return;
  }

  const data = extractData(resp);
  if (!isAiSkillMeta(data)) {
    console.error(chalk.red('✗ 响应格式异常,期望 AI Skill 对象'));
    process.exitCode = 1;
    return;
  }

  const installed = loadInstalledSkills();
  const status = data.available ? chalk.green('已上线') : chalk.dim('即将上线');
  const installMark = installed.has(data.id)
    ? chalk.green('✓ 已标记')
    : chalk.dim('○ 未标记');
  const cat = CATEGORY_LABEL[data.category] ?? data.category;

  console.info('');
  console.info(`${chalk.bold(data.name)} ${status} ${installMark}`);
  console.info(chalk.dim(`  ID: ${data.id}  分类: ${cat}  来源: ${data.source}`));
  console.info(`  ${data.description}`);

  if (data.tags.length > 0) {
    console.info(chalk.dim('  标签:') + ` ${data.tags.join(', ')}`);
  }
  if (data.sourceUrl) {
    console.info(chalk.dim('  GitHub:') + ` ${data.sourceUrl}`);
  }
  if (data.promptTemplate) {
    const preview = data.promptTemplate.slice(0, 120);
    const ellipsis = data.promptTemplate.length > 120 ? '...' : '';
    console.info(chalk.dim('  Prompt 模板预览:') + ` ${preview}${ellipsis}`);
  }
}

// ==================== install ====================

async function installSkill(
  baseUrl: string,
  id: string,
  asJson: boolean,
  apiKey?: string,
): Promise<void> {
  // 先验证技能存在
  let resp: unknown;
  try {
    resp = await apiRequest(baseUrl, `/${encodeURIComponent(id)}`, { apiKey });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 404) {
      if (asJson) {
        printJson({ code: 404, message: 'AI 技能不存在,无法标记', data: null });
        return;
      }
      console.error(chalk.red(`✗ 未找到技能 id=${id},无法标记`));
      process.exitCode = 1;
      return;
    }
    throw err;
  }

  const data = extractData(resp);
  if (!isAiSkillMeta(data)) {
    console.error(chalk.red('✗ 响应格式异常,期望 AI Skill 对象'));
    process.exitCode = 1;
    return;
  }

  const installed = loadInstalledSkills();
  const already = installed.has(id);
  if (!already) {
    installed.add(id);
    saveInstalledSkills(installed);
  }

  if (asJson) {
    printJson({ id: data.id, name: data.name, installed: true, already });
    return;
  }

  const tag = already ? chalk.yellow('(已标记,跳过)') : '';
  console.info(chalk.green(`✓ 已标记技能 ${chalk.bold(data.name)} (${data.id})${tag}`));
  if (data.sourceUrl) {
    console.info(chalk.dim(`  GitHub: ${data.sourceUrl}`));
  }
}

// ==================== remove ====================

function removeSkill(id: string, asJson: boolean): void {
  const installed = loadInstalledSkills();
  const existed = installed.has(id);
  if (existed) {
    installed.delete(id);
    saveInstalledSkills(installed);
  }

  if (asJson) {
    printJson({ id, removed: existed });
    return;
  }

  if (existed) {
    console.info(chalk.green(`✓ 已取消标记技能 ${id}`));
  } else {
    console.info(chalk.dim(`○ 技能 ${id} 未在已标记清单中(无需操作)`));
  }
}

// ==================== 命令注册 ====================

/**
 * 在根 program 上注册 `ai-skills` 命令组。
 * 使用全局 `--api-url` / `--api-key` 或 settings.json 解析后端地址(默认 ai-service 8803)。
 */
export function registerAiSkillsCommand(program: Command): void {
  const skillsCmd = program
    .command('ai-skills')
    .description('AI 技能 TOP 查询与管理 (对标 Web 端 /ai-skills)');

  skillsCmd
    .command('list')
    .description('列出全部 AI 技能(19 个 TOP skill)')
    .option('--category <category>', '按分类过滤 (code/media/ai-top)')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (opts: ListOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        const category = parseCategory(opts.category);
        await listSkills(baseUrl, category, Boolean(opts.json), apiKey ?? undefined);
      } catch (err) {
        handleError('ai-skills list', err);
      }
    });

  skillsCmd
    .command('show <id>')
    .description('查看指定 AI 技能详情')
    .option('--json', '以 JSON 格式输出完整响应')
    .action(async (id: string, opts: ShowOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        await showSkill(baseUrl, id, Boolean(opts.json), apiKey ?? undefined);
      } catch (err) {
        handleError('ai-skills show', err);
      }
    });

  skillsCmd
    .command('install <id>')
    .description('标记技能为已安装(本地清单,便于跟踪常用 skill)')
    .option('--json', '以 JSON 格式输出 { id, name, installed, already }')
    .action(async (id: string, opts: InstallOptions) => {
      try {
        const { apiUrl: cliApiUrl, apiKey: cliApiKey } = program.opts() as {
          apiUrl?: string;
          apiKey?: string;
        };
        const baseUrl = resolveBaseUrl(cliApiUrl);
        const apiKey = await resolveApiKeyAsync(cliApiKey, baseUrl);
        await installSkill(baseUrl, id, Boolean(opts.json), apiKey ?? undefined);
      } catch (err) {
        handleError('ai-skills install', err);
      }
    });

  skillsCmd
    .command('remove <id>')
    .description('取消标记已安装的技能(本地清单)')
    .option('--json', '以 JSON 格式输出 { id, removed }')
    .action((id: string, opts: RemoveOptions) => {
      try {
        removeSkill(id, Boolean(opts.json));
      } catch (err) {
        handleError('ai-skills remove', err);
      }
    });
}
