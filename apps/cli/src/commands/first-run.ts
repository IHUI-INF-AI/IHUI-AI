/**
 * 首次运行引导 — 检测无 ~/.ihui/settings.json 时自动跑交互式问答,
 * 生成开箱即用的配置文件,对标 `claude` / `codex` CLI 首次启动体验。
 *
 * 触发条件:`~/.ihui/settings.json` 不存在。
 * 跳过条件:非 TTY(headless/CI)直接用默认值生成;--no-setup 跳过。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getSettingsPath, type Settings } from './settings.js';

/** 检测是否需要首次引导(~/.ihui/settings.json 不存在) */
export function needsFirstRunSetup(): boolean {
  return !fs.existsSync(getSettingsPath());
}

/**
 * 跑首次运行引导。返回 true 表示已生成配置文件。
 *
 * - TTY:交互式问 4 个问题(API 地址 / Key / 模型 / 语言)
 * - 非 TTY:用默认值静默生成(headless 模式不阻塞 CI)
 * - 用户 Ctrl+C:进程退出
 */
export async function runFirstRunSetup(): Promise<boolean> {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 非 TTY(headless/CI):用默认值静默生成
  if (!process.stdin.isTTY) {
    const defaults = buildDefaultSettings();
    fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8');
    console.info(chalk.dim('已生成默认配置(非交互模式):' + settingsPath));
    return true;
  }

  console.info(chalk.cyan('\n欢迎使用 IHUI CLI!首次运行,需要配置以下信息:\n'));

  const answers = await inquirer.prompt<FirstRunAnswers>([
    {
      type: 'input',
      name: 'apiUrl',
      message: '后端 API 地址:',
      default: 'http://localhost:8803',
      filter: (input: string) => input.trim().replace(/\/+$/, ''),
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API 密钥(可留空,稍后用 ihui settings 或环境变量配置):',
      default: '',
    },
    {
      type: 'input',
      name: 'defaultModel',
      message: '默认模型 ID(回车用 default,由后端路由决定):',
      default: 'default',
    },
    {
      type: 'list',
      name: 'locale',
      message: '界面语言:',
      choices: ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'],
      default: 'zh-CN',
    },
  ]);

  const settings = buildDefaultSettings({
    apiUrl: answers.apiUrl,
    apiKey: answers.apiKey || undefined,
    defaultModel: answers.defaultModel,
    locale: answers.locale,
  });

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  console.info(chalk.green('\n✓ 配置已生成:' + settingsPath));
  console.info(chalk.dim('  修改配置:ihui settings init --force 重新生成模板\n'));
  return true;
}

interface FirstRunAnswers {
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  locale: string;
}

/** 构建默认 settings(用户输入覆盖默认值) */
function buildDefaultSettings(overrides?: Partial<FirstRunAnswers>): Settings {
  return {
    apiUrl: overrides?.apiUrl ?? 'http://localhost:8803',
    apiKey: overrides?.apiKey,
    defaultModel: overrides?.defaultModel ?? 'default',
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
    locale: overrides?.locale ?? 'zh-CN',
    permissionMode: 'default',
  };
}
